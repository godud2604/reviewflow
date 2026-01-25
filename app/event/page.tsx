'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Copy,
  Gift,
  Megaphone,
  Ticket,
  Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// --- Constants & Helpers ---
const EVENT_MISSION_TYPE = 'sns_review';
const CLAIM_DAYS = 14;

const formatKstDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const formatKstYearMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(date);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isAfter = (left?: string | null, right?: Date) => {
  if (!left || !right) return false;
  const parsed = new Date(left);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > right.getTime();
};

const isSameKstMonth = (value?: string | null, now?: Date) => {
  if (!value || !now) return false;
  const parsed = parseDate(value);
  if (!parsed) return false;
  return formatKstYearMonth(parsed) === formatKstYearMonth(now);
};

const formatYmdLabel = (value?: string | null) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
};

const formatExpiryLabel = (value?: string | null) => {
  if (!value) return '정보 없음';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '정보 없음';
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
};

type MissionSubmission = {
  id: number;
  link: string | null;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
  metadata?: {
    note?: string | null;
  };
};

// --- Components ---
function LaunchEventSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans tracking-tight px-2">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 pb-20">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-5 w-64 rounded-full" />
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="mt-6 h-12 w-full rounded-xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-24 rounded-full" />

          <div className="rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-3 w-40 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-52 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-40 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          <div className="rounded-[24px] bg-white shadow-sm border border-neutral-200 overflow-hidden">
            <div className="flex border-b border-neutral-100">
              <Skeleton className="h-12 w-1/2 rounded-none" />
              <Skeleton className="h-12 w-1/2 rounded-none" />
            </div>
            <div className="p-5 space-y-4">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-3 w-60 rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-11 flex-1 rounded-xl" />
                <Skeleton className="h-11 w-20 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LaunchEventPage() {
  const router = useRouter();
  const { user, session, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Data State
  const [claimedAt, setClaimedAt] = useState<string | null>(null);
  const [tierExpiresAt, setTierExpiresAt] = useState<string | null>(null);
  const [dailyClaimedAt, setDailyClaimedAt] = useState<string | null>(null);

  // Referral State
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [appliedReferralAt, setAppliedReferralAt] = useState<string | null>(null);
  const [referralApplyCode, setReferralApplyCode] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [referralTab, setReferralTab] = useState<'invite' | 'register'>('invite'); // Tab State

  // Review State
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewLink, setReviewLink] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewSubmissions, setReviewSubmissions] = useState<MissionSubmission[]>([]);

  const now = useMemo(() => new Date(), []);
  const kstToday = useMemo(() => formatKstDate(now), [now]);
  const hasDailyClaimed = dailyClaimedAt === kstToday;
  const isReferralLocked = useMemo(
    () => isSameKstMonth(appliedReferralAt, now),
    [appliedReferralAt, now]
  );
  const nextReferralEligibleDate = useMemo(() => {
    if (!appliedReferralAt) return null;
    const applied = parseDate(appliedReferralAt);
    if (!applied) return null;
    const kstYearMonth = formatKstYearMonth(applied);
    const [yearValue, monthValue] = kstYearMonth.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);
    if (!year || !month) return null;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  }, [appliedReferralAt]);
  const referralDaysUntilNext = useMemo(() => {
    if (!isReferralLocked || !nextReferralEligibleDate) return null;
    const diff =
      (new Date(nextReferralEligibleDate).getTime() - new Date(kstToday).getTime()) / 86400000;
    return Math.max(0, Math.ceil(diff));
  }, [isReferralLocked, nextReferralEligibleDate, kstToday]);

  // --- Effects ---
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/signin');
      return;
    }
    if (!user) return;

    let isMounted = true;
    const fetchStatus = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select(
            'launch_event_claimed_at, tier_expires_at, launch_event_daily_claimed_at, launch_event_referral_code, launch_event_referral_applied_code, launch_event_referral_applied_at'
          )
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (!isMounted) return;

        setClaimedAt(data?.launch_event_claimed_at ?? null);
        setTierExpiresAt(data?.tier_expires_at ?? null);
        setDailyClaimedAt(data?.launch_event_daily_claimed_at ?? null);
        setReferralCode(data?.launch_event_referral_code ?? null);
        setAppliedReferralCode(data?.launch_event_referral_applied_code ?? null);
        setAppliedReferralAt(data?.launch_event_referral_applied_at ?? null);

        // Fetch Review Submissions
        const { data: submissions } = await supabase
          .from('launch_event_mission_submissions')
          .select('id, link, status, created_at, rejection_reason')
          .eq('user_id', user.id)
          .eq('mission_type', EVENT_MISSION_TYPE)
          .order('created_at', { ascending: false })
          .limit(5);

        setReviewSubmissions(submissions ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, router, user]);

  // --- Handlers ---

  const handleClaimReward = async () => {
    if (!user || isClaiming) return;
    setIsClaiming(true);
    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      const base = isAfter(tierExpiresAt, now) ? new Date(tierExpiresAt as string) : now;
      const nextExpiry = addDays(base, CLAIM_DAYS);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          tier: 'pro',
          tier_expires_at: nextExpiry.toISOString(),
          launch_event_claimed_at: now.toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setClaimedAt(now.toISOString());
      setTierExpiresAt(nextExpiry.toISOString());
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      toast({
        title: 'PRO 14일권을 받았어요! 🎉',
        duration: 1000,
      });
    } catch (err) {
      toast({
        title: '지급 실패',
        description: '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
        duration: 1000,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleDailyClaim = async () => {
    if (!user || hasDailyClaimed) return;
    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      const base = isAfter(tierExpiresAt, now) ? new Date(tierExpiresAt as string) : now;
      const nextExpiry = addDays(base, 1);
      const today = formatKstDate(now);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          tier: 'pro',
          tier_expires_at: nextExpiry.toISOString(),
          launch_event_daily_claimed_at: today,
        })
        .eq('id', user.id);

      if (error) throw error;

      setTierExpiresAt(nextExpiry.toISOString());
      setDailyClaimedAt(today);
      toast({ title: '출석 완료! +1일 연장되었어요 📅', duration: 1000 });
    } catch (err) {
      toast({
        title: '실패',
        description: '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
        duration: 1000,
      });
    }
  };

  const handleGenerateReferral = async () => {
    if (!user) return;
    const code = `RF-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ launch_event_referral_code: code })
        .eq('id', user.id);
      if (error) throw error;
      setReferralCode(code);
    } catch (err) {
      toast({ title: '오류 발생', variant: 'destructive', duration: 1000 });
    }
  };

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    toast({ title: '초대 코드가 복사되었어요 📋' });
  };

  const handleApplyReferral = async () => {
    if (!user || isApplyingReferral) return;
    if (isReferralLocked) return;

    const code = referralApplyCode.trim().toUpperCase();
    if (!code) {
      toast({ title: '코드를 입력해주세요', variant: 'destructive', duration: 1000 });
      return;
    }

    setIsApplyingReferral(true);
    try {
      const res = await fetch('/api/referral/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAppliedReferralCode(code);
      if (data.applied_at) setAppliedReferralAt(data.applied_at);
      if (data.tier_expires_at) setTierExpiresAt(data.tier_expires_at);
      setReferralApplyCode('');
      toast({ title: '쿠폰 등록 완료! +1개월 지급됨 🎁', duration: 1000 });
    } catch (err: any) {
      toast({
        title: '등록 실패',
        description: err.message,
        variant: 'destructive',
        duration: 1000,
      });
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || isSubmittingReview) return;
    if (!reviewLink.trim() && !reviewNote.trim()) {
      toast({
        title: '링크 또는 닉네임/아이디를 입력해주세요',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('launch_event_mission_submissions')
        .insert({
          user_id: user.id,
          mission_type: EVENT_MISSION_TYPE,
          link: reviewLink.trim(),
          metadata: { note: reviewNote.trim() || null },
        })
        .select()
        .single();

      // Google Spaces Webhook 호출
      try {
        await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewLink: reviewLink.trim(),
            reviewNote: reviewNote.trim(),
            user: { id: user.id, email: user.email },
          }),
        });
      } catch (e) {
        // 무시 (실패해도 메인 플로우 영향 X)
      }

      if (error) throw error;
      setReviewSubmissions((prev) => [data, ...prev]);
      setIsReviewDialogOpen(false);
      setReviewLink('');
      setReviewNote('');
      toast({ title: '인증 요청 완료', description: '검수 후 보상이 지급됩니다.', duration: 1000 });
    } catch (err) {
      toast({ title: '제출 실패', variant: 'destructive', duration: 1000 });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (authLoading || isLoading) {
    return <LaunchEventSkeleton />;
  }

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans tracking-tight px-2">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 pb-20">
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/?page=home')}
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-neutral-900">이전으로</h2>
        </div>

        {/* --- Main Content --- */}

        {/* 1. Header & Status (Always visible after claim) */}
        {!claimedAt ? (
          <header className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.1em] text-orange-400 font-bold">
              launch event
            </p>
            <h1 className="text-[16px] font-bold text-neutral-800">
              앱 출시 기념, <span className="text-orange-400">PRO 14일 연장</span> 혜택
            </h1>
          </header>
        ) : (
          <div className="rounded-[24px] bg-white p-5 shadow-sm border border-orange-100 relative overflow-hidden">
            <div className="relative z-10">
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 rounded-xl px-4 py-3 border border-orange-100">
                  <p className="text-[12px] text-orange-500">PRO 만료 예정일</p>
                  <p className="text-[14px] font-semibold tabular-nums text-neutral-900">
                    {formatExpiryLabel(tierExpiresAt)}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-orange-200/50 blur-2xl" />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 text-[12px] rounded-full  hover:bg-orange-50 hover:text-orange-700"
            >
              <Link href="/pricing">PRO 혜택 보러가기</Link>
            </Button>
          </div>
        )}

        {/* 2. Initial Claim Card */}
        {!claimedAt && (
          <section className="relative overflow-hidden rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-neutral-900">14일권 받기</h3>
                <p className="text-[14px] text-neutral-500">누구나 1회 즉시 지급</p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleClaimReward}
                disabled={isClaiming}
                className="w-full h-12 rounded-xl bg-orange-500 text-base font-bold text-white hover:bg-orange-600 shadow-none"
              >
                {isClaiming ? '지급 중...' : '지금 혜택 받기'}
              </Button>
            </div>

            {showConfetti && (
              <div className="pointer-events-none absolute inset-0 z-50">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-xl animate-[confetti-fall_1.2s_ease-out_forwards]"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 0.5}s`,
                    }}
                  >
                    {['🎉', '🎁', '✨'][i % 3]}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3. Mission List (Only after claim) */}
        {claimedAt && (
          <div className="space-y-4">
            <div className="mt-4 flex items-center justify-between px-1">
              <h3 className="text-[16px] font-bold text-neutral-900">미션 리스트</h3>
            </div>

            {/* Mission 1: Daily Check-in (Top Priority) */}
            <div className="group relative overflow-hidden rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200 transition-all hover:border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${hasDailyClaimed ? 'bg-neutral-100 text-neutral-400' : 'bg-orange-100 text-orange-600'}`}
                  >
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-neutral-900">매일 출석체크</h4>
                    <p className="text-[12px] text-neutral-500">
                      버튼 누르고{' '}
                      <span className="text-orange-600 font-semibold">+ PRO 1일 즉시 연장</span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleDailyClaim}
                  disabled={hasDailyClaimed}
                  className={cn(
                    'h-9 rounded-full px-4 text-xs font-semibold transition-all',
                    hasDailyClaimed
                      ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-100 border border-neutral-200'
                      : 'bg-orange-500 text-white hover:bg-orange-600 shadow-none'
                  )}
                >
                  {hasDailyClaimed ? '내일 또 봬요!' : '출석하기'}
                </Button>
              </div>
            </div>

            {/* Mission 2: SNS Review */}
            <div className="rounded-[24px] bg-white p-5 shadow-sm border border-neutral-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 w-full">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 w-full">
                    <h4 className="text-[14px] font-bold text-neutral-900">
                      SNS에 리뷰플로우 후기 남기기
                    </h4>
                    <p className="text-[12px] leading-relaxed text-neutral-500">
                      앱 리뷰, 쓰레드, 블로그, 인스타 어디든 OK.
                      <br />
                      리뷰플로우 홍보 링크 공유하면{' '}
                      <span className="font-semibold text-orange-600">PRO 1개월</span> 선물해드려요.
                      <br />
                      (무제한 참여 가능)
                    </p>
                  </div>
                </div>
              </div>

              {/* 앱 링크 버튼 추가 */}
              <div className="mt-3 flex gap-2">
                {/* iOS: universal link + fallback */}
                <Button
                  variant="ghost"
                  className="flex-1 w-full rounded-xl border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 h-10 text-xs font-semibold"
                  onClick={() => {
                    const userAgent =
                      typeof window !== 'undefined' ? window.navigator.userAgent : '';
                    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
                    if (isIOS) {
                      // 1. 딥링크 시도
                      window.location.href = 'reviewflow://event';
                      // 2. 1초 후 앱스토어로 이동 (앱 미설치 시)
                      setTimeout(() => {
                        window.location.href =
                          'https://apps.apple.com/kr/app/reviewflow/id6757174544';
                      }, 1000);
                    } else {
                      window.open(
                        'https://apps.apple.com/kr/app/reviewflow/id6757174544',
                        '_blank'
                      );
                    }
                  }}
                >
                  iOS 앱 바로가기
                </Button>
                {/* Android: intent link + fallback */}
                <Button
                  variant="ghost"
                  className="flex-1 w-full rounded-xl border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 h-10 text-xs font-semibold"
                  onClick={() => {
                    const userAgent =
                      typeof window !== 'undefined' ? window.navigator.userAgent : '';
                    const isAndroid = /Android/i.test(userAgent);
                    if (isAndroid) {
                      // 1. intent 딥링크 시도
                      window.location.href =
                        'intent://event#Intent;scheme=reviewflow;package=com.reviewflow.reviewflow;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow;end';
                    } else {
                      window.open(
                        'https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow',
                        '_blank'
                      );
                    }
                  }}
                >
                  Android 앱 바로가기
                </Button>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-orange-100 bg-orange-50/60 text-orange-600 hover:bg-orange-100 hover:text-orange-700 h-10 text-xs font-semibold"
                  onClick={() => setIsReviewDialogOpen(true)}
                >
                  후기 링크 제출하고 받기
                </Button>
              </div>

              {/* Recent Submissions */}
              {reviewSubmissions.length > 0 && (
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-[10px] font-medium text-neutral-400">최근 제출 내역</p>
                  <div className="">
                    {reviewSubmissions.map((sub) => (
                      <div key={sub.id}>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                          <span className="max-w-[200px] truncate text-[11px] text-neutral-600">
                            {sub.link}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                sub.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : sub.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-neutral-200 text-neutral-600'
                              )}
                            >
                              {sub.status === 'pending'
                                ? '검수 중'
                                : sub.status === 'approved'
                                  ? '지급 완료'
                                  : '반려됨'}
                            </span>
                          </div>
                        </div>
                        {sub.status === 'pending' && (
                          <div className="mt-1">
                            <span className="text-[10px] text-neutral-500 block">
                              조금만 기다려주세요. 운영진이 24시간 안에 확인해드릴게요 !
                            </span>
                            {sub.metadata?.note && (
                              <span className="text-[10px] text-neutral-700 block mt-0.5">
                                <span className="font-semibold">추가 메모:</span>{' '}
                                {sub.metadata.note}
                              </span>
                            )}
                          </div>
                        )}
                        {sub.status === 'rejected' && sub.rejection_reason && (
                          <span className="text-[10px] text-red-500">{sub.rejection_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mission 3: Referral System (Tabbed) */}
            <div className="rounded-[24px] bg-white shadow-sm border border-neutral-200 overflow-hidden">
              {/* Custom Tabs */}
              <div className="flex border-b border-neutral-100">
                <button
                  onClick={() => setReferralTab('invite')}
                  className={cn(
                    'flex-1 py-4 text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
                    referralTab === 'invite'
                      ? 'text-neutral-900 bg-white'
                      : 'text-neutral-400 bg-neutral-50'
                  )}
                >
                  <Users className="h-4 w-4" /> 친구 초대
                </button>
                <div className="w-[1px] bg-neutral-100"></div>
                <button
                  onClick={() => setReferralTab('register')}
                  className={cn(
                    'flex-1 py-4 text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
                    referralTab === 'register'
                      ? 'text-neutral-900 bg-white'
                      : 'text-neutral-400 bg-neutral-50'
                  )}
                >
                  <Ticket className="h-4 w-4" /> 쿠폰 등록
                </button>
              </div>

              <div className="p-5">
                {referralTab === 'invite' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div>
                      <h4 className="text-[14px] font-bold text-neutral-900">
                        친구 초대하고 같이 받기
                      </h4>
                      <p className="mt-1 text-[12px] text-neutral-500">
                        친구와 나 모두에게{' '}
                        <span className="text-orange-600 font-semibold">PRO 1개월</span>을 드려요.
                      </p>
                      <div className="mt-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-[12px] text-orange-700 font-semibold">
                        ※ 친구 초대, 쿠폰 등록 이벤트는{' '}
                        <span className="font-bold">2026년 1월 30일</span>까지 진행됩니다.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-neutral-50 p-1 pl-4 border border-neutral-200">
                      <div className="flex-1 truncate text-sm font-medium text-neutral-700">
                        {referralCode || '코드를 발급해주세요'}
                      </div>
                      {referralCode ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyReferral}
                          className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleGenerateReferral}
                          className="h-9 rounded-lg bg-neutral-900 text-xs text-white hover:bg-black"
                        >
                          발급받기
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div>
                      <h4 className="text-[14px] font-bold text-neutral-900">초대 코드 등록하기</h4>
                      <p className="mt-1 text-[12px] text-neutral-500">
                        친구의 코드를 입력하면 즉시{' '}
                        <span className="text-orange-600 font-semibold">PRO 1개월</span>이 지급돼요.
                        <div className="mt-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-[12px] text-orange-700 font-semibold">
                          ※ 친구 초대, 쿠폰 등록 이벤트는{' '}
                          <span className="font-bold">2026년 1월 30일</span>까지 진행됩니다.
                        </div>
                      </p>
                    </div>

                    {isReferralLocked ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                        <div className="mb-1 flex justify-center text-emerald-600">
                          <Check className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold text-emerald-800">등록 완료!</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="RF-XXXXXXXX"
                          value={referralApplyCode}
                          onChange={(e) => setReferralApplyCode(e.target.value)}
                          className="h-11 text-sm bg-neutral-50 text-[16px]"
                        />
                        <Button
                          onClick={handleApplyReferral}
                          disabled={isApplyingReferral}
                          className="h-11 px-5 bg-neutral-900 text-white hover:bg-black"
                        >
                          등록
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base">후기 링크 제출</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600">게시물 링크 (선택)</label>
              <Input
                placeholder="https://... (블로그, SNS 등은 링크, 앱스토어/플레이스토어는 미입력 가능)"
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                className="bg-neutral-50 mt-1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600">추가 메모 (선택)</label>
              <span className="block text-[11px] font-normal text-orange-600 mt-0.5">
                앱스토어/플레이스토어 리뷰의 경우, 본인 닉네임 또는 아이디를 꼭 입력해 주세요.
              </span>
              <Textarea
                placeholder="앱스토어/플레이스토어 리뷰는 닉네임 또는 아이디를 입력해 주세요. (예: 리뷰 작성자명 등)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="min-h-[80px] bg-neutral-50 resize-none mt-1"
              />
            </div>
            <div className="pt-2">
              <Button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
              >
                {isSubmittingReview ? '제출 중...' : '인증하고 1개월 받기'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            opacity: 0;
            transform: translateY(-10px) rotate(0deg);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg);
          }
        }
      `}</style>
    </div>
  );
}
