"use client"

import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import { useTodos } from "@/hooks/use-todos"
import type { Schedule } from "@/types"
import ScheduleModal from "@/components/schedule-modal"

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
  const shortDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`
  if (index === 0) return `오늘 (${shortDate} ${WEEKDAYS[date.getDay()]})`
  if (index === 1) return `내일 (${shortDate} ${WEEKDAYS[date.getDay()]})`
  return `${shortDate} (${WEEKDAYS[date.getDay()]})`
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("ko-KR").format(value)
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

const formatRangeLabel = (from: Date, to: Date) => {
  const f = `${from.getMonth() + 1}.${from.getDate()}`
  const t = `${to.getMonth() + 1}.${to.getDate()}`
  return `${f} ~ ${t}`
}

const PHONE_REGEX = /0\d{1,2}[-‐—–]?\d{3,4}[-‐—–]?\d{4}/

const extractPhoneNumber = (memo?: string) => {
  if (!memo) return null
  const match = memo.match(PHONE_REGEX)
  return match ? match[0] : null
}

const extractLocationFromMemo = (memo?: string) => {
  if (!memo) return null
  const lines = memo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const keywordLine = lines.find((line) => /(주소|위치|장소)/.test(line))
  if (keywordLine) {
    const cleaned = keywordLine.replace(/.*(?:주소|위치|장소)\s*[:：]?\s*/, "").trim()
    return cleaned.length > 0 ? cleaned : keywordLine
  }

  return lines[0] ?? null
}

const buildWeatherSearchUrl = (schedule: Schedule) => {
  const location = schedule.region || extractLocationFromMemo(schedule.memo) || schedule.title
  const query = encodeURIComponent(`날씨 ${location}`)
  return `https://www.google.com/search?q=${query}`
}

