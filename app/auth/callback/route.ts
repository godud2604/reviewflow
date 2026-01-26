import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    const user = data?.user;
    if (!error && user?.created_at) {
      const createdAtMs = Date.parse(user.created_at);
      const lastSignInAtMs = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : null;

      const isLikelyNewUser =
        Number.isFinite(createdAtMs) &&
        createdAtMs > 0 &&
        Date.now() - createdAtMs < 10 * 60 * 1000 &&
        lastSignInAtMs !== null &&
        Math.abs(lastSignInAtMs - createdAtMs) < 2 * 60 * 1000;

      if (isLikelyNewUser) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);

        try {
          await fetch(new URL('/api/hooks/signup', requestUrl.origin), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              provider:
                typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
            }),
            signal: controller.signal,
          });
        } catch (err) {
          console.error('OAuth callback: failed to trigger signup hook:', err);
        } finally {
          clearTimeout(timer);
        }
      }
    }
  }

  // 로그인 완료 후 홈으로 리다이렉트
  return NextResponse.redirect(new URL('/?page=home', requestUrl.origin));
}
