"use client"

import { Home, Plus, Wallet, CalendarCheck2, User } from "lucide-react"

export default function NavigationBar({
  currentPage,
  onPageChange,
  onAddClick,
  onHomeClick,
}: {
  currentPage: "home" | "stats" | "profile"
  onPageChange: (page: "home" | "stats" | "profile") => void
  onAddClick: () => void
  onHomeClick: () => void
}) {
  const baseBtn = "flex flex-col items-center justify-center transition-all text-neutral-400"
  const activeClasses = "text-orange-500"

  return (
    <nav
      className="w-full bg-white border-t border-neutral-200 flex justify-around items-center py-2 shadow-lg"
      style={{ borderRadius: "32px 32px 0 0", maxWidth: 480, margin: "0 auto" }}
    >
      <button
        onClick={onHomeClick}
        className={baseBtn}
        aria-label="랜딩 페이지로 이동"
      >
        <Home className="w-6 h-6" />
        <span className="text-xs font-semibold mt-0.5">홈</span>
      </button>

      <button
        onClick={() => onPageChange("home")}
        className={`${baseBtn} ${currentPage === "home" ? activeClasses : ""}`}
        aria-label="메인 페이지로 이동"
      >
        <CalendarCheck2 className="w-6 h-6" />
        <span className="text-xs font-semibold mt-0.5">일정</span>
      </button>

      <button
        onClick={onAddClick}
        className="flex flex-col items-center justify-center text-neutral-400"
        aria-label="추가"
      >
        <div className="w-[38px] h-[38px] bg-[#1A1A1A] rounded-full flex items-center justify-center text-white mb-1">
          <Plus className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold mt-0.5">체험단 추가</span>
      </button>

      <button
        onClick={() => onPageChange("stats")}
        className={`${baseBtn} ${currentPage === "stats" ? activeClasses : ""}`}
        aria-label="통계 페이지로 이동"
      >
        <Wallet className="w-6 h-6" />
        <span className="text-xs font-semibold mt-0.5">통계</span>
      </button>

      <button
        onClick={() => onPageChange("profile")}
        className={`${baseBtn} ${currentPage === "profile" ? activeClasses : ""}`}
        aria-label="프로필 페이지로 이동"
      >
        <User className="w-6 h-6" />
        <span className="text-xs font-semibold mt-0.5">프로필</span>
      </button>
    </nav>
  )
}
