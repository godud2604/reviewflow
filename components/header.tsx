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
    <header className="px-6 pt-6">
      <div className="flex items-center justify-between mb-2">
        {showTodoButton ? (
          <button
            onClick={onTodoClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm hover:shadow-md transition-all active:scale-95 border border-neutral-200 relative"
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
      <div className="mt-3 mb-4 bg-gradient-to-r from-orange-50 to-white border border-orange-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner text-xl">🚀</div>
          <div>
            <div className="text-xs font-bold text-orange-700">12월 20일 베타 오픈</div>
            <div className="text-[13px] text-neutral-600 font-semibold">사전신청하고 3개월 무료 혜택 받기</div>
          </div>
        </div>
        <button
          onClick={handlePreRegisterClick}
          className="bg-[#FF5722] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-orange-500/30 hover:bg-[#E64A19] transition cursor-pointer whitespace-nowrap"
        >
          사전신청
        </button>
      </div>
    </header>
  )
}
