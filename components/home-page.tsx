'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Skeleton } from '@/components/ui/skeleton';
import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { parseDateString } from '@/lib/date-utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Command as UICommand, CommandGroup, CommandItem, CommandList } from './ui/command';
const Command = UICommand;
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// --- 날짜/시간 유틸리티 ---
const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

// --- 상수 ---
const AVAILABLE_STATUSES = ['재확인', '선정됨', '방문일 예약 완료', '방문', '제품 배송 완료'];
const DEFAULT_SELECTED_STATUSES = AVAILABLE_STATUSES.filter((s) => s !== '재확인');

const AVAILABLE_CATEGORIES = [
  '맛집/식품',
  '뷰티',
  '생활/리빙',
  '출산/육아',
  '주방/가전',
  '반려동물',
  '여행/레저',
  '티켓/문화생활',
  '디지털/전자기기',
  '건강/헬스',
  '자동차/모빌리티',
  '문구/오피스',
  '기타',
];

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

const FilterBadge = ({
  label,
  isActive,
  onClick,
  children,
}: {
  label: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        onClick={onClick}
        className={cn(
          'flex-shrink-0 h-8 px-3 rounded-[8px] text-[13px] font-medium transition-all flex items-center gap-1 border select-none',
          isActive
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
        )}
      >
        {label}
        {children && (
          <ChevronDown
            className={cn(
              'h-3 w-3 opacity-50 ml-0.5 transition-transform',
              isActive && 'opacity-100'
            )}
          />
        )}
      </button>
    </PopoverTrigger>
    {children && (
      <PopoverContent className="w-[200px] p-0" align="start">
        {children}
      </PopoverContent>
    )}
  </Popover>
);

const FilterCheckboxItem = ({
  checked,
  children,
  onSelect,
}: {
  checked: boolean;
  children: React.ReactNode;
  onSelect: () => void;
}) => (
  <CommandItem onSelect={onSelect} className="py-2.5 cursor-pointer">
    <div
      className={cn(
        'mr-2.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors shadow-sm',
        checked
          ? 'bg-neutral-900 border-neutral-900 text-white'
          : 'bg-white border-neutral-200 hover:border-neutral-300'
      )}
    >
      <Check className={cn('h-3 w-3', checked ? 'opacity-100' : 'opacity-0')} />
    </div>
    <span
      className={cn(
        'flex-1 text-[13px]',
        checked ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-600'
      )}
    >
      {children}
    </span>
  </CommandItem>
);

// --- 메인 페이지 ---
export default function HomePage({
  schedules,
  calendarSchedules,
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
  visitCount: propVisitCount,
  deadlineCount: propDeadlineCount,
  onFilterChange,
  onCalendarMonthChange,
  calendarLoading = false, // Add calendarLoading prop with default (optional)
  availablePlatforms = [], // New prop for platforms
}: {
  schedules: Schedule[];
  calendarSchedules?: Schedule[];
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
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'active' | 'reconfirm' | 'overdue' | 'noDeadline'
  >('all');

  // 필터 상태
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedReviewTypes, setSelectedReviewTypes] = useState<string[]>([]);
  const [paybackOnly, setPaybackOnly] = useState(false);

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

  const [floatingPanel, setFloatingPanel] = useState<'none' | 'noDeadline' | 'reconfirm'>('none');
  const [showDemo, setShowDemo] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // IntersectionObserver 참조
  const observerTarget = useRef<HTMLDivElement>(null);

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

  const reconfirmSchedules = schedules.filter((s) => s.status === '재확인');
  const reconfirmCount = reconfirmSchedules.length;
  const noDeadlineSchedules = schedules.filter((s) => !s.dead);

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate);
      setSelectedFilter('all');
      onFocusDateApplied?.();
    }
  }, [focusDate, onFocusDateApplied]);

  // 필터/검색 변경 시 부모에게 알림
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        selectedDate,
        platforms: selectedPlatforms,
        statuses: selectedStatuses,
        categories: selectedCategories,
        reviewTypes: selectedReviewTypes,
        search: debouncedSearchQuery,
        paybackOnly,
        sortBy,
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
    onFilterChange,
  ]);

  // Initialize filters with defaults (All selected)
  // Use a ref to track if we've initialized to avoid re-running on every render if schedules change
  // Removed initializedRef useEffect since we now initialize state directly with defaults

  // Set selectedPlatforms to availablePlatforms if they are loaded and we want them all selected by default?
  // Or just let empty mean "All".
  // The user says "Front-end constitutes values in selectbox with platform data of response".
  // So `availablePlatforms` is the source of truth for the dropdown options.

  const availableReviewTypes = ['제공형', '구매형', '기자단', '미션/인증', '방문형'];

  const handleClearFilters = () => {
    setSelectedPlatforms([]); // Clear platform selection
    setSelectedStatuses([]);
    setSelectedCategories([]);
    setSelectedReviewTypes([]);
    setSearchQuery('');
    setSortBy('deadline-asc');
    setPaybackOnly(false);
    setSelectedDate(null);
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

  // 서버에서 이미 필터링/정렬된 데이터를 사용
  const hasSchedules = totalCount ? totalCount > 0 : schedules.length > 0;
  const visitCount = propVisitCount ?? 0;
  const deadlineCount = propDeadlineCount ?? 0;

  const shouldShowFirstScheduleTutorial =
    hasSchedules && (totalCount ?? schedules.length) === 1 && schedules.length > 0;
  const shouldShowFilterTutorial =
    hasSchedules && (totalCount ?? schedules.length) <= 1 && schedules.length === 0;

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
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3 pt-3 bg-neutral-50/50">
      {/* 검색 및 필터 섹션 */}
      <div className="space-y-2.5">
        {/* 검색 바 */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            type="text"
            placeholder="일정 제목 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 rounded-2xl border-neutral-200 bg-white shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-neutral-500" />
            </button>
          )}
        </div>
      </div>

      {/* 3. 캘린더 */}
      <CalendarSection
        schedules={calendarSchedules || schedules} // calendarSchedules가 없으면 기존 동작 유지
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
        <div className="flex items-center justify-between mb-3">
          {/* 좌측: 정보 */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[16px] font-bold text-neutral-900">
                {selectedDate ? `${selectedDate.slice(5).replace('-', '/')} 일정` : '전체 일정'}
              </h3>
              <span className="text-[13px] font-semibold text-neutral-500">
                {totalCount ?? schedules.length}건
              </span>
            </div>
            {!selectedDate && (
              <p className="text-[10px] text-neutral-500 font-medium truncate mt-0.5">
                방문 {visitCount}건 · 마감 {deadlineCount}건
              </p>
            )}
          </div>
        </div>

        {/* 2열: 뱃지 가로 스크롤 */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 -ml-1 pl-1">
          {/* 1. 전체 */}
          <button
            onClick={handleClearFilters}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            전체
          </button>

          {/* 2. 정렬 */}
          {!selectedDate && (
            <>
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
              <FilterBadge
                label={
                  selectedStatuses.length > 0 && selectedStatuses.length < AVAILABLE_STATUSES.length
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

              {/* 6. 카테고리 */}
              <FilterBadge label="카테고리" isActive={selectedCategories.length > 0}>
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
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {schedules.length > 0 ? (
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
  onMonthChange,
  loading = false,
}: {
  schedules: Schedule[];
  onDateClick: (dateStr: string) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  today: string;
  onCreateSchedule?: (dateStr: string) => void;
  onMonthChange?: (date: Date) => void;
  loading?: boolean;
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

    // 추가 마감일 (additionalDeadlines)
    if (schedule.additionalDeadlines && schedule.additionalDeadlines.length > 0) {
      schedule.additionalDeadlines.forEach((deadline) => {
        if (deadline.date) {
          const info = ensureDayInfo(deadline.date);

          if (!deadline.completed) {
            // 미완료인 경우 기존 로직
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
            // 완료된 경우 주황색 점 표시를 위해 hasCompleted 설정
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

  const prevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };
  const nextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };
  const goToToday = () => {
    const newDate = new Date();
    setCurrentDate(newDate);
    onGoToToday();
    onMonthChange?.(newDate);
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
            disabled={loading}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          <div className="text-[16px] font-bold text-neutral-900 flex items-center gap-2">
            {year}년 <span className="text-orange-600">{month + 1}월</span>
          </div>
          <button
            onClick={nextMonth}
            disabled={loading}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          disabled={loading}
          className={`absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[12px] font-semibold text-neutral-900 rounded-lg hover:bg-neutral-200 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        {loading ? (
          <>
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`skel-empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-8 w-8 mx-auto rounded-full" />
            ))}
          </>
        ) : (
          <>
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
          </>
        )}
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
