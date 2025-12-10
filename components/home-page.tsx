"use client"

import { useState } from "react"
import type { Schedule } from "@/types"

export default function HomePage({
  schedules,
  onScheduleClick,
  onShowAllClick,
  onCompleteClick,
}: {
  schedules: Schedule[]
  onScheduleClick: (id: number) => void
  onShowAllClick: () => void
  onCompleteClick?: (id: number) => void
}) {
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const today = getLocalDateString(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [selectedFilter, setSelectedFilter] = useState<"all" | "active" | "reconfirm" | "overdue">("all")
  const activeSchedules = schedules.filter((s) => s.status !== "완료" && s.status !== "취소")
  const activeCount = activeSchedules.length
  const reconfirmCount = schedules.filter((s) => s.status === "재확인").length
  const overdueCount = schedules.filter((s) => s.dead && s.dead < today && s.status !== "완료" && s.status !== "취소").length
  const showStatusHighlights = overdueCount > 0 || reconfirmCount > 0

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

  // Sort schedules: overdue/reconfirm first, then by deadline (closest first)
  const sortSchedules = (schedules: Schedule[]) => {
    return [...schedules].sort((a, b) => {
      const aIsOverdue = a.dead && a.dead < today && a.status !== "완료" && a.status !== "취소"
      const bIsOverdue = b.dead && b.dead < today && b.status !== "완료" && b.status !== "취소"
      const aIsReconfirm = a.status === "재확인"
      const bIsReconfirm = b.status === "재확인"
      
      // Priority 1: Overdue first
      if (aIsOverdue && !bIsOverdue) return -1
      if (!aIsOverdue && bIsOverdue) return 1
      
      // Priority 2: Reconfirm second
      if (aIsReconfirm && !bIsReconfirm) return -1
      if (!aIsReconfirm && bIsReconfirm) return 1
      
      // Priority 3: Sort by deadline (closest first)
      if (a.dead && b.dead) return a.dead.localeCompare(b.dead)
      if (a.dead && !b.dead) return -1
      if (!a.dead && b.dead) return 1
      
      return 0
    })
  }

  const displayedSchedules = sortSchedules(selectedDate || selectedFilter !== "all" ? filteredSchedules : activeSchedules)

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

  const containerClassName = `mt-1 flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3${showStatusHighlights ? "" : " pt-2"}`
  const handleGoToToday = () => {
    setSelectedDate(today)
    setSelectedFilter("all")
  }

  return (
    <div className={containerClassName}>

      {/* Summary / Filters */}
      {showStatusHighlights && (
        <div className="space-y-1 mb-3.5 mt-2">
          <div className="flex gap-2.5">
            {reconfirmCount > 0 && (
              <button
                onClick={() => handleFilterClick("reconfirm")}
                className={`flex-1 flex items-center justify-between rounded-2xl px-4 py-3 shadow-sm transition-all cursor-pointer ${
                  selectedFilter === "reconfirm"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-white border-neutral-200 text-neutral-800 hover:border-amber-200 hover:text-amber-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="text-left">
                    <p className="text-[12px] font-bold leading-tight">재확인</p>
                    <p className="text-[11px] text-neutral-500 font-medium leading-tight">상세 일정 점검</p>
                  </div>
                </div>
                <span className="text-base font-extrabold">{reconfirmCount}건</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Calendar */}
      <CalendarSection
        schedules={schedules}
        onDateClick={handleDateClick}
        onGoToToday={handleGoToToday}
        selectedDate={selectedDate}
        today={today}
      />

      {/* Schedule List */}
      <div className="flex items-center justify-between">
        <div className="mt-1">
          <h3 className="text-xl font-bold text-neutral-900 text-[16px]">
            {selectedDate
              ? `${selectedDate.slice(5).replace('-', '/')} 일정`
              : selectedFilter === "reconfirm"
                ? "재확인 일정"
                : selectedFilter === "overdue"
                  ? "마감 초과 일정"
                  : "진행 중인 체험단"}
            <span className="ml-1 text-sm font-semibold text-orange-600">
              {selectedDate || selectedFilter !== "all" ? filteredSchedules.length : activeCount}건
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowAllClick}
            className="text-[12px] font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
          >
            전체보기 ({schedules.length})
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
              today={today}
            />
          ))
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-[12px] text-neutral-500 font-medium">
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
  onGoToToday,
  selectedDate,
  today,
}: {
  schedules: Schedule[]
  onDateClick: (dateStr: string) => void
  onGoToToday: () => void
  selectedDate: string | null
  today: string
}) {
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]

  const [currentDate, setCurrentDate] = useState(new Date())
  const todayDate = new Date()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const scheduleByDate = schedules.reduce<Record<string, { count: number; hasDeadline: boolean; overdue: boolean; hasCompleted: boolean }>>((acc, schedule) => {
    if (!schedule.dead) return acc
    const info = acc[schedule.dead] ?? { count: 0, hasDeadline: false, overdue: false, hasCompleted: false }
    const isCompleted = schedule.status === "완료"
    if (isCompleted) {
      info.hasCompleted = true
    } else {
      info.count += 1
      info.hasDeadline = true
      if (schedule.dead < today && schedule.status !== "취소") {
        info.overdue = true
      }
    }
    acc[schedule.dead] = info
    return acc
  }, {})

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

  const goToToday = () => {
    setCurrentDate(new Date())
    onGoToToday()
  }

  const isToday = (day: number) => {
    return todayDate.getDate() === day && todayDate.getMonth() === month && todayDate.getFullYear() === year
  }

  return (
    <div className="rounded-[24px] p-4 shadow-sm bg-gradient-to-b from-white to-neutral-100">
      <div className="relative flex items-center justify-center mb-3 gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-[16px] font-bold text-neutral-900">
            {year}년 <span className="text-orange-600">{month + 1}월</span>
          </div>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[11px] font-semibold text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
        >
          오늘로 이동
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-2.5 font-semibold">
        {weekDays.map((day, idx) => (
          <div key={day} className={idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : ""}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2.5 text-center">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayOfWeek = (startDayOfWeek + day - 1) % 7
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const isSelected = selectedDate === dateStr
          const dayInfo = scheduleByDate[dateStr]
          const hasSchedule = !!dayInfo && (dayInfo.count > 0 || dayInfo.hasCompleted)
          const isTodayDate = isToday(day)
          const indicatorType = dayInfo?.overdue
            ? "overdue"
            : dayInfo?.hasDeadline
              ? "deadline"
              : dayInfo?.hasCompleted
                ? "completedOnly"
                : "none"
          const baseStyle =
            indicatorType === "overdue"
              ? "text-orange-800 bg-white shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.65)]"
              : indicatorType === "deadline"
                ? "text-orange-700 bg-white shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.6)]"
                : "text-neutral-800 bg-white"
          const hoverable = !isSelected && !isTodayDate && hasSchedule
          return (
            <button
              key={day}
              onClick={() => (hasSchedule || dateStr === today) && onDateClick(dateStr)}
              disabled={!hasSchedule && dateStr !== today}
              className={`relative h-8 w-8 mx-auto flex flex-col items-center justify-center text-[11px] font-semibold rounded-full transition-all ${
                hasSchedule || dateStr === today ? "cursor-pointer" : "cursor-default"
              } ${baseStyle}
                ${isSelected ? "bg-orange-50 text-orange-800 shadow-[inset_0_0_0_2px_rgba(249,115,22,0.9)]" : ""}
                ${!isSelected && isTodayDate ? "bg-orange-50/80 text-orange-800 shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.7)]" : ""}
                ${hoverable ? "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]" : ""}
                ${!isSelected && !isToday(day) && dayOfWeek === 0 ? "text-red-500" : ""}
                ${!isSelected && !isToday(day) && dayOfWeek === 6 ? "text-blue-500" : ""}`}
            >
              <span className="leading-none text-current">{day}</span>
              {hasSchedule && dayInfo?.count > 0 && (
                <>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 flex h-4 text-[10px] min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none shadow-[0_4px_10px_rgba(0,0,0,0.12)] ${
                      indicatorType === "overdue"
                        ? "bg-white text-orange-600"
                      : indicatorType === "deadline"
                          ? "bg-white text-orange-600"
                          : "bg-white text-neutral-700"
                    }`}
                  >
                    {dayInfo.count}
                  </span>
                  {indicatorType === "overdue" ? (
                    <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] text-[10px]">
                      🔥
                    </span>
                  ) : null}
                </>
              )}
              {hasSchedule && dayInfo?.count === 0 && dayInfo?.hasCompleted && (
                <span className="absolute -bottom-[1px] -right-[-3px] h-2 w-2 rounded-full bg-orange-400 shadow-[0_4px_10px_rgba(0,0,0,0.12)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleItem({
  schedule,
  onClick,
  onCompleteClick,
  today,
}: {
  schedule: Schedule
  onClick: () => void
  onCompleteClick?: () => void
  today: string
}) {
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
    선정됨: { class: "bg-emerald-50 text-emerald-700 border border-emerald-100", text: "선정됨" },
    "방문일 예약 완료": { class: "bg-blue-50 text-blue-700 border border-blue-100", text: "예약 완료" },
    방문: { class: "bg-sky-50 text-sky-700 border border-sky-100", text: "방문" },
    "구매 완료": { class: "bg-indigo-50 text-indigo-700 border border-indigo-100", text: "구매 완료" },
    "제품 배송 완료": { class: "bg-indigo-50 text-indigo-700 border border-indigo-100", text: "배송 완료" },
    완료: { class: "bg-neutral-100 text-neutral-700 border border-neutral-200", text: "완료" },
    취소: { class: "bg-neutral-100 text-neutral-500 border border-neutral-200", text: "취소" },
    재확인: { class: "bg-amber-50 text-amber-700 border border-amber-200", text: "재확인" },
  }

  const visitLabel = schedule.visit
    ? `${schedule.visit.slice(5)}${schedule.visitTime ? ` ${schedule.visitTime}` : ""} 방문`
    : "방문일 미정"
  const deadLabel = schedule.dead ? `${schedule.dead.slice(5)} 마감` : "마감 미정"
  const dDate =
    schedule.reviewType === "방문형"
      ? `${visitLabel} | ${deadLabel}`
      : schedule.dead
        ? `${schedule.dead.slice(5)} 마감`
        : schedule.visit
          ? `${schedule.visit.slice(5)} 방문`
          : "미정"

  const total = schedule.benefit + schedule.income - schedule.cost
  const status = statusConfig[schedule.status] || { class: "bg-neutral-100 text-neutral-600", text: "미정" }
  const isOverdue = schedule.dead && schedule.dead < today && schedule.status !== "완료" && schedule.status !== "취소"
  const isReconfirm = schedule.status === "재확인"
  const isCompleted = schedule.status === "완료"
  const isCancelled = schedule.status === "취소"
  const canComplete = !!onCompleteClick && !isCompleted && !isCancelled

  return (
    <div
      className={`p-4 rounded-3xl flex items-center shadow-sm cursor-pointer transition-transform active:scale-[0.98] ${
        isOverdue ? "bg-red-50/70 border-red-200" : isReconfirm ? "bg-amber-50/70 border-amber-200" : "bg-white border-neutral-200"
      }`}
      onClick={onClick}
    >
      <div className="mr-4 flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="일정 완료 처리"
          disabled={!canComplete}
          className={`w-5 h-5 flex items-center justify-center rounded-full border-2 transition-colors shadow-sm ${
            isCompleted
              ? "bg-orange-400 border-orange-400 text-white"
              : canComplete
                ? "bg-white border-orange-200 text-orange-300 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-500"
                : "bg-neutral-50 border-neutral-200 text-neutral-300"
          } ${canComplete ? "cursor-pointer" : "cursor-default"}`}
          onClick={(e) => {
            e.stopPropagation()
            if (canComplete) {
              onCompleteClick?.()
            }
          }}
        >
          <span className="text-[13px] font-black leading-none">✓</span>
        </button>
        <span
          className={`mt-1 text-[10.5px] font-semibold leading-none ${
            isCompleted ? "text-orange-600" : canComplete ? "text-orange-300" : "text-neutral-300"
          }`}
        >
          완료
        </span>
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[15px] font-bold text-[#0F172A] flex items-center gap-1.5">
            <span className="text-[18px]">{icons[schedule.category] || "📦"}</span>
            {schedule.title}
            {schedule.memo && (
              <span className="text-sm" title="메모 있음">
                📝
              </span>
            )}
          </div>
          <div className="text-right min-w-[88px]">
            <div className="font-bold text-[15px] text-neutral-900 leading-tight">₩{total.toLocaleString()}</div>
          </div>
        </div>
        <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
          <span className={`px-1.5 py-0.5 rounded-lg font-semibold text-[10.5px] translate-y-[-0.5px] inline-flex items-center gap-1 ${status.class}`}>{status.text}</span>
          <span className="h-[14px] w-px bg-neutral-200" />
          <span className="font-medium text-neutral-600">{dDate}</span>
        </div>
      </div>
    </div>
  )
}
