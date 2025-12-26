'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSchedules } from '@/hooks/use-schedules';
import type { Schedule, ScheduleChannel, GuideFile, NotificationSettings } from '@/types';
import { uploadGuideFile } from '@/lib/storage';
// --- Kakao Map Library 추가 ---
import { Map, MapMarker, CustomOverlayMap } from 'react-kakao-maps-sdk';

import {
  Camera,
  MessageSquare,
  CloudRain,
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  MoreVertical,
  Map as MapIcon, // 이름 충돌 방지를 위해 별칭 사용
  MessageCircle,
  Check,
  Circle,
  Send,
  X,
  Copy,
  ChevronRight,
  ChevronLeft,
  ExternalLink, // 아이콘 추가
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ScheduleModal from '@/components/schedule-modal';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Z_INDEX } from '@/lib/z-index';
import { useRouter } from 'next/navigation';
import {
  readNotificationSettings,
  writeNotificationSettings,
  SETTINGS_CHANGE_EVENT,
} from '@/lib/notification-settings';
import { triggerDailySummaryNotification } from '@/components/weekly-summary-reminder';

// --- Weather Utils & Types ---
interface DailyWeather {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
}

interface WeatherResponse {
  daily: DailyWeather;
}

function getWeatherDescription(code: number) {
  if (code === 0) return '맑음 ☀️';
  if (code >= 1 && code <= 3) return '구름 조금/흐림 ☁️';
  if (code >= 45 && code <= 48) return '안개 🌫️';
  if (code >= 51 && code <= 67) return '비 🌧️';
  if (code >= 71 && code <= 77) return '눈 ❄️';
  if (code >= 80 && code <= 82) return '소나기 🌦️';
  if (code >= 95) return '천둥번개 ⚡';
  return '알 수 없음';
}

