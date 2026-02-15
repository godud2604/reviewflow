import type { Schedule } from '@/types';
import {
  COMMON_STATUSES,
  DEFAULT_VISIT_REVIEW_CHECKLIST,
  STATUS_BY_REVIEW_TYPE,
  STATUS_ORDER,
} from './constants';

export const getTodayInKST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export const getStatusOptions = (
  reviewType: Schedule['reviewType'] | undefined
): Schedule['status'][] => {
  const extras = reviewType ? STATUS_BY_REVIEW_TYPE[reviewType] || [] : [];
  const allowed = new Set<Schedule['status']>([...COMMON_STATUSES, ...extras]);
  return STATUS_ORDER.filter((status) => allowed.has(status));
};

export const sanitizeStatusForReviewType = (
  status: Schedule['status'] | undefined,
  reviewType: Schedule['reviewType'] | undefined
): Schedule['status'] => {
  if (!reviewType) return status || '선정됨';
  const options = getStatusOptions(reviewType);
  if (status && options.includes(status)) return status;
  return options[0] || '선정됨';
};

export const createEmptyFormData = (): Partial<Schedule> => ({
  title: '',
  status: '선정됨',
  platform: '',
  reviewType: '제공형',
  channel: [],
  category: '맛집/식품',
  visit: '',
  visitTime: '',
  dead: '',
  additionalDeadlines: [],
  benefit: 0,
  income: 0,
  cost: 0,
  postingLink: '',
  purchaseLink: '',
  guideFiles: [],
  memo: '',
  guidelineAnalysis: null,
  originalGuidelineText: '',
  blogDraft: '',
  blogDraftOptions: null,
  blogDraftUpdatedAt: undefined,
  reconfirmReason: '',
  visitReviewChecklist: { ...DEFAULT_VISIT_REVIEW_CHECKLIST },
  paybackExpected: false,
  paybackExpectedDate: '',
  paybackExpectedAmount: 0,
  paybackConfirmed: false,
  region: '',
  regionDetail: '',
  phone: '',
  ownerPhone: '',
  lat: undefined,
  lng: undefined,
});

export const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  return a.every((item, idx) => item === b[idx]);
};

export const formatNumber = (value: number) => value.toLocaleString();

export const parseNumber = (value: string) => Number(value.replace(/,/g, ''));

export const formatAmountInput = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString();
};

export const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const parseVisitTime = (value: string) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return { period: '오전', hour: '09', minute: '00' };
  const [rawHour, minute] = value.split(':');
  const hourNum = Number(rawHour);
  const period = hourNum >= 12 ? '오후' : '오전';
  const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
  const hour = hour12.toString().padStart(2, '0');
  return { period, hour, minute };
};

export const TIME_OPTIONS = {
  periods: ['오전', '오후'],
  hours: Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')),
  minutes: Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')),
};

export const createAdditionalDeadlineId = () =>
  `deadline-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
