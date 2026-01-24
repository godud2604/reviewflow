import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function MissionCtaBanner() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showCta, setShowCta] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. 로그인 상태가 아니거나 로딩 중이면 처리 중단
    if (authLoading || !isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const checkCtaEligibility = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();

        // 2. DB에서 사용자의 마지막 출석일 조회
        const { data, error } = await supabase
          .from('user_profiles')
          .select('launch_event_daily_claimed_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // [핵심 수정] UTC(toISOString)가 아닌 '한국 로컬 시간' 구하기
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // 0부터 시작하므로 +1
        const day = String(now.getDate()).padStart(2, '0');

        // 오늘 날짜 문자열 생성 (예: "2026-01-25")
        const today = `${year}-${month}-${day}`;

        // DB에 저장된 값 (예: "2026-01-25" 또는 "2026-01-25 09:00:00")
        const dbDate = data?.launch_event_daily_claimed_at;

        // 3. 비교 로직
        // DB값이 없거나(null), DB값의 앞 10자리가 오늘 날짜와 다르면 배너 노출
        if (!dbDate || !dbDate.startsWith(today)) {
          if (isMounted) setShowCta(true);
        } else {
          if (isMounted) setShowCta(false);
        }
      } catch (error) {
        console.error('CTA Banner Error:', error);
        // 에러 발생 시 안전하게 배너 숨김 처리 (또는 필요에 따라 보여줌)
        if (isMounted) setShowCta(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkCtaEligibility();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, user]);

  // 로딩 중이거나, 배너를 보여줄 필요가 없으면 렌더링 안 함
  if (authLoading || isLoading || !showCta) return null;

  return (
    <div
      className="w-full z-[31] flex items-center justify-between px-4 py-3 sticky"
      style={{
        // 상단 헤더 높이만큼 띄워서 고정 (Header 높이가 56px이라고 가정)
        top: 56,
        background: '#FF6F0F',
        color: '#fff',
        boxShadow: '0 2px 16px rgba(255,111,15,0.10)',
      }}
    >
      {/* 문구 개선: 혜택과 간편함을 강조 */}
      <span className="text-[14px] font-semibold truncate">
        딱 1초면 끝! 출석하고 PRO 연장하세요 ⚡️
      </span>

      <Button
        className="ml-4 rounded-full bg-white text-[#FF6F0F] hover:bg-orange-50 h-8 px-4 text-xs font-bold shadow-none border border-orange-200 focus:ring-2 focus:ring-[#FF6F0F]/40"
        onClick={() => (window.location.href = '/event')}
      >
        혜택 받기 &gt;
      </Button>
    </div>
  );
}
