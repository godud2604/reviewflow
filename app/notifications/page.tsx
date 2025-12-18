"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useEffect, useCallback, type ChangeEvent } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule, ScheduleChannel, GuideFile } from "@/types"
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
  Copy,
  ChevronRight,
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
  if (diff === 0) return "D - DAY"
  return diff > 0 ? `D - ${diff}` : `D + ${Math.abs(diff)}`
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

const formatVisitDateForWeatherSearch = (visit?: string) => {
  const target = parseDateValue(visit)
  if (!target) return null
  return `${target.getMonth() + 1}월 ${target.getDate()}일`
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
  { id: "week", label: "일주일", minDiff: 0, maxDiff: 6 },
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
      `안녕하세요 사장님! 오늘 ${formatVisitTimeLabel(schedule.visitTime)}에 방문 예정인 체험단 ${userName}입니다. 약속한 시간에 맞춰 늦지 않게 방문하겠습니다. 잠시 후 뵙겠습니다!`,
  },
  {
    id: "visit-change",
    label: "시간 조율",
    description: "불가피한 일정 조정을 부탁할 때",
    icon: MessageCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님, 체험단 ${userName}입니다. 오늘 방문 일정에 갑작스러운 변동이 생겨 실례를 무릅쓰고 연락드렸습니다. 혹시 오늘 중 다른 편하신 시간대가 있으실지, 아니면 다른 날로 다시 일정을 잡는 것이 좋을지 여쭤보고 싶습니다. 번거롭게 해드려 정말 죄송합니다.`,
  },
  {
    id: "visit-deadline",
    label: "마감 요청",
    description: "방문 후 리뷰 마감을 부드럽게 끌고 갈 때",
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님! 오늘 방문 예정인 체험단 ${userName}입니다. 다름이 아니라, 방문 후 현장 사진과 내용을 더 꼼꼼히 정리하여 퀄리티 높은 리뷰를 작성해 드리고 싶어 마감 기한을 조금 여유 있게 조율할 수 있을지 여쭤봅니다. 정성스러운 포스팅으로 보답하겠습니다!`,
  },
]

