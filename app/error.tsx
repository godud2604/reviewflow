'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

const REPORT_ENDPOINT = '/api/client-error';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (!error) return;

    const report = async () => {
      try {
        await fetch(REPORT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            context: `Client Runtime (${window.location.pathname})`,
          }),
          keepalive: true,
        });
      } catch (reportError) {
        console.error('Failed to report client error to Google Chat:', reportError);
      }
    };

    report();
  }, [error]);

  return (
    <div className="min-h-screen px-4 bg-background text-foreground flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          알림
        </p>
        <h1 className="mt-3 text-2xl font-bold">문제가 발생했습니다</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          잠시 후 새로고침하거나 아래 버튼을 눌러 다시 시도해 주세요. (이미 자동으로 개발팀에
          전달되었습니다)
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button type="button" variant="default" onClick={() => reset()}>
            다시 시도
          </Button>
        </div>
      </div>
    </div>
  );
}
