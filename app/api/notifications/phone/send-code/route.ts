import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseClient } from '@/lib/supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
const CODE_EXPIRY_MINUTES = 10;

const normalizePhoneNumber = (value: string) => value.replace(/[^0-9]/g, '');

const hashVerificationCode = (code: string) => {
  const salt = process.env.PHONE_VERIFICATION_SALT;
  if (!salt) {
    throw new Error('PHONE_VERIFICATION_SALT is required.');
  }
  return createHash('sha256').update(`${code}:${salt}`).digest('hex');
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim();
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const rawPhone = typeof payload.phone === 'string' ? payload.phone : '';
  const cleanedPhone = normalizePhoneNumber(rawPhone);

  if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
    return NextResponse.json({ error: '유효한 휴대폰 번호를 입력해주세요.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(tokenMatch[1]);

    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: '세션 정보를 확인할 수 없습니다.' }, { status: 401 });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const adminClient = getSupabaseAdminClient();

    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        pending_phone_number: cleanedPhone, // 임시 저장소에 저장
        phone_verification_code: hashedCode,
        phone_verification_expires_at: expiresAt,
      })
      .eq('id', userData.user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const edgeSecret = process.env.EDGE_FUNCTION_SECRET;

    if (!supabaseUrl || !serviceRoleKey || !edgeSecret) {
      return NextResponse.json(
        { error: 'Supabase Edge Function configuration is missing.' },
        { status: 500 }
      );
    }

    // 알림톡/SMS는 '새 번호(cleanedPhone)'로 발송 (DB 저장 여부와 무관하게 입력된 번호로 전송)
    const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/aligo-send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        'x-edge-secret': edgeSecret,
      },
      body: JSON.stringify({
        phone: cleanedPhone,
        message: `리뷰플로우 인증번호는 ${verificationCode} 입니다. (유효시간 ${CODE_EXPIRY_MINUTES}분)`,
      }),
    });

    const edgeData = await edgeResponse.json().catch(() => ({}));
    if (!edgeResponse.ok) {
      return NextResponse.json(
        { error: 'Edge function failed', details: edgeData },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      aligo: edgeData?.data ?? edgeData,
      expiresAt,
    });
  } catch (error) {
    console.error('휴대폰 인증번호 전송 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '인증번호 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
