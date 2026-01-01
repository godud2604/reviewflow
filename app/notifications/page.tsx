'use client';

import { useState, useEffect, useRef } from 'react'; // ✅ useRef 추가
import { useAuth } from '@/hooks/use-auth';

import { ChevronLeft, Clock, Smartphone, BellRing, X, RefreshCw, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';

import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// --- Helper Functions ---
const cleanPhoneNumber = (phone?: string) => phone?.replace(/[^0-9]/g, '') || '';
const formatPhoneInput = (value: string) => {
  const digits = cleanPhoneNumber(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

const formatTimeInputValue = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const QUICK_TIME_OPTIONS = ['08:00', '08:30', '09:00', '09:30'];
const ALL_TIME_OPTIONS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'] as const;

const ALIMTALK_ALLOWED_EMAILS = new Set([
  'ees238@kakao.com',
  'ees238@naver.com',
  'korea690105@naver.com',
]);

export default function NotificationsPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- State ---
  const [savedPhoneNumber, setSavedPhoneNumber] = useState<string | null>(null);

  const [phoneInput, setPhoneInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(false);
  const [dailySummaryTime, setDailySummaryTime] = useState(formatTimeInputValue(8, 0));

  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // ✅ [Double Click Prevention] 중복 전송 방지를 위한 락(Lock)
  const sendLock = useRef(false);

  const isAlimtalkVisible = ALIMTALK_ALLOWED_EMAILS.has(user?.email ?? '');

  // --- Effects ---

  useEffect(() => {
    if (!user?.id) {
      if (user === null) setIsProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setIsProfileLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select(
          'phone_number, phone_verified_at, daily_summary_enabled, daily_summary_hour, daily_summary_minute'
        )
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('알림 설정 로딩 실패:', error);
        setIsProfileLoading(false);
        return;
      }

      const dbPhone = data?.phone_number ? formatPhoneInput(data.phone_number) : '';
      setSavedPhoneNumber(dbPhone);
      setPhoneVerifiedAt(data?.phone_verified_at ?? null);

      setPhoneInput(dbPhone);

      if (dbPhone) {
        setIsEditingPhone(false);
      } else {
        setIsEditingPhone(true);
      }

      setDailySummaryEnabled(Boolean(data?.daily_summary_enabled));
      const hour = data?.daily_summary_hour ?? 8;
      const minute = data?.daily_summary_minute ?? 0;
      setDailySummaryTime(formatTimeInputValue(hour, minute));

      setTimeout(() => setIsProfileLoading(false), 300);
    };

    fetchProfile();
  }, [user?.id, user]);

  useEffect(() => {
    if (!verificationExpiresAt) {
      setRemainingSeconds(null);
      return;
    }
    const expiresAt = new Date(verificationExpiresAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [verificationExpiresAt]);

  // --- Handlers ---
  const parseTimeValue = (value: string) => {
    const [hourText, minuteText] = value.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);
    return { hour, minute };
  };

  const updateDailySummarySettings = async (next: Partial<{ enabled: boolean; time: string }>) => {
    if (!user?.id) return false;
    const supabase = getSupabaseClient();
    const timeValue = next.time ?? dailySummaryTime;
    const { hour, minute } = parseTimeValue(timeValue);
    const enabled = next.enabled ?? dailySummaryEnabled;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        daily_summary_enabled: enabled,
        daily_summary_hour: hour,
        daily_summary_minute: minute,
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: '설정 저장 실패', variant: 'destructive', duration: 1000 });
      return false;
    }
    return true;
  };

  const handleStartChange = () => {
    setIsEditingPhone(true);
    setPhoneInput('');
    setVerificationCode('');
    setVerificationExpiresAt(null);
  };

  const handleCancelChange = () => {
    setIsEditingPhone(false);
    setPhoneInput(savedPhoneNumber ?? '');
    setVerificationCode('');
    setVerificationExpiresAt(null);
  };

  const handleSendVerification = async () => {
    if (!session?.access_token) return;

    // ✅ [Debounce Logic] 이미 전송 중이면 클릭 무시 (즉시 차단)
    if (sendLock.current) return;
    sendLock.current = true; // 락 걸기

    const cleaned = cleanPhoneNumber(phoneInput);
    if (!cleaned) {
      toast({ title: '휴대폰 번호를 입력해주세요.', variant: 'destructive', duration: 1000 });
      sendLock.current = false; // 실패 시 락 해제
      return;
    }
    if (savedPhoneNumber && cleaned === cleanPhoneNumber(savedPhoneNumber)) {
      toast({
        title: '현재 등록된 번호와 동일합니다.',
        description: '새로운 번호를 입력해주세요.',
        duration: 1000,
      });
      sendLock.current = false; // 실패 시 락 해제
      return;
    }

    try {
      setIsSendingCode(true); // UI 상태 업데이트
      setVerificationCode('');

      const res = await fetch('/api/notifications/phone/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '전송 실패');

      if (data?.expiresAt) setVerificationExpiresAt(String(data.expiresAt));
      toast({
        title: '인증번호가 발송되었습니다.',
        description: '문자를 확인해주세요.',
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: '전송 실패',
        description: error instanceof Error ? error.message : '오류가 발생했습니다.',
        variant: 'destructive',
        duration: 1000,
      });
    } finally {
      setIsSendingCode(false);
      sendLock.current = false; // ✅ API 응답 후 락 해제 (다시 클릭 가능)
    }
  };

  const handleVerifyCode = async () => {
    if (!session?.access_token) return;
    if (!verificationCode.trim()) {
      toast({ title: '인증번호를 입력해주세요.', variant: 'destructive', duration: 1000 });
      return;
    }

    try {
      setIsVerifyingCode(true);
      const res = await fetch('/api/notifications/phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '인증 실패');

      const newPhone = formatPhoneInput(String(data.phoneNumber));
      setSavedPhoneNumber(newPhone);
      setPhoneInput(newPhone);
      setPhoneVerifiedAt(new Date().toISOString());
      setIsEditingPhone(false);
      setVerificationExpiresAt(null);
      setVerificationCode('');

      if (!dailySummaryEnabled) {
        setDailySummaryEnabled(true);
        await updateDailySummarySettings({ enabled: true });
      }

      toast({
        title: '번호 변경 완료!',
        description: '이제 새로운 번호로 알림을 받습니다.',
        className: 'bg-orange-50 border-orange-200 text-orange-800',
        duration: 1000,
      });
    } catch (error) {
      toast({
        title: '인증 실패',
        description: '인증번호를 다시 확인해주세요.',
        variant: 'destructive',
        duration: 1000,
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleToggleDailySummary = async (nextEnabled: boolean) => {
    const previous = dailySummaryEnabled;
    setDailySummaryEnabled(nextEnabled);
    const saved = await updateDailySummarySettings({ enabled: nextEnabled });

    if (saved) {
      if (nextEnabled) {
        toast({
          title: '알림이 켜졌어요 ☀️',
          description: '방문・마감 일정이 있는 날 아침에 보내드릴게요.',
          className: 'bg-orange-50 border-orange-200 text-orange-800',
          duration: 1000,
        });
      } else {
        toast({
          title: '알림이 꺼졌어요',
          description: '더 이상 아침 요약 알림을 보내지 않습니다.',
          duration: 1000,
        });
      }
    } else {
      setDailySummaryEnabled(previous);
    }
  };

  const handleDailySummaryTimeChange = async (value: string) => {
    setDailySummaryTime(value);
    const saved = await updateDailySummarySettings({ time: value });

    if (saved) {
      toast({
        title: '알림 시간이 변경되었어요',
        description: `이제 일정이 있는 날 [${value}]에 알려드릴게요.`,
        className: 'bg-orange-50 border-orange-200 text-orange-800',
        duration: 1000,
      });
    }
  };

  const formatRemainingTime = (seconds: number | null) => {
    if (seconds === null) return '';
    const minutes = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const isVerificationExpired = remainingSeconds === 0;
  const isVerificationSent = Boolean(verificationExpiresAt);
  const isViewMode = !!savedPhoneNumber && !isEditingPhone;

  // ------------------------------------------------------------------
  // ✅ [Loading UI] 데이터 로딩 중 보여줄 스켈레톤 화면
  // ------------------------------------------------------------------
  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans tracking-tight px-2">
        <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
          <div className="mb-2 h-5 w-20 rounded bg-neutral-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-neutral-200 animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-neutral-200 animate-pulse" />
            <div className="h-8 w-1/2 rounded bg-neutral-200 animate-pulse" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-[200px] w-full rounded-[24px] bg-white border border-neutral-200 p-5 animate-pulse shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans tracking-tight px-2">
      <style jsx global>{`
        .slide-in {
          animation: slideDown 0.3s ease-out forwards;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <div className="flex items-center gap-3" onClick={() => router.push('/?page=home')}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-neutral-900">이전으로</h2>
        </div>

        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.1em] text-orange-400 font-bold">
            morning brief
          </p>
          <h1 className="text-[14px] font-bold text-neutral-800">
            방문, 마감 일정 또는 마감 초과가 있는 날<br />
            아침에 <span className="text-orange-400">카카오 알림톡</span>으로 요약해드려요.
          </h1>
        </header>

        {isAlimtalkVisible && (
          <div className="flex flex-col gap-4">
            {/* 1. 휴대폰 인증/관리 카드 */}
            <section
              className={cn(
                'relative overflow-hidden rounded-[24px] bg-white p-5 shadow-sm border transition-all duration-300',
                isViewMode ? 'border-orange-200 ring-1 ring-orange-50' : 'border-neutral-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isViewMode
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-neutral-100 text-neutral-500'
                    )}
                  >
                    <Smartphone size={16} />
                  </div>
                  <h2 className="text-[16px] font-bold text-neutral-800">휴대폰 번호</h2>
                </div>
                {isViewMode && (
                  <span className="text-[13px] font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                    인증됨
                  </span>
                )}
              </div>

              {/* A. 보기 모드 */}
              {isViewMode ? (
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-100 p-3">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold text-neutral-800 tracking-wide">
                      {savedPhoneNumber}
                    </span>
                    <span className="text-[14px] text-neutral-400">
                      현재 알림을 받고 있는 번호입니다.
                    </span>
                  </div>
                  <Button
                    onClick={handleStartChange}
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-white border border-transparent hover:border-neutral-200 hover:shadow-sm"
                  >
                    <RefreshCw size={14} className="mr-1.5" /> 변경
                  </Button>
                </div>
              ) : (
                /* B. 편집/입력 모드 */
                <div className="space-y-3">
                  {/* 안내 문구 */}
                  <p className="text-[15px] text-orange-600 font-medium">
                    📢 휴대폰 번호를 등록해야 카카오 알림톡 설정을 켤 수 있어요.
                  </p>

                  {savedPhoneNumber && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg bg-orange-50 p-2 text-[11px] text-orange-700">
                      <div className="mt-0.5">
                        <BellRing size={12} />
                      </div>
                      <div className="flex-1 text-[14px]">
                        새 번호 인증을 완료하기 전까지는
                        <br />
                        기존 번호 <strong>{savedPhoneNumber}</strong>(으)로 알림이 발송됩니다.
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(formatPhoneInput(e.target.value))}
                      placeholder="새 휴대폰 번호 입력"
                      disabled={isSendingCode || (isVerificationSent && !isVerificationExpired)}
                      autoFocus
                      className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[16px] outline-none focus:border-orange-500 focus:bg-white transition-all disabled:opacity-70"
                    />
                    {savedPhoneNumber && !isVerificationSent && (
                      <Button
                        onClick={handleCancelChange}
                        variant="ghost"
                        className="rounded-xl px-3 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                      >
                        <X size={18} />
                      </Button>
                    )}

                    {(!savedPhoneNumber || !isVerificationSent) && (
                      <Button
                        onClick={handleSendVerification}
                        disabled={
                          isSendingCode ||
                          !phoneInput ||
                          (isVerificationSent && !isVerificationExpired)
                        }
                        className="rounded-xl px-4 text-sm font-bold bg-neutral-900 text-white hover:bg-black shadow-none"
                      >
                        {isSendingCode ? '전송 중' : isVerificationSent ? '전송됨' : '인증요청'}
                      </Button>
                    )}
                  </div>

                  {isVerificationSent && !isViewMode && (
                    <div className="slide-in space-y-2 rounded-xl bg-white p-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-medium text-orange-600">
                          인증번호 입력
                        </span>
                        <span className="text-[11px] font-mono text-orange-600">
                          {formatRemainingTime(remainingSeconds)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          className="flex-1 rounded-lg border border-orange-200 bg-orange-50/30 px-3 py-2 text-center text-sm tracking-widest outline-none focus:ring-2 focus:ring-orange-100"
                        />
                        <Button
                          onClick={handleVerifyCode}
                          disabled={isVerifyingCode || !verificationCode}
                          className="rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 w-[70px]"
                        >
                          {isVerifyingCode ? '확인...' : '확인'}
                        </Button>
                      </div>
                      <div className="flex justify-between items-center px-1 pt-1">
                        {isVerificationExpired ? (
                          <p className="text-[11px] text-red-500">시간 초과. 다시 요청해주세요.</p>
                        ) : (
                          <p className="text-[10px] text-neutral-400">10분 이내에 입력해주세요.</p>
                        )}
                        {savedPhoneNumber && (
                          <button
                            onClick={handleCancelChange}
                            className="text-[11px] text-neutral-400 underline decoration-neutral-300 underline-offset-2"
                          >
                            변경 취소
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 2. 설정 카드 */}
            {savedPhoneNumber && (
              <section
                className={cn(
                  'slide-in rounded-[24px] border border-orange-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6 transition-opacity duration-300',
                  isEditingPhone ? 'opacity-60 pointer-events-none grayscale-[0.5]' : 'opacity-100'
                )}
              >
                {isEditingPhone && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-white/10 backdrop-blur-[1px]"></div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <BellRing size={16} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-neutral-800">요약 알림 받기</p>
                      <p className="text-[14px] text-neutral-500">
                        방문・마감 일정이 있을 때만 알림을 보내드려요.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={dailySummaryEnabled}
                    onCheckedChange={handleToggleDailySummary}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>

                <div
                  className={cn(
                    'transition-all duration-300 space-y-3 pt-2 border-t border-neutral-100',
                    dailySummaryEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  )}
                >
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-neutral-700">
                    <Clock size={14} className="text-orange-500" /> 알림 시간
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUICK_TIME_OPTIONS.map((timeValue) => (
                      <button
                        key={timeValue}
                        type="button"
                        onClick={() => handleDailySummaryTimeChange(timeValue)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-[14px] font-medium transition-all border',
                          dailySummaryTime === timeValue
                            ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm'
                            : 'bg-white border-neutral-100 text-neutral-500 hover:border-orange-200 hover:text-orange-600'
                        )}
                      >
                        {timeValue}
                      </button>
                    ))}

                    <Select value={dailySummaryTime} onValueChange={handleDailySummaryTimeChange}>
                      <SelectTrigger className="h-[30px] w-auto gap-2 rounded-full border-neutral-200 bg-white px-3 text-[14px] text-neutral-600 shadow-sm hover:border-orange-200">
                        <SelectValue placeholder="기타" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t} className="text-[14px]">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
