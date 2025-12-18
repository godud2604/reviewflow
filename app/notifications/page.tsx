"use client"

import { useMemo, useRef, useState, useEffect, useCallback, type ChangeEvent } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule, ScheduleChannel } from "@/types"
import { uploadGuideFile } from "@/lib/storage"
import { 
  Camera, 
  MessageSquare, 
  CloudRain, 
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  MoreVertical,
  Map,
  MessageCircle,
  Check,
  Send,
  X,
  Copy
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import ScheduleModal from "@/components/schedule-modal"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// --- Utils ---
const getKstNow = () => {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 9 * 60 * 60000)
}
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const parseDateValue = (value?: string) => value ? new Date(`${value}T00:00:00+09:00`) : null
const diffDaysFrom = (target: Date, base: Date) => Math.floor((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
const FAR_FUTURE_TIMESTAMP = 8640000000000000
const toTimestamp = (value?: string, fallback = FAR_FUTURE_TIMESTAMP) => {
  const parsed = parseDateValue(value)
  return parsed ? parsed.getTime() : fallback
}
const formatVisitDateLabel = (visit?: string, referenceDate?: Date) => {
  const target = parseDateValue(visit)
  if (!target) return null
  const reference = referenceDate ?? startOfDay(getKstNow())
  const diff = diffDaysFrom(target, reference)
  if (diff === 0) return "오늘 방문"
  if (diff === 1) return "내일 방문"
  return `${target.getMonth() + 1}월 ${target.getDate()}일 방문`
}
const formatDeadlineLabel = (deadline?: string, referenceDate?: Date) => {
  const target = parseDateValue(deadline)
  if (!target) return null
  const base = referenceDate ?? startOfDay(getKstNow())
  const diff = diffDaysFrom(target, base)
  if (diff === 0) return "D-DAY"
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`
}
const formatCurrency = (value: number) => new Intl.NumberFormat("ko-KR").format(value)
const cleanPhoneNumber = (phone?: string) => phone?.replace(/[^0-9]/g, "") || ""

const formatVisitTimeLabel = (value?: string) => {
  const trimmed = value?.trim()
  if (!trimmed) return "시간 미정"
  const [hourPart, minutePart = "00"] = trimmed.split(":")
  const hour = Number(hourPart)
  const minute = minutePart.padStart(2, "0")
  const period = hour < 12 ? "오전" : "오후"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${displayHour}:${minute}`
}

const getAdditionalReviews = (schedule: Schedule) => {
  const checklist = schedule.visitReviewChecklist
  if (!checklist) return []
  const reviews = []
  if (checklist.naverReservation) reviews.push("네이버")
  if (checklist.platformAppReview) reviews.push("앱")
  if (checklist.googleReview) reviews.push("구글")
  if (checklist.other && checklist.otherText) reviews.push(checklist.otherText)
  return reviews
}

const formatScheduleTitle = (schedule: Schedule) =>
  schedule.title ? `'${schedule.title}'` : "진행 중인 일정"

const timeframeConfigs = [
  { id: "today", label: "오늘", minDiff: 0, maxDiff: 0 },
  { id: "tomorrow", label: "내일", minDiff: 1, maxDiff: 1 },
  { id: "week", label: "이번 주", minDiff: 0, maxDiff: 6 },
] as const

type TimeframeId = (typeof timeframeConfigs)[number]["id"]

type TemplateParams = {
  schedule: Schedule
  userName: string
}

type TemplateDefinition = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  body: (params: TemplateParams) => string
}

const visitTemplateDefinitions: TemplateDefinition[] = [
  {
    id: "visit-remind",
    label: "리마인드",
    description: "약속한 시간에 맞춰 방문한다는 예의 있는 확인",
    icon: Loader2,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님, 오늘 ${formatVisitTimeLabel(schedule.visitTime)}에 ${formatScheduleTitle(schedule)} 방문 예정인 체험단 ${userName}입니다. 약속한 시간에 맞춰 꼭 찾아뵙겠습니다.`,
  },
  {
    id: "visit-change",
    label: "시간 조율",
    description: "불가피한 일정 조정을 부탁할 때",
    icon: MessageCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님, ${userName}입니다. 오늘 방문 일정에 변동이 생겨 혹시 다시 맞출 수 있는 시간대가 있을지 여쭤보고 싶습니다. 편하신 시간 알려주시면 다시 일정 잡도록 하겠습니다.`,
  },
  {
    id: "visit-deadline",
    label: "마감 요청",
    description: "방문 후 리뷰 마감을 부드럽게 끌고 갈 때",
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요! ${formatScheduleTitle(schedule)} 방문을 준비 중인 체험단 ${userName}입니다. 오늘 방문 후에도 자료 정리 시간이 필요해 리뷰 마감을 조금 조율할 수 있을지 여쭤봅니다.`,
  },
]

const deadlineTemplateDefinitions: TemplateDefinition[] = [
  {
    id: "deadline-extension",
    label: "기한 연장",
    description: "마감이 닥친 상태에서 여유를 요청",
    icon: Check,
    body: ({ schedule, userName }) =>
      `안녕하세요 광고주님, ${formatScheduleTitle(schedule)} 리뷰를 보다 꼼꼼하게 마무리하려다 보니 조금 더 시간이 필요할 것 같습니다. 내일까지 연장해주실 수 있을까요?`,
  },
  {
    id: "deadline-status",
    label: "현황 공유",
    description: "지금까지의 진행 상황을 간단히",
    icon: MessageSquare,
    body: ({ schedule, userName }) =>
      `체험단 ${userName}입니다. ${formatScheduleTitle(schedule)} 리뷰 자료 수집과 수정 작업을 마무리하는 중이며 오늘 중으로 초안을 공유드릴게요.`,
  },
  {
    id: "deadline-delay",
    label: "지연 안내",
    description: "예상보다 늦어지는 이유를 설명",
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `광고주님 안녕하세요. 개인 사정으로 인해 ${formatScheduleTitle(schedule)} 포스팅이 조금 더 지연되고 있습니다. 최대한 빠르게 마무리해서 내일까지는 꼭 전달드릴게요.`,
  },
]

const buildTemplates = (type: "visit" | "deadline", schedule: Schedule, userName: string) => {
  const definitions = type === "visit" ? visitTemplateDefinitions : deadlineTemplateDefinitions
  return definitions.map((def) => ({
    ...def,
    body: def.body({ schedule, userName }),
  }))
}

const ScheduleChannelBadges = ({ channels }: { channels?: ScheduleChannel[] | null }) => {
  if (!channels || channels.length === 0) {
    return null
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {channels.map((channel, index) => (
          <span
            key={`${channel}-${index}`}
            className="text-[9px] font-semibold text-white/80 bg-white/5 border border-white/10 rounded-full px-2 py-1 whitespace-nowrap"
          >
            {channel}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const { schedules, updateSchedule, deleteSchedule } = useSchedules({ enabled: !!user })
  const { toast } = useToast()
  const today = useMemo(() => startOfDay(getKstNow()), [])
  const [timeframe, setTimeframe] = useState<TimeframeId>("today")
  const activeTimeframe = timeframeConfigs.find((config) => config.id === timeframe) ?? timeframeConfigs[0]
  const timeframeTitle = `${activeTimeframe.label} 할 일`
  const filterSchedulesByTimeframe = useCallback(
    (value?: string) => {
      const date = parseDateValue(value)
      if (!date) return false
      const diff = diffDaysFrom(date, today)
      return diff >= activeTimeframe.minDiff && diff <= activeTimeframe.maxDiff
    },
    [activeTimeframe, today]
  )
  
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [receiptTarget, setReceiptTarget] = useState<Schedule | null>(null)
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<number | null>(null)
  
  const [smsTarget, setSmsTarget] = useState<Schedule | null>(null)
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [customSmsBody, setCustomSmsBody] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [smsType, setSmsType] = useState<'visit' | 'deadline'>('visit')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const filteredVisits = useMemo(() => {
    const filtered = schedules.filter((s) => filterSchedulesByTimeframe(s.visit))
    return filtered.sort((a, b) => toTimestamp(a.visit) - toTimestamp(b.visit))
  }, [schedules, filterSchedulesByTimeframe])
  const filteredDeadlines = useMemo(() => {
    const filtered = schedules.filter((s) => filterSchedulesByTimeframe(s.dead))
    return filtered.sort((a, b) => toTimestamp(a.dead) - toTimestamp(b.dead))
  }, [schedules, filterSchedulesByTimeframe])
  const hasVisitItems = filteredVisits.length > 0
  const hasDeadlineItems = filteredDeadlines.length > 0
  const showEmptyState = !hasVisitItems && !hasDeadlineItems
  const totalDeadlineNetImpact = useMemo(
    () => filteredDeadlines.reduce((sum, s) => sum + ((s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)), 0),
    [filteredDeadlines]
  )
  const totalTasksCount = filteredVisits.length + filteredDeadlines.length
  const [animatedTaskCount, setAnimatedTaskCount] = useState(0)

  useEffect(() => {
    const target = totalTasksCount
    if (target === 0) {
      setAnimatedTaskCount(0)
      return
    }

    const startValue = target > 0 ? 1 : 0
    setAnimatedTaskCount(startValue)

    const diff = target - startValue
    if (diff <= 0) {
      return
    }

    let frame: number
    let startTime: number | null = null
    const duration = 600

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp
      }
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const nextValue = startValue + Math.round(progress * diff)
      setAnimatedTaskCount(Math.min(nextValue, target))

      if (progress < 1) {
        frame = requestAnimationFrame(animate)
      }
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [totalTasksCount])

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "체험단러"

  const templates = useMemo(() => {
    if (!smsTarget) return []
    return buildTemplates(smsType, smsTarget, userName)
  }, [smsTarget, smsType, userName])

  const activeTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null
  const ActiveTemplateIcon = activeTemplate?.icon

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId(null)
      return
    }
    if (!selectedTemplateId || !templates.find((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  useEffect(() => {
    if (!selectedTemplateId) {
      setCustomSmsBody("")
      return
    }
    const matched = templates.find((template) => template.id === selectedTemplateId)
    if (matched) {
      setCustomSmsBody(matched.body)
    }
  }, [selectedTemplateId, templates])

  const handleOpenSmsModal = (schedule: Schedule, type: 'visit' | 'deadline') => {
    setSmsTarget(schedule)
    setSmsType(type)
    setIsSmsModalOpen(true)
  }

  const sendSms = (phone: string, body: string) => {
    const cleaned = cleanPhoneNumber(phone)
    if (!cleaned) return
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.location.href = `sms:${cleaned}${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`
  }

  const handleReceiptButtonClick = (schedule: Schedule) => {
    setReceiptTarget(schedule)
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = ""
      receiptFileInputRef.current.click()
    }
  }

  const handleReceiptFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const targetSchedule = receiptTarget
    if (!file || !targetSchedule) {
      event.target.value = ""
      return
    }

    if (!user?.id) {
      toast({
        title: "로그인 필요",
        description: "영수증 저장은 로그인한 계정으로만 이용할 수 있습니다.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }

    setUploadingReceiptFor(targetSchedule.id)

    try {
      const uploadedFile = await uploadGuideFile(user.id, targetSchedule.id, file)
      if (!uploadedFile) {
        throw new Error("업로드된 파일 정보를 가져올 수 없습니다.")
      }

      const updatedFiles = [...(targetSchedule.guideFiles || []), uploadedFile]
      const updated = await updateSchedule(targetSchedule.id, { guideFiles: updatedFiles })
      if (!updated) {
        throw new Error("일정 정보를 저장하는 데 실패했습니다.")
      }

      toast({ title: "영수증 저장 완료" })
    } catch (error) {
      toast({
        title: "영수증 저장 실패",
        description: error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setUploadingReceiptFor(null)
      setReceiptTarget(null)
      event.target.value = ""
    }
  }

  const editingSchedule = schedules.find(s => s.id === editingScheduleId)
  const visitCardMinWidthClass = filteredVisits.length > 1 ? "min-w-[82%]" : "min-w-full"

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6 pb-40 font-sans tracking-tight">
      {/* 가로 스크롤바 제거 및 애니메이션 스타일 */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .animated-count {
          animation: fadeInCount 0.55s ease;
        }
        @keyframes fadeInCount {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="max-w-md mx-auto space-y-10">
        
        <header className="pt-8 px-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-[0.2em]">Daily Brief</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
                <span className="block">{timeframeTitle}</span>
                <span className="inline-block text-[2.8rem] font-black tracking-tight text-transparent bg-gradient-to-br from-[#6c63ff] to-[#aa4bf8] bg-clip-text animated-count">
                  {animatedTaskCount}건
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">
              {timeframeConfigs.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTimeframe(option.id)}
                  className={`rounded-full px-3 py-1 transition-all ${
                    timeframe === option.id
                      ? "bg-white text-black shadow-lg"
                      : "text-white/70 hover:text-white"
                  }`}
                  aria-pressed={timeframe === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {showEmptyState ? (
          <div className="py-24 text-center border border-dashed border-white/10 rounded-[2.5rem] text-white/40 space-y-2">
            <p className="text-xl font-bold text-white/80">오늘 일정이 없어요</p>
            <p className="text-sm">등록한 방문이나 마감 일정이 없습니다. 새로운 일정을 추가해보세요.</p>
          </div>
        ) : (
          <>
            {hasVisitItems && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-black text-white/20 uppercase tracking-[0.1em]"><span className="text-white/60">방문일 {filteredVisits.length}건</span></h2>
                  {filteredVisits.length > 1 && <span className="text-[10.5px] text-white/60 font-bold tracking-tighter animate-pulse">옆으로 밀어보기</span>}
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                  {filteredVisits.map((s) => {
                    const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
                    const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
                    const additionalReviews = getAdditionalReviews(s)
                    const hasPhone = cleanPhoneNumber(s.phone).length > 0
                    const hasLocation = locationLabel.length > 0
                    const visitLabel = formatVisitDateLabel(s.visit, today)
                    
                    return (
                      <div
                        key={s.id}
                        className={`${visitCardMinWidthClass} snap-center bg-[#121214] rounded-[2.5rem] p-7 border border-white/[0.05] shadow-2xl space-y-6`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-1 mb-4">
                            <div className="flex justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-[10px] font-black bg-blue-500 text-white px-2.5 py-1 rounded-full uppercase tracking-[0.03em]">
                                  {visitLabel && (
                                    <span className="mr-1">{visitLabel} /</span>
                                  )}
                                  {formatVisitTimeLabel(s.visitTime)}
                                </div>
                                <span className="text-[10.5px] font-bold text-white/60 uppercase">{s.platform}</span>
                                {s.paybackExpected && (
                                  <span className="text-[10.5px] font-bold text-[#8a72ff] flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 translate-y-[-1px]" /> 환급금
                                  </span>
                                )}
                              </div>
                              <button onClick={() => { setEditingScheduleId(s.id); setIsModalVisible(true); }} className="p-1.5 text-white/20 hover:text-white transition-colors">
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <ScheduleChannelBadges channels={s.channel} />
                              {additionalReviews.map((rev, idx) => (
                                <span key={idx} className="text-[9px] font-bold text-blue-400/50 bg-blue-400/5 px-1.5 py-1 rounded-md border border-blue-400/10">
                                  + {rev}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-xl font-bold leading-tight tracking-tight truncate">{s.title}</h3>
                          </div>

                          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-white/[0.02] rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-white/20 shrink-0" />
                              <span className={`text-[13px] truncate font-medium ${hasLocation ? 'text-white/50' : 'text-white/20'}`}>
                                {hasLocation ? locationLabel : "위치 정보 없음"}
                              </span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button 
                                disabled={!hasLocation}
                                onClick={() => window.open(`https://www.google.com/search?q=날씨+${s.region || '내위치'}`, '_blank')}
                                className="p-2.5 bg-white/5 rounded-xl text-white/30 transition-colors hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <CloudRain className="w-4 h-4" />
                              </button>
                              <button 
                                disabled={!hasLocation}
                                onClick={() => window.open(`https://map.naver.com/v5/search/${mapQuery}`, '_blank')}
                                className="p-2.5 bg-white/5 rounded-xl text-white/30 transition-colors hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <Map className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-[-6px]">
                          <button
                            type="button"
                            onClick={() => handleReceiptButtonClick(s)}
                            disabled={uploadingReceiptFor === s.id}
                            className="flex-1 py-2 bg-white text-black rounded-2xl font-bold text-[12px] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
                          >
                            <Camera className="w-4 h-4" /> {uploadingReceiptFor === s.id ? "저장 중..." : "영수증 저장"}
                          </button>
                            
                          {hasPhone && (
                            <div className="flex bg-[#1e1e20] rounded-2xl border border-white/5">
                              <a href={`tel:${cleanPhoneNumber(s.phone)}`} className="p-2 border-r border-white/5 active:bg-white/5"><Phone className="w-4 h-4 text-white/30" /></a>
                            </div>
                          )}
                          <div className="flex bg-[#1e1e20] rounded-2xl border border-white/5">
                            <button onClick={() => handleOpenSmsModal(s, 'visit')} className="p-2 active:bg-white/5">
                              <MessageCircle className="w-4 h-4 text-white/30" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {hasDeadlineItems && (
              <>
                {/* 2. 마감 임박 (압축형 리스트) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-black text-red-500/30 uppercase tracking-[0.1em]"><span className="text-white/60">마감일 {filteredDeadlines.length}건</span></h2>
                  </div>

                  <div className="bg-[#121214] rounded-[2.5rem] border border-white/[0.05] divide-y divide-white/5 overflow-hidden">
                    {filteredDeadlines.map((s) => {
                      const netLoss = (s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)
                      const additionalReviews = getAdditionalReviews(s)
                      const deadlineLabel = formatDeadlineLabel(s.dead, today)
                      return (
                        <div key={s.id} className="p-5 flex flex-col gap-3 active:bg-white/[0.02] transition-all">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center flex-wrap gap-2">
                                  {deadlineLabel && (
                                    <span className="text-[9px] font-bold bg-red-900 text-white px-2.5 py-0.5 rounded">
                                      {deadlineLabel}
                                    </span>
                                  )}
                                  <span className="text-[10.5px] font-bold text-white/60 uppercase">{s.platform}</span>
                                  {s.paybackExpected && (
                                    <span className="text-[10.5px] font-bold text-[#8a72ff] flex items-center gap-1">
                                      <AlertCircle className="w-2.5 h-2.5 translate-y-[-1px]" /> 환급금
                                    </span>
                                  )}
                                </div>
                                <h3 className="mt-2 text-base font-bold text-white/90 truncate pr-6">{s.title}</h3>
                              </div>
                              <button onClick={() => { setEditingScheduleId(s.id); setIsModalVisible(true); }} className="p-1 text-white/20 hover:text-white shrink-0">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-2 min-w-0">
                              <ScheduleChannelBadges channels={s.channel} />
                              {additionalReviews.map((rev, idx) => (
                                <span key={idx} className="text-[9px] font-bold text-blue-400/50 bg-blue-400/5 px-1.5 py-1 rounded-md border border-blue-400/10">+ {rev}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black text-red-600">{formatCurrency(netLoss)}원</span>
                              <button 
                                onClick={() => handleOpenSmsModal(s, 'deadline')}
                                className="p-2 bg-white/5 rounded-lg border border-white/5 text-white/40 active:scale-95 transition-all"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>

      {/* 통합 메시지 모달 생략 (이전과 동일) */}
      <Dialog open={isSmsModalOpen} onOpenChange={setIsSmsModalOpen}>
        <DialogContent showCloseButton={false} className="bg-[#121214] border-white/10 text-white max-w-sm rounded-[2.5rem] p-6 outline-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex justify-between items-center w-full">
              <DialogTitle className="text-xl font-bold tracking-tight">메시지 작성</DialogTitle>
              <button onClick={() => setIsSmsModalOpen(false)} className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-white/50">
                  {smsType === 'visit' ? "방문형 메시지" : "마감형 메시지"}
                </p>
                <span className="text-[10px] text-white/40">{templates.length}개 템플릿</span>
              </div>

              {templates.length > 0 && activeTemplate ? (
                <div className="space-y-3">
                  <div className="flex gap-2 rounded-2xl bg-white/5 p-1">
                    {templates.map((template) => {
                      const Icon = template.icon
                      const isActive = template.id === activeTemplate.id
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold uppercase transition ${
                            isActive
                              ? "bg-white text-black shadow-lg"
                              : "bg-white/10 text-white/70 hover:bg-white/20"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? "text-black" : "text-white/60"}`} />
                          {template.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-white/40">
                  템플릿을 불러오는 중입니다.
                </div>
              )}
            </div>

            <div className="relative space-y-3">
              <Textarea
                value={customSmsBody}
                onChange={(e) => setCustomSmsBody(e.target.value)}
                className="min-h-[140px] bg-white/[0.03] border-white/10 rounded-2xl p-4 pr-12 text-sm leading-relaxed text-white/80 focus:ring-[#5c3dff] focus:border-[#5c3dff] resize-none"
              />
              <button 
                onClick={async () => {
                  await navigator.clipboard.writeText(customSmsBody)
                  setIsCopied(true)
                  setTimeout(() => setIsCopied(false), 2000)
                  toast({ title: "메시지 복사 완료" })
                }}
                className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg text-white/40 active:scale-90 transition-all"
              >
                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <Button
              disabled={!(cleanPhoneNumber(smsTarget?.ownerPhone || smsTarget?.phone))}
              onClick={() => {
                sendSms(smsTarget?.ownerPhone || smsTarget?.phone || "", customSmsBody);
                setIsSmsModalOpen(false);
              }}
              className="w-full py-7 bg-white text-black rounded-2xl font-black text-base shadow-xl active:scale-95 disabled:bg-white/10 disabled:text-white/30 transition-all"
            >
              {cleanPhoneNumber(smsTarget?.ownerPhone || smsTarget?.phone) ? <><Send className="w-5 h-5" /> 문자 발송하기</> : "연락처 등록 후 발송"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isModalVisible && editingSchedule && (
        <ScheduleModal
          isOpen={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={async (s) => { await updateSchedule(s.id, s); setIsModalVisible(false); return true; }}
          onDelete={async (id) => { await deleteSchedule(id); setIsModalVisible(false); }}
          schedule={editingSchedule}
        />
      )}
      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReceiptFileSelected}
      />
    </div>
  )
}
