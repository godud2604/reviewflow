'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { X } from 'lucide-react';

import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { parseDateString } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type ViewFilter = 'TODO' | 'DONE';
type SortOption =
  | 'DEADLINE_SOON'
  | 'DEADLINE_LATE'
  | 'VISIT_SOON'
  | 'VISIT_LATE'
  | 'AMOUNT_HIGH'
  | 'AMOUNT_LOW';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

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

  const isOverdueSchedule = (schedule: Schedule) => {
    if (schedule.dead && schedule.dead < today && schedule.status !== '완료') return true;
    return (schedule.additionalDeadlines || []).some(
      (deadline) => deadline.date && !deadline.completed && deadline.date < today
    );
  };

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate);
      setViewFilter('TODO');
      onFocusDateApplied?.();
    }
  }, [focusDate, onFocusDateApplied]);

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
  const baseList = selectedDate
    ? schedules.filter(
        (schedule) =>
          schedule.dead === selectedDate ||
          schedule.visit === selectedDate ||
          (schedule.additionalDeadlines || []).some((deadline) => deadline.date === selectedDate)
      )
    : schedules;

  const viewBaseList = selectedDate
    ? baseList
    : viewFilter === 'TODO'
      ? baseList.filter((schedule) => isTodoSchedule(schedule))
      : baseList.filter((schedule) => isDoneSchedule(schedule));

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSchedules = selectedDate
    ? viewBaseList
    : viewBaseList.filter((schedule) => {
        // 1. 플랫폼
        if (platformFilter !== 'ALL' && schedule.platform !== platformFilter) return false;

        // 2. 페이백
        if (paybackFilter === 'ONLY' && !schedule.paybackExpected) return false;

        // 3. 진행상태 (마감초과 포함)
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
    if (selectedDate) {
      const aIncomplete = !isDoneSchedule(a);
      const bIncomplete = !isDoneSchedule(b);
      if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;

      if (aIncomplete && bIncomplete) {
        const aVisit = getVisitKey(a);
        const bVisit = getVisitKey(b);
        if (!aVisit && !bVisit) return a.id - b.id;
        if (!aVisit) return 1;
        if (!bVisit) return -1;
        const dateCompare = aVisit.date.localeCompare(bVisit.date);
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = aVisit.minutes - bVisit.minutes;
        if (timeCompare !== 0) return timeCompare;
      }

      return a.id - b.id;
    }

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
  const visitCount = selectedDate
    ? filteredSchedules.filter((schedule) => schedule.visit === selectedDate).length
    : filteredSchedules.filter((schedule) => schedule.visit).length;

  const deadlineCount = selectedDate
    ? filteredSchedules.reduce((count, schedule) => {
        let c = 0;
        if (schedule.dead === selectedDate) c++;
        const additionalCount = (schedule.additionalDeadlines || []).filter(
          (deadline) => deadline.date === selectedDate
        ).length;
        return count + c + additionalCount;
      }, 0)
    : filteredSchedules.reduce((count, schedule) => {
        let c = 0;
        if (schedule.dead) c++;
        const additionalCount = (schedule.additionalDeadlines || []).filter(
          (deadline) => deadline.date
        ).length;
        return count + c + additionalCount;
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
      {/* ... Tutorial content ... */}
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

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setViewFilter('TODO');
  };

  const resetFilters = () => {
    setSelectedDate(null);
    setViewFilter('TODO');
    setSortOption('DEADLINE_SOON');
    setPlatformFilter('ALL');
    setPaybackFilter('ALL');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSearchQuery('');
    setSearchInput('');
  };

  const handleCalendarDateAdd = (dateStr: string) => {
    handleDateClick(dateStr);
    onCreateSchedule?.(dateStr);
  };

  const handleGoToToday = () => {
    setSelectedDate(today);
    setViewFilter('TODO');
  };

  const applySearch = () => {
    setSearchQuery(searchInput.trim());
  };

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

  const featureDescriptions = [
    '검색창에서 제목, 연락처, 메모, 위치까지 한 번에 찾을 수 있어요.',
    '마감초과 필터로 급한 일정만 빠르게 모아볼 수 있어요.',
    '카테고리·플랫폼·페이백 필터를 조합해서 원하는 일정만 남겨요.',
  ];

  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    setFeedbackSubmitted(true);
  };

  // 5. 타이틀 생성 로직 (수정됨)
  const getPageTitle = () => {
    const statusText = viewFilter === 'TODO' ? '할 일' : '완료';

    if (selectedDate) {
      // YYYY-MM-DD -> M월 D일
      const [_, m, d] = selectedDate.split('-');
      return `${Number(m)}월 ${Number(d)}일 ${statusText}`;
    }

    return statusText;
  };

  // 1. 뷰 필터 변경 핸들러 (수정됨: 완료 시 정렬 변경)
  const handleViewFilterChange = (filter: ViewFilter) => {
    setViewFilter(filter);
    if (filter === 'DONE') {
      // 완료 탭 -> 마감 최신순 디폴트
      setSortOption('DEADLINE_LATE');
    } else {
      // 할 일 탭 -> 마감 임박순 디폴트 (복귀 시 리셋이 필요하다면)
      setSortOption('DEADLINE_SOON');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3 pt-3 bg-neutral-50/50">
      {/* 3. 캘린더 */}
      <CalendarSection
        schedules={schedules}
        onDateClick={handleDateClick}
        onCreateSchedule={handleCalendarDateAdd}
        onGoToToday={handleGoToToday}
        selectedDate={selectedDate}
        today={today}
      />

      {/* 5. 공지 카드 */}
      <div className="mt-6 space-y-4">
        <div className="rounded-[28px] bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-900 px-5 py-4 text-white shadow-[0_18px_60px_rgba(15,23,42,0.45)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-blue-500/20 px-2 py-1 text-[11px] font-semibold text-blue-200">
                공지
              </span>
              <div>
                <p className="text-[15px] font-semibold">검색·필터가 더 똑똑해졌어요</p>
                <p className="mt-1 text-[12px] text-neutral-300">
                  이번에 추가된 기능을 확인하고 의견을 남겨주세요
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNoticeOpen((prev) => !prev)}
              className="h-8 rounded-full border border-white/10 bg-white/10 px-3 text-[12px] font-semibold text-white hover:bg-white/20"
            >
              {isNoticeOpen ? '닫기' : '보기'}
            </button>
          </div>
          {isNoticeOpen && (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-blue-200">기능 설명</p>
                <ul className="mt-2 space-y-2 text-[12px] text-neutral-200">
                  {featureDescriptions.map((desc) => (
                    <li key={desc} className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-300">•</span>
                      <span>{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-[12px] font-semibold text-blue-200">피드백 제출하기</p>
                  <p className="mt-1 text-[11px] text-neutral-300">
                    개선에 도움이 될 의견을 한 글자도 놓치지 않고 읽을게요.
                  </p>
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(event) => {
                    setFeedbackText(event.target.value);
                    if (feedbackSubmitted) setFeedbackSubmitted(false);
                  }}
                  placeholder="입력하기"
                  className="min-h-[90px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  className="w-full rounded-2xl bg-[#3b82f6] py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] hover:bg-[#2563eb]"
                >
                  제출하기
                </button>
                {feedbackSubmitted && (
                  <p className="text-[11px] font-medium text-blue-200">
                    의견이 접수되었어요. 고마워요!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. 검색 + 필터 컨트롤 */}
      <div className="mt-6">
        {/* 헤더 섹션 */}
        <div className="flex items-start justify-between">
          <div>
            {/* 5. 타이틀 (수정됨) */}
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-1.5">
              {getPageTitle()}
              <span className="text-neutral-900">{filteredSchedules.length}건</span>
            </h1>
            <p className="mt-1 text-[12px] font-medium text-neutral-500">
              방문 {visitCount}건 · 마감 {deadlineCount}건
            </p>
          </div>
          {!selectedDate && (
            <div className="flex items-center gap-2">
              {isFilterActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 rounded-full px-2 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  ↺ 초기화
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 검색창 */}
        {!selectedDate && (
          <div className="mt-3 mb-1 rounded-[22px] border border-neutral-200 bg-white p-1">
            <div className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-1.5">
              <span className="text-[14px] text-neutral-400">🔍</span>
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applySearch();
                  }
                }}
                placeholder="제목, 연락처, 메모, 위치로 검색"
                className="h-6 border-0 bg-transparent p-0 text-[16px] font-medium text-neutral-700 shadow-none placeholder:text-neutral-400 focus-visible:ring-0"
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
                className="shrink-0 h-6 w-10 rounded-full bg-neutral-900 text-[10px] font-semibold text-white shadow-sm hover:bg-neutral-800"
              >
                검색
              </button>
            </div>
          </div>
        )}

        {/* 필터 행 */}
        <div className="sticky top-0 z-20 -mx-5 bg-neutral-50/95 px-5 py-1.5 backdrop-blur-md">
          <div className="rounded-[22px] border border-neutral-200 bg-white px-3 py-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {!selectedDate && (
                <div className="flex flex-shrink-0 items-center rounded-full bg-neutral-200/60 p-0.5 mr-1 h-8">
                  {/* 1. View Filter 버튼 (클릭 시 정렬 로직 적용) */}
                  <button
                    onClick={() => handleViewFilterChange('TODO')}
                    className={`rounded-full px-3 h-full flex items-center text-[12px] font-bold transition-all ${
                      viewFilter === 'TODO'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    할 일
                  </button>
                  <button
                    onClick={() => handleViewFilterChange('DONE')}
                    className={`rounded-full px-3 h-full flex items-center text-[12px] font-bold transition-all ${
                      viewFilter === 'DONE'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    완료
                  </button>
                </div>
              )}

              {selectedDate ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(null)}
                  className="h-8 rounded-full border-neutral-200 text-[12px] font-semibold text-neutral-600"
                >
                  ← 전체 목록 보기
                </Button>
              ) : (
                <>
                  {/* 정렬 필터 */}
                  <Select
                    value={sortOption}
                    onValueChange={(value) => setSortOption(value as SortOption)}
                  >
                    <SelectTrigger className="h-8 w-fit gap-2 rounded-full border-neutral-200 bg-white px-3 text-[12px] font-semibold text-neutral-700 shadow-sm focus:ring-0">
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
                      <SelectItem value="VISIT_SOON" className="rounded-xl text-[13px] font-medium">
                        방문 임박순
                      </SelectItem>
                      <SelectItem value="VISIT_LATE" className="rounded-xl text-[13px] font-medium">
                        방문 최신순
                      </SelectItem>
                      <div className="my-1 h-[1px] bg-neutral-100" />
                      <SelectItem
                        value="AMOUNT_HIGH"
                        className="rounded-xl text-[13px] font-medium"
                      >
                        금액 높은순
                      </SelectItem>
                      <SelectItem value="AMOUNT_LOW" className="rounded-xl text-[13px] font-medium">
                        금액 낮은순
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 플랫폼 필터 */}
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger
                      className={`h-8 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
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

                  {/* 4. 진행상태 필터 (완료 탭에서는 숨김) & 3. 마감초과 아래로 이동 */}
                  {viewFilter !== 'DONE' && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger
                        className={`h-8 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
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

                        {/* 기본 상태 옵션들 */}
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
                        {/* 마감초과 관련 (맨 아래로 이동) */}
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

                  {/* 카테고리 필터 */}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger
                      className={`h-8 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
                        categoryFilter !== 'ALL'
                          ? 'border-orange-200 bg-orange-50 text-orange-800'
                          : 'border-neutral-200 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{categoryFilter === 'ALL' ? '카테고리' : categoryFilter}</span>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-neutral-100 bg-white p-1 shadow-xl">
                      {/* 2. 카테고리 선택 타이틀 추가 */}
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

                  {/* 2. 페이백 필터 (카테고리 오른쪽 = 제일 오른쪽으로 이동) */}
                  <Select
                    value={paybackFilter}
                    onValueChange={(val) => setPaybackFilter(val as any)}
                  >
                    <SelectTrigger
                      className={`h-8 w-fit gap-2 rounded-full border px-3 text-[12px] font-semibold shadow-sm focus:ring-0 ${
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. 일정 리스트 아이템 (기존 로직 유지) */}
      <div className="space-y-3">
        {!hasSchedules ? (
          <div className="bg-white rounded-3xl p-4 text-center shadow-sm shadow-[0_18px_40px_rgba(15,23,42,0.06)] border border-neutral-100 space-y-4">
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
              <button
                type="button"
                onClick={() => {
                  const nextShowDemo = !showDemo;
                  setShowDemo(nextShowDemo);
                  posthog?.capture('home_empty_demo_toggled', { open: nextShowDemo });
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-neutral-50 text-neutral-700 text-[13px] font-semibold border border-neutral-200 w-full sm:w-auto"
              >
                데모 일정 살펴보기
              </button>
            </div>
            {showDemo && (
              <div className="mt-2 space-y-3 text-left">
                <div className="text-[11px] font-bold text-neutral-500 uppercase">샘플 일정</div>
                <div className="space-y-2">
                  {demoSchedules.map((demo) => (
                    <div
                      key={demo.title}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2.5 bg-neutral-50/70"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[13px] font-bold text-neutral-900">{demo.title}</div>
                        <div className="text-[11px] text-neutral-500 font-semibold">
                          {demo.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-[#f97316]">{demo.value}</div>
                        <div className="text-[11px] text-neutral-500">{demo.tag}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
              onCompletedClick={onCompletedClick ? () => onCompletedClick(schedule.id) : undefined}
              onPaybackConfirm={onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined}
              onAdditionalDeadlineToggle={
                onAdditionalDeadlineToggle
                  ? (deadlineId) => onAdditionalDeadlineToggle(schedule.id, deadlineId)
                  : undefined
              }
              today={today}
              selectedDate={selectedDate}
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
    </div>
  );
}

// --- 캘린더 컴포넌트 ---
function CalendarSection({
  schedules,
  onDateClick,
  onGoToToday,
  selectedDate,
  today,
  onCreateSchedule,
}: {
  schedules: Schedule[];
  onDateClick: (dateStr: string) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  today: string;
  onCreateSchedule?: (dateStr: string) => void;
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
        <button
          onClick={goToToday}
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[12px] font-semibold text-neutral-900 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          오늘로 이동
        </button>
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
          const hoverable = !isSelected && !isTodayDate && hasSchedule;
          const todayHighlightClass = isTodayDate ? 'bg-orange-300 text-orange-900' : '';
          const selectedHighlightClass = isSelected ? 'bg-orange-100 text-orange-900' : '';
          const isInteractive = hasSchedule || Boolean(onCreateSchedule);
          const wasAlreadySelected = selectedDate === dateStr;
          const showPaybackEmoji = Boolean(dayInfo?.hasPaybackPending);
          const handleDayClick = (event: React.MouseEvent<HTMLButtonElement>) => {
            onDateClick(dateStr);
            const isClickInitiated = event.detail === 1;
            const shouldReopenModal = wasAlreadySelected;
            if (!hasSchedule && (isClickInitiated || shouldReopenModal)) {
              onCreateSchedule?.(dateStr);
            }
            if (hasSchedule && shouldReopenModal) {
              onCreateSchedule?.(dateStr);
            }
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
      <div className="mt-4.5 flex flex-wrap items-center justify-end gap-3 text-[11px] text-neutral-600">
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
    </div>
  );
}
