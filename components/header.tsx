"use client"

import { FileText } from "lucide-react"
import type { Todo } from "@/types"

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

  return (
    <header className="px-6 pt-12 pb-1">
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
        <div
          className="w-10 h-10 rounded-full bg-neutral-200 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95"
          style={{
            backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
            backgroundSize: "cover",
          }}
          onClick={onProfileClick}
        />
      </div>
    </header>
  )
}
