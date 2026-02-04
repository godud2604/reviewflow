'use client';

import { useEffect, useState } from 'react';
import { Bell, Rocket, Settings, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { isNativeAppWebView } from '@/lib/app-launch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const KAKAO_TUTORIAL_KEY = 'kakao-alimtalk-notifications-cta';

type GlobalHeaderProps = {
  title: string;
  onNotifications: () => void;
  onProfile: () => void;
};

export default function GlobalHeader({ title, onNotifications, onProfile }: GlobalHeaderProps) {
  const router = useRouter();
  const [showKakaoCta, setShowKakaoCta] = useState(false);
  const [isNativeApp] = useState(() => isNativeAppWebView());
  const [showAppModal, setShowAppModal] = useState(false);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const { user } = useAuth();
  const userId = user?.id;
  const isKakaoCtaVisible = Boolean(userId) && showKakaoCta;

  useEffect(() => {
    if (!userId) return;
    fetchUnreadNoticeCount();
  }, [userId]);

  const fetchUnreadNoticeCount = async () => {
    if (!userId) return;

    try {
      const supabase = getSupabaseClient();

      // 전체 공지사항 수
      const { count: totalCount } = await supabase
        .from('notices')
        .select('id', { count: 'exact', head: true });

      // 읽은 공지사항 수
      const { count: readCount } = await supabase
        .from('notice_reads')
        .select('notice_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const unread = (totalCount || 0) - (readCount || 0);
      setUnreadNoticeCount(unread > 0 ? unread : 0);
    } catch (error) {
      console.error('안 읽은 공지 개수 조회 실패:', error);
    }
  };

  const handleNoticeClick = () => {
    router.push('/notice');
  };

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const fetchTutorialStatus = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('tutorial_progress')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('tutorial_key', KAKAO_TUTORIAL_KEY)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setShowKakaoCta(true);
        return;
      }

      setShowKakaoCta(!data?.completed_at);
    };

    fetchTutorialStatus();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleNotificationsClick = async () => {
    if (isKakaoCtaVisible && userId) {
      const supabase = getSupabaseClient();
      try {
        await supabase.from('tutorial_progress').upsert(
          {
            user_id: userId,
            tutorial_key: KAKAO_TUTORIAL_KEY,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tutorial_key' }
        );
      } catch {
        // Ignore failures; CTA can show again if needed.
      }
      setShowKakaoCta(false);
    }
    onNotifications();
  };

  return (
    <div className="sticky top-0 z-30 border-b border-neutral-200/70 bg-[#F7F7F8]/90 backdrop-blur">
      <div className="flex items-center justify-between px-5 pb-3 pt-3">
        <div className="space-y-0.5">
          <h1 className="text-[20px] font-semibold text-neutral-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isNativeApp === false && (
            <>
              <button
                type="button"
                onClick={() => setShowAppModal(true)}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff7a18] via-[#ff5b6b] to-[#ff3b9f] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(255,90,90,0.35)] transition hover:brightness-105"
                aria-label="앱 출시 안내 열기"
              >
                <Rocket className="h-4 w-4" />
                앱출시
              </button>
              <Dialog open={showAppModal} onOpenChange={setShowAppModal}>
                <DialogContent className="rounded-2xl p-6 max-w-xs w-full">
                  <DialogHeader>
                    <DialogTitle className="text-base flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-orange-500" />
                      리뷰플로우 앱 출시!
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-3 text-sm text-neutral-800 text-center">
                    iOS, Android 앱이 정식 출시되었습니다.
                    <br />
                    지금 바로 다운로드해보세요!
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        const url = 'https://apps.apple.com/kr/app/reviewflow/id6757174544';
                        window.open(url, '_blank');
                      }}
                    >
                      iOS 앱 이동
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        const url =
                          'https://play.google.com/store/apps/details?id=com.reviewflow.reviewflow';
                        window.open(url, '_blank');
                      }}
                    >
                      Android 앱 이동
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={handleNoticeClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 relative"
              aria-label="공지사항 보기"
            >
              <MessageSquare className="h-5 w-5" />
              {unreadNoticeCount > 0 && (
                <>
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                  {unreadNoticeCount > 1 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                      {unreadNoticeCount > 99 ? '99+' : unreadNoticeCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={handleNotificationsClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
              aria-label="알림 설정으로 이동"
            >
              <Bell className="h-5 w-5" />
            </button>
            {isKakaoCtaVisible && (
              <>
                <span className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 shadow-[0_0_0_2px_rgba(247,247,248,1)] animate-pulse" />
                <div className="pointer-events-none absolute right-0 top-12 w-[220px] rounded-xl bg-white/95 px-3 py-2 text-[12px] text-neutral-800 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-xl p-[3px] bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400 bg-[length:200%_100%] animate-[gradient-flow_3s_linear_infinite]"
                    style={{
                      WebkitMask:
                        'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  ></div>
                  <div className="relative z-10">
                    <p className="font-semibold text-neutral-900">
                      깜빡하기 쉬운 일정, 놓치지 마세요!
                    </p>
                    <p className="text-neutral-600">🔔 알림 버튼을 눌러 카톡으로 일정 받기</p>
                  </div>
                  <span className="absolute -top-[9px] right-4 h-0 w-0 border-x-[9px] border-b-[9px] border-x-transparent border-b-orange-500 z-20" />
                  <span className="absolute -top-2 right-[18px] h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-white/95 z-20" />
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onProfile}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="프로필 설정으로 이동"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
