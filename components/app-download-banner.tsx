'use client';

import { useEffect, useState } from 'react';
import { Z_INDEX } from '@/lib/z-index';
import { useAuth } from '@/hooks/use-auth';
import { APP_LAUNCH_EVENT } from '@/lib/app-launch';

const IOS_APP_STORE_URL = 'https://apps.apple.com/kr/app/reviewflow/id6757174544';
const BANNER_DISMISS_KEY = 'app_download_banner_dismissed';

export default function AppDownloadBanner() {
  const { isAuthenticated, loading: authLoading, session } = useAuth();
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [androidEmail, setAndroidEmail] = useState('');
  const [androidConsent, setAndroidConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  const [isManuallyOpen, setIsManuallyOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(BANNER_DISMISS_KEY);
    setIsDismissed(storedValue === 'true');
  }, []);

  useEffect(() => {
    const handleManualOpen = () => {
      setMessage(null);
      setIsAndroidModalOpen(false);
      setIsManuallyOpen(true);
      setIsDismissed(false);
    };

    window.addEventListener(APP_LAUNCH_EVENT, handleManualOpen);
    return () => {
      window.removeEventListener(APP_LAUNCH_EVENT, handleManualOpen);
    };
  }, []);

  const handleOpenAndroidModal = () => {
    setMessage(null);
    setIsAndroidModalOpen(true);
  };

  const handleCloseAndroidModal = () => {
    setIsAndroidModalOpen(false);
  };

  const handleDismissBanner = () => {
    window.localStorage.setItem(BANNER_DISMISS_KEY, 'true');
    setIsDismissed(true);
    setIsAndroidModalOpen(false);
    setIsManuallyOpen(false);
  };

  const handleAndroidSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!androidEmail.trim().toLowerCase().endsWith('@gmail.com')) {
      window.alert('안내를 위해 Google 계정(gmail.com) 이메일로 입력 부탁드려요.');
      return;
    }

    if (!androidConsent) {
      setMessage({ type: 'error', text: '테스트 초대용 안내에 동의해주세요.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/android-waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ email: androidEmail }),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `곧 설치 링크를 메일로 보내드릴게요! (${androidEmail})`,
        });
        setAndroidEmail('');
        setAndroidConsent(false);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data?.error ?? '등록에 실패했어요. 다시 시도해주세요.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다. 다시 시도해주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const shouldHideBanner = (isDismissed === null || isDismissed) && !isManuallyOpen;

  if (shouldHideBanner) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center px-4"
        style={{ zIndex: Z_INDEX.topLayer }}
      >
        <div className="max-w-md w-full">
          <div className="bg-white border border-neutral-200 rounded-3xl px-5 py-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                <span className="mr-2">🍎</span>
                iOS 정식 출시
              </div>
              <button
                onClick={handleDismissBanner}
                className="h-11 w-11 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition"
                aria-label="팝업 닫기"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-1 text-[15px] md:text-lg font-semibold text-neutral-900 leading-snug">
              지금 리뷰플로우 앱을 바로 받아보세요
            </div>
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <a
                href={IOS_APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white text-xs md:text-sm font-semibold px-4.5 py-2.5 shadow-sm hover:bg-neutral-800 transition"
              >
                App Store에서 받기
              </a>
              <button
                onClick={handleOpenAndroidModal}
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 text-neutral-800 text-xs md:text-sm font-semibold px-4.5 py-2.5 hover:bg-neutral-50 transition cursor-pointer"
              >
                안드로이드 제일 먼저 써보기
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAndroidModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-5"
          onClick={handleCloseAndroidModal}
          style={{ zIndex: Z_INDEX.topLayer }}
        >
          <div
            className="w-90 max-w-sm bg-white rounded-2xl p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-neutral-500 mb-1">
                  안드로이드 제일 먼저 써보기
                </p>
                <h3 className="text-lg font-bold text-neutral-900 leading-tight">
                  설치 링크를 보내드릴게요
                </h3>
              </div>
              <button
                onClick={handleCloseAndroidModal}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleAndroidSubmit}>
              <input
                type="email"
                placeholder="Google 계정 이메일 (gmail.com)"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                required
                value={androidEmail}
                onChange={(event) => setAndroidEmail(event.target.value)}
                disabled={isSubmitting}
              />
              <label className="flex items-start gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={androidConsent}
                  onChange={(event) => setAndroidConsent(event.target.checked)}
                  disabled={isSubmitting}
                  required
                />
                설치 링크 안내를 위해 이메일 제공에 동의해요.
              </label>
              <button
                type="submit"
                className="w-full bg-neutral-900 text-white py-3 rounded-xl text-sm font-semibold shadow-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                disabled={isSubmitting}
              >
                {isSubmitting ? '등록 중...' : '설치 링크 받기'}
              </button>
            </form>
            {message && (
              <div
                className={`mt-3 px-3 py-2 rounded-lg text-xs ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              신청하면 내부 테스트 설치 링크를 보내드려요.
            </div>
            <p className="ml-1 mt-2 text-[12px] text-neutral-500">
              * 내부 테스트로 설치해도, 정식 출시 후 재설치하지 않아도 돼요. (앱/기능 동일)
            </p>
          </div>
        </div>
      )}
    </>
  );
}
