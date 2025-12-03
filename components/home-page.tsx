"use client"

import { useState } from "react"
import type { Schedule } from "@/types"

export default function HomePage({
  schedules,
  onScheduleClick,
  onShowAllClick,
}: {
  schedules: Schedule[]
  onScheduleClick: (id: number) => void
  onShowAllClick: () => void
}) {
  const activeSchedules = schedules.filter((s) => s.status !== "완료" && s.status !== "취소")
  const activeCount = activeSchedules.length
  const reconfirmCount = schedules.filter((s) => s.status === "재확인").length
  const totalBenefit = schedules.reduce((acc, cur) => acc + cur.benefit + cur.income - cur.cost, 0)

  const displayedSchedules = activeSchedules.slice(0, 3)

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide">
      {/* Summary Bar */}
      <div className="space-y-2 mb-4 mt-2">
        <div className="flex gap-2">
          <div className="flex-1 bg-white p-2.5 px-3 rounded-xl flex justify-between items-center shadow-sm">
            <span className="text-[11px] text-neutral-500 font-semibold">진행 중</span>
            <span className="text-sm font-extrabold text-[#FF5722]">{activeCount}건</span>
          </div>
          {reconfirmCount > 0 && (
            <div className="flex-1 bg-gradient-to-br from-yellow-50 to-orange-50 p-2.5 px-3 rounded-xl flex justify-between items-center shadow-sm border border-yellow-200">
              <span className="text-[11px] text-yellow-700 font-semibold flex items-center gap-1">
                ⚠️ 재확인 필요
              </span>
              <span className="text-sm font-extrabold text-yellow-700">{reconfirmCount}건</span>
            </div>
          )}
        </div>
        <div className="bg-white p-2.5 px-3 rounded-xl flex justify-between items-center shadow-sm">
          <span className="text-[11px] text-neutral-500 font-semibold">이번 달 혜택</span>
          <span className="text-sm font-extrabold text-[#333]">{totalBenefit.toLocaleString()}원</span>
        </div>
      </div>

      {/* Calendar */}
      <CalendarSection schedules={schedules} />

      {/* Schedule List */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">내 체험단 리스트</h3>
        {activeSchedules.length > 0 && (
          <button
            onClick={onShowAllClick}
            className="text-xs font-semibold text-[#FF5722] hover:text-[#E64A19] transition-colors"
          >
            전체보기 ({schedules.length})
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {displayedSchedules.map((schedule) => (
          <ScheduleItem key={schedule.id} schedule={schedule} onClick={() => onScheduleClick(schedule.id)} />
        ))}
      </div>
    </div>
  )
}

function CalendarSection({ schedules }: { schedules: Schedule[] }) {
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]

  const [currentDate, setCurrentDate] = useState(new Date())
  const today = new Date()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const hasDot = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return schedules.some((s) => s.dead === dateStr)
  }

  const isToday = (day: number) => {
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
  }

  return (
    <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-base font-bold text-neutral-800">
          {year}년 {month + 1}월
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-2.5">
        {weekDays.map((day, idx) => (
          <div key={day} className={idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : ""}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-[34px]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayOfWeek = (startDayOfWeek + day - 1) % 7
          return (
            <div
              key={day}
              className={`h-[34px] flex flex-col items-center justify-center text-[13px] font-medium rounded-lg relative cursor-pointer transition-colors
                ${isToday(day) ? "bg-gradient-to-br from-[#FF5722] to-[#FF8A80] text-white shadow-md" : "text-neutral-600 hover:bg-neutral-50"}
                ${isToday(day) ? "" : dayOfWeek === 0 ? "text-red-500" : ""}
                ${isToday(day) ? "" : dayOfWeek === 6 ? "text-blue-500" : ""}`}
            >
              {day}
              {hasDot(day) && (
                <div className="w-1.5 h-1.5 bg-gradient-to-br from-[#FF5722] to-[#FF8A80] rounded-full absolute bottom-0.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleItem({ schedule, onClick }: { schedule: Schedule; onClick: () => void }) {
  const icons: Record<Schedule["category"], string> = {
    맛집: "🍝",
    식품: "🥗",
    뷰티: "💄",
    여행: "✈️",
    디지털: "📱",
    반려동물: "🐕",
    기타: "📦",
  }

  const statusConfig: Record<Schedule["status"], { class: string; text: string }> = {
    선정됨: { class: "bg-blue-50 text-blue-700", text: "선정됨" },
    예약: { class: "bg-orange-50 text-orange-700", text: "예약" },
    방문: { class: "bg-orange-50 text-orange-700", text: "방문" },
    완료: { class: "bg-neutral-100 text-neutral-600", text: "완료" },
    취소: { class: "bg-red-50 text-red-600", text: "취소" },
    재확인: { class: "bg-yellow-50 text-yellow-700", text: "재확인" },
  }

  const dDate = schedule.dead
    ? `${schedule.dead.slice(5)} 마감`
    : schedule.visit
      ? `${schedule.visit.slice(5)} 방문`
      : "미정"

  const total = schedule.benefit + schedule.income - schedule.cost
  const status = statusConfig[schedule.status] || { class: "bg-neutral-100 text-neutral-600", text: "미정" }

  return (
    <div
      className="bg-white p-4 rounded-2xl flex items-center shadow-sm cursor-pointer transition-transform active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="text-2xl mr-3.5 w-[30px] text-center">{icons[schedule.category] || "📦"}</div>
      <div className="flex-1">
        <div className="text-[15px] font-bold mb-1.5 text-[#1A1A1A] flex items-center gap-1.5">
          {schedule.title}
          {schedule.memo && (
            <span className="text-sm" title="메모 있음">
              📝
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${status.class}`}>{status.text}</span>
          <span>| {schedule.platform}</span>
          <span>| {dDate}</span>
        </div>
      </div>
      <div className="font-bold text-[#333]">₩{total.toLocaleString()}</div>
    </div>
  )
}