const deadlineTemplateDefinitions: TemplateDefinition[] = [
  {
    id: "deadline-delay",
    label: "지연 안내",
    description: "예상보다 늦어지는 이유를 설명",
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `광고주님 안녕하세요. 현재 진행 중인 ${formatScheduleTitle(
        schedule
      )} 포스팅의 완성도를 높이는 과정에서 예상보다 시간이 조금 더 소요되고 있습니다. 기다려 주시는 만큼 꼼꼼하게 마무리하여 내일 중으로 반드시 업로드/전달드리겠습니다. 불편을 끼쳐드려 죄송합니다.`,
  },
  {
    id: "deadline-extension",
    label: "기한 연장",
    description: "마감이 닥친 상태에서 여유를 요청",
    icon: Check,
    body: ({ schedule, userName }) =>
      `안녕하세요 광고주님, ${formatScheduleTitle(
        schedule
      )} 리뷰를 정리하는 과정에서 조금 더 세밀한 검토가 필요할 것 같습니다. 정성스러운 리뷰를 위해 부득이하게 기한 연장을 부탁드리고자 합니다. 혹시 내일 오전 중까지로 검토 기한을 조정해 주실 수 있을까요? 너그러운 양해 부탁드립니다.`,
  },
  {
    id: "deadline-status",
    label: "현황 공유",
    description: "지금까지의 진행 상황을 간단히",
    icon: MessageSquare,
    body: ({ schedule, userName }) =>
      `체험단 ${userName}입니다. 현재 ${formatScheduleTitle(
        schedule
      )} 리뷰 자료 수집을 마치고 최종 원고를 편집 중입니다. 오늘 중으로 초안 정리를 완료하여 공유드릴 예정이니, 잠시만 기다려 주시면 감사하겠습니다. 만족하실만한 결과물로 찾아뵙겠습니다!`,
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
            className="text-[12.5px] font-semibold text-white/80 bg-white/5 border border-white/10 rounded-full px-2 py-1 whitespace-nowrap"
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

  const [callMenuTarget, setCallMenuTarget] = useState<number | null>(null)
  const [receiptFocusScheduleId, setReceiptFocusScheduleId] = useState<number | null>(null)
  const clearReceiptFocus = useCallback(() => {
    setReceiptFocusScheduleId(null)
  }, [])
  
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest("[data-call-menu]")) {
        return
      }
      setCallMenuTarget(null)
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  const handleCallSelection = (schedule: Schedule, target: "store" | "owner") => {
    const rawNumber = target === "store" ? schedule.phone : schedule.ownerPhone
    const cleaned = cleanPhoneNumber(rawNumber)
    const label = target === "store" ? "가게번호" : "사장님번호"
    if (!cleaned) {
      toast({
        title: `${label}가 없습니다.`,
        variant: "destructive",
      })
      setCallMenuTarget(null)
      return
    }
    setCallMenuTarget(null)
    window.location.href = `tel:${cleaned}`
  }

  const handleReceiptButtonClick = (schedule: Schedule) => {
    const existingCount = schedule.guideFiles?.length ?? 0
    if (existingCount >= 2) {
      toast({
        title: "영수증은 최대 2개까지 저장할 수 있습니다.",
        variant: "destructive",
      })
      return
    }
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

    const existingCount = targetSchedule.guideFiles?.length ?? 0
    if (existingCount >= 2) {
      toast({
        title: "영수증은 최대 2개까지 저장할 수 있습니다.",
        variant: "destructive",
      })
      event.target.value = ""
      setReceiptTarget(null)
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

    if (!file.type.startsWith("image/")) {
      const alertMessage = "사진만 업로드할 수 있습니다."
      alert(alertMessage)
      toast({
        title: alertMessage,
        variant: "destructive",
      })
      setReceiptTarget(null)
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
      setEditingScheduleId(targetSchedule.id)
      setIsModalVisible(true)
      setReceiptFocusScheduleId(targetSchedule.id)
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

  const handleUpdateScheduleFiles = useCallback(
    async (id: number, files: GuideFile[]) => {
      await updateSchedule(id, { guideFiles: files })
    },
    [updateSchedule]
  )

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
          <div className="flex flex-wrap items-start gap-4">
            <div className="space-y-2">
              <p className="text-[#A1A1AA] text-sm font-bold uppercase tracking-[0.2em]">Daily Brief</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
                <span className="block">{timeframeTitle}</span>
                <span className="inline-block text-[2.8rem] font-black tracking-tight text-transparent bg-gradient-to-br from-[#6c63ff] to-[#aa4bf8] bg-clip-text animated-count">
                  {animatedTaskCount}건
                </span>
              </h1>
            </div>
          </div>
        </header>
        <div className="fixed top-3 z-20 px-1 right-3">
          <div className="flex w-full justify-end">
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-1 text-[14px] font-bold uppercase tracking-[0.1em] text-white/60">
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
        </div>

        {showEmptyState ? (
          <div className="py-24 text-center border border-dashed border-white/10 rounded-[2.5rem] text-white/40 space-y-2">
            <p className="text-base font-bold text-white/80">방문이나 마감 일정이 아직 없어요.</p>
          </div>
        ) : (
          <>
            {hasVisitItems && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[14px] font-black text-white/20 uppercase tracking-[0.1em]"><span className="text-white/60">방문일 {filteredVisits.length}건</span></h2>
                  {filteredVisits.length > 1 && <span className="text-[14px] text-white/60 font-bold tracking-tighter animate-pulse">옆으로 밀어보기</span>}
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                  {filteredVisits.map((s) => {
                    const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
                    const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
                    const additionalReviews = getAdditionalReviews(s)
                    const visitLabel = formatVisitDateLabel(s.visit, today)
                    const hasLocation = locationLabel.length > 0
                    const weatherDateLabel = formatVisitDateForWeatherSearch(s.visit)
                    const weatherLocation = [s.region, s.regionDetail].filter(Boolean).join(" ")
                    const weatherQuery = `${weatherDateLabel ? `${weatherDateLabel} 날씨` : "날씨"} ${weatherLocation || "내 위치"}`
                    const storePhoneNumber = cleanPhoneNumber(s.phone)
                    const ownerPhoneNumber = cleanPhoneNumber(s.ownerPhone)
                    const contactOptions = [
                      { type: "store" as const, label: "가게번호", value: storePhoneNumber, display: s.phone || storePhoneNumber },
                      { type: "owner" as const, label: "사장님번호", value: ownerPhoneNumber, display: s.ownerPhone || ownerPhoneNumber },
                    ].filter((option) => option.value)
                    const hasContactOptions = contactOptions.length > 0
                    
                    return (
                      <div
                        key={s.id}
                        className={`${visitCardMinWidthClass} snap-center bg-[#121214] rounded-[2.5rem] px-6 py-4 border border-white/[0.05] shadow-2xl space-y-6`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-1 mb-4">
                            <div className="flex justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6c63ff]/20 via-[#aa4bf8]/10 to-[#ff7ae0]/10 px-3 py-1 text-[13px] font-semibold tracking-tight text-white ring-1 ring-white/10">
                                {visitLabel && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-bold tracking-tight text-white/80">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff7ae0]" aria-hidden="true" />
                                    {visitLabel}
                                  </span>
                                )}
                                <span className="text-[13px] font-semibold text-white">{formatVisitTimeLabel(s.visitTime)}</span>
                              </div>
                              <span className="text-[14px] font-bold text-white/60 uppercase">{s.platform}</span>
                              {s.paybackExpected && (
                                <span className="text-[14px] font-bold text-[#8a72ff] flex items-center gap-1">
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
                              {additionalReviews.length > 0 && (
                                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12.5px] font-bold text-white/80">
                                  <span aria-hidden>🧾</span>
                                  <span className="text-white/60">추가리뷰</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-xl font-bold leading-tight tracking-tight truncate">{s.title}</h3>
                          </div>

                          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-white/[0.02] rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-white/20 shrink-0" />
                              <span className={`text-[14px] truncate font-medium ${hasLocation ? 'text-white/50' : 'text-white/20'}`}>
                                {hasLocation ? locationLabel : "위치 정보 없음"}
                              </span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button 
                                disabled={!hasLocation}
                                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(weatherQuery)}`, '_blank')}
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
                            className="flex-1 py-2 bg-white text-black rounded-2xl font-bold text-[14px] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
                          >
                            <Camera className="w-4 h-4" /> {uploadingReceiptFor === s.id ? "저장 중..." : "영수증 저장"}
                          </button>

                          {hasContactOptions && (
                            <div className="relative">
                              <button
                                type="button"
                                data-call-menu="true"
                                aria-expanded={callMenuTarget === s.id}
                                onClick={() =>
                                  setCallMenuTarget(callMenuTarget === s.id ? null : s.id)
                                }
                                className="flex items-center justify-center rounded-2xl border border-white/5 bg-[#1e1e20] p-2 text-white/70 transition hover:text-white/90"
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                              {callMenuTarget === s.id && (
                                <div
                                  data-call-menu="true"
                                  className="absolute bottom-full right-0 z-50 w-44 -translate-y-2 rounded-2xl border border-white/10 bg-[#0d0d11] p-2 shadow-2xl"
                                >
                                  <div className="flex flex-col gap-1">
                                    {contactOptions.map((option) => (
                                      <button
                                        key={`${option.type}-${s.id}`}
                                        type="button"
                                        onClick={() => handleCallSelection(s, option.type)}
                                        className="w-full rounded-xl px-3 py-2 text-left text-[14px] font-semibold text-white/70 transition hover:text-white"
                                      >
                                        <span className="text-[14px] uppercase tracking-[0.2em] text-white/40">{option.label}</span>
                                        <span className="block text-sm font-bold text-white">{option.display}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
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
                    <h2 className="text-[14px] font-black text-red-500/30 uppercase tracking-[0.1em]"><span className="text-white/60">마감일 {filteredDeadlines.length}건</span></h2>
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
                                    <span className="rounded-full text-[14px] font-bold bg-red-900 text-white px-2.5 py-0.5 rounded">
                                      {deadlineLabel}
                                    </span>
                                  )}
                                  <span className="text-[14px] font-bold text-white/60 uppercase">{s.platform}</span>
                                  {s.paybackExpected && (
                                    <span className="text-[14px] font-bold text-[#8a72ff] flex items-center gap-1">
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

                          <div className="flex items-center justify-end gap-2">
                            <span className="shrink-0 text-[14px] font-bold text-red-1000">{formatCurrency(netLoss)}원</span>
                            <div className="flex bg-[#1e1e20] rounded-2xl border border-white/5">
                              <button onClick={() => handleOpenSmsModal(s, 'deadline')} className="p-2 active:bg-white/5">
                                <MessageCircle className="w-4 h-4 text-white/30" />
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
      <div className="fixed bottom-6 left-1/2 z-20 w-full max-w-md px-4 -translate-x-1/2">
        <Link
          href="/?page=home"
          className="flex items-center justify-center gap-2 rounded-[2rem] bg-gradient-to-r from-[#6c63ff] to-[#aa4bf8]/90 px-6 py-4 text-base font-black text-white shadow-[0_15px_45px_rgba(49,114,255,0.35)] transition hover:shadow-[0_20px_50px_rgba(33,91,255,0.45)]"
        >
          <span>모든 일정 보러가기</span>
          <ChevronRight className="w-4 h-4 text-white/90" />
        </Link>
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
                <p className="text-[14px] font-black uppercase tracking-[0.35em] text-white/50">
                  {smsType === 'visit' ? "방문형 메시지" : "마감형 메시지"}
                </p>
                <span className="text-[14px] text-white/40">{templates.length}개 템플릿</span>
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
                          className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-bold uppercase transition ${
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
              className="w-full py-7 bg-white text-black rounded-2xl font-black shadow-xl active:scale-95 disabled:bg-white/10 disabled:text-white/30 transition-all"
            >
              {cleanPhoneNumber(smsTarget?.ownerPhone || smsTarget?.phone) ? <><Send className="w-5 h-5" /> 문자 발송하러 가기</> : "연락처 등록 후 발송"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isModalVisible && editingSchedule && (
        <ScheduleModal
          isOpen={isModalVisible}
          onClose={() => {
            setIsModalVisible(false)
            clearReceiptFocus()
          }}
          onSave={async (s) => { await updateSchedule(s.id, s); setIsModalVisible(false); return true; }}
          onDelete={async (id) => { await deleteSchedule(id); setIsModalVisible(false); }}
          schedule={editingSchedule}
          onUpdateFiles={handleUpdateScheduleFiles}
          focusGuideFiles={receiptFocusScheduleId === editingSchedule.id}
          onGuideFilesFocusDone={clearReceiptFocus}
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
