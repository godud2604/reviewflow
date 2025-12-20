import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // ✅ 1. URL에서 'next' 파라미터를 찾아냅니다. (없으면 기본값 '/?page=home')
  const next = requestUrl.searchParams.get('next') || '/?page=home'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // ⚠️ 중요: 여기서 세션을 교환합니다.
    // (참고: Next.js SSR 환경에서는 쿠키 처리를 위해 @supabase/ssr 사용을 권장하지만,
    //  일단 기존 로직을 유지하면서 리다이렉트 문제만 수정합니다.)
    await supabase.auth.exchangeCodeForSession(code)
  }

  // ✅ 2. 하드코딩된 주소 대신, 위에서 찾은 'next' 주소로 보냅니다.
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}