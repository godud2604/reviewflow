import { getKstDayRangeUtc } from '@/lib/kst-day-range';

export type AiQuotaKind = 'guideline' | 'blogDraft';
const GUIDELINE_DAILY_LIMIT = 2;

export interface AiQuotaInfo {
  allowed: boolean;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
  usedToday: number;
  dailyLimit: number;
  remainingToday: number;
}

export interface AiQuotaStatus {
  guideline: AiQuotaInfo;
  blogDraft: AiQuotaInfo;
  timezone: 'Asia/Seoul';
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getKstDateKey(now: Date): string {
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstTime.toISOString().slice(0, 10);
}

function buildSingleUseQuotaInfo(lastUsedAtRaw: unknown, now: Date): AiQuotaInfo {
  const lastUsedAtDate = parseIsoDate(lastUsedAtRaw);
  const lastUsedAt = lastUsedAtDate?.toISOString() ?? null;
  if (!lastUsedAtDate) {
    return {
      allowed: true,
      lastUsedAt,
      nextAvailableAt: null,
      usedToday: 0,
      dailyLimit: 1,
      remainingToday: 1,
    };
  }

  const { startUtc, endUtc } = getKstDayRangeUtc(now);
  const usedToday = lastUsedAtDate >= startUtc && lastUsedAtDate < endUtc;

  if (!usedToday) {
    return {
      allowed: true,
      lastUsedAt,
      nextAvailableAt: null,
      usedToday: 0,
      dailyLimit: 1,
      remainingToday: 1,
    };
  }

  return {
    allowed: false,
    lastUsedAt,
    nextAvailableAt: endUtc.toISOString(),
    usedToday: 1,
    dailyLimit: 1,
    remainingToday: 0,
  };
}

function buildGuidelineQuotaInfo(
  input: { lastGuidelineAnalysisAt?: unknown; guidelineDailyCount?: unknown; guidelineDailyCountDate?: unknown },
  now: Date
): AiQuotaInfo {
  const lastUsedAtDate = parseIsoDate(input.lastGuidelineAnalysisAt);
  const lastUsedAt = lastUsedAtDate?.toISOString() ?? null;
  const { endUtc } = getKstDayRangeUtc(now);
  const todayKey = getKstDateKey(now);
  const countDate = typeof input.guidelineDailyCountDate === 'string'
    ? input.guidelineDailyCountDate.slice(0, 10)
    : null;
  const rawCount = Number(input.guidelineDailyCount);
  const safeCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
  const usedToday = countDate === todayKey ? safeCount : 0;
  const remainingToday = Math.max(0, GUIDELINE_DAILY_LIMIT - usedToday);

  return {
    allowed: usedToday < GUIDELINE_DAILY_LIMIT,
    lastUsedAt,
    nextAvailableAt: usedToday >= GUIDELINE_DAILY_LIMIT ? endUtc.toISOString() : null,
    usedToday,
    dailyLimit: GUIDELINE_DAILY_LIMIT,
    remainingToday,
  };
}

export function getAiQuotaStatus(
  input: {
    lastGuidelineAnalysisAt?: unknown;
    guidelineDailyCount?: unknown;
    guidelineDailyCountDate?: unknown;
    lastBlogDraftGeneratedAt?: unknown;
  },
  now: Date = new Date()
): AiQuotaStatus {
  return {
    guideline: buildGuidelineQuotaInfo(
      {
        lastGuidelineAnalysisAt: input.lastGuidelineAnalysisAt,
        guidelineDailyCount: input.guidelineDailyCount,
        guidelineDailyCountDate: input.guidelineDailyCountDate,
      },
      now
    ),
    blogDraft: buildSingleUseQuotaInfo(input.lastBlogDraftGeneratedAt, now),
    timezone: 'Asia/Seoul',
  };
}

export function getAiQuotaBlockedMessage(kind: AiQuotaKind) {
  return kind === 'guideline'
    ? '가이드라인 분석은 하루 2회까지 가능합니다. 내일 다시 시도해주세요.'
    : '블로그 초안 생성은 하루 1회만 가능합니다. 내일 다시 시도해주세요.';
}
