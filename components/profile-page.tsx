"use client"

import { useState, type FormEvent } from "react"
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
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
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

  const handleSubmitWaitlist = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: "success", text: data.message })
        setWaitlistEmail("")
      } else {
        setMessage({ type: "error", text: data.error || "등록에 실패했습니다." })
      }
    } catch (error) {
      setMessage({ type: "error", text: "등록 중 오류가 발생했습니다. 다시 시도해주세요." })
    } finally {
      setIsSubmitting(false)
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
      {isWaitlistOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-5"
          onClick={() => {
            setIsWaitlistOpen(false)
            setMessage(null)
          }}
        >
          <div
            className="w-90 max-w-sm bg-white rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-orange-600 mb-1">사전신청</p>
                <h3 className="text-xl font-bold text-neutral-900 leading-tight">PRO 3개월 무료 혜택</h3>
                <p className="text-sm text-neutral-600 mt-1">12월 20일 PRO 오픈 소식을 가장 먼저 받아보세요.</p>
              </div>
              <button
                onClick={() => {
                  setIsWaitlistOpen(false)
                  setMessage(null)
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleSubmitWaitlist}>
              <input
                type="email"
                required
                placeholder="example@email.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c39]"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#ff5c39] text-white py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-400/30 hover:bg-[#ff734f] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? "등록 중..." : "사전신청 완료하기"}
              </button>
            </form>
            {message && (
              <div
                className={`mt-3 px-3 py-2 rounded-lg text-xs ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-3">
              입력하신 이메일은 출시 알림 외 다른 목적으로 사용하지 않아요.
            </p>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-[#fff3ea] via-[#ffe4d2] to-[#ffd2b3] rounded-3xl p-4 mb-3.5 shadow-sm border border-[#ffd6be]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#ff734f] uppercase">현재 등급</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2.5 py-1 bg-white/80 text-[#ff5c39] text-[12px] font-bold rounded-lg border border-white/60 shadow-sm">
                FREE
              </span>
            </div>
            <p className="text-[12px] text-neutral-700 mt-2 leading-relaxed">
              지금 사전신청하면 PRO 버전을 3개월 동안 무료로 이용할 수 있어요. 출시 알림도 가장 먼저 받아보세요.
            </p>
          </div>
        </div>
      </div>

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
