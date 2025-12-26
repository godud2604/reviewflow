'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { MouseEvent, Ref } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CalendarClock,
  MapPin,
  Clock,
  Navigation,
  Map as MapIcon, // 지도 아이콘 추가
  ChevronRight,
} from 'lucide-react';

import type { Schedule } from '@/types';
import { getDaysDiff } from '@/lib/date-utils';
import { Z_INDEX } from '@/lib/z-index';

// ... (formatTimeParts, formatTimeLabel, WeatherBadge 함수는 기존과 동일하여 생략 가능하지만, 전체 코드를 요청하셨으므로 포함하거나 유지한다고 가정합니다. 여기서는 핵심 UI 컴포넌트 위주로 작성합니다.)

const formatTimeParts = (timeStr?: string) => {
  if (!timeStr) return { period: '', hour: '', minute: '' };
  const [h, m] = timeStr.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { period, hour: String(hour), minute: String(m).padStart(2, '0') };
};

const formatTimeLabel = (timeStr?: string) => {
  if (!timeStr) return '미정'; // 더 심플하게
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
};

export const getUpcomingVisits = (
  schedules: Schedule[],
  today: string,
  limit = 20
): Schedule[] => {
  if (!today) return [];
  return schedules
    .filter((schedule) => schedule.visit && schedule.visit >= today && schedule.status !== '완료')
    .sort((a, b) => {
      if (a.visit === b.visit) {
        return (a.visitTime || '23:59').localeCompare(b.visitTime || '23:59');
      }
      return a.visit!.localeCompare(b.visit!);
    })
    .slice(0, limit);
};

function WeatherBadge({ code, className }: { code: number; className?: string }) {
  if (code === undefined || code === null) return null;
  // 아이콘 색상을 조금 더 파스텔 톤으로 조정
  if (code === 0) return <Sun className={`text-orange-400 ${className}`} />;
  if (code >= 1 && code <= 3) return <Cloud className={`text-sky-400 ${className}`} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return <CloudRain className={`text-blue-400 ${className}`} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`text-cyan-300 ${className}`} />;
  if (code >= 95) return <CloudLightning className={`text-purple-400 ${className}`} />;
  return <Sun className={`text-gray-400 ${className}`} />;
}

// [Toss Style] 슬림 카드 디자인 변경
function SlimScheduleCard({
  schedule,
  onClick,
  diff,
  weather,
}: {
  schedule: Schedule;
  onClick: () => void;
  diff: number;
  weather?: { code: number; min: number; max: number };
}) {
  return (
    <button
      onClick={onClick}
      // border 제거, 그림자를 더 부드럽고 넓게 퍼지도록 수정 (shadow-[0_8px_24px_rgba(0,0,0,0.04)])
      // 배경색을 순백색(white)으로 하여 깔끔함 강조
      className="shrink-0 snap-center w-[85vw] max-w-[290px] h-[72px] rounded-[24px] bg-white px-5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.05)] active:scale-[0.96] transition-all hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] mr-3 last:mr-1 my-2"
    >
      <div className="flex items-center gap-4 overflow-hidden w-full">
        {/* D-Day 배지: 더 둥글고(Squircle), 부드러운 색감 */}
        <div
          className={`shrink-0 flex items-center justify-center w-[46px] h-[46px] rounded-[18px] ${
            diff <= 1 ? 'bg-red-50 text-red-500' : 'bg-neutral-50 text-neutral-600'
          }`}
        >
          <div className="flex flex-col items-center leading-none gap-0.5">
            <span className="text-[10px] font-medium text-neutral-400">D-Day</span>
            <span
              className={`text-[15px] font-bold ${diff <= 1 ? 'text-red-500' : 'text-neutral-800'}`}
            >
              {diff === 0 ? 'Day' : diff}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5">
          <div className="flex items-center justify-between w-full pr-1">
            <span className="text-[16px] font-bold text-neutral-800 truncate max-w-[140px]">
              {schedule.title}
            </span>
            {weather && (
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <WeatherBadge code={weather.code} className="w-4 h-4" />
                <span className="text-[13px] font-medium text-neutral-500">{weather.max}°</span>
              </div>
            )}
          </div>
          <div className="text-[13px] text-neutral-400 font-medium flex items-center gap-1">
            {formatTimeLabel(schedule.visitTime)}
          </div>
        </div>
      </div>
    </button>
  );
}

