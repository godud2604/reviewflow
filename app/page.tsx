'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomePage, { HomePageSkeleton } from '@/components/home-page';
import StatsPage, { StatsPageSkeleton } from '@/components/stats-page';
import ProfilePage, { ProfilePageSkeleton } from '@/components/profile-page';
import PortfolioPage from '@/components/portfolio-page';
import NavigationBar from '@/components/navigation-bar';
import MissionCtaBanner from '@/components/mission-cta-banner';
import ScheduleModal from '@/components/schedule-modal';
import TodoModal from '@/components/todo-modal';
import LandingPage from '@/components/landing-page';
import GlobalHeader from '@/components/global-header';
import LaunchEventBanner from '@/components/launch-event-banner';
import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSchedules } from '@/hooks/use-schedules';
import { useTodos } from '@/hooks/use-todos';
import { useChannels } from '@/hooks/use-channels';
import { useFeaturedPosts } from '@/hooks/use-featured-posts';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import { resolveTier } from '@/lib/tier';
import { isInPwaDisplayMode, isNativeAppWebView } from '@/lib/app-launch';
import type { Schedule } from '@/types';

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    const search = window.location.search.replace(/^\?/, '');
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(search);
    const type = hashParams.get('type') || queryParams.get('type');

    if (type === 'recovery') {
      const redirectPath = `/reset-password${window.location.search}${window.location.hash}`;
      router.replace(redirectPath);
    }
  }, [router]);

  // URL 기반 상태 관리
  const isAppEntry =
    typeof window !== 'undefined' && (isNativeAppWebView() || isInPwaDisplayMode());
  const page = searchParams.get('page') || (isAppEntry ? 'home' : 'landing');
  const view = searchParams.get('view');
  const isLandingPage = page === 'landing';
  const currentPage = page === 'home' || page === 'stats' || page === 'profile' ? page : 'home';
  const showPortfolio = view === 'portfolio';
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Auth Hook
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAppEntry) return;
    if (authLoading) return;

    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const recoveryType = hashParams.get('type') || searchParams.get('type');
    if (recoveryType === 'recovery') return;

    if (!user) {
      router.replace('/signin');
      return;
    }

    const pageParam = searchParams.get('page');
    if (!pageParam || pageParam === 'landing') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', 'home');
      router.replace(`?${params.toString()}`);
    }
  }, [authLoading, isAppEntry, router, searchParams, user]);

  const isLoggedIn = !!user && !isLandingPage;
  const { profile, refetch: refetchUserProfile } = useUserProfile({ enabled: isLoggedIn });
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;

  useEffect(() => {
    if (currentPage !== 'stats') return;
    if (!mainScrollRef.current) return;
    mainScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentPage]);
  const { isPro } = resolveTier({
    profileTier: profile?.tier ?? undefined,
    metadata,
  });

  const {
    schedules,
    loading: schedulesLoading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSchedules({ enabled: isLoggedIn });

  const {
    todos,
    loading: todosLoading,
    addTodo,
    toggleTodo,
    deleteTodo,
  } = useTodos({ enabled: isLoggedIn && currentPage === 'home' });

  const { channels, loading: channelsLoading } = useChannels({
    enabled: isLoggedIn && showPortfolio,
  });

  const { featuredPosts, loading: featuredPostsLoading } = useFeaturedPosts({
    enabled: isLoggedIn && showPortfolio,
  });

  const { extraIncomes, loading: extraIncomesLoading } = useExtraIncomes({
    enabled: isLoggedIn && currentPage === 'profile',
  });

  const getIsDataLoading = () => {
    if (schedulesLoading) return true;
    if (currentPage === 'home' && todosLoading) return true;
    if (showPortfolio && (channelsLoading || featuredPostsLoading)) return true;
    if (currentPage === 'profile' && extraIncomesLoading) return true;
    return false;
  };

  const isDataLoading = getIsDataLoading();
  const scheduleId = searchParams.get('schedule');
  const isNewSchedule = searchParams.get('new') === 'true';
  const initialDeadline = searchParams.get('date') ?? undefined;
  const isTodoModalOpen = searchParams.get('todo') === 'true';
  const [homeCalendarFocusDate, setHomeCalendarFocusDate] = useState<string | null>(null);
  const [homeResetSignal, setHomeResetSignal] = useState(0);
  const mapSearchRequested = searchParams.get('mapSearch') === 'true';
  const mapSearchAutoSaveRequested = searchParams.get('mapSearchAutoSave') === 'true';
  const [statusChangeIntent, setStatusChangeIntent] = useState(false);

  const isScheduleModalOpen = scheduleId !== null || isNewSchedule;
  const editingScheduleId = scheduleId ? parseInt(scheduleId) : null;

  const handleOpenScheduleModal = (
    scheduleId?: number,
    options?: {
      deadDate?: string;
      openMapSearch?: boolean;
      autoSaveMapLocation?: boolean;
      statusChangeIntent?: boolean;
    }
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    setStatusChangeIntent(Boolean(options?.statusChangeIntent));
    if (scheduleId) {
      params.set('schedule', scheduleId.toString());
      params.delete('new');
      params.delete('date');
    } else {
      params.delete('schedule');
      params.set('new', 'true');
      if (options?.deadDate) {
        params.set('date', options.deadDate);
      } else {
        params.delete('date');
      }
    }
    if (options?.openMapSearch) {
      params.set('mapSearch', 'true');
    } else {
      params.delete('mapSearch');
    }
    if (options?.autoSaveMapLocation) {
      params.set('mapSearchAutoSave', 'true');
    } else {
      params.delete('mapSearchAutoSave');
    }
    router.push(`?${params.toString()}`);
  };

  const handleCloseScheduleModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('schedule');
    params.delete('new');
    params.delete('date');
    params.delete('mapSearch');
    params.delete('mapSearchAutoSave');
    router.push(`?${params.toString()}`);
    setStatusChangeIntent(false);
  };

  const handleSaveSchedule = async (schedule: Schedule) => {
    let success = true;
    let createdSchedule: Schedule | null = null;
    if (editingScheduleId) {
      const { id, ...updates } = schedule;
      success = await updateSchedule(editingScheduleId, updates);
    } else {
      const { id, ...newSchedule } = schedule;
      createdSchedule = await createSchedule(newSchedule);
      success = Boolean(createdSchedule);
    }
    if (success) {
      handleCloseScheduleModal();
    }
    return success;
  };

  const handleDeleteSchedule = async (id: number) => {
    await deleteSchedule(id);
    handleCloseScheduleModal();
  };

  const handleUpdateScheduleFiles = async (id: number, files: import('@/types').GuideFile[]) => {
    await updateSchedule(id, { guideFiles: files });
  };

  const handleCompleteSchedule = async (id: number) => {
    await updateSchedule(id, { status: '완료' });
  };

  const handleCompletedStatusEdit = (id: number) => {
    handleOpenScheduleModal(id, { statusChangeIntent: true });
  };

  const handleConfirmPayback = async (id: number) => {
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return;
    await updateSchedule(id, { paybackConfirmed: !schedule.paybackConfirmed });
  };

  const handleAdditionalDeadlineToggle = async (scheduleId: number, deadlineId: string) => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule?.additionalDeadlines) return;

    const updatedDeadlines = schedule.additionalDeadlines.map((deadline) => {
      if (deadline.id === deadlineId) {
        return { ...deadline, completed: !deadline.completed };
      }
      return deadline;
    });

    await updateSchedule(scheduleId, { additionalDeadlines: updatedDeadlines });
  };

  const handleAddTodo = async (text: string) => {
    await addTodo(text);
  };

  const handleToggleTodo = async (id: number) => {
    await toggleTodo(id);
  };

  const handleDeleteTodo = async (id: number) => {
    await deleteTodo(id);
  };

  const handlePageChange = (newPage: 'home' | 'stats') => {
    router.push(`?page=${newPage}`);
  };

  const handleHomeTabClick = () => {
    setHomeResetSignal((prev) => prev + 1);
  };

  const handleGoNotifications = () => {
    router.push('/notifications');
  };

  const handleGoProfile = () => {
    router.push('?page=profile');
  };

  const handleShowPortfolio = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'portfolio');
    router.push(`?${params.toString()}`);
  };

  const handleBackFromPortfolio = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.push(`?${params.toString()}`);
  };

  const handleOpenTodoModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('todo', 'true');
    router.push(`?${params.toString()}`);
  };

  const handleCloseTodoModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('todo');
    router.push(`?${params.toString()}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-200 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <img src="/icon.png" alt="ReviewFlow" className="h-9 w-9 object-contain" />
          </div>
          <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-white/70">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-300" />
          </div>
        </div>
      </div>
    );
  }

  if (isAppEntry && !user) {
    return null;
  }

  if (isLandingPage || !user) {
    return <LandingPage />;
  }

  if (isDataLoading) {
    if (currentPage === 'home') {
      return (
        <div className="fixed inset-0 bg-neutral-200 md:flex md:items-center md:justify-center md:p-4 overflow-hidden">
          <div className="w-full md:max-w-[800px] h-[100dvh] md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
            <GlobalHeader
              title="일정"
              onNotifications={handleGoNotifications}
              onProfile={handleGoProfile}
            />
            <HomePageSkeleton />
            <NavigationBar
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onHomeClick={handleHomeTabClick}
              onAddClick={() => handleOpenScheduleModal()}
            />
          </div>
        </div>
      );
    }

    if (currentPage === 'stats') {
      return (
        <div className="fixed inset-0 bg-neutral-200 md:flex md:items-center md:justify-center md:p-4 overflow-hidden">
          <div className="w-full md:max-w-[800px] h-[100dvh] md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
            <GlobalHeader
              title="통계"
              onNotifications={handleGoNotifications}
              onProfile={handleGoProfile}
            />
            <StatsPageSkeleton />
            <NavigationBar
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onHomeClick={handleHomeTabClick}
              onAddClick={() => handleOpenScheduleModal()}
            />
          </div>
        </div>
      );
    }

    if (currentPage === 'profile') {
      return (
        <div className="fixed inset-0 bg-neutral-200 md:flex md:items-center md:justify-center md:p-4 overflow-hidden">
          <div className="w-full md:max-w-[800px] h-[100dvh] md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
            <ProfilePageSkeleton />
            <NavigationBar
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onHomeClick={handleHomeTabClick}
              onAddClick={() => handleOpenScheduleModal()}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-neutral-200 md:flex md:items-center md:justify-center md:p-4">
        <div className="w-full md:max-w-[800px] h-screen md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mb-2"></div>
          <p className="text-gray-500 text-sm">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const showGlobalHeader = !showPortfolio && (currentPage === 'home' || currentPage === 'stats');

  return (
    // 1. 최상단 컨테이너를 fixed로 고정하여 사파리 바운스(튕김)를 방지
    <div className="fixed inset-0 bg-neutral-200 md:flex md:items-center md:justify-center md:p-4 overflow-hidden">
      <div className="w-full md:max-w-[800px] h-[100dvh] md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
        <main className="flex-1 flex flex-col overflow-y-auto">
          {showGlobalHeader && (
            <GlobalHeader
              title={currentPage === 'stats' ? '통계' : '일정'}
              onNotifications={handleGoNotifications}
              onProfile={handleGoProfile}
            />
          )}
          {/* 미션 CTA 띠배너: header 바로 아래에만 노출 */}
          {currentPage === 'home' && <MissionCtaBanner />}
          {!showPortfolio && <LaunchEventBanner />}
          {showPortfolio ? (
            <PortfolioPage
              schedules={schedules}
              channels={channels}
              featuredPosts={featuredPosts}
              onBack={handleBackFromPortfolio}
            />
          ) : (
            <>
              {currentPage === 'home' && (
                <HomePage
                  schedules={schedules}
                  onScheduleClick={handleOpenScheduleModal}
                  onCompleteClick={handleCompleteSchedule}
                  onCompletedClick={handleCompletedStatusEdit}
                  onPaybackConfirm={handleConfirmPayback}
                  onAdditionalDeadlineToggle={handleAdditionalDeadlineToggle}
                  onAddClick={() => handleOpenScheduleModal()}
                  onCreateSchedule={(dateStr) =>
                    handleOpenScheduleModal(undefined, { deadDate: dateStr })
                  }
                  focusDate={homeCalendarFocusDate}
                  onFocusDateApplied={() => setHomeCalendarFocusDate(null)}
                  resetSignal={homeResetSignal}
                />
              )}

              {currentPage === 'stats' && (
                <StatsPage
                  schedules={schedules}
                  onScheduleItemClick={(schedule) => handleOpenScheduleModal(schedule.id)}
                  isScheduleModalOpen={isScheduleModalOpen}
                  isPro={isPro}
                />
              )}

              {currentPage === 'profile' && (
                <ProfilePage profile={profile} refetchUserProfile={refetchUserProfile} />
              )}
            </>
          )}
        </main>

        {/* 하단 고정 미션 CTA 배너 (PRO 연장) */}
        <NavigationBar
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onHomeClick={handleHomeTabClick}
          onAddClick={() => handleOpenScheduleModal()}
        />

        {isScheduleModalOpen && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={handleCloseScheduleModal}
            onSave={handleSaveSchedule}
            onDelete={handleDeleteSchedule}
            onUpdateFiles={handleUpdateScheduleFiles}
            schedule={
              editingScheduleId ? schedules.find((s) => s.id === editingScheduleId) : undefined
            }
            initialDeadline={initialDeadline}
            initialMapSearchOpen={mapSearchRequested}
            initialMapSearchAutoSave={mapSearchAutoSaveRequested}
            statusChangeIntent={statusChangeIntent}
          />
        )}

        {isTodoModalOpen && (
          <TodoModal
            isOpen={isTodoModalOpen}
            onClose={handleCloseTodoModal}
            todos={todos}
            onAddTodo={handleAddTodo}
            onToggleTodo={handleToggleTodo}
            onDeleteTodo={handleDeleteTodo}
          />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-200" />}>
      <PageContent />
    </Suspense>
  );
}
