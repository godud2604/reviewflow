"use client"

import { FileText } from "lucide-react"
import { useState } from "react"
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
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handlePreRegisterClick = () => {
    setMessage(null)
    setIsWaitlistOpen(true)
  }

  const handleSubmitWaitlist = async (e: React.FormEvent) => {
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

  const handleCloseWaitlist = () => {
    setIsWaitlistOpen(false)
  }

  return (
    <header className="px-5 pt-2 space-y-3.5 mb-0.5">
      {isWaitlistOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-5"
          onClick={handleCloseWaitlist}
        >
          <div
            className="w-90 max-w-sm bg-white rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-orange-600 mb-1">사전신청</p>
                <h3 className="text-xl font-bold text-neutral-900 leading-tight">이메일을 남겨주세요</h3>
              </div>
              <button
                onClick={handleCloseWaitlist}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-bold text-neutral-700 border border-neutral-200">FREE</span>
                  <span className="text-[12px] font-semibold text-neutral-600">지금 바로 이용 가능</span>
                </div>
                <ul className="text-[12px] text-neutral-700 space-y-1.5 list-disc list-inside">
                  <li>체험단 일정 캘린더 관리</li>
                  <li>할 일(To-do) 관리</li>
                  <li>이번 달 수익/통계 페이지 제공</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#ffd6be] bg-gradient-to-r from-[#fff3ea] via-[#ffe6d6] to-[#ffd7bd] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-bold text-[#ff5c39] border border-white/70 shadow-sm">PRO</span>
                  <span className="text-[12px] font-semibold text-[#c24b30]">12월 20일 오픈 예정</span>
                </div>
                <ul className="text-[12px] text-neutral-800 space-y-1.5 list-disc list-inside">
                  <li>월간 수익 리포트 · 알림</li>
                  <li>활동 내역 다운로드(엑셀)</li>
                  <li>하루 1번 요약 알림 제공</li>
                  <span className="ml-3">(오늘 해야 할 방문/작성/발행 일정 등)</span>
                </ul>
                <p className="text-[11px] text-[#c24b30] font-semibold mt-2">사전신청 시 PRO 3개월 무료로 이용 가능</p>
              </div>
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
          <div className="w-6 h-8 rounded-2xl bg-neutral-50 flex items-center justify-center text-[18px]">🚀</div>
          <div className="flex justify-between flex-1 space-y-1">
            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase">12월 20일 베타 오픈</div>
              <div className="text-[11px] text-neutral-800 font-semibold leading-snug">사전신청 시 3개월 무료 혜택이 있어요</div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePreRegisterClick}
                className="bg-[#ff5c39] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#ff734f] transition cursor-pointer whitespace-nowrap"
              >
                사전신청
              </button>
            </div>
          </div>
        </div>
      </section>
    </header>
  )
}
