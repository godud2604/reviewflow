'use client';

import { useState } from 'react';

import type { Schedule } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { stripLegacyScheduleMemo } from '@/lib/schedule-memo-legacy';
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
  onPaybackConfirm,
  onAdditionalDeadlineToggle,
  today,
  selectedDate,
}: {
  schedule: Schedule;
  onClick: () => void;
  onCompleteClick?: () => void;
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

  // --- 데이터 체크 ---
  const memoText = stripLegacyScheduleMemo(schedule.memo).trim();
  const hasMemo = Boolean(memoText);
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

  const storePhone = schedule.phone?.trim();
  const ownerPhone = schedule.ownerPhone?.trim();
  const hasStorePhone = Boolean(storePhone);
  const hasOwnerPhone = Boolean(ownerPhone);
  const hasContact = hasStorePhone || hasOwnerPhone;

  // 방문형 주소 정보
  const isVisitType = schedule.reviewType === '방문형';
  const region = schedule.region?.trim();
  const regionDetail = schedule.regionDetail?.trim();
  const hasAddress = Boolean(isVisitType && (region || regionDetail));

  // 메모나 연락처 둘 중 하나라도 있으면 버튼 노출
  const hasDetails = hasMemo || hasContact || hasAddress;

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();

  const toPhoneLink = (value: string) => value.replace(/\s+/g, '');

  // 버튼 라벨 결정 로직
  const getToggleButtonLabel = () => {
    if (isDetailsOpen) return '닫기';
    return '상세 보기';
  };

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
              onClick();
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
          <span className="font-medium text-neutral-600">
            {schedule.reviewType === '방문형' ? (
              <>
                <span className={isVisitActive ? 'font-bold text-sky-700' : undefined}>
                  {visitLabel}
                </span>
                <span className="mx-1 text-neutral-400">|</span>
                <span
                  className={`${isDeadActive ? 'font-bold text-rose-700' : ''} ${
                    isCompleted ? 'line-through opacity-50' : ''
                  }`}
                >
                  {deadLabel}
                </span>
              </>
            ) : schedule.dead ? (
              <span
                className={`${isDeadActive ? 'font-bold text-rose-700' : ''} ${
                  isCompleted ? 'line-through opacity-50' : ''
                }`}
              >
                {deadLabel}
              </span>
            ) : schedule.visit ? (
              <span className={isVisitActive ? 'font-bold text-sky-700' : undefined}>
                {visitLabel}
              </span>
            ) : (
              '미정'
            )}
          </span>
          {schedule.additionalDeadlines &&
            schedule.additionalDeadlines.length > 0 &&
            schedule.additionalDeadlines.map((deadline) => {
              if (!deadline.date) return null;
              const isActiveDeadline = selectedDate && deadline.date === selectedDate;
              const isDeadlineCompleted = deadline.completed === true;
              return (
                <span key={deadline.id} className="font-medium text-neutral-600">
                  <span className="text-neutral-400">|</span>
                  <span
                    className={`ml-1.5 ${isActiveDeadline ? 'font-bold text-rose-700' : ''} ${
                      isDeadlineCompleted ? 'line-through opacity-50' : ''
                    }`}
                  >
                    {deadline.label} {deadline.date.slice(5)}
                  </span>
                </span>
              );
            })}
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

          {/* ----- 통합 토글 버튼 ----- */}
          {hasDetails && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsDetailsOpen((prev) => !prev);
              }}
              aria-expanded={isDetailsOpen}
              className={`flex items-center gap-1 rounded-[10px] px-2.5 py-[3px] text-[10.5px] font-semibold transition-all duration-150 border ${
                isDetailsOpen
                  ? 'bg-neutral-800 text-white border-neutral-800 shadow-md'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:shadow-md hover:border-neutral-400 active:shadow-sm'
              }`}
            >
              <span
                className={`text-[10.5px] font-bold ${isDetailsOpen ? 'text-white' : 'text-orange-600'}`}
              >
                {getToggleButtonLabel()}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-150 ${isDetailsOpen ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* ----- 통합된 펼침 영역 (메모 + 연락처) ----- */}
        {hasDetails && isDetailsOpen && (
          <div
            className="mt-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200 origin-top"
            onClick={(event) => event.stopPropagation()}
          >
            {/* 1-1. 주소 영역 (방문형만) */}
            {hasAddress && (
              <div className="rounded-2xl bg-neutral-50 p-3 border border-neutral-100 px-3 py-2 text-[12px] text-neutral-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10.5px] font-semibold text-orange-700">매장 주소</span>
                    </div>
                    {region && (
                      <p className="text-[12px] font-semibold text-neutral-900 mb-1">{region}</p>
                    )}
                    {regionDetail && (
                      <p className="text-[12px] font-medium break-words text-neutral-700">
                        {regionDetail}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      const fullAddress = [region, regionDetail].filter(Boolean).join(' ');
                      navigator.clipboard
                        .writeText(fullAddress)
                        .then(() => {
                          toast({ title: '주소가 복사되었습니다', duration: 1000 });
                        })
                        .catch(() => {
                          toast({
                            title: '주소 복사에 실패했습니다.',
                            variant: 'destructive',
                            duration: 1000,
                          });
                        });
                    }}
                  >
                    복사
                  </button>
                </div>
              </div>
            )}

            {/* 2. 연락처 영역 */}
            {hasContact && (
              <div className="flex flex-col gap-2 rounded-2xl bg-neutral-50 p-3 border border-neutral-100">
                {/* 가게 정보 */}
                {hasStorePhone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-medium text-neutral-500">매장</span>
                      <span className="text-[10.5px] font-bold text-neutral-700 tracking-wide select-all">
                        {storePhone}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {storePhone?.startsWith('010') && (
                        <a
                          href={`sms:${toPhoneLink(storePhone)}`}
                          className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors"
                          title="문자 보내기"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                          </svg>
                        </a>
                      )}
                      <a
                        href={`tel:${toPhoneLink(storePhone!)}`}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                        title="매장 전화걸기"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}

                {hasStorePhone && hasOwnerPhone && (
                  <div className="h-[1px] w-full bg-neutral-200/60" />
                )}

                {/* 사장님 정보 */}
                {hasOwnerPhone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-medium text-neutral-500">사장님</span>
                      <span className="text-[10.5px] font-bold text-neutral-700 tracking-wide select-all">
                        {ownerPhone}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`sms:${toPhoneLink(ownerPhone!)}`}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors"
                        title="사장님께 문자하기"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                        </svg>
                      </a>
                      <a
                        href={`tel:${toPhoneLink(ownerPhone!)}`}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
                        title="사장님께 전화걸기"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* 1. 메모 영역 */}
            {hasMemo && (
              <div className="rounded-2xl bg-neutral-50 p-3 border border-neutral-100 px-3 py-2 text-[12px] text-neutral-700 whitespace-pre-wrap break-words">
                <div className="flex justify-between items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold text-orange-700">메모</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigator.clipboard
                        .writeText(memoText)
                        .then(() => {
                          toast({ title: '메모가 복사되었습니다', duration: 1000 });
                        })
                        .catch(() => {
                          toast({
                            title: '메모 복사에 실패했습니다.',
                            variant: 'destructive',
                            duration: 1000,
                          });
                        });
                    }}
                  >
                    복사
                  </button>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p>{memoText}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
