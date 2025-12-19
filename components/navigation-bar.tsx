"use client"

import { useToast } from "@/hooks/use-toast"
import { Home, Plus, Wallet, CalendarCheck2, User } from "lucide-react"

export default function NavigationBar({
  currentPage,
  onPageChange,
  onAddClick,
  onHomeClick,
  isPro,
}: {
  currentPage: "home" | "stats" | "profile"
  onPageChange: (page: "home" | "stats" | "profile") => void
  onAddClick: () => void
  onHomeClick: () => void
  isPro: boolean
}) {
  const baseBtn = "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all text-neutral-400 hover:text-neutral-600"
  const activeClasses = "text-[#ff5c39] bg-orange-50"
  const { toast } = useToast()

  const handleSummaryClick = () => {
    if (!isPro) {
      toast({
        title: "요약 기능은 PRO 전용입니다.",
        variant: "destructive",
        duration: 1000,
      })
      return
    }

    onHomeClick()
  }

  return (
    <nav
      className="w-full bg-white border-t border-neutral-200 flex justify-around items-center pt-2"
      style={{
        borderRadius: "32px 32px 0 0",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: "calc(max(env(safe-area-inset-bottom), constant(safe-area-inset-bottom)) + 0.75rem)",
      }}
    >
      <button
        onClick={handleSummaryClick}
        className={baseBtn}
        aria-label="랜딩 페이지로 이동"
      >
        <Home className="w-6 h-6" />
        <span className="text-xs font-semibold mt-0.5">요약</span>
      </button>

      <button
        onClick={() => onPageChange("home")}
        className={`${baseBtn} ${currentPage === "home" ? activeClasses : ""}`}
        aria-label="메인 페이지로 이동"
      >
        <CalendarCheck2 className="w-6 h-6" />
        <span className="text-[14px] font-semibold mt-0.5">일정</span>
      </button>

      <button
        onClick={onAddClick}
        className="flex flex-col items-center justify-center text-neutral-400"
        aria-label="추가"
      >
        <div className="w-[38px] h-[38px] bg-orange-500 rounded-full flex items-center justify-center text-white mb-1">
          <Plus className="w-6 h-6" />
        </div>
        <span className="text-[14px] font-semibold text-orange-500 mt-0.5">체험단 등록</span>
      </button>

      <button
        onClick={() => onPageChange("stats")}
        className={`${baseBtn} ${currentPage === "stats" ? activeClasses : ""}`}
        aria-label="통계 페이지로 이동"
      >
        <Wallet className="w-6 h-6" />
        <span className="text-[14px] font-semibold mt-0.5">통계</span>
      </button>

      <button
        onClick={() => onPageChange("profile")}
        className={`${baseBtn} ${currentPage === "profile" ? activeClasses : ""}`}
        aria-label="프로필 페이지로 이동"
      >
        <User className="w-6 h-6" />
        <span className="text-[14px] font-semibold mt-0.5">프로필</span>
      </button>
    </nav>
  )
}
