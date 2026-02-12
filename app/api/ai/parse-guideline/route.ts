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

const SafeStringArraySchema = z
  .preprocess((value) => (value === null ? [] : value), z.array(z.string()).optional())
  .transform((value) => value ?? []);

const SafeKeywordArraySchema = z
  .preprocess(
    (value) => (value === null ? [] : value),
    z.array(
      z.object({
        name: z.string(),
        description: z.string(),
      })
    ).optional()
  )
  .transform((value) => value ?? []);

const SafeRequirementArraySchema = z
  .preprocess(
    (value) => (value === null ? [] : value),
    z.array(
      z.object({
        type: z.string(),
        label: z.string(),
        value: z.number(),
        description: z.string(),
      })
    ).optional()
  )
  .transform((value) => value ?? []);

const SafeVisitReviewTypesSchema = z
  .preprocess(
    (value) => (value === null ? [] : value),
    z.array(z.enum(['naverReservation', 'googleReview', 'other'])).optional()
  )
  .transform((value) => value ?? []);

const ContentRequirementsSchema = z.object({
  titleKeywords: SafeKeywordArraySchema,
  bodyKeywords: SafeKeywordArraySchema,
  requirements: SafeRequirementArraySchema,
  // 방문형 리뷰 필수 항목 (네이버예약, 구글리뷰, 기타)
  visitReviewTypes: SafeVisitReviewTypesSchema,
});

const ReviewCardsSchema = z.object({
  scheduleAction: z.record(z.any()).optional(), // 일정/예약/액션 - 자유로운 필드 구조
  missionSpec: z.record(z.any()).optional(), // 콘텐츠 미션 - 자유로운 필드 구조
  copyPack: z.record(z.any()).optional(), // 키워드/태그 - 자유로운 필드 구조
  productAppeal: z.record(z.any()).optional(), // 제품 소구점 - 자유로운 필드 구조
  riskManagement: z.record(z.any()).optional(), // 주의사항 - 자유로운 필드 구조
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
  requiredNotices: SafeStringArraySchema,
  missions: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    examples: z.array(z.string()).optional(),
  })).optional(),
  importantNotes: SafeStringArraySchema,
  warnings: SafeStringArraySchema,
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

