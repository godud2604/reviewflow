import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const apiKey = process.env.GEMINI_API_KEY;
const client = new GoogleGenerativeAI(apiKey || '');

const RequestSchema = z.object({
  analysis: z.any(),
  options: z.object({
    targetLength: z.union([
      z.literal(500),
      z.literal(1000),
      z.literal(1500),
      z.literal(2000),
      z.literal(3000),
    ]),
    tone: z.enum(['auto', 'haeyo', 'hamnida', 'banmal']),
    persona: z.enum(['balanced', 'friendly', 'expert', 'honest', 'lifestyle']),
    emphasis: z.string().max(300).optional(),
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
      return NextResponse.json(
        { error: '요청 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { analysis, options } = parsed.data;
    const emphasis = options.emphasis?.trim() ?? '';

    const prompt = `당신은 한국어 네이버 블로그 체험단 리뷰 초안을 작성하는 전문 작가입니다.

아래 입력된 "캠페인 분석 JSON"만 근거로 블로그 초안을 작성하세요.
- 과장/허위/추측 금지
- 사실 근거가 없는 내용은 절대 추가하지 말 것
- 필수 키워드/태그/주의사항/고지문이 있으면 자연스럽게 반영할 것
- 가독성 좋은 문단 구성 (도입-경험-핵심포인트-마무리)
- 최종 출력은 "본문 초안 텍스트"만 반환 (마크다운 코드블록/설명문 금지)

[작성 설정]
- 목표 글자수: 약 ${options.targetLength}자
- 말투: ${TONE_GUIDE[options.tone]}
- 페르소나: ${PERSONA_GUIDE[options.persona]}
- 강조 요청: ${emphasis ? emphasis : '없음'}

[캠페인 분석 JSON]
${JSON.stringify(analysis, null, 2)}
`;

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const text = response.response.text().trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    if (!text) {
      return NextResponse.json(
        { error: '초안 생성 결과가 비어 있습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        draft: text,
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
