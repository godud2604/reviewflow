"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule } from "@/types"
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
  if (checklist.cafeReview) reviews.push("카페")
  if (checklist.googleReview) reviews.push("구글")
  if (checklist.other && checklist.otherText) reviews.push(checklist.otherText.slice(0, 3))
  return reviews
}

const formatScheduleTitle = (schedule: Schedule) =>
  schedule.title ? `'${schedule.title}'` : "진행 중인 일정"

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

export default function NotificationsPage() {
  const { user } = useAuth()
  const { schedules, updateSchedule, deleteSchedule } = useSchedules({ enabled: !!user })
  const { toast } = useToast()
  const today = useMemo(() => startOfDay(getKstNow()), [])
  
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  
  const [smsTarget, setSmsTarget] = useState<Schedule | null>(null)
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [customSmsBody, setCustomSmsBody] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [smsType, setSmsType] = useState<'visit' | 'deadline'>('visit')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const todaysVisits = useMemo(() => schedules.filter((s) => parseDateValue(s.visit) && diffDaysFrom(parseDateValue(s.visit)!, today) === 0), [schedules, today])
  const todaysDeadlines = useMemo(() => schedules.filter((s) => parseDateValue(s.dead) && diffDaysFrom(parseDateValue(s.dead)!, today) === 0), [schedules, today])
  const totalDeadlineNetImpact = useMemo(() => todaysDeadlines.reduce((sum, s) => sum + ((s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)), 0), [todaysDeadlines])

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

  const editingSchedule = schedules.find(s => s.id === editingScheduleId)

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6 pb-40 font-sans tracking-tight">
      {/* 가로 스크롤바 디자인 제거 스타일 */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="max-w-md mx-auto space-y-10">
        
        <header className="pt-8 px-1">
          <p className="text-[#A1A1AA] text-xs font-bold uppercase tracking-widest mb-2">Daily Brief</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tighter mb-4">
            오늘 할 일 <span className="text-[#5c3dff]">{todaysVisits.length + todaysDeadlines.length}건</span>
          </h1>
          <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-[14px]">
            <span className="text-[#cbd0de]">수익 방어</span>
            <span className="text-[#5c3dff] font-bold">{formatCurrency(totalDeadlineNetImpact)}원</span>
          </div>
        </header>

        {/* 1. 오늘 방문 일정 (가로 스와이프 재활성화 + 스크롤바 제거) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black text-white/20 uppercase tracking-[0.25em]">Visit Tasks</h2>
            {todaysVisits.length > 1 && <span className="text-[10px] text-white/10 font-bold tracking-tighter animate-pulse">옆으로 밀어보기</span>}
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
            {todaysVisits.length > 0 ? (
              todaysVisits.map((s) => {
                const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
                const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
                const additionalReviews = getAdditionalReviews(s)
                const hasPhone = cleanPhoneNumber(s.phone).length > 0
                const hasLocation = locationLabel.length > 0
                
                return (
                  <div key={s.id} className="min-w-[90%] snap-center bg-[#121214] rounded-[2.5rem] p-7 border border-white/[0.05] shadow-2xl space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black bg-blue-500 text-white px-2.5 py-1 rounded-full uppercase">
                          {formatVisitTimeLabel(s.visit_time)}
                        </span>
                        <span className="text-[10px] font-bold text-white/30 uppercase">{s.platform}</span>
                        {s.paybackExpected && (
                          <span className="text-[10px] font-bold text-[#8a72ff] bg-[#5c3dff]/10 px-2 py-1 rounded-md border border-[#5c3dff]/20 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> 환급금
                          </span>
                        )}
                        {additionalReviews.map((rev, idx) => <span key={idx} className="text-[9px] font-bold text-blue-400/50 bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">+{rev}</span>)}
                      </div>

                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-2xl font-bold leading-tight tracking-tight truncate">{s.title}</h3>
                        <button onClick={() => { setEditingScheduleId(s.id); setIsModalVisible(true); }} className="p-1.5 text-white/20 hover:text-white transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>

                      {/* 위치 정보 레이아웃 유지 (없으면 액션 비활성화) */}
                      <div className="flex items-center justify-between gap-3 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
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

                    <div className="flex gap-3">
                      <button className="flex-1 py-2.5 bg-white text-black rounded-2xl font-black text-[12px] active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Camera className="w-5 h-5" /> 영수증 저장
                      </button>
                      
                      {hasPhone && (
                        <div className="flex bg-[#1e1e20] rounded-2xl border border-white/5">
                          <a href={`tel:${cleanPhoneNumber(s.phone)}`} className="p-4.5 border-r border-white/5 active:bg-white/5"><Phone className="w-5 h-5 text-white/30" /></a>
                          <button onClick={() => handleOpenSmsModal(s, 'visit')} className="p-2.5 active:bg-white/5">
                            <MessageCircle className="w-5 h-5 text-white/30" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="w-full py-20 text-center text-white/10 border border-dashed border-white/5 rounded-[2.5rem] text-sm italic">예정된 방문이 없습니다.</div>
            )}
          </div>
        </section>

        {/* 2. 마감 임박 (압축형 리스트) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black text-red-500/30 uppercase tracking-[0.25em]">Urgent Deadlines</h2>
          </div>

          {todaysDeadlines.length > 0 ? (
            <div className="bg-[#121214] rounded-[2.5rem] border border-white/[0.05] divide-y divide-white/5 overflow-hidden">
              {todaysDeadlines.map((s) => {
                const netLoss = (s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)
                const additionalReviews = getAdditionalReviews(s)
                return (
                  <div key={s.id} className="p-5 flex flex-col gap-3 active:bg-white/[0.02] transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded leading-none tracking-tighter">D-DAY</span>
                          <span className="text-[10px] font-bold text-white/30 uppercase">{s.platform}</span>
                          {s.paybackExpected && (
                            <span className="text-[9px] font-bold text-blue-400/80 bg-blue-400/5 px-1.5 py-0.5 rounded border border-blue-400/20 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> 환급금
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white/90 truncate pr-6">{s.title}</h3>
                      </div>
                      <button onClick={() => { setEditingScheduleId(s.id); setIsModalVisible(true); }} className="p-1 text-white/20 hover:text-white shrink-0"><MoreVertical className="w-4 h-4" /></button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {additionalReviews.map((rev, idx) => (
                          <span key={idx} className="text-[9px] font-bold text-red-400/40 bg-red-400/5 px-1.5 py-0.5 rounded border border-red-400/10">+{rev}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-red-500">-{formatCurrency(netLoss)}원</span>
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
          ) : (
            <div className="py-16 text-center text-white/10 border border-dashed border-white/5 rounded-[2.5rem] text-sm font-medium">마감이 임박한 일정이 없습니다.</div>
          )}
        </section>
      </div>

      {/* 통합 메시지 모달 생략 (이전과 동일) */}
      <Dialog open={isSmsModalOpen} onOpenChange={setIsSmsModalOpen}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm rounded-[2.5rem] p-6 outline-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex justify-between items-center w-full">
              <DialogTitle className="text-xl font-bold tracking-tight">메시지 작성</DialogTitle>
              <button onClick={() => setIsSmsModalOpen(false)} className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-6">
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
      <input ref={receiptFileInputRef} type="file" accept="image/*" capture="environment" className="hidden" />
    </div>
  )
}
