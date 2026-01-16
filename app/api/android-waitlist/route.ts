import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendFeedbackToGoogleChat } from '@/lib/google-chat';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return NextResponse.json({ error: '유효한 이메일 주소를 입력해주세요.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization')?.trim();
    const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const token = tokenMatch[1];
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: '세션 정보를 확인할 수 없습니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from('feedback_messages').insert({
      user_id: userData.user.id,
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
      author: userData.user.email ?? userData.user.id,
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
