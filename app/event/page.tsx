'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Copy, Gift, Loader2, Share2 } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const EVENT_MISSION_TYPE = 'sns_review';
const CLAIM_DAYS = 10;

const formatKstDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

const isAfter = (left?: string | null, right?: Date) => {
  if (!left || !right) return false;
  const parsed = new Date(left);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > right.getTime();
};

const formatExpiryLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
};

type MissionSubmission = {
  id: number;
  link: string | null;
  status: string;
  created_at: string;
};

export default function LaunchEventPage() {
  const router = useRouter();
  const { user, session, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [claimedAt, setClaimedAt] = useState<string | null>(null);
  const [tierExpiresAt, setTierExpiresAt] = useState<string | null>(null);
  const [dailyClaimedAt, setDailyClaimedAt] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [appliedReferralAt, setAppliedReferralAt] = useState<string | null>(null);
  const [referralApplyCode, setReferralApplyCode] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewLink, setReviewLink] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewSubmissions, setReviewSubmissions] = useState<MissionSubmission[]>([]);
  const [isProBenefitsOpen, setIsProBenefitsOpen] = useState(false);

  const kstToday = useMemo(() => formatKstDate(new Date()), []);
  const hasDailyClaimed = dailyClaimedAt === kstToday;

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

        const { data: submissions, error: submissionError } = await supabase
          .from('launch_event_mission_submissions')
          .select('id, link, status, created_at')
          .eq('user_id', user.id)
          .eq('mission_type', EVENT_MISSION_TYPE)
          .order('created_at', { ascending: false })
          .limit(5);

        if (submissionError) throw submissionError;
        if (!isMounted) return;
        setReviewSubmissions(submissions ?? []);
      } catch (err) {
        toast({
          title: '이벤트 정보를 불러오지 못했어요',
          description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, router, toast, user]);

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
      window.setTimeout(() => setShowConfetti(false), 1500);

      toast({
        title: 'PRO 14일권을 받았어요!',
        description: '지금부터 프로 기능을 자유롭게 사용해 보세요.',
      });
    } catch (err) {
      toast({
        title: '14일권 지급에 실패했어요',
        description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || isSubmittingReview) return;
    const trimmed = reviewLink.trim();

    if (!trimmed) {
      toast({
        title: '후기 링크를 입력해 주세요',
        variant: 'destructive',
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
          link: trimmed,
          metadata: {
            note: reviewNote.trim() || null,
            source: 'launch_event',
          },
        })
        .select('id, link, status, created_at')
        .single();

      if (error) throw error;

      setReviewSubmissions((prev) => (data ? [data, ...prev].slice(0, 5) : prev));
      setReviewLink('');
      setReviewNote('');
      setIsReviewDialogOpen(false);

      try {
        const authorMeta = user.user_metadata as { full_name?: string; name?: string } | null;
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedbackType: 'SNS 후기 인증 요청',
            content: `${trimmed}\n\n${reviewNote.trim()}`.trim(),
            author: {
              id: user.id,
              email: user.email ?? null,
              name: authorMeta?.full_name ?? authorMeta?.name ?? null,
            },
          }),
          keepalive: true,
        });
      } catch (notifyError) {
        console.error('Failed to notify mission submission:', notifyError);
      }

      toast({
        title: '후기 인증이 접수되었어요',
        description: '운영진 검수 후 1개월 지급이 진행됩니다.',
      });
    } catch (err) {
      toast({
        title: '후기 인증 제출에 실패했어요',
        description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingReview(false);
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
      toast({
        title: '초대 코드가 발급되었어요',
        description: '코드를 친구에게 공유해 주세요.',
      });
    } catch (err) {
      toast({
        title: '초대 코드 발급에 실패했어요',
        description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({
        title: '초대 코드가 복사되었어요',
      });
    } catch (err) {
      toast({
        title: '복사에 실패했어요',
        description: '다시 시도해 주세요.',
        variant: 'destructive',
      });
    }
  };

  const handleApplyReferral = async () => {
    if (!user || isApplyingReferral) return;
    if (!session?.access_token) {
      toast({
        title: '로그인이 필요합니다',
        variant: 'destructive',
      });
      return;
    }

    if (appliedReferralCode) {
      toast({
        title: '이미 쿠폰을 등록했어요',
        description: '쿠폰은 한 번만 등록할 수 있어요.',
      });
      return;
    }

    const trimmed = referralApplyCode.trim().toUpperCase();
    if (!trimmed) {
      toast({
        title: '쿠폰 코드를 입력해 주세요',
        variant: 'destructive',
      });
      return;
    }

    if (referralCode && trimmed === referralCode) {
      toast({
        title: '내 쿠폰은 등록할 수 없어요',
        description: '친구의 쿠폰 코드를 입력해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsApplyingReferral(true);
    try {
      const response = await fetch('/api/referral/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || '쿠폰 등록에 실패했어요.');
      }

      setAppliedReferralCode(trimmed);
      setAppliedReferralAt(data?.applied_at ?? null);
      if (data?.tier_expires_at) {
        setTierExpiresAt(data.tier_expires_at);
      }
      setReferralApplyCode('');

      toast({
        title: '쿠폰이 등록되었어요',
        description: data?.inviter_rewarded
          ? '친구와 나 모두 1개월이 바로 지급됐어요.'
          : '나는 1개월이 지급됐고, 추천인 보상은 이번 달 1회 제한이에요.',
      });
    } catch (err) {
      toast({
        title: '쿠폰 등록에 실패했어요',
        description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingReferral(false);
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
      toast({
        title: '프로 1일권이 지급되었어요',
        description: '내일 다시 참여할 수 있어요.',
      });
    } catch (err) {
      toast({
        title: '오늘의 참여 처리에 실패했어요',
        description: err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          이벤트를 준비 중이에요...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F7F7F8] text-neutral-900">
      <div className="pointer-events-none absolute -top-40 right-[-80px] h-[320px] w-[320px] rounded-full bg-orange-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[-120px] h-[320px] w-[320px] rounded-full bg-orange-100/60 blur-3xl" />
      <div className="relative mx-auto flex max-w-3xl flex-col gap-8 px-5 py-10">
        <div className="flex items-center justify-between">
          <Link
            href="/?page=home"
            className="text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>

        {!claimedAt && (
          <section className="relative overflow-hidden rounded-[32px] border border-orange-100 bg-white px-6 py-7 shadow-[0_20px_50px_rgba(255,122,24,0.15)]">
            <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-orange-100/70 blur-2xl" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-500">
                <span className="rounded-full bg-orange-50 px-3 py-1">모든 유저 대상</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-500">
                  14일권 1회 지급
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold leading-snug md:text-3xl">
                  프로 14일권을 지금 바로 받아보세요
                </h1>
                <p className="text-sm text-neutral-500">
                  일정 관리, 통계, 알림까지 프로 기능을 14일 동안 모두 체험할 수 있어요.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleClaimReward}
                disabled={isClaiming}
                className="h-11 rounded-full bg-[#ff6a00] px-6 text-sm font-semibold text-white hover:bg-[#f25f00]"
              >
                {isClaiming ? '지급 중...' : '프로 14일권 받기'}
              </Button>
              <span className="text-xs text-neutral-400">한 번만 받을 수 있어요</span>
            </div>
            {showConfetti && (
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span
                    key={`confetti-${index}`}
                    className="absolute text-lg animate-[confetti-fall_1.5s_ease-out_forwards]"
                    style={{
                      left: `${(index % 6) * 15 + 10}%`,
                      animationDelay: `${index * 0.03}s`,
                    }}
                  >
                    🎉
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {claimedAt && (
          <>
            <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm transition">
              <button
                type="button"
                onClick={() => setIsProBenefitsOpen((prev) => !prev)}
                className={cn(
                  'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition',
                  isProBenefitsOpen ? 'border-b border-neutral-100' : ''
                )}
                aria-expanded={isProBenefitsOpen}
              >
                <div>
                  <h2 className="text-base font-semibold">PRO 혜택</h2>
                  <p className="text-xs text-neutral-500">프로 기능과 만료 정보를 확인하세요.</p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-neutral-400 transition-transform',
                    isProBenefitsOpen ? 'rotate-180' : 'rotate-0'
                  )}
                />
              </button>

              {isProBenefitsOpen && (
                <div className="px-5 pb-5">
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      PRO
                    </span>
                    <span>{`만료 ${formatExpiryLabel(tierExpiresAt) ?? '정보 없음'}`}</span>
                  </div>

                  <ul className="mt-3 space-y-1.5 text-xs text-neutral-600">
                    <li>카카오 알림으로 일정과 요약을 받아볼 수 있어요.</li>
                    <li>통계 페이지에서 전체 기간과 이전 달 수익 통계를 모두 확인할 수 있어요.</li>
                    <li>활동 내역을 엑셀 파일로 다운로드할 수 있어요.</li>
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm transition">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">미션 리스트</h2>
                  <p className="text-xs text-neutral-500">미션 완료 후 추가 혜택을 받아보세요.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">SNS 후기 남기기</p>
                      <p className="text-xs text-neutral-500">
                        블로그/쓰레드/인스타 등 모든 SNS에 홍보 가능! 링크 공유 시 pro 1개월 지급
                        (무제한 참여 가능)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-full bg-[#ff6a00] text-white hover:bg-[#f25f00]"
                      onClick={() => setIsReviewDialogOpen(true)}
                    >
                      인증하기
                    </Button>
                  </div>
                  {reviewSubmissions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {reviewSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"
                        >
                          <span className="truncate text-neutral-600">{submission.link}</span>
                          <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-600">
                            {submission.status === 'approved'
                              ? '승인 완료'
                              : submission.status === 'rejected'
                                ? '반려'
                                : '검수 대기 · 24시간 내 확인'}
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-neutral-500">
                        운영진이 링크 확인 후 상태가 자동으로 바뀝니다. 따로 status를 변경할 필요는
                        없어요.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">친구 초대하기</p>
                      <p className="text-xs text-neutral-500">
                        친구는 가입 즉시 1개월, 추천인 보상은 매월 1회만 지급돼요.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-full bg-white text-neutral-700 shadow-sm hover:bg-neutral-100"
                      onClick={referralCode ? handleCopyReferral : handleGenerateReferral}
                    >
                      {referralCode ? '코드 복사' : '초대하기'}
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs shadow-inner">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Share2 className="h-4 w-4 text-neutral-400" />
                      <span>{referralCode ?? '초대하기 버튼을 눌러 코드 발급'}</span>
                    </div>
                    {referralCode && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCopyReferral}
                        className="h-7 w-7"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-white px-3 py-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">쿠폰 등록하기</p>
                        <p className="text-[11px] text-neutral-500">
                          친구의 쿠폰을 등록하면 즉시 1개월이 지급돼요. 추천인 보상은 월 1회예요.
                        </p>
                      </div>
                      {appliedReferralCode && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                          등록 완료
                        </span>
                      )}
                    </div>
                    {tierExpiresAt && (
                      <div className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-500">
                        현재 PRO 만료일: {formatExpiryLabel(tierExpiresAt)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="RF-XXXXXXXX"
                        value={appliedReferralCode ?? referralApplyCode}
                        onChange={(event) => setReferralApplyCode(event.target.value)}
                        disabled={Boolean(appliedReferralCode) || isApplyingReferral}
                        className="h-9 flex-1 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-9 rounded-full bg-neutral-900 text-xs text-white hover:bg-neutral-800"
                        onClick={handleApplyReferral}
                        disabled={Boolean(appliedReferralCode) || isApplyingReferral}
                      >
                        {isApplyingReferral ? '등록 중...' : '쿠폰 등록'}
                      </Button>
                    </div>
                    {appliedReferralCode && appliedReferralAt && (
                      <p className="mt-2 text-[11px] text-neutral-500">
                        {formatExpiryLabel(appliedReferralAt)}에 등록되었어요.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">매일 참여하기</p>
                      <p className="text-xs text-neutral-500">
                        하루에 한 번 클릭하면 pro 1일권 지급!
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={hasDailyClaimed ? 'outline' : 'default'}
                      className={cn(
                        'rounded-full',
                        hasDailyClaimed
                          ? 'border-neutral-200 text-neutral-500'
                          : 'bg-[#ff6a00] text-white hover:bg-[#f25f00]'
                      )}
                      onClick={handleDailyClaim}
                      disabled={hasDailyClaimed}
                    >
                      {hasDailyClaimed ? '오늘 참여 완료' : '오늘 참여하기'}
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">
                    {hasDailyClaimed
                      ? '내일 다시 참여할 수 있어요.'
                      : '참여 후 바로 기간이 늘어나요.'}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>SNS 후기 인증</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="후기 링크를 입력해 주세요"
              value={reviewLink}
              onChange={(event) => setReviewLink(event.target.value)}
            />
            <Textarea
              placeholder="선택 사항: 어떤 플랫폼인지, 간단한 메모를 남겨주세요"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-[11px] text-neutral-500">
              검수는 운영진이 24시간 내로 확인하며 상태는 자동으로 업데이트됩니다.
            </p>
            <Button onClick={handleSubmitReview} disabled={isSubmittingReview} className="w-full">
              {isSubmittingReview ? '제출 중...' : '인증 요청 보내기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.8);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(120px) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
