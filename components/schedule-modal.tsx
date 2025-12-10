"use client"

import React, { useState, useEffect } from "react"
import type { Schedule, GuideFile } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useUserProfile } from "@/hooks/use-user-profile"
import { uploadGuideFiles, downloadGuideFile, deleteGuideFile } from "@/lib/storage"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { X, Copy, Trash2, Download, Loader2 } from "lucide-react"

export default function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onUpdateFiles,
  schedule,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (schedule: Schedule) => void
  onDelete: (id: number) => void
  onUpdateFiles?: (id: number, files: GuideFile[]) => Promise<void>
  schedule?: Schedule
}) {
  const [formData, setFormData] = useState<Partial<Schedule>>({
    title: "",
    status: "선정됨",
    platform: "",
    reviewType: "제공형",
    channel: "네이버블로그",
    category: "맛집",
    region: "",
    visit: "",
    visitTime: "",
    dead: "",
    benefit: 0,
    income: 0,
    cost: 0,
    postingLink: "",
    purchaseLink: "",
    guideFiles: [],
    memo: "",
    reconfirmReason: "",
    visitReviewChecklist: {
      naverReservation: false,
      platformAppReview: false,
      cafeReview: false,
      googleReview: false,
    },
  })

  const [customPlatforms, setCustomPlatforms] = useState<string[]>([])
  const [newPlatform, setNewPlatform] = useState("")
  const [platformToDelete, setPlatformToDelete] = useState<string | null>(null)
  const [duplicatePlatformAlert, setDuplicatePlatformAlert] = useState(false)
  const [emptyPlatformAlert, setEmptyPlatformAlert] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPlatformManagement, setShowPlatformManagement] = useState(false)
  const [reconfirmReason, setReconfirmReason] = useState("")
  const [customReconfirmReason, setCustomReconfirmReason] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileToDelete, setFileToDelete] = useState<{ file: GuideFile; index: number } | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const { platforms: userPlatforms, addPlatform, removePlatform, loading: platformsLoading } = useUserProfile()

  // 사용 가능한 플랫폼 목록 (DB에서 가져온 유저 플랫폼)
  const allPlatforms = React.useMemo(() => {
    return [...userPlatforms].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [userPlatforms])

  useEffect(() => {
    if (schedule) {
      setFormData(schedule)
      // 재확인 사유 로드
      if (schedule.status === "재확인" && schedule.reconfirmReason) {
        const reason = schedule.reconfirmReason
        if (["입금 확인 필요", "리워드 미지급", "가이드 내용 불분명", "플랫폼 답변 대기중"].includes(reason)) {
          setReconfirmReason(reason)
        } else {
          setReconfirmReason("기타")
          setCustomReconfirmReason(reason)
        }
      }
    } else {
      setFormData({
        title: "",
        status: "선정됨",
        platform: "",
        reviewType: "제공형",
        channel: "네이버블로그",
        category: "맛집",
        region: "",
        visit: "",
        visitTime: "",
        dead: "",
        benefit: 0,
        income: 0,
        cost: 0,
        postingLink: "",
        purchaseLink: "",
        guideFiles: [],
        memo: "",
        reconfirmReason: "",
        visitReviewChecklist: {
          naverReservation: false,
          platformAppReview: false,
          cafeReview: false,
          googleReview: false,
        },
      })
      setReconfirmReason("")
      setCustomReconfirmReason("")
      setPendingFiles([])
    }
  }, [schedule, isOpen])

  const handleSave = async () => {
    if (!formData.title) {
      toast({
        title: "제목을 입력해주세요.",
        variant: "destructive",
        duration: 2000,
      })
      return
    }
    
    // 재확인 상태일 때 사유를 별도 필드에 저장
    if (formData.status === "재확인" && reconfirmReason) {
      const reason = reconfirmReason === "기타" ? customReconfirmReason : reconfirmReason
      formData.reconfirmReason = reason
    } else {
      formData.reconfirmReason = ""
    }

    if (formData.reviewType === "방문형") {
      if (!formData.visit) {
        toast({
          title: "방문일을 선택해주세요.",
          variant: "destructive",
          duration: 2000,
        })
        return
      }
      if (!formData.visitTime) {
        toast({
          title: "방문시간을 입력해주세요.",
          variant: "destructive",
          duration: 2000,
        })
        return
      }
    }

    // 대기 중인 파일이 있으면 업로드
    let finalGuideFiles = formData.guideFiles || []
    if (pendingFiles.length > 0 && user) {
      setIsUploading(true)
      try {
        const scheduleId = schedule?.id || `new_${Date.now()}`
        const uploadedFiles = await uploadGuideFiles(user.id, scheduleId, pendingFiles)
        finalGuideFiles = [...finalGuideFiles, ...uploadedFiles]
        setPendingFiles([])
      } catch (error) {
        console.error('파일 업로드 실패:', error)
        toast({
          title: "파일 업로드에 실패했습니다.",
          variant: "destructive",
          duration: 2000,
        })
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }
    
    onSave({ ...formData, guideFiles: finalGuideFiles } as Schedule)
    toast({
      title: schedule ? "체험단 정보가 수정되었습니다." : "체험단이 등록되었습니다.",
      duration: 2000,
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files])
      toast({
        title: `${files.length}개의 파일이 선택되었습니다.`,
        duration: 2000,
      })
    }
    // input 초기화 (같은 파일 다시 선택 가능하게)
    e.target.value = ''
  }

  const handleDownloadFile = async (file: GuideFile) => {
    toast({
      title: "다운로드 준비 중...",
      duration: 1000,
    })
    await downloadGuideFile(file.path, file.name)
  }

  const handleDeleteUploadedFile = async (file: GuideFile, index: number) => {
    // 기존 스케줄이 있을 때만 Storage에서 삭제
    if (schedule) {
      const success = await deleteGuideFile(file.path)
      if (!success) {
        toast({
          title: "파일 삭제에 실패했습니다.",
          variant: "destructive",
          duration: 2000,
        })
        return
      }
    }
    
    const newFiles = formData.guideFiles?.filter((_, i) => i !== index) || []
    setFormData({ ...formData, guideFiles: newFiles })
    
    // 기존 스케줄이면 DB도 즉시 업데이트 (모달 닫지 않음)
    if (schedule && onUpdateFiles) {
      await onUpdateFiles(schedule.id, newFiles)
    }
    
    toast({
      title: "파일이 삭제되었습니다.",
      duration: 2000,
    })
    
    setFileToDelete(null)
  }

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatNumber = (value: number) => {
    return value.toLocaleString()
  }

  const parseNumber = (value: string) => {
    return Number(value.replace(/,/g, ""))
  }

  const handleNumberChange = (field: "benefit" | "income" | "cost", value: string) => {
    const numValue = parseNumber(value)
    setFormData({ ...formData, [field]: numValue })
  }

  const addCustomPlatform = async () => {
    const trimmedPlatform = newPlatform.trim()

    if (!trimmedPlatform) {
      setEmptyPlatformAlert(true)
      return
    }
    
    // Check if platform already exists (case-insensitive)
    const platformExists = allPlatforms.some(
      (platform) => platform.toLowerCase() === trimmedPlatform.toLowerCase()
    )
    
    if (platformExists) {
      setDuplicatePlatformAlert(true)
      return
    }
    
    const success = await addPlatform(trimmedPlatform)
    if (success) {
      setFormData({ ...formData, platform: trimmedPlatform })
      setNewPlatform("")
      toast({
        title: "플랫폼이 추가되었습니다.",
        duration: 2000,
      })
    }
  }

  const deletePlatform = async (platformName: string) => {
    const success = await removePlatform(platformName)
    if (success) {
      if (formData.platform === platformName) {
        setFormData({ ...formData, platform: "" })
      }
      toast({
        title: "플랫폼이 삭제되었습니다.",
        duration: 2000,
      })
    }
    setPlatformToDelete(null)
  }

  if (!isOpen) return null

  const parseVisitTime = (value: string) => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return { period: "오전", hour: "09", minute: "00" }
    const [rawHour, minute] = value.split(":")
    const hourNum = Number(rawHour)
    const period = hourNum >= 12 ? "오후" : "오전"
    const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12
    const hour = hour12.toString().padStart(2, "0")
    return { period, hour, minute }
  }

  const timeOptions = {
    periods: ["오전", "오후"],
    hours: Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")),
    minutes: Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")),
  }

  const { period, hour, minute } = parseVisitTime(formData.visitTime || "")
  const displayVisitTime = formData.visitTime ? `${period} ${hour}:${minute}` : "시간 선택"

  const updateVisitTime = (next: { period?: string; hour?: string; minute?: string }) => {
    const finalPeriod = next.period || period
    const finalHour = next.hour || hour
    const finalMinute = next.minute || minute
    const hourNum = Number(finalHour)
    const hour24 =
      finalPeriod === "오전"
        ? hourNum % 12
        : hourNum === 12
          ? 12
          : hourNum + 12
    const paddedHour = hour24.toString().padStart(2, "0")
    setFormData({ ...formData, visitTime: `${paddedHour}:${finalMinute}` })
  }

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30" onClick={onClose} style={{ touchAction: 'none' }} />
      <div className="absolute bottom-0 left-0 w-full h-[80%] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up">
        <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
          <span className="font-bold text-base">{schedule ? "체험단 수정" : "체험단 등록"}</span>
          <button
            onClick={onClose}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 scrollbar-hide touch-pan-y min-h-0">
          {/* 재확인 경고 */}
          {formData.status === "재확인" && (
            <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl gap-2">
              <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-sm font-bold text-yellow-700">재확인이 필요한 체험단입니다</span>
              </div>
              {/* 재확인 사유 */}
              {reconfirmReason && (
                <span className="text-sm text-yellow-700">
                  사유: {reconfirmReason === "기타" ? customReconfirmReason : reconfirmReason}
                </span>
              )}
            </div>
          )}
          
          {/* 마감 초과 경고 */}
          {formData.dead && formData.dead < new Date().toISOString().split("T")[0] && formData.status !== "완료" && formData.status !== "취소" && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-sm font-bold text-red-700">마감 기한 초과된 체험단입니다</span>
            </div>
          )}
          
          {/* 체험단명 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2">체험단명 (필수)</label>
          <div className="relative">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full h-11 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[15px]"
              placeholder="예: 강남역 파스타"
            />
            {formData.title && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formData.title || "")
                  toast({
                    title: "체험단명이 복사되었습니다.",
                    duration: 2000,
                  })
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
              >
                <Copy className="w-4 h-4 cursor-pointer" />
              </button>
            )}
          </div>

          {/* 플랫폼 */}
          <div className="mt-6">
            <label className="block text-sm font-bold text-neutral-500 mb-2">플랫폼</label>
            <Select
              value={formData.platform}
              onValueChange={(value) => setFormData({ ...formData, platform: value })}
            >
              <SelectTrigger className="w-full h-11 bg-[#F7F7F8] border-none rounded-xl text-[15px]">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {allPlatforms.map((platform) => (
                  <SelectItem 
                    key={platform} 
                    value={platform}
                    className={"text-[15px]"}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="flex-1">{platform}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowPlatformManagement(true)}
              className="mt-2 text-sm text-[#FF5722] font-semibold cursor-pointer"
            >
              + 플랫폼 관리
            </button>
          </div>

          {/* 체험단 유형 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">체험단 유형</label>
          <div className="flex gap-2 flex-wrap">
            {["제공형", "페이백형", "페이백+구매평", "구매평", "기자단", "미션/인증", "방문형"].map(
              (type) => (
                <div
                  key={type}
                  onClick={() => {
                    const newFormData: Partial<Schedule> = {
                      ...formData,
                      reviewType: type as Schedule["reviewType"],
                    }
                    // 방문형으로 변경 시 체크리스트 초기화
                    if (type === "방문형" && !formData.visitReviewChecklist) {
                      newFormData.visitReviewChecklist = {
                        naverReservation: false,
                        platformAppReview: false,
                        cafeReview: false,
                        googleReview: false,
                      }
                    }
                    setFormData(newFormData)
                  }}
                  className={`h-11 px-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center ${
                    formData.reviewType === type
                      ? "bg-orange-50 text-[#FF5722] border border-[#FF5722]"
                      : "bg-[#F7F7F8] text-neutral-500"
                  }`}
                >
                  {type}
                </div>
              ),
            )}
          </div>

          {/* 방문형 리뷰 체크리스트 */}
          {formData.reviewType === "방문형" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <label className="block text-sm font-bold text-blue-900 mb-3">작성해야 할 리뷰</label>
              <div className="space-y-2.5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.visitReviewChecklist?.naverReservation || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitReviewChecklist: {
                          ...formData.visitReviewChecklist!,
                          naverReservation: checked as boolean,
                        },
                      })
                    }
                  />
                  <span className="text-sm font-semibold text-blue-900">네이버 예약 리뷰</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.visitReviewChecklist?.platformAppReview || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitReviewChecklist: {
                          ...formData.visitReviewChecklist!,
                          platformAppReview: checked as boolean,
                        },
                      })
                    }
                  />
                  <span className="text-sm font-semibold text-blue-900">타플랫폼 어플 리뷰</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.visitReviewChecklist?.cafeReview || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitReviewChecklist: {
                          ...formData.visitReviewChecklist!,
                          cafeReview: checked as boolean,
                        },
                      })
                    }
                  />
                  <span className="text-sm font-semibold text-blue-900">카페 리뷰</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.visitReviewChecklist?.googleReview || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        visitReviewChecklist: {
                          ...formData.visitReviewChecklist!,
                          googleReview: checked as boolean,
                        },
                      })
                    }
                  />
                  <span className="text-sm font-semibold text-blue-900">구글 리뷰</span>
                </label>
              </div>
            </div>
          )}

          {/* 진행 상태 */}
          <div className="mt-6">
            <label className="block text-sm font-bold text-neutral-500 mb-2">진행 상태</label>
            <Select
              value={formData.status}
              onValueChange={(value) => {
                setFormData({ ...formData, status: value as Schedule["status"] })
                // 재확인이 아닌 상태로 변경하면 재확인 사유 초기화
                if (value !== "재확인") {
                  setReconfirmReason("")
                  setCustomReconfirmReason("")
                }
              }}
            >
              <SelectTrigger className="w-full h-11 bg-[#F7F7F8] border-none rounded-xl text-[15px]">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="선정됨" className="text-[15px]">선정됨</SelectItem>
                {formData.reviewType === "방문형" && (
                  <>
                    <SelectItem value="방문일 예약 완료" className="text-[15px]">방문일 예약 완료</SelectItem>
                    <SelectItem value="방문" className="text-[15px]">방문</SelectItem>
                  </>
                )}
                {["페이백형", "페이백+구매평", "구매평"].includes(formData.reviewType || "") && (
                  <SelectItem value="구매 완료" className="text-[15px]">구매 완료</SelectItem>
                )}
                {formData.reviewType === "제공형" && (
                  <SelectItem value="제품 배송 완료" className="text-[15px]">제품 배송 완료</SelectItem>
                )}
                <SelectItem value="완료" className="text-[15px]">완료</SelectItem>
                <SelectItem value="취소" className="text-[15px]">취소</SelectItem>
                <SelectItem value="재확인" className="text-[15px]">재확인</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 재확인 사유 */}
          {formData.status === "재확인" && (
            <div className="mt-4">
              <label className="block text-sm font-bold text-neutral-500 mb-2">재확인 사유</label>
              <Select
                value={reconfirmReason}
                onValueChange={(value) => {
                  setReconfirmReason(value)
                  if (value !== "기타") {
                    setCustomReconfirmReason("")
                  }
                }}
              >
                <SelectTrigger className="w-full h-11 bg-[#F7F7F8] border-none rounded-xl text-[15px]">
                  <SelectValue placeholder="사유를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="입금 확인 필요" className="text-[15px]">입금 확인 필요</SelectItem>
                  <SelectItem value="리워드 미지급" className="text-[15px]">리워드 미지급</SelectItem>
                  <SelectItem value="가이드 내용 불분명" className="text-[15px]">가이드 내용 불분명</SelectItem>
                  <SelectItem value="플랫폼 답변 대기중" className="text-[15px]">플랫폼 답변 대기중</SelectItem>
                  <SelectItem value="기타" className="text-[15px]">기타</SelectItem>
                </SelectContent>
              </Select>
              
              {reconfirmReason === "기타" && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customReconfirmReason}
                    onChange={(e) => setCustomReconfirmReason(e.target.value)}
                    className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px]"
                    placeholder="기타 사유를 입력하세요"
                  />
                </div>
              )}
            </div>
          )}

          {/* 작성 채널 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">작성 채널</label>
          <div className="flex gap-2 flex-wrap">
            {[
              "네이버블로그",
              "인스타그램",
              "인스타그램 reels",
              "네이버클립",
              "유튜브 shorts",
              "틱톡",
              "쓰레드",
              "기타(구매평/인증)",
            ].map((channel) => (
              <div
                key={channel}
                onClick={() =>
                  setFormData({
                    ...formData,
                    channel: channel as Schedule["channel"],
                  })
                }
                className={`h-11 px-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center ${
                  formData.channel === channel
                    ? "bg-blue-50 text-blue-600 border border-blue-600"
                    : "bg-[#F7F7F8] text-neutral-500"
                }`}
              >
                {channel}
              </div>
            ))}
          </div>

          {/* 카테고리 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">카테고리</label>
          <div className="flex gap-2 flex-wrap">
            {["맛집", "식품", "뷰티", "여행", "디지털", "반려동물", "기타"].map((category) => (
              <div
                key={category}
                onClick={() =>
                  setFormData({
                    ...formData,
                    category: category as Schedule["category"],
                  })
                }
                className={`h-11 px-4 rounded-2xl text-sm font-semibold cursor-pointer flex items-center justify-center ${
                  formData.category === category
                    ? "bg-purple-50 text-purple-600 border border-purple-600"
                    : "bg-[#F7F7F8] text-neutral-500"
                }`}
              >
                {category}
              </div>
            ))}
          </div>

          {/* 지역 - only show when reviewType is 방문형 */}
          {formData.reviewType === "방문형" && (
            <div className="mt-6">
              <label className="block text-sm font-bold text-neutral-500 mb-2">지역</label>
              <Select
                value={formData.region}
                onValueChange={(value) => setFormData({ ...formData, region: value })}
              >
                <SelectTrigger className="w-full h-11 bg-[#F7F7F8] border-none rounded-xl text-[15px]">
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "서울",
                    "경기",
                    "인천",
                    "강원",
                    "대전",
                    "세종",
                    "충남",
                    "충북",
                    "부산",
                    "울산",
                    "경남",
                    "경북",
                    "대구",
                    "광주",
                    "전남",
                    "전북",
                    "제주",
                  ].map((region) => (
                    <SelectItem key={region} value={region} className="text-[15px]">
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 날짜 */}
          <div className="flex gap-2.5 mt-6 flex-wrap">
            {formData.reviewType === "방문형" && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-bold text-neutral-500 mb-2">방문일</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] text-left cursor-pointer">
                        {formData.visit ? format(new Date(formData.visit), "PPP", { locale: ko }) : "날짜 선택"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.visit ? new Date(formData.visit) : undefined}
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            visit: date ? format(date, "yyyy-MM-dd") : "",
                          })
                        }
                        locale={ko}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-sm font-bold text-neutral-500 mb-2">방문시간</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] text-left cursor-pointer">
                        {displayVisitTime}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-3" align="start">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-neutral-500">오전/오후</span>
                          <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                            <div className="p-1 space-y-1">
                              {timeOptions.periods.map((p) => (
                                <button
                                  key={p}
                                  className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-left cursor-pointer transition-colors ${
                                    p === period ? "bg-blue-500 text-white" : "hover:bg-neutral-100 text-neutral-800"
                                  }`}
                                  onClick={() => updateVisitTime({ period: p })}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-neutral-500">시</span>
                          <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                            <div className="p-1 grid grid-cols-2 gap-1">
                              {timeOptions.hours.map((h) => (
                                <button
                                  key={h}
                                  className={`rounded-md px-2 py-2 text-sm font-semibold text-center cursor-pointer transition-colors ${
                                    h === hour ? "bg-blue-500 text-white" : "hover:bg-neutral-100 text-neutral-800"
                                  }`}
                                  onClick={() => updateVisitTime({ hour: h })}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-neutral-500">분</span>
                          <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                            <div className="p-1 grid grid-cols-2 gap-1">
                              {timeOptions.minutes.map((m) => (
                                <button
                                  key={m}
                                  className={`rounded-md px-2 py-2 text-sm font-semibold text-center cursor-pointer transition-colors ${
                                    m === minute ? "bg-blue-500 text-white" : "hover:bg-neutral-100 text-neutral-800"
                                  }`}
                                  onClick={() => updateVisitTime({ minute: m })}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
            <div className={formData.reviewType === "방문형" ? "flex-1 min-w-[180px]" : "w-full"}>
              <label className="block text-sm font-bold text-[#FF5722] mb-2">마감일</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] text-left cursor-pointer">
                    {formData.dead ? format(new Date(formData.dead), "PPP", { locale: ko }) : "날짜 선택"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dead ? new Date(formData.dead) : undefined}
                    onSelect={(date) =>
                      setFormData({
                        ...formData,
                        dead: date ? format(date, "yyyy-MM-dd") : "",
                      })
                    }
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 자산 관리 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">자산 관리</label>
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-2 py-3 flex gap-2.5">
            <div className="flex-1 text-center">
              <span className="block text-xs text-neutral-400 font-semibold mb-2">제공(물품)</span>
              <input
                type="text"
                value={formatNumber(formData.benefit || 0)}
                onChange={(e) => handleNumberChange("benefit", e.target.value)}
                className="w-full h-11 px-3 py-2 bg-white border-none rounded-xl text-center font-bold text-[15px]"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-xs text-neutral-400 font-semibold mb-2">수익(현금)</span>
              <input
                type="text"
                value={formatNumber(formData.income || 0)}
                onChange={(e) => handleNumberChange("income", e.target.value)}
                className="w-full h-11 px-3 py-2 bg-white border-none rounded-xl text-center font-bold text-[15px]"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-xs text-red-600 font-semibold mb-2">내 지출</span>
              <input
                type="text"
                value={formatNumber(formData.cost || 0)}
                onChange={(e) => handleNumberChange("cost", e.target.value)}
                className="w-full h-11 px-3 py-2 bg-white border-none rounded-xl text-center font-bold text-red-600 text-[15px]"
                placeholder="0"
              />
            </div>
          </div>

          {/* 링크 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">포스팅 링크</label>
          <div className="relative">
            <input
              type="url"
              value={formData.postingLink || ""}
              onChange={(e) => setFormData({ ...formData, postingLink: e.target.value })}
              className="w-full h-11 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[15px]"
              placeholder="https://..."
            />
            {formData.postingLink && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formData.postingLink || "")
                  toast({
                    title: "포스팅 링크가 복사되었습니다.",
                    duration: 2000,
                  })
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
              >
                <Copy className="w-4 h-4 cursor-pointer" />
              </button>
            )}
          </div>

          {["페이백형", "페이백+구매평", "구매평", "미션/인증"].includes(formData.reviewType || "") && (
            <>
              <label className="block text-sm font-bold text-neutral-500 mb-2 mt-4">구매할 링크</label>
              <div className="relative">
                <input
                  type="url"
                  value={formData.purchaseLink || ""}
                  onChange={(e) => setFormData({ ...formData, purchaseLink: e.target.value })}
                  className="w-full h-11 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[15px]"
                  placeholder="https://..."
                />
                {formData.purchaseLink && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(formData.purchaseLink || "")
                      toast({
                        title: "구매 링크가 복사되었습니다.",
                        duration: 2000,
                      })
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                  >
                    <Copy className="w-4 h-4 cursor-pointer" />
                  </button>
                )}
              </div>
            </>
          )}

          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-4">가이드 첨부파일</label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="w-full h-13 px-2 py-2 bg-[#F7F7F8] border-none rounded-xl text-[15px] cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#FF5722] file:text-white hover:file:bg-[#FF5722]/90 file:cursor-pointer "
          />
          
          {/* 업로드 대기 중인 파일 (저장 시 업로드됨) */}
          {pendingFiles.length > 0 && (
            <div className="mt-2 space-y-2">
              <span className="text-xs text-neutral-400">저장 시 업로드될 파일:</span>
              {pendingFiles.map((file, index) => (
                <div
                  key={`pending-${index}`}
                  className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-neutral-700 truncate block">{file.name}</span>
                    <span className="text-xs text-neutral-400">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePendingFile(index)}
                    className="ml-2 text-neutral-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 이미 업로드된 파일 */}
          {formData.guideFiles && formData.guideFiles.length > 0 && (
            <div className="mt-2 space-y-2">
              <span className="text-xs text-neutral-400">업로드된 파일:</span>
              {formData.guideFiles.map((file, index) => (
                <div
                  key={`uploaded-${index}`}
                  className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-neutral-700 truncate block">{file.name}</span>
                    <span className="text-xs text-neutral-400">{formatFileSize(file.size)}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleDownloadFile(file)}
                      className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="다운로드"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFileToDelete({ file, index })}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 메모장 */}
          <label className="block text-sm font-bold text-neutral-500 mb-2 mt-6">메모장</label>
          <div className="relative">
            <textarea
              value={formData.memo || ""}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              className="w-full px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[15px] resize-none"
              rows={3}
              placeholder="가이드라인 복사 붙여넣기..."
            />
            {formData.memo && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formData.memo || "")
                  toast({
                    title: "메모 내용이 복사되었습니다.",
                    duration: 2000,
                  })
                }}
                className="absolute right-2 top-2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
              >
                <Copy className="w-4 h-4 cursor-pointer" />
              </button>
            )}
          </div>

          <div className="h-20"></div>
        </div>

        {/* 플로팅 저장 버튼 */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-neutral-100">
          {schedule ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isUploading}
                className="flex-2 h-14 px-6 bg-red-50 text-red-600 border border-red-200 font-bold text-base rounded-2xl hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
              <button
                onClick={handleSave}
                disabled={isUploading}
                className="flex-8 h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl hover:bg-[#FF5722]/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={isUploading}
              className="w-full h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl hover:bg-[#FF5722]/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  업로드 중...
                </>
              ) : (
                '저장'
              )}
            </button>
          )}
        </div>
      </div>

      {/* 플랫폼 관리 모달 */}
      {showPlatformManagement && (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowPlatformManagement(false)} style={{ touchAction: 'none' }} />
          <div className="absolute bottom-0 left-0 w-full h-[70%] bg-white rounded-t-[30px] z-50 flex flex-col animate-slide-up">
            <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-base">플랫폼 관리</span>
              <button
                onClick={() => setShowPlatformManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* 플랫폼 추가 영역 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-neutral-500 mb-2">새 플랫폼 추가</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 py-2 bg-[#F7F7F8] border-none rounded-lg text-[15px]"
                    placeholder="새 플랫폼 이름"
                    onKeyPress={(e) => e.key === "Enter" && addCustomPlatform()}
                  />
                  <button
                    onClick={addCustomPlatform}
                    disabled={platformsLoading}
                    className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 플랫폼 목록 */}
              <div>
                <label className="block text-sm font-bold text-neutral-500 mb-2">등록된 플랫폼</label>
                {platformsLoading ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    불러오는 중...
                  </div>
                ) : allPlatforms.length === 0 ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    등록된 플랫폼이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPlatforms.map((platform) => (
                      <div
                        key={platform}
                        className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl"
                      >
                        <span className="text-[15px] font-medium">{platform}</span>
                        <button
                          onClick={() => {
                            setPlatformToDelete(platform)
                            setShowPlatformManagement(false)
                          }}
                          className="text-red-600 hover:text-red-700 font-semibold text-sm cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={platformToDelete !== null} onOpenChange={(open) => {
        if (!open) {
          setPlatformToDelete(null)
          setShowPlatformManagement(true)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>플랫폼 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              '{platformToDelete}' 플랫폼을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => platformToDelete && deletePlatform(platformToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicatePlatformAlert} onOpenChange={setDuplicatePlatformAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">중복된 플랫폼</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이미 존재하는 플랫폼입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction 
              onClick={() => setDuplicatePlatformAlert(false)} 
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyPlatformAlert} onOpenChange={setEmptyPlatformAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">플랫폼 이름 입력</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              플랫폼 이름을 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction 
              onClick={() => setEmptyPlatformAlert(false)} 
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">체험단 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이 체험단을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (schedule) {
                  onDelete(schedule.id)
                  setShowDeleteConfirm(false)
                  toast({
                    title: "체험단이 삭제되었습니다.",
                    duration: 2000,
                  })
                }
              }}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={fileToDelete !== null} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">파일 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              '{fileToDelete?.file.name}' 파일을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteUploadedFile(fileToDelete.file, fileToDelete.index)
                }
              }}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
