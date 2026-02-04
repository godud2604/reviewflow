import NoticeListPage from '@/components/notice-list-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '공지사항 | 리뷰플로우',
  description: '리뷰플로우 공지사항을 확인하세요.',
};

export default function NoticePage() {
  return <NoticeListPage />;
}
