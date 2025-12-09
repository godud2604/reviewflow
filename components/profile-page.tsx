"use client"

import { useMemo, useState } from "react"
import type { Schedule, ExtraIncome } from "@/types"
import { exportAllDataToExcel } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"
import FeedbackModal from "./feedback-modal"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export default function ProfilePage({ 
  schedules,
  extraIncomes
}: { 
  onShowPortfolio: () => void
  schedules: Schedule[]
  extraIncomes: ExtraIncome[]
}) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      toast({
        title: "로그아웃 되었습니다.",
        duration: 1800,
      })
      router.push("/")
    } catch (error) {
      console.error("로그아웃 실패:", error)
      toast({
        title: "로그아웃에 실패했습니다.",
        variant: "destructive",
        duration: 2000,
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleBackup = () => {
    try {
      exportAllDataToExcel(schedules, extraIncomes)
      toast({
        title: "활동 내역 다운로드를 완료하였습니다.",
        duration: 2000,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "활동 내역 다운로드를 실패하였습니다",
        variant: "destructive",
        duration: 2000,
      })
    }
  }

  const menuItems = [
    // { id: "portfolio", icon: "📋", label: "포트폴리오 보기", onClick: onShowPortfolio },
    { id: "backup", icon: "📂", label: "활동 내역 다운로드", isPro: true, onClick: handleBackup, disabled: true },
    { id: "notification", icon: "🔔", label: "알림 설정", isPro: true, disabled: true },
    { id: "report", icon: "📊", label: "월간 레포트", isPro: true, disabled: true },
    // { id: "feedback", icon: "💬", label: "개발자에게 피드백 주기", onClick: () => setIsFeedbackModalOpen(true) },
    // { id: "support", icon: "📞", label: "고객센터" },
  ]

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y mt-3">
      <div className="bg-white rounded-3xl p-4 mb-3.5 shadow-sm">
        <div className="flex items-center justify-between bg-neutral-50 rounded-2xl px-4 py-3">
          <span className="text-[13px] text-neutral-600">이메일</span>
          <span className="text-sm font-semibold text-neutral-800 truncate max-w-[200px] text-right">
            {user?.email || "알 수 없음"}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 mb-3.5 shadow-sm">
        {menuItems.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => {
              if (item.disabled) return
              setActiveMenu(item.id)
              if (item.onClick) item.onClick()
            }}
            className={`
              py-3.5 px-3 font-semibold rounded-xl
              flex items-center gap-3
              transition-all duration-200
              ${idx !== menuItems.length - 1 ? "border-b border-neutral-100" : ""}
              ${activeMenu === item.id ? "bg-neutral-50" : ""}
              ${item.disabled 
                ? "opacity-50 cursor-not-allowed" 
                : "cursor-pointer hover:bg-neutral-50 active:scale-[0.98]"
              }
            `}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="flex-1 text-[15px] flex items-center gap-2">
              {item.label}
              {item.isPro && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded">
                  PRO
                </span>
              )}
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-neutral-400"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        ))}
      </div>

      <button
        onClick={handleLogout}
        disabled={isSigningOut}
        className="text-[13px] w-full p-4 bg-neutral-200 text-[#333] border-none rounded-2xl font-bold cursor-pointer
          transition-all duration-200 hover:bg-neutral-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSigningOut ? "로그아웃 중..." : "로그아웃"}
      </button>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
    </div>
  )
}
