'use client';

import { useEffect, useState } from 'react';
import { Bell, Settings } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

const KAKAO_TUTORIAL_KEY = 'kakao-alimtalk-notifications-cta';

type GlobalHeaderProps = {
  title: string;
  onNotifications: () => void;
  onProfile: () => void;
};

export default function GlobalHeader({ title, onNotifications, onProfile }: GlobalHeaderProps) {
  const [showKakaoCta, setShowKakaoCta] = useState(false);
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setShowKakaoCta(false);
      return;
    }

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
    if (showKakaoCta && userId) {
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
          <div className="relative">
            <button
              type="button"
              onClick={handleNotificationsClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
              aria-label="알림 설정으로 이동"
            >
              <Bell className="h-5 w-5" />
            </button>
            {showKakaoCta && (
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
