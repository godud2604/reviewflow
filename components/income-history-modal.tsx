"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { Schedule, ExtraIncome } from "@/types"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type IncomeHistoryItem = {
  id: string
  title: string
  amount: number
  date: string
  category: Schedule["category"] | "기타"
  type: "schedule" | "extra"
  extraIncomeId?: number
}

export default function IncomeHistoryModal({
  isOpen,
  onClose,
  schedules,
  extraIncomes,
  onDeleteExtraIncome,
}: {
  isOpen: boolean
  onClose: () => void
  schedules: Schedule[]
  extraIncomes: ExtraIncome[]
  onDeleteExtraIncome?: (id: number) => Promise<boolean>
}) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const { toast } = useToast()

  // 체험단 항목: 제공 + 수익 - 지출을 합산하여 한 줄로 표현
  const scheduleItems = schedules
    .filter((s) => (s.benefit || 0) + (s.income || 0) + (s.cost || 0) !== 0)
    .map((s) => ({
      id: `schedule-${s.id}`,
      title: s.title,
      amount: (s.benefit || 0) + (s.income || 0) - (s.cost || 0),
      date: s.visit || s.dead,
      category: s.category,
      type: "schedule" as const,
    })) satisfies IncomeHistoryItem[]

  // 기타 부수입 항목들
  const extraIncomeItems = extraIncomes.map((income) => ({
    id: `extra-${income.id}`,
    title: income.title,
    amount: income.amount,
    date: income.date,
    category: "기타" as const,
    type: "extra" as const,
    extraIncomeId: income.id,
  })) satisfies IncomeHistoryItem[]

  // 모든 항목 합치기 및 날짜순 정렬
  const allItems = [...scheduleItems, ...extraIncomeItems].sort(
    (a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
  )

  const scheduleTotal = scheduleItems.reduce((sum, item) => sum + item.amount, 0)
  const totalExtra = extraIncomeItems.reduce((sum, item) => sum + item.amount, 0)
  const grandTotal = scheduleTotal + totalExtra
  const hasData = allItems.length > 0
  const containerHeightClass = hasData ? "h-[85%]" : "h-[50%]"

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return "방어한 생활비"
      case "extra":
        return "기타 부수입"
      default:
        return ""
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "extra":
        return "bg-blue-50 text-blue-700"
      case "schedule":
        return "bg-orange-50 text-orange-700"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  const handleDeleteExtraIncome = async (incomeId?: number) => {
    if (!incomeId || !onDeleteExtraIncome) return
    setDeletingId(incomeId)
    const success = await onDeleteExtraIncome(incomeId)
    setDeletingId(null)
    setDeleteTarget(null)

    toast({
      title: success ? "부수입이 삭제되었습니다" : "부수입 삭제에 실패했습니다",
      variant: success ? "default" : "destructive",
      duration: 2000,
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/50 backdrop-blur-sm z-30 overscroll-none" onClick={onClose} style={{ touchAction: 'none' }} />
      <div className={`absolute bottom-0 left-0 w-full ${containerHeightClass} bg-gradient-to-b from-neutral-50 to-white rounded-t-[32px] z-40 flex flex-col animate-slide-up overscroll-none shadow-2xl`}>
        {/* Header */}
        <div className="p-5 pb-3 text-center relative flex-shrink-0">
          <h2 className="text-[16px] font-bold text-neutral-900">이번달 전체 수입 내역</h2>
          <button
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Card */}
        <div className="relative mx-4 mt-1 mb-3 flex-shrink-0">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c] rounded-2xl p-5 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💰</span>
                  <span className="text-sm text-white/90 font-semibold">체험단 합산</span>
                </div>
                <span className="text-base font-bold text-white">₩{scheduleTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <span className="text-sm text-white/90 font-semibold">부수입</span>
                </div>
                <span className="text-base font-bold text-white">₩{totalExtra.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/20 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📈</span>
                  <span className="text-sm text-white/90 font-semibold">총 경제적 가치</span>
                </div>
                <span className="text-base font-bold text-white">₩{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent touch-pan-y">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">💸</span>
              </div>
              <p className="text-neutral-400 font-medium text-[12px]">아직 수입 내역이 없어요</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl p-4 shadow-sm transition-transform active:scale-[0.98] border border-neutral-100"
                >
                  <div className="flex items-start justify-between gap-3">
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
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {item.type === "extra" && item.extraIncomeId && (
                        <button
                          onClick={() => setDeleteTarget({ id: item.extraIncomeId!, title: item.title })}
                          disabled={deletingId === item.extraIncomeId}
                          className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      )}
                      <div className="text-right ml-3">
                        <div className={`text-lg font-bold mb-0.5 ${item.amount < 0 ? "text-red-500" : "text-[#333]"}`}>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">부수입 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              '{deleteTarget?.title ?? ""}' 항목을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteExtraIncome(deleteTarget?.id)}
              disabled={deletingId === deleteTarget?.id}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
