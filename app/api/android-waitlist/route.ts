import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendFeedbackToGoogleChat } from '@/lib/google-chat';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return NextResponse.json({ error: '유효한 이메일 주소를 입력해주세요.' }, { status: 400 });
    }

    const fallbackUserId = '7bc27f27-1dd7-4612-a734-25b797d18e39';
    if (!fallbackUserId) {
      return NextResponse.json(
        { error: 'ANDROID_WAITLIST_USER_ID 환경변수가 필요합니다.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from('feedback_messages').insert({
      user_id: fallbackUserId,
      feedback_type: 'android_waitlist',
      content: `Android 신청: ${trimmedEmail}`,
      metadata: {
        source: 'android_waitlist_banner',
        email: trimmedEmail,
      },
    });

    if (error) {
      throw error;
    }

    await sendFeedbackToGoogleChat({
      feedbackType: 'android_waitlist',
      content: `Android 신청: ${trimmedEmail}`,
      author: trimmedEmail,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving android waitlist:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '등록 중 오류가 발생했습니다. 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}
