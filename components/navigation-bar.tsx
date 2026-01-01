'use client';

import { BarChart3, CalendarCheck2, Plus } from 'lucide-react';

export default function NavigationBar({
  currentPage,
  onPageChange,
  onAddClick,
}: {
  currentPage: 'home' | 'stats' | 'profile';
  onPageChange: (page: 'home' | 'stats') => void;
  onAddClick: () => void;
}) {
  const baseBtn =
    'flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-2 text-[13px] font-semibold text-neutral-400 transition';
  const activeClasses = 'bg-neutral-100 text-neutral-900 shadow-[0_8px_20px_rgba(15,23,42,0.08)]';

  return (
    <nav className="w-full px-4 pb-[calc(max(env(safe-area-inset-bottom),constant(safe-area-inset-bottom))+0.9rem)]">
      <div className="mx-auto flex max-w-[250px] items-center justify-between rounded-[28px] border border-neutral-200 bg-white/90 px-3 py-0.5 backdrop-blur">
        <button
          onClick={() => onPageChange('home')}
          className={`${baseBtn} ${currentPage === 'home' ? activeClasses : ''}`}
          aria-label="일정 페이지로 이동"
        >
          <CalendarCheck2 className="h-5 w-5" />
          <span>일정</span>
        </button>

        <button
          onClick={onAddClick}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-1.5 text-[13px] font-semibold text-orange-600 transition hover:text-orange-500"
          aria-label="체험단 등록"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white">
            <Plus className="h-6 w-6" />
          </span>
          체험단 등록
        </button>

        <button
          onClick={() => onPageChange('stats')}
          className={`${baseBtn} ${currentPage === 'stats' ? activeClasses : ''}`}
          aria-label="통계 페이지로 이동"
        >
          <BarChart3 className="h-5 w-5" />
          <span>통계</span>
        </button>
      </div>
    </nav>
  );
}
