import { NextRequest, NextResponse } from 'next/server';
import { CampaignGuidelineAnalysis } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { getAiQuotaBlockedMessage, getAiQuotaStatus } from '@/lib/ai-quota';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

const client = new GoogleGenerativeAI(apiKey || '');

const SafeStringArraySchema = z
  .preprocess((value) => (value === null ? [] : value), z.array(z.string()).optional())
  .transform((value) => value ?? []);

const SafeVisitReviewTypesSchema = z
  .preprocess(
    (value) => (value === null ? [] : value),
    z.array(z.enum(['naverReservation', 'googleReview', 'other'])).optional()
  )
  .transform((value) => value ?? []);

const ContentRequirementsSchema = z.object({
  // 방문형 리뷰 필수 항목 (네이버예약, 구글리뷰, 기타)
  visitReviewTypes: SafeVisitReviewTypesSchema,
  visitReviewOtherText: z.string().nullable().optional(),
});

const GuidelineDigestSchema = z.object({
  summary: z.string().optional(),
  sections: z.array(
    z.object({
      title: z.string(),
      items: SafeStringArraySchema,
    })
  ).optional(),
}).optional();

const CampaignGuidelineAnalysisSchema = z.object({
  title: z.string(),
  points: z.number().nullable().optional(),
  keywords: SafeStringArraySchema.optional(),
  platform: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  reviewChannel: z.string().nullable().optional(),
  visitInfo: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  reviewRegistrationPeriod: z.object({
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
  }).optional(),
  contentRequirements: ContentRequirementsSchema.optional(),
  guidelineDigest: GuidelineDigestSchema,
});

// StructuredOutputParser 생성
const outputParser = StructuredOutputParser.fromZodSchema(CampaignGuidelineAnalysisSchema);
const formatInstructions = outputParser.getFormatInstructions();

function normalizeOptionList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
}

function normalizeGuidelineDigest(input: any): any {
  if (!input || typeof input !== 'object') return undefined;

  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const sections = Array.isArray(input.sections)
    ? input.sections
        .map((section: any) => {
          if (!section || typeof section !== 'object') return null;
          const title = typeof section.title === 'string' ? section.title.trim() : '';
          const items = Array.isArray(section.items)
            ? section.items
                .map((item: any) => (typeof item === 'string' ? item.trim() : ''))
                .filter((item: string) => item.length > 0)
            : typeof section.items === 'string'
              ? [section.items.trim()].filter((item) => item.length > 0)
              : [];

          if (!title && items.length === 0) return null;
          return {
            title: title || '기타 상세 내용',
            items,
          };
        })
        .filter((section: any) => section && section.items.length > 0)
    : [];

  if (!summary && sections.length === 0) return undefined;

  return {
    ...(summary ? { summary } : {}),
    ...(sections.length > 0 ? { sections } : {}),
  };
}

function normalizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const keyword = raw.trim().replace(/\s+/g, ' ');
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(keyword);
    if (normalized.length >= 50) break;
  }
  return normalized;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function parseKoreanNumberFragment(value: string): number | null {
  const cleaned = value.replace(/\s+/g, '');
  const unitMap: Record<string, number> = {
    억: 100000000,
    만: 10000,
    천: 1000,
    백: 100,
    십: 10,
  };

  const unitMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)(억|만|천|백|십)/g)];
  if (unitMatches.length > 0) {
    return unitMatches.reduce((sum, match) => {
      const numberValue = Number(match[1]);
      const unitValue = unitMap[match[2]] ?? 1;
      return sum + numberValue * unitValue;
    }, 0);
  }

  const numeric = cleaned.replace(/[^0-9.]/g, '');
  if (!numeric) return null;
  return Number(numeric);
}

function normalizePointsValue(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/,/g, '')
    .replace(/포인트|point|points|p\b/gi, '')
    .replace(/\s+/g, '');

  if (/[~\-]/.test(normalized)) {
    const parts = normalized.split(/[~\-]/).map((part) => part.trim()).filter(Boolean);
    const values = parts
      .map((part) => parseKoreanNumberFragment(part))
      .filter((part): part is number => typeof part === 'number' && !Number.isNaN(part));
    if (values.length > 0) return Math.max(...values);
  }

  const parsed = parseKoreanNumberFragment(normalized);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return Math.round(parsed);
}

