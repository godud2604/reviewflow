'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Schedule, ExtraIncome, MonthlyGrowth, HistoryView } from '@/types';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import ExtraIncomeModal from './extra-income-modal';
import IncomeHistoryModal from './income-history-modal';
const incomeTutorialStorageKey = 'reviewflow-stats-income-tutorial-shown';

type StatsPageProps = {
  schedules: Schedule[];
  onScheduleItemClick: (schedule: Schedule) => void;
  isScheduleModalOpen: boolean;
  isPro: boolean;
};

export default function StatsPage({
  schedules,
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

  const parseDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getMonthStartDate = (monthKey: string) => {
    const date = new Date(monthKey);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const selectedMonthDate = useMemo(() => getMonthStartDate(selectedMonthKey), [selectedMonthKey]);
  const isDateInSelectedMonth = (date: Date | null) => {
    if (!date || !selectedMonthDate) return false;
    return (
      date.getFullYear() === selectedMonthDate.getFullYear() &&
      date.getMonth() === selectedMonthDate.getMonth()
    );
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
    '티켓/문화생활': 0,
    '디지털/전자기기': 0,
    '건강/헬스': 0,
    '자동차/모빌리티': 0,
    '문구/오피스': 0,
    기타: 0,
  });

  // Supabase 연동 - useExtraIncomes 훅 사용
  const { extraIncomes, createExtraIncome, updateExtraIncome, deleteExtraIncome } =
    useExtraIncomes();

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

  const handleHistoryScheduleClick = (schedule: Schedule) => {
    onScheduleItemClick(schedule);
  };

  const handleHistoryExtraIncomeClick = (income: ExtraIncome) => {
    handleOpenIncomeModal(income);
  };

  const selectedMonthSchedules = useMemo(
    () => schedules.filter((schedule) => isDateInSelectedMonth(getScheduleDate(schedule))),
    [schedules, selectedMonthKey, selectedMonthDate]
  );

  const selectedMonthExtraIncomes = useMemo(
    () => extraIncomes.filter((income) => isDateInSelectedMonth(parseDate(income.date))),
    [extraIncomes, selectedMonthKey, selectedMonthDate]
  );

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
  // 경제적 가치 = 스케줄(제공+수익-지출) + 부수입
  const econValue = scheduleValue + totalExtraIncome;
  const hasIncomeData = totalBen > 0 || totalInc > 0 || totalCost > 0 || totalExtraIncome > 0;
  const [animatedEconValue, setAnimatedEconValue] = useState(0);
  const animatedValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastAnimatedValueRef = useRef<number | null>(null);

  // Animate the economic value once when the number becomes available
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
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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

  const hasAnyExtraIncome = extraIncomes.length > 0;

  const getCategoryEntries = (categoryMap: Record<Schedule['category'], number>) =>
    (Object.entries(categoryMap) as [Schedule['category'], number][])
      .filter(([, amount]) => amount > 0)
      .sort(([, aAmount], [, bAmount]) => bAmount - aAmount);

  const benefitEntries = getCategoryEntries(benefitByCategory);
  const incomeEntries = getCategoryEntries(incomeByCategory);
  const costEntries = getCategoryEntries(costByCategory);

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

    schedules.forEach((s) => {
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
  }, [schedules, extraIncomes]);

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

    return options;
  }, [monthlyGrowth, currentMonthKey]);

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative pt-4.5">
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
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
                  className={`mt-1 flex-none rounded-full px-4 py-2 text-xs font-semibold transition ${
                    selectedMonthKey === option.key
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-white text-[#1f2937] border border-[#e5e7eb]'
                  } ${isMonthLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
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
              {showIncomeTutorial && (
                <div className="absolute -right-10 top-full mt-1 w-[160px] rounded-2xl border border-[#ebeef2] bg-white px-3 py-2.5 text-[11px] leading-snug text-[#111827] shadow-md">
                  <div className="text-[10px] font-semibold uppercase text-[#f97316] mb-1">
                    혹시 깜빡한 부수입, 없으신가요?
                  </div>
                  <p className="text-[11px] leading-tight">
                    부수입 입력하고 이번 달 총 가치를 높여보세요!
                  </p>
                  <span className="absolute -right-[-80px] top-[-7px] h-3 w-3 rotate-45 border-t border-r border-[#ebeef2] bg-white" />
                </div>
              )}
            </div>
          </div>
          <div className="relative mt-3 mb-5 border-t border-white/20" />

          <div className="grid grid-cols-2 gap-3 text-sm relative">
            {/* 체험단 경제 효과 (메인 카드) */}
            <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-sm shadow-md ring-1 ring-white/20 text-white">
              <div className="text-[12px] font-semibold mb-1 tracking-tight">체험단 경제 효과</div>

              <div className="text-[10.5px] text-white/80 mb-2 leading-snug">
                방어한 생활비 + 현금 수입 − 실제 지출 기준
              </div>

              <div className="text-[16px] font-extrabold tracking-tight">
                ₩ {scheduleValue.toLocaleString()}
              </div>
            </div>

            {/* 부수입 카드 (서브 카드) */}
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
                      <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">
                        {percentage}%
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
                체험단 현금 수입과 등록한 부수입을 한눈에 확인해보세요.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-[#0f172a]">체험단 현금 수입</div>
                    <div className="text-xs text-[#6b7280]">
                      {totalInc ? `₩ ${totalInc.toLocaleString()}` : '없음'}
                    </div>
                  </div>
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
                          <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">
                            {percentage}%
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

                {selectedMonthExtraIncomes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-bold text-[#0f172a]">부수입</div>
                      <div className="text-xs text-[#6b7685]">
                        {totalExtraIncome ? `₩ ${totalExtraIncome.toLocaleString()}` : '없음'}
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
                                <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">
                                  {percentage}%
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
                      <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">
                        {percentage}%
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

        {/* Trend Chart */}
        <TrendChart
          currentMonthValue={econValue}
          monthlyGrowth={monthlyGrowth}
          selectedMonthKey={selectedMonthKey}
          selectedMonthLabel={selectedMonthLabelShort || displaySelectedMonthLabel}
        />
      </div>

      {/* Extra Income Modal */}
      <ExtraIncomeModal
        isOpen={showIncomeModal}
        onClose={handleIncomeModalClose}
        onAddIncome={handleAddIncome}
        extraIncome={editingExtraIncome}
        onUpdateIncome={handleUpdateExtraIncome}
        onDeleteIncome={handleDeleteEditingIncome}
      />

      {/* Income History Modal */}
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
}: {
  currentMonthValue: number;
  monthlyGrowth: MonthlyGrowth[];
  selectedMonthKey: string;
  selectedMonthLabel: string;
}) {
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

  // 1. 최대 양수값과 최소 음수값 계산
  const maxVal = Math.max(...chartData.map((d) => d.econValue), 10000);
  const minVal = Math.min(...chartData.map((d) => d.econValue), -10000);

  // 2. 전체 범위 계산 (여유 공간 20% 확보 - 텍스트 공간 확보용)
  const range = maxVal - minVal;
  const padding = range * 0.2;
  const displayMax = maxVal + padding;
  const displayMin = minVal - padding;
  const displayRange = displayMax - displayMin;

  // 3. 0원 기준선 위치 계산 (%)
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

  return (
    <div className="bg-white rounded-[26px] p-6 shadow-sm shadow-[0_14px_40px_rgba(18,34,64,0.08)]">
      <div className="text-[16px] font-bold text-[#0f172a] mb-1">월별 성장 추이</div>
      <div className="text-xs text-[#9ca3af] font-semibold mb-6">지난 4개월간의 활동입니다</div>

      {/* 컨테이너: 그래프 영역과 라벨 영역을 Flex로 분리 */}
      <div className="flex flex-col w-full">
        {/* A. 그래프 영역 (높이 고정) */}
        <div className="relative h-[160px] w-full mb-2">
          {/* 0원 기준선 */}
          <div
            className="absolute w-full border-t border-dashed border-gray-300 z-0"
            style={{ top: `${zeroLinePercent}%` }}
          />

          <div className="absolute inset-0 flex justify-around items-stretch z-10 px-2">
            {chartData.map((item) => {
              const isActive = item.monthStart === selectedMonthKey;
              const isNegative = item.econValue < 0;

              // 막대 높이 (%)
              const barHeightPercent = (Math.abs(item.econValue) / displayRange) * 100;

              // 스타일 결정
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
                <div key={item.monthStart} className="relative w-12 flex flex-col items-center">
                  {/* 막대 Wrapper */}
                  <div
                    className="absolute w-full flex justify-center transition-all duration-500"
                    style={{
                      top: isNegative ? `${zeroLinePercent}%` : 'auto',
                      bottom: isNegative ? 'auto' : `${100 - zeroLinePercent}%`,
                      height: `${Math.max(barHeightPercent, 1)}%`,
                    }}
                  >
                    {/* 실제 막대 */}
                    <div className={`w-full h-full transition-all duration-500 ${barClass}`} />

                    {/* 금액 텍스트 */}
                    <span
                      className={`absolute text-[11px] whitespace-nowrap transition-all duration-500 ${valueClass}`}
                      style={{
                        top: isNegative ? '100%' : 'auto',
                        bottom: isNegative ? 'auto' : '100%',
                        marginTop: '6px', // 막대와 텍스트 사이 간격
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

        {/* B. X축 날짜 라벨 영역 (그래프 영역 밖으로 뺌) */}
        <div className="w-full flex justify-around px-2 pt-1 border-t border-transparent">
          {chartData.map((item) => {
            const isActive = item.monthStart === selectedMonthKey;
            const isNegative = item.econValue < 0;
            const monthDate = new Date(item.monthStart);
            const label = isActive ? selectedMonthLabel : `${monthDate.getMonth() + 1}월`;

            // 활성 상태 스타일
            const activeStyle = isActive
              ? isNegative
                ? 'text-[#ff3b0c] bg-[#fff0e6] border border-[#ff3b0c]/10 shadow-sm'
                : 'text-[#2b5cff] bg-[#f0f6ff] border border-[#2b5cff]/10 shadow-sm'
              : 'text-[#9ca3af]';

            return (
              <div key={item.monthStart} className="w-12 flex justify-center">
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors duration-300 font-semibold ${activeStyle}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
