'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  MapPin,
  Navigation,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Map as MapIcon,
} from 'lucide-react';
// 👇 Kakao Maps SDK에서 StaticMap 임포트
import { StaticMap } from 'react-kakao-maps-sdk';

import type { Schedule } from '@/types';
import { getDaysDiff, parseDateString } from '@/lib/date-utils';
import { formatKoreanTime } from '@/lib/time-utils';

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

// 날짜를 YYYY-MM-DD 형식으로 정규화
const normalizeDate = (dateStr: string): string => {
  const date = parseDateString(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getUpcomingVisits = (schedules: Schedule[], today: string, limit = 20): Schedule[] => {
  if (!today) return [];

  // 오늘부터 6일 후까지의 날짜 범위 (YYYY-MM-DD 형식으로 정규화)
  const todayNormalized = normalizeDate(today);
  const todayDate = parseDateString(today);
  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() + 6);
  const endDateNormalized = normalizeDate(
    `${endDate.getFullYear()}-${endDate.getMonth() + 1}-${endDate.getDate()}`
  );

  return schedules
    .filter((schedule) => schedule.visit && schedule.status !== '완료')
    .filter((schedule) => {
      // 날짜를 YYYY-MM-DD 형식으로 정규화하여 문자열 비교
      const visitNormalized = schedule.visit!;
      return visitNormalized >= todayNormalized && visitNormalized <= endDateNormalized;
    })
    .sort((a, b) => {
      if (a.visit === b.visit) {
        return (a.visitTime || '23:59').localeCompare(b.visitTime || '23:59');
      }
      return a.visit!.localeCompare(b.visit!);
    })
    .slice(0, limit);
};

// 요일 변환 헬퍼
const getDayLabel = (dateStr: string) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
};

// 날짜 포맷팅 (YYYY-MM-DD -> M.D(요일))
const formatReferenceDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayLabel = getDayLabel(dateStr);
  return `${month}.${day}(${dayLabel})`;
};

// 지역명 단순화 (서울 강남구 강남대로... -> 강남구)
const formatSimpleRegion = (region?: string) => {
  if (!region) return '방문지';
  const parts = region.split(' ');
  // '서울 강남구' 처럼 2번째 단어가 있으면 2번째 사용, 없으면 첫번째 사용
  return parts.length > 1 ? parts[1] : parts[0];
};

// ----------------------------------------------------------------------
// Weather Components & Logic
// ----------------------------------------------------------------------

// 미세먼지 등급 판정 함수 (한국 환경부 기준)
const getAirQualityLevel = (
  value: number,
  type: 'pm2_5' | 'pm10'
): { level: string; color: string; bgColor: string } => {
  if (type === 'pm2_5') {
    // 초미세먼지 (PM2.5)
    if (value <= 15) return { level: '좋음', color: 'text-orange-700', bgColor: 'bg-orange-50/80' };
    if (value <= 35) return { level: '보통', color: 'text-orange-600', bgColor: 'bg-orange-50/60' };
    if (value <= 75)
      return { level: '나쁨', color: 'text-orange-800', bgColor: 'bg-orange-100/80' };
    return { level: '매우나쁨', color: 'text-orange-900', bgColor: 'bg-orange-200/80' };
  } else {
    // 미세먼지 (PM10)
    if (value <= 30) return { level: '좋음', color: 'text-orange-700', bgColor: 'bg-orange-50/80' };
    if (value <= 80) return { level: '보통', color: 'text-orange-600', bgColor: 'bg-orange-50/60' };
    if (value <= 150)
      return { level: '나쁨', color: 'text-orange-800', bgColor: 'bg-orange-100/80' };
    return { level: '매우나쁨', color: 'text-orange-900', bgColor: 'bg-orange-200/80' };
  }
};

function WeatherBadge({ code, className }: { code: number; className?: string }) {
  if (code === undefined || code === null) return null;
  if (code === 0) return <Sun className={`text-orange-400 ${className}`} />;
  if (code >= 1 && code <= 3) return <Cloud className={`text-sky-400 ${className}`} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return <CloudRain className={`text-blue-400 ${className}`} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`text-cyan-300 ${className}`} />;
  if (code >= 95) return <CloudLightning className={`text-purple-400 ${className}`} />;
  return <Sun className={`text-gray-400 ${className}`} />;
}

