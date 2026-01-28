'use client';

import { isNativeAppWebView } from '@/lib/app-launch';

export type NativeBridgeMessage =
  | {
      type: 'WIDGET_SYNC';
      version: '1';
      action: 'bulk_snapshot';
      payload: unknown;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export const postMessageToNative = (message: NativeBridgeMessage) => {
  if (typeof window === 'undefined') return false;
  if (!isNativeAppWebView()) return false;

  try {
    const serialized = JSON.stringify(message);
    (window as Window & { ReactNativeWebView?: { postMessage?: (data: string) => void } })
      .ReactNativeWebView?.postMessage?.(serialized);
    return true;
  } catch {
    return false;
  }
};

