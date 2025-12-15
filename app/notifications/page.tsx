"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import { useTodos } from "@/hooks/use-todos"
import type { Schedule } from "@/types"

type DailyPreview = {
  key: string
  label: string
  events: Array<{
    key: string
    type: "visit" | "deadline"
    title: string
    badge?: string
    timeLabel: string
  }>
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

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

const formatHeaderDate = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAYS[date.getDay()]
  return `${year}년 ${month}월 ${day}일 ${weekday}요일`
}

const formatWeekLabel = (index: number, date: Date) => {
  const shortDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
  if (index === 0) return `오늘 (${shortDate} ${WEEKDAYS[date.getDay()]})`
  if (index === 1) return `내일 (${shortDate} ${WEEKDAYS[date.getDay()]})`
  return `${shortDate} (${WEEKDAYS[date.getDay()]})`
}

const buildBadgeLabel = (schedule: Schedule) => {
  if (schedule.platform) return schedule.platform
  if (schedule.channel?.length) return schedule.channel[0]
  if (schedule.reviewType) return schedule.reviewType
  return "체험단"
}

const buildTaskLabel = (schedule: Schedule, timeLabel?: string) => {
  const timeText = timeLabel ?? schedule.visitTime ?? "시간 미정"
  return `[${timeText}] ${schedule.title}`
}

