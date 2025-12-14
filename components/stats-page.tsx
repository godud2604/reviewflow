"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Schedule, ExtraIncome, MonthlyGrowth, HistoryView } from "@/types"
import { useExtraIncomes } from "@/hooks/use-extra-incomes"
import ExtraIncomeModal from "./extra-income-modal"
import IncomeHistoryModal from "./income-history-modal"
import ShareEarningsModal from "./share-earnings-modal"
const incomeTutorialStorageKey = "reviewflow-stats-income-tutorial-shown"

type StatsPageProps = {
  schedules: Schedule[]
  onScheduleItemClick: (schedule: Schedule) => void
  isScheduleModalOpen: boolean
}

export default function StatsPage({
  schedules,
  onScheduleItemClick,
  isScheduleModalOpen,
}: StatsPageProps) {
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showIncomeTutorial, setShowIncomeTutorial] = useState(false)
  const [editingExtraIncome, setEditingExtraIncome] = useState<ExtraIncome | null>(null)
  const [historyView, setHistoryView] = useState<HistoryView>("all")
  const [showShareModal, setShowShareModal] = useState(false)
  const historyDisabled = showIncomeModal || isScheduleModalOpen
  const cardShadow = "shadow-[0_14px_40px_rgba(18,34,64,0.08)]"
  const toNumber = (value: unknown) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const openHistoryModal = (view: HistoryView) => {
    setHistoryView(view)
    setShowHistoryModal(true)
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  const currentMonthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(today)
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`

  const parseDate = (value?: string) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const isCurrentMonthDate = (date: Date | null) => {
    if (!date) return false
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth
  }

  const getScheduleDate = (schedule: Schedule) => parseDate(schedule.visit) || parseDate(schedule.dead)

  const createCategoryMap = (): Record<Schedule["category"], number> => ({
    "맛집/식품": 0,
    "뷰티": 0,
    "생활/리빙": 0,
    "출산/육아": 0,
    "주방/가전": 0,
    반려동물: 0,
    "여행/레저": 0,
    "티켓/문화생활": 0,
    "디지털/전자기기": 0,
    "건강/헬스": 0,
    "자동차/모빌리티": 0,
    "문구/오피스": 0,
    기타: 0,
  })
  
  // Supabase 연동 - useExtraIncomes 훅 사용
  const { extraIncomes, createExtraIncome, updateExtraIncome, deleteExtraIncome } = useExtraIncomes()

  const handleAddIncome = async (income: Omit<ExtraIncome, "id">) => {
    await createExtraIncome(income)
  }

  const handleOpenIncomeModal = (income?: ExtraIncome) => {
    setEditingExtraIncome(income ?? null)
    setShowIncomeModal(true)
    setShowIncomeTutorial(false)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(incomeTutorialStorageKey, "1")
    }
  }

  const handleIncomeModalClose = () => {
    setShowIncomeModal(false)
    setEditingExtraIncome(null)
  }

  const handleUpdateExtraIncome = (id: number, updates: Omit<ExtraIncome, "id">) => {
    return updateExtraIncome(id, updates)
  }

  const handleDeleteEditingIncome = (id: number) => {
    return deleteExtraIncome(id)
  }

  const handleHistoryScheduleClick = (schedule: Schedule) => {
    onScheduleItemClick(schedule)
  }

  const handleHistoryExtraIncomeClick = (income: ExtraIncome) => {
    handleOpenIncomeModal(income)
  }

  const currentMonthSchedules = useMemo(
    () => schedules.filter((schedule) => isCurrentMonthDate(getScheduleDate(schedule))),
    [schedules, currentYear, currentMonth]
  )

  const currentMonthExtraIncomes = useMemo(
    () => extraIncomes.filter((income) => isCurrentMonthDate(parseDate(income.date))),
    [extraIncomes, currentYear, currentMonth]
  )

  const { totalBen, totalInc, totalCost, benefitByCategory, incomeByCategory, costByCategory } = useMemo(() => {
    const benefitMap = createCategoryMap()
    const incomeMap = createCategoryMap()
    const costMap = createCategoryMap()
    let benefitTotal = 0
    let incomeTotal = 0
    let costTotal = 0

    currentMonthSchedules.forEach((s) => {
      const benefit = toNumber(s.benefit)
      const income = toNumber(s.income)
      const cost = toNumber(s.cost)

      benefitTotal += benefit
      incomeTotal += income
      costTotal += cost

      benefitMap[s.category] += benefit
      incomeMap[s.category] += income
      costMap[s.category] += cost
    })

    return {
      totalBen: benefitTotal,
      totalInc: incomeTotal,
      totalCost: costTotal,
      benefitByCategory: benefitMap,
      incomeByCategory: incomeMap,
      costByCategory: costMap,
    }
  }, [currentMonthSchedules])

  const totalExtraIncome = currentMonthExtraIncomes.reduce((sum, item) => sum + toNumber(item.amount), 0)
  const scheduleValue = totalBen + totalInc - totalCost
  // 경제적 가치 = 스케줄(제공+수익-지출) + 부수입
  const econValue = scheduleValue + totalExtraIncome
  const hasIncomeData = totalBen > 0 || totalInc > 0 || totalCost > 0 || totalExtraIncome > 0
  const [animatedEconValue, setAnimatedEconValue] = useState(0)
  const animatedValueRef = useRef(0)
  const animationRef = useRef<number | null>(null)
  const lastAnimatedValueRef = useRef<number | null>(null)

  // Animate the economic value once when the number becomes available
  useEffect(() => {
    const target = econValue
    if (lastAnimatedValueRef.current === target) return

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const start = animatedValueRef.current
    if (target === start) {
      lastAnimatedValueRef.current = target
      return
    }

    const duration = 900
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const nextValue = Math.round(start + (target - start) * eased)

      animatedValueRef.current = nextValue
      setAnimatedEconValue(nextValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
      } else {
        lastAnimatedValueRef.current = target
      }
    }

    animationRef.current = requestAnimationFrame(step)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [econValue])

  const hasAnyExtraIncome = extraIncomes.length > 0

  const getCategoryEntries = (categoryMap: Record<Schedule["category"], number>) =>
    (Object.entries(categoryMap) as [Schedule["category"], number][])
      .filter(([, amount]) => amount > 0)
      .sort(([, aAmount], [, bAmount]) => bAmount - aAmount)

  const benefitEntries = getCategoryEntries(benefitByCategory)
  const incomeEntries = getCategoryEntries(incomeByCategory)
  const costEntries = getCategoryEntries(costByCategory)

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = window.localStorage.getItem(incomeTutorialStorageKey)
    if (seen === "1" || hasAnyExtraIncome) {
      setShowIncomeTutorial(false)
      if (hasAnyExtraIncome) {
        window.localStorage.setItem(incomeTutorialStorageKey, "1")
      }
      return
    }
    setShowIncomeTutorial(true)
  }, [hasAnyExtraIncome])

  const monthlyGrowth: MonthlyGrowth[] = useMemo(() => {
    const monthMap = new Map<string, MonthlyGrowth>()

    const toMonthKey = (date: Date) => {
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      return `${year}-${month}-01`
    }

    const ensureEntry = (key: string) => {
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          monthStart: key,
          benefitTotal: 0,
          incomeTotal: 0,
          costTotal: 0,
          extraIncomeTotal: 0,
          econValue: 0,
        })
      }
      return monthMap.get(key)!
    }

    schedules.forEach((s) => {
      const date = parseDate(s.visit) || parseDate(s.dead)
      if (!date) return
      const key = toMonthKey(date)
      const entry = ensureEntry(key)
      entry.benefitTotal += toNumber(s.benefit)
      entry.incomeTotal += toNumber(s.income)
      entry.costTotal += toNumber(s.cost)
    })

    extraIncomes.forEach((income) => {
      const date = parseDate(income.date)
      if (!date) return
      const key = toMonthKey(date)
      const entry = ensureEntry(key)
      entry.extraIncomeTotal += toNumber(income.amount)
    })

    monthMap.forEach((entry) => {
      entry.econValue =
        (entry.benefitTotal || 0) +
        (entry.incomeTotal || 0) +
        (entry.extraIncomeTotal || 0) -
        (entry.costTotal || 0)
    })

    return Array.from(monthMap.values()).sort(
      (a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime()
    )
  }, [schedules, extraIncomes])

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[30px] p-6 mt-1 mb-5 bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
          <div className="relative flex items-start justify-between mb-5">
            <div>
              <div className="text-[14px] font-semibold text-white uppercase flex items-center gap-1 mb-2">
                이번 달 경제적 가치 <span role="img" aria-label="money bag">💰</span>
              </div>
              <div className="text-[32px] font-black leading-[1.05] text-white drop-shadow-[0_14px_36px_rgba(255,120,64,0.28)] tracking-tight">
                ₩ {animatedEconValue.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative inline-flex">
                <button
                  onClick={() => handleOpenIncomeModal()}
                  className="cursor-pointer px-2.5 py-2 rounded-full text-[11px] font-semibold text-white border border-white/35 bg-white/10 backdrop-blur-[2px] shadow-sm hover:bg-white/18 hover:border-white/50 transition-all active:scale-[0.98]"
                >
                  부수입 추가
                </button>
                {showIncomeTutorial && (
                  <div className="absolute -right-0 top-full mt-1 w-[190px] rounded-2xl border border-[#ebeef2] bg-white px-3 py-2.5 text-[11px] leading-snug text-[#111827] shadow-md">
                    <div className="text-[10px] font-semibold uppercase text-[#f97316] mb-1">부수입 가이드</div>
                    <p className="text-[11px] leading-tight">
                      이 버튼을 눌러 부수입을 추가해보세요
                    </p>
                    <span className="absolute -right-[-30px] top-[-7px] h-3 w-3 rotate-45 border-t border-r border-[#ebeef2] bg-white" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowShareModal(true)}
                className="cursor-pointer whitespace-nowrap px-3 py-2 rounded-full text-[11px] font-semibold text-white border border-white/40 bg-white/10 backdrop-blur-[2px] shadow-sm hover:bg-white/20 hover:border-white/60 transition-all active:scale-[0.98]"
              >
                💸 자랑하기
              </button>
            </div>
          </div>
          <div className="relative mt-3 mb-5 border-t border-white/20" />

          <div className="grid grid-cols-2 gap-3 text-sm relative">
            {/* 체험단 경제 효과 (메인 카드) */}
            <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-sm shadow-md ring-1 ring-white/20 text-white">
              <div className="text-[12px] font-semibold mb-1 tracking-tight">
                체험단 경제 효과
              </div>

              <div className="text-[10.5px] text-white/80 mb-2 leading-snug">
                방어한 생활비 + 현금 수입 − 실제 지출 기준
              </div>

              <div className="text-[18px] font-extrabold tracking-tight">
                ₩ {scheduleValue.toLocaleString()}
              </div>
            </div>

            {/* 부수입 카드 (서브 카드) */}
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm shadow-sm text-white/90">
              <div className="flex flex-col h-full justify-between min-h-[80px]">
                <div>
                  <div className="text-[12px] font-semibold mb-2">
                    부수입
                  </div>
                  <div className="text-[10.5px] text-white/80 mb-2 leading-snug">
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
          <div className="ml-1.5 text-[16px] font-bold text-[#0f172a]">이번 달 재무 상세</div>
          <button
            onClick={() => openHistoryModal("all")}
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
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fef4eb] text-[#f97316] text-[14px]">₩</span>
                    방어한 생활비
                  </div>
                  <div className="text-[18px] font-bold text-[#f97316] mt-1">{totalBen.toLocaleString()} 원</div>
                </div>
                <button
                  onClick={() => openHistoryModal("benefit")}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
              <p className="text-xs text-[#6b7280] mt-1">체험단에서 받은 제품/서비스 값 항목만 뽑아 보여줘요.</p>
              <div className="mt-4 space-y-3">
                {benefitEntries.map(([category, amount]) => {
                  const percentage = totalBen ? Math.round((amount / totalBen) * 100) : 0
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className="w-26 text-[12px] font-semibold text-[#4b5563]">{category}</div>
                      <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff9431] to-[#ff6b2c] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">{percentage}%</div>
                    </div>
                  )
                })}
                {!benefitEntries.length && (
                  <div className="text-xs text-[#9ca3af]">이번 달 방어된 생활비 내역이 아직 없어요.</div>
                )}
              </div>
            </section>

            <section className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff] text-[#2563eb] text-[14px]">💵</span>
                    수입
                  </div>
                  <div className="text-[18px] font-bold text-[#2563eb] mt-1">{(totalInc + totalExtraIncome).toLocaleString()} 원</div>
                </div>
                <button
                  onClick={() => openHistoryModal("income")}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
              <p className="text-xs text-[#6b7280] mt-1">체험단 현금 수입과 등록한 부수입을 한눈에 확인해보세요.</p>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-[#0f172a]">체험단 현금 수입</div>
                    <div className="text-xs text-[#6b7280]">{totalInc ? `₩ ${totalInc.toLocaleString()}` : "없음"}</div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {incomeEntries.map(([category, amount]) => {
                      const percentage = totalInc ? Math.round((amount / totalInc) * 100) : 0
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="w-26 text-[12px] font-semibold text-[#4b5563]">{category}</div>
                          <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">{percentage}%</div>
                        </div>
                      )
                    })}
                    {!incomeEntries.length && (
                      <div className="mt-[-3px] text-xs text-[#9ca3af]">스케줄 수입 내역이 없습니다.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold text-[#0f172a]">부수입</div>
                    <div className="text-xs text-[#6b7685]">{totalExtraIncome ? `₩ ${totalExtraIncome.toLocaleString()}` : "없음"}</div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {currentMonthExtraIncomes.length > 0 ? (
                      currentMonthExtraIncomes
                        .slice()
                        .sort((a, b) => b.amount - a.amount)
                        .map((income) => {
                          const percentage = totalExtraIncome
                            ? Math.round((income.amount / totalExtraIncome) * 100)
                            : 0
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
                              <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">{percentage}%</div>
                            </div>
                          )
                        })
                    ) : (
                      <div className="text-xs text-[#9ca3af]">등록한 부수입이 아직 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className={`bg-white rounded-[26px] p-6 shadow-sm ${cardShadow}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-[#0f172a] flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fee2e2] text-[#ef4444] text-[14px]">🪙</span>
                    지출
                  </div>
                  <div className="text-[18px] font-bold text-[#dc2626] mt-1">{totalCost.toLocaleString()} 원</div>
                </div>
                <button
                  onClick={() => openHistoryModal("cost")}
                  className="text-[12px] font-semibold text-[#6b7685] hover:text-[#111827] transition-colors"
                >
                  전체 내역 보기
                </button>
              </div>
              <p className="text-xs text-[#6b7280] mt-1">이번 달에 나간 비용들을 카테고리 별로 정리합니다.</p>
              <div className="mt-4 space-y-3">
                {costEntries.map(([category, amount]) => {
                  const percentage = totalCost ? Math.round((amount / totalCost) * 100) : 0
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className="w-26 text-[12px] font-semibold text-[#4b5563]">{category}</div>
                      <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#fca5a5] to-[#ef4444] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">{percentage}%</div>
                    </div>
                  )
                })}
                {!costEntries.length && (
                  <div className="text-xs text-[#9ca3af]">아직 지출 내역이 기록되지 않았습니다.</div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-[26px] border border-[#eef2f7] bg-white mb-3.5">
            <div className="w-14 h-14 rounded-full bg-[#fef3e7] flex items-center justify-center text-2xl">💸</div>
            <div className="text-sm font-semibold text-[#111827]">아직 재무 데이터가 없어요</div>
            <div className="text-xs text-[#6b7280]">체험단 스케줄을 추가하거나 부수입을 등록해보세요.</div>
          </div>
        )}
      
        {/* Trend Chart */}
        <TrendChart
          currentMonthValue={econValue}
          monthlyGrowth={monthlyGrowth}
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
        schedules={currentMonthSchedules}
        extraIncomes={currentMonthExtraIncomes}
        viewType={historyView}
        onDeleteExtraIncome={deleteExtraIncome}
        onScheduleItemClick={handleHistoryScheduleClick}
        onExtraIncomeItemClick={handleHistoryExtraIncomeClick}
        isDisabled={historyDisabled}
      />

      <ShareEarningsModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        currentMonthLabel={currentMonthLabel}
        currentMonthKey={currentMonthKey}
        econValue={econValue}
        scheduleValue={scheduleValue}
        totalBen={totalBen}
        totalInc={totalInc}
        totalCost={totalCost}
        totalExtraIncome={totalExtraIncome}
        monthlyGrowth={monthlyGrowth}
        benefitEntries={benefitEntries}
        costEntries={costEntries}
      />
    </>
  )
}

