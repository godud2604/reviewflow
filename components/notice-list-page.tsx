'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pin } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

type Notice = {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
};

export default function NoticeListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    fetchNotices();
  }, [user]);

  const fetchNotices = async () => {
    try {
      const supabase = getSupabaseClient();

      // 공지사항 가져오기
      const { data: noticesData, error: noticesError } = await supabase
        .from('notices')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (noticesError) throw noticesError;

      if (!user) {
        setNotices(noticesData || []);
        setLoading(false);
        return;
      }

      // 읽음 상태 가져오기
      const { data: readsData, error: readsError } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);

      if (readsError) throw readsError;

      const readNoticeIds = new Set(readsData?.map((r) => r.notice_id) || []);
      const noticesWithReadStatus = (noticesData || []).map((notice) => ({
        ...notice,
        is_read: readNoticeIds.has(notice.id),
      }));

      setNotices(noticesWithReadStatus);
    } catch (error) {
      console.error('공지사항 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNoticeClick = async (notice: Notice) => {
    setSelectedNotice(notice);

    // 읽음 상태 저장
    if (user && !notice.is_read) {
      try {
        const supabase = getSupabaseClient();
        await supabase.from('notice_reads').upsert({
          user_id: user.id,
          notice_id: notice.id,
        });

        // 로컬 상태 업데이트
        setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, is_read: true } : n)));
      } catch (error) {
        console.error('읽음 상태 저장 실패:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] pb-24">
        <div className="mx-auto max-w-[520px] px-5 pt-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedNotice) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] pb-24">
        <div className="mx-auto max-w-[520px] px-5 pt-6">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedNotice(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
              aria-label="목록으로"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[18px] font-semibold text-neutral-900">공지사항</h2>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            {selectedNotice.is_pinned && (
              <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-orange-600">
                <Pin className="h-4 w-4" />
                고정됨
              </div>
            )}
            <h1 className="mb-2 text-[20px] font-bold text-neutral-900">{selectedNotice.title}</h1>
            <p className="mb-6 text-[12px] text-neutral-500">
              {formatDate(selectedNotice.created_at)}
            </p>
            <div className="whitespace-pre-line text-[14px] leading-relaxed text-neutral-700">
              {selectedNotice.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] pb-24">
      <div className="mx-auto max-w-[520px] px-5 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/?page=home')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-neutral-900">공지사항</h2>
        </div>

        {notices.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <p className="text-[14px] text-neutral-500">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                onClick={() => handleNoticeClick(notice)}
                className="group w-full rounded-3xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {notice.is_pinned && <Pin className="h-4 w-4 text-orange-600" />}
                      {!notice.is_read && user && (
                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                      )}
                      <h3 className="text-[15px] font-semibold text-neutral-900 group-hover:text-neutral-700">
                        {notice.title}
                      </h3>
                    </div>
                    <p className="line-clamp-2 text-[13px] text-neutral-500">{notice.content}</p>
                    <p className="mt-2 text-[11px] text-neutral-400">
                      {formatDate(notice.created_at)}
                    </p>
                  </div>
                  <span className="text-[18px] text-neutral-300 group-hover:text-neutral-400">
                    ›
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
