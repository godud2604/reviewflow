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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<"all" | "active" | "reconfirm" | "overdue">("all")
  const today = new Date().toISOString().slice(0, 10)
  const activeSchedules = schedules.filter((s) => s.status !== "완료" && s.status !== "취소")
  const activeCount = activeSchedules.length
  const reconfirmCount = schedules.filter((s) => s.status === "재확인").length
  const overdueCount = schedules.filter((s) => s.dead && s.dead < today && s.status !== "완료" && s.status !== "취소").length
  const totalBenefit = schedules.reduce((acc, cur) => acc + cur.benefit + cur.income - cur.cost, 0)

  // Filter schedules based on selected date and filter
  let filteredSchedules = schedules
  
  if (selectedDate) {
    filteredSchedules = schedules.filter((s) => s.dead === selectedDate || s.visit === selectedDate)
  } else if (selectedFilter === "active") {
    filteredSchedules = activeSchedules
  } else if (selectedFilter === "reconfirm") {
    filteredSchedules = schedules.filter((s) => s.status === "재확인")
  } else if (selectedFilter === "overdue") {
    filteredSchedules = schedules.filter((s) => s.dead && s.dead < today && s.status !== "완료" && s.status !== "취소")
  }

  const displayedSchedules = selectedDate || selectedFilter !== "all" ? filteredSchedules : activeSchedules.slice(0, 3)

  const handleClearFilter = () => {
    setSelectedDate(null)
    setSelectedFilter("all")
  }

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null)
    } else {
      setSelectedDate(dateStr)
      setSelectedFilter("all")
    }
  }

  const handleFilterClick = (filter: "active" | "reconfirm" | "overdue") => {
    if (selectedFilter === filter) {
      setSelectedFilter("all")
    } else {
      setSelectedFilter(filter)
      setSelectedDate(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide">
      {/* Summary Bar */}
      <div className="space-y-2 mb-4 mt-2">
        <div className="flex gap-2.5">
          <button
            onClick={() => handleFilterClick("active")}
            className={`flex-1 pt-2.5 pb-[7px] px-3 rounded-xl flex justify-between items-center shadow-sm transition-all cursor-pointer ${
              selectedFilter === "active"
                ? "bg-slate-100 border-2 border-slate-300"
                : "bg-white border-2 border-transparent hover:bg-neutral-50"
            }`}
          >
            <span className={`text-xs font-semibold translate-y-[-2px] ${
              selectedFilter === "active" ? "text-slate-800" : "text-neutral-500"
            }`}>
              진행중
            </span>
            <span className={`text-[15px] font-extrabold translate-y-[-2px] ${
              selectedFilter === "active" ? "text-slate-700" : "text-slate-600"
            }`}>
              {activeCount}건
            </span>
          </button>
          {overdueCount > 0 && (
            <button
              onClick={() => handleFilterClick("overdue")}
              className={`flex-1 pt-2.5 pb-[7px] px-3 rounded-xl flex justify-between items-center shadow-sm transition-all cursor-pointer ${
                selectedFilter === "overdue"
                  ? "bg-red-100 border-2 border-red-300"
                  : "bg-red-50 border-2 border-red-100 hover:bg-red-100"
              }`}
            >
              <span className={`text-xs font-semibold flex items-center gap-0.5 translate-y-[-2px] ${
                selectedFilter === "overdue" ? "text-red-800" : "text-red-700"
              }`}>
                ⏰ 마감초과
              </span>
              <span className={`text-[15px] font-extrabold translate-y-[-2px] ${
                selectedFilter === "overdue" ? "text-red-700" : "text-red-700"
              }`}>
                {overdueCount}건
              </span>
            </button>
          )}
          {reconfirmCount > 0 && (
            <button
              onClick={() => handleFilterClick("reconfirm")}
              className={`flex-1 pt-2.5 pb-[7px] px-3 rounded-xl flex justify-between items-center shadow-sm transition-all cursor-pointer ${
                selectedFilter === "reconfirm"
                  ? "bg-amber-100 border-2 border-amber-300"
                  : "bg-amber-50 border-2 border-amber-100 hover:bg-amber-100"
              }`}
            >
              <span className={`text-xs font-semibold flex items-center gap-0.5 translate-y-[-2px] ${
                selectedFilter === "reconfirm" ? "text-amber-800" : "text-amber-700"
              }`}>
                ⚠️ 재확인
              </span>
              <span className={`text-[15px] font-extrabold translate-y-[-2px] ${
                selectedFilter === "reconfirm" ? "text-amber-700" : "text-amber-700"
              }`}>
                {reconfirmCount}건
              </span>
            </button>
          )}
        </div>
        <div className="mt-3 bg-white p-2.5 px-3 rounded-xl flex justify-between items-center shadow-sm">
          <span className="text-xs text-neutral-500 font-semibold">이번 달 경제적 가치 ✨</span>
          <span className="text-[15px] font-extrabold translate-y-[-1px] text-[#333]">{totalBenefit.toLocaleString()}원</span>
        </div>
      </div>

      {/* Calendar */}
      <CalendarSection schedules={schedules} onDateClick={handleDateClick} selectedDate={selectedDate} today={today} />

      {/* Schedule List */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">
          {selectedDate
            ? `${selectedDate.slice(5).replace('-', '/')} 일정 (${filteredSchedules.length}건)`
            : selectedFilter === "active"
              ? `진행 중인 일정 (${filteredSchedules.length}건)`
              : selectedFilter === "reconfirm"
                ? `재확인 필요 일정 (${filteredSchedules.length}건)`
                : selectedFilter === "overdue"
                  ? `마감 초과 일정 (${filteredSchedules.length}건)`
                  : "내 체험단 리스트"}
        </h3>
        <div className="flex items-center gap-2">
          {(selectedDate || selectedFilter !== "all") && (
            <button
              onClick={handleClearFilter}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition-colors"
            >
              초기화
            </button>
          )}
          {!selectedDate && selectedFilter === "all" && activeSchedules.length > 0 && (
            <button
              onClick={onShowAllClick}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              전체보기 ({schedules.length})
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2.5">
        {displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem key={schedule.id} schedule={schedule} onClick={() => onScheduleClick(schedule.id)} today={today} />
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm text-neutral-500 font-medium">
              {selectedDate
                ? "해당 날짜에 일정이 없습니다"
                : "해당하는 일정이 없습니다"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarSection({
  schedules,
  onDateClick,
  selectedDate,
  today,
}: {
  schedules: Schedule[]
  onDateClick: (dateStr: string) => void
  selectedDate: string | null
  today: string
}) {
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]

  const [currentDate, setCurrentDate] = useState(new Date())
  const todayDate = new Date()

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

  const isOverdue = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return schedules.some((s) => s.dead === dateStr && dateStr < today && s.status !== "완료" && s.status !== "취소")
  }

  const isToday = (day: number) => {
    return todayDate.getDate() === day && todayDate.getMonth() === month && todayDate.getFullYear() === year
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

      <div className="grid grid-cols-7 text-center text-xs text-neutral-400 mb-2.5">
        {weekDays.map((day, idx) => (
          <div key={day} className={idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : ""}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-[42px]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayOfWeek = (startDayOfWeek + day - 1) % 7
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const isSelected = selectedDate === dateStr
          const hasDotValue = hasDot(day)
          return (
            <button
              key={day}
              onClick={() => hasDotValue && onDateClick(dateStr)}
              disabled={!hasDotValue}
              className={`h-[34px] w-[34px] flex flex-col items-center justify-center text-sm font-semibold rounded-lg relative transition-all mx-auto ${
                hasDotValue ? "cursor-pointer" : "cursor-default"
              }
                ${isSelected ? "bg-orange-500 text-white shadow-md" : ""}
                ${!isSelected && isToday(day) ? "bg-orange-50 text-orange-700 ring-1 ring-orange-300" : ""}
                ${!isSelected && !isToday(day) ? "text-neutral-700" : ""}
                ${!isSelected && !isToday(day) && hasDotValue ? "hover:bg-neutral-100" : ""}
                ${!isSelected && !isToday(day) && dayOfWeek === 0 ? "text-red-500" : ""}
                ${!isSelected && !isToday(day) && dayOfWeek === 6 ? "text-blue-500" : ""}`}
            >
              {day}
              {hasDotValue && !isSelected && (
                <>
                  {isOverdue(day) ? (
                    <span className="text-[10px] absolute bottom-0.5 translate-y-1/2">🔥</span>
                  ) : (
                    <div className="w-1 h-1 bg-orange-500 rounded-full absolute bottom-1.5 translate-y-1/2" />
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleItem({ schedule, onClick, today }: { schedule: Schedule; onClick: () => void; today: string }) {
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
    "방문일 예약 완료": { class: "bg-orange-50 text-orange-700", text: "방문일 예약 완료" },
    방문: { class: "bg-orange-50 text-orange-700", text: "방문" },
    "구매 완료": { class: "bg-purple-50 text-purple-700", text: "구매 완료" },
    "제품 배송 완료": { class: "bg-green-50 text-green-700", text: "배송 완료" },
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
  const isOverdue = schedule.dead && schedule.dead < today && schedule.status !== "완료" && schedule.status !== "취소"

  return (
    <div
      className={`p-4 rounded-2xl flex items-center shadow-sm cursor-pointer transition-transform active:scale-[0.98] ${
        isOverdue ? "bg-red-50/50" : "bg-white"
      }`}
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
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded font-semibold text-[11px] translate-y-[-2px] ${status.class}`}>{status.text}</span>
          <span>|</span>
          <span>{schedule.platform}</span>
          <span>|</span>
          <span>{dDate}</span>
        </div>
      </div>
      <div className="font-bold text-[#333]">₩{total.toLocaleString()}</div>
    </div>
  )
}
