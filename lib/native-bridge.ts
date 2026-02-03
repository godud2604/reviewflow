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

const getNativeBridge = () => {
  if (typeof window === 'undefined') return null;
  const direct = (window as Window & { ReactNativeWebView?: { postMessage?: unknown } })
    .ReactNativeWebView;
  if (direct && typeof direct.postMessage === 'function') return direct;

  const top = window.top as (Window & { ReactNativeWebView?: { postMessage?: unknown } }) | null;
  if (top && top !== window) {
    const topBridge = top.ReactNativeWebView;
    if (topBridge && typeof topBridge.postMessage === 'function') return topBridge;
  }

  const parent = window.parent as (Window & { ReactNativeWebView?: { postMessage?: unknown } }) | null;
  if (parent && parent !== window) {
    const parentBridge = parent.ReactNativeWebView;
    if (parentBridge && typeof parentBridge.postMessage === 'function') return parentBridge;
  }

  return null;
};

export const postMessageToNative = (message: NativeBridgeMessage) => {
  if (typeof window === 'undefined') return false;
  if (!isNativeAppWebView()) {
    // Fallback for nested frames: try to find the bridge anyway.
    if (!getNativeBridge()) return false;
  }

  try {
    const serialized = JSON.stringify(message);
    const bridge = getNativeBridge();
    if (!bridge || typeof bridge.postMessage !== 'function') return false;
    bridge.postMessage(serialized);
    return true;
  } catch {
    return false;
  }
};
