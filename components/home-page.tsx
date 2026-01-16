'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';
import { ArrowUp, Check, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { formatDateStringKST } from '@/lib/date-utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Input } from '@/components/ui/input';
import {
  Command as UICommand,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { CalendarSection } from '@/components/home/calendar-section';
import { FilterBadge, FilterCheckboxItem } from '@/components/home/filter-components';
import { AVAILABLE_STATUSES, AVAILABLE_CATEGORIES } from '@/components/home/constants';

const Command = UICommand;

// --- 메인 페이지 ---
export default function HomePage({
  schedules,
  calendarSchedules,
  calendarMarkerSchedules,
  onScheduleClick,
  onShowAllClick,
  onCompleteClick,
  onCompletedClick,
  onPaybackConfirm,
  onAdditionalDeadlineToggle,
  onAddClick,
  onCreateSchedule,
  focusDate,
  onFocusDateApplied,
  loading,
  hasMore,
  onLoadMore,
  totalCount,
  overallCount,
  visitCount: propVisitCount,
  deadlineCount: propDeadlineCount,
  onFilterChange,
  onCalendarMonthChange,
  calendarLoading = false, // Add calendarLoading prop with default (optional)
  availablePlatforms = [], // New prop for platforms
}: {
  schedules: Schedule[];
  calendarSchedules?: Schedule[];
  calendarMarkerSchedules?: Schedule[];
  onScheduleClick: (id: number) => void;
  onShowAllClick: () => void;
  onCompleteClick?: (id: number) => void;
  onCompletedClick?: (id: number) => void;
  onPaybackConfirm?: (id: number) => void;
  onAdditionalDeadlineToggle?: (scheduleId: number, deadlineId: string) => void;
  onAddClick?: () => void;
  onCreateSchedule?: (dateStr: string) => void;
  focusDate?: string | null;
  onFocusDateApplied?: () => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  overallCount?: number;
  visitCount?: number;
  deadlineCount?: number;
  onFilterChange?: (filters: {
    selectedDate?: string | null;
    platforms?: string[];
    statuses?: string[];
    categories?: string[];
    reviewTypes?: string[];
    search?: string;
    sortBy?: string;
    paybackOnly?: boolean;
    completedOnly?: boolean;
  }) => void;
  onCalendarMonthChange?: (date: Date) => void;
  calendarLoading?: boolean; // Type definition for calendarLoading
  availablePlatforms?: string[];
}) {
  const posthog = usePostHog();
  const { categories: userCategories } = useUserProfile(); // platforms removed
  const today = formatDateStringKST(new Date());

  // 날짜 및 기본 필터
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 필터 상태
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedReviewTypes, setSelectedReviewTypes] = useState<string[]>([]);
  const [paybackOnly, setPaybackOnly] = useState(false);
  const [completedOnly, setCompletedOnly] = useState(false);

  // 정렬 상태
  const [sortBy, setSortBy] = useState<
    | 'deadline-asc'
    | 'deadline-desc'
    | 'visit-asc'
    | 'visit-desc'
    | 'amount-asc'
    | 'amount-desc'
    | 'title'
  >('deadline-asc');

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchInput, setSearchInput] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showDemo, setShowDemo] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // IntersectionObserver 참조
  const observerTarget = useRef<HTMLDivElement>(null);
  const isFetchingMoreRef = useRef(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollTargetRef = useRef<HTMLElement | null>(null);

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

  const noDeadlineSchedules = schedules.filter((s) => !s.dead);

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate);
      onFocusDateApplied?.();
    }
  }, [focusDate, onFocusDateApplied]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (isFetchingMoreRef.current) return;
        isFetchingMoreRef.current = true;
        Promise.resolve(onLoadMore()).finally(() => {
          isFetchingMoreRef.current = false;
        });
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    const container = listContainerRef.current;
    const main = (container?.closest('main') ??
      document.querySelector('main')) as HTMLElement | null;

    const target = container && container.scrollHeight > container.clientHeight ? container : main;

    scrollTargetRef.current = target;
    if (!target) return;

    const handleScroll = () => {
      setShowScrollTop(target.scrollTop > 320);
    };

    handleScroll();
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [schedules.length]);

  useEffect(() => {
    if (showSearchInput) {
      searchInputRef.current?.focus();
    }
  }, [showSearchInput]);

  // 필터/검색 변경 시 부모에게 알림
  useEffect(() => {
    if (onFilterChange) {
      const effectiveSelectedDate = showSearchInput ? null : selectedDate;
      const effectivePlatforms = showSearchInput ? [] : selectedPlatforms;
      const effectiveStatuses = showSearchInput ? [] : selectedStatuses;
      const effectiveCategories = showSearchInput ? [] : selectedCategories;
      const effectiveReviewTypes = showSearchInput ? [] : selectedReviewTypes;
      const effectivePaybackOnly = showSearchInput ? false : paybackOnly;
      const effectiveCompletedOnly = showSearchInput ? false : completedOnly;

      onFilterChange({
        selectedDate: effectiveSelectedDate,
        platforms: effectivePlatforms,
        statuses: effectiveStatuses,
        categories: effectiveCategories,
        reviewTypes: effectiveReviewTypes,
        search: debouncedSearchQuery,
        paybackOnly: effectivePaybackOnly,
        sortBy,
        completedOnly: effectiveCompletedOnly,
      });
    }
  }, [
    selectedDate,
    selectedPlatforms,
    selectedStatuses,
    selectedCategories,
    selectedReviewTypes,
    debouncedSearchQuery,
    sortBy,
    paybackOnly,
    completedOnly,
    showSearchInput,
    onFilterChange,
  ]);

  const handleSelectTodo = () => {
    setCompletedOnly(false);
  };

  const handleToggleCompletedOnly = () => {
    setCompletedOnly((prev) => {
      const next = !prev;
      if (next) {
        setSelectedStatuses([]);
      }
      return next;
    });
  };

  const handleShowAllTodo = () => {
    setSelectedDate(null);
    setCompletedOnly(false);
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="flex-1 overflow-hidden px-5 pb-24 touch-pan-y space-y-3 pt-3 bg-neutral-50/50">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-2xl bg-white" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl bg-white" />
            <Skeleton className="h-9 w-[160px] rounded-xl bg-white" />
          </div>
        </div>

        {/* 캘린더 스켈레톤 */}
        <div className="rounded-[24px] bg-white p-4 shadow-sm h-[320px] flex flex-col gap-3">
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-md" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full mx-auto" />
            ))}
          </div>
        </div>

        {/* 리스트 스켈레톤 */}
        <div className="space-y-3 mt-4">
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-3xl bg-white shadow-sm flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showListSkeleton = Boolean(loading && schedules.length > 0);

  // 서버에서 이미 필터링/정렬된 데이터를 사용
  const overallScheduleCount = overallCount ?? totalCount ?? schedules.length;
  const visitCount = propVisitCount ?? 0;
  const deadlineCount = propDeadlineCount ?? 0;

  const hasSearchQuery = Boolean(debouncedSearchQuery);
  const isSearchMode = showSearchInput && !hasSearchQuery;
  const headerTitle = hasSearchQuery
    ? '검색 결과'
    : isSearchMode
      ? '전체'
      : selectedDate
        ? `${selectedDate.slice(5).replace('-', '/')} 일정`
        : completedOnly
          ? '완료'
          : '할 일';
  const headerCount = isSearchMode ? overallScheduleCount : totalCount ?? schedules.length;

  const isTutorialEligible = overallScheduleCount <= 2;
  const shouldShowEmptyTutorial = overallScheduleCount === 0;
  const shouldShowFirstScheduleTutorial = isTutorialEligible && schedules.length > 0;
  const shouldShowFilterTutorial = isTutorialEligible && schedules.length === 0;

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
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                체험단에 <span className="font-bold text-orange-600">금액</span>을 입력하면 이번 달{' '}
                <span className="font-bold text-orange-600">예상 수익</span>을 자동으로 확인할 수
                있어요.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );

  const renderEmptyTutorialCard = () => (
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
                  <div className="text-[11px] text-neutral-500 font-semibold">{demo.status}</div>
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
  );

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) setSelectedDate(null);
    else setSelectedDate(dateStr);
  };

  const handleCalendarDateAdd = (dateStr: string) => {
    onCreateSchedule?.(dateStr);
  };

  const handleGoToToday = () => {
    setSelectedDate(formatDateStringKST(new Date()));
  };

  return (
    <div
      ref={listContainerRef}
      className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3 pt-3 bg-neutral-50/50"
    >
      {/* 3. 캘린더 */}
      <CalendarSection
        schedules={calendarMarkerSchedules || calendarSchedules || schedules}
        onDateClick={handleDateClick}
        onCreateSchedule={handleCalendarDateAdd}
        onGoToToday={handleGoToToday}
        selectedDate={selectedDate}
        today={today}
        onMonthChange={onCalendarMonthChange}
        loading={calendarLoading}
      />

      {/* 5. 일정 리스트 헤더 및 필터 (Sticky) - New Design */}
      <div className="sticky top-0 z-10 bg-neutral-50/95 backdrop-blur-sm -mx-5 px-5 pt-3 pb-2 border-b border-neutral-200/50 shadow-sm transition-all duration-200">
        {/* 1열: 헤더 & 상세 설정 */}
        <div className="flex items-center justify-between mb-3 gap-3">
          {/* 좌측: 정보 */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[16px] font-bold text-neutral-900">{headerTitle}</h3>
              {showListSkeleton ? (
                <Skeleton className="h-5 w-16 rounded-full bg-neutral-200/80" />
              ) : (
                <span className="text-[13px] font-semibold text-neutral-500">
                  {headerCount}건
                </span>
              )}
            </div>
            {showListSkeleton ? (
              <Skeleton className="h-3.5 w-32 rounded-full bg-neutral-200/70 mt-1" />
            ) : isSearchMode ? null : (
              <p className="text-[10px] text-neutral-500 font-medium truncate mt-0.5">
                방문 {visitCount}건 · 마감 {deadlineCount}건
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showSearchInput && (
              <button
                type="button"
                onClick={() => {
                  setShowSearchInput(true);
                  setSearchInput(searchQuery);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                검색
              </button>
            )}
            {selectedDate && !isSearchMode && (
              <button
                onClick={handleShowAllTodo}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
              >
                할일 전체보기
              </button>
            )}
          </div>
        </div>

        {/* 2열: 뱃지 가로 스크롤 */}
        {showSearchInput ? (
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="일정 제목 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSearchQuery(searchInput.trim());
                    }
                  }}
                  className="pl-10 pr-10 h-10 w-full rounded-2xl border-neutral-200 bg-white shadow-sm text-[12px]"
                />
                {(searchInput || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 h-10 w-6 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                    aria-label="검색 초기화"
                  >
                    <X className="h-4 w-4 text-neutral-500" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearchInput(false);
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="h-10 flex-shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
              >
                검색 닫기
              </button>
            </div>
          </div>
        ) : !selectedDate ? (
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 -ml-1 pl-1 pr-8">
              {/* 1. 전체 */}
              <div className="flex flex-shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-[#f2f4f6] p-1">
                <button
                  onClick={handleSelectTodo}
                  aria-pressed={!completedOnly}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                    !completedOnly
                      ? 'bg-white text-neutral-800 shadow-[0_2px_6px_rgba(15,23,42,0.14)]'
                      : 'text-neutral-500 hover:text-neutral-700'
                  )}
                >
                  할 일
                </button>
                <button
                  onClick={handleToggleCompletedOnly}
                  aria-pressed={completedOnly}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                    completedOnly
                      ? 'bg-white text-neutral-800 shadow-[0_2px_6px_rgba(15,23,42,0.14)]'
                      : 'text-neutral-500 hover:text-neutral-700'
                  )}
                >
                  완료
                </button>
              </div>

              {/* 2. 정렬 */}
              <FilterBadge
                label={
                  sortBy === 'deadline-asc'
                    ? '마감 임박순'
                    : sortBy === 'visit-asc'
                      ? '방문 임박순'
                      : sortBy === 'deadline-desc'
                        ? '마감일 최신순'
                        : sortBy === 'visit-desc'
                          ? '방문일 최신순'
                          : '정렬'
                }
                isActive={true} // Default selected
              >
                <Command>
                  <CommandList>
                    <CommandGroup>
                      <CommandItem onSelect={() => setSortBy('deadline-asc')}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            sortBy === 'deadline-asc' ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        마감일 임박순
                      </CommandItem>
                      <CommandItem onSelect={() => setSortBy('visit-asc')}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            sortBy === 'visit-asc' ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        방문일 임박순
                      </CommandItem>
                      <CommandItem onSelect={() => setSortBy('deadline-desc')}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            sortBy === 'deadline-desc' ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        마감일 최신순
                      </CommandItem>
                      <CommandItem onSelect={() => setSortBy('visit-desc')}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            sortBy === 'visit-desc' ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        방문일 최신순
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </FilterBadge>

              {/* 3. 플랫폼 */}
              <FilterBadge
                label={
                  selectedPlatforms.length > 0 &&
                  selectedPlatforms.length < availablePlatforms.length
                    ? `플랫폼 ${selectedPlatforms.length}`
                    : '플랫폼'
                }
                isActive={
                  selectedPlatforms.length > 0 &&
                  selectedPlatforms.length < availablePlatforms.length
                }
              >
                <Command>
                  <CommandList>
                    <CommandGroup heading="플랫폼 선택">
                      {availablePlatforms.length > 0 ? (
                        availablePlatforms.map((platform) => (
                          <FilterCheckboxItem
                            key={platform}
                            checked={selectedPlatforms.includes(platform)}
                            onSelect={() => {
                              if (selectedPlatforms.includes(platform)) {
                                setSelectedPlatforms(
                                  selectedPlatforms.filter((p) => p !== platform)
                                );
                              } else {
                                setSelectedPlatforms([...selectedPlatforms, platform]);
                              }
                            }}
                          >
                            {platform}
                          </FilterCheckboxItem>
                        ))
                      ) : (
                        <div className="py-4 px-2 text-xs text-neutral-400 text-center font-medium">
                          등록된 플랫폼이 없습니다
                        </div>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </FilterBadge>

              {/* 4. 페이백 */}
              <FilterBadge label="페이백" isActive={paybackOnly}>
                <Command>
                  <CommandList>
                    <CommandGroup>
                      <FilterCheckboxItem
                        checked={paybackOnly}
                        onSelect={() => setPaybackOnly(!paybackOnly)}
                      >
                        페이백 일정만 보기
                      </FilterCheckboxItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </FilterBadge>

              {/* 5. 진행상태 */}
              {!completedOnly && (
                <FilterBadge
                  label={
                    selectedStatuses.length > 0 &&
                    selectedStatuses.length < AVAILABLE_STATUSES.length
                      ? `진행상태 ${selectedStatuses.length}`
                      : '진행상태'
                  }
                  isActive={selectedStatuses.length > 0}
                >
                  <Command>
                    <CommandList>
                      <CommandGroup heading="상태 선택">
                        {AVAILABLE_STATUSES.map((status) => (
                          <FilterCheckboxItem
                            key={status}
                            checked={selectedStatuses.includes(status)}
                            onSelect={() => {
                              if (selectedStatuses.includes(status)) {
                                setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                              } else {
                                setSelectedStatuses([...selectedStatuses, status]);
                              }
                            }}
                          >
                            {status}
                          </FilterCheckboxItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </FilterBadge>
              )}

              {/* 6. 카테고리 */}
              <FilterBadge
                label={
                  selectedCategories.length > 0 &&
                  selectedCategories.length < AVAILABLE_CATEGORIES.length
                    ? `카테고리 ${selectedCategories.length}`
                    : '카테고리'
                }
                isActive={selectedCategories.length > 0}
              >
                <Command>
                  <CommandList>
                    <CommandGroup heading="카테고리 선택">
                      {AVAILABLE_CATEGORIES.map((category) => (
                        <FilterCheckboxItem
                          key={category}
                          checked={selectedCategories.includes(category)}
                          onSelect={() => {
                            if (selectedCategories.includes(category)) {
                              setSelectedCategories(
                                selectedCategories.filter((c) => c !== category)
                              );
                            } else {
                              setSelectedCategories([...selectedCategories, category]);
                            }
                          }}
                        >
                          {category}
                        </FilterCheckboxItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </FilterBadge>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-neutral-50/95 to-neutral-50/0" />
            <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {showListSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`list-skeleton-${i}`}
              className="p-4 rounded-3xl bg-white shadow-sm flex items-center gap-3"
            >
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          ))
        ) : schedules.length > 0 ? (
          <>
            {schedules.map((schedule) => (
              <ScheduleItem
                key={schedule.id}
                schedule={schedule}
                onClick={() => onScheduleClick(schedule.id)}
                onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
                onCompletedClick={
                  onCompletedClick ? () => onCompletedClick(schedule.id) : undefined
                }
                onPaybackConfirm={
                  onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined
                }
                onAdditionalDeadlineToggle={
                  onAdditionalDeadlineToggle
                    ? (deadlineId) => onAdditionalDeadlineToggle(schedule.id, deadlineId)
                    : undefined
                }
                today={today}
                selectedDate={selectedDate}
              />
            ))}

            {/* 무한 스크롤 트리거 */}
            {hasMore && (
              <div ref={observerTarget} className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-orange-500" />
                  <span>더 많은 일정 로딩 중...</span>
                </div>
              </div>
            )}

            {/* 모든 일정 표시 완료 */}
            {!hasMore && (totalCount ?? 0) > 20 && (
              <div className="text-center py-4 text-sm text-neutral-500">
                총 {totalCount}개 일정을 모두 불러왔습니다
              </div>
            )}
          </>
        ) : shouldShowEmptyTutorial ? (
          renderEmptyTutorialCard()
        ) : shouldShowFilterTutorial ? (
          renderTutorialCard()
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500">
            선택한 날짜/필터에 맞는 일정이 없어요.
          </div>
        )}
        {shouldShowFirstScheduleTutorial && renderTutorialCard()}
      </div>
      {showScrollTop && (
        <button
          onClick={() => scrollTargetRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-28 right-5 md:right-[calc(50%-400px+20px)] z-40 h-11 w-11 rounded-full bg-white/90 text-orange-500 shadow-[0_10px_24px_rgba(17,24,39,0.14)] ring-2 ring-orange-200/90 backdrop-blur hover:bg-orange-50 transition-colors flex items-center justify-center"
          aria-label="위로 올라가기"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
