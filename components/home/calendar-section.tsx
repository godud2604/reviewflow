'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { parseDateString } from '@/lib/date-utils';
import type { Schedule } from '@/types';
import { CALENDAR_STATUS_LEGEND, getScheduleRingColor } from './constants';

export function CalendarSection({
  schedules,
  onDateClick,
  onGoToToday,
  selectedDate,
  today,
  onCreateSchedule,
  onMonthChange,
  loading = false,
}: {
  schedules: Schedule[];
  onDateClick: (dateStr: string) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  today: string;
  onCreateSchedule?: (dateStr: string) => void;
  onMonthChange?: (date: Date) => void;
  loading?: boolean;
}) {
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const [currentDate, setCurrentDate] = useState(() => parseDateString(today));
  const todayDate = parseDateString(today);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastSelectedDateRef = useRef<string | null>(null);

  const scheduleByDate = schedules.reduce<
    Record<
      string,
      {
        deadlineCount: number;
        visitCount: number;
        hasDeadline: boolean;
        hasVisit: boolean;
        overdue: boolean;
        hasCompleted: boolean;
        ringStatusColors: string[];
        hasPaybackPending: boolean;
      }
    >
  >((acc, schedule) => {
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

    if (schedule.dead) {
      const info = ensureDayInfo(schedule.dead);
      if (isCompleted) {
        info.hasCompleted = true;
      } else {
        info.hasDeadline = true;
        if (schedule.dead < today) {
          info.deadlineCount += 1;
          info.overdue = true;
        } else {
          info.deadlineCount += 1;
        }
      }
      if (statusColor) {
        info.ringStatusColors.push(statusColor);
      }
      if (schedule.paybackExpected && !schedule.paybackConfirmed) {
        info.hasPaybackPending = true;
      }
    }

    // 추가 마감일 (additionalDeadlines)
    if (schedule.additionalDeadlines && schedule.additionalDeadlines.length > 0) {
      schedule.additionalDeadlines.forEach((deadline) => {
        if (deadline.date) {
          const info = ensureDayInfo(deadline.date);

          if (!deadline.completed) {
            // 미완료인 경우 기존 로직
            info.hasDeadline = true;
            if (deadline.date < today) {
              info.deadlineCount += 1;
              info.overdue = true;
            } else {
              info.deadlineCount += 1;
            }
            if (statusColor) {
              info.ringStatusColors.push(statusColor);
            }
          } else {
            // 완료된 경우 주황색 점 표시를 위해 hasCompleted 설정
            info.hasCompleted = true;
          }
        }
      });
    }

    if (schedule.visit) {
      const info = ensureDayInfo(schedule.visit);
      info.hasVisit = true;
      info.visitCount += 1;
      if (isCompleted && !schedule.dead) {
        info.hasCompleted = true;
      }
    }

    return acc;
  }, {});

  const shiftMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
  const prevMonth = () => {
    shiftMonth(-1);
  };
  const nextMonth = () => {
    shiftMonth(1);
  };
  const goToToday = () => {
    setCurrentDate(new Date());
    onGoToToday();
  };

  useEffect(() => {
    onMonthChange?.(currentDate);
  }, [currentDate, onMonthChange]);

  useEffect(() => {
    if (lastSelectedDateRef.current === selectedDate) return;
    lastSelectedDateRef.current = selectedDate;
    if (!selectedDate) return;
    const nextDate = parseDateString(selectedDate);
    if (
      nextDate.getFullYear() !== currentDate.getFullYear() ||
      nextDate.getMonth() !== currentDate.getMonth()
    ) {
      setCurrentDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }, [selectedDate, currentDate]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  const isToday = (day: number) =>
    todayDate.getDate() === day &&
    todayDate.getMonth() === month &&
    todayDate.getFullYear() === year;

  return (
    <div className="rounded-[24px] p-4 shadow-sm bg-gradient-to-b from-white to-neutral-100 mt-2">
      <div className="relative flex items-center justify-center mb-3 gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            disabled={loading}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          </button>
          <div className="text-[16px] font-bold text-neutral-900 flex items-center gap-2">
            {year}년 <span className="text-orange-600">{month + 1}월</span>
          </div>
          <button
            onClick={nextMonth}
            disabled={loading}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          disabled={loading}
          className={`absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[12px] font-semibold text-neutral-900 rounded-lg hover:bg-neutral-200 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          오늘로 이동
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-2.5 font-semibold">
        {weekDays.map((day, idx) => (
          <div key={day} className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-3 text-center">
        {loading ? (
          <>
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`skel-empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-8 w-8 mx-auto rounded-full" />
            ))}
          </>
        ) : (
          <>
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayOfWeek = (startDayOfWeek + day - 1) % 7;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const dayInfo = scheduleByDate[dateStr];
              const hasSchedule =
                !!dayInfo &&
                (dayInfo.deadlineCount > 0 || dayInfo.visitCount > 0 || dayInfo.hasCompleted);
              const isTodayDate = isToday(day);
              const indicatorType = dayInfo?.overdue
                ? 'overdue'
                : dayInfo?.hasDeadline
                  ? 'deadline'
                  : dayInfo?.hasCompleted
                    ? 'completedOnly'
                    : 'none';
              const ringColors = dayInfo?.ringStatusColors ?? [];
              const ringGradientStops =
                ringColors.length > 0
                  ? ringColors
                      .map((color, idx) => {
                        const start = (idx / ringColors.length) * 100;
                        const end = ((idx + 1) / ringColors.length) * 100;
                        return `${color} ${start}% ${end}%`;
                      })
                      .join(', ')
                  : '';
              const ringGradientStyle =
                ringColors.length > 0
                  ? {
                      backgroundImage: `conic-gradient(${ringGradientStops})`,
                      WebkitMaskImage:
                        'radial-gradient(circle, transparent 58%, black 60%, black 72%, transparent 72%)',
                      maskImage:
                        'radial-gradient(circle, transparent 58%, black 60%, black 72%, transparent 72%)',
                    }
                  : undefined;
              const baseStyle =
                indicatorType === 'overdue'
                  ? 'text-orange-800 shadow-[inset_0_0_0_2.5px_rgba(249,115,22,0.65)]'
                  : indicatorType === 'deadline'
                    ? 'text-orange-700 shadow-[inset_0_0_0_2.5px_rgba(249,115,22,0.6)]'
                    : 'text-neutral-800';
              const hoverable = !isSelected && !isTodayDate && hasSchedule;
              const todayHighlightClass = isTodayDate ? 'bg-orange-300 text-orange-900' : '';
              const selectedHighlightClass = isSelected ? 'bg-orange-100 text-orange-900' : '';
              const isInteractive = hasSchedule || Boolean(onCreateSchedule);
              const wasAlreadySelected = selectedDate === dateStr;
              const showPaybackEmoji = Boolean(dayInfo?.hasPaybackPending);
              const handleDayClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                onDateClick(dateStr);
                const isClickInitiated = event.detail === 1;
                const shouldReopenModal = wasAlreadySelected;
                if (!hasSchedule && (isClickInitiated || shouldReopenModal)) {
                  onCreateSchedule?.(dateStr);
                }
                if (hasSchedule && shouldReopenModal) {
                  onCreateSchedule?.(dateStr);
                }
              };

              return (
                <button
                  key={day}
                  onClick={handleDayClick}
                  className={`relative h-8 w-8 mx-auto flex flex-col items-center justify-center text-[11px] font-semibold rounded-full transition-colors ${
                    isInteractive ? 'cursor-pointer' : 'cursor-default'
                  } ${baseStyle}
            ${!isSelected && todayHighlightClass}
            ${selectedHighlightClass}
            ${hoverable ? 'hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]' : ''}
            ${!isSelected && !isToday(day) && dayOfWeek === 0 ? 'text-red-500' : ''}
            ${!isSelected && !isToday(day) && dayOfWeek === 6 ? 'text-blue-500' : ''}`}
                >
                  {ringGradientStyle && (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={ringGradientStyle}
                    />
                  )}
                  {showPaybackEmoji && (
                    <span className="pointer-events-none absolute -top-[2px] -right-[2px] text-[10px]">
                      💸
                    </span>
                  )}
                  <span className="leading-none text-current">{day}</span>
                  {hasSchedule && dayInfo?.hasDeadline && (
                    <>
                      <span
                        className={`absolute bottom-[1.5px] -right-1 flex text-[9px] items-center justify-center rounded-full px-1 py-1 text-[9px] font-extrabold leading-none ${
                          dayInfo.deadlineCount > 0
                            ? 'shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-white text-orange-600'
                            : 'shadow-none bg-transparent text-orange-600'
                        }`}
                      >
                        {dayInfo.deadlineCount > 0 ? dayInfo.deadlineCount : ''}
                      </span>
                      {indicatorType === 'overdue' ? (
                        <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] text-[10px]">
                          🔥
                        </span>
                      ) : null}
                    </>
                  )}
                  {hasSchedule && dayInfo?.hasVisit && (
                    <>
                      <span
                        className={`absolute ${dayInfo?.overdue ? '-top-0.5 -left-1.5' : '-bottom-1 -left-1'} flex h-4 min-w-[16px] items-center justify-center gap-0.1 rounded-full pl-0.5 pr-1 text-[9px] font-extrabold leading-none shadow-[0_4px_10px_rgba(0,0,0,0.12)] bg-sky-50 text-sky-700`}
                      >
                        📍
                        <span className="text-[8.5px]">
                          {dayInfo.visitCount > 1 ? dayInfo.visitCount : ''}
                        </span>
                      </span>
                    </>
                  )}
                  {hasSchedule && dayInfo?.hasCompleted && !dayInfo?.hasDeadline && (
                    <span className="absolute bottom-[3px] -right-[-1px] h-[7px] w-[7px] rounded-full bg-orange-400 shadow-[0_4px_10px_rgba(0,0,0,0.12)]" />
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
      <div className="mt-4.5 flex flex-wrap items-center justify-end gap-3 text-[11px] text-neutral-600">
        {CALENDAR_STATUS_LEGEND.map((item) => (
          <div key={item.status} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full border border-neutral-200"
              style={{ backgroundColor: `${item.color}` }}
            />
            <span className="font-semibold text-neutral-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
