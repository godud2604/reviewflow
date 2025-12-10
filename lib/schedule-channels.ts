import type { ScheduleChannel } from "@/types"

export const SCHEDULE_CHANNEL_OPTIONS: ScheduleChannel[] = [
  "네이버블로그",
  "인스타그램",
  "인스타그램 reels",
  "네이버클립",
  "유튜브 shorts",
  "틱톡",
  "쓰레드",
  "카페",
  "기타(구매평/인증)",
]

export const DEFAULT_SCHEDULE_CHANNEL: ScheduleChannel = SCHEDULE_CHANNEL_OPTIONS[0]

interface SanitizeChannelOptions {
  fallback?: ScheduleChannel | null
  allowEmpty?: boolean
}

export function sanitizeChannels(
  channels: Array<string | ScheduleChannel> | undefined | null,
  options: SanitizeChannelOptions = {},
): ScheduleChannel[] {
  const { fallback = DEFAULT_SCHEDULE_CHANNEL, allowEmpty = false } = options
  const seen = new Set<ScheduleChannel>()
  const allowed = new Set(SCHEDULE_CHANNEL_OPTIONS)

  for (const raw of channels || []) {
    const trimmed = (raw || "").trim() as ScheduleChannel
    if (allowed.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
    }
  }

  if (seen.size === 0) {
    if (allowEmpty) return []
    return fallback ? [fallback] : []
  }
  return Array.from(seen)
}

export function parseStoredChannels(value: string | null): ScheduleChannel[] {
  if (value === null) return [DEFAULT_SCHEDULE_CHANNEL]

  const trimmed = value.trim()
  if (trimmed === "") return []

  // 우선 JSON 배열로 저장된 경우 처리
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return sanitizeChannels(parsed, { allowEmpty: true })
      }
    } catch {
      // fall through to comma split
    }
  }

  const parts = trimmed.split(",").map((item) => item.trim())
  return sanitizeChannels(parts, { allowEmpty: true })
}

export function stringifyChannels(channels: ScheduleChannel[]): string {
  return sanitizeChannels(channels, { allowEmpty: true }).join(", ")
}
