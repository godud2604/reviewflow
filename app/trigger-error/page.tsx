'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TriggerErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('의도적으로 발생시킨 클라이언트 오류');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">클라이언트 오류 트리거</h1>
      <p className="text-sm text-muted-foreground">
        버튼을 누르면 `app/error.tsx`가 렌더링되면서 구글챗으로 알림이 전송됩니다.
      </p>
      <Button
        variant="destructive"
        onClick={() => setShouldThrow(true)}
        className="px-8"
      >
        오류 발생
      </Button>
    </div>
  );
}
