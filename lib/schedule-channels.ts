import type { ScheduleChannel } from '@/types';

export const DEFAULT_SCHEDULE_CHANNEL_OPTIONS: ScheduleChannel[] = [
  '네이버블로그',
  '인스타그램',
  '인스타그램 reels',
  '네이버클립',
  '유튜브 shorts',
  '구매평',
];

export const DEFAULT_SCHEDULE_CHANNEL: ScheduleChannel = DEFAULT_SCHEDULE_CHANNEL_OPTIONS[0];

interface SanitizeChannelOptions {
  fallback?: ScheduleChannel | null;
  allowEmpty?: boolean;
  allowed?: ScheduleChannel[];
}

export function sanitizeChannels(
  channels: Array<string | ScheduleChannel> | undefined | null,
  options: SanitizeChannelOptions = {}
): ScheduleChannel[] {
  const {
    fallback = DEFAULT_SCHEDULE_CHANNEL,
    allowEmpty = false,
    allowed = DEFAULT_SCHEDULE_CHANNEL_OPTIONS,
  } = options;
  const seen = new Set<ScheduleChannel>();
  const allowedSet = new Set(allowed);

  for (const raw of channels || []) {
    const trimmed = (raw || '').trim() as ScheduleChannel;
    if (allowedSet.has(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
    }
  }

  if (seen.size === 0) {
    if (allowEmpty) return [];
    return fallback ? [fallback] : [];
  }
  return Array.from(seen);
}

export function parseStoredChannels(value: string | null): ScheduleChannel[] {
  if (value === null) return [DEFAULT_SCHEDULE_CHANNEL];

  const trimmed = value.trim();
  if (trimmed === '') return [];

  const parsedFromJson = tryParseChannelArray(trimmed);
  if (parsedFromJson !== null) {
    return parsedFromJson;
  }

  const parts = trimmed.split(',');
  return normalizeChannelInputs(parts);
}

function tryParseChannelArray(value: string): ScheduleChannel[] | null {
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeChannelInputs(parsed);
    }
  } catch {
    // fall through to comma split
  }

  return null;
}

function normalizeChannelInputs(
  inputs: Array<string | ScheduleChannel | unknown>
): ScheduleChannel[] {
  const cleaned = inputs
    .map((item) => {
      if (item === null || item === undefined) return '';
      return String(item).trim();
    })
    .filter((chunk): chunk is ScheduleChannel => chunk !== '');

  const unique: ScheduleChannel[] = [];
  const seen = new Set<ScheduleChannel>();
  for (const channel of cleaned) {
    if (!seen.has(channel)) {
      seen.add(channel);
      unique.push(channel);
    }
  }

  return unique;
}

export function stringifyChannels(channels: ScheduleChannel[]): string {
  return sanitizeChannels(channels, { allowEmpty: true }).join(', ');
}
