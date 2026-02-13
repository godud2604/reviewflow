import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getAiQuotaBlockedMessage, getAiQuotaStatus } from '@/lib/ai-quota';

const apiKey = process.env.GEMINI_API_KEY;
const client = new GoogleGenerativeAI(apiKey || '');

const RequestSchema = z.object({
  analysis: z.any(),
  userId: z.string().min(1).optional(),
  scheduleId: z.union([z.number(), z.string()]).optional(),
  originalGuideline: z.string().optional(),
  options: z.object({
    targetLength: z.union([
      z.literal(500),
      z.literal(800),
      z.literal(1000),
      z.literal(1500),
      z.literal(2000),
      z.literal(3000),
    ]),
    tone: z.enum(['auto', 'haeyo', 'hamnida', 'banmal']),
    persona: z.enum(['balanced', 'friendly', 'expert', 'honest', 'lifestyle']),
    emphasis: z.string().max(1000).optional(),
    keywords: z.array(z.string().min(1).max(40)).max(20).optional(),
  }),
});

const TONE_GUIDE: Record<string, string> = {
  auto: '문맥에 맞는 자연스러운 존댓말 톤',
  haeyo: '"~해요" 중심의 친근한 존댓말',
  hamnida: '"~합니다" 중심의 정돈된 존댓말',
  banmal: '"~한다" 중심의 담백한 반말',
};

const PERSONA_GUIDE: Record<string, string> = {
  balanced: '콘텐츠 목적과 카테고리에 맞춰 자동으로 균형 잡힌 리뷰어 페르소나를 선택',
  friendly: '친구에게 공유하듯 공감형으로 쓰는 친근한 리뷰어',
  expert: '근거와 비교 포인트를 강조하는 정보형 리뷰어',
  honest: '장단점을 솔직하게 말하는 현실형 리뷰어',
  lifestyle: '일상 루틴과 라이프스타일 맥락을 강조하는 리뷰어',
};

const CAMPAIGN_META_PATTERN =
  /(체험단|캠페인|모집|선정|마감|신청|제출|원고료|포인트|제공\s*내역|방문|예약|리뷰\s*등록|미션|전화|연락처|주소|지도|링크|url|쿠폰|결제|환급|일정|기간|담당자)/i;

function normalizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const keyword = value.trim().replace(/\s+/g, ' ');
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
    if (result.length >= 20) break;
  }
  return result;
}

function filterCampaignMetaText(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !CAMPAIGN_META_PATTERN.test(line))
    .join('\n')
    .trim();
}

function buildDraftAnalysisContext(analysis: any) {
  const keywords = normalizeKeywords(analysis?.keywords);
  const digestSummary =
    typeof analysis?.guidelineDigest?.summary === 'string'
      ? filterCampaignMetaText(analysis.guidelineDigest.summary)
      : '';
  const digestSections = Array.isArray(analysis?.guidelineDigest?.sections)
    ? analysis.guidelineDigest.sections
        .map((section: any) => {
          const title = typeof section?.title === 'string' ? section.title.trim() : '';
          const items = Array.isArray(section?.items)
            ? section.items
                .map((item: any) => (typeof item === 'string' ? item.trim() : ''))
                .filter((item: string) => item.length > 0 && !CAMPAIGN_META_PATTERN.test(item))
            : [];
          if (!title || items.length === 0) return null;
          return { title, items };
        })
        .filter(Boolean)
    : [];

  return {
    keywords,
    guidelineDigest: {
      summary: digestSummary,
      sections: digestSections,
    },
  };
}

function stripBoldMarkdown(value: string, shouldTrim = true): string {
  const sanitized = value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '');
  return shouldTrim ? sanitized.trim() : sanitized;
}

