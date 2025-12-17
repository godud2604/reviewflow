"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { Schedule } from "@/types"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clipboard,
  CloudRain,
  Camera,
  Loader2,
  MessageSquare,
  Phone,
} from "lucide-react"
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
  return checklist.naverReservation || checklist.platformAppReview || checklist.cafeReview || checklist.googleReview || checklist.other || Boolean(checklist.otherText?.trim())
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
const cleanPhoneNumber = (phone?: string) => phone?.replace(/[^0-9]/g, "") || ""
const MEMO_PREVIEW_LIMIT = 160

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
  const [expandedMemoIds, setExpandedMemoIds] = useState<Record<number, boolean>>({})

  // --- 데이터 필터링 ---
  const todaysVisits = useMemo(() => 
    schedules.filter((s) => parseDateValue(s.visit) && diffDaysFrom(parseDateValue(s.visit)!, today) === 0)
  , [schedules, today])

  const todaysDeadlines = useMemo(() => 
    schedules.filter((s) => parseDateValue(s.dead) && diffDaysFrom(parseDateValue(s.dead)!, today) === 0)
  , [schedules, today])

  const totalDeadlineNetImpact = useMemo(
    () => todaysDeadlines.reduce((sum, s) => sum + ((s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0)), 0),
    [todaysDeadlines],
  )

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "체험단러"

  // --- 핸들러 ---
  const handleOpenModal = (id: number) => {
    setEditingScheduleId(id)
    setIsModalVisible(true)
  }

  const sendDelaySms = (schedule: Schedule) => {
    const phoneNumber = cleanPhoneNumber(schedule.ownerPhone)
    if (!phoneNumber) {
      toast({ title: "사장님 연락처가 없습니다.", variant: "destructive" })
      return
    }
    const body = `안녕하세요 광고주님, '${schedule.title}' 진행 중인 ${userName}입니다. 부득이하게 리뷰 마감 기한 연장이 가능할지 여쭤봅니다.`
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.location.href = `sms:${phoneNumber}${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`
  }

  const handleReceiptButtonClick = (schedule: Schedule) => {
    if (uploadingReceiptId !== null || !hasVisitReviewChecklist(schedule)) return
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
      await updateSchedule(scheduleId, { guideFiles: nextFiles })
      toast({ title: "체험단 상세보기 안에 영수증이 저장되었어요." })
    } catch (error) {
      toast({ title: "업로드 실패", variant: "destructive" })
    } finally {
      setUploadingReceiptId(null)
      receiptTargetRef.current = null
      event.target.value = ""
    }
  }

  const editingSchedule = schedules.find(s => s.id === editingScheduleId)
  const handleCopyMemo = async (memo: string) => {
    if (!memo) return
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({ title: "복사 기능을 사용할 수 없습니다.", variant: "destructive" })
      return
    }
    try {
      await navigator.clipboard.writeText(memo)
      toast({ title: "메모가 복사되었습니다." })
    } catch (error) {
      toast({ title: "메모 복사 실패", variant: "destructive" })
    }
  }
  const toggleMemoExpansion = (id: number) => {
    setExpandedMemoIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const renderMemoBlock = (schedule: Schedule) => {
    const memoValue = schedule.memo ?? ""
    const memoContent = memoValue.trim()
    if (!memoContent) return null

    const isExpanded = Boolean(expandedMemoIds[schedule.id])
    const isLongMemo = memoContent.length > MEMO_PREVIEW_LIMIT
    const displayedMemo = isLongMemo && !isExpanded ? `${memoContent.slice(0, MEMO_PREVIEW_LIMIT)}...` : memoContent
    return (
      <div className="bg-[#16181D] px-4 py-3 rounded-2xl border border-[#2D2F39] text-sm text-[#A1A1AA]">
        <p className="whitespace-pre-wrap">{displayedMemo}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyMemo(memoContent)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-2xl border border-[#313545] bg-[#252833] text-[11px] font-bold text-[#D1D1D6]"
          >
            <Clipboard className="w-3 h-3" />
            메모 복사
          </button>
          {isLongMemo && (
            <button
              type="button"
              onClick={() => toggleMemoExpansion(schedule.id)}
              className="px-3 py-1.5 rounded-2xl border border-dashed border-[#313545] bg-transparent text-[11px] font-bold text-[#9fa3d9]"
            >
              {isExpanded ? "접기" : "더보기"}
            </button>
          )}
        </div>
      </div>
    )
  }

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
            {todaysDeadlines.length > 0 && (
              <p className="mt-2 text-[12.5px] font-semibold text-[#cbd0de]">
                오늘 마감을 모두 지키면 총{" "}
                <span className="text-[#5c3dff] font-bold">{formatCurrency(totalDeadlineNetImpact)}원</span>의 수익을 지킬 수 있어요! 💰
              </p>
            )}
          </div>
        </header>

        {/* 2. 오늘 방문 일정 섹션 */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold px-2 flex items-center gap-2 text-white/90">
            📍 오늘 방문 일정 <span className="text-sm font-normal text-[#A1A1AA]">{todaysVisits.length}건</span>
          </h2>

          {todaysVisits.length > 0 ? (
            todaysVisits.map((s) => {
              const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(" · ")
              const mapQuery = encodeURIComponent([s.region, s.regionDetail].filter(Boolean).join(" "))
              const cleanedPhone = cleanPhoneNumber(s.phone)
              const cleanedOwnerPhone = cleanPhoneNumber(s.ownerPhone)

              return (
                <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-5 border border-[#2D2F39] space-y-5 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#252833] flex items-center justify-center border border-[#3D3F49] shrink-0">
                      <span className="text-2xl" aria-hidden="true">✅</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-0.5 font-bold text-white text-lg truncate">{s.title}</h3>
                      <div className="text-sm font-medium text-[#A1A1AA]">🕒 {formatVisitTimeLabel(s.visitTime)}</div>
                    </div>
                    <button onClick={() => handleOpenModal(s.id)} className="shrink-0 rounded-xl border border-[#3D3F49] bg-[#252833] px-3 py-1.5 text-[11px] font-bold text-[#D1D1D6]">체험단 상세보기</button>
                  </div>

                  {/* 연락처 및 위치 정보 */}
                  <div className="px-1">
                    {locationLabel && (
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2 text-[#cbd0de]"><span className="font-bold text-[#f8fafc] w-16">위치</span><span className="truncate max-w-[180px]">{locationLabel}</span></div>
                        <a href={`https://map.naver.com/v5/search/${mapQuery}`} target="_blank" rel="noreferrer" className="bg-[#2D2F39] px-2 py-1 rounded-lg">📍</a>
                      </div>
                    )}
                    {cleanedPhone && (
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2 text-[#cbd0de]"><span className="font-bold text-[#f8fafc] w-16">가게 번호</span><span className="text-[#9fa3d9]">{s.phone}</span></div>
                        <div className="flex items-center gap-2">
                          <a href={`tel:${cleanedPhone}`} className="bg-[#2D2F39] px-2 py-1 rounded-lg">📞</a>
                          <a href={`sms:${cleanedPhone}`} className="bg-[#2D2F39] px-2 py-1 rounded-lg">💬</a>
                        </div>
                      </div>
                    )}
                    {cleanedOwnerPhone && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-[#cbd0de]">
                          <span className="font-bold text-[#f8fafc] w-16">사장님</span>
                          <span className="text-[#9fa3d9]">{s.ownerPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`tel:${cleanedOwnerPhone}`} className="bg-[#2D2F39] px-2 py-1 rounded-lg hover:bg-green-900/30 transition-colors">📞</a>
                          <a href={`sms:${cleanedOwnerPhone}`} className="bg-[#2D2F39] px-2 py-1 rounded-lg hover:bg-blue-900/30 transition-colors">💬</a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 메모 및 상태 */}
                  <div className="space-y-3">
                    {renderMemoBlock(s)}
                    <div className="grid grid-cols-2 gap-3">
                      <a href={`https://www.google.com/search?q=날씨+${s.region || '내위치'}`} target="_blank" className="flex items-center justify-center gap-2 py-3.5 bg-[#252833] rounded-2xl border border-[#313545]"><CloudRain className="w-4 h-4 text-blue-400" /><span className="text-[11px] font-bold text-[#D1D1D6]">오늘의 날씨</span></a>
                      <button onClick={() => handleReceiptButtonClick(s)} className="flex items-center justify-center gap-2 py-3.5 bg-[#252833] rounded-2xl border border-[#313545]">
                        {uploadingReceiptId === s.id ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Camera className="w-4 h-4 text-amber-500" />}
                        <span className="text-[11px] font-bold text-[#D1D1D6]">{uploadingReceiptId === s.id ? "업로드 중..." : "영수증 저장하기"}</span>
                      </button>
                    </div>
                    {s.paybackExpected && (
                      <div className="flex items-center gap-2 px-3 py-3 bg-[#5c3dff]/10 rounded-2xl border border-[#5c3dff]/20">
                        <AlertCircle className="w-4 h-4 text-[#5c3dff]" />
                        <span className="text-[11px] font-bold text-[#cbd0de]">광고주에게 돌려받을 환급금이 있어요</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-[#1E2028]/50 rounded-[32px] p-10 border border-dashed border-[#2D2F39] flex flex-col items-center justify-center text-center space-y-3">
              <CalendarDays className="w-10 h-10 text-[#3D3F49]" />
              <p className="text-[#A1A1AA] text-sm font-medium">오늘은 예정된 방문 일정이 없어요.<br/>여유로운 하루 보내세요! ☕</p>
            </div>
          )}
        </section>

        {/* 3. 마감 임박 섹션 */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold px-2 text-white/90">⏰ 마감 임박 포스팅</h2>
          
          {todaysDeadlines.length > 0 ? (
            todaysDeadlines.map((s) => {
              const cleanedOwnerPhone = cleanPhoneNumber(s.ownerPhone)
              return (
                <div key={s.id} className="bg-[#1E2028] rounded-[32px] p-6 border-l-4 border-l-[#ff4d4d] border border-[#2D2F39] space-y-3 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="text-[14px] font-black text-red-500 tracking-tighter uppercase">D-Day</span>
                      <h3 className="text-lg font-bold text-white truncate">{s.title}</h3>
                    </div>
                    <button onClick={() => handleOpenModal(s.id)} className="mt-1 shrink-0 rounded-xl border border-[#3D3F49] bg-[#252833] px-3 py-1.5 text-[11px] font-bold text-[#D1D1D6]">체험단 상세보기</button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    미작성 시 {formatCurrency((s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0))}원 상당의 혜택을 놓치게 돼요!
                  </div>

                  {/* 마감 임박 - 메모 및 환급금 정보 표시 */}
                  <div className="space-y-3 mb-4">
                    {renderMemoBlock(s)}
                    {s.paybackExpected && (
                      <div className="flex items-center gap-2 px-3 py-3 bg-[#5c3dff]/10 rounded-2xl border border-[#5c3dff]/20">
                        <AlertCircle className="w-4 h-4 text-[#5c3dff]" />
                        <span className="text-[11px] font-bold text-[#cbd0de]">광고주에게 돌려받을 환급금이 있어요</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#2D2F39] space-y-4">
                    <div className="flex flex-col gap-3">
                      <p className="text-[11px] text-[#A1A1AA] text-center font-medium">연장이 필요한가요? 미리 조율해보세요.</p>
                      {cleanedOwnerPhone ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => sendDelaySms(s)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#252833] rounded-2xl font-bold text-sm shadow-lg"><MessageSquare className="w-4 h-4" />연장 요청 문자</button>
                          <a href={`tel:${cleanedOwnerPhone}`} className="p-3 bg-[#2D2F39] rounded-2xl border border-[#3D3F49]"><Phone className="w-4 h-4 text-[#D1D1D6]" /></a>
                        </div>
                      ) : (
                        <div className="p-3 text-center bg-[#252833] rounded-2xl border border-dashed border-[#313545]"><span className="text-[11px] text-[#A1A1AA]">등록된 사장님 연락처가 없습니다.</span></div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-[#1E2028]/50 rounded-[32px] p-10 border border-dashed border-[#2D2F39] flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-green-500/50" />
              <p className="text-[#A1A1AA] text-sm font-medium">오늘 마감인 포스팅이 없습니다.<br/>완벽하게 관리하고 계시네요! ✨</p>
            </div>
          )}
        </section>
      </div>

      {isModalVisible && editingSchedule && (
        <ScheduleModal
          isOpen={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={async (s) => { await updateSchedule(s.id, s); setIsModalVisible(false); return true; }}
          onDelete={async (id) => { await deleteSchedule(id); setIsModalVisible(false); }}
          schedule={editingSchedule}
        />
      )}
      <input ref={receiptFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptFileChange} />
    </div>
  )
}
