"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import type { Todo } from "@/types"

export default function TodoModal({
  isOpen,
  onClose,
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}: {
  isOpen: boolean
  onClose: () => void
  todos: Todo[]
  onAddTodo: (text: string) => void
  onToggleTodo: (id: number) => void
  onDeleteTodo: (id: number) => void
}) {
  const [newTodo, setNewTodo] = useState("")

  const handleAdd = () => {
    if (!newTodo.trim()) return
    onAddTodo(newTodo)
    setNewTodo("")
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30" onClick={onClose} />
      <div className="absolute bottom-0 left-0 w-full h-[60%] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up">
        <div className="p-5 border-b border-neutral-100 text-center font-bold">할 일 목록 (Todo)</div>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex gap-2.5 mb-5">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
              placeholder="할 일 입력..."
            />
            <button onClick={handleAdd} className="w-[60px] bg-[#FF5722] text-white border-none rounded-xl font-bold">
              추가
            </button>
          </div>

          <div>
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-center py-3 border-b border-neutral-100">
                <div
                  onClick={() => onToggleTodo(todo.id)}
                  className={`w-[22px] h-[22px] border-2 rounded-full mr-3 cursor-pointer flex items-center justify-center ${
                    todo.done ? "bg-green-500 border-green-500" : "border-neutral-300"
                  }`}
                >
                  {todo.done && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className={`flex-1 text-[15px] ${todo.done ? "line-through text-neutral-300" : "text-[#333]"}`}>
                  {todo.text}
                </div>
                <div onClick={() => onDeleteTodo(todo.id)} className="text-neutral-300 cursor-pointer p-1.5">
                  <X className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
