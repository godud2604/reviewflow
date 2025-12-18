"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import type { Schedule, GuideFile, ScheduleChannel } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useUserProfile } from "@/hooks/use-user-profile"
import { uploadGuideFiles, downloadGuideFile, deleteGuideFile, getGuideFileUrl } from "@/lib/storage"
import { DEFAULT_SCHEDULE_CHANNEL_OPTIONS, sanitizeChannels } from "@/lib/schedule-channels"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { X, Copy, Loader2 } from "lucide-react"
import NaverMapSearchModal, { MapPlaceSelection } from "@/components/naver-map-search-modal"

const getTodayInKST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())

const CATEGORY_OPTIONS: Array<{ value: Schedule["category"]; label: string; description: string; icon: string }> = [
  { value: "맛집/식품", label: "맛집/식품", description: "맛집, 식품, 음료", icon: "🍽️" },
  { value: "뷰티", label: "뷰티", description: "화장품, 스킨/바디, 향수", icon: "💄" },
  { value: "생활/리빙", label: "생활/리빙", description: "생활용품, 홈데코/인테리어", icon: "🏡" },
  { value: "출산/육아", label: "출산/육아", description: "유아동, 출산 용품", icon: "🤱" },
  { value: "주방/가전", label: "주방/가전", description: "주방용품, 가전디지털", icon: "🧺" },
  { value: "반려동물", label: "반려동물", description: "반려동물 용품/서비스", icon: "🐶" },
  { value: "여행/레저", label: "여행/레저", description: "여행, 숙박, 체험/레저", icon: "✈️" },
  { value: "티켓/문화생활", label: "티켓/문화생활", description: "공연, 전시, 영화, 티켓", icon: "🎫" },
  { value: "디지털/전자기기", label: "디지털/전자기기", description: "IT주변기기, 모바일, 카메라", icon: "🎧" },
  { value: "건강/헬스", label: "건강/헬스", description: "건강식품, 영양제, 운동용품", icon: "💪" },
  { value: "자동차/모빌리티", label: "자동차/모빌리티", description: "자동차, 모빌리티 용품", icon: "🚗" },
  { value: "문구/오피스", label: "문구/오피스", description: "문구류, 오피스 용품", icon: "✏️" },
  { value: "기타", label: "기타", description: "그 외 모든 카테고리", icon: "📦" },
]

const DEFAULT_VISIT_REVIEW_CHECKLIST: NonNullable<Schedule["visitReviewChecklist"]> = {
  naverReservation: false,
  platformAppReview: false,
  cafeReview: false,
  googleReview: false,
  other: false,
  otherText: "",
}

const STATUS_ORDER: Schedule["status"][] = [
  "선정됨",
  "방문일 예약 완료",
  "방문",
  "구매 완료",
  "제품 배송 완료",
  "완료",
  "재확인",
]

const COMMON_STATUSES: Schedule["status"][] = ["선정됨", "완료"]

const STATUS_BY_REVIEW_TYPE: Record<Schedule["reviewType"], Schedule["status"][]> = {
  방문형: ["방문일 예약 완료", "방문"],
  구매형: ["구매 완료"],
  제공형: ["제품 배송 완료"],
  기자단: [],
  "미션/인증": [],
}

const getStatusOptions = (reviewType: Schedule["reviewType"] | undefined): Schedule["status"][] => {
  const extras = reviewType ? STATUS_BY_REVIEW_TYPE[reviewType] || [] : []
  const allowed = new Set<Schedule["status"]>([...COMMON_STATUSES, ...extras])
  return STATUS_ORDER.filter((status) => allowed.has(status))
}

const sanitizeStatusForReviewType = (
  status: Schedule["status"] | undefined,
  reviewType: Schedule["reviewType"] | undefined,
): Schedule["status"] => {
  if (!reviewType) return status || "선정됨"
  const options = getStatusOptions(reviewType)
  if (status && options.includes(status)) return status
  return options[0] || "선정됨"
}

const createEmptyFormData = (): Partial<Schedule> => ({
  title: "",
  status: "선정됨",
  platform: "",
  reviewType: "제공형",
  channel: [],
  category: "맛집/식품",
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
  visitReviewChecklist: { ...DEFAULT_VISIT_REVIEW_CHECKLIST },
  paybackExpected: false,
  paybackConfirmed: false,
  region: "",
  regionDetail: "",
  phone: "",
  ownerPhone: "",
  lat: undefined,
  lng: undefined,
})

