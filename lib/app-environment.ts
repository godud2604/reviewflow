export const isAppEnvironment = (): boolean => {
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
  const isReactNativeWebView = Boolean((window as any).ReactNativeWebView);

  return matchesDisplayMode || isIosStandalone || isReactNativeWebView;
};
