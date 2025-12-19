"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"

import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import type { UserProfile } from "@/hooks/use-user-profile"
import { getProfileImageUrl } from "@/lib/storage"
import { getSupabaseClient } from "@/lib/supabase"
import { resolveTier } from "@/lib/tier"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-")
  return `${year}년 ${month}월`
}

const getMonthKeyFromDate = (raw?: string) => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hyphenMatch = trimmed.match(/^(\d{4})-(\d{1,2})/)
  if (hyphenMatch) {
    return `${hyphenMatch[1]}-${hyphenMatch[2].padStart(2, "0")}`
  }

  const dotMatch = trimmed.match(/^(\d{4})\.(\d{1,2})/)
  if (dotMatch) {
    return `${dotMatch[1]}-${dotMatch[2].padStart(2, "0")}`
  }

  const parts = trimmed.split(/[^\d]/).filter(Boolean)
  if (parts.length >= 2 && parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear().toString()
    const month = (parsed.getMonth() + 1).toString().padStart(2, "0")
    return `${year}-${month}`
  }

  return null
}

const PRO_TIER_DURATION_MONTHS = 3

const formatExpiryLabel = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`
}

const getDeadlineTimestamp = (schedule: { dead?: string; visit?: string }) => {
  const target = schedule.dead || schedule.visit
  if (!target) return Number.POSITIVE_INFINITY
  const parsed = new Date(target)
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime()
}

type ProfilePageProps = {
  profile: UserProfile | null
  refetchUserProfile: () => Promise<void>
}

export default function ProfilePage({ profile, refetchUserProfile }: ProfilePageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user: authUser, signOut } = useAuth()
  const { schedules } = useSchedules()

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [downloadScope, setDownloadScope] = useState("all")
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false)

  useEffect(() => {
    if (!profile?.profileImagePath) {
      setProfileImageUrl(null)
      return
    }

    let isCurrent = true

    getProfileImageUrl(profile.profileImagePath)
      .then((url) => {
        if (isCurrent) {
          setProfileImageUrl(url)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setProfileImageUrl(null)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [profile?.profileImagePath])

  const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>
  const { tier, isPro } = resolveTier({
    profileTier: profile?.tier ?? undefined,
    metadata,
  })
  const tierDurationMonths = profile?.tierDurationMonths ?? 0
  const displayTierDuration = tierDurationMonths > 0 ? tierDurationMonths : PRO_TIER_DURATION_MONTHS
  const tierExpiryLabel = formatExpiryLabel(profile?.tierExpiresAt)

  const displayName = profile?.nickname ?? ""
  const emailLabel = authUser?.email ?? "등록된 이메일이 없습니다"
  const displayedImage = profileImageUrl

  const scheduleMonthOptions = useMemo(() => {
    const monthMap = new Map<string, string>()
    schedules.forEach((schedule) => {
      const monthKey = getMonthKeyFromDate(schedule.visit) ?? getMonthKeyFromDate(schedule.dead)
      if (monthKey) {
        monthMap.set(monthKey, formatMonthLabel(monthKey))
      }
    })

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([value, label]) => ({ value, label }))
  }, [schedules])

  useEffect(() => {
    if (downloadScope !== "all" && !scheduleMonthOptions.some((option) => option.value === downloadScope)) {
      setDownloadScope("all")
    }
  }, [downloadScope, scheduleMonthOptions])

  const filteredSchedules = useMemo(() => {
    if (downloadScope === "all") {
      return schedules
    }

    return schedules.filter((schedule) => {
      const visitKey = getMonthKeyFromDate(schedule.visit)
      const deadKey = getMonthKeyFromDate(schedule.dead)
      return visitKey === downloadScope || deadKey === downloadScope
    })
  }, [schedules, downloadScope])

  const schedulesSortedByDeadline = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => getDeadlineTimestamp(a) - getDeadlineTimestamp(b))
  }, [filteredSchedules])

  const downloadScopeLabel = downloadScope === "all" ? "전체 활동" : formatMonthLabel(downloadScope)
  const downloadSummaryMessage = filteredSchedules.length
    ? `${downloadScopeLabel} 기준 ${filteredSchedules.length}건을 준비합니다.`
    : "활동 기록을 추가하면 다운로드를 사용할 수 있습니다."

  const handleDownloadActivity = () => {
    if (!filteredSchedules.length) {
      toast({ title: "선택한 기간의 활동 내역이 없습니다.", variant: "destructive" })
      return
    }

    const scopeLabel = downloadScope === "all" ? "전체" : formatMonthLabel(downloadScope)
    const rows = schedulesSortedByDeadline.map((schedule, index) => ({
      번호: index + 1,
      플랫폼: schedule.platform || "-",
      제목: schedule.title,
      상태: schedule.status,
      방문일: schedule.visit || "-",
      마감일: schedule.dead || "-",
      채널: schedule.channel.join(", "),
      혜택: schedule.benefit,
      수익: schedule.income,
      비용: schedule.cost,
      "순수익": schedule.benefit + schedule.income - schedule.cost,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "활동 내역")
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const fileSuffix = scopeLabel.replace(/\s+/g, "_")
    link.download = `활동내역_${fileSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    toast({ title: "엑셀 다운로드가 준비되었습니다." })
  }

  const handleApplyCoupon = async () => {
    const code = couponCode.trim()

    if (!code) {
      toast({ title: "쿠폰 코드를 입력해 주세요.", variant: "destructive" })
      return
    }

    if (isPro) {
      toast({
        title: "이미 PRO 등급입니다.",
        description: "현재 프로 등급이기 때문에 쿠폰이 필요 없습니다.",
      })
      return
    }

    if (code.toUpperCase() !== "HELLO_EARLY") {
      toast({ title: "유효하지 않은 쿠폰입니다.", variant: "destructive" })
      return
    }

    if (!authUser?.id) {
      toast({ title: "로그인이 필요합니다.", variant: "destructive" })
      return
    }

    setIsRedeemingCoupon(true)

    try {
      const supabase = getSupabaseClient()
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + PRO_TIER_DURATION_MONTHS)
      const expiresAtIso = expiresAt.toISOString()

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          tier: "pro",
          tier_duration_months: PRO_TIER_DURATION_MONTHS,
          tier_expires_at: expiresAtIso,
        })
        .eq("id", authUser.id)

      if (profileError) {
        throw profileError
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          tier: "pro",
        },
      })

      if (metadataError) {
        throw metadataError
      }

      await refetchUserProfile()
      toast({
        title: "쿠폰이 적용되었습니다.",
        description: `${PRO_TIER_DURATION_MONTHS}개월 동안 PRO 기능을 이용할 수 있습니다.`,
      })
      setCouponCode("")
    } catch (err) {
      toast({
        title: "쿠폰 적용에 실패했습니다.",
        description: err instanceof Error ? err.message : "다시 시도해 주세요.",
        variant: "destructive",
      })
    } finally {
      setIsRedeemingCoupon(false)
    }
  }

  const handleGotoNotifications = () => router.push("/notifications")
  const handleGotoMonthlyReport = () => router.push("/monthlyReport")
  const handleGotoPortfolio = () => router.push("/portfolio-management")
  const handleGotoPortfolioPreview = () => router.push("/portfolio")

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      router.push("/")
    } catch {
      toast({ title: "로그아웃에 실패했습니다.", variant: "destructive" })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const openDownloadDialog = () => {
    if (!filteredSchedules.length) return
    setIsDownloadDialogOpen(true)
  }

  const handleFeatureClick = (feature: { onClick: () => void; isPro?: boolean }) => {
    if (feature.isPro && !isPro) {
      toast({
        title: "PRO 전용 기능입니다.",
        variant: "destructive",
      })
      return
    }

    feature.onClick()
  }

  const proFeatures = [
    {
      label: "활동 내역 다운로드",
      description: "캠페인 기록을 엑셀로 추출합니다",
      icon: "📂",
      isPro: true,
      onClick: openDownloadDialog,
    },
    {
      label: "알림 설정",
      description: "선정 소식을 놓치지 않도록 관리",
      icon: "🔔",
      isPro: true,
      onClick: handleGotoNotifications,
    },
    {
      label: "실시간 랭킹 리포트",
      description: "오늘의 실시간 성장 지표",
      icon: "📊",
      isPro: true,
      onClick: handleGotoMonthlyReport,
    },
    // {
    //   label: "포트폴리오 보기",
    //   description: "외부에 공개된 영향력 페이지를 미리 확인해 보세요",
    //   icon: "🧾",
    //   onClick: handleGotoPortfolioPreview,
    // },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F0] via-[#FBFBFD] to-[#F7F7F8] pb-20 font-sans tracking-tight">
      <div className="mx-auto px-6 pt-6">
        <section className="relative mb-6 rounded-[44px] bg-white px-8 py-6 text-center shadow-[0_40px_80px_-20px_rgba(255,92,39,0.05)] border border-white">
          {/* <div className="relative mx-auto mb-6 h-28 w-28">
            <div className={`h-full w-full rounded-full p-1 ${profileImageUrl ? "bg-white shadow-inner" : "bg-gradient-to-tr from-orange-100 to-orange-50"}`}>
              {profileImageUrl ? (
                <img
                  src={displayedImage}
                  alt="Profile"
                  className="h-full w-full rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full text-[13px] font-semibold text-neutral-400">
                  <span className="text-[11px] uppercase tracking-[0.25em] text-[11px]">Profile</span>
                </div>
              )}
            </div>
          </div> */}
          {/* <button
            type="button"
            onClick={handleGotoPortfolio}
            className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-sm transition hover:-translate-y-0.5"
            aria-label="포트폴리오 정보 수정"
          >
            <span className="text-[12px]">✏️</span>
          </button> */}

          <div className="space-y-1">
            {/* <h2 className="text-[14px] font-black text-neutral-900 tracking-tighter">{displayName}</h2> */}
            <p className="text-[13px] font-medium text-neutral-400">{emailLabel}</p>
          </div>


          <div className="mt-4 flex justify-center">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-tight ${
                isPro
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-neutral-200 bg-neutral-100 text-neutral-600"
              }`}
            >
              {isPro ? "PRO MEMBER" : "FREE MEMBER"}
            </span>
          </div>
          {isPro && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px] text-neutral-500">
              <span className="text-neutral-900 font-semibold">PRO</span>
              <span className="text-neutral-400">·</span>
              <span>{`${displayTierDuration}개월`}</span>
              <span className="text-neutral-400">·</span>
              <span>{tierExpiryLabel ? `만료 ${tierExpiryLabel}` : "만료 정보 없음"}</span>
            </div>
          )}
        </section>

        {!isPro && (
          <section className="relative mb-6 rounded-[30px] border border-amber-100/80 bg-gradient-to-br from-white to-[#fff4ed] p-6 shadow-sm text-left">
            <p className="text-xs font-semibold text-neutral-500">쿠폰 등록</p>
            <p className="text-[12px] font-semibold text-neutral-900 mt-1">
              사전신청 시 입력된 이메일로 발송된 쿠폰을 입력하면 등급이 PRO로 전환됩니다.
            </p>
            <div className="mt-3 flex gap-3">
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="쿠폰 코드를 입력하세요"
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[16px] text-neutral-900 shadow-sm transition focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={isRedeemingCoupon}
              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRedeemingCoupon ? "적용 중..." : "적용"}
            </button>
          </div>
          </section>
        )}

        <div className="space-y-2">
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            {proFeatures.map((feature, idx) => {
              const isFeatureLocked = feature.isPro && !isPro
              return (
                <div
                  key={feature.label}
                  role="button"
                  aria-disabled={isFeatureLocked}
                  onClick={() => handleFeatureClick(feature)}
                  className={`
                    py-3.5 px-3 font-semibold rounded-xl
                    flex items-center gap-3
                    transition-all duration-200
                    ${idx !== proFeatures.length - 1 ? "border-b border-neutral-100" : ""}
                    ${isFeatureLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-neutral-50"}
                  `}
                >
                <div className="flex-1 flex items-center justify-between gap-4">
                  <div className="flex">
                    <div className="text-xl mr-3">
                      {feature.icon}
                    </div>
                    <span className="flex-1 text-[15px] flex items-center gap-2">
                      {feature.label}
                      {feature.isPro && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded">
                          PRO
                        </span>
                      )}
                    </span>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-neutral-400"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            )
          })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-12 w-full py-4 text-sm font-bold text-neutral-300 transition-colors hover:text-neutral-500 active:scale-95"
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
        <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>활동 내역 다운로드</DialogTitle>
              <DialogDescription>월별 또는 전체 활동을 엑셀로 저장합니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-600">조회할 활동 기간</p>
                <Select value={downloadScope} onValueChange={setDownloadScope}>
                  <SelectTrigger
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm"
                    aria-label="조회할 활동 기간"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border border-neutral-200 bg-white shadow-lg">
                    <SelectItem value="all" className="text-sm text-neutral-900">
                      전체 활동 내역
                    </SelectItem>
                    {scheduleMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-sm text-neutral-900">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-neutral-500">{downloadSummaryMessage}</p>
            </div>
            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={handleDownloadActivity}
                disabled={!filteredSchedules.length}
                className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-900"
              >
                엑셀 다운로드
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
