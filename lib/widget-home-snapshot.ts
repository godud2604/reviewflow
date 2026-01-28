'use client';

import type { Schedule } from '@/types';

export type WidgetHomeSnapshotV1 = {
  version: '1';
  issuedAt: number;
  timeZone: 'Asia/Seoul';
  userId: string;
  today: string; // YYYY-MM-DD
  calendar: WidgetCalendarMonthV1;
  todo: WidgetTodoListV1;
};

export type WidgetCalendarSnapshotV1 = {
  version: '1';
  issuedAt: number;
  timeZone: 'Asia/Seoul';
  userId: string;
  today: string; // YYYY-MM-DD
  calendar: WidgetCalendarMonthV1;
};

export type WidgetTodoSnapshotV1 = {
  version: '1';
  issuedAt: number;
  timeZone: 'Asia/Seoul';
  userId: string;
  today: string; // YYYY-MM-DD
  todo: WidgetTodoListV1;
};

export type WidgetCalendarMonthV1 = {
  month: string; // YYYY-MM
  selectedDate?: string | null;
  days: Record<string, WidgetCalendarDayInfoV1>;
};

export type WidgetCalendarDayInfoV1 = {
  deadlineCount: number;
  visitCount: number;
  hasDeadline: boolean;
  hasVisit: boolean;
  overdue: boolean;
  hasCompleted: boolean;
  ringStatusColors: string[];
  hasPaybackPending: boolean;
};

export type WidgetTodoListV1 = {
  viewFilter: 'TODO';
  sortOption: WidgetSortOptionV1;
  totalCount: number;
  items: WidgetScheduleLiteV1[];
};

export type WidgetSortOptionV1 =
  | 'DEADLINE_SOON'
  | 'DEADLINE_LATE'
  | 'VISIT_SOON'
  | 'VISIT_LATE'
  | 'AMOUNT_HIGH'
  | 'AMOUNT_LOW';

export type WidgetScheduleLiteV1 = {
  id: number;
  title: string;

  status: Schedule['status'];
  platform: string;
  reviewType: Schedule['reviewType'];
  channel: string[];
  category: Schedule['category'];

  regionDetail?: string;

  visit?: string;
  visitTime?: string;
  dead?: string;
  additionalDeadlines?: Array<{
    id: string;
    label: string;
    date: string;
    completed?: boolean;
  }>;

  benefit: number;
  income: number;
  cost: number;

  paybackExpected?: boolean;
  paybackExpectedDate?: string;
  paybackExpectedAmount?: number;
  paybackConfirmed?: boolean;

  visitReviewChecklist?: Schedule['visitReviewChecklist'];
  memoExists?: boolean;
};

