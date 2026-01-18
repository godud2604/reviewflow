'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSchedules } from '@/hooks/use-schedules';
import { useIsMobile } from '@/hooks/use-mobile';
import type { UserProfile } from '@/hooks/use-user-profile';
import { getSupabaseClient } from '@/lib/supabase';
import { resolveTier } from '@/lib/tier';
import FeedbackModal from '@/components/feedback-modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${month}월`;
};

const getMonthKeyFromDate = (raw?: string) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hyphenMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (hyphenMatch) {
    return `${hyphenMatch[1]}-${hyphenMatch[2].padStart(2, '0')}`;
  }

  const dotMatch = trimmed.match(/^(\d{4})\.(\d{1,2})/);
  if (dotMatch) {
    return `${dotMatch[1]}-${dotMatch[2].padStart(2, '0')}`;
  }

  const parts = trimmed.split(/[^\d]/).filter(Boolean);
  if (parts.length >= 2 && parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear().toString();
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
};

const PRO_TIER_DURATION_MONTHS = 3;
const COUPON_TIER_DURATION_MONTHS = 3;

const formatExpiryLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
};

const getDeadlineTimestamp = (schedule: { dead?: string; visit?: string }) => {
  const target = schedule.dead || schedule.visit;
  if (!target) return Number.POSITIVE_INFINITY;
  const parsed = new Date(target);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
};

type ProfilePageProps = {
  profile: UserProfile | null;
  refetchUserProfile: () => Promise<void>;
};

