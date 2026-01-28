'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ProToFreeTransitionModalProps = {
  open: boolean;
  onDismiss: () => void;
};

export default function ProToFreeTransitionModal({ open, onDismiss }: ProToFreeTransitionModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] rounded-[24px] p-6"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onDismiss}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="space-y-3 pr-8 text-left">
          <DialogTitle className="text-[18px] font-bold text-neutral-900">
            리뷰플로우가 더 편해집니다
          </DialogTitle>
          <div className="text-[14px] leading-relaxed text-neutral-700 whitespace-pre-line">
            {`리뷰플로우는 지금,
체험단 관리에 더 집중하기 위해
운영 방식을 조금 정리하고 있어요.

당분간은
Free / Pro 구분 없이
모든 핵심 기능을 무료로 제공합니다.

기존 이벤트로 받으신 혜택은
모두 그대로 유지됩니다.`}
          </div>
        </DialogHeader>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl text-sm font-semibold"
            onClick={() => router.push('/notice')}
          >
            자세히 보기
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-black"
            onClick={onDismiss}
          >
            확인했어요
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
