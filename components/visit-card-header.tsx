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
  Map as MapIcon,
} from 'lucide-react';
// 👇 Kakao Maps SDK에서 StaticMap 임포트
import { StaticMap } from 'react-kakao-maps-sdk';

import type { Schedule } from '@/types';
import { getDaysDiff, parseDateString } from '@/lib/date-utils';

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

const formatTimeParts = (timeStr?: string) => {
  if (!timeStr) return { period: '', hour: '', minute: '' };
  const [h, m] = timeStr.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { period, hour: String(hour), minute: String(m).padStart(2, '0') };
};

const getUpcomingVisits = (schedules: Schedule[], today: string, limit = 20): Schedule[] => {
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

// ☀️ 친절한 날씨 멘트 생성기 (날짜/장소 명시 로직 적용)
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
    };
  }

  // 2. 우선순위별로 "해당 날씨가 있는 가장 빠른 일정" 찾기

  // (1) 눈 (Snow)
  const snowItem = validSchedules.find((s) => {
    const w = weatherMap[s.id];
    return w.code >= 71 && w.code <= 77;
  });
  if (snowItem) {
    const dateRef = formatReferenceDate(snowItem.visit);
    const regionRef = formatSimpleRegion(snowItem.region);
    return {
      text: '눈 소식이 있어요 ☃️ 미끄러움 조심!',
      icon: '❄️',
      reference: `${dateRef} ${regionRef} 기준`,
    };
  }

  // (2) 비 (Rain)
  const rainItem = validSchedules.find((s) => {
    const w = weatherMap[s.id];
    return (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82);
  });
  if (rainItem) {
    const dateRef = formatReferenceDate(rainItem.visit);
    const regionRef = formatSimpleRegion(rainItem.region);
    return {
      text: '비 소식이 있어요 ☔ 우산 챙겨가세요!',
      icon: '☔',
      reference: `${dateRef} ${regionRef} 기준`,
    };
  }

  // (3) 천둥번개
  const thunderItem = validSchedules.find((s) => weatherMap[s.id].code >= 95);
  if (thunderItem) {
    const dateRef = formatReferenceDate(thunderItem.visit);
    const regionRef = formatSimpleRegion(thunderItem.region);
    return {
      text: '천둥번개가 쳐요 ⚡ 안전 운전 하세요!',
      icon: '⚡',
      reference: `${dateRef} ${regionRef} 기준`,
    };
  }

  // (4) 한파 (최저기온 0도 이하)
  const coldItem = validSchedules.find((s) => weatherMap[s.id].min <= 0);
  if (coldItem) {
    const dateRef = formatReferenceDate(coldItem.visit);
    const regionRef = formatSimpleRegion(coldItem.region);
    return {
      text: '너무 추워요 ❄️ 옷 따뜻하게 입고 가세요!',
      icon: '🧣',
      reference: `${dateRef} ${regionRef} 기준`,
    };
  }

  // (5) 폭염 (최고기온 30도 이상)
  const hotItem = validSchedules.find((s) => weatherMap[s.id].max >= 30);
  if (hotItem) {
    const dateRef = formatReferenceDate(hotItem.visit);
    const regionRef = formatSimpleRegion(hotItem.region);
    return {
      text: '햇살이 뜨거워요 🔥 더위 조심하세요!',
      icon: '🧢',
      reference: `${dateRef} ${regionRef} 기준`,
    };
  }

  // (6) 특이사항 없음 -> "가장 빠른 일정" 기준 멘트
  const firstItem = validSchedules[0];
  const dateRef = formatReferenceDate(firstItem.visit);
  const regionRef = formatSimpleRegion(firstItem.region);

  return {
    text: '날씨 맑음 ☀️ 사진 찍기 딱 좋은 날이에요.',
    icon: '📸',
    reference: `${dateRef} ${regionRef} 기준`,
  };
};

// 🗺️ 카카오 정적 지도 컴포넌트 (데이터 검증 및 렌더링 안정성 강화)
function MapVisualizer({ schedules, onClick }: { schedules: Schedule[]; onClick: () => void }) {
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
    <div
      onClick={onClick}
      className="relative w-full h-[150px] bg-[#F4F7F8] rounded-[20px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform border border-black/5"
    >
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

      {/* 지도 보기 버튼 오버레이 */}
      <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm bg-orange-50 text-orange-600 border-orange-900 z-10">
        <MapIcon className="w-3.5 h-3.5 text-orange-600" />
        <span className="text-[11px] font-bold text-orange-500">지도 앱 열기</span>
      </div>
    </div>
  );
}

