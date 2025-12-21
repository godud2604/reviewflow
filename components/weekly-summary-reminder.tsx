'use client';

import { useEffect, useRef } from 'react';
import { readNotificationSettings, SETTINGS_CHANGE_EVENT } from '@/lib/notification-settings';

const LAST_SENT_KEY = 'reviewflow:daily-summary-last-sent';

const getNextDailyNotificationDate = (hour: number, minute: number, now = new Date()) => {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

const formatTimeLabel = (date: Date) => {
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${minute}`;
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === 'granted';
};

const readLastSentDate = (): Date | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(LAST_SENT_KEY);
  if (!stored) {
    return null;
  }

  const parsed = new Date(stored);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const markNotificationSent = (targetDate: Date) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LAST_SENT_KEY, targetDate.toISOString());
  } catch (error) {
    console.error('주간 요약 전송 시각 저장 실패', error);
  }
};

const isInPwaDisplayMode = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const displayModes = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
  ];
  const matchesDisplayMode = displayModes.some((query) => window.matchMedia(query).matches);
  const isIosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return matchesDisplayMode || isIosStandalone;
};

const showWeeklySummaryNotification = (targetDate: Date) => {
  if (typeof Notification === 'undefined') {
    return;
  }

  const title = '리뷰플로우 주간 요약이 준비되었습니다';
  const body = `${formatTimeLabel(targetDate)}에 일주일 요약을 확인하고 다음 일정을 점검해보세요.`;

  try {
    new Notification(title, {
      body,
      badge: '/logo-white-2.png',
      icon: '/logo-white-2.png',
      tag: 'daily-summary',
      data: {
        target: targetDate.toISOString(),
      },
    });
    markNotificationSent(targetDate);
  } catch (error) {
    console.error('주간 요약 알림 발송 실패', error);
  }
};

export const triggerDailySummaryNotification = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return false;
  }
  showWeeklySummaryNotification(new Date());
  return true;
};

export default function WeeklySummaryReminder() {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isInPwaDisplayMode()) {
      return;
    }

    let cancelled = false;
    let permissionGranted = false;
    const settingsRef = { current: readNotificationSettings() };

    const scheduleNextNotification = () => {
      if (cancelled) {
        return;
      }

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      const settings = settingsRef.current;
      if (!settings.enabled) {
        return;
      }

      const nextTarget = getNextDailyNotificationDate(settings.hour, settings.minute);
      const lastSent = readLastSentDate();
      if (lastSent && lastSent.getTime() >= nextTarget.getTime()) {
        nextTarget.setDate(nextTarget.getDate() + 1);
      }

      const delay = nextTarget.getTime() - Date.now();
      if (delay <= 0) {
        showWeeklySummaryNotification(nextTarget);
        scheduleNextNotification();
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        showWeeklySummaryNotification(nextTarget);
        scheduleNextNotification();
      }, delay);
    };

    const ensureScheduling = async () => {
      if (cancelled) {
        return;
      }
      permissionGranted = await requestNotificationPermission();
      if (permissionGranted) {
        scheduleNextNotification();
      }
    };

    ensureScheduling();

    const handleSettingsChange = () => {
      settingsRef.current = readNotificationSettings();
      if (permissionGranted) {
        scheduleNextNotification();
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    };
  }, []);

  return null;
}
