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
      .select(
        'phone_number, pending_phone_number, phone_verification_code, phone_verification_expires_at'
      )
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

    // 대기 중이던 새 번호(pending)를 가져옵니다.
    // 만약 pending 번호가 없다면 예외처리 (보통 send-code를 거쳤다면 있어야 함)
    const newPhoneNumber = profile.pending_phone_number;

    if (!newPhoneNumber) {
      return NextResponse.json({ error: '인증할 대기 번호가 없습니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 진짜 phone_number를 업데이트하고, 임시 데이터들은 비웁니다.
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({
        phone_number: newPhoneNumber, // 여기서 비로소 교체!
        phone_verified_at: now,
        pending_phone_number: null, // 임시 번호 초기화
        phone_verification_code: null, // 인증 코드 초기화
        phone_verification_expires_at: null, // 만료 시간 초기화
      })
      .eq('id', userData.user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 프론트엔드에 '새로운 번호'를 반환해줍니다.
    return NextResponse.json({ success: true, phoneNumber: newPhoneNumber });
  } catch (error) {
    console.error('휴대폰 인증 확인 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '인증 확인에 실패했습니다.' },
      { status: 500 }
    );
  }
}
