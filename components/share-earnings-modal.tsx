"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { MonthlyGrowth, Schedule } from "@/types"

type CategoryEntry = [Schedule["category"], number]
type ShareTheme = "hard" | "soft" | "game"

const stickerOptions = [
  "사장님 감사합니다",
  "퇴사 가보자고",
  "금융치료 완료",
  "오늘 저녁은 소고기",
]

const themeMeta: Record<
  ShareTheme,
  { title: string; subtitle: string; accent: string; badge: string }
> = {
  hard: {
    title: "Hard Mode",
    subtitle: "월간 급여 명세서",
    accent: "from-[#ff7c1f] to-[#ff416c]",
    badge: "정산 완료",
  },
  soft: {
    title: "Soft Mode",
    subtitle: "생활비 방어 챌린지",
    accent: "from-[#10b981] to-[#059669]",
    badge: "생활비 방어",
  },
  game: {
    title: "Game Mode",
    subtitle: "체험단 등급 카드",
    accent: "from-[#6366f1] to-[#a855f7]",
    badge: "티어 인증",
  },
}

const tiers = [
  {
    threshold: 0,
    title: "🌱 새싹 리뷰어",
    caption: "초반 기획자, 방어의 씨앗을 뿌리고 있어요",
  },
  {
    threshold: 1000000,
    title: "🥈 프로 살림꾼",
    caption: "침착하게 성장 중인 파워 플레이어",
  },
  {
    threshold: 3000000,
    title: "👑 걸어 다니는 중소기업",
    caption: "상위 1% 리뷰어, 말 그대로 끝판왕",
  },
]

const formatCurrency = (value: number, hide: boolean) => {
  if (hide) return "₩ *,***,***"
  if (!Number.isFinite(value) || value === 0) return "₩ 0원"
  return `₩ ${value.toLocaleString()}`
}

const formatShort = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 100000000) return `${Math.round(abs / 100000000)}억`
  if (abs >= 10000) return `${Math.round(abs / 10000)}만`
  if (abs >= 1000) return `${Math.round(abs / 1000)}천`
  return `${value.toLocaleString()}원`
}

interface ShareEarningsModalProps {
  isOpen: boolean
  onClose: () => void
  currentMonthLabel: string
  currentMonthKey: string
  econValue: number
  scheduleValue: number
  totalBen: number
  totalInc: number
  totalCost: number
  totalExtraIncome: number
  monthlyGrowth: MonthlyGrowth[]
  benefitEntries: CategoryEntry[]
  costEntries: CategoryEntry[]
}

