"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Schedule, ExtraIncome, MonthlyGrowth } from "@/types"
import { useExtraIncomes } from "@/hooks/use-extra-incomes"
import ExtraIncomeModal from "./extra-income-modal"
import IncomeHistoryModal from "./income-history-modal"
export default function StatsPage({ schedules }: { schedules: Schedule[] }) {
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const cardShadow = "shadow-[0_14px_40px_rgba(18,34,64,0.08)]"
  const toNumber = (value: unknown) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }
  
  // Supabase 연동 - useExtraIncomes 훅 사용
  const { extraIncomes, createExtraIncome, deleteExtraIncome } = useExtraIncomes()

  const handleAddIncome = async (income: Omit<ExtraIncome, "id">) => {
    await createExtraIncome(income)
  }

  // Calculate stats
  let totalBen = 0,
    totalInc = 0,
    totalCost = 0
  const typeCounts: Record<Schedule["category"], number> = {
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
  }
  const benefitByCategory: Record<Schedule["category"], number> = {
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
  }

  schedules.forEach((s) => {
    const benefit = toNumber(s.benefit)
    const income = toNumber(s.income)
    const cost = toNumber(s.cost)

    totalBen += benefit
    totalInc += income
    totalCost += cost
    if (typeCounts[s.category] !== undefined) typeCounts[s.category]++

    // Category contribution uses full schedule economic value (benefit + income - cost)
    const categoryValue = benefit + income - cost
    if (categoryValue !== 0) {
      benefitByCategory[s.category] += categoryValue
    }
  })

  console.log('schedules', schedules)

  const totalExtraIncome = extraIncomes.reduce((sum, item) => sum + toNumber(item.amount), 0)
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

  const monthlyGrowth: MonthlyGrowth[] = useMemo(() => {
    const monthMap = new Map<string, MonthlyGrowth>()

    const toMonthKey = (date: Date) => {
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      return `${year}-${month}-01`
    }

    const parseDate = (value?: string) => {
      if (!value) return null
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? null : d
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
      const date = parseDate(s.visit) || parseDate(s.dead) || new Date()
      const key = toMonthKey(date)
      const entry = ensureEntry(key)
      entry.benefitTotal += toNumber(s.benefit)
      entry.incomeTotal += toNumber(s.income)
      entry.costTotal += toNumber(s.cost)
    })

    extraIncomes.forEach((income) => {
      const date = parseDate(income.date) || new Date()
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
        <div className="relative overflow-hidden rounded-[30px] p-6 mt-3 mb-3.5 bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
          <div className="relative flex items-start justify-between mb-5">
            <div>
              <div className="text-[14px] font-semibold text-white uppercase flex items-center gap-1 mb-1">
                이번 달 경제적 가치 <span role="img" aria-label="money bag">💰</span>
              </div>
              <div className="text-[36px] font-black leading-[1.05] text-white drop-shadow-[0_14px_36px_rgba(255,120,64,0.28)] tracking-tight">
                ₩ {animatedEconValue.toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => setShowIncomeModal(true)}
              className="cursor-pointer px-3 py-2 rounded-full text-[11px] font-semibold text-white border border-white/35 bg-white/10 backdrop-blur-[2px] shadow-sm hover:bg-white/18 hover:border-white/50 transition-all active:scale-[0.98]"
            >
              부수입 추가
            </button>
          </div>
          <div className="relative mt-2 mb-4 border-t border-white/25" />
          <div className="grid grid-cols-2 gap-3 text-sm relative">
            <div className="p-4 rounded-2xl bg-white/10 shadow-sm text-white">
              <div className="text-[12px] text-white font-semibold mb-1">방어한 생활비</div>
              <div className="text-[14px] font-extrabold text-white">₩ {scheduleValue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 shadow-sm text-white">
              <div className="text-[12px] text-white font-semibold mb-1">부수입</div>
              <div className="text-[14px] font-extrabold text-white">₩ {totalExtraIncome.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Income Details - Always Visible */}
        <div className={`bg-white rounded-[26px] p-6 mb-3.5 shadow-sm ${cardShadow}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[16px] font-bold text-[#0f172a]">수입 상세 내역</div>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[12px] text-[#6b7685] hover:text-[#111827] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              전체 내역 보기
              <span className="text-xs">→</span>
            </button>
          </div>
          
          {hasIncomeData ? (
            <>
              {/* 방어한 생활비 섹션 */}
              {totalBen > 0 && (
                <div className="">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fef4eb] text-[#f97316] text-[14px]">₩</span>
                      <span className="text-[14px]">방어한 생활비</span>
                    </div>
                    <div className="text-[14px] font-bold text-[#f97316]">{scheduleValue.toLocaleString()}원</div>
                  </div>
                  <div className="space-y-3 pl-2">
                    {(Object.keys(benefitByCategory) as Schedule["category"][])
                      .filter((category) => benefitByCategory[category] > 0)
                      .sort((a, b) => benefitByCategory[b] - benefitByCategory[a])
                      .map((category) => {
                        const amount = benefitByCategory[category]
                        const percentage = Math.round((amount / scheduleValue) * 100)

                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="w-16 text-sm font-semibold text-[#4b5563]">{category}</div>
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
                  </div>
                </div>
              )}

              {/* 부수입 섹션 */}
              {totalExtraIncome > 0 && (
                <div>
                  <div className="flex items-center justify-between mt-6 mb-3">
                    <div className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff] text-[#2563eb] text-[14px]">💵</span>
                      <span className="text-[14px]">부수입 (현금)</span>
                    </div>
                    <div className="text-[14px] font-bold text-[#2563eb]">{totalExtraIncome.toLocaleString()}원</div>
                  </div>
                  <div className="space-y-3 pl-2">
                    {extraIncomes
                      .sort((a, b) => b.amount - a.amount)
                      .map((income) => {
                        const percentage = Math.round((income.amount / totalExtraIncome) * 100)
                        return (
                          <div key={income.id} className="flex items-center gap-3">
                            <div className="w-16 text-sm font-semibold text-[#4b5563] truncate" title={income.title}>
                              {income.title}
                            </div>
                            <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="w-20 text-right text-sm font-bold text-[#0f172a]">
                              {income.amount.toLocaleString()}원
                            </div>
                            <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">{percentage}%</div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl bg-gradient-to-br from-[#f8fafc] via-white to-[#f8fafc] border border-[#eef2f7]">
              <div className="w-14 h-14 rounded-full bg-[#fef3e7] flex items-center justify-center text-2xl">💸</div>
              <div className="text-sm font-semibold text-[#111827]">아직 수입 데이터가 없어요</div>
              <div className="text-xs text-[#6b7280]">체험단 스케줄을 추가하거나 부수입을 등록해보세요.</div>
            </div>
          )}
        </div>
      
        {/* Trend Chart */}
        <TrendChart
          currentMonthValue={econValue}
          monthlyGrowth={monthlyGrowth}
        />
      </div>
      
      {/* Extra Income Modal */}
      <ExtraIncomeModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        onAddIncome={handleAddIncome}
      />

      {/* Income History Modal */}
      <IncomeHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        schedules={schedules}
        extraIncomes={extraIncomes}
        onDeleteExtraIncome={deleteExtraIncome}
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