const formatDdayLabel = (schedule: Schedule, today: Date) => {
  const deadline = parseDateValue(schedule.dead)
  if (!deadline) return schedule.title
  const diff = diffDaysFrom(deadline, today)
  if (diff === 0) return `[D-Day] ${schedule.title}`
  if (diff > 0) return `D-${diff} ${schedule.title}`
  return `마감 초과 ${schedule.title}`
}

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const { schedules, loading: schedulesLoading } = useSchedules({ enabled: !!user })
  const { todos, loading: todosLoading, toggleTodo } = useTodos({ enabled: !!user })
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({})
  const today = useMemo(() => startOfDay(getKstNow()), [])

  const userName = useMemo(() => {
    if (!user) return "체험단러"
    const metadataName = (user.user_metadata as { full_name?: string } | undefined)
      ?.full_name
    if (metadataName) return metadataName
    return user.email ? user.email.split("@")[0] : "체험단러"
  }, [user])

  const todaysVisits = useMemo(() => {
    return schedules.filter((schedule) => {
      const visit = parseDateValue(schedule.visit)
      return visit && diffDaysFrom(visit, today) === 0
    })
  }, [schedules, today])

  const todaysDeadlines = useMemo(() => {
    return schedules.filter((schedule) => {
      const deadline = parseDateValue(schedule.dead)
      return deadline && diffDaysFrom(deadline, today) === 0
    })
  }, [schedules, today])

  const incompleteTodos = useMemo(() => todos.filter((todo) => !todo.done), [todos])

  const handleToggleTask = (key: string) => {
    setCheckedTasks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const todaySections = useMemo(() => {
    return [
      {
        key: "visit",
        title: "📍 방문 일정",
        badge: "방문",
        items: todaysVisits.map((schedule) => ({
          key: `visit-${schedule.id}`,
          label: buildTaskLabel(schedule, schedule.visitTime),
          badge: buildBadgeLabel(schedule),
        })),
        emptyText: "오늘 예정된 방문 일정이 없습니다.",
      },
      {
        key: "deadline",
        title: "⏰ 오늘 마감",
        badge: "마감",
        items: todaysDeadlines.map((schedule) => ({
          key: `deadline-${schedule.id}`,
          label: formatDdayLabel(schedule, today),
          badge: buildBadgeLabel(schedule),
        })),
        emptyText: "오늘 마감 일정은 없어요.",
      },
      {
        key: "todo",
        title: "📝 나의 할 일",
        badge: "할 일",
        items: incompleteTodos.map((todo) => ({
          key: `todo-${todo.id}`,
          label: todo.text,
        })),
        emptyText: "오늘은 예정된 할 일이 없어요.",
      },
    ]
  }, [todaysVisits, todaysDeadlines, incompleteTodos, today])

  const weeklyPreview = useMemo<DailyPreview[]>(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      const label = `${formatWeekLabel(index, date)}`

      const events: DailyPreview[0]["events"] = []
      schedules.forEach((schedule) => {
        const visitDate = parseDateValue(schedule.visit)
        if (visitDate && diffDaysFrom(visitDate, today) === index) {
          events.push({
            key: `visit-${schedule.id}-${index}`,
            type: "visit",
            title: buildTaskLabel(schedule, schedule.visitTime),
            badge: buildBadgeLabel(schedule),
            timeLabel: schedule.visitTime || "시간 미정",
          })
        }
        const deadline = parseDateValue(schedule.dead)
        if (deadline && diffDaysFrom(deadline, today) === index) {
          events.push({
            key: `deadline-${schedule.id}-${index}`,
            type: "deadline",
            title: schedule.title,
            badge: buildBadgeLabel(schedule),
            timeLabel: "D-Day",
          })
        }
      })

      return { key: `${label}-${index}`, label, events }
    })
  }, [schedules, today])

  const isLoading = schedulesLoading || todosLoading
  const hasTodayTasks = todaySections.some((section) => section.items.length > 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f2ff] via-[#fef3ff] to-[#fdf2ff] p-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <section className="rounded-[32px] bg-white/80 p-5 backdrop-blur-lg">
          <div className="text-sm font-semibold text-[#5c3dff]">좋은 아침입니다 ☀️</div>
          <p className="mt-2 text-2xl font-bold text-[#1b1464]">모닝 브리핑</p>
          <p className="text-xs text-neutral-500">{formatHeaderDate(today)}</p>
        </section>

        <section className="rounded-[32px] bg-white/90 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">오늘의 할 일</h2>
            </div>
            <span className="text-[11px] font-semibold uppercase text-neutral-400">{today.toLocaleDateString()}</span>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4 text-sm text-neutral-400 text-center">
              오늘의 일정을 불러오는 중이에요…
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {todaySections.map((section) => (
                <div key={section.key} className="rounded-3xl border border-neutral-100 bg-[#fdfbff] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[12px] font-semibold text-neutral-600">
                      {section.badge}
                    </span>
                    <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {section.items.length === 0 ? (
                      <p className="text-sm text-neutral-500">{section.emptyText}</p>
                    ) : (
                      section.items.map((item) => (
                        <label
                          key={item.key}
                          className="group flex items-start gap-3 rounded-2xl border border-neutral-100 bg-white p-3 transition hover:border-[#ff8a67]"
                        >
                          <input
                            type="checkbox"
                            checked={!!checkedTasks[item.key]}
                            onChange={() => {
                              const isTodo = item.key.startsWith("todo-")
                              if (isTodo) {
                                const todoId = Number(item.key.replace("todo-", ""))
                                toggleTodo(todoId)
                              }
                              handleToggleTask(item.key)
                            }}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-neutral-300 text-[#ff5c39] focus:ring-[#ff5c39]"
                          />
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                            {item.badge && (
                              <p className="text-xs text-neutral-500">[{item.badge}]</p>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasTodayTasks && !isLoading && (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 text-center">
              오늘은 예정된 일정이 없어요. 여유로운 하루 보내세요!
            </div>
          )}
        </section>

        <section className="rounded-[32px] bg-white/90 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">이번 주 미리보기</h2>
              <p className="text-[11px] text-neutral-400">이번 주 주요 일정 (12.15 ~ 12.21)</p>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">타임라인</span>
          </div>
          <div className="mt-5 space-y-4">
            {weeklyPreview.map((day) => (
              <div key={day.key} className="rounded-3xl border border-neutral-100 bg-[#fdfbff] p-4">
                <p className="text-sm font-semibold text-neutral-600">{day.label}</p>
                {day.events.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-400">일정 없음 (쉬는 날 푹 쉬세요! 🍵)</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm">
                    {day.events.map((event) => (
                      <div key={event.key} className="flex items-center gap-2 rounded-2xl border border-neutral-100 bg-white p-3">
                        <span className="rounded-full bg-neutral-50 px-2 py-1 text-xs text-neutral-500">
                          {event.type === "visit" ? "[방문]" : "[마감]"}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-neutral-900">{event.title}</p>
                          <p className="text-xs text-neutral-500">
                            {event.badge ? `[${event.badge}] · ` : ""}
                            {event.timeLabel}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] bg-white/85 p-5 shadow-[0_20px_60px_rgba(92,49,255,0.25)]">
          <p className="text-sm font-semibold text-[#5c3dff]">오늘도 파이팅하세요!</p>
          <p className="text-xs text-neutral-500">일정을 더 자세히 보고 싶다면 버튼을 눌러보세요.</p>
          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/?page=home"
              className="rounded-2xl bg-[#5c3dff] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
            >
              오늘 일정 자세히 보기
            </Link>
            <span className="text-xs text-neutral-400">모바일 보기로 정리</span>
          </div>
        </section>
      </div>
    </div>
  )
}
