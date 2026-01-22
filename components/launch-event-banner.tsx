'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, X } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

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

  if (isDismissed || isClaimed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-hidden="true"
        onClick={() => setIsDismissed(true)}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-event-title"
        className="relative w-full max-w-sm rounded-3xl bg-white px-6 py-7 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="absolute right-4 top-4 text-neutral-400 transition hover:text-neutral-600"
          aria-label="팝업 닫기"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-50 via-white to-orange-50 text-rose-500 shadow-sm">
          <Gift className="h-9 w-9" />
        </div>
        <h2 id="launch-event-title" className="text-lg font-semibold text-neutral-900">
          앱 출시 기념 선물이 도착했어요!
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          기본 1개월 무료 기간에 14일을 더 추가해 드릴게요.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            className="h-11 rounded-full bg-rose-500 text-white hover:bg-rose-600"
            onClick={() => router.push('/event')}
          >
            PRO 14일권 연장받기
          </Button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="mt-3 text-sm text-neutral-400 transition hover:text-neutral-600"
          >
            괜찮아요, 1개월만 쓸게요
          </button>
        </div>
      </div>
    </div>
  );
}
