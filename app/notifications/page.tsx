"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule } from "@/types"

/* ================= utils ================= */

const getKstNow = () => {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 9 * 60 * 60000)
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const parseDateValue = (value?: string) => {
  if (!value) return null
  return new Date(`${value}T00:00:00+09:00`)
}

const diffDaysFrom = (target: Date, base: Date) => {
  const diff = target.getTime() - base.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const formatDdayLabel = (diff: number) => {
  if (diff === 0) return "오늘 마감"
  if (diff > 0) return `D-${diff}`
  return `마감 초과`
}

const typeIcons: Record<Schedule["reviewType"], string> = {
  방문형: "🏠",
  구매형: "🛒",
  제공형: "🎁",
  기자단: "✍️",
  "미션/인증": "✅",
}

type VisitChecklist = NonNullable<Schedule["visitReviewChecklist"]>
const checklistLabels: Array<[keyof VisitChecklist, string]> = [
  ["naverReservation", "네이버 예약"],
  ["platformAppReview", "플랫폼 리뷰"],
  ["cafeReview", "카페 리뷰"],
  ["googleReview", "구글 리뷰"],
]

/* ================= styles ================= */

const card =
  "rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
const softCard =
  "rounded-3xl border border-neutral-200 bg-neutral-50/60 p-5"

const pill = (text: string) =>
  `inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-[12px] font-semibold text-neutral-700 shadow-sm`

/* ================= page ================= */

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const { schedules, loading } = useSchedules({ enabled: !!user })
  const today = useMemo(() => startOfDay(getKstNow()), [])

  /* ---------- 7일 기준 ---------- */

  const weeklySchedules = useMemo(() => {
    return schedules.filter((s) => {
      const dates = [parseDateValue(s.dead), parseDateValue(s.visit)]
      return dates.some((d) => {
        if (!d) return false
        const diff = diffDaysFrom(d, today)
        return diff >= 0 && diff <= 7
      })
    })
  }, [schedules, today])

  const weeklyCounts = useMemo(() => {
    return {
      review: weeklySchedules.filter(
        (s) => s.reviewType !== "방문형" && s.reviewType !== "구매형",
      ).length,
      visit: weeklySchedules.filter((s) => s.reviewType === "방문형").length,
      purchase: weeklySchedules.filter((s) => s.reviewType === "구매형").length,
    }
  }, [weeklySchedules])

  /* ---------- 마감 ---------- */

  const deadlines = useMemo(() => {
    return schedules
      .map((s) => ({
        schedule: s,
        deadline: parseDateValue(s.dead),
      }))
      .filter((x) => x.deadline)
      .map((x) => ({
        schedule: x.schedule,
        diff: diffDaysFrom(x.deadline as Date, today),
      }))
      .sort((a, b) => a.diff - b.diff)
  }, [schedules, today])

  const urgentDeadlines = deadlines.filter((d) => d.diff <= 2)

  /* ---------- 오늘 방문 ---------- */

  const todaysVisits = schedules.filter((s) => {
    const visit = parseDateValue(s.visit)
    return visit && diffDaysFrom(visit, today) === 0
  })

  /* ---------- 체크리스트 ---------- */

  const buildChecklist = (schedule: Schedule) => {
    const items: string[] = []
    checklistLabels.forEach(([key, label]) => {
      if (schedule.visitReviewChecklist?.[key]) items.push(label)
    })
    if (schedule.visitReviewChecklist?.otherText)
      items.push(schedule.visitReviewChecklist.otherText)
    if (schedule.memo) items.push(schedule.memo)
    return items.length ? items : ["요구사항 없음"]
  }

  /* ---------- 오늘 결론 ---------- */

  const todayMustCount =
    urgentDeadlines.filter((d) => d.diff <= 0).length +
    todaysVisits.length

  /* ================= render ================= */

  return (
    <div className="min-h-screen bg-[#f9fafc] text-[#0f172a]">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        <Link
          href="/?page=profile"
          className="text-sm font-semibold text-[#ff5c39]"
        >
          ← 프로필로 돌아가기
        </Link>

        {/* ===== Header ===== */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">
            오늘 꼭 처리해야 할 체험단부터 확인하세요
          </h1>
          <p className="text-sm text-neutral-600">
            마감·방문·리뷰 중에서 지금 안 하면 실수로 이어질 것만 보여드려요.
          </p>
        </header>

        {loading ? (
          <div className={softCard}>데이터를 불러오는 중이에요…</div>
        ) : !user ? (
          <div className={softCard}>
            로그인하면 매일 아침 체험단 요약을 자동으로 받을 수 있어요.
          </div>
        ) : (
          <>
            {/* ===== 오늘의 결론 ===== */}
            <section className="sticky top-4 z-10 rounded-3xl bg-white/90 backdrop-blur border border-neutral-200 p-4 shadow">
              <p className="text-sm font-bold">
                {todayMustCount > 0
                  ? `오늘 반드시 확인해야 할 체험단이 ${todayMustCount}개 있어요`
                  : "오늘 급한 체험단은 없어요 🙂"}
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className={pill(`7일 리뷰 ${weeklyCounts.review}`)} />
                <span className={pill(`방문 ${weeklyCounts.visit}`)} />
                <span className={pill(`구매 ${weeklyCounts.purchase}`)} />
              </div>
            </section>

            {/* ===== 마감 임박 ===== */}
            <section className="rounded-3xl border border-red-100 bg-[#fff2f0] p-5">
              <h2 className="text-lg font-bold">
                지금 안 보면 실수로 이어질 수 있어요
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                마감이 임박했거나 이미 지난 체험단이에요.
              </p>

              <div className="mt-4 space-y-3">
                {urgentDeadlines.length === 0 ? (
                  <p className="text-sm text-neutral-600">
                    오늘 기준으로 위험한 마감은 없어요.
                  </p>
                ) : (
                  urgentDeadlines.map((d) => (
                    <div
                      key={d.schedule.id}
                      className="rounded-2xl bg-white p-4 border border-red-200"
                    >
                      <p className="font-semibold">
                        {d.schedule.title}
                      </p>
                      <p className="text-sm text-neutral-600 mt-1">
                        {formatDdayLabel(d.diff)} ·{" "}
                        {typeIcons[d.schedule.reviewType]}{" "}
                        {d.schedule.reviewType}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ===== 오늘 방문 ===== */}
            <section className={card}>
              <h2 className="text-lg font-bold">
                오늘 외출 전에 이것만 확인하세요
              </h2>
              <div className="mt-4 space-y-3">
                {todaysVisits.length === 0 ? (
                  <p className="text-sm text-neutral-600">
                    오늘 방문 일정은 없어요.
                  </p>
                ) : (
                  todaysVisits.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl bg-neutral-50 p-4 border"
                    >
                      <p className="font-semibold">
                        {s.title}
                      </p>
                      <p className="text-sm text-neutral-600 mt-1">
                        시간: {s.visitTime || "미정"} · 콘텐츠:{" "}
                        {s.channel?.join(", ") || "미정"}
                      </p>
                      {s.memo && (
                        <p className="mt-2 text-sm text-neutral-700">
                          ⚠️ {s.memo}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ===== 체크리스트 ===== */}
            <section className={card}>
              <h2 className="text-lg font-bold">
                아직 안 끝난 작업이 있어요
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                조건을 하나라도 놓치면 재작성 요청이 올 수 있어요.
              </p>

              <div className="mt-4 space-y-3">
                {weeklySchedules.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-neutral-50 p-4 border"
                  >
                    <p className="font-semibold">
                      {typeIcons[s.reviewType]} {s.title}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {buildChecklist(s).map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-white border px-3 py-1 text-sm"
                        >
                          ☐ {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </>
        )}
      </div>
    </div>
  )
}