function dedupeStringArray(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildKeywordClues(
  items: Array<{ name: string; description: string }> | undefined,
  scope: 'title' | 'body'
): string[] {
  if (!items || items.length === 0) return [];

  const clues = items
    .map((item) => {
      const keyword = item.name?.trim();
      const description = item.description?.trim();
      if (!keyword) return '';
      if (description) {
        return scope === 'title'
          ? `제목에 "${keyword}"를 넣고, ${description}`
          : `본문에 "${keyword}"를 자연스럽게 포함하고, ${description}`;
      }
      return scope === 'title'
        ? `제목에 "${keyword}"를 핵심 메시지와 연결해 포함`
        : `본문에서 "${keyword}"를 경험/근거와 함께 언급`;
    })
    .filter((value) => value.length > 0);

  return dedupeStringArray(clues);
}

function buildRequirementClues(
  requirements:
    | Array<{ type: string; label: string; value: number; description: string }>
    | undefined
): string[] {
  if (!requirements || requirements.length === 0) return [];

  const clues = requirements
    .map((item) => {
      const label = item.label?.trim();
      const description = item.description?.trim();
      const value = Number.isFinite(item.value) ? `최소 ${item.value}` : '';

      const segments = [label, value, description].filter((segment) => segment.length > 0);
      if (segments.length === 0) return '';
      return `콘텐츠 미션 단서: ${segments.join(' / ')}`;
    })
    .filter((value) => value.length > 0);

  return dedupeStringArray(clues);
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
아래 가이드라인 텍스트를 분석하여 필수 매핑 필드를 추출하고, 나머지 정보는 5개 카드에 유연하게 배치하세요.

### 출력 규칙 (최우선)
1. 반드시 유효한 JSON 객체만 반환하세요. 코드블록, 설명문, 마크다운 금지.
2. 날짜는 현재 기준 2026-02-10에 맞춰 YYYY-MM-DD로 정규화하세요.
3. 숫자 필드는 정수로 반환하세요.
4. 카테고리는 아래 허용 목록에서만 선택하세요. 없으면 "기타".
   - 맛집/식품, 뷰티, 생활/리빙, 출산/육아, 주방/가전, 반려동물, 여행/레저, 데이트, 웨딩, 티켓/문화생활, 디지털/전자기기, 건강/헬스, 자동차/모빌리티, 문구/오피스, 기타

### 필수 매핑 필드 (반드시 추출)
1. **title** (제목): 캠페인/체험단 제목 추출
2. **points** (제품/서비스가격): 포인트, 리워드, 체험권 금액
   - 예: "15,000P" -> 15000
   - 예: "1만" -> 10000, "1만5천" -> 15000, "2.5만" -> 25000
   - 범위는 최대값: "1~2만" -> 20000, "5,000-10,000P" -> 10000
3. **reviewRegistrationPeriod.end** (마감일): 리뷰 제출 마감일 (YYYY-MM-DD)
4. **platform** (플랫폼): 캠페인 플랫폼명
5. **category** (카테고리): 위 허용 목록에서 선택
6. **reviewChannel** (리뷰채널): 리뷰 작성 채널명
7. **방문형일 경우**:
   - **visitInfo** (주소/위치): 방문 장소 주소 또는 위치 정보
   - **phone** (전화번호): 예약/문의 전화번호
   - **contentRequirements.visitReviewTypes**: 방문 후 추가 리뷰 플랫폼
     - "네이버 예약, 영수증 예약" 언급 시 -> ["naverReservation"]
     - "구글 리뷰" 언급 시 -> ["googleReview"]
     - "카카오맵" 등 기타 플랫폼 언급 시 -> ["other"]
     - 복수 가능, 근거 없으면 생략

### 유연 배치 필드 (5개 카드에 자유롭게 배치)
나머지 모든 정보는 아래 5개 카드(reviewCards)의 필드에 자유롭게 배치하세요.
필드명 규격화 불필요, 정보가 있으면 적절한 카드에 배치:

1. **scheduleAction** (일정/예약/액션)
   - "실행 가능한 운영 체크리스트"가 되도록 풍부하게 채우세요.
   - 단순 날짜 1개보다, 예약/방문/배송/수령/검수/업로드 타임라인을 분리해 추출하세요.
   - 원문 근거가 있으면 아래 항목을 적극 추출:
    - 예약 경로/방법/필수 입력값/확인 절차
    - 방문 가능 요일/시간대/소요시간/인원 제한
    - 배송 시작일/수령 방식/추가 결제 여부/비용 관련 조건
    - 제출/업로드 마감 및 중간 체크포인트
    - 미이행 시 불이익/재안내 필요 액션
   - 카드는 가능한 한 "누가 봐도 다음 행동을 바로 알 수 있는 문장"으로 채우세요.
   
2. **missionSpec** (콘텐츠 미션)
   - "콘텐츠 제작 명세서"가 되도록 풍부하게 채우세요.
   - 원문 근거가 있으면 아래 항목을 적극 추출:
    - 글자수/사진수/영상 여부/컷 구성/파일 형식
    - 필수 포함 요소(제품명, 핵심 문구, 사용 장면, before/after 등)
    - 필수 링크/삽입 위치/앵커 텍스트/태그 위치
    - 문단 구조 가이드(도입-경험-비교-결론 등)
    - 필수 검수 항목(오탈자, 해상도, 노출 조건, 공개 설정 등)
   - "요구사항(requirements)"은 type/label/value/description을 유지해 가능한 한 채우세요.
   
3. **copyPack** (키워드/태그)
   - "복붙 가능한 카피 재료 묶음"이 되도록 풍부하게 채우세요.
   - 원문 근거가 있으면 아래 항목을 적극 추출:
    - 제목 키워드 후보 + 사용 지시(몇 개 선택/필수 위치)
    - 본문 키워드 후보 + 반복/자연삽입 규칙
    - 멘션 태그, 계정 태그, 금지 태그
    - 필수 고지 문구/권장 CTA 문구/금지 표현 대체 문구
   - 키워드는 가능한 한 배열로 분리하고, 값이 비어 있으면 해당 필드는 생략하세요.
   
4. **productAppeal** (제품/서비스 소구점)
   - "블로그 글 작성에 바로 쓰는 재료"를 최대한 풍부하게 채우세요.
   - 단순 나열보다 "문장으로 확장 가능한 단서"를 우선 추출하세요.
   - 원문 근거가 약한 경우 과장/추측 생성 금지, 근거 있는 범위만 채우세요.
   - 제품 상세페이지/가이드 문맥에서 아래를 적극 추출:
    - 어떤 사람에게 맞는지, 어떤 고민 해결인지
    - 성분/스펙/수치, 사용 팁
    - 비교 우위, 신뢰 근거
    - 글 도입 훅, 본문 구성안, CTA 아이디어 등
   
5. **riskManagement** (주의사항)
   - "게시 전 리스크 점검표"가 되도록 풍부하게 채우세요.
   - 원문 근거가 있으면 아래 항목을 적극 추출:
    - 금지 문구/과장 표현/의학적 단정/비교 광고 리스크
    - 필수 고지(공정위 문구, 협찬 표기, 위치, 형식)
    - 수정 요청/재업로드/삭제 조건
    - 유지 기간/비공개 금지 기간/캡처 보관 의무
    - 미준수 패널티(포인트 회수, 선정 제외 등)
   - "정보 없음" 같은 플레이스홀더 텍스트는 넣지 말고, 근거 없는 항목은 생략하세요.

### 추출 원칙
- 필수 매핑 필드는 반드시 정확하게 추출하세요.
- 나머지 정보는 5개 카드 중 가장 적합한 곳에 배치하되, 필드명은 자유롭게 설정 가능합니다.
- 근거 없는 추측 금지, 원문에 있는 정보만 추출하세요.
- 빈 배열/빈 객체는 생략하세요.
- 5개 카드 모두, 근거가 충분하면 단일 필드만 채우지 말고 다면적으로 확장해 채우세요.

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
      // reviewCards는 이제 자유로운 구조이므로 특정 필드 정규화 제거

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
    if (analysis.rewardInfo?.points !== undefined) {
      analysis.rewardInfo.points = normalizePointsValue(analysis.rewardInfo.points);
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
