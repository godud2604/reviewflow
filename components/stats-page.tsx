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

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative">
        {/* Hero Card */}
        <div
          className="rounded-[30px] p-7 mb-6 relative overflow-hidden text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)" }}
        >
          <div className="text-[15px] font-semibold opacity-90">이번 달 경제적 가치 💰</div>
          <div className="text-[38px] font-extrabold mb-3 tracking-tight">₩ {econValue.toLocaleString()}</div>
          <div className="flex gap-5 border-t border-white/20 pt-5">
            <div className="flex-1">
              <div className="text-xs opacity-80 mb-1 font-medium">방어한 생활비</div>
              <div className="text-[15px] font-bold">{totalBen.toLocaleString()}</div>
            </div>
            <div className="flex-1 flex">
              <div>
                <div className="text-xs opacity-80 mb-1 flex items-start justify-start font-medium">
                  <span className="mr-2">부수입 관리</span>
                </div>
                <div className="text-[15px] font-bold">{totalIncomeWithExtra.toLocaleString()}</div>
              </div>
              <button
                onClick={() => setShowIncomeModal(true)}
                className="cursor-pointer h-6 px-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg text-[10px] text-white font-semibold transition-all translate-y-[-4px]"
              >
                <span className="mr-1">+</span>
                추가
              </button>
            </div>
          </div>
        </div>

        {/* Income Details - Always Visible */}
        <div className="bg-white rounded-3xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="text-lg font-bold">수입 상세 내역</div>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-sm text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              전체 내역 보기
              <span className="text-xs">→</span>
            </button>
          </div>
          
          {/* 방어한 생활비 섹션 */}
          {totalBen > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-neutral-700">💰 방어한 생활비</div>
                <div className="text-sm font-bold text-orange-600">{totalBen.toLocaleString()}원</div>
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
                        <div className="w-16 text-sm font-medium text-neutral-600">{category}</div>
                        <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-12 text-right text-xs text-neutral-400 font-medium">{percentage}%</div>
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
                <div className="text-sm font-semibold text-neutral-700">💵 부수입 (현금)</div>
                <div className="text-sm font-bold text-green-600">{totalIncomeWithExtra.toLocaleString()}원</div>
              </div>
              <div className="space-y-3 pl-2">
                {/* 리뷰 활동 수입 */}
                {totalInc > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 text-sm font-medium text-neutral-600">리뷰활동</div>
                    <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((totalInc / totalIncomeWithExtra) * 100)}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs text-neutral-400 font-medium">
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
                        <div className="w-16 text-sm font-medium text-neutral-600 truncate" title={income.title}>
                          {income.title}
                        </div>
                        <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm font-bold text-neutral-800">
                          {income.amount.toLocaleString()}원
                        </div>
                        <div className="w-12 text-right text-xs text-neutral-400 font-medium">{percentage}%</div>
                      </div>
                    )
                  })}
              </div>
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
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="text-lg font-bold mb-1">월별 성장 추이</div>
      <div className="text-xs text-neutral-400 font-medium mb-5">
        {loading ? "Supabase에서 불러오는 중..." : "지난 4개월간의 활동입니다"}
      </div>
      <div className="flex justify-start items-end h-[140px] pt-5 pb-5 gap-4">
        {bars.map((month) => (
          <div
            key={month.key}
            className={`w-[50%] rounded-lg relative flex justify-center transition-all duration-500 ${
              month.active ? "bg-[#651FFF]" : "bg-neutral-100"
            }`}
            style={{ height: `${month.height}%` }}
          >
            <span className="absolute -top-6 text-xs font-bold text-neutral-800">
              {formatMoneyShort(month.value)}
            </span>
            <span className="absolute -bottom-6 text-xs text-neutral-400 font-medium">{month.label}</span>
          </div>
        ))}
        {!bars.length && (
          <div className="text-sm text-neutral-400">데이터가 없습니다. 스케줄을 추가해주세요.</div>
        )}
      </div>
    </div>
  )
}