const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const getNowInKST = () => {
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

const toMinutes = (timeStr?: string, fallback = 0) => {
  if (!timeStr) return fallback;
  const [rawHour, rawMinute] = timeStr.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return fallback;
  return hour * 60 + minute;
};

const CALENDAR_RING_COLORS: Record<string, string> = {
  선정됨: '#f1a0b6',
  예약완료: '#61cedb',
  '방문일 예약 완료': '#61cedb',
  방문: '#5ba768',
  '제품 배송 완료': 'rgba(240, 221, 73, 1)',
  '배송 완료': '#f3c742',
  배송완료: '#f3c742',
};

const getScheduleRingColor = (status: string): string | undefined => CALENDAR_RING_COLORS[status];

const getMonthStringFromDate = (dateStr: string) => dateStr.slice(0, 7);

const hasIncompleteAdditionalDeadlines = (schedule: Schedule) =>
  (schedule.additionalDeadlines || []).some((deadline) => deadline.date && !deadline.completed);

const isVisitUpcoming = (schedule: Schedule, today: string, nowMinutes: number) => {
  if (!schedule.visit) return false;
  if (schedule.visit > today) return true;
  if (schedule.visit < today) return false;
  const visitMinutes = toMinutes(schedule.visitTime, 23 * 60 + 59);
  return visitMinutes >= nowMinutes;
};

const isTodoSchedule = (schedule: Schedule, today: string, nowMinutes: number) =>
  schedule.status !== '완료' ||
  hasIncompleteAdditionalDeadlines(schedule) ||
  isVisitUpcoming(schedule, today, nowMinutes);

const getDeadlineDates = (schedule: Schedule) => {
  const additionalDates = (schedule.additionalDeadlines || [])
    .filter((deadline) => deadline.date && !deadline.completed)
    .map((deadline) => deadline.date);
  const raw = [schedule.dead, ...additionalDates].filter(Boolean) as string[];
  return raw;
};

const getNearestDeadline = (schedule: Schedule) => {
  const dates = getDeadlineDates(schedule).sort((a, b) => a.localeCompare(b));
  return dates[0];
};

const getLatestDeadline = (schedule: Schedule) => {
  const dates = getDeadlineDates(schedule).sort((a, b) => a.localeCompare(b));
  return dates[dates.length - 1];
};

const getVisitKey = (schedule: Schedule) => {
  if (!schedule.visit) return null;
  return {
    date: schedule.visit,
    minutes: toMinutes(schedule.visitTime, 0),
  };
};

const getTotalAmount = (schedule: Schedule) => schedule.benefit + schedule.income - schedule.cost;

const buildWidgetBaseMetaV1 = (userId: string) => {
  const now = getNowInKST();
  return {
    version: '1' as const,
    issuedAt: Date.now(),
    timeZone: 'Asia/Seoul' as const,
    userId,
    today: now.date,
    nowMinutes: toMinutes(now.time, 0),
  };
};

export const buildWidgetHomeSnapshotV1 = ({
  schedules,
  userId,
  maxTodoItems = 5,
  sortOption = 'DEADLINE_SOON',
}: {
  schedules: Schedule[];
  userId: string;
  maxTodoItems?: number;
  sortOption?: WidgetSortOptionV1;
}): WidgetHomeSnapshotV1 => {
  const meta = buildWidgetBaseMetaV1(userId);
  const today = meta.today;
  const nowMinutes = meta.nowMinutes;
  const month = getMonthStringFromDate(today);

  const calendarDays = schedules.reduce<Record<string, WidgetCalendarDayInfoV1>>((acc, schedule) => {
    const ensureDayInfo = (key: string) => {
      if (!acc[key]) {
        acc[key] = {
          deadlineCount: 0,
          visitCount: 0,
          hasDeadline: false,
          hasVisit: false,
          overdue: false,
          hasCompleted: false,
          ringStatusColors: [],
          hasPaybackPending: false,
        };
      }
      return acc[key];
    };

    const isCompleted = schedule.status === '완료';
    const statusColor = isCompleted ? undefined : getScheduleRingColor(schedule.status);

    const dead = schedule.dead || undefined;
    if (dead) {
      const info = ensureDayInfo(dead);
      if (isCompleted) {
        info.hasCompleted = true;
      } else {
        info.hasDeadline = true;
        info.deadlineCount += 1;
        if (dead < today) info.overdue = true;
      }
      if (statusColor) info.ringStatusColors.push(statusColor);
    }

    if (schedule.additionalDeadlines && schedule.additionalDeadlines.length > 0) {
      schedule.additionalDeadlines.forEach((deadline) => {
        if (!deadline.date) return;
        const info = ensureDayInfo(deadline.date);
        if (!deadline.completed) {
          info.hasDeadline = true;
          info.deadlineCount += 1;
          if (deadline.date < today) info.overdue = true;
          if (statusColor) info.ringStatusColors.push(statusColor);
        } else {
          info.hasCompleted = true;
        }
      });
    }

    if (schedule.paybackExpected && !schedule.paybackConfirmed) {
      const paybackDate = schedule.paybackExpectedDate || dead;
      if (paybackDate) {
        ensureDayInfo(paybackDate).hasPaybackPending = true;
      }
    }

    const visit = schedule.visit || undefined;
    if (visit) {
      const info = ensureDayInfo(visit);
      info.hasVisit = true;
      info.visitCount += 1;
      if (isCompleted && !dead) {
        info.hasCompleted = true;
      }
    }

    return acc;
  }, {});

  const todoSchedules = schedules.filter((s) => isTodoSchedule(s, today, nowMinutes));

  const sortedTodoSchedules = [...todoSchedules].sort((a, b) => {
    if (sortOption === 'DEADLINE_SOON' || sortOption === 'DEADLINE_LATE') {
      const aKey = sortOption === 'DEADLINE_SOON' ? getNearestDeadline(a) : getLatestDeadline(a);
      const bKey = sortOption === 'DEADLINE_SOON' ? getNearestDeadline(b) : getLatestDeadline(b);
      if (!aKey && !bKey) return a.id - b.id;
      if (!aKey) return 1;
      if (!bKey) return -1;
      const comparison = aKey.localeCompare(bKey);
      if (comparison !== 0) return sortOption === 'DEADLINE_SOON' ? comparison : -comparison;
      return a.id - b.id;
    }

    if (sortOption === 'VISIT_SOON' || sortOption === 'VISIT_LATE') {
      const aVisit = getVisitKey(a);
      const bVisit = getVisitKey(b);
      if (!aVisit && !bVisit) return a.id - b.id;
      if (!aVisit) return 1;
      if (!bVisit) return -1;
      const comparison = aVisit.date.localeCompare(bVisit.date);
      if (comparison !== 0) return sortOption === 'VISIT_SOON' ? comparison : -comparison;
      const minutesComparison = aVisit.minutes - bVisit.minutes;
      if (minutesComparison !== 0) return sortOption === 'VISIT_SOON' ? minutesComparison : -minutesComparison;
      return a.id - b.id;
    }

    const aTotal = getTotalAmount(a);
    const bTotal = getTotalAmount(b);
    if (aTotal !== bTotal) return sortOption === 'AMOUNT_HIGH' ? bTotal - aTotal : aTotal - bTotal;
    return a.id - b.id;
  });

  const todoItems: WidgetScheduleLiteV1[] = sortedTodoSchedules.slice(0, maxTodoItems).map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    platform: s.platform,
    reviewType: s.reviewType,
    channel: s.channel ?? [],
    category: s.category,
    regionDetail: s.regionDetail,
    visit: s.visit || undefined,
    visitTime: s.visitTime || undefined,
    dead: s.dead || undefined,
    additionalDeadlines: s.additionalDeadlines?.map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
      completed: d.completed,
    })),
    benefit: s.benefit,
    income: s.income,
    cost: s.cost,
    paybackExpected: s.paybackExpected,
    paybackExpectedDate: s.paybackExpectedDate,
    paybackExpectedAmount: s.paybackExpectedAmount,
    paybackConfirmed: s.paybackConfirmed,
    visitReviewChecklist: s.visitReviewChecklist,
    memoExists: Boolean(s.memo?.trim()),
  }));

  return {
    version: meta.version,
    issuedAt: meta.issuedAt,
    timeZone: meta.timeZone,
    userId: meta.userId,
    today: meta.today,
    calendar: {
      month,
      days: calendarDays,
    },
    todo: {
      viewFilter: 'TODO',
      sortOption,
      totalCount: todoSchedules.length,
      items: todoItems,
    },
  };
};

