'use client';

export const APP_LAUNCH_EVENT = 'reviewflow:app-launch-open';

export const isNativeAppWebView = () => {
  if (typeof window === 'undefined') return false;
  const direct = (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView;
  if (direct) return true;
  const top = window.top as (Window & { ReactNativeWebView?: unknown }) | null;
  if (top && top !== window && top.ReactNativeWebView) return true;
  const parent = window.parent as (Window & { ReactNativeWebView?: unknown }) | null;
  if (parent && parent !== window && parent.ReactNativeWebView) return true;
  return false;
};

export const isInPwaDisplayMode = () => {
  if (typeof window === 'undefined') return false;
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

export const openAppLaunchModal = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(APP_LAUNCH_EVENT));
};
