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

// Zod 스키마 정의
const DeadlineSchema = z.object({
  label: z.string(),
  date: z.string(),
  description: z.string(),
});

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
});

const CampaignGuidelineAnalysisSchema = z.object({
  title: z.string(),
  points: z.number().nullable().optional(),
  platform: z.string().optional(),
  category: z.string().optional(),
  reviewChannel: z.string().optional(),
  visitInfo: z.string().optional(),
  phone: z.string().optional(),
  recruitPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  reviewerAnnouncement: z.string().optional(),
  reviewRegistrationPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  deadlines: z.array(DeadlineSchema).optional(),
  rewardInfo: z.object({
    description: z.string().optional(),
    points: z.number().optional(),
    deliveryMethod: z.string().optional(),
    productInfo: z.string().optional(),
  }).optional(),
  contentRequirements: ContentRequirementsSchema.optional(),
  requiredNotices: z.array(z.string()).optional(),
  missions: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    examples: z.array(z.string()).optional(),
  })).optional(),
  importantNotes: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
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

const GUIDELINE_ANALYSIS_PROMPT = `당신은 체험단 캠페인 가이드라인 분석 전문가입니다.

## 분석 과정 (Chain-of-Thought):

1. **문맥 파악**: 가이드라인 텍스트를 읽으며 어떤 플랫폼/사이트의 체험단인지, 어떤 구조인지 파악하세요.
2. **카테고리 식별**: 제품/서비스 카테고리를 다음 중에서만 선택하세요:
   - 맛집/식품, 뷰티, 생활/리빙, 출산/육아, 주방/가전, 반려동물, 여행/레저, 데이트, 웨딩, 티켓/문화생활, 디지털/전자기기, 건강/헬스, 자동차/모빌리티, 문구/오피스, 기타
3. **플랫폼 및 리뷰채널 추출**:
   - **플랫폼**: 가이드라인에서 명시된 플랫폼 (예: "네이버 블로그", "인스타그램", "유튜브", "쿠팡")
   - **리뷰채널**: 리뷰를 작성해야 하는 채널 (예: "블로그", "인스타그램", "쿠팡")
4. **장소 정보 추출**: 
   - **방문정보**: 주소, 위치, 매장명 등 방문해야 할 장소
   - **전화번호**: 매장 전화, 고객센터 전화 등
5. **날짜 필드 식별**: 문맥에 맞게 다음과 같은 날짜들을 찾으세요:
   - 모집 마감일: "모집 마감", "신청 마감", "모집 기간 종료" 등
   - 선정자 발표일: "선정자 발표", "당선자 발표", "선정 공지" 등
   - 리뷰 제출 기한: "리뷰 제출", "리뷰 작성 마감", "포스팅 기한" 등
   - 기타 일정: "배송 예상일", "제품 회수일" 등
6. **의미 해석**: 각 날짜가 정확히 무엇을 의미하는지 파악하고, 실제 의미 있는 라벨을 생성하세요.
7. **상대적 표현 계산**: "선정일 기준 +10일", "배송 후 7일" 같은 표현을 계산하여 구체적인 날짜로 변환하세요.
8. **JSON 생성**: 추출한 정보를 구조화된 JSON으로 반환하세요.

## contentRequirements 필드 - titleKeywords와 bodyKeywords 형식:

**매우 중요**: titleKeywords와 bodyKeywords는 항상 다음 형식이어야 합니다:
\`\`\`
[
  {
    "name": "키워드1",
    "description": "설명1"
  },
  {
    "name": "키워드2", 
    "description": "설명2"
  }
]
\`\`\`

**틀린 형식 (절대 사용하면 안 됨)**:
- ❌ \`[{"name":"#라운지엑스","#라운지엑스24h"}]\` - 두 번째 필드가 설명이 아님
- ❌ \`["keyword1", "keyword2"]\` - 문자열 배열
- ❌ \`[{"#라운지엑스": "설명"}]\` - 키 이름이 이상함

**올바른 형식 (필수)**:
- ✅ \`[{"name":"#라운지엑스","description":""},{"name":"#라운지엑스24h","description":""}]\`

각 키워드/본문 요구사항은 반드시 객체여야 하며, "name"과 "description" 필드를 가져야 합니다.

## 주의사항:
- 모든 날짜를 현재 기준(2026-02-09)으로 YYYY-MM-DD 형식으로 변환하세요
- **카테고리**: 반드시 위의 목록 중 하나를 선택하세요. 없으면 "기타"로 설정하세요.
- **플랫폼/리뷰채널**: 가이드라인에 명시된 플랫폼/채널을 그대로 추출하세요.
- **방문정보**: 매장명, 주소, 위치 등 방문해야 할 장소 정보 추출
- **전화번호**: 숫자와 하이픈만 포함 (예: "02-1234-5678", "010-1234-5678")
- **포인트 필드**: "P", "포인트", "체험권" 등의 가치를 찾으세요. 숫자만 추출 (예: "15,000P" → 15000)
- 포인트/가격을 찾을 수 없으면 null로 설정하세요
- deadlines 배열의 "label"은 원문의 실제 표현을 반영하세요
- 상대적 표현은 반드시 구체적인 날짜로 계산하세요
- 숫자는 정수로 변환하세요
- 빈 배열이나 null 값을 사용하지 말고, 실제 있는 데이터만 포함하세요
- **titleKeywords/bodyKeywords는 항상 올바른 형식으로 생성하세요** - 이것은 필수 요구사항입니다
- 반드시 유효한 JSON 객체만 반환하세요

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
    const userPlatforms = userProfile?.platforms || [];
    const userCategories = userProfile?.categories || [];
    const userReviewChannels = userProfile?.schedule_channels || [];

    // 프롬프트 동적 생성 (사용자 옵션 포함)
    const dynamicPrompt = `${GUIDELINE_ANALYSIS_PROMPT}

## 사용자 정의 옵션 (이 목록에서만 선택하세요):
- **플랫폼**: ${userPlatforms.length > 0 ? userPlatforms.join(', ') : '없음'}
- **카테고리**: ${userCategories.length > 0 ? userCategories.join(', ') : '없음'}
- **리뷰채널**: ${userReviewChannels.length > 0 ? userReviewChannels.join(', ') : '없음'}

반드시 위의 사용자 정의 옵션에서만 값을 선택하세요. 없으면 빈 문자열로 설정하세요.`;

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