export const buildWidgetCalendarSnapshotV1 = (
  homeSnapshot: WidgetHomeSnapshotV1
): WidgetCalendarSnapshotV1 => ({
  version: homeSnapshot.version,
  issuedAt: homeSnapshot.issuedAt,
  timeZone: homeSnapshot.timeZone,
  userId: homeSnapshot.userId,
  today: homeSnapshot.today,
  calendar: homeSnapshot.calendar,
});

export const buildWidgetTodoSnapshotV1 = (homeSnapshot: WidgetHomeSnapshotV1): WidgetTodoSnapshotV1 => ({
  version: homeSnapshot.version,
  issuedAt: homeSnapshot.issuedAt,
  timeZone: homeSnapshot.timeZone,
  userId: homeSnapshot.userId,
  today: homeSnapshot.today,
  todo: homeSnapshot.todo,
});

export const getWidgetHomeSnapshotFingerprint = (snapshot: WidgetHomeSnapshotV1) => {
  // issuedAt은 변동성이 커서 fingerprint에서는 제외
  const stable = {
    ...snapshot,
    issuedAt: 0,
  };
  return JSON.stringify(stable);
};

export const getWidgetSnapshotsFingerprintV1 = ({
  calendarSnapshot,
  todoSnapshot,
}: {
  calendarSnapshot: WidgetCalendarSnapshotV1;
  todoSnapshot: WidgetTodoSnapshotV1;
}) => {
  const stable = {
    calendarSnapshot: { ...calendarSnapshot, issuedAt: 0 },
    todoSnapshot: { ...todoSnapshot, issuedAt: 0 },
  };
  return JSON.stringify(stable);
};

