'use client';

import type { Schedule } from '@/types';

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
  onPaybackConfirm,
  today,
}: {
  schedule: Schedule;
  onClick: () => void;
  onCompleteClick?: () => void;
  onPaybackConfirm?: () => void;
  today: string;
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
    ? `${schedule.visit.slice(5)}${schedule.visitTime ? ` ${schedule.visitTime}` : ''} 방문`
    : '방문일 미정';
  const deadLabel = schedule.dead ? `${schedule.dead.slice(5)} 마감` : '마감 미정';
  const dDate =
    schedule.reviewType === '방문형'
      ? `${visitLabel} | ${deadLabel}`
      : schedule.dead
        ? `${schedule.dead.slice(5)} 마감`
        : schedule.visit
          ? `${schedule.visit.slice(5)} 방문`
          : '미정';

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
            if (canComplete) {
              onCompleteClick?.();
            }
          }}
          className={`py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 w-full text-center ${
            isCompleted
              ? 'bg-orange-50 border-orange-200 text-orange-500 shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center gap-1.5 px-2.5 text-[10px] font-bold">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 20 20"
              fill="none"
              className="inline-block align-middle"
            >
              <circle
                cx="10"
                cy="10"
                r="9"
                stroke={isCompleted ? '#fb923c' : '#d1d5db'}
                strokeWidth="2"
                fill={isCompleted ? '#fb923c' : 'white'}
              />
              {isCompleted && (
                <path
                  d="M6 10.5l2.5 2.5 5-5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <span className="translate-y-[-0.5px]">{isCompleted ? '완료' : '완료'}</span>
          </span>
        </button>

        {hasPaybackExpected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canConfirmPayback) {
                onPaybackConfirm?.();
              }
            }}
            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 w-full text-center ${
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
        <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
          <span className="font-medium text-neutral-600">{dDate}</span>
        </div>
        <div className="flex mt-2 items-center flex-wrap gap-y-1">
          <p
            className={`text-[10.5px] font-semibold rounded-[10px] px-2 py-[2px] w-fit ${
              status.class ?? 'border border-neutral-100 text-neutral-500 bg-white/80'
            }`}
            style={badgeStyle}
          >
            {status.text}
          </p>
          {schedule.reviewType === '방문형' && schedule.regionDetail && (
            <span className="text-[11px] font-semibold text-neutral-500 ml-2 bg-white/80 rounded-[10px] px-2 py-0.5 border border-neutral-200">
              {(() => {
                const parts = schedule.regionDetail.split(' ');
                return parts.slice(0, 2).join(' ');
              })()}
            </span>
          )}
          {platformLabel && (
            <p className="text-[10.5px] font-semibold text-neutral-500 rounded-[10px] border border-neutral-200 bg-white/80 px-2 py-[2px] w-fit ml-2">
              {platformLabel}
            </p>
          )}
          {schedule.memo && (
            <span className="text-sm shrink-0 ml-2 opacity-50" title="메모 있음">
              📝
            </span>
          )}
          {hasPaybackExpected && (
            <span className="text-sm shrink-0 ml-1 opacity-50" title="페이백 예정">
              💸
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
