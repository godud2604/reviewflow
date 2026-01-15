'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Schedule, ExtraIncome, MonthlyGrowth, HistoryView } from '@/types';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import { useStatsMonthly } from '@/hooks/use-stats-monthly';
import ExtraIncomeModal from './extra-income-modal';
import IncomeHistoryModal from './income-history-modal';
import { Z_INDEX } from '@/lib/z-index';
import {
  buildIncomeDetailsFromLegacy,
  parseIncomeDetailsJson,
  sumIncomeDetails,
} from '@/lib/schedule-income-details';

const incomeTutorialStorageKey = 'reviewflow-stats-income-tutorial-shown';

type StatsPageProps = {
  onScheduleItemClick: (schedule: Schedule) => void;
  isScheduleModalOpen: boolean;
  isPro: boolean;
};

export default function StatsPage({
  onScheduleItemClick,
  isScheduleModalOpen,
  isPro,
}: StatsPageProps) {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showIncomeTutorial, setShowIncomeTutorial] = useState(false);
  const [editingExtraIncome, setEditingExtraIncome] = useState<ExtraIncome | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>('all');
  const historyDisabled = showIncomeModal || isScheduleModalOpen;
  const cardShadow = 'shadow-[0_14px_40px_rgba(18,34,64,0.08)]';

  const monthScrollRef = useRef<HTMLDivElement>(null);

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
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const selectedMonthParam = selectedMonthKey.slice(0, 7);

  const getMonthStartDate = (monthKey: string) => {
    const date = new Date(monthKey);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatFullMonthLabel = (key: string) => {
    const date = getMonthStartDate(key);
    if (!date) return key;
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const formatMonthButtonLabel = (key: string) => {
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


  const createCategoryMap = (): Record<Schedule['category'], number> => ({
    '맛집/식품': 0,
    뷰티: 0,
    '생활/리빙': 0,
    '출산/육아': 0,
    '주방/가전': 0,
    반려동물: 0,
    '여행/레저': 0,
    '티켓/문화생활': 0,
    '디지털/전자기기': 0,
    '건강/헬스': 0,
    '자동차/모빌리티': 0,
    '문구/오피스': 0,
    기타: 0,
  });

  const { createExtraIncome, updateExtraIncome, deleteExtraIncome } = useExtraIncomes({
    enabled: false,
  });
  const {
    schedules: monthlySchedules,
    extraIncomes: monthlyExtraIncomes,
    monthlyGrowth,
    availableMonths,
    loading: statsLoading,
    refetch: refetchStats,
  } = useStatsMonthly({
    month: selectedMonthParam,
  });

  const handleAddIncome = async (income: Omit<ExtraIncome, 'id'>) => {
    const created = await createExtraIncome(income);
    if (created) {
      await refetchStats();
    }
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
    return updateExtraIncome(id, updates).then(async (success) => {
      if (success) {
        await refetchStats();
      }
      return success;
    });
  };

  const handleDeleteEditingIncome = (id: number) => {
    return deleteExtraIncome(id).then(async (success) => {
      if (success) {
        await refetchStats();
      }
      return success;
    });
  };

  const handleHistoryScheduleClick = (schedule: Schedule) => {
    onScheduleItemClick(schedule);
  };

  const handleHistoryExtraIncomeClick = (income: ExtraIncome) => {
    handleOpenIncomeModal(income);
  };

  const selectedMonthSchedules = useMemo(() => monthlySchedules, [monthlySchedules]);

  const selectedMonthExtraIncomes = useMemo(
    () => monthlyExtraIncomes,
    [monthlyExtraIncomes]
  );

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
  const econValue = scheduleValue + totalExtraIncome;
  const hasIncomeData = totalBen > 0 || totalInc > 0 || totalCost > 0 || totalExtraIncome > 0;
  const [animatedEconValue, setAnimatedEconValue] = useState(0);
  const animatedValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastAnimatedValueRef = useRef<number | null>(null);
  const wasScheduleModalOpenRef = useRef(isScheduleModalOpen);

  useEffect(() => {
    const target = econValue;
    if (lastAnimatedValueRef.current === target) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const start = animatedValueRef.current;
    if (target === start) {
      lastAnimatedValueRef.current = target;
      return;
    }

    const duration = 900;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(start + (target - start) * eased);

      animatedValueRef.current = nextValue;
      setAnimatedEconValue(nextValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        lastAnimatedValueRef.current = target;
      }
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [econValue]);

  const hasAnyExtraIncome = monthlyExtraIncomes.length > 0;

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
    if (wasScheduleModalOpenRef.current && !isScheduleModalOpen) {
      refetchStats();
    }
    wasScheduleModalOpenRef.current = isScheduleModalOpen;
  }, [isScheduleModalOpen, refetchStats]);

  useEffect(() => {
    if (!availableMonths.length) return;
    if (availableMonths.includes(selectedMonthKey)) return;
    const latest = availableMonths
      .slice()
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    if (latest) {
      setSelectedMonthKey(latest);
    }
  }, [availableMonths, selectedMonthKey]);

  const monthOptions = useMemo(() => {
    const monthKeys = availableMonths.length ? availableMonths : [currentMonthKey];
    const options = Array.from(new Set(monthKeys))
      .map((key) => {
        const date = getMonthStartDate(key);
        if (!date) return null;
        return { key, date, label: formatMonthButtonLabel(key) };
      })
      .filter((option): option is { key: string; date: Date; label: string } => option !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return options;
  }, [availableMonths, currentMonthKey]);

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative pt-4.5">
        {/* [수정] 상단 월 선택 영역: 그라데이션 제거하여 버튼이 가려지는 문제 해결 */}
        <div className="mb-4 relative">
          <div
            ref={monthScrollRef}
            className="flex gap-2 overflow-x-auto pb-1 px-5 -mx-5 scrollbar-hide snap-x"
          >
            {monthOptions.map((option) => {
              const isMonthLocked = !isPro && option.key !== currentMonthKey;
              return (
                <button
                  key={option.key}
                  onClick={() => {
                    if (isMonthLocked) return;
                    setSelectedMonthKey(option.key);
                  }}
                  disabled={isMonthLocked}
                  className={`mt-1 flex-none snap-start rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${
                    selectedMonthKey === option.key
                      ? 'bg-[#0f172a] text-white shadow-md'
                      : 'bg-white text-[#1f2937] border border-[#e5e7eb]'
                  } ${isMonthLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
            {/* 오른쪽 끝 여백 확보용 더미 div */}
            <div className="w-2 flex-none" />
          </div>
        </div>

        {statsLoading ? (
          <div className="space-y-4 mb-3.5 animate-pulse">
            <div className="relative overflow-hidden rounded-[30px] p-6 mt-1 mb-5 bg-gradient-to-br from-[#ffe1c7] via-[#ffd1b2] to-[#ffc1a2]">
              <div className="flex items-start justify-between mb-5">
                <div className="space-y-3">
                  <div className="h-3 w-40 rounded-full bg-white/60" />
                  <div className="h-9 w-52 rounded-full bg-white/70" />
                </div>
                <div className="h-8 w-20 rounded-full bg-white/60" />
              </div>
              <div className="h-px w-full bg-white/40 mb-5" />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/50 h-[92px] p-4 space-y-2">
                  <div className="h-3 w-24 rounded-full bg-white/70" />
                  <div className="h-4 w-32 rounded-full bg-white/70" />
                  <div className="h-5 w-20 rounded-full bg-white/80" />
                </div>
                <div className="rounded-2xl bg-white/40 h-[92px] p-4 space-y-2">
                  <div className="h-3 w-20 rounded-full bg-white/70" />
                  <div className="h-4 w-28 rounded-full bg-white/70" />
                  <div className="h-5 w-20 rounded-full bg-white/80" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-1">
              <div className="h-4 w-44 rounded-full bg-[#e5e7eb]" />
              <div className="h-3 w-20 rounded-full bg-[#e5e7eb]" />
            </div>

            <div className="bg-white rounded-[26px] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded-full bg-[#e5e7eb]" />
                <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
              </div>
              <div className="h-6 w-40 rounded-full bg-[#e5e7eb]" />
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="h-3 w-14 rounded-full bg-[#e5e7eb]" />
                    <div className="flex-1 h-2 rounded-full bg-[#eef2f7]" />
                    <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[26px] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded-full bg-[#e5e7eb]" />
                <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
              </div>
              <div className="h-6 w-36 rounded-full bg-[#e5e7eb]" />
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="h-3 w-14 rounded-full bg-[#e5e7eb]" />
                    <div className="flex-1 h-2 rounded-full bg-[#eef2f7]" />
                    <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[26px] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded-full bg-[#e5e7eb]" />
                <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
              </div>
              <div className="h-6 w-32 rounded-full bg-[#e5e7eb]" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="h-3 w-14 rounded-full bg-[#e5e7eb]" />
                    <div className="flex-1 h-2 rounded-full bg-[#eef2f7]" />
                    <div className="h-3 w-16 rounded-full bg-[#e5e7eb]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[26px] p-6 shadow-sm space-y-5">
              <div className="h-4 w-28 rounded-full bg-[#e5e7eb]" />
              <div className="h-3 w-40 rounded-full bg-[#eef2f7]" />
              <div className="flex items-end gap-6 h-[150px]">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex flex-col items-center gap-2">
                    <div className="h-[90px] w-8 rounded-[10px] bg-[#e5e7eb]" />
                    <div className="h-3 w-10 rounded-full bg-[#eef2f7]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[30px] p-6 mt-1 mb-5 bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
          <div className="relative flex items-start justify-between mb-5">
            <div>
              <div className="text-[14px] font-semibold text-white uppercase flex items-center gap-1 mb-2">
                {displaySelectedMonthLabel} 경제적 가치{' '}
                <span role="img" aria-label="money bag">
                  💰
                </span>
              </div>
              <div className="text-[32px] font-black leading-[1.05] text-white drop-shadow-[0_14px_36px_rgba(255,120,64,0.28)] tracking-tight">
                ₩ {animatedEconValue.toLocaleString()}
              </div>
            </div>
            <div className="relative inline-flex items-center">
              <button
                onClick={() => handleOpenIncomeModal()}
                className="cursor-pointer px-2.5 py-2 rounded-full text-[11px] font-semibold text-white border border-white/35 bg-white/10 backdrop-blur-[2px] shadow-sm hover:bg-white/18 hover:border-white/50 transition-all active:scale-[0.98]"
              >
                부수입 추가
              </button>
              {/* {showIncomeTutorial && (
                <div className="absolute -right-10 top-full mt-1 w-[160px] rounded-2xl border border-[#ebeef2] bg-white px-3 py-2.5 text-[11px] leading-snug text-[#111827] shadow-md">
                  <div className="text-[10px] font-semibold uppercase text-[#f97316] mb-1">
                    혹시 깜빡한 부수입, 없으신가요?
                  </div>
                  <p className="text-[11px] leading-tight">
                    부수입 입력하고 이번 달 총 가치를 높여보세요!
                  </p>
                  <span className="absolute -right-[-80px] top-[-7px] h-3 w-3 rotate-45 border-t border-r border-[#ebeef2] bg-white" />
                </div>
              )} */}
            </div>
          </div>
          <div className="relative mt-3 mb-5 border-t border-white/20" />

          <div className="grid grid-cols-2 gap-3 text-sm relative">
            <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-sm shadow-md ring-1 ring-white/20 text-white">
              <div className="text-[12px] font-semibold mb-1 tracking-tight">체험단 경제 효과</div>

              <div className="text-[10.5px] text-white/80 mb-2 leading-snug">
                방어한 생활비 + 현금 수입 − 실제 지출 기준
              </div>

              <div className="text-[16px] font-extrabold tracking-tight">
                ₩ {scheduleValue.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm shadow-sm text-white/90">
              <div className="flex flex-col h-full justify-between min-h-[80px]">
                <div>
                  <div className="text-[12px] font-semibold mb-1">부수입</div>
                  <div className="text-[10.5px] mb-1 text-white/80 leading-snug">
                    체험단 외의 부업/임시 수입
                  </div>
                </div>
                <div className="text-[16px] font-bold mt-auto">
                  ₩ {totalExtraIncome.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3.5">
          <div className="ml-1.5 text-[16px] font-bold text-[#0f172a]">
            {displaySelectedMonthLabel} 재무 상세
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
            <section className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fef4eb] text-[#f97316] text-[14px]">
                      ₩
                    </span>
                    방어한 생활비
                  </div>
                  <div className="text-[18px] font-bold text-[#f97316] mt-1">
                    {totalBen.toLocaleString()} 원
                  </div>
                </div>
                <button
                  onClick={() => openHistoryModal('benefit')}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
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
                {!benefitEntries.length && (
                  <div className="text-xs text-[#9ca3af]">
                    {displaySelectedMonthLabel} 방어된 생활비 내역이 아직 없어요.
                  </div>
                )}
              </div>
            </section>

            <section className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff] text-[#2563eb] text-[14px]">
                      💵
                    </span>
                    수입
                  </div>
                  <div className="text-[18px] font-bold text-[#2563eb] mt-1">
                    {(totalInc + totalExtraIncome).toLocaleString()} 원
                  </div>
                </div>
                <button
                  onClick={() => openHistoryModal('income')}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
              <p className="text-xs text-[#6b7280] mt-1">
                체험단 수입과 등록한 부수입을 한눈에 확인해보세요.
              </p>
              <div className="mt-4 space-y-4">
                <div>
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
                    {!incomeEntries.length && (
                      <div className="mt-[-3px] text-xs text-[#9ca3af]">
                        스케줄 수입 내역이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-[#0f172a]">체험단 수익 상세</div>
                    <div className="text-xs text-[#6b7685]">
                      {detailIncomeTotal ? `총 ${detailIncomeTotal.toLocaleString()}원` : '없음'}
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {incomeDetailEntries.map(([label, amount]) => {
                      const percentage = detailIncomeTotal
                        ? Math.round((amount / detailIncomeTotal) * 100)
                        : 0;
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-26 text-[12px] font-semibold text-[#4b5563]">
                            {label}
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
                    {!incomeDetailEntries.length && (
                      <div className="text-xs text-[#9ca3af]">상세 수익 내역이 없습니다.</div>
                    )}
                  </div>
                </div>

                {selectedMonthExtraIncomes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-bold text-[#0f172a]">부수입</div>
                      <div className="text-xs text-[#6b7685]">
                        {totalExtraIncome ? `총 ${totalExtraIncome.toLocaleString()}원` : '없음'}
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedMonthExtraIncomes.length > 0 ? (
                        selectedMonthExtraIncomes
                          .slice()
                          .sort((a, b) => b.amount - a.amount)
                          .map((income) => {
                            const percentage = totalExtraIncome
                              ? Math.round((income.amount / totalExtraIncome) * 100)
                              : 0;
                            return (
                              <div key={income.id} className="flex items-center gap-3">
                                <div
                                  className="w-26 text-[12px] font-semibold text-[#4b5563] truncate"
                                  title={income.title}
                                >
                                  {income.title}
                                </div>
                                <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="w-18 text-right text-xs text-[#9ca3af] font-semibold">
                                  {income.amount.toLocaleString()}원
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-[#9ca3af]">등록한 부수입이 아직 없습니다.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fee2e2] text-[#ef4444] text-[14px]">
                      🪙
                    </span>
                    지출
                  </div>
                  <div className="text-[18px] font-bold text-[#dc2626] mt-1">
                    {totalCost.toLocaleString()} 원
                  </div>
                </div>
                <button
                  onClick={() => openHistoryModal('cost')}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
              <p className="text-xs text-[#6b7280] mt-1">
                {displaySelectedMonthLabel}에 나간 비용들을 카테고리 별로 정리합니다.
              </p>
              <div className="mt-4 space-y-3">
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
                {!costEntries.length && (
                  <div className="text-xs text-[#9ca3af]">
                    아직 지출 내역이 기록되지 않았습니다.
                  </div>
                )}
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-[#0f172a]">체험단 지출 상세</div>
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
                        <div className="w-26 text-[12px] font-semibold text-[#4b5563]">{label}</div>
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
                  {!costDetailEntries.length && (
                    <div className="text-xs text-[#9ca3af]">상세 지출 내역이 없습니다.</div>
                  )}
                </div>
              </div>
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

        {/* Trend Chart (이전에 수정된 PRO 뱃지 로직 포함) */}
        <TrendChart
          currentMonthValue={econValue}
          monthlyGrowth={monthlyGrowth}
          selectedMonthKey={selectedMonthKey}
          selectedMonthLabel={selectedMonthLabelShort || displaySelectedMonthLabel}
          isPro={isPro}
        />
          </>
        )}
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
    </>
  );
}

function TrendChart({
  currentMonthValue,
  monthlyGrowth,
  selectedMonthKey,
  selectedMonthLabel,
  isPro,
}: {
  currentMonthValue: number;
  monthlyGrowth: MonthlyGrowth[];
  selectedMonthKey: string;
  selectedMonthLabel: string;
  isPro: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const addSelectedIfMissing = (data: MonthlyGrowth[]) => {
    if (!selectedMonthKey) return data;
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

          {/* {isPro && (
            <span className="inline-flex items-center justify-center rounded-[4px] bg-[#f97316] px-1.5 py-[3px] text-[10px] font-bold text-white leading-none shadow-sm">
              PRO
            </span>
          )} */}
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
