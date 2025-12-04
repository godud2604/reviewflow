"use client"

import { useState } from "react"
import type { Schedule, ExtraIncome } from "@/types"
import ExtraIncomeModal from "./extra-income-modal"
import IncomeHistoryModal from "./income-history-modal"

export default function StatsPage({ schedules }: { schedules: Schedule[] }) {
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])

  const handleAddIncome = (income: Omit<ExtraIncome, "id">) => {
    const newIncome: ExtraIncome = {
      ...income,
      id: Date.now(),
    }
    setExtraIncomes([...extraIncomes, newIncome])
  }

  const handleDeleteIncome = (id: number) => {
    setExtraIncomes(extraIncomes.filter((income) => income.id !== id))
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
  const revenue = totalBen + totalIncomeWithExtra
  const rate = revenue > 0 ? Math.round(((revenue - totalCost) / revenue) * 100) : 0

  const handleShare = () => {
    alert("🔗 통계 링크가 복사되었습니다!")
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide relative">
      <div className="absolute top-2 right-5 z-10">
        <button
          onClick={handleShare}
          className="bg-white px-3 py-1.5 rounded-2xl text-sm font-semibold shadow-md cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          🔗 공유
        </button>
      </div>

      {/* Hero Card */}
      <div
        className="rounded-[30px] p-7 mb-6 relative overflow-hidden text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)" }}
      >
        <div className="text-[15px] font-semibold opacity-90 mb-2.5">이번 달 경제적 가치 💰</div>
        <div className="text-[38px] font-extrabold mb-6 tracking-tight">₩ {econValue.toLocaleString()}</div>
        <div className="flex gap-5 border-t border-white/20 pt-5">
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1 font-medium">총 수입</div>
            <div className="text-[15px] font-bold">{(totalBen + totalIncomeWithExtra).toLocaleString()}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1 flex items-start justify-start font-medium">
              <span className="mr-2">부수입 관리</span>
              <button
                onClick={() => setShowIncomeModal(true)}
                className="cursor-pointer px-2 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg text-[11px] text-white font-semibold transition-all flex items-center gap-1"
              >
                <span>+</span>
                추가
              </button>
            </div>
            <div className="text-[15px] font-bold">{totalIncomeWithExtra.toLocaleString()}</div>
          </div>
        </div>
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
      />

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
                      <div className="w-20 text-right text-sm font-bold text-neutral-800">
                        {amount.toLocaleString()}원
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
                  <div className="w-20 text-right text-sm font-bold text-neutral-800">
                    {totalInc.toLocaleString()}원
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
      <TrendChart currentMonthValue={econValue} />
    </div>
  )
}

function TrendChart({ currentMonthValue }: { currentMonthValue: number }) {
  const months = [
    { label: "9월", value: 120000, height: 30 },
    { label: "10월", value: 280000, height: 50 },
    { label: "11월", value: 210000, height: 40 },
    { label: "이번달", value: currentMonthValue, height: 85, active: true },
  ]

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="text-lg font-bold mb-1">월별 성장 추이</div>
      <div className="text-xs text-neutral-400 font-medium mb-5">지난 4개월간의 활동입니다</div>
      <div className="flex justify-between items-end h-[140px] pt-5 pb-5">
        {months.map((month, i) => (
          <div
            key={i}
            className={`w-[18%] rounded-lg relative flex justify-center transition-all duration-500 ${
              month.active ? "bg-[#651FFF]" : "bg-neutral-100"
            }`}
            style={{ height: `${month.height}%` }}
          >
            <span className="absolute -top-6 text-xs font-bold text-neutral-800">
              {Math.round(month.value / 10000)}만
            </span>
            <span className="absolute -bottom-6 text-xs text-neutral-400 font-medium">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
