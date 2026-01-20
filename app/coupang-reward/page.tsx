'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PartyPopper } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';

const COUPANG_REWARD_URL = 'https://www.coupang.com';

const getKstDateString = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

const getDaysUntil = (expiresAt: string) => {
  const todayStr = getKstDateString();
  const expiresStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(
    new Date(expiresAt)
  );
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [ey, em, ed] = expiresStr.split('-').map(Number);
  if ([ty, tm, td, ey, em, ed].some((value) => Number.isNaN(value))) return null;
  const today = new Date(ty, tm - 1, td);
  const expires = new Date(ey, em - 1, ed);
  const diffDays = Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getKstParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const addDaysToExpiry = (expiresAt: string | null, days: number) => {
  const now = new Date();
  const current = expiresAt ? new Date(expiresAt) : null;
  const base =
    current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
};

const formatKstExpiryLabel = (expiresAt: string) => {
  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) return null;

  const parts = getKstParts(expiresDate);
  let year = Number(parts.year);
  let month = Number(parts.month);
  let day = Number(parts.day);
  let hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    return null;
  }

  if (minute > 0 || second > 0) {
    hour += 1;
  }

  if (hour >= 24) {
    hour = hour % 24;
    day += 1;
    const daysInMonth = getDaysInMonth(year, month);
    if (day > daysInMonth) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  const period = hour >= 12 ? '오후' : '오전';
  const hourLabel = hour % 12 === 0 ? 12 : hour % 12;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}. ${pad(month)}. ${pad(day)}. ${period} ${pad(hourLabel)}:00`;
};

const confettiPalette = ['#ff6a1f', '#22c55e', '#38bdf8', '#facc15', '#fb7185'];

const confettiPieces = Array.from({ length: 18 }, (_, index) => {
  const hue = confettiPalette[index % confettiPalette.length];
  const angle = (index / 18) * Math.PI * 2;
  const radius = 90 + (index % 5) * 18;
  const x = Math.round(Math.cos(angle) * radius);
  const y = Math.round(Math.sin(angle) * radius * 0.9) - 60;
  return {
    color: hue,
    size: 6 + (index % 4) * 2,
    x,
    y,
    delay: `${index * 0.03}s`,
  };
});

export default function CoupangRewardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [lastRewardDate, setLastRewardDate] = useState<string | null>(null);
  const [tierExpiresAt, setTierExpiresAt] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const todayKst = useMemo(() => getKstDateString(), []);

  const hasClickedToday = lastRewardDate === todayKst;
  const remainingDays = useMemo(() => {
    if (!tierExpiresAt) return null;
    return getDaysUntil(tierExpiresAt);
  }, [tierExpiresAt]);
  const expiryLabel = useMemo(() => {
    if (!tierExpiresAt) return null;
    return formatKstExpiryLabel(tierExpiresAt);
  }, [tierExpiresAt]);
  const proRemainingLabel = useMemo(() => {
    if (!profileTier) return '로그인 후 확인할 수 있어요.';
    if (profileTier.toUpperCase() !== 'PRO') return '현재 FREE 이용 중이에요.';
    if (!expiryLabel || remainingDays === null) return 'Pro 기간 정보를 불러오는 중이에요.';
    if (remainingDays <= 0) return 'Pro 혜택이 종료되었어요.';
    return `${expiryLabel} 까지 이용 가능해요.`;
  }, [profileTier, remainingDays, expiryLabel]);

  const triggerCelebration = useCallback(() => {
    setShowCelebration(true);
    window.setTimeout(() => setShowCelebration(false), 1400);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchRewardStatus = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('coupang_reward_last_date, tier, tier_expires_at')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error('쿠팡 리워드 상태 로딩 실패:', error);
        setIsLoading(false);
        return;
      }

      setLastRewardDate(data?.coupang_reward_last_date ?? null);
      setTierExpiresAt(data?.tier_expires_at ?? null);
      setProfileTier(data?.tier ?? null);
      setIsLoading(false);
    };

    fetchRewardStatus();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPending = () => {
      const pending = localStorage.getItem('coupangRewardPending');
      if (!pending || pending !== todayKst) return;
      localStorage.removeItem('coupangRewardPending');
      triggerCelebration();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        checkPending();
      }
    };

    checkPending();
    window.addEventListener('focus', checkPending);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', checkPending);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [todayKst, triggerCelebration]);

  const handleVisitCoupang = async () => {
    if (!user?.id) {
      router.push('/signin');
      return;
    }

    if (hasClickedToday || isSaving) return;

    setIsSaving(true);
    const nextExpiryAt = addDaysToExpiry(tierExpiresAt, 1);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({
        coupang_reward_last_date: todayKst,
        tier_expires_at: nextExpiryAt,
        tier: 'pro',
      })
      .eq('id', user.id);

    if (error) {
      console.error('쿠팡 리워드 저장 실패:', error);
      toast({
        title: '저장에 실패했어요',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
        duration: 1200,
      });
      setIsSaving(false);
      return;
    }

    setLastRewardDate(todayKst);
    setTierExpiresAt(nextExpiryAt);
    setProfileTier('pro');
    localStorage.setItem('coupangRewardPending', todayKst);
    setIsSaving(false);

    window.open(COUPANG_REWARD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-neutral-50/60 text-neutral-900 font-sans tracking-tight px-2">
      <style jsx global>{`
        @keyframes reward-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.02);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.96);
          }
        }

        @keyframes confetti-burst {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--confetti-x), var(--confetti-y), 0) rotate(220deg);
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="뒤로가기"
            onClick={() => router.push('/?page=home')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[12px] font-semibold text-orange-600">쿠팡 방문 미션</p>
            <h1 className="text-[20px] font-extrabold">pro 1일권 받으러가기</h1>
          </div>
        </div>

        <div className="rounded-[28px] border border-orange-100 bg-white px-6 py-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[22px]">
              🎁
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-neutral-900">쿠팡 방문으로 보너스 받기</h2>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-[13px] font-medium text-orange-700">
            하루에 1번만 참여할 수 있어요. 오늘 미션을 완료하면 내일 또 받을 수 있어요.
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-[12px] font-semibold text-neutral-500">내 Pro 남은 기간</p>
            <p className="mt-1 text-[13px] font-bold text-neutral-900">
              {isLoading ? '불러오는 중...' : proRemainingLabel}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[#ff6a1f] text-[14px] font-bold text-white shadow-[0_18px_40px_rgba(255,106,31,0.35)] hover:bg-[#f25d12]"
              onClick={handleVisitCoupang}
              disabled={isLoading || hasClickedToday || isSaving}
            >
              {isLoading ? '상태 확인 중...' : '쿠팡 방문하고 pro 1일권받기'}
            </Button>
            {hasClickedToday && (
              <p className="text-center text-[12px] font-semibold text-neutral-500">
                내일 만나요! 하루에 한 번만 가능해요.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white px-6 py-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
            <PartyPopper className="h-4 w-4 text-orange-500" />
            Pro에서 제공되는 기능
          </div>
          <p className="mt-2 text-[12px] font-medium text-neutral-500">
            Pro 혜택으로 일정 관리가 훨씬 편해져요.
          </p>
          <ul className="mt-4 space-y-3 text-[13px] font-semibold text-neutral-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
              매일 일정 요약 카카오 알림
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
              지난달 통계 상세 내역 제공
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
              엑셀 다운로드 기능
            </li>
          </ul>
        </div>
      </div>

      {showCelebration && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div className="absolute inset-0 bg-white/40" />
          <div
            className="absolute left-1/2 top-1/3 text-center"
            style={{ animation: 'reward-pop 1.2s ease-out forwards' }}
          >
            <div className="text-[46px]">💥</div>
            <p className="mt-2 text-[20px] font-extrabold text-orange-700">축하! pro 1일권 지급</p>
          </div>
          {confettiPieces.map((piece, index) => (
            <span
              key={`confetti-${index}`}
              className="absolute left-1/2 top-1/3"
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: '999px',
                animation: `confetti-burst 1.1s ease-out ${piece.delay} forwards`,
                transform: 'translate3d(0, 0, 0)',
                ['--confetti-x' as string]: `${piece.x}px`,
                ['--confetti-y' as string]: `${piece.y}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
