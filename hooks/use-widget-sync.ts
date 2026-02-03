'use client';

import { useEffect, useRef } from 'react';

import type { Schedule } from '@/types';
import { isNativeAppWebView } from '@/lib/app-launch';
import { postMessageToNative } from '@/lib/native-bridge';
import {
  buildWidgetCalendarSnapshotV1,
  buildWidgetHomeSnapshotV1,
  buildWidgetTodoSnapshotV1FromSchedules,
  getWidgetSnapshotsFingerprintV1,
} from '@/lib/widget-home-snapshot';

type WidgetSyncPayloadV1 = {
  fingerprint: string;
  calendarSnapshot: unknown;
  todoSnapshot: unknown;
};

const DEFAULT_DEBOUNCE_MS = 250;
const MAX_RETRY_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 5000;

const isAndroidUserAgent = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /Android/i.test(ua);
};

const isAndroidAppWebView = () => isAndroidUserAgent() && isNativeAppWebView();

export function useWidgetSyncV1({
  schedules,
  userId,
  enabled = true,
  resetKey,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  schedules: Schedule[];
  userId?: string | null;
  enabled?: boolean;
  resetKey?: unknown;
  debounceMs?: number;
}) {
  const lastSyncedFingerprintRef = useRef<string | null>(null);
  const lastResetKeyRef = useRef<unknown>(undefined);
  const lastEnabledRef = useRef<boolean>(enabled);
  const lastUserIdRef = useRef<string | null>(userId ?? null);
  const pendingPayloadRef = useRef<WidgetSyncPayloadV1 | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef(0);
  const pendingRequestRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const log = (message: string, data?: Record<string, unknown>) => {
      if (!isAndroidUserAgent()) return;
      if (data) {
        console.log(`[WidgetSync][Web] ${message}`, data);
      } else {
        console.log(`[WidgetSync][Web] ${message}`);
      }
    };

    const prevEnabled = lastEnabledRef.current;
    const prevUserId = lastUserIdRef.current;
    lastEnabledRef.current = enabled;
    lastUserIdRef.current = userId ?? null;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryAttemptsRef.current = 0;

    const becameEnabled = !prevEnabled && enabled;
    const userChanged = prevUserId !== userId;
    if (becameEnabled || userChanged) {
      lastSyncedFingerprintRef.current = null;
    }

    if (resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      lastSyncedFingerprintRef.current = null;
    }

    const sendNow = (
      payload: WidgetSyncPayloadV1,
      context?: { reason?: string; source?: string }
    ) => {
      const okCalendar = postMessageToNative({
        type: 'WIDGET_SYNC',
        version: '1',
        action: 'bulk_snapshot',
        payload: { key: 'widget.calendar.v1', snapshot: payload.calendarSnapshot },
      });

      const okTodo = postMessageToNative({
        type: 'WIDGET_SYNC',
        version: '1',
        action: 'bulk_snapshot',
        payload: { key: 'widget.todo.v1', snapshot: payload.todoSnapshot },
      });

      log('send', {
        okCalendar,
        okTodo,
        source: context?.source,
        reason: context?.reason,
        isApp: isNativeAppWebView(),
      });

      return okCalendar || okTodo;
    };

    const buildPayload = () => {
      if (!userId) return null;

      const homeSnapshot = buildWidgetHomeSnapshotV1({
        schedules,
        userId,
        maxTodoItems: 5,
        sortOption: 'DEADLINE_SOON',
      });

      const calendarSnapshot = buildWidgetCalendarSnapshotV1(homeSnapshot);
      const todoSnapshot = buildWidgetTodoSnapshotV1FromSchedules({
        schedules,
        userId,
      });

      const fingerprint = getWidgetSnapshotsFingerprintV1({
        calendarSnapshot,
        todoSnapshot,
      });

      return {
        fingerprint,
        calendarSnapshot,
        todoSnapshot,
      } as WidgetSyncPayloadV1;
    };

    const scheduleRetry = () => {
      if (retryTimerRef.current) return;
      if (!pendingPayloadRef.current) return;

      const attempt = retryAttemptsRef.current;
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        pendingPayloadRef.current = null;
        retryAttemptsRef.current = 0;
        return;
      }

      const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
      retryAttemptsRef.current += 1;

      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        const pending = pendingPayloadRef.current;
        if (!pending) return;

        const ok = sendNow(pending, { source: 'retry' });
        if (ok) {
          lastSyncedFingerprintRef.current = pending.fingerprint;
          pendingPayloadRef.current = null;
          retryAttemptsRef.current = 0;
          return;
        }

        scheduleRetry();
      }, delay);
    };

    const forceSync = (reason: string) => {
      if (!enabled || !userId) {
        pendingRequestRef.current = reason;
        log('request queued', { reason });
        return;
      }

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      retryAttemptsRef.current = 0;

      const payload = buildPayload();
      if (!payload) return;

      pendingPayloadRef.current = payload;
      const ok = sendNow(payload, { source: 'request', reason });
      if (ok) {
        lastSyncedFingerprintRef.current = payload.fingerprint;
        pendingPayloadRef.current = null;
        retryAttemptsRef.current = 0;
        return;
      }

      scheduleRetry();
    };

    const handleMessage = (event: any) => {
      try {
        if (typeof event.data !== 'string') return;
        const data = JSON.parse(event.data);
        if (data?.type !== 'WIDGET_SYNC_REQUEST') return;
        if (!isAndroidUserAgent()) return;
        const reason = typeof data.reason === 'string' ? data.reason : 'app_request';
        log('request received', { reason });
        if (!enabled || !userId) {
          pendingRequestRef.current = reason;
          log('request queued', { reason });
          return;
        }
        forceSync(reason);
      } catch {
        // ignore malformed messages
      }
    };

    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    if (!enabled || !userId) {
      return cleanup;
    }

    if (pendingRequestRef.current) {
      const reason = pendingRequestRef.current;
      pendingRequestRef.current = null;
      log('request flush', { reason });
      forceSync(reason);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;

      const payload = buildPayload();
      if (!payload) return;

      if (payload.fingerprint === lastSyncedFingerprintRef.current) return;

      pendingPayloadRef.current = payload;

      const ok = sendNow(payload, { source: 'auto' });
      if (ok) {
        lastSyncedFingerprintRef.current = payload.fingerprint;
        pendingPayloadRef.current = null;
        retryAttemptsRef.current = 0;
        return;
      }

      scheduleRetry();
    }, debounceMs);

    return cleanup;
  }, [debounceMs, enabled, resetKey, schedules, userId]);
}
