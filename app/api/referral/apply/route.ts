import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase 환경변수 누락' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let payload: { code?: string } | null = null;
  try {
    payload = await request.json();
  } catch (error) {
    payload = null;
  }

  const code = payload?.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: '쿠폰 코드를 입력해 주세요.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return NextResponse.json({ error: '인증 정보가 유효하지 않습니다.' }, { status: 401 });
  }

  const userId = authData.user.id;

  try {
    const admin = getSupabaseAdminClient();

    const { data: me, error: meError } = await admin
      .from('user_profiles')
      .select('id, tier_expires_at, launch_event_referral_code, launch_event_referral_applied_code')
      .eq('id', userId)
      .single();

    if (meError) throw meError;

    if (me?.launch_event_referral_applied_code) {
      return NextResponse.json({ error: '이미 쿠폰을 등록했어요.' }, { status: 409 });
    }

    if (me?.launch_event_referral_code && me.launch_event_referral_code === code) {
      return NextResponse.json({ error: '내 쿠폰은 등록할 수 없어요.' }, { status: 400 });
    }

    const { data: inviter, error: inviterError } = await admin
      .from('user_profiles')
      .select('id, tier_expires_at')
      .eq('launch_event_referral_code', code)
      .maybeSingle();

    if (inviterError) throw inviterError;

    if (!inviter?.id) {
      return NextResponse.json({ error: '존재하지 않는 쿠폰 코드예요.' }, { status: 404 });
    }

    if (inviter.id === userId) {
      return NextResponse.json({ error: '내 쿠폰은 등록할 수 없어요.' }, { status: 400 });
    }

    const now = new Date();

    const meBase = parseDate(me?.tier_expires_at) ?? now;
    const inviterBase = parseDate(inviter?.tier_expires_at) ?? now;

    const meNextExpiry = addMonths(meBase > now ? meBase : now, 1);
    const inviterNextExpiry = addMonths(inviterBase > now ? inviterBase : now, 1);

    const { error: updateMeError } = await admin
      .from('user_profiles')
      .update({
        tier: 'pro',
        tier_expires_at: meNextExpiry.toISOString(),
        launch_event_referral_applied_code: code,
        launch_event_referral_applied_at: now.toISOString(),
      })
      .eq('id', userId);

    if (updateMeError) throw updateMeError;

    const { error: updateInviterError } = await admin
      .from('user_profiles')
      .update({
        tier: 'pro',
        tier_expires_at: inviterNextExpiry.toISOString(),
      })
      .eq('id', inviter.id);

    if (updateInviterError) throw updateInviterError;

    return NextResponse.json({
      success: true,
      tier_expires_at: meNextExpiry.toISOString(),
      applied_at: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '쿠폰 등록 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