export default function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onUpdateFiles,
  schedule,
  focusGuideFiles,
  onGuideFilesFocusDone,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (schedule: Schedule) => Promise<boolean>
  onDelete: (id: number) => void
  onUpdateFiles?: (id: number, files: GuideFile[]) => Promise<void>
  schedule?: Schedule
  focusGuideFiles?: boolean
  onGuideFilesFocusDone?: () => void
}) {
  const [formData, setFormData] = useState<Partial<Schedule>>(() => createEmptyFormData())

  const [viewportStyle, setViewportStyle] = useState<{ height: string; top: string }>({
    height: "100%",
    top: "0px"
  })

  const [newPlatform, setNewPlatform] = useState("")
  const [platformToDelete, setPlatformToDelete] = useState<string | null>(null)
  const [duplicatePlatformAlert, setDuplicatePlatformAlert] = useState(false)
  const [emptyPlatformAlert, setEmptyPlatformAlert] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPlatformManagement, setShowPlatformManagement] = useState(false)
  const [showChannelManagement, setShowChannelManagement] = useState(false)
  const [newChannel, setNewChannel] = useState("")
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null)
  const [duplicateChannelAlert, setDuplicateChannelAlert] = useState(false)
  const [emptyChannelAlert, setEmptyChannelAlert] = useState(false)
  const [reconfirmReason, setReconfirmReason] = useState("")
  const [customReconfirmReason, setCustomReconfirmReason] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileToDelete, setFileToDelete] = useState<{ file: GuideFile; index: number } | null>(null)
  const [guideFilePreviews, setGuideFilePreviews] = useState<Record<string, string>>({})
  const [showCategoryManagement, setShowCategoryManagement] = useState(false)
  const [showMapSearchModal, setShowMapSearchModal] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Schedule["category"][]>([])
  const [visitMode, setVisitMode] = useState(false)
  const [nonVisitReviewType, setNonVisitReviewType] = useState<Schedule["reviewType"]>("제공형")
  const [pendingStatus, setPendingStatus] = useState<Schedule["status"] | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    platforms: userPlatforms,
    categories: userCategories,
    scheduleChannels: userChannels,
    addPlatform,
    removePlatform,
    addScheduleChannel,
    removeScheduleChannel,
    updateCategories,
    loading: profileLoading,
  } = useUserProfile()
  const isSubmittingRef = useRef(false)
  const isMountedRef = useRef(false)
  const guideFilesSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportStyle({
          height: `${window.visualViewport.height}px`,
          top: `${window.visualViewport.offsetTop}px`
        });
      }
    };

    handleResize();
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, [isOpen]);

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const allPlatforms = React.useMemo(() => {
    return [...userPlatforms].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [userPlatforms])

  const platformOptions = React.useMemo(() => {
    if (formData.platform && !allPlatforms.includes(formData.platform)) {
      return [...allPlatforms, formData.platform]
    }
    return allPlatforms
  }, [allPlatforms, formData.platform])

  const allChannels = React.useMemo(() => {
    const baseChannels =
      userChannels.length > 0 ? userChannels : DEFAULT_SCHEDULE_CHANNEL_OPTIONS
    return [...baseChannels].sort((a, b) => a.localeCompare(b, "ko"))
  }, [userChannels])

  const channelOptions = React.useMemo(() => {
    const existing = new Set(allChannels)
    const extras = Array.from(
      new Set((formData.channel || []).filter((channel) => !existing.has(channel)))
    )
    return [...allChannels, ...extras]
  }, [allChannels, formData.channel])

  const categoryValues = React.useMemo(() => CATEGORY_OPTIONS.map((option) => option.value), [])

  const sanitizeCategories = React.useCallback(
    (list: string[] | undefined | null) => {
      const allowed = new Set(categoryValues)
      return Array.from(
        new Set(
          (list || [])
            .map((c) => c?.trim())
            .filter((c): c is Schedule["category"] => !!c && allowed.has(c as Schedule["category"]))
        )
      )
    },
    [categoryValues],
  )

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    return a.every((item, idx) => item === b[idx])
  }

  const hasVisitData = React.useCallback((data?: Partial<Schedule>) => {
    if (!data) return false
    const checklist = data.visitReviewChecklist
    const hasChecklist =
      !!checklist &&
      (checklist.naverReservation ||
        checklist.platformAppReview ||
        checklist.cafeReview ||
        checklist.googleReview ||
        checklist.other ||
        !!checklist.otherText)
    return data.reviewType === "방문형" || !!data.visit || !!data.visitTime || hasChecklist
  }, [])

  useEffect(() => {
    if (schedule) {
      const initialNonVisit = schedule.reviewType !== "방문형" ? schedule.reviewType : "제공형"
      setNonVisitReviewType(initialNonVisit)
      setFormData({
        ...schedule,
        visitReviewChecklist:
          schedule.reviewType === "방문형"
            ? { ...DEFAULT_VISIT_REVIEW_CHECKLIST, ...schedule.visitReviewChecklist }
            : schedule.visitReviewChecklist,
        paybackExpected: schedule.paybackExpected ?? false,
        paybackConfirmed: schedule.paybackExpected ? !!schedule.paybackConfirmed : false,
      })
      if (schedule.status === "재확인" && schedule.reconfirmReason) {
        const reason = schedule.reconfirmReason
        if (["입금 확인 필요", "리워드 미지급", "가이드 내용 불분명", "플랫폼 답변 대기중"].includes(reason)) {
          setReconfirmReason(reason)
        } else {
          setReconfirmReason("기타")
          setCustomReconfirmReason(reason)
        }
      }
      setVisitMode(hasVisitData(schedule))
    } else {
      setFormData(createEmptyFormData())
      setReconfirmReason("")
      setCustomReconfirmReason("")
      setPendingFiles([])
      setVisitMode(false)
      setNonVisitReviewType("제공형")
    }
  }, [schedule, isOpen, hasVisitData])

  useEffect(() => {
    let isActive = true
    const files = formData.guideFiles || []

    if (files.length === 0) {
      setGuideFilePreviews({})
      return () => {
        isActive = false
      }
    }

    const fetchPreviews = async () => {
      const entries = await Promise.all(
        files.map(async (file) => {
          try {
            const url = await getGuideFileUrl(file.path)
            return url ? { path: file.path, url } : null
          } catch (error) {
            console.error("가이드 파일 미리보기 로드 실패:", error)
            return null
          }
        }),
      )

      if (!isActive) return

      setGuideFilePreviews(
        entries.reduce<Record<string, string>>((acc, entry) => {
          if (entry) {
            acc[entry.path] = entry.url
          }
          return acc
        }, {}),
      )
    }

    fetchPreviews()

    return () => {
      isActive = false
    }
  }, [formData.guideFiles])

  useEffect(() => {
    const sanitized = sanitizeCategories(userCategories)
    if (!arraysEqual(selectedCategories, sanitized)) {
      setSelectedCategories(sanitized)
    }
  }, [userCategories, sanitizeCategories, selectedCategories])

  const guideFilesCount = formData.guideFiles?.length ?? 0

  useEffect(() => {
    if (!focusGuideFiles || !isOpen) return
    const section = guideFilesSectionRef.current
    if (!section) {
      return
    }
    section.scrollIntoView({ behavior: "smooth", block: "start" })
    onGuideFilesFocusDone?.()
  }, [focusGuideFiles, isOpen, guideFilesCount, onGuideFilesFocusDone])

  useEffect(() => {
    const allowed = new Set(categoryValues)
    const hasValidCurrent = formData.category && allowed.has(formData.category)
    const fallback = selectedCategories[0] || CATEGORY_OPTIONS[0]?.value
    const nextCategory = hasValidCurrent ? formData.category : fallback
    if (nextCategory && nextCategory !== formData.category) {
      setFormData((prev) => ({ ...prev, category: nextCategory as Schedule["category"] }))
    }
  }, [selectedCategories, formData.category, categoryValues])

  useEffect(() => {
    if (schedule) return
    const defaultPlatform = allPlatforms[0]
    if (!defaultPlatform) return
    if (formData.platform) return
    setFormData((prev) => ({ ...prev, platform: defaultPlatform }))
  }, [allPlatforms, schedule, formData.platform])

  const handleSave = async () => {
    if (isSubmittingRef.current) return
    if (!formData.title) {
      toast({
        title: "제목을 입력해주세요.",
        variant: "destructive",
        duration: 2000,
      })
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const updatedFormData: Partial<Schedule> = { ...formData }
      const reviewTypeForSave = visitMode ? "방문형" : nonVisitReviewType
      updatedFormData.reviewType = reviewTypeForSave
      if (!visitMode) {
        updatedFormData.visit = ""
        updatedFormData.visitTime = ""
        updatedFormData.visitReviewChecklist = undefined
      } else if (!updatedFormData.visitReviewChecklist) {
        updatedFormData.visitReviewChecklist = { ...DEFAULT_VISIT_REVIEW_CHECKLIST }
      }

      if (updatedFormData.status === "재확인" && reconfirmReason) {
        const reason = reconfirmReason === "기타" ? customReconfirmReason : reconfirmReason
        updatedFormData.reconfirmReason = reason
      } else {
        updatedFormData.reconfirmReason = ""
      }

      const selectedChannels = sanitizeChannels(updatedFormData.channel || [], {
        allowEmpty: true,
        allowed: channelOptions,
      })

      let finalGuideFiles = updatedFormData.guideFiles || []
      if (pendingFiles.length > 0 && user) {
        setIsUploading(true)
        try {
          const scheduleId = schedule?.id || `new_${Date.now()}`
          const uploadedFiles = await uploadGuideFiles(user.id, scheduleId, pendingFiles)
          if (uploadedFiles.length !== pendingFiles.length) {
            const message = "일부 파일이 업로드되지 않았습니다. 다시 시도해주세요."
            toast({
              title: message,
              variant: "destructive",
              duration: 3000,
            })
            if (typeof window !== "undefined") {
              alert(message)
            }
            setIsUploading(false)
            return
          }
          finalGuideFiles = [...finalGuideFiles, ...uploadedFiles]
          setPendingFiles([])
        } catch (error) {
          console.error('파일 업로드 실패:', error)
          const errorMsg = error instanceof Error ? error.message : ""
          const message = errorMsg
            ? `파일 업로드에 실패했습니다: ${errorMsg}`
            : "파일 업로드에 실패했습니다. 다시 시도해주세요."
          toast({
            title: message,
            variant: "destructive",
            duration: 2000,
          })
          if (typeof window !== "undefined") {
            alert(message)
          }
          setIsUploading(false)
          return
        }
        setIsUploading(false)
      }

      const sanitizedStatus = sanitizeStatusForReviewType(
        updatedFormData.status as Schedule["status"],
        (updatedFormData.reviewType as Schedule["reviewType"]) || "제공형",
      )

      const savedSuccessfully = await onSave({
        ...updatedFormData,
        status: sanitizedStatus,
        channel: selectedChannels,
        guideFiles: finalGuideFiles,
      } as Schedule)

      if (savedSuccessfully) {
        toast({
          title: schedule ? "체험단 정보가 수정되었습니다." : "체험단이 등록되었습니다.",
          duration: 2000,
        })
      }
    } finally {
      isSubmittingRef.current = false
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
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
    e.target.value = ''
  }

  const handleDownloadFile = async (file: GuideFile) => {
    toast({
      title: "다운로드 시작",
      description: "파일을 준비하고 있습니다. 잠시만 기다려 주세요.",
      duration: 2000,
    });
    
    try {
      await downloadGuideFile(file.path, file.name);
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "인앱 브라우저라면 '다른 브라우저로 열기'를 시도해 보세요.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUploadedFile = async (file: GuideFile, index: number) => {
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

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  const handleToggleCategory = async (value: Schedule["category"]) => {
    const wasSelected = selectedCategories.includes(value)
    const prev = selectedCategories
    const next = wasSelected ? selectedCategories.filter((c) => c !== value) : [...selectedCategories, value]
    setSelectedCategories(next)

    const success = await updateCategories(next)
    if (!success) {
      setSelectedCategories(prev)
      return
    }
  }

  const handleNumberChange = (field: "benefit" | "income" | "cost", value: string) => {
    const numValue = parseNumber(value)
    setFormData({ ...formData, [field]: numValue })
  }

  const handlePaybackExpectedChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      paybackExpected: checked,
      paybackConfirmed: checked ? Boolean(prev.paybackConfirmed) : false,
    }))
  }

  const handlePaybackConfirmedChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      paybackConfirmed: prev.paybackExpected ? checked : false,
    }))
  }

  const handleToggleChannel = (channel: ScheduleChannel) => {
    setFormData((prev) => {
      const current = prev.channel || []
      const hasChannel = current.includes(channel)
      const nextChannels = hasChannel ? current.filter((c) => c !== channel) : [...current, channel]
      return { ...prev, channel: nextChannels }
    })
  }

  const handleToggleVisitMode = (enabled: boolean) => {
    if (enabled) {
      setNonVisitReviewType((prev) =>
        formData.reviewType && formData.reviewType !== "방문형"
          ? (formData.reviewType as Schedule["reviewType"])
          : prev,
      )
    }
    setVisitMode(enabled)
    setFormData((prev) => {
      const nextReviewType: Schedule["reviewType"] = enabled ? "방문형" : nonVisitReviewType
      const nextStatus = sanitizeStatusForReviewType(
        (prev.status as Schedule["status"]) || "선정됨",
        nextReviewType,
      )
      const nextChecklist =
        enabled ? prev.visitReviewChecklist || { ...DEFAULT_VISIT_REVIEW_CHECKLIST } : undefined
      return {
        ...prev,
        reviewType: nextReviewType,
        status: nextStatus,
      visitReviewChecklist: nextChecklist,
      ...(enabled ? {} : { visit: "", visitTime: "" }),
    }
  })
}

  const handleMapPlaceSelection = (place: MapPlaceSelection) => {
    setFormData((prev) => ({
      ...prev,
      region: place.region,
      regionDetail: place.address,
      phone: place.phone || prev.phone,
      lat: place.latitude,
      lng: place.longitude,
    }))
    setShowMapSearchModal(false)
  }

  const updateVisitChecklist = (partial: Partial<NonNullable<Schedule["visitReviewChecklist"]>>) => {
    setFormData((prev) => {
      const current = prev.visitReviewChecklist || { ...DEFAULT_VISIT_REVIEW_CHECKLIST }
      return {
        ...prev,
        visitReviewChecklist: { ...current, ...partial },
      }
    })
  }

  const addCustomPlatform = async () => {
    const trimmedPlatform = newPlatform.trim()
    if (!trimmedPlatform) {
      setEmptyPlatformAlert(true)
      return
    }
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

  const addCustomChannel = async () => {
    const trimmedChannel = newChannel.trim()
    if (!trimmedChannel) {
      setEmptyChannelAlert(true)
      return
    }
    const channelExists = allChannels.some(
      (channel) => channel.toLowerCase() === trimmedChannel.toLowerCase()
    )
    if (channelExists) {
      setDuplicateChannelAlert(true)
      return
    }
    const success = await addScheduleChannel(trimmedChannel)
    if (success) {
      setNewChannel("")
      toast({
        title: "작성할 채널이 추가되었습니다.",
        duration: 2000,
      })
    }
  }

  const deleteChannel = async (channelName: string) => {
    const success = await removeScheduleChannel(channelName)
    if (success) {
      setFormData((prev) => ({
        ...prev,
        channel: (prev.channel || []).filter((item) => item !== channelName),
      }))
      toast({
        title: "작성할 채널이 삭제되었습니다.",
        duration: 2000,
      })
    }
    setChannelToDelete(null)
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
  const hasLocation = Boolean(formData.region || formData.regionDetail)

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

  const applyStatusChange = (value: Schedule["status"]) => {
    setFormData((prev) => ({ ...prev, status: value }))
    if (value !== "재확인") {
      setReconfirmReason("")
      setCustomReconfirmReason("")
    }
  }

  const handleStatusChange = (value: Schedule["status"]) => {
    const requiresPaybackCheck =
      value === "완료" &&
      formData.paybackExpected &&
      !formData.paybackConfirmed

    if (requiresPaybackCheck) {
      setPendingStatus(value)
      setShowStatusConfirm(true)
      return
    }

    applyStatusChange(value)
  }

  const statusFields = (
    <div className="space-y-6 mb-6">
      <div>
        <label className="block text-[15px] font-bold text-neutral-500 mb-2">진행 상태</label>
        <Select
          value={formData.status}
          onValueChange={(value) => handleStatusChange(value as Schedule["status"])}
        >
          <SelectTrigger size="sm" className="w-full bg-[#F7F7F8] border-none rounded-xl text-[16px]">
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {getStatusOptions(formData.reviewType || "제공형").map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption} className="text-[15px]">
                {statusOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <>
      <div 
        className="fixed left-0 w-full z-40 flex flex-col justify-end text-neutral-900"
        style={{
          height: viewportStyle.height,
          top: viewportStyle.top,
        }}
      >
        <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose} 
            style={{ touchAction: 'none' }} 
        />
        
        <div 
          className="relative w-full bg-white rounded-t-[30px] flex flex-col shadow-2xl overflow-hidden animate-slide-up text-neutral-900"
          style={{ maxHeight: '85%' }}
        >
          <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-none">
            <span className="font-bold text-[16px]">{schedule ? "체험단 수정" : "체험단 등록"}</span>
            <button
              onClick={onClose}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 scrollbar-hide touch-pan-y min-h-0">
            {formData.status === "재확인" && (
              <div className="mb-2.5 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl gap-2">
                <div className="flex items-center gap-2">
                <span className="text-[12px]">⚠️</span>
                <span className="text-[12px] font-bold text-yellow-700">재확인이 필요한 체험단입니다</span>
                </div>
                {reconfirmReason && (
                  <span className="text-[12px] text-yellow-700">
                    사유: {reconfirmReason === "기타" ? customReconfirmReason : reconfirmReason}
                  </span>
                )}
              </div>
            )}
            
            {formData.dead && formData.dead < getTodayInKST() && formData.status !== "완료" && (
              <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                <span className="text-[12px]">⚠️</span>
                <span className="text-[12px] font-bold text-red-700">마감 기한 초과된 체험단입니다</span>
              </div>
            )}
            
            <div className="space-y-8">
              <div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2.5">체험단명 (필수)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
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
                  </div>

                  <div>
                    <label className="block text-[15px] font-bold text-[#FF5722] mb-2">마감일</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full h-8.5 px-3 bg-[#F7F7F8] border-none rounded-xl text-[16px] text-left cursor-pointer">
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

                  {schedule && statusFields}
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2">플랫폼</label>
                    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3.5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {platformOptions.map((platform) => (
                          <div
                            key={platform}
                            onClick={() => setFormData({ ...formData, platform })}
                            className={`text-[14px] px-3 py-1 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center ${
                              formData.platform === platform
                                ? "bg-orange-50 text-[#FF5722] border border-[#FF5722]"
                                : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                            }`}
                          >
                            {platform}
                          </div>
                        ))}
                        {platformOptions.length === 0 && (
                          <span className="text-sm text-neutral-400">플랫폼을 추가해주세요.</span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowPlatformManagement(true)}
                        className="mt-2 text-[13px] text-[#FF5722] font-semibold cursor-pointer"
                      >
                        + 플랫폼 관리
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2">카테고리</label>
                    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3.5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedCategories.length > 0 ? (
                          selectedCategories.map((category) => {
                            const meta = CATEGORY_OPTIONS.find((c) => c.value === category)
                            const isActive = formData.category === category
                            return (
                              <div
                                key={category}
                                onClick={() => setFormData((prev) => ({ ...prev, category }))}
                                className={`px-2.5 py-1 rounded-xl text-[14px] font-semibold transition-all cursor-pointer flex items-center justify-center ${
                                  isActive
                                    ? "bg-orange-100 text-[#D9480F] border border-[#FF5722]/70"
                                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                                }`}
                              >
                                <span className="truncate max-w-[120px]">{meta?.label || category}</span>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-xs text-neutral-400">표시할 카테고리를 선택하세요.</span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowCategoryManagement(true)}
                        className="mt-2 text-[13px] text-[#FF5722] font-semibold cursor-pointer"
                      >
                        + 카테고리 선택
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex">
                      <label className="mr-2 block text-[15px] font-bold text-neutral-500 mb-2">체험 진행 정보</label>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] text-neutral-400"><strong className="text-orange-300">리뷰 채널</strong>과 <strong className="text-orange-300">방문 정보</strong> 설정</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3.5 py-3.5">
                      <div>
                        <div className="flex gap-2 flex-wrap">
                          {channelOptions.map((channel) => {
                            const isSelected = (formData.channel || []).includes(channel)
                            return (
                              <div
                                key={channel}
                                onClick={() => handleToggleChannel(channel)}
                                className={`text-[14px] px-3 py-1 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center ${
                                  isSelected
                                    ? "bg-blue-50 text-blue-600 border border-blue-600"
                                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                                }`}
                              >
                                {channel}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowChannelManagement(true)}
                        className="mt-4 ml-2 text-[13px] text-[#FF5722] font-semibold cursor-pointer translate-y-[-8px]"
                      >
                        + 작성할 채널 관리
                      </button>

                      <div className="pt-2 border-t border-neutral-200/80">
                        <label className="flex items-start gap-3 mb-2 cursor-pointer">
                          <Checkbox
                            checked={visitMode}
                            onCheckedChange={(checked) => handleToggleVisitMode(!!checked)}
                            className="mt-[2px]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-[14px] font-bold text-neutral-500 translate-y-[1.5px]">
                                <span className="text-[#FF8A00]">📍 방문 일정</span>이 있는 체험인가요?
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>
                      {visitMode && (
                        <div className="space-y-4">
                          <div className="pt-2 border-t border-neutral-200/80">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[14px] font-bold text-neutral-500">방문 후 추가 리뷰</span>
                              <span className="text-[13px] text-neutral-400">현장 방문 뒤 남길 추가 리뷰 채널</span>
                            </div>
                            <div className="space-y-2.5">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <Checkbox
                                  checked={formData.visitReviewChecklist?.naverReservation || false}
                                  onCheckedChange={(checked) =>
                                    updateVisitChecklist({ naverReservation: checked as boolean })
                                  }
                                />
                                <span className="text-[14px] font-semibold text-neutral-500">네이버 예약 리뷰</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <Checkbox
                                  checked={formData.visitReviewChecklist?.platformAppReview || false}
                                  onCheckedChange={(checked) =>
                                    updateVisitChecklist({ platformAppReview: checked as boolean })
                                  }
                                />
                                <span className="text-[14px] font-semibold text-neutral-500">타플랫폼 어플 리뷰</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <Checkbox
                                  checked={formData.visitReviewChecklist?.googleReview || false}
                                  onCheckedChange={(checked) =>
                                    updateVisitChecklist({ googleReview: checked as boolean })
                                  }
                                />
                                <span className="text-[14px] font-semibold text-neutral-500">구글 리뷰</span>
                              </label>
                              <div className="space-y-1">
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <Checkbox
                                    checked={formData.visitReviewChecklist?.other || false}
                                    onCheckedChange={(checked) =>
                                      updateVisitChecklist({
                                        other: checked as boolean,
                                        otherText: checked ? formData.visitReviewChecklist?.otherText || "" : "",
                                      })
                                    }
                                  />
                                  <span className="text-[14px] font-semibold text-neutral-500">기타</span>
                                </label>
                                {formData.visitReviewChecklist?.other && (
                                  <input
                                    type="text"
                                    value={formData.visitReviewChecklist?.otherText || ""}
                                    onChange={(e) =>
                                      updateVisitChecklist({
                                        other: true,
                                        otherText: e.target.value,
                                      })
                                    }
                                    className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                                    placeholder="추가 리뷰를 입력하세요"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                         </div>
                      )}

                      {visitMode && (
                        <>
                          <div className="flex gap-2.5 flex-wrap mt-4">
                            <div className="flex-1 min-w-[180px]">
                              <label className="block text-[15px] font-bold text-neutral-500 mb-2">방문일</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full h-8 px-3 bg-[#F7F7F8] border-none rounded-xl text-[16px] text-left cursor-pointer">
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
                              <label className="block text-[15px] font-bold text-neutral-500 mb-2">방문시간</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full h-8 px-3 bg-[#F7F7F8] border-none rounded-xl text-[15px] text-left cursor-pointer">
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
                          </div>
                          <div className="mt-4">
                            {hasLocation ? (
                              <>
                                <div className="space-y-3 mt-2">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[15px] font-bold text-neutral-500 mb-2.5">위치</label>
                                      <button
                                        type="button"
                                        onClick={() => setShowMapSearchModal(true)}
                                        className="text-[12px] font-semibold text-[#FF5722] mb-2.5"
                                        >
                                        지도에서 선택
                                      </button>
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={formData.region || ""}
                                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                        placeholder="지도에서 위치를 찾거나 직접 입력하세요"
                                        className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                                      />
                                      {formData.region && (
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(formData.region || "")
                                            toast({
                                              title: "위치가 복사되었습니다.",
                                              duration: 2000,
                                            })
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                        >
                                          <Copy className="w-4 h-4 cursor-pointer" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[15px] font-bold text-neutral-500 mb-2.5">위치 상세</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={formData.regionDetail || ""}
                                        onChange={(e) => setFormData({ ...formData, regionDetail: e.target.value })}
                                        placeholder="예: 4층 스튜디오 / 사무실 앞 벤치"
                                        className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                                      />
                                      {formData.regionDetail && (
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(formData.regionDetail || "")
                                            toast({
                                              title: "위치 상세가 복사되었습니다.",
                                              duration: 2000,
                                            })
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                        >
                                          <Copy className="w-4 h-4 cursor-pointer" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[15px] font-bold text-neutral-500 mb-2.5">가게 전화번호</label>
                                    <div className="relative">
                                      <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={formData.phone || ""}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="예: 010-1234-5678"
                                        className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                                      />
                                      {formData.phone && (
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(formData.phone || "")
                                            toast({
                                              title: "가게 전화번호가 복사되었습니다.",
                                              duration: 2000,
                                            })
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                        >
                                          <Copy className="w-4 h-4 cursor-pointer" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[15px] font-bold text-neutral-500 mb-2.5">사장님 전화번호</label>
                                    <div className="relative">
                                      <input
                                        type="tel"
                                        inputMode="numeric"
                                pattern="[0-9]*"
                                        value={formData.ownerPhone || ""}
                                        onChange={(e) =>
                                          setFormData({
                                            ...formData,
                                            ownerPhone: formatPhoneInput(e.target.value),
                                          })
                                        }
                                        placeholder="예: 010-9876-5432"
                                        className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                                      />
                                      {formData.ownerPhone && (
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(formData.ownerPhone || "")
                                            toast({
                                              title: "사장님 전화번호가 복사되었습니다.",
                                              duration: 2000,
                                            })
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                        >
                                          <Copy className="w-4 h-4 cursor-pointer" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-2 rounded-2xl border border-dashed border-neutral-200 bg-white/80 p-4 text-center shadow-sm">
                                <p className="text-[13px] font-semibold text-neutral-500">방문 위치를 지정해주세요</p>
                                <button
                                  type="button"
                                  onClick={() => setShowMapSearchModal(true)}
                                  className="w-full rounded-2xl border border-[#FF5722] bg-gradient-to-r from-[#FF9A3C] to-[#FF5722] px-4 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:-translate-y-0.5 active:translate-y-0.5"
                                >
                                  지도에서 방문 위치 선택하기
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!schedule && statusFields}    
              </div>

              <div className="flex items-center">
                  <label className="mt-0.5 mr-2 text-[15px] font-bold text-neutral-500">자산 관리</label>
                  <p className="text-[13px] text-neutral-400">
                    제공(물품) + 수익(현금) - 내가 쓴 돈 = 수익
                  </p>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-2 py-3 flex gap-2.5 mt-1">
                  <div className="flex-1 text-center">
                    <span className="block text-[13px] text-neutral-500 font-semibold mb-1">📦 제공(물품)</span>
                    <span className="block text-[12px] text-neutral-400 mb-2">제품/서비스 가격</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatNumber(formData.benefit || 0)}
                      onChange={(e) => handleNumberChange("benefit", e.target.value)}
                      className="w-full h-9 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-center font-bold text-[16px] text-neutral-700"
                      placeholder="+ 0"
                    />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="block text-[13px] text-neutral-500 font-semibold mb-1">💸 수익(현금)</span>
                    <span className="block text-[12px] text-neutral-400 mb-2">입금된 현금</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatNumber(formData.income || 0)}
                      onChange={(e) => handleNumberChange("income", e.target.value)}
                      className="w-full h-9 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-center font-bold text-[16px] text-neutral-700"
                      placeholder="+ 0"
                    />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="block text-[13px] text-red-600 font-semibold mb-1">⬇️ 내가 쓴 돈</span>
                    <span className="block text-[12px] text-neutral-400 mb-2">내가 결제한 금액</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatNumber(formData.cost || 0)}
                      onChange={(e) => handleNumberChange("cost", e.target.value)}
                      className="w-full h-9 px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl text-center font-bold text-red-600 text-[16px]"
                      placeholder="- 0"
                    />
                  </div>
                </div>

                  <div className="mt-2.5 space-y-1">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={formData.paybackExpected || false}
                      onCheckedChange={(checked) => handlePaybackExpectedChange(Boolean(checked))}
                      className="mt-[5px]"
                    />
                    <div className="min-w-0">
                      <span className="text-[14px] font-semibold text-neutral-900">광고주에게 돌려받아야 할 돈이 있나요?</span>
                      <p className="text-[12px] text-neutral-500">구매비용을 페이백 받기로 한 의뢰가 있는 경우 체크하세요.</p>
                    </div>
                  </label>
                  
                  {formData.paybackExpected && (
                    <label className="flex items-center gap-3 pl-8">
                      <Checkbox
                        checked={formData.paybackConfirmed || false}
                        onCheckedChange={(checked) => handlePaybackConfirmedChange(Boolean(checked))}
                        className="mt-[2px]"
                      />
                      <span className="text-[13px] font-semibold text-neutral-900 translate-y-[1px]">입금 확인 (정산 완료)</span>
                    </label>
                  )}
                </div>

              </div>

              <div >
                <div className="space-y-4">
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2">메모장</label>
                    <div className="relative">
                      <textarea
                        value={formData.memo || ""}
                        onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                        className="w-full px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px] resize-none h-60 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  </div>
                    {!visitMode && (
                      <div className="space-y-2">
                        <label className="block text-[15px] font-semibold text-neutral-500 mb-2">
                          사장님(광고주) 전화번호
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={formData.ownerPhone || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                ownerPhone: formatPhoneInput(e.target.value),
                              })
                            }
                            placeholder="예: 010-9876-5432"
                            className="w-full h-8.5 px-3 py-2 pr-10 bg-[#F7F7F8] border-none rounded-xl text-[16px]"
                          />
                          {formData.ownerPhone && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(formData.ownerPhone || "")
                                toast({
                                  title: "사장님 전화번호가 복사되었습니다.",
                                  duration: 2000,
                                })
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                            >
                              <Copy className="w-4 h-4 cursor-pointer" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
            
            {formData.guideFiles && formData.guideFiles.length > 0 && (
              <div ref={guideFilesSectionRef} className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-neutral-500">영수증</span>
                  <span className="text-xs text-neutral-400">{formData.guideFiles.length}개</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {formData.guideFiles.map((file, index) => {
                    const previewUrl = guideFilePreviews[file.path]
                    const isImage = file.type.startsWith("image/")
                    return (
                      <div key={file.path} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="h-28 w-full overflow-hidden rounded-xl bg-neutral-200">
                          {isImage && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center text-[11px] font-semibold text-neutral-500">
                              <span className="tracking-tight">미리보기 없음</span>
                              <span className="mt-1 text-[10px] uppercase">{file.type.split("/")[1] || "파일"}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-neutral-700 truncate">{file.name}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(file)}
                              className="text-[11px] font-semibold text-[#FF5722] hover:text-[#d14500] shrink-0"
                            >
                              다운로드
                            </button>
                            <button
                              type="button"
                              onClick={() => setFileToDelete({ file, index })}
                              className="text-[11px] font-semibold text-red-600 hover:text-red-800 shrink-0"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="h-10"></div>
          </div>

          <div className="flex-none p-4 bg-white border-t border-neutral-100 z-50 pb-safe">
            {schedule ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isUploading || isSubmitting}
                  className="flex-2 h-14 px-6 bg-red-50 text-red-600 border border-red-200 font-bold text-base rounded-2xl hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  삭제
                </button>
                <button
                  onClick={handleSave}
                  disabled={isUploading || isSubmitting}
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
                disabled={isUploading || isSubmitting}
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

      {showPlatformManagement && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowPlatformManagement(false)} />
          <div className="fixed bottom-0 left-0 w-full h-[70%] bg-white rounded-t-[30px] z-50 flex flex-col animate-slide-up">
             <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-[16px]">플랫폼 관리</span>
              <button
                onClick={() => setShowPlatformManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-6">
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">새 플랫폼 추가</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
                    placeholder="새 플랫폼 이름"
                    onKeyPress={(e) => e.key === "Enter" && addCustomPlatform()}
                  />
                  <button
                    onClick={addCustomPlatform}
                    disabled={profileLoading}
                    className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">등록된 플랫폼</label>
                {profileLoading ? (
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
                        className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
                      >
                        <span className="text-[15px] font-medium">{platform}</span>
                        <button
                          onClick={() => {
                            setPlatformToDelete(platform)
                            setShowPlatformManagement(false)
                          }}
                          className="text-red-600 hover:text-red-700 font-semibold text-[15px] cursor-pointer"
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

      {showChannelManagement && (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowChannelManagement(false)} />
            <div className="fixed bottom-0 left-0 w-full h-[70%] bg-white rounded-t-[30px] z-50 flex flex-col animate-slide-up">
              <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
                <span className="font-bold text-[16px]">작성할 채널 관리</span>
                <button
                  onClick={() => setShowChannelManagement(false)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-6">
                  <label className="block text-[15px] font-bold text-neutral-500 mb-2">작성할 채널 추가</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
                      placeholder="작성할 채널 이름"
                      onKeyPress={(e) => e.key === "Enter" && addCustomChannel()}
                    />
                    <button
                      onClick={addCustomChannel}
                      disabled={profileLoading}
                      className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      추가
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[15px] font-bold text-neutral-500 mb-2">등록된 작성할 채널</label>
                  {profileLoading ? (
                    <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      불러오는 중...
                    </div>
                  ) : allChannels.length === 0 ? (
                    <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                      등록된 작성할 채널이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allChannels.map((channel) => (
                        <div
                          key={channel}
                          className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
                        >
                          <span className="text-[15px] font-medium truncate">{channel}</span>
                          <button
                            onClick={() => {
                              setChannelToDelete(channel)
                              setShowChannelManagement(false)
                            }}
                            className="text-red-600 hover:text-red-700 font-semibold text-[15px] cursor-pointer"
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

      {showCategoryManagement && (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowCategoryManagement(false)} />
            <div className="fixed bottom-0 left-0 w-full h-[70%] bg-white rounded-t-[30px] z-50 flex flex-col animate-slide-up">
              <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
                <span className="font-bold text-base">카테고리 선택</span>
                <button
                  onClick={() => setShowCategoryManagement(false)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const isActive = selectedCategories.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleToggleCategory(option.value)}
                        className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                          isActive
                            ? "bg-orange-50"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <span className="text-xl">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-neutral-900 truncate">{option.label}</div>
                          <div className="text-[11px] text-neutral-500 truncate">{option.description}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                            isActive
                              ? "bg-[#FF5722] text-white"
                              : "border border-neutral-300 text-transparent"
                          }`}
                          aria-hidden
                        >
                          ✓
                        </div>
                      </button>
                    )
                  })}
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

      <AlertDialog open={showStatusConfirm} onOpenChange={(open) => {
        setShowStatusConfirm(open)
        if (!open) {
          setPendingStatus(null)
        }
      }}>
         <AlertDialogContent className="w-[320px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">페이백 입금 확인</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              아직 입금 확인이 되지 않았습니다. 그래도 '완료' 처리하시겠어요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStatus) {
                  applyStatusChange(pendingStatus)
                }
                setShowStatusConfirm(false)
                setPendingStatus(null)
              }}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              완료 처리
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

      <AlertDialog open={channelToDelete !== null} onOpenChange={(open) => {
        if (!open) {
          setChannelToDelete(null)
          setShowChannelManagement(true)
        }
      }}>
         <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성할 채널 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              '{channelToDelete}' 작성할 채널을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => channelToDelete && deleteChannel(channelToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicateChannelAlert} onOpenChange={setDuplicateChannelAlert}>
         <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">중복된 작성할 채널</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이미 존재하는 작성할 채널입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setDuplicateChannelAlert(false)}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyChannelAlert} onOpenChange={setEmptyChannelAlert}>
         <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">작성할 채널 이름 입력</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              작성할 채널 이름을 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setEmptyChannelAlert(false)}
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
        <AlertDialogContent className="w-[340px] max-w-[90vw] rounded-2xl p-6 gap-4">
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
      <NaverMapSearchModal
        isOpen={showMapSearchModal}
        onClose={() => setShowMapSearchModal(false)}
        onSelectPlace={handleMapPlaceSelection}
      />
      </div>
    </>
  )
}
