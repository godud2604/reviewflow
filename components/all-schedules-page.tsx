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
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 mt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[15px] text-neutral-600 hover:text-neutral-900 transition-colors font-medium"
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
        </div>
      </div>

      {/* Schedule List */}
      <div className="space-y-2.5">
        {schedules.map((schedule) => (
          <ScheduleItem key={schedule.id} schedule={schedule} onClick={() => onScheduleClick(schedule.id)} />
        ))}
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
        <div className="text-xs text-neutral-500 flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${status.class}`}>{status.text}</span>
          <span>| {schedule.platform}</span>
          <span>| {dDate}</span>
        </div>
      </div>
      <div className="font-bold text-[#333]">₩{total.toLocaleString()}</div>
    </div>
  )
}
