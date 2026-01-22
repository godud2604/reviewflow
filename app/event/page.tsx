'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Loader2,
  Megaphone,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// --- Constants & Helpers ---
const EVENT_MISSION_TYPE = 'sns_review';
const CLAIM_DAYS = 14;

const formatKstDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

const isAfter = (left?: string | null, right?: Date) => {
  if (!left || !right) return false;
  const parsed = new Date(left);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > right.getTime();
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
};

// --- Components ---

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
  const [referralApplyCode, setReferralApplyCode] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [referralTab, setReferralTab] = useState<'invite' | 'register'>('invite'); // Tab State

  // Review State
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewLink, setReviewLink] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewSubmissions, setReviewSubmissions] = useState<MissionSubmission[]>([]);

  const kstToday = useMemo(() => formatKstDate(new Date()), []);
  const hasDailyClaimed = dailyClaimedAt === kstToday;

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
            'launch_event_claimed_at, tier_expires_at, launch_event_daily_claimed_at, launch_event_referral_code, launch_event_referral_applied_code'
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

        // Fetch Review Submissions
        const { data: submissions } = await supabase
          .from('launch_event_mission_submissions')
          .select('id, link, status, created_at')
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
        description: '지금부터 모든 기능을 사용할 수 있어요.',
      });
    } catch (err) {
      toast({
        title: '지급 실패',
        description: '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
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
      toast({ title: '출석 완료! +1일 연장되었어요 📅' });
    } catch (err) {
      toast({ title: '실패', description: '잠시 후 다시 시도해 주세요.', variant: 'destructive' });
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
      toast({ title: '오류 발생', variant: 'destructive' });
    }
  };

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    toast({ title: '초대 코드가 복사되었어요 📋' });
  };

  const handleApplyReferral = async () => {
    if (!user || isApplyingReferral) return;
    if (appliedReferralCode) return;

    const code = referralApplyCode.trim().toUpperCase();
    if (!code) {
      toast({ title: '코드를 입력해주세요', variant: 'destructive' });
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
      if (data.tier_expires_at) setTierExpiresAt(data.tier_expires_at);
      setReferralApplyCode('');
      toast({ title: '쿠폰 등록 완료! +1개월 지급됨 🎁' });
    } catch (err: any) {
      toast({ title: '등록 실패', description: err.message, variant: 'destructive' });
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || isSubmittingReview) return;
    if (!reviewLink.trim()) {
      toast({ title: '링크를 입력해주세요', variant: 'destructive' });
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

      if (error) throw error;
      setReviewSubmissions((prev) => [data, ...prev]);
      setIsReviewDialogOpen(false);
      setReviewLink('');
      setReviewNote('');
      toast({ title: '인증 요청 완료', description: '검수 후 보상이 지급됩니다.' });
    } catch (err) {
      toast({ title: '제출 실패', variant: 'destructive' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 font-sans">
      <div className="mx-auto flex max-w-[480px] flex-col px-5 py-6 pb-20">
        {/* Navigation */}
        <nav className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-neutral-100 transition"
          >
            <ArrowLeft className="h-6 w-6 text-neutral-800" />
          </button>
          <div className="text-sm font-medium text-neutral-500">프로모션</div>
          <div className="w-10" /> {/* Spacer */}
        </nav>

        {/* --- Main Content --- */}

        {/* 1. Header & Status (Always visible after claim) */}
        {!claimedAt ? (
          <header className="mb-8 mt-2 space-y-3">
            <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">
              New Launch Event
            </span>
            <h1 className="text-2xl font-bold leading-tight text-neutral-900">
              앱 출시 기념,
              <br />
              <span className="text-orange-600">PRO 14일 무료</span> 혜택
            </h1>
            <p className="text-neutral-500 text-sm">
              지금 시작하고 모든 프리미엄 기능을 경험해보세요.
            </p>
          </header>
        ) : (
          <div className="mb-6 rounded-[24px] bg-neutral-900 p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="mb-1 flex items-center gap-2 text-orange-400">
                <Check className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">My Membership</span>
              </div>
              <h2 className="text-2xl font-bold">PRO 이용 중</h2>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[11px] text-neutral-300">현재 만료 예정일</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatExpiryLabel(tierExpiresAt)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-neutral-400">
                👇 아래 미션을 완료하면 만료일이 자동으로 늘어나요!
              </p>
            </div>
            {/* Decor */}
            <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-orange-500/20 blur-2xl" />
          </div>
        )}

        {/* 2. Initial Claim Card */}
        {!claimedAt && (
          <section className="relative overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-neutral-100">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">14일권 받기</h3>
                <p className="text-sm text-neutral-500">누구나 1회 즉시 지급</p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleClaimReward}
                disabled={isClaiming}
                className="w-full h-12 rounded-xl bg-[#ff6a00] text-base font-bold text-white shadow-orange-200 shadow-lg hover:bg-[#e65f00]"
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
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-neutral-900">미션 리스트</h3>
              <span className="text-xs text-neutral-500">무제한 참여 가능</span>
            </div>

            {/* Mission 1: Daily Check-in (Top Priority) */}
            <div className="group relative overflow-hidden rounded-[20px] bg-white p-5 shadow-sm border border-neutral-200 transition-all hover:border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${hasDailyClaimed ? 'bg-neutral-100 text-neutral-400' : 'bg-orange-100 text-orange-600'}`}
                  >
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900">매일 출석체크</h4>
                    <p className="text-xs text-neutral-500">
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
                      ? 'bg-neutral-100 text-neutral-400 hover:bg-neutral-100 border border-neutral-200'
                      : 'bg-[#ff6a00] text-white hover:bg-[#e65f00] shadow-md shadow-orange-100'
                  )}
                >
                  {hasDailyClaimed ? '완료됨' : '출석하기'}
                </Button>
              </div>
            </div>

            {/* Mission 2: SNS Review */}
            <div className="rounded-[20px] bg-white p-5 shadow-sm border border-neutral-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-neutral-900">SNS 후기 남기기</h4>
                    <p className="text-xs leading-relaxed text-neutral-500">
                      앱 리뷰, 쓰레드, 블로그, 인스타 어디든 OK.
                      <br />
                      링크 공유하면 <span className="font-semibold text-blue-600">
                        PRO 1개월
                      </span>{' '}
                      선물해드려요.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-blue-100 bg-blue-50/50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 h-10 text-xs font-semibold"
                  onClick={() => setIsReviewDialogOpen(true)}
                >
                  후기 링크 제출하고 받기
                </Button>
              </div>

              {/* Recent Submissions */}
              {reviewSubmissions.length > 0 && (
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-[10px] font-medium text-neutral-400">최근 제출 내역</p>
                  <div className="space-y-2">
                    {reviewSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"
                      >
                        <span className="max-w-[180px] truncate text-[11px] text-neutral-600">
                          {sub.link}
                        </span>
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
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mission 3: Referral System (Tabbed) */}
            <div className="rounded-[20px] bg-white shadow-sm border border-neutral-200 overflow-hidden">
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
                      <h4 className="font-bold text-neutral-900">친구 초대하고 같이 받기</h4>
                      <p className="mt-1 text-xs text-neutral-500">
                        친구와 나 모두에게{' '}
                        <span className="text-purple-600 font-semibold">PRO 1개월</span>을 드려요.
                        (월 1회 제한)
                      </p>
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
                          className="h-9 rounded-lg bg-neutral-900 text-xs"
                        >
                          발급받기
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div>
                      <h4 className="font-bold text-neutral-900">초대 코드 등록하기</h4>
                      <p className="mt-1 text-xs text-neutral-500">
                        친구의 코드를 입력하면 즉시{' '}
                        <span className="text-purple-600 font-semibold">PRO 1개월</span>이 지급돼요.
                      </p>
                    </div>

                    {appliedReferralCode ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                        <div className="mb-1 flex justify-center text-emerald-600">
                          <Check className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold text-emerald-800">등록 완료!</p>
                        <p className="text-xs text-emerald-600 mt-1">이미 혜택을 받으셨어요.</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="RF-XXXXXXXX"
                          value={referralApplyCode}
                          onChange={(e) => setReferralApplyCode(e.target.value)}
                          className="h-11 text-sm bg-neutral-50"
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
            <DialogTitle className="text-xl">후기 링크 제출</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600">게시물 링크</label>
              <Input
                placeholder="https://..."
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                className="bg-neutral-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600">추가 메모 (선택)</label>
              <Textarea
                placeholder="어떤 SNS인지 간단히 적어주세요."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="min-h-[80px] bg-neutral-50 resize-none"
              />
            </div>
            <div className="pt-2">
              <Button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="w-full h-11 bg-[#ff6a00] hover:bg-[#e65f00] text-white font-bold rounded-xl"
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
