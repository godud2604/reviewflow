'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LaunchEventBanner() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimed, setIsClaimed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchClaimStatus = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select('launch_event_claimed_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (!isMounted) return;
        setIsClaimed(Boolean(data?.launch_event_claimed_at));
      } catch {
        if (!isMounted) return;
        setIsClaimed(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchClaimStatus();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, user]);

  if (authLoading || isLoading || !isAuthenticated || !user) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        'mx-4 mt-4 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-pink-50 px-4 py-3 shadow-sm',
        isClaimed && 'opacity-80'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-orange-500 shadow">
            <Gift className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">앱 출시 기념 프로 10일권</p>
            <p className="text-xs text-neutral-500">
              {isClaimed ? '이미 수령했어요. 미션으로 추가 혜택을 받으세요!' : '지금 이벤트 페이지에서 바로 받아보세요.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => router.push('/event')}
          >
            {isClaimed ? '미션 보러가기' : '10일권 받으러가기'}
          </Button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-xs text-neutral-400 hover:text-neutral-600"
            aria-label="이벤트 배너 닫기"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