// ☀️ 친절한 날씨 멘트 생성기 (가장 빠른 방문일정의 날씨만 체크)
const getWeatherAdvice = (
  schedules: Schedule[],
  weatherMap: Record<number, { code: number; min: number; max: number }>
) => {
  // 1. 날씨 데이터가 존재하는 일정만 추리기
  const validSchedules = schedules.filter((s) => weatherMap[s.id]);

  if (validSchedules.length === 0) {
    return {
      text: '오늘 날씨를 확인해보세요!',
      icon: '🌤️',
      reference: '위치 정보 없음',
      weatherStatus: '날씨 정보 없음',
      temperature: null,
    };
  }

  // 가장 빠른 방문일정의 날씨만 체크
  const firstItem = validSchedules[0];
  const weather = weatherMap[firstItem.id];
  const dateRef = formatReferenceDate(firstItem.visit);
  const regionRef = formatSimpleRegion(firstItem.region);
  const reference = `${dateRef} ${regionRef} 기준`;

  // 2. 우선순위별로 날씨 조건 체크 (가장 빠른 일정의 날씨만)

  // (1) 눈 (Snow)
  if (weather.code >= 71 && weather.code <= 77) {
    return {
      text: '눈 소식이 있어요 ☃️ 미끄러움 조심!',
      icon: '❄️',
      reference,
      weatherStatus: '눈',
      temperature: weather.max,
    };
  }

  // (2) 비 (Rain)
  if ((weather.code >= 51 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82)) {
    return {
      text: '비 소식이 있어요 ☔ 우산 챙겨가세요!',
      icon: '☔',
      reference,
      weatherStatus: '비',
      temperature: weather.max,
    };
  }

  // (3) 천둥번개
  if (weather.code >= 95) {
    return {
      text: '천둥번개가 쳐요 ⚡ 안전 운전 하세요!',
      icon: '⚡',
      reference,
      weatherStatus: '롼우',
      temperature: weather.max,
    };
  }

  // (4) 한파 (최저기온 0도 이하)
  if (weather.min <= 0) {
    return {
      text: '너무 추워요 ❄️ 옷 따뜻하게 입고 가세요!',
      icon: '🧣',
      reference,
      weatherStatus: '추움',
      temperature: weather.max,
    };
  }

  // (5) 폭염 (최고기온 30도 이상)
  if (weather.max >= 30) {
    return {
      text: '햇살이 뜨거워요 🔥 더위 조심하세요!',
      icon: '🧢',
      reference,
      weatherStatus: '더움',
      temperature: weather.max,
    };
  }

  // (6) 특이사항 없음
  return {
    text: '날씨 맑음 ☀️ 사진 찍기 딱 좋은 날이에요.',
    icon: '📸',
    reference,
    weatherStatus: '맑음',
    temperature: weather.max,
  };
};

