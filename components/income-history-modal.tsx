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
        return "bg-orange-50 text-orange-600 border-orange-100"
      case "income":
        return "bg-green-50 text-green-600 border-green-100"
      case "extra":
        return "bg-blue-50 text-blue-600 border-blue-100"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30 overscroll-none" onClick={onClose} style={{ touchAction: 'none' }} />
      <div className="absolute bottom-0 left-0 w-full h-[80%] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up overscroll-none">
        <div className="p-5 border-b border-neutral-100 text-center font-bold">전체 수입 내역</div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-8 py-5 mx-6 mt-6 rounded-2xl flex-shrink-0">
          <div className="text-sm text-orange-800 font-semibold">총 수입</div>
          <div className="text-[32px] font-extrabold text-orange-900 mb-3">₩ {grandTotal.toLocaleString()}</div>
          <div className="flex justify-between text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-orange-600 font-medium">방어한 생활비</span>
              <span className="font-bold text-orange-900">{totalBenefit.toLocaleString()}원</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-orange-600 font-medium">리뷰 수입</span>
              <span className="font-bold text-orange-900">{totalIncome.toLocaleString()}원</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-orange-600 font-medium">기타 부수입</span>
              <span className="font-bold text-orange-900">{totalExtra.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent touch-pan-y">
          {allItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 font-medium text-sm">
              아직 수입 내역이 없어요
            </div>
          ) : (
            <div className="space-y-3">
              {allItems.map((item) => (
                <div key={item.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-base font-semibold text-neutral-800 mb-2">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-neutral-400 font-medium">{item.category}</span>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-xl font-bold text-neutral-900 mb-1">
                        +{item.amount.toLocaleString()}원
                      </div>
                      {item.date && (
                        <div className="text-xs text-neutral-400 font-medium">
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
