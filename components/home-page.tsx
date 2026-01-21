'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { ArrowUp, X, Plus, CalendarDays } from 'lucide-react';

import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { parseDateString } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSupabaseClient } from '@/lib/supabase';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- 날짜/시간 유틸리티 ---
const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const getNowInKST = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const values = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  const date = `${values.year}-${values.month}-${values.day}`;
  const time = `${values.hour}:${values.minute}`;
  return { date, time };
};

const toMinutes = (timeStr?: string, fallback = 0) => {
  if (!timeStr) return fallback;
  const [rawHour, rawMinute] = timeStr.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return fallback;
  return hour * 60 + minute;
};

// --- 상수 ---
const CALENDAR_RING_COLORS: Record<string, string> = {
  선정됨: '#f1a0b6',
  예약완료: '#61cedb',
  '방문일 예약 완료': '#61cedb',
  방문: '#5ba768',
  '제품 배송 완료': 'rgba(240, 221, 73, 1)',
  '배송 완료': '#f3c742',
  배송완료: '#f3c742',
};

const CALENDAR_STATUS_LEGEND: { status: string; color: string; label: string }[] = [
  { status: '선정됨', color: '#f1a0b6', label: '선정됨' },
  { status: '방문일 예약 완료', color: '#61cedb', label: '방문 예약' },
  { status: '방문', color: '#5ba768', label: '방문' },
  { status: '제품 배송 완료', color: '#f3c742', label: '배송 완료' },
];

const FILTER_STICKY_TOP_DESKTOP = 159;
const FILTER_STICKY_TOP_MOBILE = 64;

const getScheduleRingColor = (status: string): string | undefined => CALENDAR_RING_COLORS[status];

const platformLabelMap: Record<string, string> = {
  instagram: '인스타그램',
  youtube: '유튜브',
  tiktok: '틱톡',
  facebook: '페이스북',
  'naver blog': '네이버 블로그',
  naverpost: '네이버 포스트',
  'naver post': '네이버 포스트',
  naver쇼핑: '네이버 쇼핑',
  stylec: '스타일씨',
  blog: '블로그',
  insta: '인스타',
  tiktokshop: '틱톡',
};

const getPlatformDisplayName = (platform: string) => {
  const normalized = platform.trim().toLowerCase();
  return platformLabelMap[normalized] ?? platform;
};

const STATUS_OPTION_SEED = ['선정됨', '방문일 예약 완료', '방문', '배송완료', '완료'];

const normalizeStatus = (status: string) => {
  if (status === '제품 배송 완료' || status === '배송 완료' || status === '배송완료') {
    return '배송완료';
  }
  return status;
};

const formatKoreanMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
};

const formatSlashMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
};

const formatDotMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}.${Number(day)}`;
};

type ViewFilter = 'TODO' | 'DONE';
type SortOption =
  | 'DEADLINE_SOON'
  | 'DEADLINE_LATE'
  | 'VISIT_SOON'
  | 'VISIT_LATE'
  | 'AMOUNT_HIGH'
  | 'AMOUNT_LOW';

export function HomePageSkeleton() {
  return (
    <div className="flex-1 space-y-4 bg-neutral-50/50 px-5 pb-24 pt-3">
      <div className="rounded-[24px] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="mb-3 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <Skeleton key={`weekday-${idx}`} className="h-4 w-full rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 28 }).map((_, idx) => (
            <Skeleton key={`day-${idx}`} className="mx-auto h-8 w-8 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="mt-2 h-4 w-32 rounded-full" />
        </div>
        <Skeleton className="h-12 rounded-[22px]" />
        <Skeleton className="h-10 rounded-[22px]" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={`card-${idx}`} className="rounded-3xl border border-neutral-100 bg-white p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 메인 페이지 ---
export default function HomePage({
  schedules,
  onScheduleClick,
  onCompleteClick,
  onCompletedClick,
  onPaybackConfirm,
  onAdditionalDeadlineToggle,
  onAddClick,
  onCreateSchedule,
  focusDate,
  onFocusDateApplied,
  resetSignal,
}: {
  schedules: Schedule[];
  onScheduleClick: (id: number) => void;
  onCompleteClick?: (id: number) => void;
  onCompletedClick?: (id: number) => void;
  onPaybackConfirm?: (id: number) => void;
  onAdditionalDeadlineToggle?: (scheduleId: number, deadlineId: string) => void;
  onAddClick?: () => void;
  onCreateSchedule?: (dateStr: string) => void;
  focusDate?: string | null;
  onFocusDateApplied?: () => void;
  resetSignal?: number;
}) {
  const posthog = usePostHog();
  const now = getNowInKST();
  const today = now.date;
  const nowMinutes = toMinutes(now.time, 0);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('TODO');
  const [sortOption, setSortOption] = useState<SortOption>('DEADLINE_SOON');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paybackFilter, setPaybackFilter] = useState<'ALL' | 'ONLY'>('ALL');
  const [showAllOnSelectedDate, setShowAllOnSelectedDate] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const filterScrollRef = useRef<HTMLDivElement | null>(null);
  const filterStickySentinelRef = useRef<HTMLDivElement | null>(null);
  const filterStickyRef = useRef<HTMLDivElement | null>(null);
  const [isFilterSticky, setIsFilterSticky] = useState(false);
  const [filterStickyHeight, setFilterStickyHeight] = useState(0);
  const [filterStickyStyle, setFilterStickyStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const [showFilterScrollHint, setShowFilterScrollHint] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const filterHeaderRef = useRef<HTMLDivElement | null>(null);
  const scrollEffectRanRef = useRef(false);
  const skipFilterScrollRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [calendarCtaDate, setCalendarCtaDate] = useState<string | null>(null);
  const [isCalendarCtaOpen, setIsCalendarCtaOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const filterStickyTop = isMobile ? FILTER_STICKY_TOP_MOBILE : FILTER_STICKY_TOP_DESKTOP;
  const showScheduleCompleteToast = useCallback(() => {
    toast({ title: '일정을 완료했어요.', duration: 1000 });
  }, [toast]);
  const showCompletedEditToast = useCallback(() => {
    toast({
      title: '완료 상태를 수정할 수 있어요.',
      description: '진행 상태에서 필요한 단계로 변경해주세요',
      duration: 1000,
    });
  }, [toast]);
  const showAdditionalDeadlineToast = useCallback(
    (wasCompleted: boolean) => {
      toast({
        title: wasCompleted ? '마감일 완료를 해제했어요.' : '마감일을 완료했어요.',
        duration: 1000,
      });
    },
    [toast]
  );
  const showPaybackToast = useCallback(
    (wasConfirmed: boolean) => {
      toast({
        title: wasConfirmed ? '입금 완료를 취소했어요.' : '입금 완료 처리했어요.',
        duration: 1000,
      });
    },
    [toast]
  );

  // Demo Data
  const demoSchedules = useMemo(
    () => [
      {
        title: '강남 파스타 리뷰',
        status: '방문 예약 → 마감 3/20',
        value: '₩55,000',
        tag: '방문형',
      },
      { title: '영양제 제공형', status: '배송 완료 · 3/25 마감', value: '₩32,000', tag: '제공형' },
      {
        title: '카페 인스타 포스팅',
        status: '3/18 방문 · 추가 리뷰 체크',
        value: '₩24,000',
        tag: '복수 채널',
      },
    ],
    []
  );

  const hasSchedules = schedules.length > 0;

  const hasIncompleteAdditionalDeadlines = (schedule: Schedule) =>
    (schedule.additionalDeadlines || []).some((deadline) => deadline.date && !deadline.completed);

  const isVisitUpcoming = (schedule: Schedule) => {
    if (!schedule.visit) return false;
    if (schedule.visit > today) return true;
    if (schedule.visit < today) return false;
    const visitMinutes = toMinutes(schedule.visitTime, 23 * 60 + 59);
    return visitMinutes >= nowMinutes;
  };

  const isTodoSchedule = (schedule: Schedule) =>
    schedule.status !== '완료' ||
    hasIncompleteAdditionalDeadlines(schedule) ||
    isVisitUpcoming(schedule);

  const isDoneSchedule = (schedule: Schedule) =>
    schedule.status === '완료' &&
    !hasIncompleteAdditionalDeadlines(schedule) &&
    !isVisitUpcoming(schedule);

  const hasTodoSchedules = useMemo(
    () => schedules.some((schedule) => isTodoSchedule(schedule)),
    [schedules]
  );

  const isOverdueSchedule = (schedule: Schedule) => {
    if (schedule.dead && schedule.dead < today && schedule.status !== '완료') return true;
    return (schedule.additionalDeadlines || []).some(
      (deadline) => deadline.date && !deadline.completed && deadline.date < today
    );
  };

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate);
      setShowAllOnSelectedDate(true);
      setViewFilter('TODO');
      setSortOption('VISIT_SOON');
      setCalendarCtaDate(null);
      setIsCalendarCtaOpen(false);
      onFocusDateApplied?.();
    }
  }, [focusDate, onFocusDateApplied]);

  const updateFilterScrollHint = useCallback(() => {
    const container = filterScrollRef.current;
    if (!container) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft <= 1) {
      setShowFilterScrollHint(false);
      return;
    }
    setShowFilterScrollHint(container.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    updateFilterScrollHint();
    const container = filterScrollRef.current;
    if (!container) return;
    const handleScroll = () => updateFilterScrollHint();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    const observer = new ResizeObserver(handleScroll);
    observer.observe(container);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      observer.disconnect();
    };
  }, [updateFilterScrollHint]);

  useEffect(() => {
    const node = contentScrollRef.current;
    if (!node) return;

    const findScrollableParent = (element: HTMLElement) => {
      let current: HTMLElement | null = element;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const hasScroll =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          current.scrollHeight > current.clientHeight;
        if (hasScroll) return current;
        current = current.parentElement;
      }
      const fallback = document.scrollingElement;
      return fallback instanceof HTMLElement ? fallback : element;
    };

    scrollContainerRef.current = findScrollableParent(node);
    const target = scrollContainerRef.current;
    if (!target) return;

    const handleScroll = () => {
      setShowScrollTopButton(target.scrollTop > 240);
      if (!isMobile) {
        setIsFilterSticky(false);
        setFilterStickyStyle(null);
        setFilterStickyHeight(0);
        return;
      }
      const sentinel = filterStickySentinelRef.current;
      const stickyNode = filterStickyRef.current;
      if (!sentinel || !stickyNode) return;
      const containerTop = target.getBoundingClientRect().top;
      const sentinelTop = sentinel.getBoundingClientRect().top;
      const shouldStick = sentinelTop <= containerTop + filterStickyTop;
      setIsFilterSticky((prev) => (prev === shouldStick ? prev : shouldStick));
      const height = stickyNode.getBoundingClientRect().height;
      setFilterStickyHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
      if (shouldStick) {
        const rect = target.getBoundingClientRect();
        setFilterStickyStyle((prev) => {
          if (
            prev &&
            Math.abs(prev.left - rect.left) < 1 &&
            Math.abs(prev.width - rect.width) < 1
          ) {
            return prev;
          }
          return { left: rect.left, width: rect.width };
        });
      }
    };

    handleScroll();
    target.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(target);
    return () => {
      target.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [filterStickyTop, isMobile]);

  // Options
  const platformOptions = useMemo(() => {
    const values = schedules
      .map((schedule) => schedule.platform)
      .filter((platform) => platform && platform.trim().length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const statusOptions = useMemo(() => {
    const values = [...STATUS_OPTION_SEED, ...schedules.map((schedule) => schedule.status)]
      .filter((status) => status && status !== '재확인')
      .map((status) => normalizeStatus(status));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const categoryOptions = useMemo(() => {
    const values = schedules
      .map((schedule) => schedule.category)
      .filter((category) => category && category.length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  // --- Filtering Logic ---
  const isDateFiltered = Boolean(selectedDate && !showAllOnSelectedDate);
  const baseList = isDateFiltered
    ? schedules.filter(
        (schedule) =>
          schedule.dead === selectedDate ||
          schedule.visit === selectedDate ||
          (schedule.additionalDeadlines || []).some((deadline) => deadline.date === selectedDate)
      )
    : schedules;

  const viewBaseList =
    viewFilter === 'TODO'
      ? baseList.filter((schedule) => isTodoSchedule(schedule))
      : baseList.filter((schedule) => isDoneSchedule(schedule));

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSchedules = viewBaseList.filter((schedule) => {
    // 1. 플랫폼
    if (platformFilter !== 'ALL' && schedule.platform !== platformFilter) return false;

    // 2. 페이백
    if (paybackFilter === 'ONLY' && !schedule.paybackExpected) return false;

    // 3. 진행상태
    if (statusFilter === 'OVERDUE') {
      if (!isOverdueSchedule(schedule)) return false;
    } else if (statusFilter === 'HIDE_OVERDUE') {
      if (isOverdueSchedule(schedule)) return false;
    } else if (
      statusFilter !== 'ALL' &&
      normalizeStatus(schedule.status) !== normalizeStatus(statusFilter)
    ) {
      return false;
    }

    // 4. 카테고리
    if (categoryFilter !== 'ALL' && schedule.category !== categoryFilter) return false;

    // 5. 검색
    if (!normalizedQuery) return true;

    const searchTarget = [
      schedule.title,
      schedule.phone,
      schedule.ownerPhone,
      schedule.memo,
      schedule.region,
      schedule.regionDetail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchTarget.includes(normalizedQuery);
  });

  // --- Sorting Logic ---
  const getDeadlineDates = (schedule: Schedule) => {
    const additionalDates = (schedule.additionalDeadlines || [])
      .filter((deadline) => deadline.date && !deadline.completed)
      .map((deadline) => deadline.date);
    return [schedule.dead, ...additionalDates].filter(Boolean) as string[];
  };

  const getNearestDeadline = (schedule: Schedule) => {
    const dates = getDeadlineDates(schedule).sort((a, b) => a.localeCompare(b));
    return dates[0];
  };

  const getLatestDeadline = (schedule: Schedule) => {
    const dates = getDeadlineDates(schedule).sort((a, b) => a.localeCompare(b));
    return dates[dates.length - 1];
  };

  const getVisitKey = (schedule: Schedule) => {
    if (!schedule.visit) return null;
    return {
      date: schedule.visit,
      minutes: toMinutes(schedule.visitTime, 0),
    };
  };

  const displayedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortOption === 'DEADLINE_SOON' || sortOption === 'DEADLINE_LATE') {
      const aKey = sortOption === 'DEADLINE_SOON' ? getNearestDeadline(a) : getLatestDeadline(a);
      const bKey = sortOption === 'DEADLINE_SOON' ? getNearestDeadline(b) : getLatestDeadline(b);
      if (!aKey && !bKey) return a.id - b.id;
      if (!aKey) return 1;
      if (!bKey) return -1;
      const comparison = aKey.localeCompare(bKey);
      if (comparison !== 0) return sortOption === 'DEADLINE_SOON' ? comparison : -comparison;
      return a.id - b.id;
    }

    if (sortOption === 'VISIT_SOON' || sortOption === 'VISIT_LATE') {
      const aVisit = getVisitKey(a);
      const bVisit = getVisitKey(b);
      if (isDateFiltered) {
        const aSelectedVisit = a.visit === selectedDate;
        const bSelectedVisit = b.visit === selectedDate;
        if (aSelectedVisit !== bSelectedVisit) return aSelectedVisit ? -1 : 1;
      }
      if (!aVisit && !bVisit) return a.id - b.id;
      if (!aVisit) return 1;
      if (!bVisit) return -1;
      const dateCompare = aVisit.date.localeCompare(bVisit.date);
      if (dateCompare !== 0) return sortOption === 'VISIT_SOON' ? dateCompare : -dateCompare;
      const timeCompare = aVisit.minutes - bVisit.minutes;
      if (timeCompare !== 0) return sortOption === 'VISIT_SOON' ? timeCompare : -timeCompare;
      return a.id - b.id;
    }

    const aTotal = a.benefit + a.income - a.cost;
    const bTotal = b.benefit + b.income - b.cost;
    if (aTotal === bTotal) return a.id - b.id;
    return sortOption === 'AMOUNT_HIGH' ? bTotal - aTotal : aTotal - bTotal;
  });

  const todoCount = baseList.filter((schedule) => isTodoSchedule(schedule)).length;
  const doneCount = baseList.filter((schedule) => isDoneSchedule(schedule)).length;
  const visitCount = filteredSchedules.filter((schedule) =>
    isDateFiltered ? schedule.visit === selectedDate : schedule.visit
  ).length;

  const deadlineCount = filteredSchedules.reduce((count, schedule) => {
    let c = 0;
    if (isDateFiltered) {
      if (schedule.dead === selectedDate) c++;
      const additionalCount = (schedule.additionalDeadlines || []).filter(
        (deadline) => deadline.date === selectedDate
      ).length;
      return count + c + additionalCount;
    } else {
      if (schedule.dead) c++;
      const additionalCount = (schedule.additionalDeadlines || []).filter(
        (deadline) => deadline.date
      ).length;
      return count + c + additionalCount;
    }
  }, 0);

  const isFilterActive =
    sortOption !== 'DEADLINE_SOON' ||
    platformFilter !== 'ALL' ||
    paybackFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    Boolean(searchQuery.trim());

  const shouldShowFirstScheduleTutorial =
    hasSchedules && schedules.length === 1 && displayedSchedules.length > 0;
  const shouldShowFilterTutorial =
    hasSchedules && schedules.length <= 1 && displayedSchedules.length === 0;

  // --- Helpers ---
  const renderTutorialCard = () => (
    <div className="space-y-5 rounded-3xl border border-neutral-200 bg-gradient-to-b from-[#fff6ed] via-white to-white px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.09)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffecd1] to-[#ffe1cc] text-[#ff6a1f] shadow-inner">
            ✨
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-orange-500">next 튜토리얼</p>
            <p className="text-sm font-bold text-neutral-900">다음 단계를 미리 살펴볼까요?</p>
          </div>
        </div>
      </div>
      <ol className="space-y-3 text-left text-[13px] text-neutral-700">
        <li className="flex items-start gap-3 rounded-2xl border border-dashed border-orange-100 bg-white/80 p-3 shadow-sm">
          <span className="mt-0.5 text-lg font-bold text-orange-500">1</span>
          <div>
            <p className="font-semibold text-neutral-900 mb-1">통계 페이지에서 수익 보기</p>
            <div className="space-y-1 pl-2 border-l-2 border-orange-200">
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                <span className="font-bold text-orange-600">하단 네비게이션 바</span>에서{' '}
                <b className="text-orange-500">"통계"</b>를 누르면 바로 이동할 수 있어요.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );

  const handleDateClick = (dateStr: string, hasSchedule: boolean) => {
    const schedulesForDate = schedules.filter(
      (schedule) =>
        schedule.dead === dateStr ||
        schedule.visit === dateStr ||
        (schedule.additionalDeadlines || []).some((deadline) => deadline.date === dateStr)
    );
    const hasTodoForDate = schedulesForDate.some((schedule) => isTodoSchedule(schedule));
    const hasDoneForDate = schedulesForDate.some((schedule) => isDoneSchedule(schedule));
    const nextFilter = hasTodoForDate ? 'TODO' : hasDoneForDate ? 'DONE' : 'TODO';
    setPlatformFilter('ALL');
    setPaybackFilter('ALL');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSearchQuery('');
    setSearchInput('');
    setSelectedDate(dateStr);
    setShowAllOnSelectedDate(false);
    handleViewFilterChange(nextFilter);
    setSortOption('VISIT_SOON');
    if (hasSchedule) {
      setCalendarCtaDate(null);
      setIsCalendarCtaOpen(false);
    } else {
      setCalendarCtaDate(dateStr);
      setIsCalendarCtaOpen(true);
    }
  };

  const resetFilters = useCallback(() => {
    setSelectedDate(null);
    setShowAllOnSelectedDate(true);
    setViewFilter('TODO');
    setSortOption('DEADLINE_SOON');
    setPlatformFilter('ALL');
    setPaybackFilter('ALL');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSearchQuery('');
    setSearchInput('');
    setCalendarCtaDate(null);
    setIsCalendarCtaOpen(false);
  }, []);

  const scrollToTop = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCalendarDateAdd = (dateStr: string) => {
    onCreateSchedule?.(dateStr);
  };

  const handleGoToToday = () => {
    const schedulesForToday = schedules.filter(
      (schedule) =>
        schedule.dead === today ||
        schedule.visit === today ||
        (schedule.additionalDeadlines || []).some((deadline) => deadline.date === today)
    );
    const hasTodoForToday = schedulesForToday.some((schedule) => isTodoSchedule(schedule));
    const hasDoneForToday = schedulesForToday.some((schedule) => isDoneSchedule(schedule));
    const nextFilter = hasTodoForToday ? 'TODO' : hasDoneForToday ? 'DONE' : 'TODO';
    setSelectedDate(today);
    setShowAllOnSelectedDate(false);
    handleViewFilterChange(nextFilter);
    setSortOption('VISIT_SOON');
    setCalendarCtaDate(null);
    setIsCalendarCtaOpen(false);
  };

  const applySearch = () => {
    setSearchQuery(searchInput.trim());
    searchInputRef.current?.blur();
  };

  const scrollToFilterHeader = useCallback(() => {
    const target = filterHeaderRef.current;
    const container = scrollContainerRef.current;
    if (!target || !container) return;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const stickyHeight = filterStickyRef.current?.getBoundingClientRect().height ?? 0;
    const offset =
      targetTop -
      containerTop +
      container.scrollTop -
      (isMobile ? stickyHeight + filterStickyTop + 8 : filterStickyTop + 8);
    container.scrollTo({ top: offset, behavior: 'smooth' });
  }, [filterStickyTop, isMobile]);

  const getStatusFilterLabel = () => {
    if (statusFilter === 'ALL') return '진행상태';
    if (statusFilter === 'OVERDUE') return '마감초과';
    if (statusFilter === 'HIDE_OVERDUE') return '마감초과 제외';
    return statusFilter;
  };

  const getPaybackFilterLabel = () => {
    if (paybackFilter === 'ONLY') return '페이백 있음';
    return '페이백';
  };

  const handleFeedbackSubmit = async () => {
    const trimmedFeedback = feedbackText.trim();
    if (!trimmedFeedback) {
      toast({ title: '내용을 입력해주세요', variant: 'destructive', duration: 1000 });
      return;
    }
    if (!user) {
      toast({ title: '로그인이 필요합니다.', variant: 'destructive', duration: 1000 });
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('feedback_messages').insert({
        user_id: user.id,
        feedback_type: 'feedback',
        content: trimmedFeedback,
        metadata: { source: 'home_notice_card', email: user.email ?? null },
      });
      if (error) throw error;
      toast({
        title: '피드백을 전송하였습니다.',
        description: '검토 후 빠른 시일 내에 반영하겠습니다.',
        duration: 1500,
      });
      setFeedbackText('');
      setFeedbackSubmitted(true);
    } catch (err) {
      toast({ title: '피드백 전송에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const getPageTitle = () => {
    const statusText = viewFilter === 'TODO' ? '할 일' : '완료';

    if (isDateFiltered) {
      const [_, m, d] = selectedDate.split('-');
      return `${Number(m)}월 ${Number(d)}일 ${statusText}`;
    }

    return statusText;
  };

  const handleViewFilterChange = (filter: ViewFilter) => {
    setViewFilter(filter);
    if (isDateFiltered) {
      setSortOption('VISIT_SOON');
      return;
    }
    if (filter === 'DONE') {
      setSortOption('DEADLINE_LATE');
    } else {
      setSortOption('DEADLINE_SOON');
    }
  };

  const clearSelectedDate = useCallback(() => {
    setSelectedDate(null);
    setShowAllOnSelectedDate(false);
    setCalendarCtaDate(null);
    setIsCalendarCtaOpen(false);
    setSortOption(viewFilter === 'DONE' ? 'DEADLINE_LATE' : 'DEADLINE_SOON');
  }, [viewFilter]);

  const handleShowAllToggle = useCallback(
    (checked: boolean) => {
      setShowAllOnSelectedDate(checked);
      if (checked) {
        setViewFilter('TODO');
        setPlatformFilter('ALL');
        setPaybackFilter('ALL');
        setStatusFilter('ALL');
        setCategoryFilter('ALL');
        setSearchQuery('');
        setSearchInput('');
        setSortOption('DEADLINE_SOON');
        return;
      }
      const schedulesForToday = schedules.filter(
        (schedule) =>
          schedule.dead === today ||
          schedule.visit === today ||
          (schedule.additionalDeadlines || []).some((deadline) => deadline.date === today)
      );
      const hasTodoForToday = schedulesForToday.some((schedule) => isTodoSchedule(schedule));
      const hasDoneForToday = schedulesForToday.some((schedule) => isDoneSchedule(schedule));
      const nextFilter = hasTodoForToday ? 'TODO' : hasDoneForToday ? 'DONE' : 'TODO';
      setSelectedDate(today);
      setViewFilter(nextFilter);
      setPlatformFilter('ALL');
      setPaybackFilter('ALL');
      setStatusFilter('ALL');
      setCategoryFilter('ALL');
      setSearchQuery('');
      setSearchInput('');
      setSortOption('VISIT_SOON');
      setCalendarCtaDate(null);
      setIsCalendarCtaOpen(false);
    },
    [schedules, today, viewFilter]
  );

  useEffect(() => {
    if (!resetSignal) return;
    skipFilterScrollRef.current = true;
    resetFilters();
    scrollToTop();
  }, [resetFilters, resetSignal, scrollToTop]);

  useEffect(() => {
    if (!hasSchedules) return;
    if (!scrollEffectRanRef.current) {
      scrollEffectRanRef.current = true;
      if (hasTodoSchedules) {
        scrollToFilterHeader();
      }
      return;
    }
    if (skipFilterScrollRef.current) {
      skipFilterScrollRef.current = false;
      return;
    }
    scrollToFilterHeader();
  }, [
    categoryFilter,
    hasSchedules,
    paybackFilter,
    platformFilter,
    scrollToFilterHeader,
    searchQuery,
    selectedDate,
    sortOption,
    statusFilter,
    viewFilter,
  ]);

  return (
    <div ref={contentScrollRef} className="flex-1 px-5 pb-24 space-y-3 pt-3 bg-neutral-50/50">
      {/* 3. 캘린더 */}
      <CalendarSection
        schedules={schedules}
        onDateClick={handleDateClick}
        onGoToToday={handleGoToToday}
        selectedDate={selectedDate}
        today={today}
      />

      {/* 일정 추가 버튼 */}
      {selectedDate && !showAllOnSelectedDate && onCreateSchedule && (
        <div className="mt-3 mb-1">
          <button
            type="button"
            onClick={() => onCreateSchedule(selectedDate)}
            className="group mx-auto flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-50/70 hover:border-orange-300 active:scale-[0.99]"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Plus size={12} strokeWidth={3} />
            </span>
            <span>{formatSlashMonthDay(selectedDate)} 일정 추가하기</span>
          </button>
        </div>
      )}

      {/* 6. 검색 + 필터 컨트롤 */}
      <div ref={filterHeaderRef} className="mt-6">
        {/* 헤더 섹션 */}
        <div className="flex items-start justify-between">
          <div className="mb-3">
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-1.5">
              {getPageTitle()}
              <span className="text-neutral-900">{filteredSchedules.length}건</span>
            </h1>
            <p className="mt-1 text-[12px] font-medium text-neutral-500">
              방문 {visitCount}건 · 마감 {deadlineCount}건
            </p>
          </div>
          <div className="flex">
            {isFilterActive && (
              <div className="flex items-center gap-2">
                {!selectedDate && isFilterActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 rounded-full bg-neutral-100 px-3 text-[12px] font-semibold text-neutral-600"
                  >
                    ↺ 초기화
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full px-3 h-8">
              <label
                htmlFor="show-all-todos-toggle"
                className="text-[12px] font-semibold text-neutral-600"
              >
                전체 할일보기
              </label>
              <Switch
                id="show-all-todos-toggle"
                checked={showAllOnSelectedDate}
                onCheckedChange={handleShowAllToggle}
                className="data-[state=checked]:bg-neutral-900"
              />
            </div>
          </div>
        </div>

        <div ref={filterStickySentinelRef} />

        <div
          ref={filterStickyRef}
          className={`z-20 ${isMobile ? (isFilterSticky ? 'fixed' : 'sticky -mx-[20px]') : ''}`}
          style={
            isMobile && isFilterSticky && filterStickyStyle
              ? {
                  top: filterStickyTop,
                  left: filterStickyStyle.left,
                  width: filterStickyStyle.width,
                }
              : isMobile
                ? { top: filterStickyTop }
                : undefined
          }
        >
          <div className="bg-neutral-50/95 px-5 pt-2 backdrop-blur-md">
            {/* 검색창 */}
            {!selectedDate || showAllOnSelectedDate ? (
              <div className="mb-1.5 rounded-[22px] border border-neutral-100 bg-white p-1">
                <div className="h-8 flex items-center gap-2 rounded-[18px] bg-white px-3 py-1.5">
                  <span className="text-[14px] text-neutral-400">🔍</span>
                  <Input
                    type="text"
                    ref={searchInputRef}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if ((event.nativeEvent as KeyboardEvent).isComposing) return;
                        event.preventDefault();
                        applySearch();
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="제목, 연락처, 메모, 위치로 검색"
                    className="border-0 bg-transparent px-0 pt-1 text-[16px] font-medium text-neutral-700 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 placeholder:text-[13px]"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setSearchQuery('');
                      }}
                      className="text-neutral-400 hover:text-neutral-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={applySearch}
                    className="shrink-0 h-6 w-10 rounded-full bg-neutral-700 text-[10px] font-semibold text-white shadow-sm hover:bg-neutral-600"
                  >
                    검색
                  </button>
                </div>
              </div>
            ) : null}

            {/* 필터 행 */}
            <div className="rounded-[22px] border border-neutral-100 bg-white px-3 py-1 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
              <div className="relative">
                <div
                  ref={filterScrollRef}
                  className="flex items-center gap-2 overflow-x-auto py-0.5 pr-6 scrollbar-hide"
                >
                  {/* 1. View Filter 버튼 (할 일 / 완료) - 날짜 선택 시에만 카운트 노출 */}
                  <div className="flex flex-shrink-0 items-center rounded-full bg-neutral-100 p-1 mr-1 h-8">
                    <button
                      onClick={() => handleViewFilterChange('TODO')}
                      className={`rounded-full px-3 h-full flex items-center gap-1.5 text-[12px] font-bold transition-all ${
                        viewFilter === 'TODO'
                          ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      <span>할 일</span>
                      {isDateFiltered && (
                        <span
                          className={`text-[11px] ${viewFilter === 'TODO' ? 'text-orange-600' : 'text-neutral-400'}`}
                        >
                          {todoCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleViewFilterChange('DONE')}
                      className={`rounded-full px-3 h-full flex items-center gap-1.5 text-[12px] font-bold transition-all ${
                        viewFilter === 'DONE'
                          ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      <span>완료</span>
                      {isDateFiltered && (
                        <span
                          className={`text-[11px] ${viewFilter === 'DONE' ? 'text-green-600' : 'text-neutral-400'}`}
                        >
                          {doneCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* 나머지 필터들 */}
                  {!selectedDate || showAllOnSelectedDate ? (
                    <>
                      <Select
                        value={sortOption}
                        onValueChange={(value) => setSortOption(value as SortOption)}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-fit gap-2 rounded-full border-neutral-200 bg-white px-3 text-[12px] font-semibold text-neutral-700 shadow-sm focus:ring-0"
                        >
                          <SelectValue placeholder="정렬" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                          <div className="px-3 py-2 text-[11px] font-bold text-neutral-400">
                            정렬 기준
                          </div>
                          <SelectItem
                            value="DEADLINE_SOON"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            마감 임박순
                          </SelectItem>
                          <SelectItem
                            value="DEADLINE_LATE"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            마감 최신순
                          </SelectItem>
                          <SelectItem
                            value="VISIT_SOON"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            방문 임박순
                          </SelectItem>
                          <SelectItem
                            value="VISIT_LATE"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            방문 최신순
                          </SelectItem>
                          <div className="my-1 h-[1px] bg-neutral-100" />
                          <SelectItem
                            value="AMOUNT_HIGH"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            금액 높은순
                          </SelectItem>
                          <SelectItem
                            value="AMOUNT_LOW"
                            className="rounded-xl text-[13px] font-medium"
                          >
                            금액 낮은순
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger
                          size="sm"
                          className={`h-7 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
                            platformFilter !== 'ALL'
                              ? 'border-orange-200 bg-orange-50 text-orange-800'
                              : 'border-neutral-200 bg-white text-neutral-700'
                          }`}
                        >
                          <span>
                            {platformFilter === 'ALL'
                              ? '플랫폼'
                              : getPlatformDisplayName(platformFilter)}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                          <div className="px-3 py-2 text-[11px] font-bold text-neutral-400">
                            플랫폼 선택
                          </div>
                          <SelectItem value="ALL" className="rounded-xl text-[13px] font-medium">
                            전체 보기
                          </SelectItem>
                          {platformOptions.map((platform) => (
                            <SelectItem
                              key={platform}
                              value={platform}
                              className="rounded-xl text-[13px] font-medium"
                            >
                              {getPlatformDisplayName(platform)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {viewFilter !== 'DONE' && (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger
                            size="sm"
                            className={`h-7 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
                              statusFilter !== 'ALL'
                                ? 'border-orange-200 bg-orange-50 text-orange-800'
                                : 'border-neutral-200 bg-white text-neutral-700'
                            }`}
                          >
                            <span>{getStatusFilterLabel()}</span>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                            <div className="px-3 py-2 text-[11px] font-bold text-neutral-400">
                              진행상태 선택
                            </div>
                            <SelectItem value="ALL" className="rounded-xl text-[13px] font-medium">
                              전체 보기
                            </SelectItem>
                            <div className="my-1 h-[1px] bg-neutral-100" />
                            {statusOptions.map((status) => (
                              <SelectItem
                                key={status}
                                value={status}
                                className="rounded-xl text-[13px] font-medium"
                              >
                                {status}
                              </SelectItem>
                            ))}
                            <div className="my-1 h-[1px] bg-neutral-100" />
                            <SelectItem
                              value="OVERDUE"
                              className="rounded-xl text-[13px] font-medium text-orange-600"
                            >
                              🔥 마감초과만 보기
                            </SelectItem>
                            <SelectItem
                              value="HIDE_OVERDUE"
                              className="rounded-xl text-[13px] font-medium text-neutral-500"
                            >
                              🚫 마감초과 안보기
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger
                          size="sm"
                          className={`h-7 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
                            categoryFilter !== 'ALL'
                              ? 'border-orange-200 bg-orange-50 text-orange-800'
                              : 'border-neutral-200 bg-white text-neutral-700'
                          }`}
                        >
                          <span>{categoryFilter === 'ALL' ? '카테고리' : categoryFilter}</span>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                          <div className="px-3 py-2 text-[11px] font-bold text-neutral-400">
                            카테고리 선택
                          </div>
                          <SelectItem value="ALL" className="rounded-xl text-[13px] font-medium">
                            전체 보기
                          </SelectItem>
                          {categoryOptions.map((category) => (
                            <SelectItem
                              key={category}
                              value={category}
                              className="rounded-xl text-[13px] font-medium"
                            >
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={paybackFilter}
                        onValueChange={(val) => setPaybackFilter(val as any)}
                      >
                        <SelectTrigger
                          size="sm"
                          className={`h-7 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
                            paybackFilter !== 'ALL'
                              ? 'border-orange-200 bg-orange-50 text-orange-800'
                              : 'border-neutral-200 bg-white text-neutral-700'
                          }`}
                        >
                          <span>{getPaybackFilterLabel()}</span>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                          <div className="px-3 py-2 text-[11px] font-bold text-neutral-400">
                            페이백 여부
                          </div>
                          <SelectItem value="ALL" className="rounded-xl text-[13px] font-medium">
                            전체 보기
                          </SelectItem>
                          <SelectItem
                            value="ONLY"
                            className="rounded-xl text-[13px] font-medium text-orange-600"
                          >
                            💰 페이백 있는 건만
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : null}
                </div>
                {showFilterScrollHint && (
                  <>
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white via-white/80 to-transparent" />
                    <button
                      type="button"
                      onClick={() => {
                        const container = filterScrollRef.current;
                        if (!container) return;
                        const amount = Math.max(container.clientWidth * 0.6, 160);
                        container.scrollBy({ left: amount, behavior: 'smooth' });
                      }}
                      className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-[10px] font-bold text-neutral-500 shadow-sm"
                      aria-label="필터 더보기"
                    >
                      {'>'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{ height: isMobile && isFilterSticky ? filterStickyHeight : 0 }}
      />

      {/* 6. 일정 리스트 아이템 */}
      <div className="space-y-3">
        {!hasSchedules ? (
          <div className="bg-white rounded-3xl p-4 text-center shadow-sm shadow-[0_18px_40px_rgba(15,23,42,0.06)] border border-neutral-100 space-y-4">
            {/* ... Empty State ... */}
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-neutral-900">아직 체험단 일정이 없어요</p>
              <p className="text-[11px] text-neutral-500 font-medium">
                체험단을 등록하면 캘린더와 수익 리포트가 자동으로 채워져요
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  posthog?.capture('home_empty_add_clicked', {
                    context: selectedDate ? 'date' : 'list',
                  });
                  onAddClick?.();
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#ff6a1f] text-white text-[13px] font-bold shadow-sm active:scale-[0.98] w-full sm:w-auto"
              >
                체험단 등록하기
              </button>
              {/* ... Demo Button ... */}
            </div>
          </div>
        ) : displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={
                onCompleteClick
                  ? () => {
                      onCompleteClick(schedule.id);
                      showScheduleCompleteToast();
                    }
                  : undefined
              }
              onCompletedClick={
                onCompletedClick
                  ? () => {
                      onCompletedClick(schedule.id);
                      showCompletedEditToast();
                    }
                  : undefined
              }
              onPaybackConfirm={
                onPaybackConfirm
                  ? () => {
                      onPaybackConfirm(schedule.id);
                      showPaybackToast(Boolean(schedule.paybackConfirmed));
                    }
                  : undefined
              }
              onAdditionalDeadlineToggle={
                onAdditionalDeadlineToggle
                  ? (deadlineId) => {
                      const deadline = schedule.additionalDeadlines?.find(
                        (item) => item.id === deadlineId
                      );
                      onAdditionalDeadlineToggle(schedule.id, deadlineId);
                      showAdditionalDeadlineToast(Boolean(deadline?.completed));
                    }
                  : undefined
              }
              today={today}
              selectedDate={showAllOnSelectedDate ? null : selectedDate}
            />
          ))
        ) : shouldShowFilterTutorial ? (
          renderTutorialCard()
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500">
            선택한 날짜/필터에 맞는 일정이 없어요.
          </div>
        )}
        {shouldShowFirstScheduleTutorial && renderTutorialCard()}
      </div>

      <Drawer
        open={isCalendarCtaOpen}
        onOpenChange={(open) => {
          setIsCalendarCtaOpen(open);
          if (!open) {
            setCalendarCtaDate(null);
          }
        }}
      >
        <DrawerContent className="rounded-t-[28px] border-t border-neutral-200 bg-white px-6 pb-6 pt-3 shadow-[0_-18px_40px_rgba(15,23,42,0.12)]">
          <DrawerHeader className="items-center text-center">
            <DrawerTitle className="text-[18px] font-bold text-neutral-900">
              {calendarCtaDate ? `${formatKoreanMonthDay(calendarCtaDate)} 일정` : '일정'}
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-[13px] font-medium text-neutral-500">
              {calendarCtaDate
                ? `${formatKoreanMonthDay(calendarCtaDate)}에 등록된 일정이 없어요.`
                : '등록된 일정이 없어요.'}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pt-3">
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[#FF6A1F] text-[14px] font-bold text-white shadow-[0_14px_34px_rgba(255,106,31,0.35)] hover:bg-[#F25D12]"
              onClick={() => {
                if (calendarCtaDate) {
                  handleCalendarDateAdd(calendarCtaDate);
                }
                setIsCalendarCtaOpen(false);
              }}
            >
              등록하기
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {showScrollTopButton && (
        <button
          type="button"
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-5 md:right-[calc(50%-380px)] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-[0_12px_30px_rgba(15,23,42,0.15)] transition hover:scale-[1.02] hover:bg-neutral-50 animate-float-bob"
          aria-label="위로 이동"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

// 캘린더 섹션 (CalendarSection 컴포넌트는 변경 없음 - 그대로 사용)
function CalendarSection({
  schedules,
  onDateClick,
  onGoToToday,
  selectedDate,
  today,
}: {
  schedules: Schedule[];
  onDateClick: (dateStr: string, hasSchedule: boolean) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  today: string;
}) {
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const [currentDate, setCurrentDate] = useState(() => parseDateString(today));
  const todayDate = parseDateString(today);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const scheduleByDate = schedules.reduce<
    Record<
      string,
      {
        deadlineCount: number;
        visitCount: number;
        hasDeadline: boolean;
        hasVisit: boolean;
        overdue: boolean;
        hasCompleted: boolean;
        ringStatusColors: string[];
        hasPaybackPending: boolean;
      }
    >
  >((acc, schedule) => {
    // ... (Calendar Logic - 이전과 동일)
    const ensureDayInfo = (key: string) => {
      if (!acc[key]) {
        acc[key] = {
          deadlineCount: 0,
          visitCount: 0,
          hasDeadline: false,
          hasVisit: false,
          overdue: false,
          hasCompleted: false,
          ringStatusColors: [],
          hasPaybackPending: false,
        };
      }
      return acc[key];
    };

    const isCompleted = schedule.status === '완료';
    const statusColor = isCompleted ? undefined : getScheduleRingColor(schedule.status);

    if (schedule.dead) {
      const info = ensureDayInfo(schedule.dead);
      if (isCompleted) {
        info.hasCompleted = true;
      } else {
        info.hasDeadline = true;
        if (schedule.dead < today) {
          info.deadlineCount += 1;
          info.overdue = true;
        } else {
          info.deadlineCount += 1;
        }
      }
      if (statusColor) {
        info.ringStatusColors.push(statusColor);
      }
      if (schedule.paybackExpected && !schedule.paybackConfirmed) {
        info.hasPaybackPending = true;
      }
    }

    if (schedule.additionalDeadlines && schedule.additionalDeadlines.length > 0) {
      schedule.additionalDeadlines.forEach((deadline) => {
        if (deadline.date) {
          const info = ensureDayInfo(deadline.date);
          if (!deadline.completed) {
            info.hasDeadline = true;
            if (deadline.date < today) {
              info.deadlineCount += 1;
              info.overdue = true;
            } else {
              info.deadlineCount += 1;
            }
            if (statusColor) {
              info.ringStatusColors.push(statusColor);
            }
          } else {
            info.hasCompleted = true;
          }
        }
      });
    }

    if (schedule.visit) {
      const info = ensureDayInfo(schedule.visit);
      info.hasVisit = true;
      info.visitCount += 1;
      if (isCompleted && !schedule.dead) {
        info.hasCompleted = true;
      }
    }

    return acc;
  }, {});

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    onGoToToday();
  };

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  const isToday = (day: number) =>
    todayDate.getDate() === day &&
    todayDate.getMonth() === month &&
    todayDate.getFullYear() === year;

  return (
    <div className="rounded-[24px] p-4 shadow-sm bg-gradient-to-b from-white to-neutral-100 mt-2">
      <div className="relative flex items-center justify-center mb-3 gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-[16px] font-bold text-neutral-900">
            {year}년 <span className="text-orange-600">{month + 1}월</span>
          </div>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-2.5 font-semibold">
        {weekDays.map((day, idx) => (
          <div key={day} className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-3 text-center">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayOfWeek = (startDayOfWeek + day - 1) % 7;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDate === dateStr;
          const dayInfo = scheduleByDate[dateStr];
          const hasSchedule =
            !!dayInfo &&
            (dayInfo.deadlineCount > 0 || dayInfo.visitCount > 0 || dayInfo.hasCompleted);
          const isTodayDate = isToday(day);
          const indicatorType = dayInfo?.overdue
            ? 'overdue'
            : dayInfo?.hasDeadline
              ? 'deadline'
              : dayInfo?.hasCompleted
                ? 'completedOnly'
                : 'none';
          const ringColors = dayInfo?.ringStatusColors ?? [];
          const ringGradientStops =
            ringColors.length > 0
              ? ringColors
                  .map((color, idx) => {
                    const start = (idx / ringColors.length) * 100;
                    const end = ((idx + 1) / ringColors.length) * 100;
                    return `${color} ${start}% ${end}%`;
                  })
                  .join(', ')
              : '';
          const ringGradientStyle =
            ringColors.length > 0
              ? {
                  backgroundImage: `conic-gradient(${ringGradientStops})`,
                  WebkitMaskImage:
                    'radial-gradient(circle, transparent 58%, black 60%, black 72%, transparent 72%)',
                  maskImage:
                    'radial-gradient(circle, transparent 58%, black 60%, black 72%, transparent 72%)',
                }
              : undefined;
          const baseStyle =
            indicatorType === 'overdue'
              ? 'text-orange-800 shadow-[inset_0_0_0_2.5px_rgba(249,115,22,0.65)]'
              : indicatorType === 'deadline'
                ? 'text-orange-700 shadow-[inset_0_0_0_2.5px_rgba(249,115,22,0.6)]'
                : 'text-neutral-800';
          const hoverable = !isSelected && !isTodayDate;
          const todayHighlightClass = isTodayDate ? 'bg-orange-300 text-orange-900' : '';
          const selectedHighlightClass = isSelected ? 'bg-orange-100 text-orange-900' : '';
          const isInteractive = true;
          const showPaybackEmoji = Boolean(dayInfo?.hasPaybackPending);
          const handleDayClick = () => {
            onDateClick(dateStr, hasSchedule);
          };

          return (
            <button
              key={day}
              onClick={handleDayClick}
              className={`relative h-8 w-8 mx-auto flex flex-col items-center justify-center text-[11px] font-semibold rounded-full transition-colors ${
                isInteractive ? 'cursor-pointer' : 'cursor-default'
              } ${baseStyle}
            ${!isSelected && todayHighlightClass}
            ${selectedHighlightClass}
            ${hoverable ? 'hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]' : ''}
            ${!isSelected && !isToday(day) && dayOfWeek === 0 ? 'text-red-500' : ''}
            ${!isSelected && !isToday(day) && dayOfWeek === 6 ? 'text-blue-500' : ''}`}
            >
              {ringGradientStyle && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={ringGradientStyle}
                />
              )}
              {showPaybackEmoji && (
                <span className="pointer-events-none absolute -top-[2px] -right-[2px] text-[10px]">
                  💸
                </span>
              )}
              <span className="leading-none text-current">{day}</span>
              {hasSchedule && dayInfo?.hasDeadline && (
                <>
                  <span
                    className={`absolute bottom-[1.5px] -right-1 flex text-[9px] items-center justify-center rounded-full px-1 py-1 text-[9px] font-extrabold leading-none ${
                      dayInfo.deadlineCount > 0
                        ? 'shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-white text-orange-600'
                        : 'shadow-none bg-transparent text-orange-600'
                    }`}
                  >
                    {dayInfo.deadlineCount > 0 ? dayInfo.deadlineCount : ''}
                  </span>
                  {indicatorType === 'overdue' ? (
                    <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] text-[10px]">
                      🔥
                    </span>
                  ) : null}
                </>
              )}
              {hasSchedule && dayInfo?.hasVisit && (
                <>
                  <span
                    className={`absolute ${dayInfo?.overdue ? '-top-0.5 -left-1.5' : '-bottom-1 -left-1'} flex h-4 min-w-[16px] items-center justify-center gap-0.1 rounded-full pl-0.5 pr-1 text-[9px] font-extrabold leading-none shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-sky-50 text-sky-700`}
                  >
                    📍
                    <span className="text-[8.5px]">
                      {dayInfo.visitCount > 1 ? dayInfo.visitCount : ''}
                    </span>
                  </span>
                </>
              )}
              {hasSchedule && dayInfo?.hasCompleted && !dayInfo?.hasDeadline && (
                <span className="absolute bottom-[3px] -right-[-1px] h-[7px] w-[7px] rounded-full bg-orange-400 shadow-[0_4px_10px_rgba(0,0,0,0.12)]" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
          {CALENDAR_STATUS_LEGEND.map((item) => (
            <div key={item.status} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full border border-neutral-200"
                style={{ backgroundColor: `${item.color}` }}
              />
              <span className="font-semibold text-neutral-700">{item.label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={goToToday}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-4 text-[11.5px] font-semibold text-neutral-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-neutral-200"
        >
          <CalendarDays className="h-4 w-4" />
          오늘로 이동
        </button>
      </div>
    </div>
  );
}
