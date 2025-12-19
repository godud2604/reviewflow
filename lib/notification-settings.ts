"use client"

import { type NotificationSettings } from "@/types"

const STORAGE_KEY = "reviewflow:daily-summary-settings"
export const SETTINGS_CHANGE_EVENT = "reviewflow:notification-settings-changed"

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  hour: 8,
  minute: 0,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const readNotificationSettings = (): NotificationSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATION_SETTINGS
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return DEFAULT_NOTIFICATION_SETTINGS
  }

  try {
    const parsed = JSON.parse(stored)
    return {
      enabled: parsed.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
      hour: clamp(Number(parsed.hour ?? DEFAULT_NOTIFICATION_SETTINGS.hour), 0, 23),
      minute: clamp(Number(parsed.minute ?? DEFAULT_NOTIFICATION_SETTINGS.minute), 0, 59),
    }
  } catch (error) {
    console.error("알림 설정 파싱 실패", error)
    return DEFAULT_NOTIFICATION_SETTINGS
  }
}

export const writeNotificationSettings = (settings: NotificationSettings) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: settings }))
  } catch (error) {
    console.error("알림 설정 저장 실패", error)
  }
}
