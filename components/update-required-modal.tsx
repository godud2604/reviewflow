'use client';

import { useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type UpdateRequiredModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string | null;
};

const IOS_APP_STORE_URL = 'https://apps.apple.com/kr/app/reviewflow/id6757174544';
const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow';

type Platform = 'ios' | 'android' | 'unknown';

const detectPlatform = (): Platform => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'unknown';
};

export default function UpdateRequiredModal({
  open,
  onOpenChange,
  userEmail,
}: UpdateRequiredModalProps) {
  // ees238@naver.com 계정에서만 테스트
  if (userEmail !== 'ees238@naver.com') {
    return null;
  }

  const platform = useMemo(() => detectPlatform(), []);
  const storeUrl =
    platform === 'ios' ? IOS_APP_STORE_URL : platform === 'android' ? ANDROID_PLAY_STORE_URL : null;

  const handleGoStore = () => {
    if (!storeUrl) return;
    try {
      window.open(storeUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = storeUrl;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="update-required-modal"
        showCloseButton={false}
        className="max-w-[360px] w-[calc(100%-2rem)] p-0 border-0 bg-transparent shadow-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>업데이트 안내</DialogTitle>
          <DialogDescription>새로운 업데이트가 반영되었습니다.</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl bg-white border border-neutral-200 px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#FF5722]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-neutral-900">
                  업데이트 안내
                </h2>
                <p className="mt-1 text-[13px] text-neutral-500">
                  새로운 업데이트가 반영되었습니다.
                </p>
              </div>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-100/70 text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogClose>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-neutral-50 px-3 py-3 space-y-2">
              <p className="text-[13px] font-semibold text-neutral-800">✨ 새로운 기능</p>
              <ul className="space-y-1 text-[13px] text-neutral-600">
                <li>• 달력 위젯 추가 (4x4, 4x2)</li>
                <li>• 갤럭시 앱 이미지 개선</li>
              </ul>
            </div>
            <p className="text-[13px] text-neutral-600">
              {platform === 'ios'
                ? 'App Store에서 최신 버전으로 업데이트해주세요.'
                : platform === 'android'
                  ? 'Play 스토어에서 최신 버전으로 업데이트해주세요.'
                  : '스토어에서 최신 버전으로 업데이트해주세요.'}
            </p>
          </div>

          <div className="mt-6">
            <Button
              type="button"
              className="w-full rounded-2xl bg-[#FF5722] text-white hover:bg-[#E64A19]"
              onClick={handleGoStore}
              disabled={!storeUrl}
            >
              업데이트하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
