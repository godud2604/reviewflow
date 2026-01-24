import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function MissionCtaBanner() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showCta, setShowCta] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    const checkCtaEligibility = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select('launch_event_daily_claimed_at')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        const today = new Date().toISOString().slice(0, 10);
        if (!data?.launch_event_daily_claimed_at || data.launch_event_daily_claimed_at !== today) {
          setShowCta(true);
        } else {
          setShowCta(false);
        }
      } catch {
        setShowCta(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    checkCtaEligibility();
    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, user]);

  if (authLoading || isLoading || !showCta) return null;

  // 헤더 아래에 고정되는 띠배너 (sticky, top: header 높이)
  return (
    <div
      className="w-full z-[31] flex items-center justify-between px-4 py-3 sticky"
      style={{
        top: 56,
        background: '#FF6F0F',
        color: '#fff',
        boxShadow: '0 2px 16px rgba(255,111,15,0.10)',
      }}
    >
      <span className="text-[14px] font-semibold truncate">
        오늘 출석체크하고 PRO 연장하세요! 🎁
      </span>
      <Button
        className="ml-4 rounded-full bg-white text-[#FF6F0F] hover:bg-orange-50 h-9 px-5 text-xs font-bold shadow-none border border-orange-200 focus:ring-2 focus:ring-[#FF6F0F]/40"
        onClick={() => (window.location.href = '/event')}
      >
        미션 하기 &gt;
      </Button>
    </div>
  );
}
