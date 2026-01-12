'use client';

import type { Schedule } from '@/types';
import { formatKoreanTime } from '@/lib/time-utils';

const scheduleIcons: Record<Schedule['category'], string> = {
  '맛집/식품': '🍽️',
  뷰티: '💄',
  '생활/리빙': '🏡',
  '출산/육아': '🤱',
  '주방/가전': '🧺',
  반려동물: '🐶',
  '여행/레저': '✈️',
  '티켓/문화생활': '🎫',
  '디지털/전자기기': '🎧',
  '건강/헬스': '💪',
  '자동차/모빌리티': '🚗',
  '문구/오피스': '✏️',
  기타: '📦',
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

const toRgba = (hex: string, alpha = 0.15) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ScheduleItem({
  schedule,
  onClick,
  onCompleteClick,
  onCompletedClick,
  onPaybackConfirm,
  onAdditionalDeadlineToggle,
  today,
  selectedDate,
}: {
  schedule: Schedule;
  onClick: () => void;
  onCompleteClick?: () => void;
  onCompletedClick?: () => void;
  onPaybackConfirm?: () => void;
  onAdditionalDeadlineToggle?: (deadlineId: string) => void;
  today: string;
  selectedDate?: string | null;
}) {
  const statusConfig: Record<
    Schedule['status'],
    { class?: string; text: string; highlightColor?: string }
  > = {
    선정됨: { text: '선정됨', highlightColor: '#f1a0b6' },
    '방문일 예약 완료': { text: '예약 완료', highlightColor: '#61cedb' },
    방문: { text: '방문', highlightColor: '#5ba768' },
    '구매 완료': {
      class: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
      text: '구매 완료',
    },
    '제품 배송 완료': { text: '배송 완료', highlightColor: '#c09410ff' },
    완료: { class: 'bg-neutral-100 text-neutral-700 border border-neutral-200', text: '완료' },
    재확인: { class: 'bg-amber-100 text-amber-900 border border-amber-200', text: '재확인' },
  };

  const visitLabel = schedule.visit
    ? `${schedule.visit.slice(5)}${
        schedule.visitTime ? ` ${formatKoreanTime(schedule.visitTime)}` : ''
      } 방문`
    : '방문일 미정';
  const deadLabel = schedule.dead ? `${schedule.dead.slice(5)} 마감` : '마감 미정';
  const activeDate = selectedDate ?? today;
  const isVisitActive = Boolean(schedule.visit && schedule.visit === activeDate);
  const isDeadActive = Boolean(schedule.dead && schedule.dead === activeDate);

  const total = schedule.benefit + schedule.income - schedule.cost;
  const fallbackStatus = {
    class: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
    text: '미정',
  };
  const status = statusConfig[schedule.status] ?? fallbackStatus;
  const badgeStyle = status.highlightColor
    ? {
        backgroundColor: toRgba(status.highlightColor, 0.15),
      }
    : undefined;
  const isOverdue = schedule.dead && schedule.dead < today && schedule.status !== '완료';
  const isReconfirm = schedule.status === '재확인';
  const isCompleted = schedule.status === '완료';
  const canComplete = !!onCompleteClick;

  const platformLabel = schedule.platform ? getPlatformDisplayName(schedule.platform) : '';
  const hasPaybackExpected = Boolean(schedule.paybackExpected);
  const isPaid = Boolean(schedule.paybackConfirmed);
  const canConfirmPayback = hasPaybackExpected && !!onPaybackConfirm;
  const channelList = schedule.channel?.filter(Boolean) ?? [];
  const channelLabel = channelList.join(', ');
  const hasChannelLabel = channelLabel.length > 0;
  const hasAdditionalDeadlines = Boolean(
    schedule.additionalDeadlines && schedule.additionalDeadlines.length > 0
  );

  const dateItems: Array<{
    key: string;
    date: string;
    label: string;
    className?: string;
  }> = [];
  const undatedItems: Array<{ key: string; label: string; className?: string }> = [];

  if (schedule.reviewType === '방문형') {
    if (schedule.visit) {
      dateItems.push({
        key: 'visit',
        date: schedule.visit,
        label: visitLabel,
        className: isVisitActive ? 'font-bold text-sky-700' : undefined,
      });
    } else {
      undatedItems.push({ key: 'visit-unknown', label: visitLabel });
    }

    if (schedule.dead) {
      dateItems.push({
        key: 'dead',
        date: schedule.dead,
        label: deadLabel,
        className: `${isDeadActive ? 'font-bold text-rose-700' : ''} ${
          isCompleted ? 'line-through opacity-50' : ''
        }`.trim(),
      });
    } else {
      undatedItems.push({ key: 'dead-unknown', label: deadLabel });
    }
  } else {
    if (schedule.dead) {
      dateItems.push({
        key: 'dead',
        date: schedule.dead,
        label: deadLabel,
        className: `${isDeadActive ? 'font-bold text-rose-700' : ''} ${
          isCompleted ? 'line-through opacity-50' : ''
        }`.trim(),
      });
    }

    if (!schedule.dead && schedule.visit) {
      dateItems.push({
        key: 'visit',
        date: schedule.visit,
        label: visitLabel,
        className: isVisitActive ? 'font-bold text-sky-700' : undefined,
      });
    }
  }

  if (schedule.additionalDeadlines) {
    schedule.additionalDeadlines.forEach((deadline) => {
      if (!deadline.date) return;
      const isActiveDeadline = selectedDate && deadline.date === selectedDate;
      const isDeadlineCompleted = deadline.completed === true;
      dateItems.push({
        key: `additional-${deadline.id}`,
        date: deadline.date,
        label: `${deadline.date.slice(5)} ${deadline.label}`,
        className: `${isActiveDeadline ? 'font-bold text-rose-700' : ''} ${
          isDeadlineCompleted ? 'line-through opacity-50' : ''
        }`.trim(),
      });
    });
  }

  const sortedDateItems = [...dateItems].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.key.localeCompare(b.key);
  });
  const timelineItems = [...sortedDateItems, ...undatedItems];

  const visitReviewChecklist = schedule.visitReviewChecklist;
  const hasVisitReviewExtra = Boolean(
    schedule.reviewType === '방문형' &&
    visitReviewChecklist &&
    (visitReviewChecklist.naverReservation ||
      visitReviewChecklist.platformAppReview ||
      visitReviewChecklist.cafeReview ||
      visitReviewChecklist.googleReview ||
      visitReviewChecklist.other)
  );
  const hasMemo = Boolean(schedule.memo?.trim());

  return (
    <div
      className={`p-4 rounded-3xl flex items-center shadow-sm cursor-pointer transition-transform active:scale-[0.98] ${
        isOverdue
          ? 'bg-red-50/70 border-red-200'
          : isReconfirm
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-white border-neutral-200'
      }`}
      onClick={onClick}
    >
      <div className="mr-3 flex flex-col items-center gap-2 min-w-[60px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isCompleted) {
              if (onCompletedClick) {
                onCompletedClick();
              } else {
                onClick();
              }
              return;
            }
            if (canComplete) {
              onCompleteClick?.();
            }
          }}
          className={`py-1 rounded-full text-[9px] font-bold border transition-all active:scale-95 w-full text-center ${
            isCompleted
              ? 'bg-orange-50 border-orange-200 text-orange-500 shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
          }`}
        >
          <span className="flex justify-center items-center gap-1 px-2 text-[9px] font-bold">
            <span className="translate-y-[-0.5px] truncate">{isCompleted ? '완료' : '완료'}</span>
          </span>
        </button>

        {schedule.additionalDeadlines &&
          schedule.additionalDeadlines.length > 0 &&
          schedule.additionalDeadlines.map((deadline) => {
            if (!deadline.date) return null;
            const isDeadlineCompleted = deadline.completed === true;
            return (
              <button
                key={deadline.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAdditionalDeadlineToggle) {
                    onAdditionalDeadlineToggle(deadline.id);
                  }
                }}
                className={`py-1 rounded-full text-[9px] font-bold border transition-all active:scale-95 w-full text-center ${
                  isDeadlineCompleted
                    ? 'bg-orange-50 border-orange-200 text-orange-500 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <span className="flex justify-center items-center gap-1 px-2 text-[9px] font-bold">
                  <span className="translate-y-[-0.5px] truncate">{deadline.label}</span>
                </span>
              </button>
            );
          })}

        {hasPaybackExpected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canConfirmPayback) {
                onPaybackConfirm?.();
              }
            }}
            className={`px-2 py-1 rounded-full text-[9px] font-bold border transition-all active:scale-95 w-full text-center ${
              isPaid
                ? 'bg-orange-600/70 text-white border-orange-600 shadow-sm'
                : 'bg-white text-gray-400 border-gray-200 hover:text-orange-400 hover:border-orange-200'
            }`}
          >
            {isPaid ? '입금완료' : '입금완료'}
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-bold text-[#0F172A] flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[16px] shrink-0">{scheduleIcons[schedule.category] || '📦'}</span>
            <span className="text-[15px] block truncate max-w-[150px]">{schedule.title}</span>
          </div>
          <div className="text-right min-w-fit pl-2">
            <div className="font-bold text-[15px] text-neutral-900 leading-tight">
              ₩{total.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1 flex-wrap">
          {timelineItems.length > 0 ? (
            timelineItems.map((item, index) => (
              <span key={item.key} className="font-medium text-neutral-600">
                {index > 0 && <span className="mx-1 text-neutral-400">|</span>}
                <span className={item.className}>{item.label}</span>
              </span>
            ))
          ) : (
            <span className="font-medium text-neutral-600">미정</span>
          )}
          {hasPaybackExpected && (
            <span className="text-sm shrink-0 ml-1 opacity-50" title="페이백 예정">
              💸
            </span>
          )}
        </div>
        <div className="flex mt-2 items-center flex-wrap gap-2">
          <p
            className={`text-[10.5px] font-semibold rounded-[10px] px-2 py-[2px] w-fit ${
              status.class ?? 'border border-neutral-100 text-neutral-500 bg-white/80'
            }`}
            style={badgeStyle}
          >
            {status.text}
          </p>
          {schedule.reviewType === '방문형' && schedule.regionDetail && (
            <span className="text-[11px] font-semibold text-neutral-500 bg-white/80 rounded-[10px] px-2 py-0.5 border border-neutral-200">
              {(() => {
                const parts = schedule.regionDetail.split(' ');
                return parts.slice(0, 2).join(' ');
              })()}
            </span>
          )}
          {platformLabel && (
            <p className="text-[10.5px] font-semibold text-neutral-500 rounded-[10px] border border-neutral-200 bg-white/80 px-2 py-[2px] w-fit">
              {platformLabel}
            </p>
          )}
          {hasChannelLabel && (
            <p className="text-[10.5px] font-semibold text-neutral-500 rounded-[10px] border border-neutral-200 bg-white/80 px-2 py-[2px] w-fit">
              {channelLabel}
            </p>
          )}
          {hasVisitReviewExtra && (
            <p className="text-[10.5px] font-semibold text-amber-700 rounded-[10px] border border-amber-200 bg-amber-50 px-2 py-[2px] w-fit">
              영수증 리뷰
            </p>
          )}
          {hasMemo && (
            <span className="text-[12px] leading-none opacity-70" title="메모 있음">
              📝
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
