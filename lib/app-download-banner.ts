export const APP_DOWNLOAD_BANNER_OPEN_EVENT = 'reviewflow:app-download-banner:open';

export const openAppDownloadBanner = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(APP_DOWNLOAD_BANNER_OPEN_EVENT));
};
