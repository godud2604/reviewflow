'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSchedules } from '@/hooks/use-schedules';
import { useIsMobile } from '@/hooks/use-mobile';
import type { UserProfile } from '@/hooks/use-user-profile';
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

const getDeadlineTimestamp = (schedule: { dead?: string; visit?: string }) => {
  const target = schedule.dead || schedule.visit;
  if (!target) return Number.POSITIVE_INFINITY;
  const parsed = new Date(target);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
};

type ProfilePageProps = {
  profile: UserProfile | null;
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

export default function ProfilePage({ profile }: ProfilePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user: authUser, session, signOut } = useAuth();
  const { schedules } = useSchedules();
  const isMobile = useIsMobile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [downloadScope, setDownloadScope] = useState('all');
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackPrefill, setFeedbackPrefill] = useState<string | undefined>(undefined);
  const [feedbackTypeOverride, setFeedbackTypeOverride] = useState<
    'feature' | 'bug' | 'feedback' | undefined
  >(undefined);

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

  useEffect(() => {
    if (searchParams.get('page') !== 'profile') return;
    if (searchParams.get('feedback') !== '1') return;

    const typeParam = searchParams.get('feedbackType');
    const prefillParam = searchParams.get('feedbackPrefill');

    const nextType =
      typeParam === 'bug' || typeParam === 'feature' || typeParam === 'feedback'
        ? typeParam
        : undefined;

    setFeedbackTypeOverride(nextType);
    setFeedbackPrefill(prefillParam ?? undefined);
    setIsFeedbackModalOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('feedback');
    params.delete('feedbackType');
    params.delete('feedbackPrefill');
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);

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
      });
      return;
    }

    if (isKakaoBrowserWithTightDownloadSupport()) {
      toast({
        title: '이 브라우저에서는 다운로드가 제한됩니다',
        description: '다른 브라우저 또는 PC에서 다운로드해 주세요.',
      });
      return;
    }

    if (!filteredSchedules.length) {
      toast({ title: '선택한 기간의 활동 내역이 없어요.', variant: 'destructive' });
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

    toast({ title: '엑셀 다운로드가 준비되었습니다.' });
  };

  const handleGotoNotifications = () => router.push('/notifications');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/');
    } catch {
      toast({ title: '로그아웃에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleWithdrawAccount = async () => {
    if (!authUser || !session?.access_token) {
      toast({ title: '로그인이 필요합니다.', variant: 'destructive' });
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
      });
      setIsWithdrawalDialogOpen(false);
      await signOut();
      router.push('/');
    } catch (err) {
      toast({
        title: '회원 탈퇴에 실패했습니다.',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
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

  const features = [
    {
      label: '활동 내역 다운로드',
      onClick: openDownloadDialog,
    },
    {
      label: '알림 설정',
      onClick: handleGotoNotifications,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24 font-sans tracking-tight">
      <div className="mx-auto max-w-[520px] space-y-4 px-5 pt-6">
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
        <section className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="px-2 pb-2 text-[12px] font-semibold text-neutral-500">기능</p>
          {features.map((feature, idx) => {
            return (
              <button
                key={feature.label}
                type="button"
                onClick={feature.onClick}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition ${
                  idx !== features.length - 1 ? 'border-b border-neutral-100' : ''
                } hover:bg-neutral-50`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900">
                    {feature.label}
                  </div>
                </div>
                <span className="text-[18px] text-neutral-300">›</span>
              </button>
            );
          })}
        </section>

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
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          initialFeedbackType={feedbackTypeOverride}
          initialContent={feedbackPrefill}
          source="update_required_modal"
        />
      </div>
    </div>
  );
}
