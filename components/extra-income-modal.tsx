"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ExtraIncome } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

export default function ExtraIncomeModal({
  isOpen,
  onClose,
  onAddIncome,
}: {
  isOpen: boolean
  onClose: () => void
  onAddIncome: (income: Omit<ExtraIncome, "id">) => void
}) {
  const [newIncome, setNewIncome] = useState({
    title: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    memo: "",
  })
  const { toast } = useToast()

  // Reset form when modal closes
  const handleClose = () => {
    setNewIncome({
      title: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      memo: "",
    })
    onClose()
  }

  const handleAdd = () => {
    if (!newIncome.title.trim() || !newIncome.amount) {
      toast({
        title: "항목명과 금액을 입력해주세요",
        variant: "destructive",
        duration: 2000,
      })
      return
    }

    onAddIncome({
      title: newIncome.title.trim(),
      amount: Number(newIncome.amount.replace(/,/g, "")),
      date: newIncome.date,
      memo: newIncome.memo.trim(),
    })

    setNewIncome({
      title: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      memo: "",
    })

    toast({
      title: "부수입이 추가되었습니다",
      duration: 2000,
    })
    
    handleClose()
  }

  const formatNumber = (value: string) => {
    const number = value.replace(/,/g, "")
    if (!number || isNaN(Number(number))) return ""
    return Number(number).toLocaleString()
  }

  const handleAmountChange = (value: string) => {
    const formatted = formatNumber(value)
    setNewIncome({ ...newIncome, amount: formatted })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30" onClick={handleClose} style={{ touchAction: 'none' }} />
      <div className="absolute bottom-0 left-0 w-full h-[390px] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up">
        <div className="relative p-5 border-b border-neutral-100 text-center font-bold">
          부수입 추가
          <button
            onClick={handleClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Form */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 touch-pan-y">
          <div className="space-y-3">
          <input
            type="text"
            value={newIncome.title}
            onChange={(e) => setNewIncome({ ...newIncome, title: e.target.value })}
            placeholder="항목명 (예: 애드포스트 수익)"
            className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-orange-200"
          />
          <input
            type="text"
            value={newIncome.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="금액"
            className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-orange-200"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] text-left cursor-pointer">
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
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAdd}
              className="flex-1 h-12 bg-[#FF5722] text-white rounded-xl font-bold hover:bg-[#FF5722]/90 transition-colors"
            >
              추가
            </button>
          </div>
          </div>
        </div>
      </div>
    </>
  )
}