function extractPointsFromGuideline(guideline: string): number | null {
  if (!guideline?.trim()) return null;

  const rewardContextPattern =
    /(포인트|리워드|체험권|쿠폰|제공내역|제공|추가\s*결제|결제|구매|금액|가격)/i;

  const candidateSegments = guideline
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && rewardContextPattern.test(line));

  const rangePattern = /\d[\d,]*(?:\.\d+)?\s*[~\-]\s*\d[\d,]*(?:\.\d+)?\s*(?:원|p|포인트|points?)?/gi;
  const koreanUnitPattern = /\d+(?:\.\d+)?(?:억|만|천|백|십)(?:\d+(?:\.\d+)?(?:만|천|백|십))?\s*(?:원|p|포인트|points?)?/gi;
  const plainAmountPattern = /\d[\d,]*(?:\.\d+)?\s*(?:원|p|포인트|points?)/gi;

  const parsedValues: number[] = [];
  const collect = (value: string) => {
    const normalized = normalizePointsValue(value);
    if (typeof normalized === 'number' && Number.isFinite(normalized) && normalized > 0) {
      parsedValues.push(normalized);
    }
  };

  candidateSegments.forEach((segment) => {
    const rangeMatches = segment.match(rangePattern) ?? [];
    const koreanUnitMatches = segment.match(koreanUnitPattern) ?? [];
    const plainMatches = segment.match(plainAmountPattern) ?? [];

    [...rangeMatches, ...koreanUnitMatches, ...plainMatches].forEach(collect);
  });

  if (parsedValues.length === 0) return null;
  return Math.max(...parsedValues);
}

function inferPlatformFromGuideline(guideline: string, userPlatforms: string[]): string | null {
  if (!guideline?.trim() || userPlatforms.length === 0) {
    return null;
  }

  const normalizedGuideline = normalizeForMatch(guideline);
  const matched = userPlatforms.find((platform) =>
    normalizedGuideline.includes(normalizeForMatch(platform))
  );

  return matched ?? null;
}

function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw.trim();

  const localDigits = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;

  if (localDigits.startsWith('02')) {
    if (localDigits.length === 9) {
      return `02-${localDigits.slice(2, 5)}-${localDigits.slice(5)}`;
    }
    if (localDigits.length === 10) {
      return `02-${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
    }
  } else if (/^0\d{2}/.test(localDigits)) {
    if (localDigits.length === 10) {
      return `${localDigits.slice(0, 3)}-${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
    }
    if (localDigits.length === 11) {
      return `${localDigits.slice(0, 3)}-${localDigits.slice(3, 7)}-${localDigits.slice(7)}`;
    }
  }

  return raw.trim();
}

