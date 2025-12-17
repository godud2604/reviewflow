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

  const sendDelaySms = (schedule: Schedule) => {
    console.log('ownerPhone', schedule.ownerPhone)
    const body = `안녕하세요 광고주님, '${schedule.title}' 진행중인 ${userName}입니다. 부득이하게 리뷰 마감 기한 연장이 가능할지 여쭤봅니다.`
    window.location.href = `sms:${schedule.ownerPhone}?body=${encodeURIComponent(body)}`
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
      // Filter out nulls to satisfy GuideFile[] type
      nextFiles = nextFiles.filter((f): f is NonNullable<typeof f> => f !== null)
      const updateSuccess = await updateSchedule(scheduleId, { guideFiles: nextFiles })
      if (updateSuccess) {
        toast({
          title: "영수증이 저장되었습니다.",
          duration: 2500,
        })
      } else {
        toast({
          title: "영수증 정보를 업데이트하지 못했습니다.",
          variant: "destructive",
          duration: 3000,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류"
      toast({
        title: "영수증 업로드 실패",
        description: message,
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setUploadingReceiptId(null)
      receiptTargetRef.current = null
      event.target.value = ""
    }
  }

  const editingSchedule = schedules.find(s => s.id === editingScheduleId)

  return (
    <div className="min-h-screen bg-[#0F1117] text-white p-6 pb-32">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* 1. 헤더: 오늘 챙겨야 할 총 건수 알림 */}
        <header className="flex justify-between items-start pt-4 mb-10">
          <div>
            <p className="text-[#A1A1AA] text-sm font-medium mb-1 uppercase tracking-wider">Daily Brief</p>
            <h1 className="text-2xl font-bold leading-tight">
              오늘 챙겨야 할 체험단은<br/>
              총 <span className="text-[#5c3dff]">{todaysVisits.length + todaysDeadlines.length}건</span>입니다.
            </h1>

            <p className="mt-2 text-[12.5px] font-semibold text-[#cbd0de]">
              오늘 마감을 모두 지키면 총{" "}
              <span className="text-[#5c3dff]">{formatCurrency(totalDeadlineNetImpact)}원</span>의 수익을 지킬 수 있어요! 💰
            </p>
          </div>
          {/* TODO: 이거 누르면 알림 시간 설정하도록 */}
          {/* <div className="relative bg-[#1E2028] p-3 rounded-2xl border border-[#2D2F39]">
            <Bell className="w-5 h-5 text-[#FFD700]" fill="#FFD700" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
              {todaysDeadlines.length}
            </span>
          </div> */}
          {/* 이메일이 아니라, pwa 로 알림 설정하면 되잖아 ?... 나 천재인듯 */}
        </header>

        {/* 2. 오늘 방문 일정 섹션 */}
        {todaysVisits.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold px-2 flex items-center gap-2">
              📍 오늘 방문 일정 <span className="text-sm font-normal text-[#A1A1AA]">{todaysVisits.length}건</span>
            </h2>

        {todaysVisits.map((s) => {
          const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
          const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
          const isUploadingThisSchedule = uploadingReceiptId === s.id
          const visitTimeLabel = formatVisitTimeLabel(s.visitTime)
          return (
            <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-5 border border-[#2D2F39] space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#2D2F39] flex items-center justify-center border border-[#3D3F49]">
                      <CheckCircle2 className="w-6 h-6 text-[#5c3dff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-0.5 font-bold text-white truncate">{s.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[#A1A1AA]">
                        <span className="flex items-center gap-1">
                          <span aria-hidden="true">🕒</span>
                          <span className="ml-1">{visitTimeLabel}</span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(s.id)}
                      className="flex items-center rounded-2xl border border-[#3D3F49] bg-[#252833] px-3 py-1 text-[11px] font-semibold text-[#D1D1D6] hover:bg-[#2D3140] transition-colors"
                    >
                      체험단 상세보기
                    </button>
                  </div>

                  {(locationLabel || s.phone || s.ownerPhone) && (
                    <div className="space-y-1 text-[12px] text-[#cbd0de]">
                      {locationLabel && (
                        <p className="flex items-center gap-2">
                          <span className="font-semibold text-[#f8fafc]">위치</span>
                          {locationLabel}
                          <a
                            href={`https://map.naver.com/v5/search/${mapQuery}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] hover:underline"
                            aria-label="네이버 지도에서 위치 검색"
                          >
                            📍
                          </a>
                        </p>
                      )}
                      {s.phone && (
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#f8fafc]">가게 번호</span>
                          <a
                            href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`}
                            className="text-[#9fa3d9] hover:text-white"
                          >
                            {s.phone}
                          </a>
                          <a
                            href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`}
                            className="text-[14px] hover:underline"
                            aria-label="통화하기"
                          >
                            📞
                          </a>
                          <a
                            href={`sms:${s.phone.replace(/[^0-9+]/g, "")}`}
                            className="text-[14px] hover:underline"
                            aria-label="문자 보내기"
                          >
                            💬
                          </a>
                        </p>
                      )}
                      {s.ownerPhone && (
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#f8fafc]">사장님 연락처</span>
                          <a
                            href={`tel:${s.ownerPhone.replace(/[^0-9+]/g, "")}`}
                            className="text-[#9fa3d9] hover:text-white"
                          >
                            {s.ownerPhone}
                          </a>
                          <a
                            href={`tel:${s.ownerPhone.replace(/[^0-9+]/g, "")}`}
                            className="text-[14px] hover:underline"
                            aria-label="통화하기"
                          >
                            📞
                          </a>
                          <a
                            href={`sms:${s.ownerPhone.replace(/[^0-9+]/g, "")}`}
                            className="text-[14px] hover:underline"
                            aria-label="문자 보내기"
                          >
                            💬
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="">
                    {s.memo?.trim() && (
                      <div className="mb-3.5 bg-[#252833] px-4 py-3 rounded-2xl border border-[#2D2F39]/80 text-sm text-[#D1D1D6]">
                        <p className="text-xs font-semibold text-[#f8fafc] mb-1">메모</p>
                        <p className="text-[13px] leading-relaxed">{s.memo}</p>
                      </div>
                    )}

                    <div className="mb-3.5 grid grid-cols-2 gap-3">
                      <a
                        href={`https://www.google.com/search?q=날씨+${s.region || '내위치'}`}
                        target="_blank"
                        className="flex items-center justify-center gap-2 py-3.5 bg-[#252833] rounded-2xl border border-[#313545] hover:bg-[#2D3140] transition-colors"
                      >
                        <CloudRain className="w-4 h-4 text-blue-400" />
                        <span className="text-[11px] font-bold text-[#D1D1D6]">오늘 우산 챙겨야할까?</span>
                      </a>
                      <button
                        onClick={() => handleReceiptButtonClick(s)}
                        className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-[#313545] transition-colors bg-[#252833] hover:bg-[#2D3140]`}
                      >
                        {isUploadingThisSchedule ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            <span className="text-[11px] font-bold text-[#D1D1D6]">업로드 중...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-amber-500" />
                            <span className="text-[11px] font-bold text-[#D1D1D6]">영수증 촬영</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 페이백 체크 */}
                    {s.paybackExpected && (
                      <div className="flex items-center justify-between px-4 py-3 bg-[#252833]/50 rounded-2xl border border-[#2D2F39]">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-[#D1D1D6]">광고주에게 돌려받을 환급금이 있어요</span>
                        </div>
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
            <div className="flex justify-between items-center px-2">
              <h2 className="text-lg font-bold">마감 임박 포스팅</h2>
            </div>
            
            {todaysDeadlines.map((s) => {
              const ownerPhoneDigits = s.ownerPhone?.replace(/[^0-9+]/g, "")
              const isDelayButtonDisabled = !ownerPhoneDigits
              const netLoss = (s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)
              const trimmedTitle = truncateTitle(s.title)
              return (
                <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-6 border-l-4 border-l-[#ff4d4d] border border-[#2D2F39] space-y-4">
                  <div className="">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-1">
                        <span className="text-[13px] font-black text-red-500 tracking-tighter">D-DAY</span>
                        <h3 className="text-base font-bold text-white leading-snug max-w-[16rem] truncate" title={s.title}>
                          {trimmedTitle}
                        </h3>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(s.id)}
                          className="flex items-center gap-1.5 rounded-2xl border border-[#3D3F49] bg-[#252833] px-3 py-1 text-[11px] font-semibold text-[#D1D1D6] hover:bg-[#2D3140] transition-colors"
                        >
                          체험단 상세보기
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                    미작성 시 {formatCurrency(netLoss)}원 상당의 혜택을 놓치게 돼요!
                  </div>

                  {s.memo?.trim() && (
                    <div className="bg-[#252833] px-4 py-3 rounded-2xl border border-[#2D2F39]/80 text-sm text-[#D1D1D6]">
                      <p className="text-xs font-semibold text-[#f8fafc] mb-1">메모</p>
                      <p className="text-[13px] leading-relaxed">{s.memo}</p>
                    </div>
                  )}

                  {s.paybackExpected && (
                    <div className="flex items-center justify-between px-4 py-3 bg-[#252833]/50 rounded-2xl border border-[#2D2F39]">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-[#D1D1D6]">광고주에게 돌려받을 환급금이 있어요</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={isDelayButtonDisabled ? undefined : () => sendDelaySms(s)}
                    className={`w-full flex items-center justify-center gap-2 py-1 text-[11px] text-[#A1A1AA] transition-colors ${isDelayButtonDisabled ? '' : 'hover:text-white'}`}
                    tabIndex={isDelayButtonDisabled ? -1 : 0}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {ownerPhoneDigits || s.ownerPhone ? (
                      <>
                        <span className="text-[11px]">일정 연장이 필요한가요? 광고주와 조율하기</span>
                        <p className="flex flex-wrap items-center gap-2 text-sm text-[#D1D1D6]">
                          <a
                            href={`tel:${ownerPhoneDigits || s.ownerPhone}`}
                            className="text-[14px] hover:underline"
                            aria-label="통화하기"
                          >
                            📞
                          </a>
                          <a
                            href={`sms:${ownerPhoneDigits || s.ownerPhone}`}
                            className="text-[14px] hover:underline"
                            aria-label="문자 보내기"
                          >
                            💬
                          </a>
                        </p>
                      </>
                    ) : (
                      <span className="text-[11px]">일정 연장이 필요한가요? 늦지 않게 광고주님과 조율해보세요.</span>
                    )}
                  </button>
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
            await updateSchedule(s.id, s)
            setIsModalVisible(false)
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
