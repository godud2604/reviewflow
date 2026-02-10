import { NextRequest, NextResponse } from 'next/server';
import { CampaignGuidelineAnalysis } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

const client = new GoogleGenerativeAI(apiKey || '');

const ContentRequirementsSchema = z.object({
  titleKeywords: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  bodyKeywords: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  requirements: z.array(z.object({
    type: z.string(),
    label: z.string(),
    value: z.number(),
    description: z.string(),
  })).optional(),
  // 방문형 리뷰 필수 항목 (네이버예약, 구글리뷰, 기타)
  visitReviewTypes: z.array(z.enum(['naverReservation', 'googleReview', 'other'])).optional(),
});

const ReviewCardsSchema = z.object({
  scheduleAction: z.object({
    visitType: z.enum(['visit', 'delivery', 'hybrid']).optional(),
    address: z.string().optional(),
    reservationMethod: z.string().optional(),
    availableHours: z.string().optional(),
    deliveryDeadline: z.string().optional(),
    pickupRequired: z.boolean().optional(),
    actionItems: z.array(z.string()).optional(),
  }).optional(),
  missionSpec: z.object({
    minChars: z.number().optional(),
    minPhotos: z.number().optional(),
    videoRequired: z.boolean().optional(),
    requiredShots: z.array(z.string()).optional(),
    linkRequirements: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
  }).optional(),
  copyPack: z.object({
    titleKeywords: z.array(z.string()).optional(),
    bodyKeywords: z.array(z.string()).optional(),
    hashtags: z.array(z.string()).optional(),
    mentionTags: z.array(z.string()).optional(),
  }).optional(),
  productAppeal: z.object({
    coreBenefits: z.array(z.string()).optional(),
    comparisonPoints: z.array(z.string()).optional(),
    recommendedUseCases: z.array(z.string()).optional(),
    targetAudience: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    keyIngredientsOrSpecs: z.array(z.string()).optional(),
    usageTips: z.array(z.string()).optional(),
    beforeAfterPoints: z.array(z.string()).optional(),
    trustSignals: z.array(z.string()).optional(),
    faqIdeas: z.array(z.string()).optional(),
    narrativeHooks: z.array(z.string()).optional(),
    recommendedStructure: z.array(z.string()).optional(),
    callToAction: z.array(z.string()).optional(),
    bannedOrCautionInCopy: z.array(z.string()).optional(),
  }).optional(),
  riskManagement: z.object({
    requiredNotices: z.array(z.string()).optional(),
    bannedPhrases: z.array(z.string()).optional(),
    retentionPeriod: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  }).optional(),
}).optional();

const CampaignGuidelineAnalysisSchema = z.object({
  title: z.string(),
  points: z.number().nullable().optional(),
  platform: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  reviewChannel: z.string().nullable().optional(),
  visitInfo: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  reviewRegistrationPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  rewardInfo: z.object({
    description: z.string().nullable().optional(),
    points: z.number().nullable().optional(),
    deliveryMethod: z.string().nullable().optional(),
    productInfo: z.string().nullable().optional(),
  }).nullable().optional(),
  contentRequirements: ContentRequirementsSchema.optional(),
  requiredNotices: z.array(z.string()).optional(),
  missions: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    examples: z.array(z.string()).optional(),
  })).optional(),
  importantNotes: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  reviewCards: ReviewCardsSchema,
});

// StructuredOutputParser 생성
const outputParser = StructuredOutputParser.fromZodSchema(CampaignGuidelineAnalysisSchema);
const formatInstructions = outputParser.getFormatInstructions();

/**
 * titleKeywords/bodyKeywords 배열을 정규화합니다.
 * 잘못된 구조를 자동으로 수정합니다.
 * 
 * 예시:
 * - "string" → {name: "string", description: ""}
 * - ["array", "items"] → {name: "array / items", description: ""}
 * - {name, description} → {name, description} (그대로)
 * - {name, ...otherFields} → {name, description: ""} (제거)
 */
