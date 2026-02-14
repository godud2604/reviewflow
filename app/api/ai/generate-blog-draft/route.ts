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

function sanitizeDraftOutput(value: string, shouldTrim = true): string {
  const sanitized = value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/(^|\s)#([^\s#]+)/g, '$1$2')
    .replace(/[ \t]{2,}/g, ' ');
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

    const systemPrompt = `
    당신은 한국어 리뷰형 블로그 전문 작가입니다.
    목표는 과장 광고 문구가 아닌 실제 경험처럼 자연스럽고 신뢰감 있는 글을 작성하는 것입니다.

    [문체 규칙]
    - 1인칭 경험 중심으로, 말하듯 자연스럽게 씁니다.
    - 장점과 아쉬운 점을 균형 있게 다룹니다.
    - "결론적으로", "요약하자면" 같은 번역투 접속사는 쓰지 않습니다.
    - 과장/허위 표현(무조건, 인생맛집, 100% 효과 등)은 쓰지 않습니다.

    [사실성 규칙]
    - 제공된 JSON에 없는 기능/정보를 지어내지 않습니다.
    - 체험단/캠페인 운영 정보(모집·선정·마감·원고료·신청·리뷰제출·전화번호·주소·링크·일정/기간)는 본문에 포함하지 않습니다.

    [출력 규칙]
    - 출력은 순수 텍스트만 사용합니다.
    - 마크다운 강조(*, **), 마크다운 헤더(#), 해시태그(#키워드)는 절대 사용하지 않습니다.
    - 소제목을 절대 사용하지 않습니다. 본문은 일반 문단만 작성합니다.
    - 최종 출력 전체(제목 줄 + 본문, 공백/줄바꿈 포함)는 정확히 ${options.targetLength}자여야 합니다.
    - 최종 출력 직전에 글자 수를 반드시 다시 계산하고, 정확히 ${options.targetLength}자가 아니면 문장을 늘리거나 줄여서 맞춘 뒤에만 출력합니다.
    - ${options.targetLength}자에 1자라도 어긋나면 출력하지 말고 내부에서 계속 수정합니다.
    `;

    const userPrompt = `
    제공된 [캠페인 분석 JSON] 데이터를 바탕으로, 독자가 제품/서비스를 이해하고 공감할 수 있는 매력적인 리뷰 초안을 작성하세요.

    [핵심 지침]
    1. 자연스러운 스토리텔링: 단순 나열이 아니라 "나의 고민 -> 제품 발견 -> 사용/경험 -> 느낀 점" 흐름으로 작성하세요.
    2. 가독성 최적화: 문단은 3~4줄 내외로 구성하세요.
    3. 키워드 반영: 필수 키워드는 본문에 최소 3회 이상 자연스럽게 녹여서 언급하세요.

    [작성 옵션]
    - 목표 글자수: 최종 출력 전체(제목 + 본문) 공백/줄바꿈 포함 정확히 ${options.targetLength}자
    - 리뷰 컨셉(페르소나): ${PERSONA_GUIDE[options.persona]}
    - 글 말투: ${TONE_GUIDE[options.tone]}
    - 강조 포인트: ${emphasis ? emphasis : '제품의 차별점과 실제 사용 만족도 위주'}
    - 필수 키워드: ${keywords.length > 0 ? keywords.join(', ') : '없음'}

    [캠페인 분석 JSON]
    ${JSON.stringify(sanitizedAnalysis, null, 2)}

    위 설정을 바탕으로 블로그 제목(1개 추천)과 본문을 작성해 주세요.
    본문은 소제목 없이 자연스러운 문단 흐름으로만 작성하세요.
    글자 수가 정확히 ${options.targetLength}자인지 최종 점검 후 출력하세요.
    출력 형식:
    제목: (제목 한 줄)

    (본문)
    `;

    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });
    const streamResult = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
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
                  text: sanitizeDraftOutput(chunkText, false),
                })
              )
            );
          }

          const finalText = sanitizeDraftOutput(draftBuffer);
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