function extractPhoneFromGuideline(guideline: string): string | null {
  if (!guideline?.trim()) return null;

  const matches = guideline.match(/(?:\+82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g) ?? [];
  if (matches.length === 0) return null;

  const firstMatch = matches[0];
  if (!firstMatch) return null;
  const normalized = normalizePhoneNumber(firstMatch);
  return normalized || null;
}

function normalizeDeadlineValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

const GUIDELINE_ANALYSIS_PROMPT = `당신은 체험단 캠페인 가이드라인 분석 전문가입니다.

### 목표
아래 가이드라인 텍스트를 분석하여 필수 매핑 필드를 정확하고 자세하게 추출하세요.

### 출력 규칙 (최우선)
1. 반드시 유효한 JSON 객체만 반환하세요. 코드블록, 설명문, 마크다운 금지.
2. 날짜는 현재 기준 2026-02-12에 맞춰 YYYY-MM-DD로 정규화하세요.
3. 숫자 필드는 정수로 반환하세요.
4. 카테고리는 아래 허용 목록에서만 선택하세요. 없으면 "기타".
   - 맛집/식품, 뷰티, 생활/리빙, 출산/육아, 주방/가전, 반려동물, 여행/레저, 데이트, 웨딩, 티켓/문화생활, 디지털/전자기기, 건강/헬스, 자동차/모빌리티, 문구/오피스, 기타
5. guidelineDigest(가이드라인 전체 상세 정리)에는 원문 내용을 축약/생략하지 말고, 원본의 모든 조건/수치/주의사항/금지사항을 빠짐없이 포함하세요.

### 필수 매핑 필드 (반드시 정확하고 자세하게 추출)
이 필드들은 캠페인 관리의 핵심이므로 가이드라인에서 최우선으로 찾아 정확하게 추출해야 합니다.

1. **title** (제목): 
   - 캠페인/체험단의 공식 제목 추출
   - 브랜드명이나 제품명이 포함된 전체 제목을 추출하세요
   - 예: "ABC 브랜드 신제품 체험단 모집", "OO카페 방문 리뷰 이벤트"
   
2. **points** (제품/서비스 가격): 
   - 포인트, 리워드, 체험권, 제품 가격 등의 금액을 숫자로 추출
   - 다양한 표현 형식을 모두 인식:
     * 숫자: "15,000P" -> 15000, "5000포인트" -> 5000
     * 한글 단위: "1만" -> 10000, "1만5천" -> 15000, "2.5만" -> 25000
     * 범위: "1~2만" -> 20000 (최대값), "5,000-10,000P" -> 10000 (최대값)
     * 복합: "1만5천원 상당", "2만원대" -> 해당 금액 추출
   - "리워드", "체험권", "제공", "가격", "금액" 등의 문맥에서 찾으세요
   - 여러 금액이 있으면 가장 큰 금액을 선택
   
3. **reviewRegistrationPeriod.start** (시작일):
   - 캠페인 시작일 또는 리뷰 작성 시작 가능일 (YYYY-MM-DD)
   - "~부터", "~일자부터", "시작일" 등의 표현에서 추출
   
4. **reviewRegistrationPeriod.end** (마감일): 
   - 리뷰 제출 마감일 (YYYY-MM-DD)
   - "~까지", "마감", "종료", "제출 기한" 등의 표현에서 추출
   - 명확하지 않으면 캠페인 종료일 또는 최종 일정을 사용
   
5. **platform** (플랫폼): 
   - 캠페인이 진행되는 플랫폼명
   - 예: "레뷰", "체험뿐", "미블", "서울오빠", "리뷰어스", "디너의여왕" 등
   - 가이드라인에 명시된 플랫폼명을 그대로 추출
   - 사용자 정의 플랫폼 목록과 대조하여 일치하는 것이 있으면 정규화
   
6. **category** (카테고리): 
   - 제품/서비스의 카테고리를 위 허용 목록에서 선택
   - 가이드라인 내용을 분석하여 가장 적합한 카테고리 선택
   - 예: 음식점 -> "맛집/식품", 화장품 -> "뷰티", 가구 -> "생활/리빙"
   
7. **reviewChannel** (리뷰채널): 
   - 리뷰를 작성해야 하는 채널명 (필수)
   - 예: "네이버 블로그", "인스타그램", "유튜브", "네이버 플레이스" 등
   - 복수의 채널이 있을 경우 주요 채널을 선택
   - 사용자 정의 채널 목록과 대조하여 일치하는 것이 있으면 정규화
   
8. **phone** (전화번호):
   - 방문형 여부와 관계없이, 가이드라인에 전화번호가 있으면 항상 추출하세요.
   - 예약/문의/고객센터/매장 연락처 등 모든 연락 가능한 대표 번호를 우선 추출하세요.
   - 형식: "02-1234-5678", "010-1234-5678" 등
   - 여러 번호가 있으면 대표번호 또는 예약/문의용 번호를 우선하세요.

9. **방문형 캠페인일 경우** (해당 시에만):
   - **visitInfo** (주소/위치): 
     * 방문해야 하는 장소의 상세 주소 또는 위치 정보
     * 예: "서울시 강남구 테헤란로 123", "홍대입구역 5번출구 도보 3분"
     * 여러 지점이 있으면 모두 포함하거나 대표 주소 선택

   - **contentRequirements.visitReviewTypes**: 
     * 방문 후 추가로 작성해야 하는 리뷰 플랫폼 목록
     * 근거에 따라 배열로 추출:
       - "네이버 예약", "영수증 예약" 언급 -> ["naverReservation"]
       - "구글 리뷰", "구글맵" 언급 -> ["googleReview"]
       - "카카오맵", "기타 플랫폼" 언급 -> ["other"]
     * 복수 선택 가능, 명확한 근거가 없으면 빈 배열 또는 생략

10. **guidelineDigest** (가이드라인 전체 상세 정리):
   - 가이드라인의 **모든 내용을 누락 없이** 완벽하게 구조화하여 정리하세요.
   - **핵심 목표**: 사용자가 원본 가이드라인을 다시 보지 않아도 될 정도로 모든 세부 규칙, 경고, 팁을 포함해야 합니다.
   - 구조:
     * **summary**: 전체 요약 (핵심 내용만 3~5문장)
     * **sections**: 주제별 섹션 배열 (최대한 세분화)
       - section.title: 명확한 섹션 제목 (예: "제공 내역", "방문 및 예약 안내", "리뷰 작성 가이드", "키워드/해시태그", "주의사항", "패널티 안내", "제출 방법")
       - section.items: 해당 섹션의 상세 항목 리스트. (원본의 톤앤매너를 유지하며 구체적 수치/조건/금지사항을 그대로 서술)
   - 규칙:
     * **완전성(Completeness)**: 원문에 있는 내용이라면 사소한 주의사항, 추가금 안내, 주차 정보, 와이파이 여부 등도 모두 섹션으로 만들어 포함하세요.
     * **구체성 유지**: "주의사항을 준수하세요" 처럼 뭉뚱그리지 말고, "당일 예약 불가, 15분 지각 시 노쇼 처리"와 같이 구체적으로 적으세요.
     * 정보가 너무 많으면 섹션을 더 잘게 쪼개세요.

11. **keywords** (가이드라인 키워드 원문):
   - 가이드라인에 "제목키워드", "본문키워드", "서브키워드" 등으로 나열된 키워드를 우선 추출하세요.
   - 키워드 문구는 임의로 축약/재분류하지 말고, 가이드라인에 적힌 표현을 그대로 유지하세요.
   - "핵심 키워드" 같은 단일 그룹으로 다시 묶지 마세요.
   - 반드시 문자열 배열로 반환하세요. 예: ["제목키워드: OO맛집", "본문키워드: 강남파스타", "서브키워드: 데이트코스"]

### 전체 추출 원칙
1. **완전성 (Zero Omission)**: guidelineDigest 필드에는 가이드라인의 처음부터 끝까지 모든 정보가 구조화되어 들어가야 합니다. 중요하지 않아 보이는 정보도 '기타 안내' 등의 섹션에 포함하세요.
2. **정확성**: 필수 매핑 필드는 정확하게 추출하세요. 추측하지 말고 가이드라인에 명시된 내용만 사용하세요.
3. **근거 기반**: 근거 없는 추측이나 일반적인 정보는 추가하지 마세요. 가이드라인에 있는 내용만 추출하세요.
4. **빈 값 제거**: 빈 배열, 빈 객체, null 값은 생략하세요. 정보가 없으면 해당 필드를 포함하지 마세요.

${formatInstructions}`;

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      console.error('API Key not configured');
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

    const { guideline, userId, scheduleId } = await request.json();

    if (!guideline || typeof guideline !== 'string') {
      return NextResponse.json({ error: '가이드라인 텍스트가 필요합니다' }, { status: 400 });
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 });
    }

    const parsedScheduleId =
      typeof scheduleId === 'number'
        ? scheduleId
        : typeof scheduleId === 'string' && scheduleId.trim()
          ? Number(scheduleId)
          : null;

    // Supabase에서 사용자의 플랫폼, 카테고리, 리뷰채널 조회
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return NextResponse.json(
        { error: 'Supabase 설정이 없습니다' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('platforms, categories, schedule_channels, last_guideline_analysis_at, last_blog_draft_generated_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('사용자 프로필 조회 오류:', profileError);
      return NextResponse.json(
        { error: '사용자 정보를 조회할 수 없습니다' },
        { status: 400 }
      );
    }

    // 사용자의 옵션 추출
    const userPlatforms = normalizeOptionList(userProfile?.platforms);
    const userCategories = normalizeOptionList(userProfile?.categories);
    const userReviewChannels = normalizeOptionList(userProfile?.schedule_channels);
    const quotaStatus = getAiQuotaStatus({
      lastGuidelineAnalysisAt: userProfile?.last_guideline_analysis_at,
      lastBlogDraftGeneratedAt: userProfile?.last_blog_draft_generated_at,
    });

    if (!quotaStatus.guideline.allowed) {
      return NextResponse.json(
        {
          error: getAiQuotaBlockedMessage('guideline'),
          quota: quotaStatus,
        },
        { status: 429 }
      );
    }

    // 프롬프트 동적 생성 (사용자 옵션 포함)
    const dynamicPrompt = `${GUIDELINE_ANALYSIS_PROMPT}

## 사용자 정의 옵션 (가능하면 이 목록에 맞춰 정규화하세요):
- **플랫폼**: ${userPlatforms.length > 0 ? userPlatforms.join(', ') : '없음'}
- **카테고리**: ${userCategories.length > 0 ? userCategories.join(', ') : '없음'}
- **리뷰채널**: ${userReviewChannels.length > 0 ? userReviewChannels.join(', ') : '없음'}

플랫폼/카테고리/리뷰채널은 가이드라인에서 먼저 추출하고, 사용자 정의 옵션과 일치하는 값이 있으면 그 값을 우선 사용하세요.
일치값이 없으면 가이드라인에서 추출한 값을 유지하세요.`;

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${dynamicPrompt}\n\n다음 캠페인 가이드라인을 분석하세요:\n\n${guideline}`,
            },
          ],
        },
      ],
    });

    const responseText = response.response.text();

    let analysis: CampaignGuidelineAnalysis;
    try {
      // StructuredOutputParser를 통한 자동 파싱 및 검증
      analysis = await outputParser.parse(responseText);
    } catch (parseError) {
      const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
      const jsonFallbackMatch = responseText.match(/\{[\s\S]*\}/);
      const rawJson = jsonBlockMatch?.[1] ?? jsonFallbackMatch?.[0];

      if (!rawJson) {
        throw parseError;
      }

      const repairedJson = jsonrepair(rawJson);
      const parsedJson = JSON.parse(repairedJson);

      if (parsedJson.points !== undefined) {
        parsedJson.points = normalizePointsValue(parsedJson.points);
      }
      if (parsedJson.guidelineDigest !== undefined) {
        parsedJson.guidelineDigest = normalizeGuidelineDigest(parsedJson.guidelineDigest);
      }
      if (parsedJson.keywords !== undefined) {
        parsedJson.keywords = normalizeKeywords(parsedJson.keywords);
      }
      const validated = CampaignGuidelineAnalysisSchema.safeParse(parsedJson);

      if (!validated.success) {
        throw new Error(
          `유효하지 않은 분석 결과입니다: ${validated.error.issues
            .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
            .join(', ')}`
        );
      }

      analysis = validated.data as CampaignGuidelineAnalysis;
    }

    // 필수 필드 정규화
    if (analysis.points !== undefined) {
      analysis.points = normalizePointsValue(analysis.points);
    }
    if (analysis.guidelineDigest !== undefined) {
      analysis.guidelineDigest = normalizeGuidelineDigest(analysis.guidelineDigest);
    }
    analysis.keywords = normalizeKeywords(analysis.keywords);
    const normalizedEnd = normalizeDeadlineValue(analysis.reviewRegistrationPeriod?.end);
    analysis.reviewRegistrationPeriod = analysis.reviewRegistrationPeriod
      ? {
          ...analysis.reviewRegistrationPeriod,
          end: normalizedEnd,
        }
      : { end: null };
    if (analysis.phone?.trim()) {
      analysis.phone = normalizePhoneNumber(analysis.phone);
    }

    // 포인트 후처리: 모델이 points를 누락한 경우 원문에서 보상 금액을 추출해 보정
    const extractedPoints = extractPointsFromGuideline(guideline);
    const hasTopLevelPoints = typeof analysis.points === 'number' && Number.isFinite(analysis.points);

    if (!hasTopLevelPoints && extractedPoints !== null) {
      analysis.points = extractedPoints;
    }

    // 플랫폼 후처리: 모델 결과가 비어있거나 사용자 옵션과 불일치하면 가이드라인 텍스트 기준으로 보정
    if (!analysis.platform?.trim()) {
      const inferredPlatform = inferPlatformFromGuideline(guideline, userPlatforms);
      if (inferredPlatform) {
        analysis.platform = inferredPlatform;
      }
    }

    // 전화번호 후처리: 모델이 phone을 누락한 경우 원문에서 보정
    if (!analysis.phone?.trim()) {
      const extractedPhone = extractPhoneFromGuideline(guideline);
      if (extractedPhone) {
        analysis.phone = extractedPhone;
      }
    }

    let persistedToSchedule = false;
    if (parsedScheduleId !== null && Number.isFinite(parsedScheduleId)) {
      const { error: persistError } = await supabase
        .from('schedules')
        .update({
          guideline_analysis: analysis,
          original_guideline_text: guideline.trim(),
        })
        .eq('id', parsedScheduleId)
        .eq('user_id', userId);

      if (persistError) {
        console.error('가이드라인 분석 데이터 저장 실패:', persistError);
      } else {
        persistedToSchedule = true;
      }
    }

    const { error: quotaUpdateError } = await supabase
      .from('user_profiles')
      .update({ last_guideline_analysis_at: new Date().toISOString() })
      .eq('id', userId);

    if (quotaUpdateError) {
      console.error('가이드라인 분석 쿼터 시간 저장 실패:', quotaUpdateError);
    }

    return NextResponse.json({
      success: true,
      data: analysis,
      persistedToSchedule,
    });
  } catch (error) {
    console.error('가이드라인 분석 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '가이드라인 분석 중 오류가 발생했습니다';
    console.error('상세 오류:', errorMessage);
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