export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 font-sans tracking-tight">
      <div className="mx-auto max-w-[520px] space-y-6 px-5 pt-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>

        <section className="rounded-3xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="mt-2 h-3 w-48 rounded-full" />
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <Skeleton className="h-3 w-20 rounded-full" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`feature-${idx}`} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36 rounded-full" />
                  <Skeleton className="h-3 w-56 rounded-full" />
                </div>
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-4 shadow-sm">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="mt-2 h-3 w-56 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({ profile, refetchUserProfile }: ProfilePageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, session, signOut } = useAuth();
  const { schedules } = useSchedules();
  const isMobile = useIsMobile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [downloadScope, setDownloadScope] = useState('all');
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false);
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const { isPro } = resolveTier({
    profileTier: profile?.tier ?? undefined,
    metadata,
  });
  const tierDurationMonths = profile?.tierDurationMonths ?? 0;
  const displayTierDuration =
    tierDurationMonths > 0 ? tierDurationMonths : PRO_TIER_DURATION_MONTHS;
  const tierExpiryLabel = formatExpiryLabel(profile?.tierExpiresAt);
  const tierLabel = isPro ? 'PRO' : 'FREE';
  const tierDurationLabel = isPro ? `${displayTierDuration}개월` : '기본 플랜';
  const tierExpiryText = isPro
    ? tierExpiryLabel
      ? `만료 ${tierExpiryLabel}`
      : '만료 정보 없음'
    : '만료 없음';
  const tierBadgeStyle = isPro ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600';

  const displayName = profile?.nickname ?? '';
  const emailLabel = authUser?.email ?? '등록된 이메일이 없습니다';

  const scheduleMonthOptions = useMemo(() => {
    const monthMap = new Map<string, string>();
    schedules.forEach((schedule) => {
      const monthKey = getMonthKeyFromDate(schedule.visit) ?? getMonthKeyFromDate(schedule.dead);
      if (monthKey) {
        monthMap.set(monthKey, formatMonthLabel(monthKey));
      }
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([value, label]) => ({ value, label }));
  }, [schedules]);

  useEffect(() => {
    if (
      downloadScope !== 'all' &&
      !scheduleMonthOptions.some((option) => option.value === downloadScope)
    ) {
      setDownloadScope('all');
    }
  }, [downloadScope, scheduleMonthOptions]);

  const filteredSchedules = useMemo(() => {
    if (downloadScope === 'all') {
      return schedules;
    }

    return schedules.filter((schedule) => {
      const visitKey = getMonthKeyFromDate(schedule.visit);
      const deadKey = getMonthKeyFromDate(schedule.dead);
      return visitKey === downloadScope || deadKey === downloadScope;
    });
  }, [schedules, downloadScope]);

  const schedulesSortedByDeadline = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => getDeadlineTimestamp(a) - getDeadlineTimestamp(b));
  }, [filteredSchedules]);

  const downloadScopeLabel =
    downloadScope === 'all' ? '전체 활동' : formatMonthLabel(downloadScope);
  const downloadSummaryMessage = filteredSchedules.length
    ? `${downloadScopeLabel} 기준 ${filteredSchedules.length}건을 준비합니다.`
    : '활동 기록을 추가하면 다운로드를 사용할 수 있습니다.';

  const isKakaoBrowserWithTightDownloadSupport = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = ua.includes('android');
    const isKakao = ua.includes('kakaotalk') || ua.includes('kakaobrowser');
    return (isIos || isAndroid) && isKakao;
  };

  const handleDownloadActivity = () => {
    if (isMobile) {
      toast({
        title: '모바일 환경에서는 지원하지 않는 기능입니다',
        description: 'PC에서 확인해 주세요.',
        duration: 1000,
      });
      return;
    }

    if (isKakaoBrowserWithTightDownloadSupport()) {
      toast({
        title: '이 브라우저에서는 다운로드가 제한됩니다',
        description: '다른 브라우저 또는 PC에서 다운로드해 주세요.',
        duration: 1000,
      });
      return;
    }

    if (!filteredSchedules.length) {
      toast({ title: '선택한 기간의 활동 내역이 없어요.', variant: 'destructive', duration: 1000 });
      return;
    }

    const scopeLabel = downloadScope === 'all' ? '전체' : formatMonthLabel(downloadScope);
    const rows = schedulesSortedByDeadline.map((schedule, index) => ({
      번호: index + 1,
      플랫폼: schedule.platform || '-',
      제목: schedule.title,
      상태: schedule.status,
      방문일: schedule.visit || '-',
      마감일: schedule.dead || '-',
      채널: schedule.channel.join(', '),
      혜택: schedule.benefit,
      수익: schedule.income,
      비용: schedule.cost,
      순수익: schedule.benefit + schedule.income - schedule.cost,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '활동 내역');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileSuffix = scopeLabel.replace(/\s+/g, '_');
    link.download = `활동내역_${fileSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({ title: '엑셀 다운로드가 준비되었습니다.', duration: 1000 });
  };

  const handleGotoNotifications = () => router.push('/notifications');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/');
    } catch {
      toast({ title: '로그아웃에 실패했습니다.', variant: 'destructive', duration: 1000 });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleWithdrawAccount = async () => {
    if (!authUser || !session?.access_token) {
      toast({ title: '로그인이 필요합니다.', variant: 'destructive', duration: 1000 });
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error ?? '회원 탈퇴에 실패했습니다.');
      }

      toast({
        title: '회원 탈퇴가 완료되었습니다.',
        description: '모든 정보가 삭제되었으며 다시 로그인할 수 없습니다.',
        duration: 1000,
      });
      setIsWithdrawalDialogOpen(false);
      await signOut();
      router.push('/');
    } catch (err) {
      toast({
        title: '회원 탈퇴에 실패했습니다.',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
        duration: 1000,
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openDownloadDialog = () => {
    if (isMobile) {
      toast({
        title: '모바일 환경에서는 지원하지 않는 기능입니다',
        description: 'PC에서 확인해 주세요.',
        duration: 1000,
      });
      return;
    }

    if (!filteredSchedules.length) {
      toast({
        title: '저장된 일정이 없어요.',
        description: '먼저 일정을 추가해 주세요.',
        duration: 1000,
      });
      return;
    }

    setIsDownloadDialogOpen(true);
  };

  const handleFeatureClick = (feature: { onClick: () => void; isPro?: boolean }) => {
    if (feature.isPro && !isPro) {
      toast({
        title: 'PRO 전용 기능입니다.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }

    feature.onClick();
  };

  const proFeatures = [
    {
      label: '활동 내역 다운로드',
      icon: '📂',
      isPro: true,
      onClick: openDownloadDialog,
    },
    {
      label: '알림 설정',
      icon: '🔔',
      isPro: true,
      onClick: handleGotoNotifications,
    },
    // {
    //   label: '실시간 랭킹 리포트',
    //   description: '오늘의 실시간 성장 지표',
    //   icon: '📊',
    //   isPro: true,
    //   onClick: handleGotoMonthlyReport,
    // },
    // {
    //   label: "포트폴리오 보기",
    //   description: "외부에 공개된 영향력 페이지를 미리 확인해 보세요",
    //   icon: "🧾",
    //   onClick: handleGotoPortfolioPreview,
    // },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 font-sans tracking-tight">
      <div className="mx-auto max-w-[520px] space-y-6 px-5 pt-6">
        <div className="flex items-center gap-3" onClick={() => router.push('/?page=home')}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-neutral-900">프로필</h2>
        </div>
        <section className="rounded-3xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <div className="space-y-1">
            {displayName ? (
              <p className="text-[15px] font-semibold text-neutral-900">{displayName}</p>
            ) : null}
            <p className="text-[13px] text-neutral-500">{emailLabel}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierBadgeStyle}`}
            >
              {tierLabel}
            </span>
            <span>{tierDurationLabel}</span>
            <span className="text-neutral-300">·</span>
            <span>{tierExpiryText}</span>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="px-2 pb-2 text-[12px] font-semibold text-neutral-500">고급 기능</p>
          {proFeatures.map((feature, idx) => {
            const isFeatureLocked = feature.isPro && !isPro;
            return (
              <button
                key={feature.label}
                type="button"
                aria-disabled={isFeatureLocked}
                onClick={() => handleFeatureClick(feature)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition ${
                  idx !== proFeatures.length - 1 ? 'border-b border-neutral-100' : ''
                } ${isFeatureLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-neutral-50'}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900">
                    {feature.label}
                    {feature.isPro && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        PRO
                      </span>
                    )}
                  </div>
                  {feature.description && (
                    <p className="text-[12px] text-neutral-500">{feature.description}</p>
                  )}
                </div>
                <span className="text-[18px] text-neutral-300">›</span>
              </button>
            );
          })}
        </section>

        <button
          type="button"
          onClick={() => setIsFeedbackModalOpen(true)}
          className="flex w-full items-center justify-between rounded-3xl border border-neutral-200 bg-white px-6 py-4 shadow-sm text-left text-sm font-semibold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-neutral-900">피드백 · 문의하기</span>
              <span className="text-[12px] font-medium text-neutral-500">
                궁금한 점이나 불편한 점을 알려주시면 빠르게 개선할게요
              </span>
            </span>
          </span>
          <span className="text-[18px] text-neutral-300">›</span>
        </button>

        {/* {isPro && tierDurationMonths !== COUPON_TIER_DURATION_MONTHS && (
          <section className="rounded-3xl border border-amber-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-neutral-500">쿠폰 등록</p>
            <p className="mt-1 text-[12px] font-semibold text-neutral-900">
              사전신청 시 입력된 이메일로 발송된 쿠폰을 입력하면 등급이 PRO로 전환됩니다.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="쿠폰 코드를 입력하세요"
                className="flex-1 min-w-0 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[16px] text-neutral-900 shadow-sm transition focus:border-neutral-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isRedeemingCoupon}
                className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRedeemingCoupon ? '적용 중...' : '적용'}
              </button>
            </div>
          </section>
        )} */}

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-4 text-sm font-semibold text-neutral-400 transition-colors hover:text-neutral-600 active:scale-95"
        >
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
        <div className="text-center text-[14px] text-neutral-400 hover:text-neutral-500">
          <button
            type="button"
            onClick={() => setIsWithdrawalDialogOpen(true)}
            className="underline-offset-2 transition hover:text-neutral-500 focus-visible:text-neutral-500"
          >
            계정 탈퇴
          </button>
        </div>
        <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
          <DialogContent className="max-w-[300px]">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>활동 내역 다운로드</DialogTitle>
              <DialogDescription>월별 또는 전체 활동을 엑셀로 저장합니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-600">조회할 활동 기간</p>
                <Select value={downloadScope} onValueChange={setDownloadScope}>
                  <SelectTrigger
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm"
                    aria-label="조회할 활동 기간"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border border-neutral-200 bg-white shadow-lg">
                    <SelectItem value="all" className="text-sm text-neutral-900">
                      전체 활동 내역
                    </SelectItem>
                    {scheduleMonthOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-sm text-neutral-900"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-neutral-500">{downloadSummaryMessage}</p>
            </div>
            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={handleDownloadActivity}
                disabled={!filteredSchedules.length}
                className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-900"
              >
                엑셀 다운로드
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
          <DialogContent className="max-w-[300px]">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>회원 탈퇴</DialogTitle>
              <DialogDescription>
                계정과 모든 활동 기록이 즉시 삭제되며 복구할 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-neutral-600">
                탈퇴하면 모든 데이터가 제거되며 동일 이메일로 다시 가입하더라도 기록을 복원할 수
                없습니다.
              </p>
            </div>
            <DialogFooter className="pt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleWithdrawAccount}
                disabled={isDeletingAccount}
                className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingAccount ? '탈퇴 진행 중...' : '계정 탈퇴하기'}
              </button>
              <button
                type="button"
                onClick={() => setIsWithdrawalDialogOpen(false)}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                취소
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
      </div>
    </div>
  );
}
