'use client';

export const APP_LAUNCH_EVENT = 'reviewflow:app-launch-open';

export const openAppLaunchModal = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(APP_LAUNCH_EVENT));
};
