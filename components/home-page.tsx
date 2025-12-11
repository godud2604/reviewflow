"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { usePostHog } from "posthog-js/react"
import type { Schedule } from "@/types"

const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date)

const parseDateString = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export default function HomePage({
  schedules,
  onScheduleClick,
  onShowAllClick,
  onCompleteClick,
  onAddClick,
}: {
  schedules: Schedule[]
  onScheduleClick: (id: number) => void
  onShowAllClick: () => void
  onCompleteClick?: (id: number) => void
  onAddClick?: () => void
}) {
  const router = useRouter()
  const posthog = usePostHog()
  const today = formatDateStringKST(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [selectedFilter, setSelectedFilter] = useState<"all" | "active" | "reconfirm" | "overdue" | "noDeadline">("all")
  const [floatingPanel, setFloatingPanel] = useState<"none" | "noDeadline" | "reconfirm">("none")
  const [showDemo, setShowDemo] = useState(false)
  const demoSchedules = useMemo(
    () => [
      { title: "강남 파스타 리뷰", status: "방문 예약 → 마감 3/20", value: "₩55,000", tag: "방문형" },
      { title: "영양제 제공형", status: "배송 완료 · 3/25 마감", value: "₩32,000", tag: "제공형" },
      { title: "카페 인스타 포스팅", status: "3/18 방문 · 추가 리뷰 체크", value: "₩24,000", tag: "복수 채널" },
    ],
    [],
  )
  const activeSchedules = schedules.filter((s) => s.status !== "완료")
  const activeCount = activeSchedules.length
  const reconfirmSchedules = schedules.filter((s) => s.status === "재확인")
  const reconfirmCount = reconfirmSchedules.length
  const noDeadlineSchedules = schedules.filter((s) => !s.dead)
  const overdueCount = schedules.filter((s) => s.dead && s.dead < today && s.status !== "완료").length
  const showStatusHighlights = overdueCount > 0 || reconfirmCount > 0
  const hasSchedules = schedules.length > 0

  // Filter schedules based on selected date and filter
  let filteredSchedules = schedules
  
  if (selectedDate) {
    filteredSchedules = schedules.filter((s) => s.dead === selectedDate || s.visit === selectedDate)
  } else if (selectedFilter === "active") {
    filteredSchedules = activeSchedules
  } else if (selectedFilter === "reconfirm") {
    filteredSchedules = schedules.filter((s) => s.status === "재확인")
  } else if (selectedFilter === "overdue") {
    filteredSchedules = schedules.filter((s) => s.dead && s.dead < today && s.status !== "완료")
  } else if (selectedFilter === "noDeadline") {
    filteredSchedules = schedules.filter((s) => !s.dead)
  }

  // Sort schedules: overdue/reconfirm first, then by deadline (closest first)
  const sortSchedules = (schedules: Schedule[]) => {
    return [...schedules].sort((a, b) => {
      const aIsOverdue = a.dead && a.dead < today && a.status !== "완료"
      const bIsOverdue = b.dead && b.dead < today && b.status !== "완료"
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
  const shouldShowFirstScheduleTutorial =
    hasSchedules && schedules.length === 1 && displayedSchedules.length > 0
  const shouldShowFilterTutorial =
    hasSchedules && schedules.length <= 1 && displayedSchedules.length === 0
  const renderTutorialCard = (footerText?: string) => (
    <div className="space-y-5 rounded-3xl border border-neutral-200 bg-gradient-to-b from-[#fff6ed] via-white to-white px-5 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.09)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffecd1] to-[#ffe1cc] text-[#ff6a1f] shadow-inner">
            ✨
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-500">
              next 튜토리얼
            </p>
            <p className="text-sm font-bold text-neutral-900">다음 단계를 미리 살펴볼까요?</p>
          </div>
        </div>
      </div>
      <ol className="space-y-3 text-left text-[13px] text-neutral-700">
        <li className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white/80 p-3 shadow-sm">
          <span className="mt-0.5 text-lg font-bold text-orange-500">1</span>
          <div>
            <p className="font-semibold text-neutral-900">할 일 기록하기</p>
            <div className="space-y-1 pl-2 border-l-2 border-orange-200">
              <p className="text-[12px] text-neutral-500"><span className="font-bold text-orange-600">좌측 상단</span>의 <span className="font-bold text-orange-600">할 일</span> 버튼을 누르면, <span className="font-bold text-orange-600">잊지 말아야 할 메모</span>를 간단히 기록해둘 수 있어요.</p>
            </div>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-2xl border border-dashed border-orange-100 bg-white/80 p-3 shadow-sm">
          <span className="mt-0.5 text-lg font-bold text-orange-500">2</span>
          <div>
            <p className="font-semibold text-neutral-900 mb-1">통계 페이지에서 수익 보기</p>
            <div className="space-y-1 pl-2 border-l-2 border-orange-200">
              <p className="text-[12px] text-neutral-500 leading-relaxed"><span className="font-bold text-orange-600">하단 네비게이션 바</span>에서 <b className="text-orange-500">"통계"</b>를 누르면 바로 이동할 수 있어요.</p>
              <p className="text-[12px] text-neutral-500 leading-relaxed">체험단에 <span className="font-bold text-orange-600">금액</span>을 입력하면 이번 달 <span className="font-bold text-orange-600">예상 수익</span>을 자동으로 확인할 수 있어요.</p>
              <p className="text-[12px] text-neutral-500 leading-relaxed">애드포스트·원고료 등 <span className="font-bold text-orange-600">부수익</span>도 함께 기록하면 <span className="font-bold text-orange-600">전체 수익</span>이 한눈에 보여요!</p>
            </div>
          </div>
        </li>
      </ol>
      {footerText && (
        <p className="text-[13px] font-medium text-neutral-500">{footerText}</p>
      )}
    </div>
  )

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedFilter("all")
  }

  const containerClassName = `flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3${showStatusHighlights ? "" : " pt-2"}`
  const handleGoToToday = () => {
    setSelectedDate(today)
    setSelectedFilter("all")
  }

  return (
    <div className={containerClassName}>
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
                : selectedFilter === "noDeadline"
                  ? "마감일 미정"
                  : "체험단 일정"}
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
        {!hasSchedules ? (
          <div className="bg-white rounded-3xl p-4 text-center shadow-sm shadow-[0_18px_40px_rgba(15,23,42,0.06)] border border-neutral-100 space-y-4">
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-neutral-900">
                아직 체험단 일정이 없어요
              </p>
              <p className="text-[11px] text-neutral-500 font-medium">
                체험단을 등록하면 캘린더와 수익 리포트가 자동으로 채워져요
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  posthog?.capture("home_empty_add_clicked", { context: selectedDate ? "date" : "list" })
                  onAddClick?.()
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#ff6a1f] text-white text-[13px] font-bold shadow-sm active:scale-[0.98] w-full sm:w-auto"
              >
                체험단 등록하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextShowDemo = !showDemo
                  setShowDemo(nextShowDemo)
                  posthog?.capture("home_empty_demo_toggled", { open: nextShowDemo })
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-neutral-50 text-neutral-700 text-[13px] font-semibold border border-neutral-200 w-full sm:w-auto"
              >
                데모 일정 살펴보기
              </button>
            </div>
            {showDemo && (
              <div className="mt-2 space-y-3 text-left">
                <div className="text-[11px] font-bold text-neutral-500 uppercase">샘플 일정</div>
                <div className="space-y-2">
                  {demoSchedules.map((demo) => (
                    <div
                      key={demo.title}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2.5 bg-neutral-50/70"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[13px] font-bold text-neutral-900">{demo.title}</div>
                        <div className="text-[11px] text-neutral-500 font-semibold">{demo.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-[#f97316]">{demo.value}</div>
                        <div className="text-[11px] text-neutral-500">{demo.tag}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-[#eef2ff] via-white to-[#fff7ed] border border-neutral-100 p-3">
                  <div className="text-[12px] font-bold text-neutral-900 mb-1">짧은 투어</div>
                  <ul className="text-[11.5px] text-neutral-600 space-y-1.5 list-disc list-inside">
                    <li>체험단 등록 → 캘린더에 일정 표시</li>
                    <li>마감·방문일 관리하며 수익/비용 입력</li>
                    <li>통계 탭에서 이번 달 수익 자동 확인</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
              today={today}
            />
          ))
        ) : shouldShowFilterTutorial ? (
          renderTutorialCard("선택한 날짜/필터에 맞는 일정이 없어요.")
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500">
            선택한 날짜/필터에 맞는 일정이 없어요.
          </div>
        )}
        {shouldShowFirstScheduleTutorial && renderTutorialCard()}
      </div>

      {/* Floating quick filters */}
      <div
        className="fixed z-40 flex flex-col gap-3"
        style={{
          right: "calc((100vw - min(100vw, 390px)) / 2 + 20px)",
          bottom: "calc((100vh - min(100vh, 844px)) / 2 + 100px)",
        }}
      >
        {reconfirmCount > 0 && (
          <button
            type="button"
            onClick={() => setFloatingPanel(floatingPanel === "reconfirm" ? "none" : "reconfirm")}
            className="flex items-center gap-2 rounded-full bg-white border border-orange-500 shadow-[0_14px_100px_rgba(249,115,22,0.18)] px-2 py-2 active:scale-[0.98] transition-all ring-2 ring-orange-500/70"
          >
            <span className="text-base">⚠️</span>
            <div className="text-left leading-tight">
              <div className="text-[11px] font-bold text-amber-900">재확인</div>
              <div className="text-[10px] font-semibold text-amber-800">목록 보기</div>
            </div>
            <span className="ml-4 rounded-full bg-orange-200 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 shadow-sm">
              {reconfirmCount}
            </span>
          </button>
        )}
        {noDeadlineSchedules.length > 0 && (
          <button
            type="button"
            onClick={() => setFloatingPanel(floatingPanel === "noDeadline" ? "none" : "noDeadline")}
            className="flex items-center gap-2 rounded-full bg-white from-orange-200/90 to-amber-200/90 border border-orange-500 shadow-[0_14px_100px_rgba(249,115,22,0.18)] px-2 py-2 active:scale-[0.98] transition-all ring-2 ring-orange-500/70"
          >
            <span className="text-base">📌</span>
            <div className="text-left leading-tight">
              <div className="text-[11px] font-bold text-orange-900">마감일 미정</div>
              <div className="text-[10px] font-semibold text-orange-800">목록 보기</div>
            </div>
            <span className="ml-1 rounded-full bg-orange-200 px-2 py-0.5 text-[11px] font-extrabold text-orange-800 shadow-sm">
              {noDeadlineSchedules.length}
            </span>
          </button>
        )}
      </div>

      {/* Slide-up panel */}
      {floatingPanel !== "none" && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/35"
            onClick={() => setFloatingPanel("none")}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-3xl bg-white shadow-2xl border-t border-neutral-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {floatingPanel === "reconfirm" ? "⚠️" : "📌"}
                </span>
                <div className="leading-tight">
                  <div className="text-[13px] font-bold text-neutral-900">
                    {floatingPanel === "reconfirm" ? "재확인 체험단" : "마감일 미정"}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {floatingPanel === "reconfirm"
                      ? "확인이 필요한 일정 목록"
                      : "캘린더에 없는 일정 목록"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFloatingPanel("none")}
                className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-700"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-3">
              {(floatingPanel === "reconfirm" ? reconfirmSchedules : noDeadlineSchedules).map((schedule) => (
                <ScheduleItem
                  key={schedule.id}
                  schedule={schedule}
                  onClick={() => {
                    onScheduleClick(schedule.id)
                    setFloatingPanel("none")
                  }}
                  onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
                  today={today}
                />
              ))}
              {(floatingPanel === "reconfirm" ? reconfirmSchedules : noDeadlineSchedules).length === 0 && (
                <div className="text-[12px] text-neutral-500 text-center py-4">표시할 일정이 없습니다.</div>
              )}
            </div>
          </div>
        </>
      )}
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

  const [currentDate, setCurrentDate] = useState(() => parseDateString(today))
  const todayDate = parseDateString(today)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const scheduleByDate = schedules.reduce<
    Record<
      string,
      {
        deadlineCount: number
        visitCount: number
        hasDeadline: boolean
        hasVisit: boolean
        overdue: boolean
        hasCompleted: boolean
      }
    >
  >((acc, schedule) => {
    const ensureDayInfo = (key: string) => {
      if (!acc[key]) {
        acc[key] = {
          deadlineCount: 0,
          visitCount: 0,
          hasDeadline: false,
          hasVisit: false,
          overdue: false,
          hasCompleted: false,
        }
      }
      return acc[key]
    }

    const isCompleted = schedule.status === "완료"

    if (schedule.dead) {
      const info = ensureDayInfo(schedule.dead)
      if (isCompleted) {
        info.hasCompleted = true
      } else {
        info.hasDeadline = true
        if (schedule.dead < today) {
          info.deadlineCount += 1
          info.overdue = true
        } else {
          info.deadlineCount += 1
        }
      }
    }

    if (schedule.visit) {
      const info = ensureDayInfo(schedule.visit)
      info.hasVisit = true
      info.visitCount += 1
      // Only mark completed on visit date when there's no separate deadline, to avoid showing the completed dot on visit days
      if (isCompleted && !schedule.dead) {
        info.hasCompleted = true
      }
    }

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
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[11px] font-semibold text-[#c24b30] rounded-lg hover:bg-orange-100"
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
          const hasSchedule = !!dayInfo && (dayInfo.deadlineCount > 0 || dayInfo.visitCount > 0 || dayInfo.hasCompleted)
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
          console.log(dateStr, "hasSchedule :", hasSchedule, "dayInfo :", dayInfo)
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
              {hasSchedule && dayInfo?.hasDeadline && (
                <>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 flex h-4 text-[10px] min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none ${
                      dayInfo.deadlineCount > 0
                        ? "shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-white text-orange-600"
                        : "shadow-none bg-transparent text-orange-600"
                    }`}
                  >
                    {dayInfo.deadlineCount > 0 ? dayInfo.deadlineCount : ""}
                  </span>
                  {indicatorType === "overdue" ? (
                    <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] text-[10px]">
                      🔥
                    </span>
                  ) : null}
                </>
              )}
              {hasSchedule && dayInfo?.hasVisit && (
                <span
                  className={`absolute ${dayInfo?.overdue ? "top-0 left-0" : "-bottom-0.5 -left-0.5"} flex h-4 min-w-[16px] items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-extrabold leading-none shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-sky-50 text-sky-700`}
                >
                  📍
                  {dayInfo.visitCount > 1 ? dayInfo.visitCount : ""}
                </span>
              )}
              {hasSchedule && dayInfo?.hasCompleted && !dayInfo?.hasDeadline && (
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
    "맛집/식품": "🍽️",
    "뷰티": "💄",
    "생활/리빙": "🏡",
    "출산/육아": "🤱",
    "주방/가전": "🧺",
    반려동물: "🐶",
    "여행/레저": "✈️",
    "티켓/문화생활": "🎫",
    "디지털/전자기기": "🎧",
    "건강/헬스": "💪",
    "자동차/모빌리티": "🚗",
    "문구/오피스": "✏️",
    기타: "📦",
  }

  const statusConfig: Record<Schedule["status"], { class: string; text: string }> = {
    선정됨: { class: "bg-emerald-50 text-emerald-700 border border-emerald-100", text: "선정됨" },
    "방문일 예약 완료": { class: "bg-blue-50 text-blue-700 border border-blue-100", text: "예약 완료" },
    방문: { class: "bg-sky-50 text-sky-700 border border-sky-100", text: "방문" },
    "구매 완료": { class: "bg-indigo-50 text-indigo-700 border border-indigo-100", text: "구매 완료" },
    "제품 배송 완료": { class: "bg-indigo-50 text-indigo-700 border border-indigo-100", text: "배송 완료" },
    완료: { class: "bg-neutral-100 text-neutral-700 border border-neutral-200", text: "완료" },
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
  const isOverdue = schedule.dead && schedule.dead < today && schedule.status !== "완료"
  const isReconfirm = schedule.status === "재확인"
  const isCompleted = schedule.status === "완료"
  const canComplete = !!onCompleteClick && !isCompleted

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
        {canComplete && (
          <span className="mt-1 text-[10.5px] font-semibold leading-none text-orange-600">
            완료
          </span>
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-bold text-[#0F172A] flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[18px] shrink-0">{icons[schedule.category] || "📦"}</span>
            <span className="block truncate w-[120px]">{schedule.title}</span>
            {schedule.memo && (
              <span className="text-sm shrink-0" title="메모 있음">
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
