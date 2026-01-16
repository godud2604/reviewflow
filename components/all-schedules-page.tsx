'use client';

import { useMemo, useState } from 'react';
import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { ArrowLeft } from 'lucide-react';

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

const platformLabelMap: Record<string, string> = {
  instagram: '인스타그램',
  youtube: '유튜브',
  tiktok: '틱톡',
  facebook: '페이스북',
  'naver blog': '네이버 블로그',
  naverpost: '네이버 포스트',
  'naver post': '네이버 포스트',
  naver쇼핑: '네이버 쇼핑',
  stylec: '스타일씨',
  blog: '블로그',
  insta: '인스타',
  tiktokshop: '틱톡',
};

const getPlatformDisplayName = (platform: string) => {
  const normalized = platform.trim().toLowerCase();
  return platformLabelMap[normalized] ?? platform;
};

type ViewFilter = 'TODO' | 'DONE';
type SortOption =
  | 'DEADLINE_SOON'
  | 'DEADLINE_LATE'
  | 'VISIT_SOON'
  | 'VISIT_LATE'
  | 'AMOUNT_HIGH'
  | 'AMOUNT_LOW';

export default function AllSchedulesPage({
  schedules,
  onScheduleClick,
  onBack,
  onCompleteClick,
  onCompletedClick,
  onPaybackConfirm,
  onAdditionalDeadlineToggle,
}: {
  schedules: Schedule[];
  onScheduleClick: (id: number) => void;
  onBack: () => void;
  onCompleteClick?: (id: number) => void;
  onCompletedClick?: (id: number) => void;
  onPaybackConfirm?: (id: number) => void;
  onAdditionalDeadlineToggle?: (scheduleId: number, deadlineId: string) => void;
}) {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('TODO');
  const [sortOption, setSortOption] = useState<SortOption>('DEADLINE_SOON');
  const [platformFilter, setPlatformFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const now = getNowInKST();
  const today = now.date;
  const nowMinutes = toMinutes(now.time, 0);

  const completedCount = schedules.filter((s) => s.status === '완료').length;

  const hasIncompleteAdditionalDeadlines = (schedule: Schedule) =>
    (schedule.additionalDeadlines || []).some((deadline) => deadline.date && !deadline.completed);

  const isVisitUpcoming = (schedule: Schedule) => {
    if (!schedule.visit) return false;
    if (schedule.visit > today) return true;
    if (schedule.visit < today) return false;
    const visitMinutes = toMinutes(schedule.visitTime, 23 * 60 + 59);
    return visitMinutes >= nowMinutes;
  };

  const isTodoSchedule = (schedule: Schedule) =>
    schedule.status !== '완료' ||
    hasIncompleteAdditionalDeadlines(schedule) ||
    isVisitUpcoming(schedule);

  const todoCount = schedules.filter((schedule) => isTodoSchedule(schedule)).length;

  const platformOptions = useMemo(() => {
    const values = schedules
      .map((schedule) => schedule.platform)
      .filter((platform) => platform && platform.trim().length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const statusOptions = useMemo(() => {
    const values = schedules
      .map((schedule) => schedule.status)
      .filter((status) => status && status !== '재확인');
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const categoryOptions = useMemo(() => {
    const values = schedules
      .map((schedule) => schedule.category)
      .filter((category) => category && category.length > 0);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const baseList =
    viewFilter === 'TODO'
      ? schedules.filter((schedule) => isTodoSchedule(schedule))
      : schedules.filter((schedule) => schedule.status === '완료');

  const filteredList = baseList.filter((schedule) => {
    if (platformFilter !== '전체' && schedule.platform !== platformFilter) return false;
    if (statusFilter !== '전체' && schedule.status !== statusFilter) return false;
    if (categoryFilter !== '전체' && schedule.category !== categoryFilter) return false;
    if (!normalizedQuery) return true;

    const searchTarget = [
      schedule.title,
      schedule.phone,
      schedule.ownerPhone,
      schedule.memo,
      schedule.region,
      schedule.regionDetail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchTarget.includes(normalizedQuery);
  });

  const getDeadlineDates = (schedule: Schedule) => {
    const additionalDates = (schedule.additionalDeadlines || [])
      .filter((deadline) => deadline.date && !deadline.completed)
      .map((deadline) => deadline.date);
    return [schedule.dead, ...additionalDates].filter(Boolean) as string[];
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

  // 정렬 로직
  const sortedSchedules = [...filteredList].sort((a, b) => {
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
      const dateCompare = aVisit.date.localeCompare(bVisit.date);
      if (dateCompare !== 0) return sortOption === 'VISIT_SOON' ? dateCompare : -dateCompare;
      const timeCompare = aVisit.minutes - bVisit.minutes;
      if (timeCompare !== 0) return sortOption === 'VISIT_SOON' ? timeCompare : -timeCompare;
      return a.id - b.id;
    }

    const aTotal = a.benefit + a.income - a.cost;
    const bTotal = b.benefit + b.income - b.cost;
    if (aTotal === bTotal) return a.id - b.id;
    return sortOption === 'AMOUNT_HIGH' ? bTotal - aTotal : aTotal - bTotal;
  });

  return (
    <div className="flex-1 h-full overflow-y-auto overscroll-contain bg-white scrollbar-hide touch-pan-y">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100 transition-all">
        {/* Top Navigation */}
        <div className="flex items-center px-4 h-14">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-800 hover:text-neutral-600 transition-colors py-2 pr-4"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-[16px] font-semibold">캘린더로 돌아가기</span>
          </button>
        </div>

        {/* Filter Area */}
        <div className="px-5 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[16px] font-semibold text-neutral-900">
                {viewFilter === 'TODO' ? '할 일' : '완료'}
              </div>
              <div className="text-[12px] font-medium text-neutral-500">
                {viewFilter === 'TODO'
                  ? `전체 ${todoCount}건 · 완료 ${completedCount}건`
                  : `완료 ${completedCount}건 · 할 일 ${todoCount}건`}
              </div>
            </div>
            <div className="w-[150px]">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="제목, 연락처, 메모, 방문위치"
                className="w-full rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setViewFilter('TODO')}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all duration-200 ${
                viewFilter === 'TODO'
                  ? 'bg-white border-orange-100 shadow-sm ring-1 ring-orange-100'
                  : 'bg-neutral-50 border-transparent hover:bg-neutral-100'
              }`}
            >
              <span
                className={`text-[11px] font-medium mb-1 ${viewFilter === 'TODO' ? 'text-orange-500/80' : 'text-neutral-400'}`}
              >
                할 일
              </span>
              <span
                className={`text-[22px] font-bold leading-none ${viewFilter === 'TODO' ? 'text-orange-500' : 'text-neutral-400'}`}
              >
                {todoCount}
              </span>
            </button>
            <button
              onClick={() => setViewFilter('DONE')}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all duration-200 ${
                viewFilter === 'DONE'
                  ? 'bg-white border-green-100 shadow-sm ring-1 ring-green-100'
                  : 'bg-neutral-50 border-transparent hover:bg-neutral-100'
              }`}
            >
              <span
                className={`text-[11px] font-medium mb-1 ${viewFilter === 'DONE' ? 'text-[#4CAF50]/80' : 'text-neutral-400'}`}
              >
                완료
              </span>
              <span
                className={`text-[22px] font-bold leading-none ${viewFilter === 'DONE' ? 'text-[#4CAF50]' : 'text-neutral-400'}`}
              >
                {completedCount}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700"
            >
              <option value="DEADLINE_SOON">마감임박순</option>
              <option value="DEADLINE_LATE">마감최신순</option>
              <option value="VISIT_SOON">방문임박순</option>
              <option value="VISIT_LATE">방문최신순</option>
              <option value="AMOUNT_HIGH">금액높은순</option>
              <option value="AMOUNT_LOW">금액낮은순</option>
            </select>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700"
            >
              <option value="전체">플랫폼</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {getPlatformDisplayName(platform)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700"
            >
              <option value="전체">진행상태</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-700"
            >
              <option value="전체">카테고리</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="px-5 pt-4 pb-24 space-y-3 min-h-[50vh]">
        {sortedSchedules.length > 0 ? (
          sortedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
              onCompletedClick={
                onCompletedClick ? () => onCompletedClick(schedule.id) : undefined
              }
              onPaybackConfirm={onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined}
              onAdditionalDeadlineToggle={
                onAdditionalDeadlineToggle
                  ? (deadlineId) => onAdditionalDeadlineToggle(schedule.id, deadlineId)
                  : undefined
              }
              today={today}
            />
          ))
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
            <div className="text-[15px] font-medium mb-1">해당하는 일정이 없어요</div>
            <div className="text-[13px] opacity-70">다른 상태를 선택해보세요</div>
          </div>
        )}
      </div>
    </div>
  );
}
