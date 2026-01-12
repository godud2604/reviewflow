'use client';

import { useState } from 'react';
import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { ArrowLeft } from 'lucide-react';

const getTodayInKST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

type FilterType = 'ALL' | 'ING' | 'DONE';

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
  const [filter, setFilter] = useState<FilterType>('ALL');
  const today = getTodayInKST();

  const activeCount = schedules.filter((s) => s.status !== '완료').length;
  const completedCount = schedules.filter((s) => s.status === '완료').length;

  // 필터링 로직
  const filteredList = schedules.filter((s) => {
    if (filter === 'ALL') return true;
    if (filter === 'ING') return s.status !== '완료';
    if (filter === 'DONE') return s.status === '완료';
    return true;
  });

  // 정렬 로직
  const sortedSchedules = [...filteredList].sort((a, b) => {
    const aIsCompleted = a.status === '완료';
    const bIsCompleted = b.status === '완료';
    if (aIsCompleted && !bIsCompleted) return 1;
    if (!aIsCompleted && bIsCompleted) return -1;
    if (!a.dead && !b.dead) return 0;
    if (!a.dead) return 1;
    if (!b.dead) return -1;
    return b.dead.localeCompare(a.dead);
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
        <div className="px-5 pb-4">
          {/* Guide Description (추가된 부분) */}
          <div className="mb-2 px-1">
            <span className="text-[12px] font-medium text-neutral-500">
              👇 원하는 상태를 선택해 보세요
            </span>
          </div>

          {/* Filter Buttons */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* 1. 전체 버튼 */}
            <button
              onClick={() => setFilter('ALL')}
              className={`flex flex-col items-center justify-center py-3.5 px-1 rounded-xl border transition-all duration-200 group ${
                filter === 'ALL'
                  ? 'bg-white border-neutral-200 shadow-sm'
                  : 'bg-neutral-50 border-transparent hover:bg-neutral-100'
              }`}
            >
              <span
                className={`text-[11px] font-medium mb-1 ${filter === 'ALL' ? 'text-neutral-500' : 'text-neutral-400'}`}
              >
                총 체험단
              </span>
              <span
                className={`text-[22px] font-bold leading-none mb-1.5 ${filter === 'ALL' ? 'text-neutral-900' : 'text-neutral-400'}`}
              >
                {schedules.length}
              </span>
            </button>

            {/* 2. 진행 중 버튼 */}
            <button
              onClick={() => setFilter('ING')}
              className={`flex flex-col items-center justify-center py-3.5 px-1 rounded-xl border transition-all duration-200 group ${
                filter === 'ING'
                  ? 'bg-white border-orange-100 shadow-sm ring-1 ring-orange-100'
                  : 'bg-neutral-50 border-transparent hover:bg-neutral-100'
              }`}
            >
              <span
                className={`text-[11px] font-medium mb-1 ${filter === 'ING' ? 'text-[#FF5722]/80' : 'text-neutral-400'}`}
              >
                진행 중
              </span>
              <span
                className={`text-[22px] font-bold leading-none mb-1.5 ${filter === 'ING' ? 'text-[#FF5722]' : 'text-neutral-400'}`}
              >
                {activeCount}
              </span>
            </button>

            {/* 3. 완료 버튼 */}
            <button
              onClick={() => setFilter('DONE')}
              className={`flex flex-col items-center justify-center py-3.5 px-1 rounded-xl border transition-all duration-200 group ${
                filter === 'DONE'
                  ? 'bg-white border-green-100 shadow-sm ring-1 ring-green-100'
                  : 'bg-neutral-50 border-transparent hover:bg-neutral-100'
              }`}
            >
              <span
                className={`text-[11px] font-medium mb-1 ${filter === 'DONE' ? 'text-[#4CAF50]/80' : 'text-neutral-400'}`}
              >
                완료
              </span>
              <span
                className={`text-[22px] font-bold leading-none mb-1.5 ${filter === 'DONE' ? 'text-[#4CAF50]' : 'text-neutral-400'}`}
              >
                {completedCount}
              </span>
            </button>
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
