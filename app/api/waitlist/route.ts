import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      )
    }

    // Supabase에 이메일 저장
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('waitlist')
      .insert([
        {
          email,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      // 중복 이메일 처리
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '이미 등록된 이메일입니다.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json(
      { message: '등록되었습니다! 출시 소식을 가장 먼저 보내드릴게요.', data },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error saving email:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '등록 중 오류가 발생했습니다. 다시 시도해주세요.',
      },
      { status: 500 }
    )
  }
}
