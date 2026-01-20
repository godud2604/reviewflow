'use client';

import { useEffect, useState } from 'react';
import { Z_INDEX } from '@/lib/z-index';
import { useAuth } from '@/hooks/use-auth';
import { APP_LAUNCH_EVENT } from '@/lib/app-launch';

const IOS_APP_STORE_URL = 'https://apps.apple.com/kr/app/reviewflow/id6757174544';
const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow';
const BANNER_DISMISS_KEY = 'app_download_banner_dismissed';

export default function AppDownloadBanner() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  const [isManuallyOpen, setIsManuallyOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(BANNER_DISMISS_KEY);
    setIsDismissed(storedValue === 'true');
  }, []);

  useEffect(() => {
    const handleManualOpen = () => {
      setIsManuallyOpen(true);
      setIsDismissed(false);
    };

    window.addEventListener(APP_LAUNCH_EVENT, handleManualOpen);
    return () => {
      window.removeEventListener(APP_LAUNCH_EVENT, handleManualOpen);
    };
  }, []);

  const handleDismissBanner = () => {
    window.localStorage.setItem(BANNER_DISMISS_KEY, 'true');
    setIsDismissed(true);
    setIsManuallyOpen(false);
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
                <span className="mr-2">📲</span>
                iOS · Android 출시
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
              <a
                href={ANDROID_PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-neutral-300 text-neutral-800 text-xs md:text-sm font-semibold px-4.5 py-2.5 hover:bg-neutral-50 transition"
              >
                Google Play에서 받기
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
