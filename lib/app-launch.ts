'use client';

export const APP_LAUNCH_EVENT = 'reviewflow:app-launch-open';

export const isNativeAppWebView = () => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView);
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
