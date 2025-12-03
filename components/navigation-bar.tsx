"use client"

import { Home, CheckSquare, Plus, BarChart3 } from "lucide-react"

export default function NavigationBar({
  currentPage,
  onPageChange,
  onAddClick,
  onTodoClick,
}: {
  currentPage: "home" | "stats" | "profile"
  onPageChange: (page: "home" | "stats" | "profile") => void
  onAddClick: () => void
  onTodoClick: () => void
}) {
  return (
    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-[40px] flex gap-6 items-center shadow-xl z-20">
      <Home
        className={`w-6 h-6 cursor-pointer transition-all ${
          currentPage === "home" ? "text-[#1A1A1A] scale-110" : "text-neutral-300"
        }`}
        onClick={() => onPageChange("home")}
      />
      <CheckSquare className="w-6 h-6 text-neutral-300 cursor-pointer transition-all" onClick={onTodoClick} />
      <div
        className="w-[50px] h-[50px] bg-[#1A1A1A] rounded-full flex items-center justify-center text-white cursor-pointer mb-1"
        onClick={onAddClick}
      >
        <Plus className="w-7 h-7" />
      </div>
      <BarChart3
        className={`w-6 h-6 cursor-pointer transition-all ${
          currentPage === "stats" ? "text-[#1A1A1A] scale-110" : "text-neutral-300"
        }`}
        onClick={() => onPageChange("stats")}
      />
    </div>
  )
}