function sanitizeKeywordsArray(
  items: any[]
): Array<{ name: string; description: string }> {
  return items
    .map((item: any) => {
      // 문자열인 경우
      if (typeof item === 'string') {
        return { name: item, description: '' };
      }

      // 배열인 경우 (예: ["#라운지엑스", "#라운지엑스24h"])
      if (Array.isArray(item)) {
        return {
          name: item.join(' / '),
          description: '',
        };
      }

      // 객체인 경우
      if (typeof item === 'object' && item !== null) {
        const name = item.name || item.keyword || item.text || '';
        const description = item.description || '';

        if (name) {
          return { name, description };
        }
      }

      return null;
    })
    .filter((item): item is { name: string; description: string } => item !== null && item.name);
}

function normalizeOptionList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
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

const GUIDELINE_ANALYSIS_PROMPT = `당신은 체험단 캠페인 가이드라인 분석 전문가입니다.

### 목표
아래 가이드라인 텍스트를 리뷰 작성용 5대 카드로 분류하고, 스키마에 맞는 단일 JSON 객체로 반환하세요.

### 추론 방식 (문맥 기반 CoT, 내부 수행)
아래 절차를 내부적으로 단계별 수행한 뒤, 최종 결과만 JSON으로 출력하세요.

### 출력 규칙 (최우선)
1. 반드시 유효한 JSON 객체만 반환하세요. 코드블록, 설명문, 마크다운 금지.
2. 필드는 실제 근거가 있을 때만 포함하세요. 불필요한 빈 배열/빈 객체/null을 임의 생성하지 마세요.
3. 날짜는 현재 기준 2026-02-10에 맞춰 YYYY-MM-DD로 정규화하세요.
4. 숫자 필드는 정수로 반환하세요.
5. 카테고리는 아래 허용 목록에서만 선택하세요. 없으면 "기타".
   - 맛집/식품, 뷰티, 생활/리빙, 출산/육아, 주방/가전, 반려동물, 여행/레저, 데이트, 웨딩, 티켓/문화생활, 디지털/전자기기, 건강/헬스, 자동차/모빌리티, 문구/오피스, 기타

### 추출 대상
1. 기본 정보
   - title, platform, category, reviewChannel, visitInfo, phone
2. 일정
   - 리뷰/포스팅 제출 기간 또는 마감 → reviewRegistrationPeriod
3. 보상
   - 포인트/리워드/체험권/지급 관련 수치 → points 또는 rewardInfo.points
   - 설명/전달방식/제품정보 → rewardInfo 하위 필드
4. 컨텐츠 요구사항
   - 제목 키워드 → contentRequirements.titleKeywords
   - 본문 키워드/필수 문구/필수 작성 리뷰 → contentRequirements.bodyKeywords
   - 이미지/영상/링크/글자수 등 정량 요구 → contentRequirements.requirements
   - 필수 고지 문구(법적/플랫폼 정책) → requiredNotices
5. 미션/주의사항
   - 미션 제목/설명/예시 → missions[]
   - 금지/패널티/불이익 → warnings[]
   - 운영상 중요 안내 → importantNotes[]

### 5대 카드 매핑 (reviewCards)
아래 5개 카드를 reviewCards 하위에 반드시 매핑하세요. 근거가 없으면 필드 생략 가능.
1. 일정 및 예약 → reviewCards.scheduleAction
   - visitType(visit/delivery/hybrid), address, reservationMethod, availableHours
   - deliveryDeadline, pickupRequired, actionItems
2. 콘텐츠 미션 → reviewCards.missionSpec
   - minChars, minPhotos, videoRequired
   - requiredShots, linkRequirements, requirements
3. 키워드 및 태그 → reviewCards.copyPack
   - titleKeywords, bodyKeywords, hashtags, mentionTags (모두 문자열 배열)
4. 제품 소구점(블로그 소스) → reviewCards.productAppeal
   - coreBenefits, comparisonPoints, recommendedUseCases
   - targetAudience, painPoints, keyIngredientsOrSpecs
   - usageTips, beforeAfterPoints, trustSignals
   - faqIdeas, narrativeHooks, recommendedStructure
   - callToAction, bannedOrCautionInCopy
5. 주의사항 → reviewCards.riskManagement
   - requiredNotices, bannedPhrases, retentionPeriod, warnings

### 4번 카드 강화 규칙 (중요)
- 4번 카드는 "블로그 글 작성에 바로 쓰는 재료"를 최대한 풍부하게 채우세요.
- 단순 나열보다 "문장으로 확장 가능한 단서"를 우선 추출하세요.
- 원문 근거가 약한 경우 과장/추측 생성 금지, 근거 있는 범위만 채우세요.
- 제품 상세페이지/가이드 문맥에서 아래를 적극 추출:
  - 어떤 사람에게 맞는지(targetAudience), 어떤 고민 해결인지(painPoints)
  - 성분/스펙/수치(keyIngredientsOrSpecs), 사용 팁(usageTips)
  - 비교 우위(comparisonPoints), 신뢰 근거(trustSignals)
  - 글 도입 훅(narrativeHooks), 본문 구성안(recommendedStructure), CTA(callToAction)

### contentRequirements.visitReviewTypes 판별 (방문형 캠페인일 때만)
- naverReservation:
  - "네이버 예약", "예약자 리뷰", "예약고객 리뷰", "네이버 예약 리뷰 필수" 등 표현이 있으면 포함
- googleReview:
  - "구글 리뷰", "Google Review", "구글평점" 등 표현이 있으면 포함
- other:
  - 카카오맵/카카오지도/기타 리뷰 플랫폼/추가 리뷰/기타 리뷰/선택 리뷰 표현이 있으면 포함
- 복수 조건 충족 시 복수 포함
- 근거가 없으면 visitReviewTypes 필드를 만들지 마세요.

### 키워드 필드 형식 (엄수)
titleKeywords/bodyKeywords는 항상 아래 형식:
[
  {"name":"키워드","description":"설명"}
]
- 문자열 배열 금지
- 임의 키 이름 금지
- 각 항목은 반드시 name, description 포함
- "필수 작성" 맥락이면 description에 "필수"를 반영

### 포인트 정규화 규칙 (엄수)
- 보상 문맥의 숫자를 우선 사용
- 예: "15,000P" -> 15000
- 예: "1만" -> 10000, "1만5천" -> 15000, "2.5만" -> 25000
- 범위는 최대값 사용: "1~2만" -> 20000, "5,000-10,000P" -> 10000
- 포인트 정보가 없으면 null 가능

### 매핑 체크리스트
- 컨텐츠 요구사항 -> contentRequirements / requiredNotices
- 미션 세부사항 -> missions[{title, description, examples}]
- 주의/제한/패널티 -> warnings
- 일정 준수/제출 방식 등 운영 안내 -> importantNotes
- 5대 카드 -> reviewCards.scheduleAction / missionSpec / copyPack / productAppeal / riskManagement

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

    const { guideline, userId } = await request.json();

    if (!guideline || typeof guideline !== 'string') {
      return NextResponse.json({ error: '가이드라인 텍스트가 필요합니다' }, { status: 400 });
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 });
    }

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
      .select('platforms, categories, schedule_channels')
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

      // contentRequirements의 titleKeywords와 bodyKeywords 자동 수정
      if (parsedJson.contentRequirements?.titleKeywords) {
        parsedJson.contentRequirements.titleKeywords = sanitizeKeywordsArray(
          parsedJson.contentRequirements.titleKeywords
        );
      }

      if (parsedJson.contentRequirements?.bodyKeywords) {
        parsedJson.contentRequirements.bodyKeywords = sanitizeKeywordsArray(
          parsedJson.contentRequirements.bodyKeywords
        );
      }

      if (parsedJson.points !== undefined) {
        parsedJson.points = normalizePointsValue(parsedJson.points);
      }
      if (parsedJson.rewardInfo?.points !== undefined) {
        parsedJson.rewardInfo.points = normalizePointsValue(parsedJson.rewardInfo.points);
      }
      if (parsedJson.reviewCards?.copyPack) {
        parsedJson.reviewCards.copyPack.titleKeywords = normalizeStringArray(
          parsedJson.reviewCards.copyPack.titleKeywords
        );
        parsedJson.reviewCards.copyPack.bodyKeywords = normalizeStringArray(
          parsedJson.reviewCards.copyPack.bodyKeywords
        );
        parsedJson.reviewCards.copyPack.hashtags = normalizeStringArray(
          parsedJson.reviewCards.copyPack.hashtags
        );
        parsedJson.reviewCards.copyPack.mentionTags = normalizeStringArray(
          parsedJson.reviewCards.copyPack.mentionTags
        );
      }
      if (parsedJson.reviewCards?.missionSpec) {
        parsedJson.reviewCards.missionSpec.requiredShots = normalizeStringArray(
          parsedJson.reviewCards.missionSpec.requiredShots
        );
        parsedJson.reviewCards.missionSpec.linkRequirements = normalizeStringArray(
          parsedJson.reviewCards.missionSpec.linkRequirements
        );
        parsedJson.reviewCards.missionSpec.requirements = normalizeStringArray(
          parsedJson.reviewCards.missionSpec.requirements
        );
      }
      if (parsedJson.reviewCards?.productAppeal) {
        parsedJson.reviewCards.productAppeal.coreBenefits = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.coreBenefits
        );
        parsedJson.reviewCards.productAppeal.comparisonPoints = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.comparisonPoints
        );
        parsedJson.reviewCards.productAppeal.recommendedUseCases = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.recommendedUseCases
        );
        parsedJson.reviewCards.productAppeal.targetAudience = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.targetAudience
        );
        parsedJson.reviewCards.productAppeal.painPoints = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.painPoints
        );
        parsedJson.reviewCards.productAppeal.keyIngredientsOrSpecs = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.keyIngredientsOrSpecs
        );
        parsedJson.reviewCards.productAppeal.usageTips = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.usageTips
        );
        parsedJson.reviewCards.productAppeal.beforeAfterPoints = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.beforeAfterPoints
        );
        parsedJson.reviewCards.productAppeal.trustSignals = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.trustSignals
        );
        parsedJson.reviewCards.productAppeal.faqIdeas = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.faqIdeas
        );
        parsedJson.reviewCards.productAppeal.narrativeHooks = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.narrativeHooks
        );
        parsedJson.reviewCards.productAppeal.recommendedStructure = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.recommendedStructure
        );
        parsedJson.reviewCards.productAppeal.callToAction = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.callToAction
        );
        parsedJson.reviewCards.productAppeal.bannedOrCautionInCopy = normalizeStringArray(
          parsedJson.reviewCards.productAppeal.bannedOrCautionInCopy
        );
      }
      if (parsedJson.reviewCards?.riskManagement) {
        parsedJson.reviewCards.riskManagement.requiredNotices = normalizeStringArray(
          parsedJson.reviewCards.riskManagement.requiredNotices
        );
        parsedJson.reviewCards.riskManagement.bannedPhrases = normalizeStringArray(
          parsedJson.reviewCards.riskManagement.bannedPhrases
        );
        parsedJson.reviewCards.riskManagement.retentionPeriod = normalizeStringArray(
          parsedJson.reviewCards.riskManagement.retentionPeriod
        );
        parsedJson.reviewCards.riskManagement.warnings = normalizeStringArray(
          parsedJson.reviewCards.riskManagement.warnings
        );
      }
      if (parsedJson.reviewCards?.scheduleAction) {
        parsedJson.reviewCards.scheduleAction.actionItems = normalizeStringArray(
          parsedJson.reviewCards.scheduleAction.actionItems
        );
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

    if (analysis.points !== undefined) {
      analysis.points = normalizePointsValue(analysis.points);
    }
    if (analysis.rewardInfo?.points !== undefined) {
      analysis.rewardInfo.points = normalizePointsValue(analysis.rewardInfo.points);
    }

    if (analysis.reviewCards?.copyPack) {
      analysis.reviewCards.copyPack.titleKeywords = normalizeStringArray(
        analysis.reviewCards.copyPack.titleKeywords
      );
      analysis.reviewCards.copyPack.bodyKeywords = normalizeStringArray(
        analysis.reviewCards.copyPack.bodyKeywords
      );
      analysis.reviewCards.copyPack.hashtags = normalizeStringArray(
        analysis.reviewCards.copyPack.hashtags
      );
      analysis.reviewCards.copyPack.mentionTags = normalizeStringArray(
        analysis.reviewCards.copyPack.mentionTags
      );
    }
    if (analysis.reviewCards?.productAppeal) {
      analysis.reviewCards.productAppeal.coreBenefits = normalizeStringArray(
        analysis.reviewCards.productAppeal.coreBenefits
      );
      analysis.reviewCards.productAppeal.comparisonPoints = normalizeStringArray(
        analysis.reviewCards.productAppeal.comparisonPoints
      );
      analysis.reviewCards.productAppeal.recommendedUseCases = normalizeStringArray(
        analysis.reviewCards.productAppeal.recommendedUseCases
      );
      analysis.reviewCards.productAppeal.targetAudience = normalizeStringArray(
        analysis.reviewCards.productAppeal.targetAudience
      );
      analysis.reviewCards.productAppeal.painPoints = normalizeStringArray(
        analysis.reviewCards.productAppeal.painPoints
      );
      analysis.reviewCards.productAppeal.keyIngredientsOrSpecs = normalizeStringArray(
        analysis.reviewCards.productAppeal.keyIngredientsOrSpecs
      );
      analysis.reviewCards.productAppeal.usageTips = normalizeStringArray(
        analysis.reviewCards.productAppeal.usageTips
      );
      analysis.reviewCards.productAppeal.beforeAfterPoints = normalizeStringArray(
        analysis.reviewCards.productAppeal.beforeAfterPoints
      );
      analysis.reviewCards.productAppeal.trustSignals = normalizeStringArray(
        analysis.reviewCards.productAppeal.trustSignals
      );
      analysis.reviewCards.productAppeal.faqIdeas = normalizeStringArray(
        analysis.reviewCards.productAppeal.faqIdeas
      );
      analysis.reviewCards.productAppeal.narrativeHooks = normalizeStringArray(
        analysis.reviewCards.productAppeal.narrativeHooks
      );
      analysis.reviewCards.productAppeal.recommendedStructure = normalizeStringArray(
        analysis.reviewCards.productAppeal.recommendedStructure
      );
      analysis.reviewCards.productAppeal.callToAction = normalizeStringArray(
        analysis.reviewCards.productAppeal.callToAction
      );
      analysis.reviewCards.productAppeal.bannedOrCautionInCopy = normalizeStringArray(
        analysis.reviewCards.productAppeal.bannedOrCautionInCopy
      );
    }

    // 포인트 후처리: 모델이 points를 누락한 경우 원문에서 보상 금액을 추출해 보정
    const extractedPoints = extractPointsFromGuideline(guideline);
    const hasTopLevelPoints = typeof analysis.points === 'number' && Number.isFinite(analysis.points);
    const hasRewardPoints = typeof analysis.rewardInfo?.points === 'number'
      && Number.isFinite(analysis.rewardInfo?.points);

    if (!hasTopLevelPoints && extractedPoints !== null) {
      analysis.points = extractedPoints;
    }

    if (!hasRewardPoints && extractedPoints !== null) {
      analysis.rewardInfo = {
        ...(analysis.rewardInfo ?? {}),
        points: extractedPoints,
      };
    }

    // 플랫폼 후처리: 모델 결과가 비어있거나 사용자 옵션과 불일치하면 가이드라인 텍스트 기준으로 보정
    if (!analysis.platform?.trim()) {
      const inferredPlatform = inferPlatformFromGuideline(guideline, userPlatforms);
      if (inferredPlatform) {
        analysis.platform = inferredPlatform;
      }
    }

    const fallbackTitleKeywords = analysis.contentRequirements?.titleKeywords?.map((item) => item.name) ?? [];
    const fallbackBodyKeywords = analysis.contentRequirements?.bodyKeywords?.map((item) => item.name) ?? [];
    const fallbackRequirements = analysis.contentRequirements?.requirements
      ?.map((item) => `${item.label}${item.value !== undefined ? `: ${item.value}` : ''}`)
      ?? [];
    const fallbackRequiredNotices = normalizeStringArray(analysis.requiredNotices);
    const fallbackWarnings = normalizeStringArray(analysis.warnings);
    const fallbackActionItems = normalizeStringArray(analysis.importantNotes);

    const copyPack = analysis.reviewCards?.copyPack;
    const missionSpec = analysis.reviewCards?.missionSpec;
    const productAppeal = analysis.reviewCards?.productAppeal;
    const riskManagement = analysis.reviewCards?.riskManagement;
    const scheduleAction = analysis.reviewCards?.scheduleAction;
    const fallbackCoreBenefits = normalizeStringArray([
      analysis.rewardInfo?.productInfo ?? '',
      analysis.rewardInfo?.description ?? '',
    ]);
    const fallbackNarrativeHooks = normalizeStringArray([
      analysis.title ?? '',
      ...(analysis.missions?.map((mission) => mission.title || '') ?? []),
    ]);

    analysis.reviewCards = {
      ...(analysis.reviewCards ?? {}),
      scheduleAction: {
        ...(scheduleAction ?? {}),
        address: scheduleAction?.address ?? analysis.visitInfo ?? undefined,
        actionItems: (scheduleAction?.actionItems && scheduleAction.actionItems.length > 0)
          ? scheduleAction.actionItems
          : fallbackActionItems,
      },
      missionSpec: {
        ...(missionSpec ?? {}),
        requirements: (missionSpec?.requirements && missionSpec.requirements.length > 0)
          ? missionSpec.requirements
          : fallbackRequirements,
      },
      copyPack: {
        ...(copyPack ?? {}),
        titleKeywords: (copyPack?.titleKeywords && copyPack.titleKeywords.length > 0)
          ? copyPack.titleKeywords
          : fallbackTitleKeywords,
        bodyKeywords: (copyPack?.bodyKeywords && copyPack.bodyKeywords.length > 0)
          ? copyPack.bodyKeywords
          : fallbackBodyKeywords,
      },
      productAppeal: {
        ...(productAppeal ?? {}),
        coreBenefits: (productAppeal?.coreBenefits && productAppeal.coreBenefits.length > 0)
          ? productAppeal.coreBenefits
          : fallbackCoreBenefits,
        narrativeHooks: (productAppeal?.narrativeHooks && productAppeal.narrativeHooks.length > 0)
          ? productAppeal.narrativeHooks
          : fallbackNarrativeHooks,
      },
      riskManagement: {
        ...(riskManagement ?? {}),
        requiredNotices: (riskManagement?.requiredNotices && riskManagement.requiredNotices.length > 0)
          ? riskManagement.requiredNotices
          : fallbackRequiredNotices,
        warnings: (riskManagement?.warnings && riskManagement.warnings.length > 0)
          ? riskManagement.warnings
          : fallbackWarnings,
      },
    };

    return NextResponse.json({
      success: true,
      data: analysis,
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