const VISIT_CHECKLIST_KEYS = ["naverReservation", "platformAppReview", "googleReview"] as const
type VisitChecklistKey = (typeof VISIT_CHECKLIST_KEYS)[number]
const VISIT_CHECKLIST_LABELS: Record<VisitChecklistKey, string> = {
  naverReservation: "네이버 예약 리뷰",
  platformAppReview: "타플랫폼 앱 리뷰",
  googleReview: "구글 리뷰",
}

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const { schedules, loading: schedulesLoading, updateSchedule, deleteSchedule } = useSchedules({ enabled: !!user })
  const { todos, loading: todosLoading } = useTodos({ enabled: !!user })

  const today = useMemo(() => startOfDay(getKstNow()), [])

  const userName = useMemo(() => {
    if (!user) return "체험단러"
    const metadataName = (user.user_metadata as { full_name?: string } | undefined)?.full_name
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

  const paybackSchedules = useMemo(() => schedules.filter((schedule) => !!schedule.paybackExpected), [schedules])

  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [memoVisibility, setMemoVisibility] = useState<Record<number, boolean>>({})

  const editingSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === editingScheduleId),
    [schedules, editingScheduleId],
  )
  const [updatingPayback, setUpdatingPayback] = useState<Record<number, boolean>>({})

  const ddayGroups = useMemo(() => {
    return [1, 2, 3].map((offset) => {
      const groupSchedules = schedules.filter((schedule) => {
        const deadline = parseDateValue(schedule.dead)
        return deadline && diffDaysFrom(deadline, today) === offset
      })
      const loss = groupSchedules.reduce((total, schedule) => total + (schedule.income ?? 0), 0)
      return { offset, schedules: groupSchedules, loss }
    })
  }, [schedules, today])

  const handleOpenScheduleModal = (scheduleId: number) => {
    setEditingScheduleId(scheduleId)
    setIsModalVisible(true)
  }

  const handleCloseScheduleModal = () => {
    setEditingScheduleId(null)
    setIsModalVisible(false)
  }

  const handleSaveScheduleFromModal = async (schedule: Schedule) => {
    const success = await updateSchedule(schedule.id, schedule)
    if (success) {
      handleCloseScheduleModal()
    }
    return success
  }

  const handleDeleteScheduleFromModal = async (id: number) => {
    await deleteSchedule(id)
    handleCloseScheduleModal()
  }

  const handleTogglePaybackConfirmation = async (schedule: Schedule) => {
    if (!schedule.paybackExpected) return
    setUpdatingPayback((prev) => ({ ...prev, [schedule.id]: true }))
    await updateSchedule(schedule.id, { paybackConfirmed: !schedule.paybackConfirmed })
    setUpdatingPayback((prev) => ({ ...prev, [schedule.id]: false }))
  }

  const handleToggleMemoVisibility = (scheduleId: number) => {
    setMemoVisibility((prev) => ({ ...prev, [scheduleId]: !prev[scheduleId] }))
  }

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
            timeLabel: index === 0 ? "D-Day" : `D-${index}`,
          })
        }
      })

      // 마감 먼저 보이게 정렬(손해 방지 포커스)
      events.sort((a, b) => (a.type === b.type ? 0 : a.type === "deadline" ? -1 : 1))

      return { key: `${label}-${index}`, label, events }
    })
  }, [schedules, today])

  const isLoading = schedulesLoading || todosLoading
  const hasTodayHighlights =
    todaysVisits.length > 0 ||
    todaysDeadlines.length > 0 ||
    ddayGroups.some((group) => group.schedules.length > 0) ||
    paybackSchedules.length > 0

  const weekStart = useMemo(() => {
    const d = new Date(today)
    return d
  }, [today])

  const weekEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() + 6)
    return d
  }, [today])

  const todayIso = useMemo(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, "0")
    const d = String(today.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [today])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f2ff] via-[#fef3ff] to-[#fdf2ff] p-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        {/* 헤더 */}
        <section className="rounded-[32px] bg-white/80 p-5 backdrop-blur-lg">
          <div className="text-sm font-semibold text-[#5c3dff]">
            좋은 아침입니다, {userName} ☀️
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1b1464]">모닝 브리핑</p>
          <p className="text-xs text-neutral-500">{formatHeaderDate(today)}</p>
        </section>

        {/* 오늘의 할 일 */}
        <section className="rounded-[32px] bg-white/90 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">오늘의 할 일</h2>
            </div>
            <span className="text-[11px] font-semibold uppercase text-neutral-400">
              {today.toLocaleDateString("ko-KR")}
            </span>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4 text-sm text-neutral-400 text-center">
              오늘의 일정을 불러오는 중이에요…
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* 오늘 방문 */}
              <div className="rounded-3xl border border-neutral-100 bg-[#fdfbff] p-4 shadow-sm">
                <h3 className="text-base font-semibold text-neutral-900">
                  📍 오늘 방문 일정
                </h3>

                <div className="mt-3 space-y-3">
                  {todaysVisits.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      오늘 예정된 방문 일정이 없습니다.
                    </p>
                  ) : (
                    todaysVisits.map((schedule) => {
                      const checklist = schedule.visitReviewChecklist
                      const checkedChecklistItems = VISIT_CHECKLIST_KEYS.reduce<
                        Array<{ key: string; label: string }>
                      >((list, key) => {
                        if (checklist?.[key]) {
                          list.push({ key, label: VISIT_CHECKLIST_LABELS[key] })
                        }
                        return list
                      }, [])

                      if (checklist?.other && checklist.otherText?.trim()) {
                        checkedChecklistItems.push({
                          key: "other",
                          label: `기타: ${checklist.otherText} 리뷰`,
                        })
                      }

                      const platformLabel = schedule.platform.trim()
                      const weatherUrl = buildWeatherSearchUrl(schedule)
                      const writingChannels = (schedule.channel || []).filter(
                        (channel) => channel.trim().length > 0,
                      )

                      return (
                        <div
                          key={`visit-${schedule.id}`}
                          className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm space-y-4"
                        >
                          {/* 🔥 이벤트 헤더 */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-neutral-900 break-words">
                                {schedule.title}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                🕔 {schedule.visitTime
                                  ? (() => {
                                      const [h, m] = schedule.visitTime.split(":").map(Number)
                                      const period = h < 12 ? "오전" : "오후"
                                      const hour12 = h % 12 === 0 ? 12 : h % 12
                                      return `${period} ${hour12}시${m ? ` ${m}분` : ""}`
                                    })()
                                  : "시간 미정"}
                              </p>
                            </div>

                            {/* 보조 액션 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenScheduleModal(schedule.id)
                              }}
                              className="text-[11px] font-semibold text-[#5c3dff] hover:underline"
                            >
                              상세보기 →
                            </button>
                          </div>

                          {/* 🧩 미션 / 플랫폼 */}
                          {(platformLabel || checkedChecklistItems.length > 0) && (
                            <div className="flex flex-wrap gap-2 text-[11px] text-neutral-600">
                              {platformLabel && (
                                <span className="rounded-full border border-[#d7c8ff] bg-[#f5f0ff] px-3 py-1 text-[#5c3dff]">
                                  {platformLabel}
                                </span>
                              )}
                              {writingChannels.map((channel, index) => (
                                <span
                                  key={`${schedule.id}-channel-${channel}-${index}`}
                                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1"
                                >
                                  {channel}
                                </span>
                              ))}
                              {checkedChecklistItems.map((item) => (
                                <span
                                  key={`${schedule.id}-${item.key}`}
                                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1"
                                >
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* ⚠️ 페이백 */}
                          {schedule.paybackExpected && (
                            <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[12px] text-orange-700">
                              <Checkbox
                                checked={!!schedule.paybackConfirmed}
                                disabled={!!updatingPayback[schedule.id]}
                                onCheckedChange={() => handleTogglePaybackConfirmation(schedule)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span>
                                광고주에게 받을 금액 있음
                                <span className="block text-[11px] text-orange-500">
                                  {schedule.paybackConfirmed ? "이미 받았어요" : "아직 받지 않았어요"}
                                </span>
                              </span>
                            </div>
                          )}

                          {/* 🔗 하단 액션 */}
                          <div className="flex items-center gap-4 text-[11px]">
                            {schedule.memo?.trim() && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleMemoVisibility(schedule.id)
                                }}
                                className="font-semibold text-[#5c3dff] hover:underline"
                              >
                                📝 {memoVisibility[schedule.id] ? "메모 접기" : "메모 보기"}
                              </button>
                            )}

                            <a
                              href={weatherUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-neutral-500 hover:underline"
                            >
                              ☀️ 오늘 방문, 우산 필요할까?
                            </a>
                          </div>

                          {memoVisibility[schedule.id] && schedule.memo && (
                            <p className="text-xs text-neutral-500 whitespace-pre-line rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                              {schedule.memo}
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 오늘 마감 */}
              <div className="rounded-3xl border border-neutral-100 bg-[#fdfbff] p-4 shadow-sm">
                <h3 className="text-base font-semibold text-neutral-900">
                  ⏰ 오늘 마감 포스팅
                </h3>

                <div className="mt-3 space-y-3">
                  {todaysDeadlines.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      오늘 마감 일정은 없어요.
                    </p>
                  ) : (
                    todaysDeadlines.map((schedule) => (
                      <div
                        key={`deadline-${schedule.id}`}
                        className="rounded-2xl border border-neutral-100 bg-white p-3"
                      >
                        <p className="text-sm font-semibold text-neutral-900">
                          {formatDdayLabel(schedule, today)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {buildBadgeLabel(schedule)}
                        </p>
                        <p className="text-xs text-[#b42318]">
                          미작성 시 예상 손실 {formatCurrency(schedule.income ?? 0)}원
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}


          {!hasTodayHighlights && !isLoading && (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 text-center">
              오늘은 예정된 일정이 없어요. 여유로운 하루 보내세요!
            </div>
          )}
        </section>

        {/* 이번 주 미리보기 */}
        <section className="rounded-[32px] bg-white/90 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0f172a]">이번 주 미리보기</h2>
              <p className="text-[11px] text-neutral-400">
                이번 주 주요 일정 ({formatRangeLabel(weekStart, weekEnd)})
              </p>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              타임라인
            </span>
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
                      <div
                        key={event.key}
                        className="flex items-center gap-2 rounded-2xl border border-neutral-100 bg-white p-3"
                      >
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            event.type === "deadline"
                              ? "bg-[#fff2ef] text-[#b42318]"
                              : "bg-neutral-50 text-neutral-500"
                          }`}
                        >
                          {event.type === "visit" ? "[방문]" : "[마감]"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 break-words">
                            {event.title}
                          </p>
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

        {/* 하단 CTA */}
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
        {isModalVisible && editingSchedule && (
          <ScheduleModal
            isOpen={isModalVisible}
            onClose={handleCloseScheduleModal}
            onSave={handleSaveScheduleFromModal}
            onDelete={handleDeleteScheduleFromModal}
            schedule={editingSchedule}
            onUpdateFiles={async (id, files) => updateSchedule(id, { guideFiles: files })}
          />
        )}
      </div>
    </div>
  )
}
