'use client';

import { useEffect, useRef } from 'react';

import type { Schedule } from '@/types';
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
    const prevEnabled = lastEnabledRef.current;
    const prevUserId = lastUserIdRef.current;
    lastEnabledRef.current = enabled;
    lastUserIdRef.current = userId ?? null;

    if (!enabled) return;
    if (!userId) return;
    if (typeof window === 'undefined') return;

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

    const sendNow = (payload: WidgetSyncPayloadV1) => {
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

      return okCalendar || okTodo;
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

        const ok = sendNow(pending);
        if (ok) {
          lastSyncedFingerprintRef.current = pending.fingerprint;
          pendingPayloadRef.current = null;
          retryAttemptsRef.current = 0;
          return;
        }

        scheduleRetry();
      }, delay);
    };

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;

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

      if (fingerprint === lastSyncedFingerprintRef.current) return;

      const payload: WidgetSyncPayloadV1 = {
        fingerprint,
        calendarSnapshot,
        todoSnapshot,
      };
      pendingPayloadRef.current = payload;

      const ok = sendNow(payload);
      if (ok) {
        lastSyncedFingerprintRef.current = fingerprint;
        pendingPayloadRef.current = null;
        retryAttemptsRef.current = 0;
        return;
      }

      scheduleRetry();
    }, debounceMs);

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
  }, [debounceMs, enabled, resetKey, schedules, userId]);
}