export default function ShareEarningsModal({
  isOpen,
  onClose,
  currentMonthLabel,
  currentMonthKey,
  econValue,
  scheduleValue,
  totalBen,
  totalInc,
  totalCost,
  totalExtraIncome,
  monthlyGrowth,
  benefitEntries,
  costEntries,
}: ShareEarningsModalProps) {
  const [selectedTheme, setSelectedTheme] = useState<ShareTheme>("hard")
  const [hideAmounts, setHideAmounts] = useState(false)
  const [activeSticker, setActiveSticker] = useState(stickerOptions[0])
  const { toast } = useToast()

  const totalRevenue = Math.max(0, totalInc + totalExtraIncome)

  const chosenTier = useMemo(() => {
    const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
    const tier =
      [...sorted]
        .reverse()
        .find((item) => totalRevenue >= item.threshold) ?? sorted[0]
    const nextTier =
      sorted.find((item) => item.threshold > tier.threshold) ?? null
    const progress = nextTier
      ? Math.min(
          100,
          Math.round(
            ((totalRevenue - tier.threshold) /
              (nextTier.threshold - tier.threshold)) *
              100
          )
        )
      : 100

    return { tier, progress }
  }, [totalRevenue])

  const sparkline = useMemo(() => {
    const sorted = [...monthlyGrowth].sort(
      (a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime()
    )
    const existingIndex = sorted.findIndex((item) => item.monthStart === currentMonthKey)
    if (existingIndex >= 0) {
      sorted[existingIndex] = { ...sorted[existingIndex], econValue }
    } else {
      sorted.push({
        monthStart: currentMonthKey,
        benefitTotal: 0,
        incomeTotal: 0,
        costTotal: 0,
        extraIncomeTotal: 0,
        econValue,
      })
    }
    return sorted.slice(-3)
  }, [monthlyGrowth, currentMonthKey, econValue])

  const maxSparklineValue = Math.max(
    1,
    ...sparkline.map((item) => Math.abs(item.econValue))
  )

  const defenseHighlights = useMemo(() => {
    return benefitEntries.slice(0, 3).map(([category, amount]) => ({
      label: `${category} 방어 성공`,
      percent: totalBen ? Math.round((amount / totalBen) * 100) : 0,
    }))
  }, [benefitEntries, totalBen])

  const costHighlights = useMemo(() => {
    return costEntries.slice(0, 2).map(([category, amount]) => ({
      label: `${category} 지출`,
      percent: totalCost ? Math.round((amount / totalCost) * 100) : 0,
    }))
  }, [costEntries, totalCost])

  const shareMessage = useMemo(() => {
    const themeTitle = themeMeta[selectedTheme].subtitle
    const amountLine =
      selectedTheme === "game"
        ? `${chosenTier.tier.title} • 총 수입 ${formatShort(totalRevenue)}`
        : `${themeTitle} · ${formatCurrency(econValue, hideAmounts)}`
    const staple = [
      `${currentMonthLabel} · ${themeMeta[selectedTheme].title}`,
      amountLine,
      activeSticker ? `스티커: ${activeSticker}` : "",
      hideAmounts ? "금액은 궁금하면 물어보세요!" : "",
    ].filter(Boolean)
    return `${staple.join("\n")}\n\n앱으로 자세한 정산 보기 →`
  }, [activeSticker, chosenTier.tier.title, currentMonthLabel, econValue, hideAmounts, selectedTheme, totalRevenue])

  const handleShare = async () => {
    const shareTarget =
      typeof window !== "undefined" ? window.location.href : undefined

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: "리뷰플로우 수익 인증",
          text: shareMessage,
          url: shareTarget,
        })
        toast({
          title: "공유창이 열렸어요",
          description: "원하는 SNS에 붙여넣기 하시면 됩니다.",
        })
        return
      }

      await handleCopy()
    } catch (error) {
      toast({
        title: "공유에 실패했습니다",
        description:
          error instanceof Error
            ? error.message
            : "다시 시도해주세요",
        variant: "destructive",
      })
    }
  }

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareMessage)
        toast({
          title: "공유 텍스트가 복사되었어요",
          description: "SNS에 붙여넣기 해보세요",
        })
      } else {
        throw new Error("클립보드를 사용할 수 없습니다")
      }
    } catch (error) {
      toast({
        title: "복사에 실패했습니다",
        description: error instanceof Error ? error.message : "다시 시도해주세요",
        variant: "destructive",
      })
    }
  }

  const handleSaveMock = () => {
    toast({
      title: "이미지 저장 준비",
      description: "인스타그램 스토리 전송은 곧 지원됩니다.",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full">
        <DialogHeader>
          <DialogTitle>수익 인증</DialogTitle>
          <DialogDescription>
            Safe Flexing 모드로 원하는 방식으로 자랑하고, 금액 숨김 옵션으로 부담을 낮추세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(themeMeta) as ShareTheme[]).map((mode) => {
              const meta = themeMeta[mode]
              const isActive = mode === selectedTheme
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectedTheme(mode)}
                  className={`rounded-2xl border transition-colors duration-200
                    ${isActive ? "border-[#111827] bg-[#111827]/5 shadow-sm" : "border-[#e5e7eb] bg-white/70"}
                    p-4 text-left`}
                >
                  <p className="text-xs font-semibold uppercase text-[#6b7280]">{meta.title}</p>
                  <p className="text-sm font-black text-[#0f172a]">{meta.subtitle}</p>
                  <span className="text-[11px] text-[#6b7280] mt-2 inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${meta.accent}`} />
                    {meta.badge}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            <div className="relative rounded-[28px] bg-gradient-to-br from-[#0f172a] to-[#111827] p-6 text-white shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-white/80">
                  {currentMonthLabel}
                </div>
                <span className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
                  {themeMeta[selectedTheme].subtitle}
                </span>
              </div>

              <div className="mt-5">
                <div className="text-[10px] text-white/60">총 경제적 가치</div>
                <div className="text-[32px] font-black tracking-tight">
                  {formatCurrency(econValue, hideAmounts)}
                </div>
                <p className="mt-2 text-xs text-white/70">{themeMeta[selectedTheme].title}</p>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                {selectedTheme === "hard" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-[12px]">현금 수입</span>
                      <span className="font-bold">{formatCurrency(totalInc, hideAmounts)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-[12px]">물품 협찬</span>
                      <span className="font-bold">{formatCurrency(totalBen, hideAmounts)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-[12px]">부수입</span>
                      <span className="font-bold">{formatCurrency(totalExtraIncome, hideAmounts)}</span>
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      {sparkline.map((point) => {
                        const height = Math.max(12, Math.round((Math.abs(point.econValue) / maxSparklineValue) * 90))
                        return (
                          <span
                            key={point.monthStart}
                            className="flex-1 rounded-full bg-white/60 transition-all"
                            style={{ height: `${height}%` }}
                          />
                        )
                      })}
                    </div>
                    <div className="mt-3 text-[11px] text-white/70">
                      스케줄 경제 효과 {formatCurrency(scheduleValue, hideAmounts)}
                    </div>
                  </>
                )}

                {selectedTheme === "soft" && (
                  <>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">방어한 생활비</p>
                    <div className="text-2xl font-black">{formatCurrency(totalBen, hideAmounts)}</div>
                    <div className="space-y-1">
                      {defenseHighlights.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs text-white/80">
                          <span>{item.label}</span>
                          <span className="font-bold">{item.percent}%</span>
                        </div>
                      ))}
                      {!defenseHighlights.length && (
                        <div className="text-[11px] uppercase text-white/60">
                          방어 기록이 없습니다.
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
                      지출 카테고리
                    </div>
                    <div className="space-y-1">
                      {costHighlights.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-[11px] text-white/70">
                          <span>{item.label}</span>
                          <span className="font-semibold">{item.percent}%</span>
                        </div>
                      ))}
                      {!costHighlights.length && (
                        <div className="text-[11px] uppercase text-white/50">
                          지출 내역이 없습니다.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedTheme === "game" && (
                  <>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">{chosenTier.tier.caption}</p>
                    <div className="text-3xl font-black leading-tight">{chosenTier.tier.title}</div>
                    <div className="mt-3 rounded-2xl bg-white/10 p-3 text-[11px] text-white/80">
                      총 수입 {formatShort(totalRevenue)} 기준
                      <div className="mt-2 h-1 rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#fde047] to-[#f97316]"
                          style={{ width: `${chosenTier.progress}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">스티커</span>
                <span className="text-xs font-black text-white/90">{activeSticker}</span>
              </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-[#e7eaf3] bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0f172a]">금액 숨기기</p>
                <Switch checked={hideAmounts} onCheckedChange={() => setHideAmounts((prev) => !prev)} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0f172a]">스티커/멘트</p>
                <div className="flex flex-wrap gap-2">
                  {stickerOptions.map((sticker) => {
                    const isActive = sticker === activeSticker
                    return (
                      <button
                        key={sticker}
                        type="button"
                        onClick={() => setActiveSticker(sticker)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all
                          ${isActive ? "border-[#0f172a] bg-[#0f172a] text-white" : "border-[#d1d5db] bg-white text-[#4b5563]"}`}
                      >
                        {sticker}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-[#bfc8d7] bg-[#f8fafc] px-4 py-3 text-xs text-[#475467]">
                금액 숨김 옵션은 "궁금하면 물어보세요!" 카피로 대체됩니다.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-3 pt-4">
          <Button onClick={handleShare} className="flex-1 min-w-[160px]">
            SNS 공유하기
          </Button>
          <Button variant="outline" onClick={handleCopy} className="min-w-[160px]">
            공유 텍스트 복사
          </Button>
          <Button variant="ghost" onClick={handleSaveMock} className="min-w-[160px]">
            이미지 저장 (준비중)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