function SimpleVisitRow({
  schedule,
  index,
  weather,
  today,
}: {
  schedule: Schedule;
  index: number;
  weather?: { code: number; min: number; max: number };
  today: string;
}) {
  const diff = getDaysDiff(today, schedule.visit);
  const dDayLabel = diff === 0 ? 'Day' : `D-${diff}`;
  const dDayColor = diff <= 1 ? 'bg-red-50 text-red-500' : 'bg-neutral-100 text-neutral-500';

  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-none">
      <div className="flex items-center gap-3 overflow-hidden">
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
          <span className="text-[12px] font-medium text-neutral-400 truncate pl-0.5">
            {schedule.regionDetail || schedule.region || '위치 정보 없음'}
          </span>
        </div>
      </div>
      {weather && (
        <div className="shrink-0 flex flex-col items-end gap-0.5 pl-2">
          <WeatherBadge code={weather.code} className="w-5 h-5" />
          <span className="text-[11px] font-medium text-neutral-400">{weather.max}°</span>
        </div>
      )}
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
  onOpenMapApp,
}: {
  schedules: Schedule[];
  today: string;
  onCardClick: (id: number) => void;
  onOpenMapApp?: () => void;
}) {
  const [weatherMap, setWeatherMap] = useState<
    Record<number, { code: number; min: number; max: number }>
  >({});
  const [isExpanded, setIsExpanded] = useState(false);
  const lastWeatherKeyRef = useRef<string | null>(null);

  const upcomingVisits = useMemo(() => getUpcomingVisits(schedules, today), [schedules, today]);
  const nearestVisit = upcomingVisits[0];
  const earliestWeatherTarget = useMemo(
    () => upcomingVisits.find((schedule) => schedule.visit && schedule.lat && schedule.lng),
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
    if (!earliestWeatherTarget) {
      setWeatherMap({});
      return;
    }
    const requestKey = `${earliestWeatherTarget.id}:${earliestWeatherTarget.visit}`;
    if (lastWeatherKeyRef.current === requestKey) return;
    lastWeatherKeyRef.current = requestKey;
    const fetchWeather = async () => {
      const newWeatherMap: Record<number, { code: number; min: number; max: number }> = {};
      const schedule = earliestWeatherTarget;
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
      setWeatherMap(newWeatherMap);
    };
    fetchWeather();
  }, [earliestWeatherTarget]);

  if (!nearestVisit) return null;

  // 지도 앱 열기 (Kakao Scheme 기준 or FullScreenMap 호출)
  const handleMapOverview = () => {
    if (onOpenMapApp) {
      onOpenMapApp(); // 부모에서 전달받은 FullScreenMap 열기 함수
      return;
    }
    // Fallback: 카카오맵 URL Scheme
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = 'kakaomap://open';
    } else {
      window.open('https://map.kakao.com', '_blank');
    }
  };

  const advice = getWeatherAdvice(upcomingWindow, weatherMap);
  const headerTitle = `이번 주 방문 일정 (${upcomingWindow.length})`;

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
              {headerTitle}
            </span>
          </div>
          <button className="p-1 rounded-full bg-neutral-50 text-neutral-400 hover:bg-neutral-100 transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Dashboard */}
        {isExpanded && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* 📍 Kakao Static Map */}
            <MapVisualizer schedules={upcomingWindow} onClick={handleMapOverview} />

            {/* Weather Message */}
            <div className="mt-4 mb-2 flex items-start gap-2.5 bg-neutral-50/80 p-3 rounded-[16px]">
              <span className="text-[20px] select-none">{advice.icon}</span>
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-neutral-800 leading-snug">
                  {advice.text}
                </span>
                {/* 👇 수정된 부분: 정적 텍스트 대신 계산된 reference 값 사용 */}
                <span className="text-[11px] font-medium text-neutral-400 mt-0.5">
                  {advice.reference}
                </span>
              </div>
            </div>

            {/* Visit List */}
            <div className="flex flex-col mt-2">
              {upcomingWindow.map((schedule, idx) => (
                <SimpleVisitRow
                  key={schedule.id}
                  index={idx}
                  schedule={schedule}
                  weather={weatherMap[schedule.id]}
                  today={today}
                />
              ))}
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