export const getKstTodayString = () => formatDateStringKST(new Date());

const isTodoScheduleForToday = (schedule: Schedule, today: string, nowMinutes: number) => {
  if (!isTodoSchedule(schedule, today, nowMinutes)) return false;

  const matchesDead = Boolean(schedule.dead && schedule.dead === today);
  const matchesAdditional = (schedule.additionalDeadlines || []).some(
    (d) => d.date === today && !d.completed
  );
  const matchesVisit = Boolean(schedule.visit && schedule.visit === today);
  const matchesPayback =
    Boolean(schedule.paybackExpected && !schedule.paybackConfirmed) &&
    (schedule.paybackExpectedDate || schedule.dead) === today;

  return matchesDead || matchesAdditional || matchesVisit || matchesPayback;
};

export const buildWidgetTodoSnapshotV1FromSchedules = ({
  schedules,
  userId,
  maxItems = 30,
}: {
  schedules: Schedule[];
  userId: string;
  maxItems?: number;
}): WidgetTodoSnapshotV1 => {
  const meta = buildWidgetBaseMetaV1(userId);
  const today = meta.today;
  const nowMinutes = meta.nowMinutes;

  const todoSchedules = schedules.filter((s) => isTodoSchedule(s, today, nowMinutes));

  // 기본 정렬: 마감 임박순(홈 기본값)
  const sortedAll = [...todoSchedules].sort((a, b) => {
    const aKey = getNearestDeadline(a);
    const bKey = getNearestDeadline(b);
    if (!aKey && !bKey) return a.id - b.id;
    if (!aKey) return 1;
    if (!bKey) return -1;
    const cmp = aKey.localeCompare(bKey);
    if (cmp !== 0) return cmp;
    return a.id - b.id;
  });

  const todayItemsRaw = sortedAll.filter((s) => isTodoScheduleForToday(s, today, nowMinutes));
  const upcomingFallback = sortedAll.slice(0, 3);
  const chosen = (todayItemsRaw.length > 0 ? todayItemsRaw : upcomingFallback).slice(0, maxItems);

  const items: WidgetScheduleLiteV1[] = chosen.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    platform: s.platform,
    reviewType: s.reviewType,
    channel: s.channel ?? [],
    category: s.category,
    regionDetail: s.regionDetail,
    visit: s.visit || undefined,
    visitTime: s.visitTime || undefined,
    dead: s.dead || undefined,
    additionalDeadlines: s.additionalDeadlines?.map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
      completed: d.completed,
    })),
    benefit: s.benefit,
    income: s.income,
    cost: s.cost,
    paybackExpected: s.paybackExpected,
    paybackExpectedDate: s.paybackExpectedDate,
    paybackExpectedAmount: s.paybackExpectedAmount,
    paybackConfirmed: s.paybackConfirmed,
    visitReviewChecklist: s.visitReviewChecklist,
    memoExists: Boolean(s.memo?.trim()),
  }));

  return {
    version: meta.version,
    issuedAt: meta.issuedAt,
    timeZone: meta.timeZone,
    userId: meta.userId,
    today: meta.today,
    todo: {
      viewFilter: 'TODO',
      sortOption: 'DEADLINE_SOON',
      totalCount: todoSchedules.length,
      items,
    },
  };
};