function TrendChart({
  currentMonthValue,
  monthlyGrowth,
}: {
  currentMonthValue: number
  monthlyGrowth: MonthlyGrowth[]
}) {
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`

  const isSameMonth = (monthStart: string) => {
    const date = new Date(monthStart)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }

  const addCurrentIfMissing = (data: MonthlyGrowth[]) => {
    if (data.some((item) => isSameMonth(item.monthStart))) return data
    return [
      ...data,
      {
        monthStart: currentMonthKey,
        benefitTotal: 0,
        incomeTotal: 0,
        costTotal: 0,
        extraIncomeTotal: 0,
        econValue: currentMonthValue,
      },
    ]
  }

  const sortedData = addCurrentIfMissing(monthlyGrowth)
    .slice()
    .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime())

  // Ensure unique months to avoid duplicate keys in the chart
  const uniqueSortedData = Array.from(
    sortedData.reduce((map, item) => map.set(item.monthStart, item), new Map<string, MonthlyGrowth>()).values()
  )

  const chartData = uniqueSortedData.slice(-4)
  const maxValue = Math.max(...chartData.map((item) => Math.abs(item.econValue)), 1)

  const bars = chartData.map((item) => {
    const monthDate = new Date(item.monthStart)
    const isCurrent = isSameMonth(item.monthStart)
    const height = Math.max(12, Math.round((Math.abs(item.econValue) / maxValue) * 90))

    return {
      key: item.monthStart,
      label: isCurrent ? "이번달" : `${monthDate.getMonth() + 1}월`,
      value: item.econValue,
      height,
      active: isCurrent,
    }
  })

  const formatMoneyShort = (value: number) => {
    const abs = Math.abs(value)
    const sign = value < 0 ? "-" : ""
    if (abs >= 100000000) return `${sign}${Math.round(abs / 100000000)}억`
    if (abs >= 10000) return `${sign}${Math.round(abs / 10000)}만`
    if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}천`
    if (abs === 0) return "0원"
    return `${sign}${abs.toLocaleString()}원`
  }

  return (
    <div className="bg-white rounded-[26px] p-6 shadow-sm shadow-[0_14px_40px_rgba(18,34,64,0.08)]">
      <div className="text-[16px] font-bold text-[#0f172a] mb-1">월별 성장 추이</div>
      <div className="text-xs text-[#9ca3af] font-semibold mb-5">
        지난 4개월간의 활동입니다
      </div>
      <div className="flex justify-start items-end h-[150px] pt-6 pb-4 gap-4">
        {bars.map((month) => (
          <div
            key={month.key}
            className={`w-[50%] rounded-[14px] relative flex justify-center transition-all duration-500 ${
              month.active ? "bg-gradient-to-t from-[#2b5cff] to-[#5f80ff]" : "bg-[#e7edf5]"
            }`}
            style={{ height: `${month.height}%` }}
          >
            <span className="absolute -top-6 text-xs font-bold text-[#0f172a]">
              {formatMoneyShort(month.value)}
            </span>
            <span className="absolute -bottom-6 text-xs text-[#9ca3af] font-semibold">{month.label}</span>
          </div>
        ))}
        {!bars.length && (
          <div className="text-sm text-[#9ca3af]">데이터가 없습니다. 스케줄을 추가해주세요.</div>
        )}
      </div>
    </div>
  )
}
