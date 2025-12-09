"use client"

import { FileText } from "lucide-react"
import type { Todo } from "@/types"
import { useRouter } from "next/navigation"

export default function Header({ 
  title, 
  onProfileClick, 
  onTodoClick,
  todos,
  showTodoButton = true
}: { 
  title: string
  onProfileClick: () => void
  onTodoClick: () => void
  todos: Todo[]
  showTodoButton?: boolean
}) {
  const incompleteTodoCount = todos.filter(t => !t.done).length
  const router = useRouter()

  const handlePreRegisterClick = () => {
    router.push("/#waitlist-section")
  }

  return (
    <header className="px-5 pt-2 space-y-3">
      <div className="flex items-center justify-between">
        {showTodoButton ? (
          <button
            onClick={onTodoClick}
            className="flex items-center gap-1.5 px-3.5 py-2 mt-2 rounded-full bg-white shadow-sm hover:border-neutral-300 transition-all active:scale-95 relative"
          >
            <FileText className="w-4 h-4 text-neutral-700" />
            <span className="text-[13px] font-semibold text-neutral-700 cursor-pointer">할 일</span>
            {incompleteTodoCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                {incompleteTodoCount}
              </span>
            )}
          </button>
        ) : (
          <div />
        )}
      </div>
      <section className="rounded-3xl shadow-sm shadow-sm bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-neutral-50 flex items-center justify-center text-xl">🚀</div>
          <div className="flex-1 space-y-1">
            <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.08em]">12월 20일 베타 오픈</div>
            <div className="text-[13px] text-neutral-800 font-semibold leading-snug">사전신청 시 3개월 무료 혜택을 받을 수 있어요</div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePreRegisterClick}
                className="bg-[#ff5c39] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#ff734f] transition cursor-pointer whitespace-nowrap"
              >
                사전신청
              </button>
              <span className="text-[11px] font-medium text-neutral-500">선착순 알림 받아보기</span>
            </div>
          </div>
        </div>
      </section>
    </header>
  )
}
