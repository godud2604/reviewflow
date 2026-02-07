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

const WIDGET_UPDATE_MODAL_KEY = 'widget-update-modal-v2-dismissed';

export default function WidgetUpdateModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(WIDGET_UPDATE_MODAL_KEY);
    if (!dismissed) {
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
            위젯 기능이 업데이트되었어요!
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-neutral-700">
            위젯 달력/리스트가 개선되어
            <br />
            방문 일정과 마감일을 리스트로 볼 수 있어요.
            <br />
            <span className="font-semibold text-orange-600">
              스토어에서 최신 버전으로 업데이트해주세요.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-2xl border border-orange-100 bg-white/70 p-4 backdrop-blur-sm">
          <div className="space-y-2">
            <p className="text-[13px] font-bold text-neutral-900">업데이트 내용</p>
            <div className="space-y-1.5 pl-2 text-[12px] text-neutral-600">
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-600">1</span>
                <span>위젯 달력 개선</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-orange-600">2</span>
                <span>위젯에서 방문 일정, 마감일을 리스트로 확인</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 pt-2">
         
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
