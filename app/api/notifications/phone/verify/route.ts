import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseClient } from '@/lib/supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const normalizeVerificationCode = (value: string) => value.replace(/[^0-9]/g, '');

const hashVerificationCode = (code: string) => {
  const salt = process.env.PHONE_VERIFICATION_SALT;
  if (!salt) {
    throw new Error('PHONE_VERIFICATION_SALT is required.');
  }
  return createHash('sha256').update(`${code}:${salt}`).digest('hex');
};

const isExpired = (value?: string | null) => {
  if (!value) return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() < Date.now();
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim();
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const rawCode = typeof payload.code === 'string' ? payload.code : '';
  const cleanedCode = normalizeVerificationCode(rawCode);

  if (cleanedCode.length !== 6) {
    return NextResponse.json({ error: '인증번호 6자리를 입력해주세요.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(tokenMatch[1]);

    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: '세션 정보를 확인할 수 없습니다.' }, { status: 401 });
    }

    const adminClient = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('phone_number, phone_verification_code, phone_verification_expires_at')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile?.phone_verification_code || isExpired(profile.phone_verification_expires_at)) {
      return NextResponse.json({ error: '인증번호가 만료되었습니다.' }, { status: 400 });
    }

    const hashedCode = hashVerificationCode(cleanedCode);
    if (hashedCode !== profile.phone_verification_code) {
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        phone_verified_at: now,
        phone_verification_code: null,
        phone_verification_expires_at: null,
      })
      .eq('id', userData.user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, phoneNumber: profile.phone_number });
  } catch (error) {
    console.error('휴대폰 인증 확인 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '인증 확인에 실패했습니다.' },
      { status: 500 }
    );
  }
}
