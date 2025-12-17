"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule } from "@/types"
import { 
  Bell, 
  CheckCircle2, 
  ChevronRight, 
  ExternalLink, 
  Camera, 
  MessageSquare, 
  CloudRain, 
  AlertCircle,
  Loader2,
  Phone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import ScheduleModal from "@/components/schedule-modal"
import { useToast } from "@/hooks/use-toast"
import { uploadGuideFile } from "@/lib/storage"

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
const hasVisitReviewChecklist = (schedule: Schedule) => {
  const checklist = schedule.visitReviewChecklist
  if (!checklist) return false
  const hasFlag =
    checklist.naverReservation ||
    checklist.platformAppReview ||
    checklist.cafeReview ||
    checklist.googleReview ||
    checklist.other
  const textProvided = Boolean(checklist.otherText?.trim())
  return hasFlag || textProvided
}
const formatVisitTimeLabel = (value?: string) => {
  const trimmed = value?.trim()
  if (!trimmed) return "방문 시간 미지정"
  const [hourPart, minutePart = "00"] = trimmed.split(":")
  const hour = Number(hourPart)
  if (Number.isNaN(hour)) return trimmed
  const minute = minutePart.padStart(2, "0")
  const period = hour < 12 ? "오전" : "오후"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${displayHour}:${minute}`
}
const truncateTitle = (value: string, maxLength = 38) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value

// 연락처 정제 함수 (숫자만 남김)
const cleanPhoneNumber = (phone?: string) => phone?.replace(/[^0-9]/g, "") || ""

export default function NotificationsPage() {
  const { user } = useAuth()
  const { schedules, updateSchedule, deleteSchedule } = useSchedules({ enabled: !!user })
  const { toast } = useToast()
  const today = useMemo(() => startOfDay(getKstNow()), [])
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null)
  const receiptTargetRef = useRef<number | null>(null)
  const [uploadingReceiptId, setUploadingReceiptId] = useState<number | null>(null)
  
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const isReceiptUploading = uploadingReceiptId !== null

  // --- 데이터 필터링 ---
  const todaysVisits = useMemo(() => 
    schedules.filter((s) => parseDateValue(s.visit) && diffDaysFrom(parseDateValue(s.visit)!, today) === 0)
  , [schedules, today])

  const todaysDeadlines = useMemo(() => 
    schedules.filter((s) => parseDateValue(s.dead) && diffDaysFrom(parseDateValue(s.dead)!, today) === 0)
  , [schedules, today])

  const totalDeadlineNetImpact = useMemo(
    () =>
      todaysDeadlines.reduce(
        (sum, schedule) =>
          sum +
          ((schedule.benefit ?? 0) + (schedule.income ?? 0) - (schedule.cost ?? 0)),
        0,
      ),
    [todaysDeadlines],
  )

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "체험단러"

  // --- 핸들러 ---
  const handleOpenModal = (id: number) => {
    setEditingScheduleId(id)
    setIsModalVisible(true)
  }

  // 마감 연장 문자 발송 핸들러 개선
  const sendDelaySms = (schedule: Schedule) => {
    const phoneNumber = cleanPhoneNumber(schedule.ownerPhone)
    if (!phoneNumber) {
      toast({ title: "사장님 연락처가 등록되어 있지 않습니다.", variant: "destructive" })
      return
    }
    const body = `안녕하세요 광고주님, '${schedule.title}' 진행 중인 ${userName}입니다. 부득이하게 리뷰 마감 기한 연장이 가능할지 여쭤봅니다.`
    // iOS와 Android 호환을 위한 sms 구분자 처리 (iOS는 & 사용)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const separator = isIOS ? '&' : '?'
    window.location.href = `sms:${phoneNumber}${separator}body=${encodeURIComponent(body)}`
  }

  const handleReceiptButtonClick = (schedule: Schedule) => {
    if (isReceiptUploading || !hasVisitReviewChecklist(schedule)) return
    receiptTargetRef.current = schedule.id
    receiptFileInputRef.current?.click()
  }

  const handleReceiptFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const scheduleId = receiptTargetRef.current
    if (!file || !scheduleId || !user) {
      receiptTargetRef.current = null
      event.target.value = ""
      return
    }

    setUploadingReceiptId(scheduleId)
    try {
      const uploadedFile = await uploadGuideFile(user.id, scheduleId, file)
      const targetSchedule = schedules.find((s) => s.id === scheduleId)
      let nextFiles = targetSchedule ? [...targetSchedule.guideFiles, uploadedFile] : [uploadedFile]
      nextFiles = nextFiles.filter((f): f is NonNullable<typeof f> => f !== null)
      const updateSuccess = await updateSchedule(scheduleId, { guideFiles: nextFiles })
      if (updateSuccess) {
        toast({ title: "영수증이 저장되었습니다.", duration: 2500 })
      } else {
        toast({ title: "영수증 정보를 업데이트하지 못했습니다.", variant: "destructive", duration: 3000 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류"
      toast({ title: "영수증 업로드 실패", description: message, variant: "destructive", duration: 3000 })
    } finally {
      setUploadingReceiptId(null)
      receiptTargetRef.current = null
      event.target.value = ""
    }
  }

  const editingSchedule = schedules.find(s => s.id === editingScheduleId)

  return (
    <div className="min-h-screen bg-[#0F1117] text-white p-6 pb-32 font-sans">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* 1. 헤더 */}
        <header className="flex justify-between items-start pt-4 mb-10">
          <div>
            <p className="text-[#A1A1AA] text-sm font-medium mb-1 uppercase tracking-wider">Daily Brief</p>
            <h1 className="text-2xl font-bold leading-tight">
              오늘 챙겨야 할 체험단은<br/>
              총 <span className="text-[#5c3dff]">{todaysVisits.length + todaysDeadlines.length}건</span>입니다.
            </h1>
            <p className="mt-2 text-[12.5px] font-semibold text-[#cbd0de]">
              오늘 마감을 모두 지키면 총{" "}
              <span className="text-[#5c3dff] font-bold">{formatCurrency(totalDeadlineNetImpact)}원</span>의 수익을 지킬 수 있어요! 💰
            </p>
          </div>
        </header>

        {/* 2. 오늘 방문 일정 섹션 */}
        {todaysVisits.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold px-2 flex items-center gap-2 text-white/90">
              📍 오늘 방문 일정 <span className="text-sm font-normal text-[#A1A1AA]">{todaysVisits.length}건</span>
            </h2>

            {todaysVisits.map((s) => {
              const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
              const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
              const visitTimeLabel = formatVisitTimeLabel(s.visitTime)
              const cleanedPhone = cleanPhoneNumber(s.phone)
              const cleanedOwnerPhone = cleanPhoneNumber(s.ownerPhone)

              return (
                <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-5 border border-[#2D2F39] space-y-5 shadow-xl">
                  {/* 방문 헤더 */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#252833] flex items-center justify-center border border-[#3D3F49] shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-[#5c3dff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-0.5 font-bold text-white text-lg truncate">{s.title}</h3>
                      <div className="flex items-center gap-2 text-sm font-medium text-[#A1A1AA]">
                        <span>🕒 {visitTimeLabel}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(s.id)}
                      className="shrink-0 flex items-center rounded-xl border border-[#3D3F49] bg-[#252833] px-3 py-1.5 text-[11px] font-bold text-[#D1D1D6] hover:bg-[#323645] transition-colors"
                    >
                      체험단 상세보기
                    </button>
                  </div>

                  {/* 연락처 및 위치 정보 개선 */}
                  {(locationLabel || cleanedPhone || cleanedOwnerPhone) && (
                    <div className="space-y-3 px-1 py-1">
                      {locationLabel && (
                        <div className="flex items-center justify-between text-sm group">
                          <div className="flex items-center gap-2 text-[#cbd0de]">
                            <span className="font-bold text-[#f8fafc] w-16">위치</span>
                            <span className="truncate max-w-[180px]">{locationLabel}</span>
                          </div>
                          <a
                            href={`https://map.naver.com/v5/search/${mapQuery}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#2D2F39] p-2 rounded-lg hover:bg-[#3D3F49] transition-colors"
                          >
                            📍
                          </a>
                        </div>
                      )}
                      
                      {cleanedPhone && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-[#cbd0de]">
                            <span className="font-bold text-[#f8fafc] w-16">가게 번호</span>
                            <span className="text-[#9fa3d9]">{s.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`tel:${cleanedPhone}`} className="bg-[#2D2F39] p-2 rounded-lg hover:bg-green-900/30 transition-colors">📞</a>
                            <a href={`sms:${cleanedPhone}`} className="bg-[#2D2F39] p-2 rounded-lg hover:bg-blue-900/30 transition-colors">💬</a>
                          </div>
                        </div>
                      )}

                      {cleanedOwnerPhone && (
                        <div className="flex items-center justify-between text-sm border-t border-[#2D2F39] pt-3">
                          <div className="flex items-center gap-2 text-[#cbd0de]">
                            <span className="font-bold text-[#f8fafc] w-16">사장님</span>
                            <span className="text-[#9fa3d9]">{s.ownerPhone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`tel:${cleanedOwnerPhone}`} className="bg-[#2D2F39] p-2 rounded-lg hover:bg-green-900/30 transition-colors">📞</a>
                            <a href={`sms:${cleanedOwnerPhone}`} className="bg-[#2D2F39] p-2 rounded-lg hover:bg-blue-900/30 transition-colors">💬</a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 메모 및 버튼 영역 */}
                  <div className="space-y-3">
                    {s.memo?.trim() && (
                      <div className="bg-[#16181D] px-4 py-3 rounded-2xl border border-[#2D2F39] text-sm text-[#A1A1AA]">
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{s.memo}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={`https://www.google.com/search?q=날씨+${s.region || '내위치'}`}
                        target="_blank"
                        className="flex items-center justify-center gap-2 py-3.5 bg-[#252833] rounded-2xl border border-[#313545] hover:border-[#5c3dff] transition-all"
                      >
                        <CloudRain className="w-4 h-4 text-blue-400" />
                        <span className="text-[11px] font-bold text-[#D1D1D6]">오늘 우산 챙길까?</span>
                      </a>
                      <button
                        onClick={() => handleReceiptButtonClick(s)}
                        className="flex items-center justify-center gap-2 py-3.5 bg-[#252833] rounded-2xl border border-[#313545] hover:border-amber-500 transition-all"
                      >
                        {uploadingReceiptId === s.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        ) : (
                          <Camera className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-[11px] font-bold text-[#D1D1D6]">
                          {uploadingReceiptId === s.id ? "업로드 중..." : "영수증 촬영"}
                        </span>
                      </button>
                    </div>

                    {s.paybackExpected && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-[#5c3dff]/10 rounded-2xl border border-[#5c3dff]/20">
                        <AlertCircle className="w-4 h-4 text-[#5c3dff]" />
                        <span className="text-[11px] font-bold text-[#cbd0de]">광고주에게 돌려받을 환급금이 있어요</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* 3. 마감 임박 (D-Day) 섹션 */}
        {todaysDeadlines.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold px-2 text-white/90">⏰ 마감 임박 포스팅</h2>
            
            {todaysDeadlines.map((s) => {
              const cleanedOwnerPhone = cleanPhoneNumber(s.ownerPhone)
              const netLoss = (s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)
              
              return (
                <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-6 border-l-4 border-l-[#ff4d4d] border border-[#2D2F39] space-y-5 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="text-[14px] font-black text-red-500 tracking-tighter uppercase">D-Day</span>
                      <h3 className="text-lg font-bold text-white leading-snug truncate" title={s.title}>
                        {s.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(s.id)}
                      className="mt-1 shrink-0 flex items-center rounded-xl border border-[#3D3F49] bg-[#252833] px-3 py-1.5 text-[11px] font-bold text-[#D1D1D6] hover:bg-[#323645]"
                    >
                      체험단 상세보기
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    미작성 시 {formatCurrency(netLoss)}원 상당의 혜택을 놓치게 돼요! 💸
                  </div>

                  {/* 마감 연장 및 소통 섹션 개선 */}
                  <div className="pt-2 border-t border-[#2D2F39] space-y-4">
                    <div className="flex flex-col gap-3">
                      <p className="text-[11px] text-[#A1A1AA] text-center font-medium">일정 연장이 필요한가요? 미리 조율해보세요.</p>
                      
                      {cleanedOwnerPhone ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => sendDelaySms(s)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#252833] rounded-2xl font-bold text-sm hover:bg-[#4a30cc] transition-colors shadow-lg"
                          >
                            <MessageSquare className="w-4 h-4" />
                            연장 요청 문자
                          </button>
                          <a
                            href={`tel:${cleanedOwnerPhone}`}
                            className="p-3 bg-[#2D2F39] rounded-2xl border border-[#3D3F49] hover:bg-[#323645]"
                            aria-label="전화하기"
                          >
                            <Phone className="w-4 h-4 text-[#D1D1D6]" />
                          </a>
                        </div>
                      ) : (
                        <div className="p-3 text-center bg-[#252833] rounded-2xl border border-[#313545] border-dashed">
                          <span className="text-[11px] text-[#A1A1AA]">등록된 사장님 연락처가 없습니다.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {/* 모달 */}
      {isModalVisible && editingSchedule && (
        <ScheduleModal
          isOpen={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={async (s) => {
            const success = await updateSchedule(s.id, s)
            if (success) setIsModalVisible(false)
            return true
          }}
          onDelete={async (id) => {
            await deleteSchedule(id)
            setIsModalVisible(false)
          }}
          schedule={editingSchedule}
        />
      )}
      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleReceiptFileChange}
      />
    </div>
  )
}