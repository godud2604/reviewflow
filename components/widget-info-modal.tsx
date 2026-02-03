'use client';

import { useMemo } from 'react';
import { Megaphone, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type WidgetInfoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function WidgetInfoModal({ open, onOpenChange }: WidgetInfoModalProps) {
  const router = useRouter();
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

  const handleReportIssue = () => {
    const prefill = [
      '[위젯 동기화 관련 문의/오류]',
      '기기/모델: ',
      'OS 버전: ',
      '앱 버전: ',
      '현상: ',
    ].join('\n');

    const params = new URLSearchParams();
    params.set('page', 'profile');
    params.set('feedback', '1');
    params.set('feedbackType', 'bug');
    params.set('feedbackPrefill', prefill);

    onOpenChange(false);
    router.push(`/?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="widget-info-modal"
        showCloseButton={false}
        className="max-w-[420px] w-[calc(100%-2rem)] p-0 border-0 bg-transparent shadow-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>위젯 추가 안내</DialogTitle>
          <DialogDescription>위젯 안내 및 FAQ를 확인하세요.</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl bg-white border border-neutral-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#FF5722]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[20px] font-bold tracking-[-0.02em] text-neutral-900">
                    위젯 추가 안내
                  </h2>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    달력 위젯이 새롭게 추가되었어요.
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
          </div>

          <div className="mt-5 flex-1 min-h-0 overflow-y-auto px-6 pb-5 text-[14px] leading-relaxed text-neutral-800 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="text-[13px] font-semibold text-neutral-700">위젯 추가 방법</div>
                <p className="text-[13px] text-neutral-500">
                  {platform === 'ios'
                    ? 'App Store에서 최신 버전으로 업데이트해주세요.'
                    : platform === 'android'
                      ? 'Play 스토어에서 최신 버전으로 업데이트해주세요.'
                      : '스토어에서 최신 버전으로 업데이트해주세요.'}
                </p>
                <div className="mt-2 space-y-3 text-[13px] text-neutral-700">
                  <div className="space-y-1">
                    <div className="font-semibold text-neutral-800">iOS</div>
                    <ol className="list-decimal pl-5 space-y-1 text-neutral-600">
                      <li>홈 화면을 꾹 누르고 ‘편집’ 클릭</li>
                      <li>위젯 추가 → ‘리뷰플로우’ 검색</li>
                      <li>원하는 위젯을 추가</li>
                    </ol>
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-neutral-800">Android</div>
                    <ol className="list-decimal pl-5 space-y-1 text-neutral-600">
                      <li>홈 화면을 꾹 누르고 ‘위젯’ 클릭</li>
                      <li>‘리뷰플로우’ 검색</li>
                      <li>원하는 위젯을 추가</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-[13px] font-semibold text-neutral-700">QnA</div>
                <div className="mt-2 space-y-2 text-[13px] text-neutral-700">
                  <div className="space-y-1">
                    <div className="font-semibold text-neutral-800">
                      Q. 위젯 동기화를 하라는 문구가 떠요. 동기화는 어떻게 해요?
                    </div>
                    <div className="text-neutral-600">A. 로그아웃 후, 다시 로그인을 해주세요.</div>
                    <div className="text-neutral-600">
                      만약 다시 로그인을 했는데도 동일한 문구가 뜬다면, 아래{' '}
                      <span className="font-semibold text-neutral-800">피드백/오류신고</span> 버튼을
                      클릭해서 <span className="font-semibold text-neutral-800">기기/모델</span>을
                      작성해서 제출해주세요. 빠르게 조치하겠습니다.
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-[12px] text-orange-900/90">
                  현재 갤럭시 울트라25에서 위젯 관련 오류가 있어서 빠르게 수정중이오니 해당 기기를
                  사용중인 분들은 조금만 기다려주세요. 죄송합니다.
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full rounded-2xl bg-[#FF5722] text-white hover:bg-[#E64A19]"
                onClick={handleGoStore}
                disabled={!storeUrl}
              >
                업데이트하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
                onClick={handleReportIssue}
              >
                피드백/오류신고
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