// [Toss Style] 확장 카드 디자인 변경
function ExpandedScheduleCard({
  schedule,
  weather,
  isToday,
  onClick,
  onDetailClick,
  onOpenMapApp,
  cardRef,
  locationMissing,
  onRegisterLocation,
}: {
  schedule: Schedule;
  weather?: { code: number; min: number; max: number };
  isToday: boolean;
  onClick?: () => void;
  onDetailClick?: () => void;
  onOpenMapApp?: () => void;
  cardRef?: Ref<HTMLDivElement>;
  locationMissing?: boolean;
  onRegisterLocation?: () => void;
}) {
  const { period, hour, minute } = formatTimeParts(schedule.visitTime);

  // 지도 보기 핸들러 (기존 동일)
  const handleOpenNaverMap = (e: MouseEvent) => {
    e.stopPropagation();
    if (onOpenMapApp) {
      onOpenMapApp();
      return;
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const searchTarget = schedule.region || '위치';
    const query = encodeURIComponent(searchTarget);

    if (isMobile && schedule.lat && schedule.lng) {
      window.location.href = `nmap://map?lat=${schedule.lat}&lng=${schedule.lng}&zoom=15&appname=reviewflow`;
    } else if (isMobile) {
      window.location.href = `nmap://search?query=${query}&appname=reviewflow`;
    } else {
      window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
    }
  };

  const handleDetailClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDetailClick?.();
  };

  return (
    <div
      ref={cardRef}
      className="snap-center shrink-0 w-[85vw] max-w-[300px] rounded-[32px] bg-white p-7 flex flex-col justify-between h-[300px] relative overflow-hidden mr-4 my-2"
      onClick={onClick}
    >
      <div
        className={`absolute top-0 right-0 w-[80%] h-[80%] bg-gradient-to-bl ${
          isToday ? 'from-orange-50 via-white to-white' : 'from-blue-50 via-white to-white'
        } rounded-bl-[100px] pointer-events-none opacity-60`}
      />

      {/* 상단: 날짜 및 날씨 */}
      <div className="flex justify-between items-start z-10">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
            isToday ? 'bg-orange-50' : 'bg-neutral-50'
          }`}
        >
          <span
            className={`text-[13px] font-bold ${isToday ? 'text-orange-600' : 'text-neutral-500'}`}
          >
            {isToday ? '오늘 방문' : `${schedule.visit?.slice(5).replace('-', '.')} 예정`}
          </span>
        </div>

        {weather && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <WeatherBadge code={weather.code} className="w-5 h-5" />
              <span className="text-[14px] font-bold text-neutral-700">{weather.max}°</span>
            </div>
            <span className="text-[11px] text-neutral-400 mt-0.5">
              {weather.min}° / {weather.max}°
            </span>
          </div>
        )}
      </div>

      {/* 중간: 시간 및 장소 */}
      <div className="flex flex-col mt-2 z-10">
        <div className="flex items-baseline gap-1 text-neutral-900 mb-2">
          <span className="text-[16px] font-semibold text-neutral-400 mr-1">{period}</span>
          <span className="text-[52px] font-extrabold tracking-tight tabular-nums leading-none">
            {hour}:{minute}
          </span>
        </div>

        <h3 className="text-[22px] font-bold text-neutral-900 leading-tight truncate pr-2">
          {schedule.title}
        </h3>

        <div className="flex flex-col gap-1 mt-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 shrink-0 text-neutral-400" />
            <span className="text-[14px] font-medium text-neutral-500 truncate underline decoration-neutral-200 underline-offset-4">
              {[schedule.region, schedule.regionDetail].filter(Boolean).join(' ') ||
                '위치 정보 없음'}
            </span>
          </div>
          {locationMissing && (
            <span className="text-[12px] font-semibold text-orange-500">
              위치 정보가 등록되지 않았습니다. 지도 동기화를 위해 위치 등록이 필요합니다.
            </span>
          )}
          {locationMissing && onRegisterLocation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRegisterLocation();
              }}
              className="text-[13px] font-semibold text-orange-600 underline underline-offset-4"
            >
              위치 등록하기
            </button>
          )}
        </div>
      </div>

      {/* 하단: 액션 버튼 (토스 스타일의 꽉 찬 버튼) */}
      <div className="flex gap-3 mt-auto pt-4 z-10">
        <button
          onClick={handleOpenNaverMap}
          className="flex-1 h-[54px] bg-[#03C75A] hover:bg-[#02b351] active:scale-[0.96] transition-transform rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-[16px] shadow-sm"
        >
          <Navigation className="w-4 h-4 fill-current" />
          길찾기
        </button>
        <button
          type="button"
          onClick={handleDetailClick}
          className="flex-1 h-[54px] rounded-2xl bg-neutral-100 text-neutral-600 font-bold text-[16px] hover:bg-neutral-200 active:scale-[0.96] transition-transform"
        >
          상세보기
        </button>
      </div>
    </div>
  );
}

function VisitCardHeader({
  schedules,
  today,
  onCardClick,
  onOpenMapApp,
  onRegisterLocation,
}: {
  schedules: Schedule[];
  today: string;
  onCardClick: (id: number) => void;
  onOpenMapApp?: () => void;
  onRegisterLocation?: (id: number) => void;
}) {
  const [weatherMap, setWeatherMap] = useState<
    Record<number, { code: number; min: number; max: number }>
  >({});
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [focusedScheduleId, setFocusedScheduleId] = useState<number | null>(null);

  const activeCardRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  const upcomingVisits = useMemo(() => getUpcomingVisits(schedules, today), [schedules, today]);

  useEffect(() => {
    if (upcomingVisits.length === 0) return;
    const fetchWeather = async () => {
      // (기존 날씨 로직 동일)
      const newWeatherMap: Record<number, { code: number; min: number; max: number }> = {};
      await Promise.all(
        upcomingVisits.map(async (schedule) => {
          if (!schedule.lat || !schedule.lng || !schedule.visit) return;
          const diff = getDaysDiff(today, schedule.visit);
          if (diff > 7) return;
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
  }, [upcomingVisits, today]);

  if (upcomingVisits.length === 0) return null;

  const toggleAll = () =>
    setIsAllExpanded((prev) => {
      if (prev) setFocusedScheduleId(null);
      return !prev;
    });

  const handleExpandForSchedule = (id: number) => {
    setFocusedScheduleId(id);
    setIsAllExpanded(true);
  };

  // 지도 전체 보기 핸들러 (예시)
  const handleMapOverview = () => {
    if (onOpenMapApp) {
      onOpenMapApp();
      return;
    }
    window.location.href = 'nmap://map?appname=reviewflow';
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between px-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-bold text-neutral-900 tracking-tight">곧 방문할 곳</h2>
          <span className="flex items-center justify-center bg-neutral-100 text-neutral-600 w-6 h-6 rounded-full text-[13px] font-bold">
            {upcomingVisits.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 지도보기 버튼을 헤더 안으로 깔끔하게 통합 */}
          <button
            onClick={handleMapOverview}
            className="flex items-center gap-1 text-[14px] font-semibold text-neutral-400 hover:text-neutral-600 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-50"
          >
            <MapIcon className="w-4 h-4" />
            지도
          </button>
          <div className="w-[1px] h-3 bg-neutral-200 mx-1"></div>
          <button
            onClick={toggleAll}
            className="flex items-center gap-0.5 text-[14px] font-semibold text-neutral-400 hover:text-neutral-600 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-50"
          >
            {isAllExpanded ? '접기' : '펼치기'}
            {isAllExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        {!isAllExpanded ? (
          <div className="flex overflow-x-auto px-1 gap-0 snap-x scrollbar-hide">
            {upcomingVisits.map((schedule) => (
              <SlimScheduleCard
                key={schedule.id}
                schedule={schedule}
                diff={getDaysDiff(today, schedule.visit)}
                weather={weatherMap[schedule.id]}
                onClick={() => handleExpandForSchedule(schedule.id)}
              />
            ))}
            {/* 리스트 끝에 더보기 느낌의 여백 추가 */}
            <div className="w-4 shrink-0" />
          </div>
        ) : (
          <div className="flex overflow-x-auto px-1 snap-x scrollbar-hide">
            {upcomingVisits.map((schedule) => (
              <ExpandedScheduleCard
                key={schedule.id}
                cardRef={schedule.id === focusedScheduleId ? activeCardRef : undefined}
                schedule={schedule}
                weather={weatherMap[schedule.id]}
                isToday={schedule.visit === today}
                onClick={() => onCardClick(schedule.id)}
                onDetailClick={() => onCardClick(schedule.id)}
                onOpenMapApp={onOpenMapApp}
                onRegisterLocation={() => onRegisterLocation?.(schedule.id)}
                locationMissing={!schedule.lat || !schedule.lng}
              />
            ))}
            <div className="w-4 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

export { ExpandedScheduleCard, getUpcomingVisits };
export default VisitCardHeader;
