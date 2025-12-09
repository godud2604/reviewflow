"use client"

import { useState } from "react"
import type { Schedule, ExtraIncome, MonthlyGrowth } from "@/types"
import { useExtraIncomes } from "@/hooks/use-extra-incomes"
import { useMonthlyGrowth } from "@/hooks/use-monthly-growth"
import ExtraIncomeModal from "./extra-income-modal"
import IncomeHistoryModal from "./income-history-modal"
export default function StatsPage({ schedules }: { schedules: Schedule[] }) {
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const cardShadow = "shadow-[0_14px_40px_rgba(18,34,64,0.08)]"
  
  // Supabase 연동 - useExtraIncomes 훅 사용
  const { extraIncomes, createExtraIncome, deleteExtraIncome } = useExtraIncomes()
  const { monthlyGrowth, loading: monthlyGrowthLoading, refetch: refetchMonthlyGrowth } = useMonthlyGrowth()

  const handleAddIncome = async (income: Omit<ExtraIncome, "id">) => {
    const created = await createExtraIncome(income)
    if (created) {
      await refetchMonthlyGrowth()
    }
  }

  // Calculate stats
  let totalBen = 0,
    totalInc = 0,
    totalCost = 0
  const typeCounts: Record<Schedule["category"], number> = {
    맛집: 0,
    식품: 0,
    뷰티: 0,
    여행: 0,
    디지털: 0,
    반려동물: 0,
    기타: 0,
  }
  const benefitByCategory: Record<Schedule["category"], number> = {
    맛집: 0,
    식품: 0,
    뷰티: 0,
    여행: 0,
    디지털: 0,
    반려동물: 0,
    기타: 0,
  }

  schedules.forEach((s) => {
    totalBen += s.benefit
    totalInc += s.income
    totalCost += s.cost
    if (typeCounts[s.category] !== undefined) typeCounts[s.category]++
    if (s.benefit > 0) {
      benefitByCategory[s.category] += s.benefit
    }
  })

  const totalExtraIncome = extraIncomes.reduce((sum, item) => sum + item.amount, 0)
  const totalIncomeWithExtra = totalInc + totalExtraIncome

  const econValue = totalBen + totalIncomeWithExtra - totalCost
  const hasIncomeData = totalBen > 0 || totalIncomeWithExtra > 0

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[30px] p-6 mt-3 mb-3 bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
          <div className="relative flex items-start justify-between mb-5">
            <div>
              <div className="text-[14px] font-semibold text-white uppercase flex items-center gap-1">
                이번 달 경제적 가치 <span role="img" aria-label="money bag">💰</span>
              </div>
              <div className="text-[36px] font-black leading-[1.05] text-white drop-shadow-[0_14px_36px_rgba(255,120,64,0.28)] tracking-tight">
                ₩ {econValue.toLocaleString()}
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
              <div className="text-[18px] font-extrabold text-white">₩ {totalBen.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 shadow-sm text-white">
              <div className="text-[12px] text-white font-semibold mb-1">부수입 포함 현금</div>
              <div className="text-[18px] font-extrabold text-white">₩ {totalIncomeWithExtra.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Income Details - Always Visible */}
        <div className={`bg-white rounded-[26px] p-6 mb-3 shadow-sm ${cardShadow}`}>
          <div className="flex items-center justify-between mb-5">
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
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fef4eb] text-[#f97316] text-lg">₩</span>
                      방어한 생활비
                    </div>
                    <div className="text-sm font-bold text-[#f97316]">{totalBen.toLocaleString()}원</div>
                  </div>
                  <div className="space-y-3 pl-2">
                    {(Object.keys(benefitByCategory) as Schedule["category"][])
                      .filter((category) => benefitByCategory[category] > 0)
                      .sort((a, b) => benefitByCategory[b] - benefitByCategory[a])
                      .map((category) => {
                        const amount = benefitByCategory[category]
                        const percentage = Math.round((amount / totalBen) * 100)
                        
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
              {totalIncomeWithExtra > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef5ff] text-[#2563eb] text-lg">💵</span>
                      부수입 (현금)
                    </div>
                    <div className="text-sm font-bold text-[#2563eb]">{totalIncomeWithExtra.toLocaleString()}원</div>
                  </div>
                  <div className="space-y-3 pl-2">
                    {/* 리뷰 활동 수입 */}
                    {totalInc > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-16 text-sm font-semibold text-[#4b5563]">리뷰활동</div>
                        <div className="flex-1 bg-[#eef2f7] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((totalInc / totalIncomeWithExtra) * 100)}%` }}
                          />
                        </div>
                        <div className="w-12 text-right text-xs text-[#9ca3af] font-semibold">
                          {Math.round((totalInc / totalIncomeWithExtra) * 100)}%
                        </div>
                      </div>
                    )}
                    {/* 기타 부수입 */}
                    {extraIncomes
                      .sort((a, b) => b.amount - a.amount)
                      .map((income) => {
                        const percentage = Math.round((income.amount / totalIncomeWithExtra) * 100)
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
          loading={monthlyGrowthLoading}
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
  loading,
}: {
  currentMonthValue: number
  monthlyGrowth: MonthlyGrowth[]
  loading: boolean
}) {
  const now = new Date()
  const currentMonthKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

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

  const chartData = sortedData.slice(-4)
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
        {loading ? "데이터를 불러오는 중..." : "지난 4개월간의 활동입니다"}
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