// --- Utils ---
const getKstNow = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 60 * 60000);
};
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const parseDateValue = (value?: string) => (value ? new Date(`${value}T00:00:00+09:00`) : null);
const diffDaysFrom = (target: Date, base: Date) =>
  Math.floor((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
const FAR_FUTURE_TIMESTAMP = 8640000000000000;
const toTimestamp = (value?: string, fallback = FAR_FUTURE_TIMESTAMP) => {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : fallback;
};
const formatVisitDateLabel = (visit?: string, referenceDate?: Date) => {
  const target = parseDateValue(visit);
  if (!target) return null;
  const reference = referenceDate ?? startOfDay(getKstNow());
  const diff = diffDaysFrom(target, reference);
  if (diff === 0) return '오늘 방문';
  if (diff === 1) return '내일 방문';
  return `${target.getMonth() + 1}월 ${target.getDate()}일 방문`;
};
const formatDeadlineLabel = (deadline?: string, referenceDate?: Date) => {
  const target = parseDateValue(deadline);
  if (!target) return null;
  const base = referenceDate ?? startOfDay(getKstNow());
  const diff = diffDaysFrom(target, base);
  if (diff === 0) return 'D - DAY';
  return diff > 0 ? `D - ${diff}` : `D + ${Math.abs(diff)}`;
};
const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const cleanPhoneNumber = (phone?: string) => phone?.replace(/[^0-9]/g, '') || '';

const formatVisitTimeLabel = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return '시간 미정';
  const [hourPart, minutePart = '00'] = trimmed.split(':');
  const hour = Number(hourPart);
  const minute = minutePart.padStart(2, '0');
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${minute}`;
};

const formatTimeInputValue = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const getAdditionalReviews = (schedule: Schedule) => {
  const checklist = schedule.visitReviewChecklist;
  if (!checklist) return [];
  const reviews = [];
  if (checklist.naverReservation) reviews.push('네이버');
  if (checklist.platformAppReview) reviews.push('앱');
  if (checklist.googleReview) reviews.push('구글');
  if (checklist.other && checklist.otherText) reviews.push(checklist.otherText);
  return reviews;
};

const formatScheduleTitle = (schedule: Schedule) =>
  schedule.title ? `'${schedule.title}'` : '진행 중인 일정';

const timeframeConfigs = [
  { id: 'today', label: '오늘', minDiff: 0, maxDiff: 0 },
  { id: 'tomorrow', label: '내일', minDiff: 1, maxDiff: 1 },
  { id: 'week', label: '일주일', minDiff: 0, maxDiff: 6 },
] as const;

type TimeframeId = (typeof timeframeConfigs)[number]['id'];

type TemplateParams = {
  schedule: Schedule;
  userName: string;
};

type TemplateDefinition = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  body: (params: TemplateParams) => string;
};

const visitTemplateDefinitions: TemplateDefinition[] = [
  {
    id: 'visit-remind',
    label: '리마인드',
    description: '약속한 시간에 맞춰 방문한다는 예의 있는 확인',
    icon: Loader2,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님! 오늘 ${formatVisitTimeLabel(schedule.visitTime)}에 방문 예정인 체험단 ${userName}입니다. 약속한 시간에 맞춰 늦지 않게 방문하겠습니다. 잠시 후 뵙겠습니다!`,
  },
  {
    id: 'visit-change',
    label: '시간 조율',
    description: '불가피한 일정 조정을 부탁할 때',
    icon: MessageCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님, 체험단 ${userName}입니다. 오늘 방문 일정에 갑작스러운 변동이 생겨 실례를 무릅쓰고 연락드렸습니다. 혹시 오늘 중 다른 편하신 시간대가 있으실지, 아니면 다른 날로 다시 일정을 잡는 것이 좋을지 여쭤보고 싶습니다. 번거롭게 해드려 정말 죄송합니다.`,
  },
  {
    id: 'visit-deadline',
    label: '마감 요청',
    description: '방문 후 리뷰 마감을 부드럽게 끌고 갈 때',
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `안녕하세요 사장님! 오늘 방문 예정인 체험단 ${userName}입니다. 다름이 아니라, 방문 후 현장 사진과 내용을 더 꼼꼼히 정리하여 퀄리티 높은 리뷰를 작성해 드리고 싶어 마감 기한을 조금 여유 있게 조율할 수 있을지 여쭤봅니다. 정성스러운 포스팅으로 보답하겠습니다!`,
  },
];

const deadlineTemplateDefinitions: TemplateDefinition[] = [
  {
    id: 'deadline-delay',
    label: '지연 안내',
    description: '예상보다 늦어지는 이유를 설명',
    icon: AlertCircle,
    body: ({ schedule, userName }) =>
      `광고주님 안녕하세요. 현재 진행 중인 ${formatScheduleTitle(
        schedule
      )} 포스팅의 완성도를 높이는 과정에서 예상보다 시간이 조금 더 소요되고 있습니다. 기다려 주시는 만큼 꼼꼼하게 마무리하여 내일 중으로 반드시 업로드/전달드리겠습니다. 불편을 끼쳐드려 죄송합니다.`,
  },
  {
    id: 'deadline-extension',
    label: '기한 연장',
    description: '마감이 닥친 상태에서 여유를 요청',
    icon: Check,
    body: ({ schedule, userName }) =>
      `안녕하세요 광고주님, ${formatScheduleTitle(
        schedule
      )} 리뷰를 정리하는 과정에서 조금 더 세밀한 검토가 필요할 것 같습니다. 정성스러운 리뷰를 위해 부득이하게 기한 연장을 부탁드리고자 합니다. 혹시 내일 오전 중까지로 검토 기한을 조정해 주실 수 있을까요? 너그러운 양해 부탁드립니다.`,
  },
  {
    id: 'deadline-status',
    label: '현황 공유',
    description: '지금까지의 진행 상황을 간단히',
    icon: MessageSquare,
    body: ({ schedule, userName }) =>
      `체험단 ${userName}입니다. 현재 ${formatScheduleTitle(
        schedule
      )} 리뷰 자료 수집을 마치고 최종 원고를 편집 중입니다. 오늘 중으로 초안 정리를 완료하여 공유드릴 예정이니, 잠시만 기다려 주시면 감사하겠습니다. 만족하실만한 결과물로 찾아뵙겠습니다!`,
  },
];

const buildTemplates = (type: 'visit' | 'deadline', schedule: Schedule, userName: string) => {
  const definitions = type === 'visit' ? visitTemplateDefinitions : deadlineTemplateDefinitions;
  return definitions.map((def) => ({
    ...def,
    body: def.body({ schedule, userName }),
  }));
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { schedules, updateSchedule, deleteSchedule } = useSchedules({ enabled: !!user });
  const { toast } = useToast();
  const today = useMemo(() => startOfDay(getKstNow()), []);
  const [timeframe, setTimeframe] = useState<TimeframeId>('today');
  const activeTimeframe =
    timeframeConfigs.find((config) => config.id === timeframe) ?? timeframeConfigs[0];

  // --- Map State ---
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; title: string } | null>(
    null
  );

  // --- Weather State ---
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<
    { date: string; maxTemp: number; minTemp: number; code: number }[] | null
  >(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherTargetDate, setWeatherTargetDate] = useState<string | null>(null);
  const [weatherLocationName, setWeatherLocationName] = useState<string>('서울');

  const fetchWeatherData = async (schedule: Schedule) => {
    setWeatherLoading(true);
    setWeatherData(null);
    setWeatherTargetDate(schedule.visit || null);

    // 만약 스케줄에 lat, lng가 있다면 해당 좌표 사용, 없다면 서울 좌표 사용
    const lat = schedule.lat ?? 37.5665;
    const lng = schedule.lng ?? 126.978;
    setWeatherLocationName(schedule.region || '현재 위치');

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );

      if (!res.ok) throw new Error('날씨 정보를 불러오지 못했습니다.');

      const data = (await res.json()) as WeatherResponse;
      const { daily } = data;

      const weeklyForecast = daily.time.slice(0, 7).map((date, index) => {
        return {
          date: date,
          maxTemp: daily.temperature_2m_max[index],
          minTemp: daily.temperature_2m_min[index],
          code: daily.weather_code[index],
        };
      });

      setWeatherData(weeklyForecast);
      setIsWeatherModalOpen(true);
    } catch (error) {
      toast({
        title: '날씨 로드 실패',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  // ... (기존 Notification 및 상태 관리 로직들 유지) ...
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>(() =>
    readNotificationSettings()
  );
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    () => {
      if (typeof window === 'undefined') return 'unsupported';
      if (typeof Notification === 'undefined') return 'unsupported';
      return Notification.permission;
    }
  );

  // (중략 - 기존 코드와 동일)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSettingsEvent = () => {
      setNotificationSettingsState(readNotificationSettings());
    };
    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsEvent);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsEvent);
  }, []);

  const updateNotificationSettings = (next: NotificationSettings) => {
    writeNotificationSettings(next);
    setNotificationSettingsState(next);
    // syncPermissionStatus(); // 생략
  };

  const filterSchedulesByTimeframe = useCallback(
    (value?: string) => {
      const date = parseDateValue(value);
      if (!date) return false;
      const diff = diffDaysFrom(date, today);
      return diff >= activeTimeframe.minDiff && diff <= activeTimeframe.maxDiff;
    },
    [activeTimeframe, today]
  );

  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Schedule | null>(null);
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<number | null>(null);
  const [callMenuTarget, setCallMenuTarget] = useState<number | null>(null);
  const [receiptFocusScheduleId, setReceiptFocusScheduleId] = useState<number | null>(null);
  const clearReceiptFocus = useCallback(() => setReceiptFocusScheduleId(null), []);

  const [smsTarget, setSmsTarget] = useState<Schedule | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [customSmsBody, setCustomSmsBody] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [smsType, setSmsType] = useState<'visit' | 'deadline'>('visit');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const filteredVisits = useMemo(() => {
    const filtered = schedules.filter((s) => filterSchedulesByTimeframe(s.visit));
    return filtered.sort((a, b) => toTimestamp(a.visit) - toTimestamp(b.visit));
  }, [schedules, filterSchedulesByTimeframe]);
  const filteredDeadlines = useMemo(() => {
    const filtered = schedules.filter((s) => filterSchedulesByTimeframe(s.dead));
    return filtered.sort((a, b) => toTimestamp(a.dead) - toTimestamp(b.dead));
  }, [schedules, filterSchedulesByTimeframe]);

  const hasVisitItems = filteredVisits.length > 0;
  const hasDeadlineItems = filteredDeadlines.length > 0;
  const showEmptyState = !hasVisitItems && !hasDeadlineItems;
  const totalTasksCount = filteredVisits.length + filteredDeadlines.length;
  const [animatedTaskCount, setAnimatedTaskCount] = useState(0);

  // (애니메이션 로직 등 기존 코드 유지)
  useEffect(() => {
    const target = totalTasksCount;
    if (target === 0) {
      setAnimatedTaskCount(0);
      return;
    }
    const startValue = target > 0 ? 1 : 0;
    setAnimatedTaskCount(startValue);
    const diff = target - startValue;
    if (diff <= 0) return;
    let frame: number;
    let startTime: number | null = null;
    const duration = 600;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const nextValue = startValue + Math.round(progress * diff);
      setAnimatedTaskCount(Math.min(nextValue, target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [totalTasksCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-call-menu]')) return;
      setCallMenuTarget(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '체험단러';

  const templates = useMemo(() => {
    if (!smsTarget) return [];
    return buildTemplates(smsType, smsTarget, userName);
  }, [smsTarget, smsType, userName]);
  const activeTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null;

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !templates.find((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setCustomSmsBody('');
      return;
    }
    const matched = templates.find((template) => template.id === selectedTemplateId);
    if (matched) setCustomSmsBody(matched.body);
  }, [selectedTemplateId, templates]);

  const handleOpenSmsModal = (schedule: Schedule, type: 'visit' | 'deadline') => {
    setSmsTarget(schedule);
    setSmsType(type);
    setIsSmsModalOpen(true);
  };
  const sendSms = (phone: string, body: string) => {
    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.location.href = `sms:${cleaned}${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`;
  };

  const handleCallSelection = (schedule: Schedule, target: 'store' | 'owner') => {
    // (기존 통화 로직)
    const rawNumber = target === 'store' ? schedule.phone : schedule.ownerPhone;
    const cleaned = cleanPhoneNumber(rawNumber);
    if (!cleaned) {
      toast({ title: `번호가 없습니다.`, variant: 'destructive' });
      setCallMenuTarget(null);
      return;
    }
    setCallMenuTarget(null);
    window.location.href = `tel:${cleaned}`;
  };

  const handleReceiptButtonClick = (schedule: Schedule) => {
    /* ... 기존 로직 ... */
    setReceiptTarget(schedule);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = '';
      receiptFileInputRef.current.click();
    }
  };
  const handleReceiptFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    /* ... 기존 로직 ... */
    // (생략: 기존 코드 그대로 사용)
  };
  const handleUpdateScheduleFiles = useCallback(
    async (id: number, files: GuideFile[]) => {
      await updateSchedule(id, { guideFiles: files });
    },
    [updateSchedule]
  );

  const editingSchedule = schedules.find((s) => s.id === editingScheduleId);
  const visitCardMinWidthClass = filteredVisits.length > 1 ? 'min-w-[82%]' : 'min-w-full';

  // --- Map Handler ---
  const handleOpenMap = (schedule: Schedule) => {
    if (schedule.lat && schedule.lng) {
      setMapTarget({
        lat: Number(schedule.lat),
        lng: Number(schedule.lng),
        title: schedule.title || '방문 장소',
      });
      setIsMapModalOpen(true);
    } else {
      // 좌표가 없을 경우 기존 방식대로 검색 (fallback)
      const query = encodeURIComponent(
        [schedule.region, schedule.regionDetail].filter(Boolean).join(' ')
      );
      window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#101012] text-white font-sans tracking-tight px-2">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .animated-count {
          animation: fadeInCount 0.55s ease;
        }
        @keyframes fadeInCount {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
        <button
          type="button"
          onClick={() => router.push('/?page=home')}
          className="mb-2 flex items-center gap-2 text-sm font-bold text-white"
        >
          <ChevronLeft size={16} /> 모든 일정 보러가기
        </button>
        {/* Header, Brief Section 생략 없이 기존 유지 */}
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">daily brief</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[14px] text-white">
                놓쳐서는 안 될 일정과 마감 알림을 모아볼까요?
              </p>
            </div>
          </div>
        </header>

        <section className="mb-4 rounded-[28px] border border-white/10 bg-gradient-to-br from-[#111116] via-[#14141a] to-[#0c0c0f] p-3 shadow-[0_20px_30px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="ml-2 text-3xl font-black leading-tight tracking-tight bg-gradient-to-br from-[#6c63ff] to-[#aa4bf8] bg-clip-text text-transparent animated-count">
                {animatedTaskCount}건
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-full bg-white/10 p-1 text-[11px] uppercase tracking-[0.25em] text-white/70">
              {timeframeConfigs.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTimeframe(option.id)}
                  className={`rounded-full px-3 py-1 transition ${timeframe === option.id ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                  aria-pressed={timeframe === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {showEmptyState ? (
          <section className="rounded-[32px] border border-dashed border-white/10 bg-[#111116] p-10 text-center text-white/50">
            <p className="text-lg font-bold text-white/80">방문이나 마감 일정이 아직 없어요.</p>
          </section>
        ) : (
          <div className="space-y-8">
            {hasVisitItems && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold uppercase tracking-[0.1em] text-white/40">
                    방문일 {filteredVisits.length}건
                  </h2>
                </div>
                <div className="rounded-[32px] border border-white/5 bg-[#0b0b0f] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                    {filteredVisits.map((s) => {
                      const locationLabel = [s.region, s.regionDetail].filter(Boolean).join(' · ');
                      const visitLabel = formatVisitDateLabel(s.visit, today);
                      const hasLocation = locationLabel.length > 0;

                      // Contact Options
                      const storePhoneNumber = cleanPhoneNumber(s.phone);
                      const ownerPhoneNumber = cleanPhoneNumber(s.ownerPhone);
                      const contactOptions = [
                        {
                          type: 'store' as const,
                          label: '가게번호',
                          value: storePhoneNumber,
                          display: s.phone || storePhoneNumber,
                        },
                        {
                          type: 'owner' as const,
                          label: '사장님번호',
                          value: ownerPhoneNumber,
                          display: s.ownerPhone || ownerPhoneNumber,
                        },
                      ].filter((option) => option.value);
                      const hasContactOptions = contactOptions.length > 0;

                      // Map Logic: 좌표가 있으면 모달, 없으면 검색 링크
                      const hasCoordinates = !!(s.lat && s.lng);

                      return (
                        <div
                          key={s.id}
                          className={`${visitCardMinWidthClass} snap-center rounded-[28px] border border-white/10 bg-[#04050a] px-5 py-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)] space-y-5`}
                        >
                          {/* Top Section */}
                          <div className="flex justify-between gap-4">
                            <div className="space-y-1 w-full">
                              <div className="flex justify-between">
                                <div>
                                  {visitLabel && (
                                    <p className="ml-1 text-[11px] uppercase tracking-[0.15em] text-white/50">
                                      {visitLabel}
                                    </p>
                                  )}
                                  <p className="text-2xl font-semibold leading-tight text-white">
                                    {formatVisitTimeLabel(s.visitTime)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2 text-right">
                                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">
                                    {s.platform}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setEditingScheduleId(s.id);
                                      setIsModalVisible(true);
                                    }}
                                    className="p-1 text-white/30 transition hover:text-white"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              {/* Channel tags omitted for brevity, keeping structure */}
                            </div>
                          </div>

                          {/* Title */}
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold leading-tight text-white">
                              {s.title}
                            </h3>
                          </div>

                          {/* Location Text */}
                          <div className="mt-1 text-[12.5px] text-white/60">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-white/30 shrink-0" />
                              <span className="min-w-0 break-words font-medium">
                                {hasLocation ? locationLabel : '위치 정보 없음'}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleReceiptButtonClick(s)}
                              disabled={uploadingReceiptFor === s.id}
                              className="flex-1 min-w-[100px] max-w-full py-2 bg-white text-black rounded-2xl font-bold text-[13px] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait sm:flex-none"
                            >
                              <Camera className="w-4 h-4 stroke-[1.5]" />{' '}
                              {uploadingReceiptFor === s.id ? '저장 중...' : '영수증 저장'}
                            </button>

                            {/* Phone Menu */}
                            {hasContactOptions && (
                              <div className="relative flex-shrink-0">
                                <button
                                  type="button"
                                  data-call-menu="true"
                                  aria-expanded={callMenuTarget === s.id}
                                  onClick={() =>
                                    setCallMenuTarget(callMenuTarget === s.id ? null : s.id)
                                  }
                                  className="flex items-center justify-center rounded-2xl border border-white/5 bg-[#1e1e20] p-2 text-white/70 transition hover:text-white/90"
                                >
                                  <Phone className="w-4 h-4 stroke-[1.5]" />
                                </button>
                                {callMenuTarget === s.id && (
                                  <div
                                    data-call-menu="true"
                                    className="absolute bottom-full -right-10 w-44 -translate-y-2 rounded-2xl border border-white/30 bg-[#0d0d11] p-2 shadow-2xl"
                                    style={{ zIndex: Z_INDEX.modal }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      {contactOptions.map((option) => (
                                        <button
                                          key={`${option.type}-${s.id}`}
                                          type="button"
                                          onClick={() => handleCallSelection(s, option.type)}
                                          className="w-full rounded-xl px-3 py-2 text-left text-[14px] font-semibold text-white/70 transition hover:text-white"
                                        >
                                          <span className="text-[14px] uppercase tracking-[0.2em] text-white/40">
                                            {option.label}
                                          </span>
                                          <span className="block text-sm font-bold text-white">
                                            {option.display}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* SMS Button */}
                            <button
                              onClick={() => handleOpenSmsModal(s, 'visit')}
                              className="flex-shrink-0 h-[34px] flex items-center justify-center rounded-2xl border border-white/5 bg-[#1e1e20] p-2 text-white/70 transition hover:text-white/90"
                            >
                              <MessageCircle className="w-4 h-4 stroke-[1.5]" />
                            </button>

                            {/* Weather Button */}
                            <button
                              onClick={() => fetchWeatherData(s)}
                              className="flex-shrink-0 h-[34px] flex items-center justify-center rounded-2xl border border-white/5 bg-[#1e1e20] p-2 text-white/70 transition hover:text-white/90"
                            >
                              <CloudRain className="w-4 h-4 stroke-[1.5]" />
                            </button>

                            {/* Map Button (Updated) */}
                            <button
                              disabled={!hasLocation}
                              onClick={() => handleOpenMap(s)}
                              className={`flex-shrink-0 h-[34px] flex items-center justify-center rounded-2xl border bg-[#1e1e20] p-2 transition hover:text-white/90 ${hasCoordinates ? 'border-[#6c63ff] text-[#6c63ff] shadow-[0_0_10px_rgba(108,99,255,0.3)]' : 'border-white/5 text-white/70'}`}
                            >
                              <MapIcon className="w-4 h-4 stroke-[1.5]" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {hasDeadlineItems && (
              // (Deadline Section 기존 유지)
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold uppercase tracking-[0.1em] text-white/40">
                    마감일 {filteredDeadlines.length}건
                  </h2>
                </div>
                <div className="rounded-[32px] border border-white/5 bg-[#111116] shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
                  {filteredDeadlines.map((s) => {
                    const netLoss = (s.benefit ?? 0) + (s.income ?? 0) - (s.cost ?? 0);
                    const deadlineLabel = formatDeadlineLabel(s.dead, today);
                    return (
                      <div
                        key={s.id}
                        className="flex flex-col gap-3 border-b border-white/[0.05] px-5 py-5 last:border-none"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {deadlineLabel && (
                                  <span className="rounded-full bg-red-900 px-2.5 py-0.5 text-[13px] font-bold uppercase tracking-[0.2em] text-white">
                                    {deadlineLabel}
                                  </span>
                                )}
                                <span className="text-[14px] font-bold text-white/60 uppercase">
                                  {s.platform}
                                </span>
                                {s.paybackExpected && (
                                  <span className="flex items-center gap-1 text-[14px] font-bold text-[#8a72ff]">
                                    <AlertCircle className="w-2.5 h-2.5 translate-y-[-1px]" />{' '}
                                    환급금
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-2 text-base font-bold text-white/90 truncate pr-6">
                                {s.title}
                              </h3>
                            </div>
                            <button
                              onClick={() => {
                                setEditingScheduleId(s.id);
                                setIsModalVisible(true);
                              }}
                              className="p-1 text-white/20 hover:text-white shrink-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-bold text-white">
                            {formatCurrency(netLoss)}원
                          </span>
                          <div className="flex rounded-2xl border border-white/10 bg-[#0f0f12]">
                            <button
                              onClick={() => handleOpenSmsModal(s, 'deadline')}
                              className="p-2 text-white/70 transition hover:text-white"
                            >
                              <MessageCircle className="w-4 h-4 stroke-[1.5]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
        <div className="flex justify-center">
          <Link
            href="/?page=home"
            className="inline-flex items-center gap-2 rounded-[28px] border border-white/20 bg-white/5 px-6 py-3 text-base font-black text-white transition hover:border-white/40 hover:bg-white/10"
          >
            모든 일정 보러가기 <ChevronRight className="w-4 h-4 text-white/90" />
          </Link>
        </div>
      </div>

      {/* --- Map Modal (신규 추가) --- */}
      {/* --- Map Modal (네이버 지도 버튼 추가됨) --- */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#121214] border-white/10 text-white rounded-[2.5rem] p-0 outline-none shadow-2xl overflow-hidden max-w-sm"
        >
          {mapTarget && (
            <div className="relative w-full h-[450px]">
              {/* 1. 미리보기: 카카오맵 (그대로 유지) */}
              <Map
                center={{ lat: mapTarget.lat, lng: mapTarget.lng }}
                style={{ width: '100%', height: '100%' }}
                level={3}
              >
                <MapMarker position={{ lat: mapTarget.lat, lng: mapTarget.lng }}>
                  {/* 마커 타이틀 */}
                  <div
                    style={{
                      color: '#000',
                      padding: '5px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mapTarget.title}
                  </div>
                </MapMarker>
              </Map>

              {/* 상단 닫기 바 */}
              <div
                className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 bg-gradient-to-b from-black/60 to-transparent"
                style={{ zIndex: Z_INDEX.modal }}
              >
                <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <p className="text-sm font-bold text-white/90">{mapTarget.title}</p>
                </div>
                <button
                  onClick={() => setIsMapModalOpen(false)}
                  className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2. 하단 액션 버튼 (네이버 / 카카오 선택) */}
              <div
                className="absolute bottom-4 left-4 right-4 flex flex-col gap-2"
                style={{ zIndex: Z_INDEX.modal }}
              >
                {/* 네이버 지도 버튼 */}
                <Button
                  onClick={() => {
                    // 모바일: 네이버 지도 앱 스킴 사용 (좌표 기준)
                    // PC/Web Fallback: 네이버 지도 웹사이트 (query 검색)
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                    if (isMobile) {
                      // nmap://map?lat={}&lng={} 등은 단순히 중심점만 이동시킵니다.
                      // nmap://search?query={} 가 핀을 찍어주므로 더 유용할 수 있으나,
                      // 정확한 좌표 마커를 원하시면 nmap://map 을 쓰되, 사용자가 직접 핀을 봐야 합니다.
                      // 여기서는 검색어와 좌표를 조합하거나, 가장 안전한 웹 URL 방식을 추천합니다.

                      // 방법 A: 네이버 앱으로 직접 좌표 이동 (앱이 깔려있어야 함)
                      window.location.href = `nmap://map?lat=${mapTarget.lat}&lng=${mapTarget.lng}&zoom=15&appname=reviewflow`;
                    } else {
                      // PC에서는 웹사이트로 이동
                      // lng, lat 순서 주의 (네이버 웹 파라미터)
                      window.open(
                        `https://map.naver.com/v5/?c=${mapTarget.lng},${mapTarget.lat},15,0,0,0,dh`,
                        '_blank'
                      );
                    }
                  }}
                  className="w-full bg-[#03C75A] hover:bg-[#02b351] text-white font-bold rounded-2xl py-6 shadow-lg flex items-center justify-center gap-2 text-md"
                >
                  <span className="font-extrabold text-lg">N</span> 네이버 지도로 열기
                </Button>

                {/* 카카오맵 버튼 */}
                <Button
                  onClick={() =>
                    window.open(
                      `https://map.kakao.com/link/map/${mapTarget.title},${mapTarget.lat},${mapTarget.lng}`,
                      '_blank'
                    )
                  }
                  className="w-full bg-[#fae100] hover:bg-[#ebd300] text-[#3b1e1e] font-bold rounded-2xl py-6 shadow-lg flex items-center justify-center gap-2 text-md"
                >
                  <MapIcon className="w-5 h-5" /> 카카오맵으로 열기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Weather Modal, SMS Modal, Schedule Modal (기존 코드 유지) */}
      <Dialog open={isWeatherModalOpen} onOpenChange={setIsWeatherModalOpen}>
        {/* ... 날씨 모달 내용 ... (위 코드와 동일) */}
        <DialogContent
          showCloseButton={false}
          className="bg-[#121214] border-white/10 text-white rounded-[2.5rem] p-6 outline-none shadow-2xl max-w-sm"
        >
          <DialogHeader className="space-y-4 mb-2">
            <div className="flex justify-between items-center w-full">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <span className="text-2xl">🌦️</span> 7일 예보
              </DialogTitle>
              <button
                onClick={() => setIsWeatherModalOpen(false)}
                className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-white/50 bg-white/5 p-3 rounded-2xl">
              <MapPin className="w-4 h-4" /> <span>{weatherLocationName}</span>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            {weatherLoading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-white/40">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">날씨 정보를 불러오는 중...</span>
              </div>
            ) : weatherData ? (
              <div className="grid gap-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                {weatherData.map((day) => {
                  const isVisitDay = day.date === weatherTargetDate;
                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isVisitDay ? 'bg-[#1e1e24] border-[#6c63ff] shadow-[0_0_15px_rgba(108,99,255,0.2)]' : 'bg-white/[0.03] border-white/5'}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${isVisitDay ? 'text-[#6c63ff]' : 'text-white'}`}
                          >
                            {day.date}
                          </span>
                          {isVisitDay && (
                            <span className="text-[10px] bg-[#6c63ff] text-white px-1.5 py-0.5 rounded-full font-bold">
                              방문일
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-white/50">
                          {getWeatherDescription(day.code)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end text-sm">
                          <span className="text-red-400 font-bold">{day.maxTemp}°</span>
                          <span className="text-blue-400 font-bold">{day.minTemp}°</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-white/30 text-sm">
                날씨 정보를 불러올 수 없습니다.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS & Edit Modal 생략 (기존과 동일) */}
      <Dialog open={isSmsModalOpen} onOpenChange={setIsSmsModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#121214] border-white/10 text-white rounded-[2.5rem] p-6 outline-none shadow-2xl"
        >
          <DialogHeader className="space-y-2">
            <div className="flex justify-between items-center w-full">
              <DialogTitle className="text-xl font-bold tracking-tight"></DialogTitle>
              <button
                onClick={() => setIsSmsModalOpen(false)}
                className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>
          <div className="space-y-6">
            {/* SMS Content ... */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-black uppercase tracking-[0.1em] text-white/50">
                  {smsType === 'visit' ? '방문형 메시지' : '마감형 메시지'}
                </p>
              </div>
              {templates.length > 0 && activeTemplate ? (
                <div className="space-y-3">
                  <div className="flex gap-2 rounded-2xl bg-white/5 p-1">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold uppercase transition ${template.id === activeTemplate.id ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-white/40">
                  템플릿을 불러오는 중입니다.
                </div>
              )}
            </div>
            <div className="relative space-y-3">
              <Textarea
                value={customSmsBody}
                onChange={(e) => setCustomSmsBody(e.target.value)}
                className="min-h-[140px] bg-white/[0.03] border-white/10 rounded-2xl p-4 pr-12 text-sm leading-relaxed text-white/80 focus:ring-[#5c3dff] focus:border-[#5c3dff] resize-none"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(customSmsBody);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                  toast({ title: '메시지 복사 완료' });
                }}
                className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg text-white/40 active:scale-90 transition-all"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <Button
              disabled={!cleanPhoneNumber(smsTarget?.ownerPhone || smsTarget?.phone)}
              onClick={() => {
                sendSms(smsTarget?.ownerPhone || smsTarget?.phone || '', customSmsBody);
                setIsSmsModalOpen(false);
              }}
              className="w-full py-5 bg-white text-black rounded-2xl font-bold shadow-xl active:scale-95 disabled:bg-white/10 disabled:text-white/30 transition-all"
            >
              {cleanPhoneNumber(smsTarget?.ownerPhone || smsTarget?.phone) ? (
                <>
                  <Send className="w-5 h-5" /> 문자 발송하러 가기
                </>
              ) : (
                '연락처 등록 후 발송'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isModalVisible && editingSchedule && (
        <ScheduleModal
          isOpen={isModalVisible}
          onClose={() => {
            setIsModalVisible(false);
            clearReceiptFocus();
          }}
          onSave={async (s) => {
            await updateSchedule(s.id, s);
            setIsModalVisible(false);
            return true;
          }}
          onDelete={async (id) => {
            await deleteSchedule(id);
            setIsModalVisible(false);
          }}
          schedule={editingSchedule}
          onUpdateFiles={handleUpdateScheduleFiles}
          focusGuideFiles={receiptFocusScheduleId === editingSchedule.id}
          onGuideFilesFocusDone={clearReceiptFocus}
        />
      )}
      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReceiptFileSelected}
      />
    </div>
  );
}
