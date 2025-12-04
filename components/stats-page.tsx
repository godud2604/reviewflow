"use client"

import type { Schedule } from "@/types"

export default function StatsPage({ schedules }: { schedules: Schedule[] }) {
  // Calculate stats
  let totalBen = 0,
    totalInc = 0,
    totalCost = 0
  const typeCounts: Record<Schedule["category"], number> = {
    맛집: 0,
    식품: 0,
    뷰티: 0,
    여행: 0,
    디지털: 0,
    반려동물: 0,
    기타: 0,
  }

  schedules.forEach((s) => {
    totalBen += s.benefit
    totalInc += s.income
    totalCost += s.cost
    if (typeCounts[s.category] !== undefined) typeCounts[s.category]++
  })

  const econValue = totalBen + totalInc - totalCost
  const revenue = totalBen + totalInc
  const rate = revenue > 0 ? Math.round(((revenue - totalCost) / revenue) * 100) : 0

  const handleShare = () => {
    alert("🔗 통계 링크가 복사되었습니다!")
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide relative">
      <div className="absolute top-2 right-5 z-10">
        <span
          onClick={handleShare}
          className="bg-white px-3 py-1.5 rounded-2xl text-sm font-bold shadow-md cursor-pointer inline-block"
        >
          🔗 공유
        </span>
      </div>

      {/* Hero Card */}
      <div
        className="rounded-[30px] p-7 mb-6 relative overflow-hidden text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)" }}
      >
        <div className="absolute top-6 right-6 bg-white/25 backdrop-blur-sm px-2.5 py-1.5 rounded-xl text-xs font-bold">
          상위 5%
        </div>
        <div className="text-[15px] font-semibold opacity-90 mb-2.5">이번 달 경제적 가치 ✨</div>
        <div className="text-[38px] font-extrabold mb-6 tracking-tight">₩ {econValue.toLocaleString()}</div>
        <div className="flex gap-5 border-t border-white/20 pt-5">
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1">방어한 생활비</div>
            <div className="text-[15px] font-bold">{totalBen.toLocaleString()}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1">부수입(현금)</div>
            <div className="text-[15px] font-bold">{totalInc.toLocaleString()}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1">순이익률</div>
            <div className="text-[15px] font-bold">{rate}%</div>
          </div>
        </div>
      </div>

      {/* Expertise Chart */}
      <ExpertiseChart typeCounts={typeCounts} />

      {/* Trend Chart */}
      <TrendChart currentMonthValue={econValue} />
    </div>
  )
}

function ExpertiseChart({ typeCounts }: { typeCounts: Record<Schedule["category"], number> }) {
  const maxVal = Math.max(...Object.values(typeCounts), 1)
  const icons: Record<Schedule["category"], string> = {
    맛집: "🍝",
    식품: "🍱",
    뷰티: "💄",
    여행: "✈️",
    디지털: "💻",
    반려동물: "🐾",
    기타: "📦",
  }
  const colors: Record<Schedule["category"], string> = {
    맛집: "#FF5722",
    식품: "#FF9800",
    뷰티: "#E040FB",
    여행: "#00BFA5",
    디지털: "#2979FF",
    반려동물: "#795548",
    기타: "#9E9E9E",
  }

  return (
    <div className="bg-white rounded-3xl p-6 mb-5">
      <div className="text-lg font-bold mb-1">전문 분야</div>
      <div className="space-y-4">
        {(Object.entries(typeCounts) as [Schedule["category"], number][]).map(([category, count]) => {
          if (count === 0) return null
          const width = (count / maxVal) * 100
          return (
            <div key={category} className="flex items-center">
              <div className="w-[30px] text-xl">{icons[category]}</div>
              <div className="flex-1 h-2 bg-neutral-100 rounded mx-4 relative overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-1000"
                  style={{ width: `${width}%`, background: colors[category] }}
                />
              </div>
              <div className="w-[30px] text-right text-sm font-bold text-neutral-600">{count}건</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendChart({ currentMonthValue }: { currentMonthValue: number }) {
  const months = [
    { label: "9월", value: 120000, height: 30 },
    { label: "10월", value: 280000, height: 50 },
    { label: "11월", value: 210000, height: 40 },
    { label: "이번달", value: currentMonthValue, height: 85, active: true },
  ]

  return (
    <div className="bg-white rounded-3xl p-6">
      <div className="text-lg font-bold mb-1">월별 성장 추이</div>
      <div className="text-xs text-neutral-400 mb-5">지난 4개월간의 활동입니다</div>
      <div className="flex justify-between items-end h-[140px] pt-5">
        {months.map((month, i) => (
          <div
            key={i}
            className={`w-[18%] rounded-lg relative flex justify-center transition-all duration-500 ${
              month.active ? "bg-[#651FFF]" : "bg-neutral-100"
            }`}
            style={{ height: `${month.height}%` }}
          >
            <span className="absolute -top-6 text-xs font-bold text-[#333]">
              {Math.round(month.value / 10000)}만
            </span>
            <span className="absolute -bottom-6 text-xs text-neutral-400">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
