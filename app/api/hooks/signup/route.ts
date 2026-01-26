import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getKstDayRangeUtc } from '@/lib/kst-day-range';
import { sendSignupStatsToGoogleChat } from '@/lib/google-chat';

const UUID_V4_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SignupHookPayload = {
  userId?: string;
  provider?: string;
};

export async function POST(request: Request) {
  let payload: SignupHookPayload | null = null;
  try {
    payload = (await request.json()) as SignupHookPayload;
  } catch {
    payload = null;
  }

  const userId = payload?.userId?.trim();
  const provider = payload?.provider?.trim();

  const supabaseAdmin = getSupabaseAdminClient();

  if (userId && UUID_V4_LIKE_RE.test(userId)) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
  }

  const { startUtc, endUtc } = getKstDayRangeUtc();

  const [{ count: totalUsers, error: totalError }, { count: todaySignups, error: todayError }] =
    await Promise.all([
      supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startUtc.toISOString())
        .lt('created_at', endUtc.toISOString()),
    ]);

  if (totalError || todayError) {
    console.error('Failed to compute signup stats:', { totalError, todayError, provider, userId });
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    await sendSignupStatsToGoogleChat({
      totalUsers: totalUsers ?? 0,
      todaySignups: todaySignups ?? 0,
    });
  } catch (err) {
    console.error('Signup hook: failed to send Google Chat message:', err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

