import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { GuideFile } from '@/types';

export const useViewportStyle = (isOpen: boolean) => {
  const [viewportStyle, setViewportStyle] = useState<{ height: string; top: string }>({
    height: '100%',
    top: '0px',
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportStyle({
          height: `${window.visualViewport.height}px`,
          top: `${window.visualViewport.offsetTop}px`,
        });
      }
    };

    handleResize();
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  return viewportStyle;
};

export const useGuideFilePreviews = (
  guideFiles: GuideFile[] | undefined,
  getGuideFileUrl: (path: string) => Promise<string | null>
) => {
  const [guideFilePreviews, setGuideFilePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let isActive = true;
    const files = guideFiles || [];

    const fetchPreviews = async () => {
      if (files.length === 0) {
        setGuideFilePreviews({});
        return;
      }
      const entries = await Promise.all(
        files.map(async (file) => {
          try {
            const url = await getGuideFileUrl(file.path);
            return url ? { path: file.path, url } : null;
          } catch (error) {
            console.error('가이드 파일 미리보기 로드 실패:', error);
            return null;
          }
        })
      );

      if (!isActive) return;

      setGuideFilePreviews(
        entries.reduce<Record<string, string>>((acc, entry) => {
          if (entry) {
            acc[entry.path] = entry.url;
          }
          return acc;
        }, {})
      );
    };

    fetchPreviews();

    return () => {
      isActive = false;
    };
  }, [guideFiles, getGuideFileUrl]);

  return guideFilePreviews;
};

type ActiveTabParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  basicInfoRef: RefObject<HTMLDivElement | null>;
  progressInfoRef: RefObject<HTMLDivElement | null>;
  assetManagementRef: RefObject<HTMLDivElement | null>;
  memoRef: RefObject<HTMLDivElement | null>;
  guideFilesSectionRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  guideFilesCount: number;
};

export const useActiveTab = ({
  containerRef,
  basicInfoRef,
  progressInfoRef,
  assetManagementRef,
  memoRef,
  guideFilesSectionRef,
  enabled,
  guideFilesCount,
}: ActiveTabParams) => {
  const [activeTab, setActiveTab] = useState<string>('basicInfo');

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const basicInfo = basicInfoRef.current;
      const progressInfo = progressInfoRef.current;
      const assetManagement = assetManagementRef.current;
      const memo = memoRef.current;
      const guideFiles = guideFilesSectionRef.current;

      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;
      const scrollBottom = containerTop + containerHeight;
      const offset = 180;

      const isBottom = Math.abs(scrollHeight - scrollBottom) < 20;

      const posBasic = basicInfo?.offsetTop ?? 0;
      const posProgress = progressInfo?.offsetTop ?? 0;
      const posAsset = assetManagement?.offsetTop ?? 0;
      const posMemo = memo?.offsetTop ?? 0;
      const posGuide = guideFiles?.offsetTop ?? 0;

      let currentTab = 'basicInfo';

      if (isBottom) {
        if (guideFiles) currentTab = 'guideFiles';
        else currentTab = 'memo';
      } else {
        if (guideFiles && containerTop >= posGuide - offset) {
          currentTab = 'guideFiles';
        } else if (containerTop >= posMemo - offset) {
          currentTab = 'memo';
        } else if (containerTop >= posAsset - offset) {
          currentTab = 'assetManagement';
        } else if (containerTop >= posProgress - offset) {
          currentTab = 'progressInfo';
        } else {
          currentTab = 'basicInfo';
        }
      }

      setActiveTab((prev) => (prev !== currentTab ? currentTab : prev));
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [
    enabled,
    guideFilesCount,
    containerRef,
    basicInfoRef,
    progressInfoRef,
    assetManagementRef,
    memoRef,
    guideFilesSectionRef,
  ]);

  return activeTab;
};