// 🗺️ 카카오 정적 지도 컴포넌트 (데이터 검증 및 렌더링 안정성 강화)
function MapVisualizer({ schedules }: { schedules: Schedule[] }) {
  const mapData = useMemo(() => {
    // 1. 유효한 데이터 필터링 (lat, lng가 숫자 변환 가능한지 엄격 체크)
    const validSchedules = schedules
      .filter((s) => {
        const lat = Number(s.lat);
        const lng = Number(s.lng);
        return s.lat && s.lng && !isNaN(lat) && !isNaN(lng);
      })
      .slice(0, 5); // 최대 5개

    if (validSchedules.length === 0) return null;

    // 2. 중심 좌표 생성 (첫 번째 일정 기준)
    const center = {
      lat: Number(validSchedules[0].lat),
      lng: Number(validSchedules[0].lng),
    };

    // 3. 마커 데이터 생성
    const markers = validSchedules.map((s) => ({
      position: {
        lat: Number(s.lat),
        lng: Number(s.lng),
      },
      text: '', // 필수: 빈 문자열이라도 넣어서 에러 방지
    }));

    return { center, markers };
  }, [schedules]);

  return (
    <div className="relative w-full h-[150px] bg-[#F4F7F8] rounded-[20px] overflow-hidden border border-black/5">
      {/* 데이터가 완벽할 때만 지도 렌더링 */}
      {mapData && mapData.center && mapData.markers.length > 0 ? (
        <StaticMap
          // key를 추가하여 중심점이 바뀔 때 컴포넌트를 새로 그려 에러를 방지합니다.
          key={`${mapData.center.lat}-${mapData.center.lng}`}
          center={mapData.center}
          style={{ width: '100%', height: '100%' }}
          marker={mapData.markers}
          level={4}
          className="pointer-events-none"
        />
      ) : (
        // Fallback UI (데이터가 없거나 로딩 전)
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                'radial-gradient(#CBD5E1 1.5px, transparent 1.5px), radial-gradient(#CBD5E1 1.5px, #F4F7F8 1.5px)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px',
            }}
          />
          <div className="absolute top-1/2 left-0 w-full h-[12px] bg-white/60 -translate-y-1/2 rotate-[-5deg] blur-[1px]" />
          <div className="absolute top-[35%] left-[45%] animate-bounce duration-1000">
            <MapPin className="w-8 h-8 text-orange-500 fill-orange-50 drop-shadow-md" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pt-10">
            <span className="text-[11px] text-neutral-400 font-medium bg-white/50 px-2 py-1 rounded-md backdrop-blur-sm">
              위치 정보가 없어요
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleVisitRow({
  schedule,
  index,
  weather,
  today,
  onCardClick,
  onRegisterLocation,
  isSelected,
  onSelectSchedule,
}: {
  schedule: Schedule;
  index: number;
  weather?: { code: number; min: number; max: number };
  today: string;
  onCardClick?: (id: number) => void;
  onRegisterLocation?: (id: number) => void;
  isSelected?: boolean;
  onSelectSchedule?: (id: number) => void;
}) {
  const diff = getDaysDiff(today, schedule.visit);
  const dDayLabel = diff === 0 ? 'Day' : `D-${diff}`;
  const dDayColor = diff <= 1 ? 'bg-orange-50 text-orange-600' : 'bg-neutral-100 text-neutral-500';
  const hasLocation = Boolean(schedule.lat && schedule.lng);
  const isClickable = Boolean(onCardClick);
  const visitDateLabel = formatReferenceDate(schedule.visit) || '방문일 미정';
  const visitTimeLabel = schedule.visitTime ? formatKoreanTime(schedule.visitTime) : '시간 미정';
  const visitDateTimeLabel = `${visitDateLabel} · ${visitTimeLabel}`;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      onClick={() => {
        onSelectSchedule?.(schedule.id);
      }}
      onKeyDown={(event) => {
        if (!isClickable && !onSelectSchedule) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectSchedule?.(schedule.id);
        }
      }}
      className={`flex items-center justify-between py-3 border-b border-neutral-100 last:border-none transition-colors ${
        isSelected ? 'bg-orange-50/50 border-orange-100' : ''
      } ${
        onSelectSchedule
          ? 'cursor-pointer hover:bg-neutral-50/80'
          : isClickable
            ? 'cursor-pointer hover:bg-neutral-50/80'
            : ''
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden px-2">
        <div className="shrink-0 w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-[12px] font-bold text-neutral-500">
          {index + 1}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] leading-none ${dDayColor}`}
            >
              {dDayLabel}
            </span>
            <span className="text-[15px] font-bold text-neutral-800 truncate leading-snug">
              {schedule.title}
            </span>
          </div>
          <span className="text-[11.5px] font-semibold text-neutral-500 truncate pl-0.5">
            {visitDateTimeLabel}
          </span>
          <span className="text-[12px] font-medium text-neutral-400 truncate pl-0.5">
            {schedule.regionDetail || schedule.region || '위치 정보 없음'}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 pl-2 pr-2">
        {!hasLocation && onRegisterLocation && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRegisterLocation(schedule.id);
            }}
            className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
          >
            위치 등록
          </button>
        )}
        {weather && (
          <div className="flex flex-col items-end gap-0.5">
            <WeatherBadge code={weather.code} className="w-5 h-5" />
            <span className="text-[11px] font-medium text-neutral-400">{weather.max}°</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component: VisitCardHeader
// ----------------------------------------------------------------------

function VisitCardHeader({
  schedules,
  today,
  onCardClick,
  onRegisterLocation,
}: {
  schedules: Schedule[];
  today: string;
  onCardClick: (id: number) => void;
  onRegisterLocation?: (id: number) => void;
}) {
  const [weatherMap, setWeatherMap] = useState<
    Record<
      number,
      {
        code: number;
        min: number;
        max: number;
        pm2_5?: number;
        pm10?: number;
        hourly?: Array<{ time: string; temp: number; code: number }>;
      }
    >
  >({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const lastWeatherKeyRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollBadge, setShowScrollBadge] = useState(false);

  const upcomingVisits = useMemo(() => getUpcomingVisits(schedules, today), [schedules, today]);
  const nearestVisit = upcomingVisits[0];
  const weatherTargets = useMemo(
    () => upcomingVisits.filter((schedule) => schedule.visit && schedule.lat && schedule.lng),
    [upcomingVisits]
  );

  const upcomingWindow = useMemo(() => {
    if (!nearestVisit?.visit) return [];
    const start = parseDateString(nearestVisit.visit);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return upcomingVisits.filter((schedule) => {
      if (!schedule.visit) return false;
      const visitDate = parseDateString(schedule.visit);
      return visitDate >= start && visitDate <= end;
    });
  }, [nearestVisit, upcomingVisits]);

  useEffect(() => {
    if (weatherTargets.length === 0) {
      setWeatherMap({});
      return;
    }
    const requestKey = weatherTargets
      .map((schedule) => `${schedule.id}:${schedule.visit}:${schedule.lat}:${schedule.lng}`)
      .join('|');
    if (lastWeatherKeyRef.current === requestKey) return;
    lastWeatherKeyRef.current = requestKey;
    const fetchWeather = async () => {
      const newWeatherMap: Record<
        number,
        { code: number; min: number; max: number; pm2_5?: number; pm10?: number }
      > = {};
      const locationBuckets = new Map<string, Schedule[]>();
      weatherTargets.forEach((schedule) => {
        const key = `${schedule.lat},${schedule.lng}`;
        const bucket = locationBuckets.get(key) ?? [];
        bucket.push(schedule);
        locationBuckets.set(key, bucket);
      });
      await Promise.all(
        Array.from(locationBuckets.values()).map(async (group) => {
          const { lat, lng } = group[0];

          // 이 그룹의 실제 방문 날짜들만 추출
          const dates = group.map((s) => s.visit!).sort();
          const startDate = dates[0];
          const endDate = dates[dates.length - 1];

          try {
            // 날씨 정보 가져오기 (daily + hourly) - 실제 방문 날짜만
            const weatherRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&timezone=auto&start_date=${startDate}&end_date=${endDate}`
            );
            const weatherData = await weatherRes.json();

            if (!weatherData.daily?.time) return;

            const byDate: Record<
              string,
              {
                code: number;
                min: number;
                max: number;
                pm2_5?: number;
                pm10?: number;
                hourly?: Array<{ time: string; temp: number; code: number }>;
              }
            > = {};

            weatherData.daily.time.forEach((dateStr: string, idx: number) => {
              byDate[dateStr] = {
                code: weatherData.daily.weather_code?.[idx],
                max: Math.round(weatherData.daily.temperature_2m_max?.[idx]),
                min: Math.round(weatherData.daily.temperature_2m_min?.[idx]),
                hourly: [],
              };
            });

            // 시간대별 날씨 데이터 추가
            if (weatherData.hourly?.time) {
              weatherData.hourly.time.forEach((timeStr: string, idx: number) => {
                const dateStr = timeStr.split('T')[0];
                if (byDate[dateStr]) {
                  const hour = timeStr.split('T')[1]?.split(':')[0];
                  byDate[dateStr].hourly!.push({
                    time: hour + '시',
                    temp: Math.round(weatherData.hourly.temperature_2m?.[idx]),
                    code: weatherData.hourly.weather_code?.[idx],
                  });
                }
              });
            }

            // 대기질 정보 가져오기 (선택적, 실패해도 무시) - 실제 방문 날짜만
            try {
              const airQualityRes = await fetch(
                `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm2_5,pm10&timezone=auto&start_date=${startDate}&end_date=${endDate}`
              );

              if (airQualityRes.ok) {
                const airQualityData = await airQualityRes.json();

                // 미세먼지 데이터 추가 (일별 평균값 계산)
                if (airQualityData.hourly?.time) {
                  const dailyAirQuality: Record<string, { pm2_5: number[]; pm10: number[] }> = {};

                  airQualityData.hourly.time.forEach((timeStr: string, idx: number) => {
                    const dateStr = timeStr.split('T')[0];
                    if (!dailyAirQuality[dateStr]) {
                      dailyAirQuality[dateStr] = { pm2_5: [], pm10: [] };
                    }
                    const pm2_5 = airQualityData.hourly.pm2_5?.[idx];
                    const pm10 = airQualityData.hourly.pm10?.[idx];
                    if (pm2_5 !== null && pm2_5 !== undefined)
                      dailyAirQuality[dateStr].pm2_5.push(pm2_5);
                    if (pm10 !== null && pm10 !== undefined)
                      dailyAirQuality[dateStr].pm10.push(pm10);
                  });

                  Object.keys(dailyAirQuality).forEach((dateStr) => {
                    if (byDate[dateStr]) {
                      const pm2_5Avg =
                        dailyAirQuality[dateStr].pm2_5.length > 0
                          ? Math.round(
                              dailyAirQuality[dateStr].pm2_5.reduce((a, b) => a + b, 0) /
                                dailyAirQuality[dateStr].pm2_5.length
                            )
                          : undefined;
                      const pm10Avg =
                        dailyAirQuality[dateStr].pm10.length > 0
                          ? Math.round(
                              dailyAirQuality[dateStr].pm10.reduce((a, b) => a + b, 0) /
                                dailyAirQuality[dateStr].pm10.length
                            )
                          : undefined;

                      byDate[dateStr].pm2_5 = pm2_5Avg;
                      byDate[dateStr].pm10 = pm10Avg;
                    }
                  });
                }
              }
            } catch (airQualityError) {
              // 대기질 정보 가져오기 실패 시 무시 (날씨 정보는 표시)
              console.warn('Air quality data fetch failed:', airQualityError);
            }

            group.forEach((schedule) => {
              if (!schedule.visit) return;
              const weather = byDate[schedule.visit];
              if (!weather) return;
              newWeatherMap[schedule.id] = weather;
            });
          } catch (e) {
            console.error('Weather data fetch failed:', e);
          }
        })
      );
      setWeatherMap(newWeatherMap);
    };
    fetchWeather();
  }, [weatherTargets]);

  const updateScrollBadge = () => {
    const element = listRef.current;
    if (!element) return;
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    const scrollBottom = element.scrollTop + element.clientHeight;
    const atBottom = Math.ceil(scrollBottom) >= element.scrollHeight - 1;
    setShowScrollBadge(canScroll && !atBottom);
  };

  useEffect(() => {
    if (!isExpanded) return;
    updateScrollBadge();
    const handleResize = () => updateScrollBadge();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded, upcomingWindow.length]);

  if (!nearestVisit) return null;

  // 선택된 일정 또는 첫 번째 일정
  const selectedSchedule = selectedScheduleId
    ? upcomingWindow.find((s) => s.id === selectedScheduleId) || upcomingWindow[0]
    : upcomingWindow[0];

  // 위치 정보가 없으면 더미 데이터 사용
  const hasLocation = selectedSchedule && selectedSchedule.lat && selectedSchedule.lng;
  const dummyWeatherData = {
    code: 0,
    min: -5,
    max: 3,
    pm2_5: 15,
    pm10: 30,
    hourly: [
      { time: '08시', temp: -3, code: 0 },
      { time: '10시', temp: -1, code: 1 },
      { time: '12시', temp: 1, code: 0 },
      { time: '14시', temp: 3, code: 0 },
      { time: '16시', temp: 2, code: 1 },
      { time: '18시', temp: 0, code: 2 },
      { time: '20시', temp: -2, code: 3 },
    ],
  };

  const displayWeatherMap = hasLocation ? weatherMap : { [selectedSchedule.id]: dummyWeatherData };

  const advice = getWeatherAdvice([selectedSchedule], displayWeatherMap);
  const headerTitle = `일주일 방문 일정 (${upcomingWindow.length})`;

  return (
    <div className="relative mt-2 mb-4 px-1">
      <div
        className={`rounded-[24px] border border-neutral-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'p-5' : 'p-3'
        }`}
      >
        {/* Toggle Trigger */}
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors ${
                isExpanded
                  ? 'bg-neutral-800 text-white border-neutral-800'
                  : 'bg-orange-50 text-orange-600 border-orange-100'
              }`}
            >
              {isExpanded ? '브리핑' : '방문 브리핑'}
            </span>
            <span className="text-[13px] font-bold text-neutral-800 truncate max-w-[200px]">
              {isExpanded ? headerTitle : '방문일정 날씨 확인 👆'}
            </span>
          </div>
          <button className="p-1 rounded-full bg-neutral-50 text-neutral-400 hover:bg-neutral-100 transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Dashboard */}
        {isExpanded && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Weather Message - 토스 스타일 */}
            <div className="rounded-2xl bg-neutral-50 p-5">
              {!hasLocation && (
                <div className="rounded-xl bg-orange-50 px-3 py-2.5 border border-orange-100">
                  <div className="text-[13px] font-semibold text-orange-900">
                    📍 위치를 등록하면 실시간 날씨 정보를 볼 수 있어요!
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-orange-600">
                    아래는 예시 데이터에요. 위치 등록 버튼을 눌러보세요!
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-neutral-50/80 rounded-[16px] mb-3.5">
                <span className="text-[20px] select-none">{advice.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-neutral-800 leading-snug">
                    {advice.text}
                  </span>
                  <span className="text-[13px] font-medium text-neutral-400 mt-0.5">
                    {advice.reference}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end mb-2">
                {/* 오른쪽: 최저/최고 */}
                {selectedSchedule && displayWeatherMap[selectedSchedule.id] && (
                  <div className="flex items-end gap-3">
                    <div className="text-[13px] font-semibold text-gray-900">
                      최고 {displayWeatherMap[selectedSchedule.id].max}°
                    </div>
                    <div className="text-[13px] font-medium text-gray-500">
                      최저 {displayWeatherMap[selectedSchedule.id].min}°
                    </div>
                  </div>
                )}
              </div>

              {/* 시간대별 날씨 */}
              <div className="mt-2 space-y-2">
                {/* {selectedSchedule &&
                  displayWeatherMap[selectedSchedule.id]?.hourly &&
                  displayWeatherMap[selectedSchedule.id].hourly!.length > 0 && (
                    <div className="rounded-xl bg-white px-3 py-2.5 border border-neutral-100 relative">
                      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10 rounded-r-xl flex items-center justify-end pr-2">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex items-center justify-between overflow-x-auto gap-3 scrollbar-hide">
                        {(() => {
                          const hourlyData = displayWeatherMap[selectedSchedule.id].hourly!;
                          const visitTime = selectedSchedule.visitTime;

                          // 방문 시간대가 있으면 해당 시간 기준 ±3개 (2시간 간격)
                          if (visitTime) {
                            const visitHour = parseInt(visitTime.split(':')[0]);
                            const targetHours = [];

                            for (let i = -2; i <= 12; i += 1) {
                              const hour = visitHour + i;
                              if (hour >= 0 && hour < 24) {
                                targetHours.push(hour);
                              }
                            }

                            return hourlyData
                              .filter((h) => {
                                const hour = parseInt(h.time.replace('시', ''));
                                return targetHours.includes(hour);
                              })
                              .map((hourData, idx) => {
                                const hour = parseInt(hourData.time.replace('시', ''));
                                const isVisitHour = hour === visitHour;
                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col items-center gap-1 min-w-[50px]"
                                  >
                                    <div
                                      className={`text-[11px] font-medium ${
                                        isVisitHour ? 'text-orange-600 font-bold' : 'text-gray-500'
                                      }`}
                                    >
                                      {hourData.time}
                                    </div>
                                    <WeatherBadge code={hourData.code} className="w-6 h-6" />
                                    <div
                                      className={`text-[13px] font-bold ${
                                        isVisitHour ? 'text-orange-600' : 'text-gray-900'
                                      }`}
                                    >
                                      {hourData.temp}°
                                    </div>
                                  </div>
                                );
                              });
                          }

                          // 방문 시간대가 없으면 2시간 간격으로 전체 시간대
                          return hourlyData
                            .filter((_, idx) => idx % 2 === 0)
                            .map((hourData, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center gap-1 min-w-[50px]"
                              >
                                <div className="text-[11px] font-medium text-gray-500">
                                  {hourData.time}
                                </div>
                                <WeatherBadge code={hourData.code} className="w-6 h-6" />
                                <div className="text-[13px] font-bold text-gray-900">
                                  {hourData.temp}°
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                  )} */}

                {selectedSchedule && displayWeatherMap[selectedSchedule.id] && (
                  <div className="flex gap-2">
                    <div
                      className={`flex-1 rounded-xl px-3 py-2 bg-white border border-neutral-100`}
                    >
                      <div className="text-[10px] font-medium text-gray-500">미세먼지</div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        {displayWeatherMap[selectedSchedule.id].pm10 !== undefined ? (
                          <>
                            <span
                              className={`text-[15px] font-bold ${
                                getAirQualityLevel(
                                  displayWeatherMap[selectedSchedule.id].pm10!,
                                  'pm10'
                                ).color
                              }`}
                            >
                              {
                                getAirQualityLevel(
                                  displayWeatherMap[selectedSchedule.id].pm10!,
                                  'pm10'
                                ).level
                              }
                            </span>
                            <span className="text-[11px] font-medium text-gray-400">
                              {displayWeatherMap[selectedSchedule.id].pm10}
                            </span>
                          </>
                        ) : (
                          <span className="text-[13px] font-medium text-gray-400">측정중</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`flex-1 rounded-xl px-3 py-2 bg-white border border-neutral-100`}
                    >
                      <div className="text-[10px] font-medium text-gray-500">초미세먼지</div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        {displayWeatherMap[selectedSchedule.id].pm2_5 !== undefined ? (
                          <>
                            <span
                              className={`text-[15px] font-bold ${
                                getAirQualityLevel(
                                  displayWeatherMap[selectedSchedule.id].pm2_5!,
                                  'pm2_5'
                                ).color
                              }`}
                            >
                              {
                                getAirQualityLevel(
                                  displayWeatherMap[selectedSchedule.id].pm2_5!,
                                  'pm2_5'
                                ).level
                              }
                            </span>
                            <span className="text-[11px] font-medium text-gray-400">
                              {displayWeatherMap[selectedSchedule.id].pm2_5}
                            </span>
                          </>
                        ) : (
                          <span className="text-[13px] font-medium text-gray-400">측정중</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visit List */}
            <div className="relative mt-2">
              <div
                ref={listRef}
                onScroll={updateScrollBadge}
                className="flex max-h-[23vh] flex-col overflow-y-auto pr-1 pb-8"
              >
                {upcomingWindow.map((schedule, idx) => (
                  <SimpleVisitRow
                    key={schedule.id}
                    index={idx}
                    schedule={schedule}
                    weather={weatherMap[schedule.id]}
                    today={today}
                    onCardClick={onCardClick}
                    onRegisterLocation={onRegisterLocation}
                    isSelected={selectedSchedule?.id === schedule.id}
                    onSelectSchedule={setSelectedScheduleId}
                  />
                ))}
              </div>
              {showScrollBadge && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 flex w-fit -translate-x-1/2 items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg animate-pulse">
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>스크롤하여 더보기</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 기존 ExpandedScheduleCard 등은 하단에 유지 (필요하다면)
export { getUpcomingVisits };
export default VisitCardHeader;
