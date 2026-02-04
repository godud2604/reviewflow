'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const WIDGET_UPDATE_MODAL_KEY = 'widget-update-modal-dismissed';

export default function WidgetUpdateModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 로컬스토리지에서 닫은 적이 있는지 확인
    const dismissed = localStorage.getItem(WIDGET_UPDATE_MODAL_KEY);
    if (!dismissed) {
      // 약간의 딜레이 후 모달 표시 (UX 개선)
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    // 로컬스토리지에 저장하여 다시 안 뜨도록 설정
    localStorage.setItem(WIDGET_UPDATE_MODAL_KEY, 'true');
    setIsOpen(false);
  };

  const handleOpenStore = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIos) {
      window.open('https://apps.apple.com/kr/app/reviewflow/id6757174544', '_blank');
    } else if (isAndroid) {
      window.open(
        'https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow',
        '_blank'
      );
    } else {
      // 데스크톱에서는 둘 다 보여주기
      window.open('https://apps.apple.com/kr/app/reviewflow/id6757174544', '_blank');
    }
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[340px] rounded-3xl border border-orange-200 bg-gradient-to-b from-white to-orange-50/30 shadow-2xl">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-3xl shadow-lg">
            🎉
          </div>
          <DialogTitle className="text-[20px] font-bold text-neutral-900">
            홈 화면 위젯이 추가되었어요!
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-neutral-700">
            일정을 한눈에 확인할 수 있는 홈 화면 위젯이 추가되었습니다.
            <br />
            <span className="font-semibold text-orange-600">
              스토어에서 최신 버전으로 업데이트해주세요.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-2xl border border-orange-100 bg-white/70 p-4 backdrop-blur-sm">
          <div className="space-y-2">
            <p className="text-[13px] font-bold text-neutral-900">
              🌟 갤럭시 위젯 동기화 문제 해결됨!
            </p>
            <div className="space-y-1.5 pl-2 text-[12px] text-neutral-600">
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-600">1️⃣</span>
                <span>
                  기존 위젯 삭제 후 다시 추가
                  <br />→ 앱 재로그인
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-600">2️⃣</span>
                <span>그래도 동기화가 안 된다면, 피드백 {'>'} 오류 신고로 문의해주세요.</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleOpenStore}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-[15px] font-bold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700"
          >
            스토어에서 업데이트하기
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="h-10 w-full rounded-xl text-[13px] font-semibold text-neutral-600 hover:bg-neutral-100"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
