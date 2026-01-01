'use client';

import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import { ArrowLeft } from 'lucide-react';

const getTodayInKST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export default function AllSchedulesPage({
  schedules,
  onScheduleClick,
  onBack,
  onCompleteClick,
  onPaybackConfirm,
}: {
  schedules: Schedule[];
  onScheduleClick: (id: number) => void;
  onBack: () => void;
  onCompleteClick?: (id: number) => void;
  onPaybackConfirm?: (id: number) => void;
}) {
  const today = getTodayInKST();

  // Sort by deadline only
  const sortedSchedules = [...schedules].sort((a, b) => {
    if (!a.dead && !b.dead) return 0;
    if (!a.dead) return 1;
    if (!b.dead) return -1;
    return b.dead.localeCompare(a.dead);
  });

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y">
      <div className="flex items-center gap-2 mb-5 mt-5" onClick={onBack}>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[18px] font-semibold text-neutral-900">캘린더로 돌아가기</span>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">총 체험단</div>
            <div className="text-2xl font-extrabold text-[#333]">{schedules.length}건</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">진행 중</div>
            <div className="text-2xl font-extrabold text-[#FF5722]">
              {schedules.filter((s) => s.status !== '완료').length}건
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">완료</div>
            <div className="text-2xl font-extrabold text-[#4CAF50]">
              {schedules.filter((s) => s.status === '완료').length}건
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="space-y-2.5">
        {sortedSchedules.map((schedule) => (
          <ScheduleItem
            key={schedule.id}
            schedule={schedule}
            onClick={() => onScheduleClick(schedule.id)}
            onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
            onPaybackConfirm={onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined}
            today={today}
          />
        ))}
      </div>
    </div>
  );
}
