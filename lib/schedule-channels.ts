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

export function sanitizeChannels(
  channels: Array<string | ScheduleChannel> | undefined | null,
  fallback: ScheduleChannel = DEFAULT_SCHEDULE_CHANNEL,
): ScheduleChannel[] {
  const seen = new Set<ScheduleChannel>()
  const allowed = new Set(SCHEDULE_CHANNEL_OPTIONS)

  for (const raw of channels || []) {
    const trimmed = (raw || "").trim() as ScheduleChannel
    if (allowed.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
    }
  }

  if (seen.size === 0) return [fallback]
  return Array.from(seen)
}

export function parseStoredChannels(value: string | null): ScheduleChannel[] {
  if (!value) return [DEFAULT_SCHEDULE_CHANNEL]

  // 우선 JSON 배열로 저장된 경우 처리
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return sanitizeChannels(parsed)
      }
    } catch {
      // fall through to comma split
    }
  }

  const parts = value.split(",").map((item) => item.trim())
  return sanitizeChannels(parts)
}

export function stringifyChannels(channels: ScheduleChannel[]): string {
  return sanitizeChannels(channels).join(", ")
}
