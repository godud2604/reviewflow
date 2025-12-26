'use client';

import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';

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
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 mt-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[15px] text-neutral-600 hover:text-neutral-900 transition-colors font-medium cursor-pointer"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>캘린더로 돌아가기</span>
        </button>
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
            onPaybackConfirm={
              onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined
            }
            today={today}
          />
        ))}
      </div>
    </div>
  );
}
