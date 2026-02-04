'use client';

import { useEffect, useState } from 'react';
import { Bell, Rocket, Settings, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { isNativeAppWebView } from '@/lib/app-launch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type GlobalHeaderProps = {
  title: string;
  onNotifications: () => void;
  onProfile: () => void;
};

export default function GlobalHeader({ title, onNotifications, onProfile }: GlobalHeaderProps) {
  const router = useRouter();
  const [isNativeApp] = useState(() => isNativeAppWebView());
  const [showAppModal, setShowAppModal] = useState(false);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const { user } = useAuth();
  const userId = user?.id;

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

  const handleNotificationsClick = async () => {
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