function createNdjsonLine(payload: Record<string, unknown>): string {
  return `${JSON.stringify(payload)}\n`;
}

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set in environment variables' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join(' | ');
      return NextResponse.json(
        { error: '요청 형식이 올바르지 않습니다.', details },
        { status: 400 }
      );
    }

    const { analysis, options } = parsed.data;
    const parsedScheduleIdRaw = parsed.data.scheduleId;
    const parsedScheduleId =
      typeof parsedScheduleIdRaw === 'number'
        ? parsedScheduleIdRaw
        : typeof parsedScheduleIdRaw === 'string' && parsedScheduleIdRaw.trim()
          ? Number(parsedScheduleIdRaw)
          : null;
    const userId = parsed.data.userId?.trim();
    const isValidUuidUserId = Boolean(userId && z.string().uuid().safeParse(userId).success);
    const originalGuideline = parsed.data.originalGuideline?.trim();
    const emphasis = options.emphasis?.trim() ?? '';
    const keywords = (options.keywords ?? [])
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const canUseSupabaseForQuotaAndPersistence = Boolean(
      isValidUuidUserId && supabaseUrl && supabaseServiceKey
    );
    const supabase = canUseSupabaseForQuotaAndPersistence
      ? createClient(supabaseUrl as string, supabaseServiceKey as string)
      : null;

    if (canUseSupabaseForQuotaAndPersistence && supabase && userId) {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('last_guideline_analysis_at, last_blog_draft_generated_at')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        return NextResponse.json({ error: '사용자 정보를 조회할 수 없습니다.' }, { status: 400 });
      }

      const quotaStatus = getAiQuotaStatus({
        lastGuidelineAnalysisAt: userProfile?.last_guideline_analysis_at ?? null,
        lastBlogDraftGeneratedAt: userProfile?.last_blog_draft_generated_at ?? null,
      });
      if (!quotaStatus.blogDraft.allowed) {
        return NextResponse.json(
          {
            error: getAiQuotaBlockedMessage('blogDraft'),
            quota: quotaStatus,
          },
          { status: 429 }
        );
      }
    }

    const sanitizedAnalysis = buildDraftAnalysisContext(analysis);

    const prompt = `
    당신은 '네이버 블로그 상위 1% 인플루언서'이자 '마케팅 원고 전문가'입니다.
    제공된 [캠페인 분석 JSON] 데이터를 바탕으로, 독자가 제품/서비스를 사고 싶게 만드는 매력적인 리뷰 초안을 작성하세요.

    [핵심 지침]
    1. **자연스러운 스토리텔링**: 단순한 스펙 나열이 아니라, "나의 고민 -> 제품 발견 -> 해결"의 흐름으로 작성하세요. (단, 제품의 스펙/효능은 반드시 JSON 데이터에 기반할 것)
    2. **가독성 최적화**:
      - 문단은 3~4줄 내외로 끊어 지루하지 않게 구성하세요.
    3. **키워드 자연스럽게 녹이기**: 입력된 '반영 키워드'는 본문 내에 최소 3회 이상 자연스럽게 반복해서 언급하세요.
    4. **금지 사항**: 
      - "결론적으로", "요약하자면" 같은 딱딱한 번역투 접속사 사용 금지.
      - 없는 기능을 있는 것처럼 꾸며내는 허위 사실 기재 금지.
      - 본문에 마크다운 강조("**굵게**" 같은 형식)를 절대 사용하지 말 것.
      - 체험단/캠페인 운영 정보(모집·선정·마감·포인트·원고료·신청방법·리뷰제출·방문인증·전화번호·주소·링크·일정/기간)는 절대 포함하지 말 것.

    [작성 옵션]
    - **글자수 가이드**: 공백 포함 약 ${options.targetLength}자 (너무 짧지 않게 풍성하게 묘사)
    - **리뷰 컨셉(페르소나)**: ${PERSONA_GUIDE[options.persona]} 
      *(예: 꼼꼼분석형이라면 수치와 성분을 강조, 감성일상형이라면 나의 느낌과 분위기 위주로 서술)*
    - **글 말투**: ${TONE_GUIDE[options.tone]}
    - **강조 포인트**: ${emphasis ? emphasis : '제품의 차별점과 실제 사용 만족도 위주'}
    - **필수 키워드**: ${keywords.length > 0 ? keywords.join(', ') : '없음'}

    [캠페인 분석 JSON]
    ${JSON.stringify(sanitizedAnalysis, null, 2)}

    ---
    위 설정을 바탕으로 블로그 제목(1개 추천)과 본문을 작성해 주세요.
    출력 형식:
    # [제목]
    (본문 내용...)
    ※ 출력은 순수 텍스트만 사용하고, 별표(*)를 포함한 마크다운 강조는 사용하지 마세요.
    `;

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const streamResult = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let draftBuffer = '';
        try {
          for await (const chunk of streamResult.stream) {
            const chunkTextRaw = chunk?.text?.() ?? '';
            const chunkText = chunkTextRaw
              .replace(/^```[\w]*\n?/, '')
              .replace(/\n?```$/, '');
            if (!chunkText) continue;

            draftBuffer += chunkText;
            controller.enqueue(
              encoder.encode(
                createNdjsonLine({
                  type: 'token',
                  text: stripBoldMarkdown(chunkText, false),
                })
              )
            );
          }

          const finalText = stripBoldMarkdown(draftBuffer);
          if (!finalText) {
            controller.enqueue(
              encoder.encode(
                createNdjsonLine({
                  type: 'error',
                  error: '초안 생성 결과가 비어 있습니다. 다시 시도해주세요.',
                })
              )
            );
            return;
          }

          const updatedAt = new Date().toISOString();
          let persistedToSchedule = false;
          if (
            supabase &&
            userId &&
            parsedScheduleId !== null &&
            Number.isFinite(parsedScheduleId)
          ) {
            const { error: persistError } = await supabase
              .from('schedules')
              .update({
                blog_draft: finalText,
                blog_draft_options: options,
                blog_draft_updated_at: updatedAt,
                guideline_analysis: analysis,
                original_guideline_text: originalGuideline || null,
              })
              .eq('id', parsedScheduleId)
              .eq('user_id', userId);

            if (persistError) {
              console.error('블로그 초안 데이터 저장 실패:', persistError);
            } else {
              persistedToSchedule = true;
            }
          }

          if (supabase && userId) {
            const { error: quotaUpdateError } = await supabase
              .from('user_profiles')
              .update({ last_blog_draft_generated_at: updatedAt })
              .eq('id', userId);

            if (quotaUpdateError) {
              console.error('블로그 초안 쿼터 시간 저장 실패:', quotaUpdateError);
            }
          }

          controller.enqueue(
            encoder.encode(
              createNdjsonLine({
                type: 'done',
                draft: finalText,
                updatedAt,
                persistedToSchedule,
              })
            )
          );
        } catch (streamError) {
          console.error('블로그 초안 생성 스트리밍 오류:', streamError);
          controller.enqueue(
            encoder.encode(
              createNdjsonLine({
                type: 'error',
                error: '블로그 초안 생성 중 오류가 발생했습니다.',
              })
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('블로그 초안 생성 오류:', error);
    return NextResponse.json(
      { error: '블로그 초안 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
