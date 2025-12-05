"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import type { Schedule, ExtraIncome } from "@/types"

export default function IncomeHistoryModal({
  isOpen,
  onClose,
  schedules,
  extraIncomes,
}: {
  isOpen: boolean
  onClose: () => void
  schedules: Schedule[]
  extraIncomes: ExtraIncome[]
}) {
  // 방어한 생활비 항목들
  const benefitItems = schedules
    .filter((s) => s.benefit > 0)
    .map((s) => ({
      id: `schedule-benefit-${s.id}`,
      title: s.title,
      amount: s.benefit,
      date: s.visit || s.dead,
      category: s.category,
      type: "benefit" as const,
    }))

  // 리뷰 활동 수입 항목들
  const incomeItems = schedules
    .filter((s) => s.income > 0)
    .map((s) => ({
      id: `schedule-income-${s.id}`,
      title: s.title,
      amount: s.income,
      date: s.visit || s.dead,
      category: s.category,
      type: "income" as const,
    }))

  // 기타 부수입 항목들
  const extraIncomeItems = extraIncomes.map((income) => ({
    id: `extra-${income.id}`,
    title: income.title,
    amount: income.amount,
    date: income.date,
    category: "기타" as const,
    type: "extra" as const,
  }))

  // 모든 항목 합치기 및 날짜순 정렬
  const allItems = [...benefitItems, ...incomeItems, ...extraIncomeItems].sort(
    (a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
  )

  const totalBenefit = benefitItems.reduce((sum, item) => sum + item.amount, 0)
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0)
  const totalExtra = extraIncomeItems.reduce((sum, item) => sum + item.amount, 0)
  const grandTotal = totalBenefit + totalIncome + totalExtra

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "benefit":
        return "방어한 생활비"
      case "income":
        return "리뷰 수입"
      case "extra":
        return "기타 부수입"
      default:
        return ""
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "benefit":
        return "bg-orange-50 text-orange-700"
      case "income":
        return "bg-green-50 text-green-700"
      case "extra":
        return "bg-blue-50 text-blue-700"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/50 backdrop-blur-sm z-30 overscroll-none" onClick={onClose} style={{ touchAction: 'none' }} />
      <div className="absolute bottom-0 left-0 w-full h-[85%] bg-gradient-to-b from-neutral-50 to-white rounded-t-[32px] z-40 flex flex-col animate-slide-up overscroll-none shadow-2xl">
        {/* Header */}
        <div className="p-5 pb-3 text-center relative flex-shrink-0">
          <h2 className="text-xl font-bold text-neutral-900">전체 수입 내역</h2>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-neutral-300 rounded-full" />
        </div>

        {/* Summary Card */}
        <div className="relative mx-4 mt-1 mb-3 flex-shrink-0">
          <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-rose-500 rounded-2xl p-5 shadow-lg">
            {/* 세부 항목 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💰</span>
                  <span className="text-sm text-white/90 font-semibold">방어한 생활비</span>
                </div>
                <span className="text-base font-bold text-white">₩{totalBenefit.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💵</span>
                  <span className="text-sm text-white/90 font-semibold">리뷰 수입</span>
                </div>
                <span className="text-base font-bold text-white">₩{totalIncome.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <span className="text-sm text-white/90 font-semibold">기타 부수입</span>
                </div>
                <span className="text-base font-bold text-white">₩{totalExtra.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent touch-pan-y">
          {allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">💸</span>
              </div>
              <p className="text-neutral-400 font-medium text-sm">아직 수입 내역이 없어요</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl p-4 shadow-sm transition-transform active:scale-[0.98] border border-neutral-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-2 truncate">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">{item.category}</span>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-lg font-bold text-[#333] mb-0.5">
                        ₩{item.amount.toLocaleString()}
                      </div>
                      {item.date && (
                        <div className="text-[10px] text-neutral-400 font-medium">
                          {item.date}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
