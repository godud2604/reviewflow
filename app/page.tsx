'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomePage from '@/components/home-page';
import AllSchedulesPage from '@/components/all-schedules-page';
import StatsPage from '@/components/stats-page';
import ProfilePage from '@/components/profile-page';
import PortfolioPage from '@/components/portfolio-page';
import NavigationBar from '@/components/navigation-bar';
import ScheduleModal from '@/components/schedule-modal';
import TodoModal from '@/components/todo-modal';
import LandingPage from '@/components/landing-page';
import GlobalHeader from '@/components/global-header';
import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSchedules } from '@/hooks/use-schedules';
import { useTodos } from '@/hooks/use-todos';
import { useChannels } from '@/hooks/use-channels';
import { useFeaturedPosts } from '@/hooks/use-featured-posts';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import { resolveTier } from '@/lib/tier';
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
  const page = searchParams.get('page') || 'landing';
  const view = searchParams.get('view');
  const isLandingPage = page === 'landing';
  const currentPage = page === 'home' || page === 'stats' || page === 'profile' ? page : 'home';
  const showPortfolio = view === 'portfolio';

  // Auth Hook
  const { user, loading: authLoading } = useAuth();

  const isLoggedIn = !!user && !isLandingPage;
  const { profile, refetch: refetchUserProfile } = useUserProfile({ enabled: isLoggedIn });
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
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
  const mapSearchRequested = searchParams.get('mapSearch') === 'true';
  const mapSearchAutoSaveRequested = searchParams.get('mapSearchAutoSave') === 'true';

  const showAllSchedules = view === 'all';
  const isScheduleModalOpen = scheduleId !== null || isNewSchedule;
  const editingScheduleId = scheduleId ? parseInt(scheduleId) : null;

  const handleOpenScheduleModal = (
    scheduleId?: number,
    options?: { deadDate?: string; openMapSearch?: boolean; autoSaveMapLocation?: boolean }
  ) => {
    const params = new URLSearchParams(searchParams.toString());
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
      if (!editingScheduleId && createdSchedule?.dead) {
        setHomeCalendarFocusDate(createdSchedule.dead);
      }
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

  const handleConfirmPayback = async (id: number) => {
    await updateSchedule(id, { paybackConfirmed: true });
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

  const handleGoNotifications = () => {
    router.push('/notifications');
  };

  const handleGoProfile = () => {
    router.push('?page=profile');
  };

  const handleShowAllSchedules = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'all');
    router.push(`?${params.toString()}`);
  };

  const handleBackFromAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    router.push(`?${params.toString()}`);
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (isLandingPage || !user) {
    return <LandingPage />;
  }

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-neutral-200 md:flex md:items-center md:justify-center md:p-4">
        <div className="w-full md:max-w-[800px] h-screen md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mb-2"></div>
          <p className="text-gray-500 text-sm">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const showGlobalHeader =
    !showPortfolio && !showAllSchedules && (currentPage === 'home' || currentPage === 'stats');

  return (
    // 1. 최상단 컨테이너를 fixed로 고정하여 사파리 바운스(튕김)를 방지
    <div className="fixed inset-0 bg-neutral-200 md:flex md:items-center md:justify-center md:p-4 overflow-hidden">
      <div className="w-full md:max-w-[800px] h-[100dvh] md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
        <main className="flex-1 overflow-y-auto outline-none">
          {showGlobalHeader && (
            <GlobalHeader
              title={currentPage === 'stats' ? '통계' : '일정'}
              onNotifications={handleGoNotifications}
              onProfile={handleGoProfile}
            />
          )}
          {showPortfolio ? (
            <PortfolioPage
              schedules={schedules}
              channels={channels}
              featuredPosts={featuredPosts}
              onBack={handleBackFromPortfolio}
            />
          ) : showAllSchedules ? (
            <AllSchedulesPage
              schedules={schedules}
              onScheduleClick={handleOpenScheduleModal}
              onBack={handleBackFromAll}
              onCompleteClick={handleCompleteSchedule}
              onPaybackConfirm={handleConfirmPayback}
              onAdditionalDeadlineToggle={handleAdditionalDeadlineToggle}
            />
          ) : (
            <>
              {currentPage === 'home' && (
                <HomePage
                  schedules={schedules}
                  onScheduleClick={handleOpenScheduleModal}
                  onShowAllClick={handleShowAllSchedules}
                  onCompleteClick={handleCompleteSchedule}
                  onPaybackConfirm={handleConfirmPayback}
                  onAdditionalDeadlineToggle={handleAdditionalDeadlineToggle}
                  onAddClick={() => handleOpenScheduleModal()}
                  onCreateSchedule={(dateStr) =>
                    handleOpenScheduleModal(undefined, { deadDate: dateStr })
                  }
                  focusDate={homeCalendarFocusDate}
                  onFocusDateApplied={() => setHomeCalendarFocusDate(null)}
                  userEmail={user?.email}
                  onRegisterLocation={(scheduleId) =>
                    handleOpenScheduleModal(scheduleId, {
                      openMapSearch: true,
                      autoSaveMapLocation: true,
                    })
                  }
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

        <NavigationBar
          currentPage={currentPage}
          onPageChange={handlePageChange}
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-200 flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}
