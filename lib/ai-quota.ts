import { getKstDayRangeUtc } from '@/lib/kst-day-range';

export type AiQuotaKind = 'guideline' | 'blogDraft';

export interface AiQuotaInfo {
  allowed: boolean;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
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

function buildQuotaInfo(lastUsedAtRaw: unknown, now: Date): AiQuotaInfo {
  const lastUsedAtDate = parseIsoDate(lastUsedAtRaw);
  const lastUsedAt = lastUsedAtDate?.toISOString() ?? null;
  if (!lastUsedAtDate) {
    return {
      allowed: true,
      lastUsedAt,
      nextAvailableAt: null,
    };
  }

  const { startUtc, endUtc } = getKstDayRangeUtc(now);
  const usedToday = lastUsedAtDate >= startUtc && lastUsedAtDate < endUtc;

  if (!usedToday) {
    return {
      allowed: true,
      lastUsedAt,
      nextAvailableAt: null,
    };
  }

  return {
    allowed: false,
    lastUsedAt,
    nextAvailableAt: endUtc.toISOString(),
  };
}

export function getAiQuotaStatus(
  input: { lastGuidelineAnalysisAt?: unknown; lastBlogDraftGeneratedAt?: unknown },
  now: Date = new Date()
): AiQuotaStatus {
  return {
    guideline: buildQuotaInfo(input.lastGuidelineAnalysisAt, now),
    blogDraft: buildQuotaInfo(input.lastBlogDraftGeneratedAt, now),
    timezone: 'Asia/Seoul',
  };
}

export function getAiQuotaBlockedMessage(kind: AiQuotaKind) {
  return kind === 'guideline'
    ? '가이드라인 분석은 하루 1회만 가능합니다. 내일 다시 시도해주세요.'
    : '블로그 초안 생성은 하루 1회만 가능합니다. 내일 다시 시도해주세요.';
}
