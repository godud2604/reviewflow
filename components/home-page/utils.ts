import { CALENDAR_RING_COLORS, PLATFORM_LABEL_MAP } from '@/components/home-page/constants';

export const getNowInKST = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const values = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  const date = `${values.year}-${values.month}-${values.day}`;
  const time = `${values.hour}:${values.minute}`;
  return { date, time };
};

export const toMinutes = (timeStr?: string, fallback = 0) => {
  if (!timeStr) return fallback;
  const [rawHour, rawMinute] = timeStr.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return fallback;
  return hour * 60 + minute;
};

export const getScheduleRingColor = (status: string): string | undefined =>
  CALENDAR_RING_COLORS[status];

export const getPlatformDisplayName = (platform: string) => {
  const normalized = platform.trim().toLowerCase();
  return PLATFORM_LABEL_MAP[normalized] ?? platform;
};

export const normalizeStatus = (status: string) => {
  if (status === '제품 배송 완료' || status === '배송 완료' || status === '배송완료') {
    return '배송완료';
  }
  return status;
};

export const formatKoreanMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
};

export const formatSlashMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
};

export const formatDotMonthDay = (dateStr: string) => {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}.${Number(day)}`;
};
