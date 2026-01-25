'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Schedule, ExtraIncome, MonthlyGrowth, HistoryView } from '@/types';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import ExtraIncomeModal from './extra-income-modal';
import IncomeHistoryModal from './income-history-modal';
import { Z_INDEX } from '@/lib/z-index';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  buildIncomeDetailsFromLegacy,
  parseIncomeDetailsJson,
  sumIncomeDetails,
} from '@/lib/schedule-income-details';
import { CreditCard, Gift, Info, Plus, Wallet, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

const incomeTutorialStorageKey = 'reviewflow-stats-income-tutorial-shown';

// --- [신규 컴포넌트] 스크롤 가능한 리스트 래퍼 (더보기 버튼 포함) ---
function ScrollableList({
  children,
  maxHeight = 'max-h-[320px]',
  className = '',
}: {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  // 컨텐츠 길이에 따라 스크롤 필요 여부 체크
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        // 내용이 박스보다 길면 인디케이터 표시
        setShowIndicator(scrollHeight > clientHeight);
      }
    };

    const timer = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timer);
  }, [children]);

  // 스크롤 이벤트 핸들러
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // 바닥에 거의 도달했는지 확인 (여유값 20px)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
      setShowIndicator(!isAtBottom);
    }
  };

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`${maxHeight} overflow-y-auto pr-2 pb-8 ${className} scrollbar-hide`}
      >
        {children}
      </div>

      {/* 하단 화이트 그라데이션 (스크롤 더 있을 때만 표시) */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none rounded-b-[26px] transition-opacity duration-300 ${
          showIndicator ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 스크롤 더보기 버튼 (스크롤 더 있을 때만 표시) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-all duration-300 z-10 ${
          showIndicator
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 bg-white border border-[#f1f5f9] shadow-[0_4px_12px_rgba(0,0,0,0.06)] rounded-full px-3.5 py-1.5 animate-pulse">
          <ChevronDown className="w-3.5 h-3.5 text-[#f97316]" strokeWidth={2.5} />
          <span className="text-[11px] font-bold text-[#f97316]">스크롤하여 더보기</span>
        </div>
      </div>
    </div>
  );
}

type StatsPageProps = {
  schedules: Schedule[];
  onScheduleItemClick: (schedule: Schedule) => void;
  isScheduleModalOpen: boolean;
  isPro: boolean;
};

export function StatsPageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative pt-4.5">
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={`month-${idx}`} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      <div className="rounded-[30px] bg-white p-6 shadow-sm shadow-[0_14px_40px_rgba(18,34,64,0.08)]">
        <Skeleton className="h-4 w-44 rounded-full" />
        <Skeleton className="mt-3 h-8 w-32 rounded-full" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function StatsPage({
  schedules,
  onScheduleItemClick,
  isScheduleModalOpen,
  isPro,
}: StatsPageProps) {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showIncomeTutorial, setShowIncomeTutorial] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [editingExtraIncome, setEditingExtraIncome] = useState<ExtraIncome | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>('all');
  const [isCompletedTooltipOpen, setIsCompletedTooltipOpen] = useState(false);
  const [showProGateModal, setShowProGateModal] = useState(false);
  const historyDisabled = showIncomeModal || isScheduleModalOpen;
  const cardShadow = 'shadow-[0_14px_40px_rgba(18,34,64,0.08)]';
  const router = useRouter();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const monthScrollRef = useRef<HTMLDivElement>(null);

  // --- [Scroll Targets Refs] ---
  const benefitRef = useRef<HTMLElement>(null);
  const incomeRef = useRef<HTMLElement>(null);
  const costRef = useRef<HTMLElement>(null);

  // --- [Scroll Helper] ---
  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const openHistoryModal = (view: HistoryView) => {
    setHistoryView(view);
    setShowHistoryModal(true);
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentMonthKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonthKey = `${previousMonthDate.getFullYear()}-${(previousMonthDate.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-01`;
  const allKey = 'all';
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);

  const parseDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getMonthStartDate = (monthKey: string) => {
    if (monthKey === allKey) return null;
    const date = new Date(monthKey);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const selectedMonthDate = useMemo(() => getMonthStartDate(selectedMonthKey), [selectedMonthKey]);
  const isAllSelected = selectedMonthKey === allKey;
  const isDateInSelectedMonth = (date: Date | null) => {
    if (!date || !selectedMonthDate) return false;
    return (
      date.getFullYear() === selectedMonthDate.getFullYear() &&
      date.getMonth() === selectedMonthDate.getMonth()
    );
  };

  const formatFullMonthLabel = (key: string) => {
    if (key === allKey) return '전체';
    const date = getMonthStartDate(key);
    if (!date) return key;
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const formatMonthButtonLabel = (key: string) => {
    if (key === allKey) return '전체';
    const date = getMonthStartDate(key);
    if (!date) return key;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}.${month}`;
  };

  const formatShortMonthLabel = (key: string) => {
    const date = getMonthStartDate(key);
    if (!date) return '';
    return `${date.getMonth() + 1}월`;
  };

  const selectedMonthLabel = formatFullMonthLabel(selectedMonthKey);
  const selectedMonthLabelShort = formatShortMonthLabel(selectedMonthKey);
  const displaySelectedMonthLabel = selectedMonthLabel || '선택한 달';
  const displaySelectedRangeLabel = isAllSelected ? '여태까지' : displaySelectedMonthLabel;

  const getScheduleDate = (schedule: Schedule) =>
    parseDate(schedule.visit) || parseDate(schedule.dead);

  const createCategoryMap = (): Record<Schedule['category'], number> => ({
    '맛집/식품': 0,
    뷰티: 0,
    '생활/리빙': 0,
    '출산/육아': 0,
    '주방/가전': 0,
    반려동물: 0,
    '여행/레저': 0,
    데이트: 0,
    웨딩: 0,
    '티켓/문화생활': 0,
    '디지털/전자기기': 0,
    '건강/헬스': 0,
    '자동차/모빌리티': 0,
    '문구/오피스': 0,
    기타: 0,
  });

  const { extraIncomes, createExtraIncome, updateExtraIncome, deleteExtraIncome } =
    useExtraIncomes();
  const { toast } = useToast();

  const handleAddIncome = async (income: Omit<ExtraIncome, 'id'>) => {
    await createExtraIncome(income);
  };

  const handleOpenIncomeModal = (income?: ExtraIncome) => {
    setEditingExtraIncome(income ?? null);
    setShowIncomeModal(true);
    setShowIncomeTutorial(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(incomeTutorialStorageKey, '1');
    }
  };

  const handleIncomeModalClose = () => {
    setShowIncomeModal(false);
    setEditingExtraIncome(null);
  };

  const handleUpdateExtraIncome = (id: number, updates: Omit<ExtraIncome, 'id'>) => {
    return updateExtraIncome(id, updates);
  };

  const handleDeleteEditingIncome = (id: number) => {
    return deleteExtraIncome(id);
  };

  const openProGateModal = () => {
    setShowProGateModal(true);
  };

  const handleHistoryScheduleClick = (schedule: Schedule) => {
    onScheduleItemClick(schedule);
  };

  const handleHistoryExtraIncomeClick = (income: ExtraIncome) => {
    handleOpenIncomeModal(income);
  };

  const handleCompletedOnlyToggle = (checked: boolean) => {
    setShowCompletedOnly(checked);
    if (checked) {
      toast({
        title: '완료된 내역만 통계에 반영돼요.',
        description: '진행 중인 스케줄은 제외됩니다.',
        duration: 1500,
      });
    }
  };

  const visibleSchedules = useMemo(
    () =>
      showCompletedOnly ? schedules.filter((schedule) => schedule.status === '완료') : schedules,
    [schedules, showCompletedOnly]
  );

  const selectedMonthSchedules = useMemo(
    () =>
      isAllSelected
        ? visibleSchedules
        : visibleSchedules.filter((schedule) => isDateInSelectedMonth(getScheduleDate(schedule))),
    [visibleSchedules, selectedMonthKey, selectedMonthDate, isAllSelected]
  );

  const selectedMonthExtraIncomes = useMemo(
    () =>
      isAllSelected
        ? extraIncomes
        : extraIncomes.filter((income) => isDateInSelectedMonth(parseDate(income.date))),
    [extraIncomes, selectedMonthKey, selectedMonthDate, isAllSelected]
  );

  const groupedExtraIncomes = useMemo(() => {
    const map = new Map<string, number>();
    selectedMonthExtraIncomes.forEach((income) => {
      const key = income.title.trim() || '기타';
      map.set(key, (map.get(key) || 0) + toNumber(income.amount));
    });
    return Array.from(map.entries())
      .map(([title, amount]) => ({ title, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedMonthExtraIncomes]);

  const { detailIncomeTotal, detailCostTotal, incomeDetailBreakdown, costDetailBreakdown } =
    useMemo(() => {
      const summary = {
        detailIncomeTotal: 0,
        detailCostTotal: 0,
        incomeDetailBreakdown: {} as Record<string, number>,
        costDetailBreakdown: {} as Record<string, number>,
      };

      selectedMonthSchedules.forEach((schedule) => {
        const parsed = parseIncomeDetailsJson(schedule.incomeDetailsJson);
        const fallback = buildIncomeDetailsFromLegacy(
          toNumber(schedule.income),
          toNumber(schedule.cost)
        );
        const details = parsed.length ? parsed : fallback;
        if (!details.length) return;
        const { incomeTotal, costTotal, incomeBreakdown, costBreakdown } =
          sumIncomeDetails(details);

        summary.detailIncomeTotal += incomeTotal;
        summary.detailCostTotal += costTotal;

        Object.entries(incomeBreakdown).forEach(([label, amount]) => {
          summary.incomeDetailBreakdown[label] =
            (summary.incomeDetailBreakdown[label] || 0) + amount;
        });
        Object.entries(costBreakdown).forEach(([label, amount]) => {
          summary.costDetailBreakdown[label] = (summary.costDetailBreakdown[label] || 0) + amount;
        });
      });

      return summary;
    }, [selectedMonthSchedules]);

  const { totalBen, totalInc, totalCost, benefitByCategory, incomeByCategory, costByCategory } =
    useMemo(() => {
      const benefitMap = createCategoryMap();
      const incomeMap = createCategoryMap();
      const costMap = createCategoryMap();
      let benefitTotal = 0;
      let incomeTotal = 0;
      let costTotal = 0;

      selectedMonthSchedules.forEach((s) => {
        const benefit = toNumber(s.benefit);
        const income = toNumber(s.income);
        const cost = toNumber(s.cost);

        benefitTotal += benefit;
        incomeTotal += income;
        costTotal += cost;

        benefitMap[s.category] += benefit;
        incomeMap[s.category] += income;
        costMap[s.category] += cost;
      });

      return {
        totalBen: benefitTotal,
        totalInc: incomeTotal,
        totalCost: costTotal,
        benefitByCategory: benefitMap,
        incomeByCategory: incomeMap,
        costByCategory: costMap,
      };
    }, [selectedMonthSchedules]);

  const totalExtraIncome = selectedMonthExtraIncomes.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0
  );

  const scheduleValue = totalBen + totalInc - totalCost;
  const totalCashAndExtraIncome = totalInc + totalExtraIncome;
  const econValue = totalBen + totalCashAndExtraIncome - totalCost;

  const hasIncomeData = totalBen > 0 || totalInc > 0 || totalCost > 0 || totalExtraIncome > 0;

  // --- 토스 스타일 빠른 애니메이션 적용 ---
  const [animatedEconValue, setAnimatedEconValue] = useState(0);
  const animatedValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastAnimatedValueRef = useRef<number | null>(null);
  const animationIdRef = useRef(0);

  useEffect(() => {
    const target = econValue;
    if (lastAnimatedValueRef.current === target && animatedValueRef.current === target) {
      return;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationIdRef.current += 1;
    const animationId = animationIdRef.current;
    const start = animatedValueRef.current;
    if (target === start) {
      lastAnimatedValueRef.current = target;
      return;
    }

    // 500ms, Quartic Ease 적용
    const duration = 500;
    const startTime = performance.now();

    const step = (now: number) => {
      if (animationIdRef.current !== animationId) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 4);

      const nextValue = Math.round(start + (target - start) * eased);
      animatedValueRef.current = nextValue;
      setAnimatedEconValue(nextValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        lastAnimatedValueRef.current = target;
        setAnimatedEconValue(target);
      }
    };
    animationRef.current = requestAnimationFrame(step);
    return () => {
      animationIdRef.current += 1;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [econValue]);
  // ------------------------------------

  const hasAnyExtraIncome = extraIncomes.length > 0;
  const getCategoryEntries = (categoryMap: Record<Schedule['category'], number>) =>
    (Object.entries(categoryMap) as [Schedule['category'], number][])
      .filter(([, amount]) => amount > 0)
      .sort(([, aAmount], [, bAmount]) => bAmount - aAmount);

  const getDetailEntries = (detailMap: Record<string, number>) =>
    Object.entries(detailMap)
      .filter(([, amount]) => amount > 0)
      .sort(([, aAmount], [, bAmount]) => bAmount - aAmount);

  const benefitEntries = getCategoryEntries(benefitByCategory);
  const incomeEntries = getCategoryEntries(incomeByCategory);
  const costEntries = getCategoryEntries(costByCategory);
  const incomeDetailEntries = getDetailEntries(incomeDetailBreakdown);
  const costDetailEntries = getDetailEntries(costDetailBreakdown);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(incomeTutorialStorageKey);
    if (seen === '1' || hasAnyExtraIncome) {
      setShowIncomeTutorial(false);
      if (hasAnyExtraIncome) {
        window.localStorage.setItem(incomeTutorialStorageKey, '1');
      }
      return;
    }
    setShowIncomeTutorial(true);
  }, [hasAnyExtraIncome]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const monthlyGrowth: MonthlyGrowth[] = useMemo(() => {
    const monthMap = new Map<string, MonthlyGrowth>();
    const toMonthKey = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}-01`;
    };
    const ensureEntry = (key: string) => {
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          monthStart: key,
          benefitTotal: 0,
          incomeTotal: 0,
          costTotal: 0,
          extraIncomeTotal: 0,
          econValue: 0,
        });
      }
      return monthMap.get(key)!;
    };
    visibleSchedules.forEach((s) => {
      const date = parseDate(s.visit) || parseDate(s.dead);
      if (!date) return;
      const key = toMonthKey(date);
      const entry = ensureEntry(key);
      entry.benefitTotal += toNumber(s.benefit);
      entry.incomeTotal += toNumber(s.income);
      entry.costTotal += toNumber(s.cost);
    });
    extraIncomes.forEach((income) => {
      const date = parseDate(income.date);
      if (!date) return;
      const key = toMonthKey(date);
      const entry = ensureEntry(key);
      entry.extraIncomeTotal += toNumber(income.amount);
    });
    monthMap.forEach((entry) => {
      entry.econValue =
        (entry.benefitTotal || 0) +
        (entry.incomeTotal || 0) +
        (entry.extraIncomeTotal || 0) -
        (entry.costTotal || 0);
    });
    return Array.from(monthMap.values()).sort(
      (a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime()
    );
  }, [visibleSchedules, extraIncomes]);

  const monthOptions = useMemo(() => {
    const keys = Array.from(
      new Set([...monthlyGrowth.map((entry) => entry.monthStart), currentMonthKey])
    );
    const options = keys
      .map((key) => {
        const date = getMonthStartDate(key);
        if (!date) return null;
        return { key, date, label: formatMonthButtonLabel(key) };
      })
      .filter((option): option is { key: string; date: Date; label: string } => option !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return [{ key: allKey, label: '전체' }, ...options];
  }, [monthlyGrowth, currentMonthKey]);

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative pt-4.5"
      >
        {/* 상단 월 선택 영역 */}
        <div className="mb-4 relative">
          <div className="flex items-center gap-3">
            <div
              ref={monthScrollRef}
              className="flex-1 flex gap-2 overflow-x-auto pb-1 px-5 -mx-5 scrollbar-hide snap-x mr-0"
            >
              {monthOptions.map((option) => {
                const isProOnlyOption =
                  option.key === allKey ||
                  (option.key !== currentMonthKey && option.key !== previousMonthKey);
                const isMonthLocked = !isPro && isProOnlyOption;
                const proBadgeClass =
                  selectedMonthKey === option.key
                    ? 'bg-white/20 text-white'
                    : 'bg-[#fff4d7] text-[#b45309]';
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (isMonthLocked) {
                        openProGateModal();
                        return;
                      }
                      setSelectedMonthKey(option.key);
                    }}
                    aria-disabled={isMonthLocked}
                    className={`mt-1 flex-none snap-start rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap flex items-center gap-2 ${
                      selectedMonthKey === option.key
                        ? 'bg-[#0f172a] text-white shadow-md'
                        : 'bg-white text-[#1f2937] border border-[#e5e7eb]'
                    } ${isMonthLocked ? 'opacity-50 cursor-pointer' : ''}`}
                  >
                    <span>{option.label}</span>
                    {isProOnlyOption && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${proBadgeClass}`}>
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="w-2 flex-none" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#64748b] whitespace-nowrap">
              <Tooltip open={isCompletedTooltipOpen} onOpenChange={setIsCompletedTooltipOpen}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="완료만 보기 안내"
                    onClick={() => setIsCompletedTooltipOpen((prev) => !prev)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[#64748b]"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                  진행 중인 스케줄을 제외하고 실제 완료된 내역의 통계만 확인합니다.
                </TooltipContent>
              </Tooltip>
              <label htmlFor="completed-only" className="cursor-pointer mr-0.5">
                완료만 보기
              </label>
              <Switch
                id="completed-only"
                checked={showCompletedOnly}
                onCheckedChange={handleCompletedOnlyToggle}
                className="data-[state=checked]:bg-[#0f172a]"
              />
            </div>
          </div>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[26px] p-5 mt-1 mb-4 bg-gradient-to-br from-orange-300 via-orange-500 to-red-400 shadow-[0_10px_30px_-10px_rgba(255,87,34,0.4)] ring-1 ring-white/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_50%)] mix-blend-overlay" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />

          <button
            onClick={() => handleOpenIncomeModal()}
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 active:scale-95 transition-all text-white shadow-sm"
            aria-label="부수입 추가"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>

          <div className="relative flex flex-col items-center justify-center text-center mt-1 mb-5">
            <div className="text-[13px] font-bold text-white/90 uppercase tracking-wide mb-1 drop-shadow-sm">
              {displaySelectedRangeLabel} 모은 총 경제적 가치
            </div>
            <div className="text-[30px] font-black leading-none text-white tracking-tight drop-shadow-md">
              ₩ {animatedEconValue.toLocaleString()}
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-2">
            {/* 1. 방어한 생활비 뱃지 (Clickable) */}
            <div
              onClick={() => scrollToSection(benefitRef)}
              className="flex flex-col items-center justify-center rounded-[18px] bg-white/10 backdrop-blur-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_10px_-2px_rgba(0,0,0,0.05)] p-2.5 text-center min-h-[85px] border border-white/20 transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md">
                <Gift size={10} strokeWidth={1.5} />
              </div>
              <div className="text-[11.5px] font-semibold text-white/80 leading-tight">
                방어한 생활비
              </div>
              <div className="text-[15px] font-bold text-white mt-0.5 drop-shadow-sm">
                {totalBen.toLocaleString()}
              </div>
            </div>

            {/* 2. 현금수익 뱃지 (Clickable) */}
            <div
              onClick={() => scrollToSection(incomeRef)}
              className="flex flex-col items-center justify-center rounded-[18px] bg-white/10 backdrop-blur-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_10px_-2px_rgba(0,0,0,0.05)] p-2.5 text-center min-h-[85px] border border-white/20 transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md">
                <Wallet size={10} strokeWidth={1.5} />
              </div>
              <div className="text-[11.5px] font-semibold text-white/80 leading-tight">
                현금수익
              </div>
              <div className="text-[15px] font-bold text-white mt-0.5 drop-shadow-sm">
                {totalCashAndExtraIncome.toLocaleString()}
              </div>
            </div>

            {/* 3. 지출비용 뱃지 (Clickable) */}
            <div
              onClick={() => scrollToSection(costRef)}
              className="flex flex-col items-center justify-center rounded-[18px] bg-white/10 backdrop-blur-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_10px_-2px_rgba(0,0,0,0.05)] p-2.5 text-center min-h-[85px] border border-white/20 transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md">
                <CreditCard size={10} strokeWidth={1.5} />
              </div>
              <div className="text-[11.5px] font-semibold text-white/80 leading-tight">
                지출비용
              </div>
              <div className="text-[15px] font-bold text-white mt-0.5 drop-shadow-sm">
                {totalCost.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3.5">
          <div className="ml-1.5 text-[16px] font-bold text-[#0f172a]">
            {isAllSelected ? '누적 재무 상세' : `${displaySelectedMonthLabel} 재무 상세`}
          </div>
          <button
            onClick={() => openHistoryModal('all')}
            className="text-[12px] text-[#6b7685] hover:text-[#111827] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            전체 내역 보기
            <span className="text-xs">→</span>
          </button>
        </div>

        {hasIncomeData ? (
          <div className="space-y-4 mb-3.5">
            {/* 1. Benefit Card (Target) */}
            <section
              ref={benefitRef}
              className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow} scroll-mt-20`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fef4eb] text-[#f97316] text-[14px]">
                      ₩
                    </span>
                    {isAllSelected ? '누적 방어한 생활비' : '방어한 생활비'}
                  </div>
                  <div className="text-[18px] font-bold text-[#f97316] mt-1">
                    {totalBen.toLocaleString()} 원
                  </div>
                </div>
                {totalBen > 0 && (
                  <button
                    onClick={() => openHistoryModal('benefit')}
                    className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                  >
                    전체 내역 보기
                  </button>
                )}
              </div>

              {totalBen > 0 ? (
                <>
                  <p className="text-xs text-[#6b7280] mt-1">
                    체험단에서 받은 제품/서비스 값 항목만 뽑아 보여줘요.
                  </p>
                  <div className="mt-4 space-y-3">
                    {benefitEntries.map(([category, amount]) => {
                      const percentage = totalBen ? Math.round((amount / totalBen) * 100) : 0;
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="w-26 text-[12px] font-semibold text-[#4b5563]">
                            {category}
                          </div>
                          <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#ff9431] to-[#ff6b2c] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                            {amount.toLocaleString()}원
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-[13px] text-gray-400 font-medium">
                  내역이 아직 없어요.
                </div>
              )}
            </section>

            {/* 2. Income Card (Target) */}
            <section
              ref={incomeRef}
              className={`bg-white rounded-[26px] px-6 pt-6 shadow-sm ${cardShadow} scroll-mt-20`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff] text-[#2563eb] text-[14px]">
                      💵
                    </span>
                    {isAllSelected ? '누적 수입' : '수입'}
                  </div>
                  <div className="text-[18px] font-bold text-[#2563eb] mt-1">
                    {(totalInc + totalExtraIncome).toLocaleString()} 원
                  </div>
                </div>
                {totalInc + totalExtraIncome > 0 && (
                  <button
                    onClick={() => openHistoryModal('income')}
                    className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                  >
                    전체 내역 보기
                  </button>
                )}
              </div>

              {/* 데이터가 없으면 리스트 영역 숨김 (Minimal) */}
              {totalInc + totalExtraIncome > 0 ? (
                <ScrollableList maxHeight="max-h-[320px]" className="space-y-4">
                  <div className="mt-3 space-y-3">
                    {incomeEntries.map(([category, amount]) => {
                      const percentage = totalInc ? Math.round((amount / totalInc) * 100) : 0;
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="w-26 text-[12px] font-semibold text-[#4b5563]">
                            {category}
                          </div>
                          <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                            {amount.toLocaleString()}원
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {incomeDetailEntries.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-bold text-[#0f172a]">수익 내역</div>
                        <div className="text-xs text-[#6b7685]">
                          {detailIncomeTotal
                            ? `총 ${detailIncomeTotal.toLocaleString()}원`
                            : '없음'}
                        </div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {incomeDetailEntries.map(([label, amount]) => {
                          const percentage = detailIncomeTotal
                            ? Math.round((amount / detailIncomeTotal) * 100)
                            : 0;
                          return (
                            <div key={label} className="flex items-center gap-3">
                              <div className="w-26 text-[12px] font-semibold text-[#4b5563] truncate">
                                {label}
                              </div>
                              <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                                {amount.toLocaleString()}원
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {groupedExtraIncomes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-bold text-[#0f172a]">부수입</div>
                        <div className="text-xs text-[#6b7685]">
                          {totalExtraIncome ? `총 ${totalExtraIncome.toLocaleString()}원` : '없음'}
                        </div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {groupedExtraIncomes.map((income) => {
                          const percentage = totalExtraIncome
                            ? Math.round((income.amount / totalExtraIncome) * 100)
                            : 0;
                          return (
                            <div key={income.title} className="flex items-center gap-3">
                              <div className="w-26 text-[12px] font-semibold text-[#4b5563] truncate">
                                {income.title}
                              </div>
                              <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                                {income.amount.toLocaleString()}원
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </ScrollableList>
              ) : (
                <div className="mt-2 text-[13px] text-gray-400 font-medium">
                  내역이 아직 없어요.
                </div>
              )}
            </section>

            {/* 3. Cost Card (Target) */}
            <section
              ref={costRef}
              className={`bg-white rounded-[26px] px-6 pt-6 shadow-sm ${cardShadow} scroll-mt-20`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fee2e2] text-[#ef4444] text-[14px]">
                      🪙
                    </span>
                    {isAllSelected ? '누적 지출' : '지출'}
                  </div>
                  <div className="text-[18px] font-bold text-[#dc2626] mt-1">
                    {totalCost.toLocaleString()} 원
                  </div>
                </div>
                {totalCost > 0 && (
                  <button
                    onClick={() => openHistoryModal('cost')}
                    className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                  >
                    전체 내역 보기
                  </button>
                )}
              </div>

              {/* 데이터가 없으면 리스트 영역 숨김 (Minimal) */}
              {totalCost > 0 ? (
                <ScrollableList maxHeight="max-h-[320px]" className="space-y-4">
                  <div className="space-y-3">
                    {costEntries.map(([category, amount]) => {
                      const percentage = totalCost ? Math.round((amount / totalCost) * 100) : 0;
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="w-26 text-[12px] font-semibold text-[#4b5563]">
                            {category}
                          </div>
                          <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#fca5a5] to-[#ef4444] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                            {amount.toLocaleString()}원
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {costDetailEntries.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[13px] font-bold text-[#0f172a]">지출 내역</div>
                        <div className="text-xs text-[#6b7685]">
                          {detailCostTotal ? `총 ${detailCostTotal.toLocaleString()}원` : '없음'}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {costDetailEntries.map(([label, amount]) => {
                          const percentage = detailCostTotal
                            ? Math.round((amount / detailCostTotal) * 100)
                            : 0;
                          return (
                            <div key={label} className="flex items-center gap-3">
                              <div className="w-26 text-[12px] font-semibold text-[#4b5563] truncate">
                                {label}
                              </div>
                              <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#fca5a5] to-[#ef4444] rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                                {amount.toLocaleString()}원
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </ScrollableList>
              ) : (
                <div className="mt-2 text-[13px] text-gray-400 font-medium">
                  내역이 아직 없어요.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-[26px] border border-[#eef2f7] bg-white mb-3.5">
            <div className="w-14 h-14 rounded-full bg-[#fef3e7] flex items-center justify-center text-2xl">
              💸
            </div>
            <div className="text-sm font-semibold text-[#111827]">아직 재무 데이터가 없어요</div>
            <div className="text-xs text-[#6b7280]">
              체험단 스케줄을 추가하거나 부수입을 등록해보세요.
            </div>
          </div>
        )}

        <TrendChart
          currentMonthValue={econValue}
          monthlyGrowth={monthlyGrowth}
          selectedMonthKey={selectedMonthKey}
          selectedMonthLabel={selectedMonthLabelShort || displaySelectedMonthLabel}
          isPro={isPro}
          isAllSelected={isAllSelected}
        />
      </div>

      <ExtraIncomeModal
        isOpen={showIncomeModal}
        onClose={handleIncomeModalClose}
        onAddIncome={handleAddIncome}
        extraIncome={editingExtraIncome}
        onUpdateIncome={handleUpdateExtraIncome}
        onDeleteIncome={handleDeleteEditingIncome}
      />

      <IncomeHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        schedules={selectedMonthSchedules}
        extraIncomes={selectedMonthExtraIncomes}
        viewType={historyView}
        onDeleteExtraIncome={deleteExtraIncome}
        onScheduleItemClick={handleHistoryScheduleClick}
        onExtraIncomeItemClick={handleHistoryExtraIncomeClick}
        isDisabled={historyDisabled}
      />

      <Dialog open={showProGateModal} onOpenChange={setShowProGateModal}>
        <DialogContent className="max-w-[360px] rounded-[24px] p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[16px] font-bold text-[#0f172a]">
              PRO 기능이에요
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[#6b7280] leading-relaxed">
              전체 기간과 이전 달 통계는 PRO에서 제공돼요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:justify-start sm:items-stretch">
            <Button
              className="h-11 w-full rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
              onClick={() => {
                setShowProGateModal(false);
                router.push('/event');
              }}
            >
              PRO 혜택 받으러가기
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl text-sm font-semibold"
              onClick={() => setShowProGateModal(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TrendChart({
  currentMonthValue,
  monthlyGrowth,
  selectedMonthKey,
  selectedMonthLabel,
  isPro,
  isAllSelected,
}: {
  currentMonthValue: number;
  monthlyGrowth: MonthlyGrowth[];
  selectedMonthKey: string;
  selectedMonthLabel: string;
  isPro: boolean;
  isAllSelected: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const addSelectedIfMissing = (data: MonthlyGrowth[]) => {
    if (!selectedMonthKey) return data;
    if (selectedMonthKey === 'all') return data;
    if (data.some((item) => item.monthStart === selectedMonthKey)) return data;
    return [
      ...data,
      {
        monthStart: selectedMonthKey,
        benefitTotal: 0,
        incomeTotal: 0,
        costTotal: 0,
        extraIncomeTotal: 0,
        econValue: currentMonthValue,
      },
    ];
  };

  const sortedData = addSelectedIfMissing(monthlyGrowth)
    .slice()
    .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime());

  const uniqueSortedData = Array.from(
    sortedData
      .reduce((map, item) => map.set(item.monthStart, item), new Map<string, MonthlyGrowth>())
      .values()
  );

  const buildChartData = () => {
    if (isPro) {
      return uniqueSortedData;
    }
    if (isAllSelected) {
      return uniqueSortedData;
    }
    const latest = uniqueSortedData.slice(-4);
    if (!selectedMonthKey) return latest;
    if (latest.some((item) => item.monthStart === selectedMonthKey)) return latest;
    const selectedItem = uniqueSortedData.find((item) => item.monthStart === selectedMonthKey);
    if (!selectedItem) return latest;
    return [...latest.slice(1), selectedItem];
  };

  const chartData = buildChartData()
    .slice()
    .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime());

  const maxVal = Math.max(...chartData.map((d) => d.econValue), 10000);
  const minVal = Math.min(...chartData.map((d) => d.econValue), -10000);

  const range = maxVal - minVal;
  const padding = range * 0.2;
  const displayMax = maxVal + padding;
  const displayMin = minVal - padding;
  const displayRange = displayMax - displayMin;

  const zeroLinePercent = ((displayMax - 0) / displayRange) * 100;

  const formatMoneyShort = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 100000000) return `${sign}${Math.round(abs / 100000000)}억`;
    if (abs >= 10000) return `${sign}${Math.round(abs / 10000)}만`;
    if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}천`;
    if (abs === 0) return '0원';
    return `${sign}${abs.toLocaleString()}`;
  };

  const isScrollable = chartData.length > 4;

  useEffect(() => {
    if (isScrollable && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [isScrollable, chartData]);

  return (
    <div className="bg-white rounded-[26px] p-6 shadow-sm shadow-[0_14px_40px_rgba(18,34,64,0.08)] relative">
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5">
          <div className="text-[16px] font-bold text-[#0f172a]">월별 성장 추이</div>
        </div>

        {isScrollable && (
          <div className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-full animate-pulse">
            ← 옆으로 넘겨보세요
          </div>
        )}
      </div>

      <div className="text-xs text-[#9ca3af] font-semibold mb-6">
        {isPro ? '전체 기간의 활동 내역입니다' : '지난 4개월간의 활동입니다'}
      </div>

      <div className="relative w-full">
        {isScrollable && (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none"
              style={{ zIndex: Z_INDEX.sticky }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none"
              style={{ zIndex: Z_INDEX.sticky }}
            />
          </>
        )}

        <div
          ref={scrollRef}
          className={`w-full ${isScrollable ? 'overflow-x-auto pb-4 px-2 scrollbar-hide' : ''}`}
        >
          <div className={`flex flex-col ${isScrollable ? 'min-w-max' : 'w-full'}`}>
            <div className="relative h-[160px] w-full mb-2">
              <div
                className="absolute w-full border-t border-dashed border-gray-300"
                style={{ top: `${zeroLinePercent}%`, zIndex: Z_INDEX.background }}
              />

              <div
                className={`absolute inset-0 flex items-stretch ${
                  isScrollable ? 'justify-start gap-8 px-4' : 'justify-around px-2'
                }`}
                style={{ zIndex: Z_INDEX.content }}
              >
                {chartData.map((item) => {
                  const isActive = item.monthStart === selectedMonthKey;
                  const isNegative = item.econValue < 0;
                  const barHeightPercent = (Math.abs(item.econValue) / displayRange) * 100;

                  let barClass = '';
                  let valueClass = '';

                  if (isActive) {
                    if (isNegative) {
                      barClass =
                        'bg-gradient-to-b from-[#ff9a3c] to-[#ff3b0c] rounded-b-[10px] rounded-t-[2px] shadow-[0_4px_12px_rgba(255,59,12,0.25)]';
                      valueClass = 'text-[#ff3b0c] font-bold drop-shadow-sm';
                    } else {
                      barClass =
                        'bg-gradient-to-t from-[#2b5cff] to-[#5f80ff] rounded-t-[10px] rounded-b-[2px] shadow-[0_4px_12px_rgba(43,92,255,0.25)]';
                      valueClass = 'text-[#2b5cff] font-bold drop-shadow-sm';
                    }
                  } else {
                    if (isNegative) {
                      barClass = 'bg-[#fff0e6] rounded-b-[10px] rounded-t-[2px]';
                    } else {
                      barClass = 'bg-[#e7edf5] rounded-t-[10px] rounded-b-[2px]';
                    }
                    valueClass = 'text-[#9ca3af] font-semibold';
                  }

                  return (
                    <div
                      key={item.monthStart}
                      className="relative w-12 flex-none flex flex-col items-center group"
                    >
                      <div
                        className="absolute w-full flex justify-center transition-all duration-500"
                        style={{
                          top: isNegative ? `${zeroLinePercent}%` : 'auto',
                          bottom: isNegative ? 'auto' : `${100 - zeroLinePercent}%`,
                          height: `${Math.max(barHeightPercent, 1)}%`,
                        }}
                      >
                        <div className={`w-full h-full transition-all duration-500 ${barClass}`} />
                        <span
                          className={`absolute text-[11px] whitespace-nowrap transition-all duration-500 ${valueClass}`}
                          style={{
                            top: isNegative ? '100%' : 'auto',
                            bottom: isNegative ? 'auto' : '100%',
                            marginTop: '6px',
                            marginBottom: '6px',
                          }}
                        >
                          {formatMoneyShort(item.econValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={`w-full flex border-t border-transparent pt-1 ${
                isScrollable ? 'justify-start gap-8 px-4' : 'justify-around px-2'
              }`}
            >
              {chartData.map((item) => {
                const isActive = item.monthStart === selectedMonthKey;
                const isNegative = item.econValue < 0;
                const monthDate = new Date(item.monthStart);
                const label = isActive ? selectedMonthLabel : `${monthDate.getMonth() + 1}월`;

                const activeStyle = isActive
                  ? isNegative
                    ? 'text-[#ff3b0c] bg-[#fff0e6] border border-[#ff3b0c]/10 shadow-sm'
                    : 'text-[#2b5cff] bg-[#f0f6ff] border border-[#2b5cff]/10 shadow-sm'
                  : 'text-[#9ca3af]';

                return (
                  <div key={item.monthStart} className="w-12 flex-none flex justify-center">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full transition-colors duration-300 font-semibold whitespace-nowrap ${activeStyle}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
