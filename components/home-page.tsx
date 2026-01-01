'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePostHog } from 'posthog-js/react';
import { CustomOverlayMap, Map, MapMarker } from 'react-kakao-maps-sdk';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import type { Schedule } from '@/types';
import ScheduleItem from '@/components/schedule-item';
import VisitCardHeader, { getUpcomingVisits } from '@/components/visit-card-header';
import { getDaysDiff, parseDateString } from '@/lib/date-utils';
import { formatKoreanTime } from '@/lib/time-utils';
import { Z_INDEX } from '@/lib/z-index';

// --- 날짜/시간 유틸리티 ---
const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const getDayLabel = (dateStr: string) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
};

const formatVisitDate = (dateStr?: string) => {
  if (!dateStr) return '방문일 미정';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}.${date.getDate()} (${getDayLabel(dateStr)})`;
};

// --- 상수 ---
const CALENDAR_RING_COLORS: Record<string, string> = {
  선정됨: '#f1a0b6',
  예약완료: '#61cedb',
  '방문일 예약 완료': '#61cedb',
  방문: '#5ba768',
  '제품 배송 완료': 'rgba(240, 221, 73, 1)',
  '배송 완료': '#f3c742',
  배송완료: '#f3c742',
};

const CALENDAR_STATUS_LEGEND: { status: string; color: string; label: string }[] = [
  { status: '선정됨', color: '#f1a0b6', label: '선정됨' },
  { status: '방문일 예약 완료', color: '#61cedb', label: '방문 예약' },
  { status: '방문', color: '#5ba768', label: '방문' },
  { status: '제품 배송 완료', color: '#f3c742', label: '배송 완료' },
];

const getScheduleRingColor = (status: string): string | undefined => CALENDAR_RING_COLORS[status];

const FULLSCREEN_MAP_BOTTOM_GAP = 'calc(env(safe-area-inset-bottom, 0px) + 74px)';

function FullScreenMap({
  schedules,
  onClose,
  today,
  onCardClick,
  onRegisterLocation,
}: {
  schedules: Schedule[];
  onClose: () => void;
  today: string;
  onCardClick: (id: number) => void;
  onRegisterLocation?: (id: number) => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [showScrollBadge, setShowScrollBadge] = useState(false);

  const [weatherMap, setWeatherMap] = useState<
    Record<number, { code: number; min: number; max: number }>
  >({});
  const lastWeatherKeyRef = useRef<string | null>(null);

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.5665,
    lng: 126.978,
  });
  const [mapLevel, setMapLevel] = useState(4);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalElement(document.body);
  }, []);

  const mapSchedules = useMemo(
    () => schedules.filter((s) => s.lat && s.lng && s.status !== '완료'),
    [schedules]
  );
  const activeSchedules = useMemo(() => schedules.filter((s) => s.status !== '완료'), [schedules]);
  const sortedSchedules = useMemo(
    () =>
      [...activeSchedules].sort((a, b) => {
        if (!a.visit && !b.visit) return 0;
        if (!a.visit) return 1;
        if (!b.visit) return -1;
        if (a.visit === b.visit) {
          return (a.visitTime || '23:59').localeCompare(b.visitTime || '23:59');
        }
        return a.visit.localeCompare(b.visit);
      }),
    [activeSchedules]
  );

  useEffect(() => {
    if (mapSchedules.length > 0) {
      setMapCenter({
        lat: Number(mapSchedules[0].lat),
        lng: Number(mapSchedules[0].lng),
      });
      setActiveId(mapSchedules[0].id);
    }
  }, [mapSchedules]);

  const updateScrollBadge = () => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const scrollBottom = element.scrollTop + element.clientHeight;
    const atBottom = Math.ceil(scrollBottom) >= element.scrollHeight - 1;
    setShowScrollBadge(canScroll && !atBottom);
  };

  useEffect(() => {
    updateScrollBadge();
    const handleResize = () => updateScrollBadge();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sortedSchedules.length]);

  useEffect(() => {
    if (mapSchedules.length === 0) {
      setWeatherMap({});
      return;
    }
    const requestKey = mapSchedules
      .map((schedule) => `${schedule.id}:${schedule.visit ?? ''}`)
      .join('|');
    if (lastWeatherKeyRef.current === requestKey) return;
    lastWeatherKeyRef.current = requestKey;
    const fetchWeather = async () => {
      const newWeatherMap: Record<number, { code: number; min: number; max: number }> = {};
      await Promise.all(
        mapSchedules.map(async (schedule) => {
          if (!schedule.visit) return;
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${schedule.lat}&longitude=${schedule.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${schedule.visit}&end_date=${schedule.visit}`
            );
            const data = await res.json();
            if (data.daily && data.daily.weather_code) {
              newWeatherMap[schedule.id] = {
                code: data.daily.weather_code[0],
                max: Math.round(data.daily.temperature_2m_max[0]),
                min: Math.round(data.daily.temperature_2m_min[0]),
              };
            }
          } catch (e) {
            console.error(e);
          }
        })
      );
      setWeatherMap(newWeatherMap);
    };
    fetchWeather();
  }, [mapSchedules]);

  const handleMarkerClick = (id: number) => {
    setActiveId(id);
    const target = mapSchedules.find((s) => s.id === id);
    if (target && target.lat && target.lng) {
      setMapCenter({ lat: Number(target.lat), lng: Number(target.lng) });
    }
    const element = document.getElementById(`map-card-${id}`);
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  };

  const handleScheduleCardClick = (schedule: Schedule) => {
    if (!schedule.lat || !schedule.lng) {
      toast({ title: '위치등록이 필요합니다.', variant: 'destructive', duration: 1000 });
      return;
    }
    handleMarkerClick(schedule.id);
  };

  const handleRegisterLocationClick = (event: MouseEvent<HTMLButtonElement>, id: number) => {
    event.stopPropagation();
    onRegisterLocation?.(id);
  };

  if (!portalElement) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 right-0 top-0 flex flex-col bg-white"
      style={{ zIndex: Z_INDEX.topLayer, bottom: FULLSCREEN_MAP_BOTTOM_GAP }}
    >
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent"
        style={{ zIndex: Z_INDEX.sticky }}
      >
        <button
          onClick={onClose}
          className="ml-1 mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/85 text-neutral-900 shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all hover:bg-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="text-white font-bold text-lg drop-shadow-md">지도 보기</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative min-h-0">
        <Map
          center={mapCenter}
          style={{ width: '100%', height: '100%' }}
          level={mapLevel}
          isPanto={true}
          draggable={true}
          scrollwheel={true}
          onDragEnd={(map) => {
            const center = map.getCenter();
            setMapCenter({ lat: center.getLat(), lng: center.getLng() });
          }}
          onZoomChanged={(map) => {
            setMapLevel(map.getLevel());
          }}
        >
          {mapSchedules.map((schedule) => {
            const isActive = activeId === schedule.id;
            const visitDateLabel = schedule.visit ? formatVisitDate(schedule.visit) : '방문일 미정';
            const visitTimeLabel = schedule.visitTime
              ? formatKoreanTime(schedule.visitTime)
              : '시간 미정';
            return (
              <Fragment key={schedule.id}>
                <MapMarker
                  position={{ lat: Number(schedule.lat), lng: Number(schedule.lng) }}
                  image={{
                    src: isActive
                      ? 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png'
                      : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
                    size: isActive ? { width: 29, height: 42 } : { width: 24, height: 35 },
                  }}
                  zIndex={isActive ? 100 : 1}
                  onClick={() => handleMarkerClick(schedule.id)}
                />
                <CustomOverlayMap
                  position={{ lat: Number(schedule.lat), lng: Number(schedule.lng) }}
                  yAnchor={2}
                  xAnchor={0.5}
                  zIndex={isActive ? 110 : 2}
                >
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => handleMarkerClick(schedule.id)}
                      className={`flex flex-col items-center rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-[0_6px_16px_rgba(15,23,42,0.25)] transition ${
                        isActive ? 'bg-orange-500 text-white' : 'bg-white text-neutral-800'
                      }`}
                    >
                      <div className="leading-tight">{visitDateLabel}</div>
                      <div className="leading-tight">{visitTimeLabel}</div>
                    </button>
                    <div
                      className={`mt-0.5 h-1.5 w-1.5 rotate-45 shadow-[0_4px_10px_rgba(15,23,42,0.2)] ${
                        isActive ? 'bg-orange-500' : 'bg-white'
                      }`}
                    />
                  </div>
                </CustomOverlayMap>
              </Fragment>
            );
          })}
        </Map>
        <div className="pointer-events-none absolute top-16 right-4 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label="지도 확대"
            onClick={() => setMapLevel((prev) => Math.max(1, prev - 1))}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-xl font-bold text-neutral-900 shadow-[0_12px_24px_rgba(15,23,42,0.25)] hover:bg-white transition-colors"
          >
            +
          </button>
          <button
            type="button"
            aria-label="지도 축소"
            onClick={() => setMapLevel((prev) => Math.min(14, prev + 1))}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-xl font-bold text-neutral-900 shadow-[0_12px_24px_rgba(15,23,42,0.25)] hover:bg-white transition-colors"
          >
            –
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-4">
          <div className="pointer-events-auto rounded-3xl border border-neutral-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-md">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-neutral-900">일주일 방문 일정</span>
                <span className="text-[11px] font-semibold text-neutral-500">
                  {sortedSchedules.length}건
                </span>
              </div>
              <div className="h-1.5 w-12 rounded-full bg-neutral-200" />
            </div>
            <div className="relative">
              <div
                ref={scrollContainerRef}
                onScroll={updateScrollBadge}
                className="max-h-[26vh] space-y-2 overflow-y-auto px-4 pb-8"
              >
                {sortedSchedules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[12px] font-medium text-neutral-500">
                    지도에 표시할 방문 일정이 없습니다.
                  </div>
                ) : (
                  sortedSchedules.map((schedule) => {
                    const isActive = activeId === schedule.id;
                    const hasLocation = Boolean(schedule.lat && schedule.lng);
                    const visitLabel = schedule.visit
                      ? `${formatVisitDate(schedule.visit)}${
                          schedule.visitTime ? ` · ${formatKoreanTime(schedule.visitTime)}` : ''
                        }`
                      : '방문일 미정';
                    const diff = schedule.visit ? getDaysDiff(today, schedule.visit) : null;
                    const badgeLabel =
                      diff === null
                        ? '미정'
                        : diff === 0
                          ? '오늘'
                          : diff === 1
                            ? '내일'
                            : `D-${diff}`;
                    const badgeStyle =
                      diff !== null && diff <= 1
                        ? 'bg-red-50 text-red-500'
                        : 'bg-neutral-100 text-neutral-500';

                    return (
                      <div
                        key={schedule.id}
                        id={`map-card-${schedule.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleScheduleCardClick(schedule)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleScheduleCardClick(schedule);
                          }
                        }}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                          isActive
                            ? 'border-orange-400 bg-orange-50/60 shadow-[0_12px_30px_rgba(249,115,22,0.18)]'
                            : 'border-neutral-200 bg-white'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeStyle}`}
                          >
                            {badgeLabel}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-bold text-neutral-900">
                                {schedule.title}
                              </span>
                              <span className="shrink-0 text-[10px] font-semibold text-neutral-400">
                                {schedule.reviewType}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">
                              {visitLabel}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-neutral-400">
                              {schedule.regionDetail || schedule.region || '위치 미등록'}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!hasLocation && onRegisterLocation && (
                            <button
                              type="button"
                              onClick={(event) => handleRegisterLocationClick(event, schedule.id)}
                              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                            >
                              위치 등록
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {showScrollBadge && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 flex w-fit -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 shadow-sm animate-pulse">
                  <ChevronDown className="h-3 w-3" />
                  <span className="text-orange-900">스크롤하여 더보기</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>,
    portalElement
  );
}

// --- 메인 페이지 ---
export default function HomePage({
  schedules,
  onScheduleClick,
  onShowAllClick,
  onCompleteClick,
  onPaybackConfirm,
  onAddClick,
  onCreateSchedule,
  focusDate,
  onFocusDateApplied,
  userEmail,
  onRegisterLocation,
}: {
  schedules: Schedule[];
  onScheduleClick: (id: number) => void;
  onShowAllClick: () => void;
  onCompleteClick?: (id: number) => void;
  onPaybackConfirm?: (id: number) => void;
  onAddClick?: () => void;
  onCreateSchedule?: (dateStr: string) => void;
  focusDate?: string | null;
  onFocusDateApplied?: () => void;
  userEmail?: string;
  onRegisterLocation?: (id: number) => void;
}) {
  const posthog = usePostHog();
  const today = formatDateStringKST(new Date());
  const upcomingVisitSchedules = useMemo(
    () => getUpcomingVisits(schedules, today),
    [schedules, today]
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'active' | 'reconfirm' | 'overdue' | 'noDeadline'
  >('all');
  const [floatingPanel, setFloatingPanel] = useState<'none' | 'noDeadline' | 'reconfirm'>('none');
  const [showDemo, setShowDemo] = useState(false);
  const [isFullScreenMapOpen, setIsFullScreenMapOpen] = useState(false);
  const handleOpenMapApp = () => setIsFullScreenMapOpen(true);
  const handleRegisterLocation = (id: number) => {
    onRegisterLocation?.(id);
  };

  // Demo Data
  const demoSchedules = useMemo(
    () => [
      {
        title: '강남 파스타 리뷰',
        status: '방문 예약 → 마감 3/20',
        value: '₩55,000',
        tag: '방문형',
      },
      { title: '영양제 제공형', status: '배송 완료 · 3/25 마감', value: '₩32,000', tag: '제공형' },
      {
        title: '카페 인스타 포스팅',
        status: '3/18 방문 · 추가 리뷰 체크',
        value: '₩24,000',
        tag: '복수 채널',
      },
    ],
    []
  );

  const activeSchedules = schedules.filter((s) => s.status !== '완료');
  const activeCount = activeSchedules.length;
  const reconfirmSchedules = schedules.filter((s) => s.status === '재확인');
  const reconfirmCount = reconfirmSchedules.length;
  const noDeadlineSchedules = schedules.filter((s) => !s.dead);
  const hasSchedules = schedules.length > 0;

  useEffect(() => {
    if (focusDate) {
      setSelectedDate(focusDate);
      setSelectedFilter('all');
      onFocusDateApplied?.();
    }
  }, [focusDate, onFocusDateApplied]);

  // Filtering Logic
  let filteredSchedules = schedules;
  if (selectedDate) {
    filteredSchedules = schedules.filter(
      (s) => s.dead === selectedDate || s.visit === selectedDate
    );
  } else if (selectedFilter === 'active') {
    filteredSchedules = activeSchedules;
  } else if (selectedFilter === 'reconfirm') {
    filteredSchedules = schedules.filter((s) => s.status === '재확인');
  } else if (selectedFilter === 'overdue') {
    filteredSchedules = schedules.filter((s) => s.dead && s.dead < today && s.status !== '완료');
  } else if (selectedFilter === 'noDeadline') {
    filteredSchedules = schedules.filter((s) => !s.dead);
  }

  const sortSchedules = (schedules: Schedule[]) => {
    return [...schedules].sort((a, b) => {
      const aIsCompleted = a.status === '완료';
      const bIsCompleted = b.status === '완료';
      if (aIsCompleted && !bIsCompleted) return 1;
      if (!aIsCompleted && bIsCompleted) return -1;

      if (selectedDate) {
        const aIsSelectedVisit = a.visit === selectedDate;
        const bIsSelectedVisit = b.visit === selectedDate;
        const aVisitTimeKey = a.visitTime ?? '23:59';
        const bVisitTimeKey = b.visitTime ?? '23:59';

        if (aIsSelectedVisit && bIsSelectedVisit) {
          return aVisitTimeKey.localeCompare(bVisitTimeKey);
        }
        if (aIsSelectedVisit && !bIsSelectedVisit) return -1;
        if (!aIsSelectedVisit && bIsSelectedVisit) return 1;

        const aDeadKey = a.dead ?? '';
        const bDeadKey = b.dead ?? '';
        if (aDeadKey && bDeadKey) return aDeadKey.localeCompare(bDeadKey);
        if (aDeadKey && !bDeadKey) return -1;
        if (!aDeadKey && bDeadKey) return 1;
        return 0;
      }

      const aIsOverdue = a.dead && a.dead < today && a.status !== '완료';
      const bIsOverdue = b.dead && b.dead < today && b.status !== '완료';
      const aIsReconfirm = a.status === '재확인';
      const bIsReconfirm = b.status === '재확인';
      const aVisitKey = a.visit ?? '';
      const bVisitKey = b.visit ?? '';
      const aVisitTimeKey = a.visitTime ?? '23:59';
      const bVisitTimeKey = b.visitTime ?? '23:59';

      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;
      if (aIsReconfirm && !bIsReconfirm) return -1;
      if (!aIsReconfirm && bIsReconfirm) return 1;
      if (aVisitKey && bVisitKey) {
        const visitCompare = aVisitKey.localeCompare(bVisitKey);
        if (visitCompare !== 0) return visitCompare;
        return aVisitTimeKey.localeCompare(bVisitTimeKey);
      }
      if (aVisitKey && !bVisitKey) return -1;
      if (!aVisitKey && bVisitKey) return 1;
      if (a.dead && b.dead) return a.dead.localeCompare(b.dead);
      if (a.dead && !b.dead) return -1;
      if (!a.dead && b.dead) return 1;
      return 0;
    });
  };

  const displayedSchedules = sortSchedules(
    selectedDate || selectedFilter !== 'all' ? filteredSchedules : activeSchedules
  );
  const headerSchedules =
    selectedDate || selectedFilter !== 'all' ? filteredSchedules : activeSchedules;
  const visitCount = selectedDate
    ? headerSchedules.filter((s) => s.visit === selectedDate).length
    : headerSchedules.filter((s) => s.visit).length;
  const deadlineCount = selectedDate
    ? headerSchedules.filter((s) => s.dead === selectedDate).length
    : headerSchedules.filter((s) => s.dead).length;

  const shouldShowFirstScheduleTutorial =
    hasSchedules && schedules.length === 1 && displayedSchedules.length > 0;
  const shouldShowFilterTutorial =
    hasSchedules && schedules.length <= 1 && displayedSchedules.length === 0;

  const renderTutorialCard = () => (
    <div className="space-y-5 rounded-3xl border border-neutral-200 bg-gradient-to-b from-[#fff6ed] via-white to-white px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.09)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffecd1] to-[#ffe1cc] text-[#ff6a1f] shadow-inner">
            ✨
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-orange-500">next 튜토리얼</p>
            <p className="text-sm font-bold text-neutral-900">다음 단계를 미리 살펴볼까요?</p>
          </div>
        </div>
      </div>
      <ol className="space-y-3 text-left text-[13px] text-neutral-700">
        <li className="flex items-start gap-3 rounded-2xl border border-dashed border-orange-100 bg-white/80 p-3 shadow-sm">
          <span className="mt-0.5 text-lg font-bold text-orange-500">1</span>
          <div>
            <p className="font-semibold text-neutral-900 mb-1">통계 페이지에서 수익 보기</p>
            <div className="space-y-1 pl-2 border-l-2 border-orange-200">
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                <span className="font-bold text-orange-600">하단 네비게이션 바</span>에서{' '}
                <b className="text-orange-500">"통계"</b>를 누르면 바로 이동할 수 있어요.
              </p>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                체험단에 <span className="font-bold text-orange-600">금액</span>을 입력하면 이번 달{' '}
                <span className="font-bold text-orange-600">예상 수익</span>을 자동으로 확인할 수
                있어요.
              </p>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedFilter('all');
  };

  const handleCalendarDateAdd = (dateStr: string) => {
    handleDateClick(dateStr);
    onCreateSchedule?.(dateStr);
  };

  const handleGoToToday = () => {
    setSelectedDate(today);
    setSelectedFilter('all');
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y space-y-3 pt-3 bg-neutral-50/50">
      {/* 3. 캘린더 */}
      <CalendarSection
        schedules={schedules}
        onDateClick={handleDateClick}
        onCreateSchedule={handleCalendarDateAdd}
        onGoToToday={handleGoToToday}
        selectedDate={selectedDate}
        today={today}
      />

      <VisitCardHeader
        schedules={schedules}
        today={today}
        onCardClick={onScheduleClick}
        onOpenMapApp={handleOpenMapApp}
        onRegisterLocation={handleRegisterLocation}
      />

      {/* 5. 일정 리스트 헤더 */}
      <div className="flex items-start justify-between mt-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-neutral-900 text-[16px]">
            {selectedDate
              ? `${selectedDate.slice(5).replace('-', '/')} 일정`
              : selectedFilter === 'reconfirm'
                ? '재확인 일정'
                : selectedFilter === 'overdue'
                  ? '마감 초과 일정'
                  : selectedFilter === 'noDeadline'
                    ? '마감일 미정'
                    : '체험단 일정'}
            <span className="ml-1.5 text-sm font-bold text-neutral-600">
              {selectedDate || selectedFilter !== 'all' ? filteredSchedules.length : activeCount}건
            </span>
          </h3>
          <span className="mt-1 text-[11px] font-semibold text-neutral-500">
            방문일 {visitCount}건 · 마감일 {deadlineCount}건
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowAllClick}
            className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
          >
            전체보기 ({schedules.length})
          </button>
        </div>
      </div>

      {/* 6. 일정 리스트 아이템 */}
      <div className="space-y-3">
        {!hasSchedules ? (
          <div className="bg-white rounded-3xl p-4 text-center shadow-sm shadow-[0_18px_40px_rgba(15,23,42,0.06)] border border-neutral-100 space-y-4">
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-neutral-900">아직 체험단 일정이 없어요</p>
              <p className="text-[11px] text-neutral-500 font-medium">
                체험단을 등록하면 캘린더와 수익 리포트가 자동으로 채워져요
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  posthog?.capture('home_empty_add_clicked', {
                    context: selectedDate ? 'date' : 'list',
                  });
                  onAddClick?.();
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#ff6a1f] text-white text-[13px] font-bold shadow-sm active:scale-[0.98] w-full sm:w-auto"
              >
                체험단 등록하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextShowDemo = !showDemo;
                  setShowDemo(nextShowDemo);
                  posthog?.capture('home_empty_demo_toggled', { open: nextShowDemo });
                }}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-neutral-50 text-neutral-700 text-[13px] font-semibold border border-neutral-200 w-full sm:w-auto"
              >
                데모 일정 살펴보기
              </button>
            </div>
            {showDemo && (
              <div className="mt-2 space-y-3 text-left">
                <div className="text-[11px] font-bold text-neutral-500 uppercase">샘플 일정</div>
                <div className="space-y-2">
                  {demoSchedules.map((demo) => (
                    <div
                      key={demo.title}
                      className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2.5 bg-neutral-50/70"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[13px] font-bold text-neutral-900">{demo.title}</div>
                        <div className="text-[11px] text-neutral-500 font-semibold">
                          {demo.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-[#f97316]">{demo.value}</div>
                        <div className="text-[11px] text-neutral-500">{demo.tag}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : displayedSchedules.length > 0 ? (
          displayedSchedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              onClick={() => onScheduleClick(schedule.id)}
              onCompleteClick={onCompleteClick ? () => onCompleteClick(schedule.id) : undefined}
              onPaybackConfirm={onPaybackConfirm ? () => onPaybackConfirm(schedule.id) : undefined}
              today={today}
              selectedDate={selectedDate}
            />
          ))
        ) : shouldShowFilterTutorial ? (
          renderTutorialCard()
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500">
            선택한 날짜/필터에 맞는 일정이 없어요.
          </div>
        )}
        {shouldShowFirstScheduleTutorial && renderTutorialCard()}
      </div>

      {/* 7. 전체 화면 지도 모달 */}
      <AnimatePresence>
        {isFullScreenMapOpen && (
          <FullScreenMap
            schedules={upcomingVisitSchedules}
            onClose={() => setIsFullScreenMapOpen(false)}
            today={today}
            onCardClick={onScheduleClick}
            onRegisterLocation={handleRegisterLocation}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- 캘린더 컴포넌트 ---
function CalendarSection({
  schedules,
  onDateClick,
  onGoToToday,
  selectedDate,
  today,
  onCreateSchedule,
}: {
  schedules: Schedule[];
  onDateClick: (dateStr: string) => void;
  onGoToToday: () => void;
  selectedDate: string | null;
  today: string;
  onCreateSchedule?: (dateStr: string) => void;
}) {
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const [currentDate, setCurrentDate] = useState(() => parseDateString(today));
  const todayDate = parseDateString(today);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    onGoToToday();
  };

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
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
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
          <div className="text-[16px] font-bold text-neutral-900">
            {year}년 <span className="text-orange-600">{month + 1}월</span>
          </div>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200"
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
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 px-2 py-1.5 text-[12px] font-semibold text-neutral-900 rounded-lg hover:bg-neutral-200 transition-colors"
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
              ? 'text-orange-800 shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.65)]'
              : indicatorType === 'deadline'
                ? 'text-orange-700 shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.6)]'
                : 'text-neutral-800';
          const hoverable = !isSelected && !isTodayDate && hasSchedule;
          const todayHighlightClass = isTodayDate ? 'bg-orange-300 text-orange-900' : '';
          const selectedHighlightClass = isSelected ? 'bg-orange-100 text-orange-900' : '';
          const isInteractive = hasSchedule || Boolean(onCreateSchedule);
          const wasAlreadySelected = selectedDate === dateStr;
          const showPaybackEmoji = Boolean(dayInfo?.hasPaybackPending);
          const handleDayClick = (event: MouseEvent<HTMLButtonElement>) => {
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
