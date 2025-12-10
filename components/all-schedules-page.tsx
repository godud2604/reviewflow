"use client"

import type { Schedule } from "@/types"

export default function AllSchedulesPage({
  schedules,
  onScheduleClick,
  onBack,
}: {
  schedules: Schedule[]
  onScheduleClick: (id: number) => void
  onBack: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
  
  // Sort by deadline only
  const sortedSchedules = [...schedules].sort((a, b) => {
    if (!a.dead && !b.dead) return 0
    if (!a.dead) return 1
    if (!b.dead) return -1
    return b.dead.localeCompare(a.dead)
  })
  
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 mt-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[15px] text-neutral-600 hover:text-neutral-900 transition-colors font-medium cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>캘린더로 돌아가기</span>
        </button>
      </div>
      
      {/* Summary */}
      <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">총 체험단</div>
            <div className="text-2xl font-extrabold text-[#333]">{schedules.length}건</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">진행 중</div>
            <div className="text-2xl font-extrabold text-[#FF5722]">
              {schedules.filter((s) => s.status !== "완료" && s.status !== "취소").length}건
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">완료</div>
            <div className="text-2xl font-extrabold text-[#4CAF50]">
              {schedules.filter((s) => s.status === "완료").length}건
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">취소</div>
            <div className="text-2xl font-extrabold text-[#999]">
              {schedules.filter((s) => s.status === "취소").length}건
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="space-y-2.5">
        {sortedSchedules.map((schedule) => (
          <ScheduleItem key={schedule.id} schedule={schedule} onClick={() => onScheduleClick(schedule.id)} today={today} />
        ))}
      </div>
    </div>
  )
}

function ScheduleItem({ schedule, onClick, today }: { schedule: Schedule; onClick: () => void; today: string }) {
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
    선정됨: { class: "bg-neutral-100 text-neutral-600", text: "선정됨" },
    "방문일 예약 완료": { class: "bg-neutral-100 text-neutral-600", text: "방문일 예약 완료" },
    방문: { class: "bg-neutral-100 text-neutral-600", text: "방문" },
    "구매 완료": { class: "bg-neutral-100 text-neutral-600", text: "구매 완료" },
    "제품 배송 완료": { class: "bg-neutral-100 text-neutral-600", text: "배송 완료" },
    완료: { class: "bg-neutral-100 text-neutral-600", text: "완료" },
    취소: { class: "bg-neutral-100 text-neutral-600", text: "취소" },
    재확인: { class: "bg-neutral-100 text-neutral-600", text: "재확인" },
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

  return (
    <div
      className={`p-4 rounded-2xl flex items-center shadow-sm cursor-pointer transition-transform active:scale-[0.98] ${
        isOverdue ? "bg-red-50/50" : "bg-white"
      }`}
      onClick={onClick}
    >
      <div className="text-2xl mr-3.5 w-[30px] text-center">{icons[schedule.category] || "📦"}</div>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-1.5">
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
          <span className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${status.class}`}>{status.text}</span>
          <span className="font-medium text-neutral-600">{dDate}</span>
        </div>
      </div>
    </div>
  )
}
