"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ExtraIncome } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { format } from "date-fns"
import { ko } from "date-fns/locale"

export default function ExtraIncomeModal({
  isOpen,
  onClose,
  onAddIncome,
  extraIncome,
  onUpdateIncome,
  onDeleteIncome,
}: {
  isOpen: boolean
  onClose: () => void
  onAddIncome: (income: Omit<ExtraIncome, "id">) => void
  extraIncome?: ExtraIncome | null
  onUpdateIncome?: (id: number, income: Omit<ExtraIncome, "id">) => Promise<boolean>
  onDeleteIncome?: (id: number) => Promise<boolean>
}) {
  const defaultDate = new Date().toISOString().split("T")[0]

  const formatNumber = (value: string) => {
    const number = value.replace(/,/g, "")
    if (!number || isNaN(Number(number))) return ""
    return Number(number).toLocaleString()
  }

  const getInitialForm = (income?: ExtraIncome | null) => ({
    title: income?.title ?? "",
    amount: income ? formatNumber(income.amount.toString()) : "",
    date: income?.date || defaultDate,
    memo: income?.memo ?? "",
  })

  const [newIncome, setNewIncome] = useState(() => getInitialForm(extraIncome))
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const isEditing = !!extraIncome

  useEffect(() => {
    setNewIncome(getInitialForm(extraIncome))
  }, [extraIncome, isOpen])

  // Reset form when modal closes
  const handleClose = () => {
    setIsDeleteDialogOpen(false)
    setNewIncome(getInitialForm())
    onClose()
  }

  const handleSave = async () => {
    if (!newIncome.title.trim() || !newIncome.amount) {
      toast({
        title: "항목명과 금액을 입력해주세요",
        variant: "destructive",
        duration: 2000,
      })
      return
    }

    const payload = {
      title: newIncome.title.trim(),
      amount: Number(newIncome.amount.replace(/,/g, "")),
      date: newIncome.date,
      memo: newIncome.memo.trim(),
    }

    if (isEditing && extraIncome && onUpdateIncome) {
      const success = await onUpdateIncome(extraIncome.id, payload)
      if (success) {
        toast({
          title: "부수입이 수정되었습니다",
          duration: 2000,
        })
        handleClose()
      }
      return
    }

    await onAddIncome(payload)

    toast({
      title: "부수입이 추가되었습니다",
      duration: 2000,
    })

    handleClose()
  }

  const handleDelete = async () => {
    if (!extraIncome || !onDeleteIncome) return

    const success = await onDeleteIncome(extraIncome.id)
    if (success) {
      toast({
        title: "부수입이 삭제되었습니다",
        duration: 2000,
      })
      handleClose()
    }
  }

  const handleDeleteClick = () => {
    if (!extraIncome || !onDeleteIncome) return
    setIsDeleteDialogOpen(true)
  }

  const handleAmountChange = (value: string) => {
    const formatted = formatNumber(value)
    setNewIncome({ ...newIncome, amount: formatted })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-50" onClick={handleClose} style={{ touchAction: 'none' }} />
      <div className="absolute bottom-0 left-0 w-full h-[430px] bg-white rounded-t-[30px] z-50 flex flex-col animate-slide-up">
        <div className="relative p-5 border-b border-neutral-100 text-center font-bold text-[16px]">
          {isEditing ? "부수입 수정" : "부수입 추가"}
          <button
            onClick={handleClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="px-6 text-[12px] text-[#6b7280] mt-3 leading-relaxed">
          체험단 외의 부업/임시 수입도 자유롭게 등록하면 월간 경제적 가치에 반영됩니다.
        </p>

        {/* Add Form */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 touch-pan-y">
          <div className="space-y-3">
          <input
            type="text"
            value={newIncome.title}
            onChange={(e) => setNewIncome({ ...newIncome, title: e.target.value })}
            placeholder="항목명 (예: 애드포스트 수익)"
            className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-orange-200"
          />
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9,]*"
            value={newIncome.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="금액"
            className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-orange-200"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[16px] text-left cursor-pointer">
                {newIncome.date ? format(new Date(newIncome.date), "PPP", { locale: ko }) : "날짜 선택"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newIncome.date ? new Date(newIncome.date) : undefined}
                onSelect={(date) =>
                  setNewIncome({
                    ...newIncome,
                    date: date ? format(date, "yyyy-MM-dd") : "",
                  })
                }
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          <input
            type="text"
            value={newIncome.memo}
            onChange={(e) => setNewIncome({ ...newIncome, memo: e.target.value })}
            placeholder="메모 (선택사항)"
            className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-orange-200"
          />
          <div className="flex gap-3 pt-2">
            {isEditing && extraIncome && onDeleteIncome && (
              <button
                onClick={handleDeleteClick}
                className="flex-2 h-14 px-6 bg-red-50 text-red-600 border border-red-200 font-bold text-base rounded-2xl hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            )}
            <button
              onClick={handleSave}
              className={`${isEditing && extraIncome && onDeleteIncome ? "flex-8" : "flex-1"} h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl hover:bg-[#FF5722]/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isEditing ? "저장" : "추가"}
            </button>
          </div>
          </div>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">부수입 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              "{extraIncome?.title ?? "부수입"}" 항목을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="h-10 px-6 text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
