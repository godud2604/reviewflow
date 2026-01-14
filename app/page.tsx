'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomePage from '@/components/home-page';
import AllSchedulesPage from '@/components/all-schedules-page';
import StatsPage from '@/components/stats-page';
import ProfilePage from '@/components/profile-page';
import PortfolioPage from '@/components/portfolio-page';
import NavigationBar from '@/components/navigation-bar';
import ScheduleModal from '@/components/schedule-modal';
import LandingPage from '@/components/landing-page';
import GlobalHeader from '@/components/global-header';
import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useSchedules, mapDbToSchedule } from '@/hooks/use-schedules';
import { useChannels } from '@/hooks/use-channels';
import { useFeaturedPosts } from '@/hooks/use-featured-posts';
import { useExtraIncomes } from '@/hooks/use-extra-incomes';
import { resolveTier } from '@/lib/tier';
import type { Schedule } from '@/types';

// --- Constants for Defaults ---
const DEFAULT_AVAILABLE_STATUSES = [
  '재확인',
  '선정됨',
  '방문일 예약 완료',
  '방문',
  '제품 배송 완료',
];
const DEFAULT_AVAILABLE_CATEGORIES = [
  '맛집/식품',
  '뷰티',
  '생활/리빙',
  '출산/육아',
  '주방/가전',
  '반려동물',
  '여행/레저',
  '티켓/문화생활',
  '디지털/전자기기',
  '건강/헬스',
  '자동차/모빌리티',
  '문구/오피스',
  '기타',
];

// Helper function for client-side filtering
function filterSchedules(
  schedules: Schedule[],
  filters: {
    selectedDate: string | null;
    platforms: string[];
    statuses: string[];
    categories: string[];
    reviewTypes: string[];
    search: string;
    paybackOnly?: boolean;
  }
) {
  return schedules.filter((schedule) => {
    // 1. Date Check
    if (filters.selectedDate) {
      const date = filters.selectedDate;
      const hasDead = schedule.dead === date;
      const hasVisit = schedule.visit === date;
      const hasAdditional = schedule.additionalDeadlines?.some(
        (d) => d.date === date && !d.completed
      );
      // 단순 날짜 매칭 (API 로직과 유사하게)
      const hasAdditionalRaw = schedule.additionalDeadlines?.some((d) => d.date === date);

      if (!hasDead && !hasVisit && !hasAdditionalRaw) return false;
    }

    // 2. Platform Check
    if (filters.platforms.length > 0 && !filters.platforms.includes(schedule.platform)) {
      return false;
    }

    // 3. Status Check
    // 빈 배열이면 필터 적용 안 함 (전체 표시)
    // 날짜가 선택된 경우에는 해당 날짜의 모든 일정을 보여주기 위해 상태 필터를 적용하지 않습니다.
    if (
      !filters.selectedDate &&
      filters.statuses.length > 0 &&
      !filters.statuses.includes(schedule.status)
    ) {
      return false;
    }

    // 4. Category Check
    // 빈 배열이면 필터 적용 안 함 (전체 표시)
    if (
      filters.categories.length > 0 &&
      (!schedule.category || !filters.categories.includes(schedule.category))
    ) {
      return false;
    }

    // 5. Review Type Check
    if (
      filters.reviewTypes.length > 0 &&
      (!schedule.reviewType || !filters.reviewTypes.includes(schedule.reviewType))
    ) {
      return false;
    }

    // 6. Search Check
    if (filters.search && !schedule.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // 7. Payback Check
    if (filters.paybackOnly && !schedule.paybackExpected) {
      return false;
    }

    return true;
  });
}

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
  // useUserProfile: returns platforms (string[])
  const { profile, refetch: refetchUserProfile, loading: profileLoading } = useUserProfile();

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const { isPro } = resolveTier({
    profileTier: profile?.tier ?? undefined,
    metadata,
  });

  // 필터 상태 관리
  // 초기값에 기본 필터를 적용하여 첫 렌더링부터 일관된 데이터 표시
  const [filters, setFilters] = useState({
    selectedDate: null as string | null,
    platforms: [] as string[],
    paybackOnly: false,
    statuses: [] as string[],
    categories: [] as string[],
    reviewTypes: [] as string[],
    search: '',
    sortBy: 'deadline-asc',
  });

  const isDateFiltering = !!filters.selectedDate;

  // 날짜가 선택되지 않은 경우에만 useSchedules 활성화 (리스트용)
  // 날짜가 선택되면 캘린더 데이터를 사용
  // 또한 statuses가 설정되지 않은 초기 상태에서는 호출하지 않음
  const shouldEnableSchedules = isLoggedIn && !isDateFiltering;

  const {
    schedules: serverSchedules,
    loading: serverLoading,
    pagination,
    counts,
    platforms: serverPlatforms,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    loadMore,
  } = useSchedules({
    enabled: shouldEnableSchedules,
    selectedDate: filters.selectedDate,
    platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
    statuses: filters.statuses,
    categories: filters.categories,
    reviewTypes: filters.reviewTypes,
    search: filters.search,
    paybackOnly: filters.paybackOnly,
    sortBy: filters.sortBy,
  });

  // 서버에서 받아온 플랫폼 목록을 filters 상태와 별개로 관리하거나,
  // HomePage에 전달하여 선택 옵션으로 사용하게 함.
  // 현재 구조에서는 HomePage 컴포넌트가 userProfile 훅을 내부적으로 또 호출하고 있음 (platforms, categories 가져오기 위해).
  // 이를 page.tsx에서 내려주는 props로 대체해야 2번 호출 및 불일치 문제를 해결 가능.

  // HomePage component modification is needed to accept `platforms` prop instead of calling useUserProfile internally for options.
  // We should pass `serverPlatforms` (if available) or fallback to something.
  // Wait, serverPlatforms comes from schedules API.
  // If filters.platforms is empty, we get all used platforms.
  // If filters.platforms has value, we presumably only get those? No, the API modification gets ALL user platforms regardless of filter query.
  // See: `const { data: allUserSchedules } = await supabase...` in route.ts which is independent of current query filters.
  // So `serverPlatforms` will always contain all platforms the user has used.

  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (serverPlatforms && serverPlatforms.length > 0) {
      setAvailablePlatforms(serverPlatforms);
    }
  }, [serverPlatforms]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const handleCalendarMonthChange = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    setCalendarMonth(`${year}-${month}`);
  };

  const [monthlySchedulesCache, setMonthlySchedulesCache] = useState<Record<string, Schedule[]>>(
    {}
  );
  const [calendarLoading, setCalendarLoading] = useState(false);
  const monthlySchedulesCacheRef = useRef(monthlySchedulesCache);
  const fetchingMonthsRef = useRef<Set<string>>(new Set());

  // 최신 캐시를 ref에 동기화 (useEffect 안에서 의존성 없이 접근하기 위함)
  useEffect(() => {
    monthlySchedulesCacheRef.current = monthlySchedulesCache;
  }, [monthlySchedulesCache]);

  // 특정 월 데이터 fetch 함수
  const fetchMonthSchedules = useCallback(
    async (month: string, force = false) => {
      if (!user) return;

      // 이미 캐시에 있고 강제 요청이 아니면 리턴 (Use Ref to check cache)
      if (!force && monthlySchedulesCacheRef.current[month]) {
        return;
      }

      // 이미 fetching 중인 월이면 리턴 (중복 호출 방지)
      if (fetchingMonthsRef.current.has(month)) {
        return;
      }

      fetchingMonthsRef.current.add(month);
      setCalendarLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '1000',
          userId: user.id,
          month: month,
        });

        const response = await fetch(`/api/schedules?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          const fetchedSchedules = (data.schedules || []).map(mapDbToSchedule);
          setMonthlySchedulesCache((prev) => ({
            ...prev,
            [month]: fetchedSchedules,
          }));

          // 월별 데이터 가져올 때 플랫폼 정보도 업데이트
          if (data.platforms && data.platforms.length > 0) {
            setAvailablePlatforms((prev) => {
              // 병합 후 중복 제거
              const merged = Array.from(new Set([...prev, ...data.platforms]));
              return merged;
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch month schedules', e);
      } finally {
        setCalendarLoading(false);
        fetchingMonthsRef.current.delete(month);
      }
    },
    [user] // monthlySchedulesCache 의존성 제거
  );

  // 달력 월 변경 시 fetch (캐시 확인)
  useEffect(() => {
    if (calendarMonth && user) {
      fetchMonthSchedules(calendarMonth);
    }
  }, [calendarMonth, fetchMonthSchedules, user]);

  // 현재 보여줄 달력 데이터 (현재 월 + 이전/다음 월 캐시 포함)
  const calendarSchedules = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const formatDate = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

    // 이전 달 계산 (0월이면 작년 12월)
    const prevDate = new Date(year, month - 1 - 1, 1);
    const prevMonthKey = formatDate(prevDate.getFullYear(), prevDate.getMonth() + 1);

    // 다음 달 계산
    const nextDate = new Date(year, month - 1 + 1, 1);
    const nextMonthKey = formatDate(nextDate.getFullYear(), nextDate.getMonth() + 1);

    const current = monthlySchedulesCache[calendarMonth] || [];
    const prev = monthlySchedulesCache[prevMonthKey] || [];
    const next = monthlySchedulesCache[nextMonthKey] || [];

    // 중복 제거 (혹시 모를 중복 방지 - id 기준)
    const allSchedules = [...prev, ...current, ...next];
    const uniqueMap = new Map();
    allSchedules.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values());
  }, [monthlySchedulesCache, calendarMonth]);

  // 달력 점 표시용 데이터는 항상 전체(현재 월) 데이터를 사용합니다.

  // 클라이언트 사이드 필터링 (날짜 선택 시에만)
  const filteredClientSchedules = useMemo(() => {
    if (isDateFiltering && calendarSchedules) {
      return filterSchedules(calendarSchedules, filters);
    }
    return [];
  }, [calendarSchedules, filters, isDateFiltering]);

  // 최종 표시할 데이터 결정
  const schedules = isDateFiltering ? filteredClientSchedules : serverSchedules;

  // 로딩 상태 결정
  const schedulesLoading = isDateFiltering ? calendarLoading : serverLoading;

  // 페이지네이션 정보
  const effectivePagination = isDateFiltering
    ? { offset: 0, limit: schedules.length, total: schedules.length, hasMore: false }
    : pagination;

  // 카운트 정보
  const effectiveCounts = isDateFiltering
    ? {
        total: schedules.length,
        visit: schedules.filter((s) => !!s.visit).length,
        deadline: schedules.filter((s) => !!s.dead).length,
      }
    : counts;

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
    if (showPortfolio && (channelsLoading || featuredPostsLoading)) return true;
    if (currentPage === 'profile' && extraIncomesLoading) return true;
    return false;
  };

  const isDataLoading = getIsDataLoading();
  const scheduleId = searchParams.get('schedule');
  const initialDeadline = searchParams.get('date') ?? undefined;
  const [homeCalendarFocusDate, setHomeCalendarFocusDate] = useState<string | null>(null);
  const mapSearchRequested = searchParams.get('mapSearch') === 'true';
  const mapSearchAutoSaveRequested = searchParams.get('mapSearchAutoSave') === 'true';
  const [statusChangeIntent, setStatusChangeIntent] = useState(false);

  const isNewSchedule = searchParams.get('new') === 'true';
  const showAllSchedules = view === 'all';
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
      if (!editingScheduleId && createdSchedule?.dead) {
        setHomeCalendarFocusDate(createdSchedule.dead);
        handleCloseScheduleModal();
        // 데이터 변경 시 현재 월 데이터 갱신 (캐시 무효화)
        fetchMonthSchedules(calendarMonth, true);
      } else if (editingScheduleId) {
        handleCloseScheduleModal();
        // 수정 시에는 캐시 직접 업데이트 (API 재호출 방지)
        setMonthlySchedulesCache((prev) => {
          const nextCache = { ...prev };
          Object.keys(nextCache).forEach((monthKey) => {
            nextCache[monthKey] = nextCache[monthKey].map((s) =>
              s.id === editingScheduleId ? { ...s, ...schedule } : s
            );
          });
          return nextCache;
        });
      }
    }
    return success;
  };

  const handleDeleteSchedule = async (id: number) => {
    await deleteSchedule(id);
    handleCloseScheduleModal();
    // 데이터 삭제 시 현재 월 데이터 갱신
    fetchMonthSchedules(calendarMonth, true);
  };

  const handleUpdateScheduleFiles = async (id: number, files: import('@/types').GuideFile[]) => {
    await updateSchedule(id, { guideFiles: files });
    fetchMonthSchedules(calendarMonth, true);
  };

  const handleCompleteSchedule = async (id: number) => {
    await updateSchedule(id, { status: '완료' });
    setMonthlySchedulesCache((prev) => {
      const nextCache = { ...prev };
      Object.keys(nextCache).forEach((monthKey) => {
        nextCache[monthKey] = nextCache[monthKey].map((s) =>
          s.id === id ? { ...s, status: '완료' } : s
        );
      });
      return nextCache;
    });
  };

  const handleCompletedStatusEdit = (id: number) => {
    handleOpenScheduleModal(id, { statusChangeIntent: true });
  };

  const handleConfirmPayback = async (id: number) => {
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return;
    const nextVal = !schedule.paybackConfirmed;
    await updateSchedule(id, { paybackConfirmed: nextVal });
    setMonthlySchedulesCache((prev) => {
      const nextCache = { ...prev };
      Object.keys(nextCache).forEach((monthKey) => {
        nextCache[monthKey] = nextCache[monthKey].map((s) =>
          s.id === id ? { ...s, paybackConfirmed: nextVal } : s
        );
      });
      return nextCache;
    });
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
    setMonthlySchedulesCache((prev) => {
      const nextCache = { ...prev };
      Object.keys(nextCache).forEach((monthKey) => {
        nextCache[monthKey] = nextCache[monthKey].map((s) =>
          s.id === scheduleId ? { ...s, additionalDeadlines: updatedDeadlines } : s
        );
      });
      return nextCache;
    });
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

  const handleFilterChange = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

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

  // 홈 페이지가 아닌 다른 페이지의 로딩 처리
  if (isDataLoading && currentPage !== 'home') {
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
              onCompletedClick={handleCompletedStatusEdit}
              onPaybackConfirm={handleConfirmPayback}
              onAdditionalDeadlineToggle={handleAdditionalDeadlineToggle}
            />
          ) : (
            <>
              {currentPage === 'home' && (
                <HomePage
                  schedules={schedules}
                  calendarSchedules={calendarSchedules}
                  onScheduleClick={handleOpenScheduleModal}
                  onShowAllClick={handleShowAllSchedules}
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
                  loading={schedulesLoading}
                  hasMore={effectivePagination?.hasMore}
                  onLoadMore={loadMore}
                  totalCount={effectiveCounts?.total}
                  visitCount={effectiveCounts?.visit}
                  deadlineCount={effectiveCounts?.deadline}
                  onFilterChange={handleFilterChange}
                  onCalendarMonthChange={handleCalendarMonthChange}
                  calendarLoading={calendarLoading}
                  availablePlatforms={availablePlatforms}
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
            statusChangeIntent={statusChangeIntent}
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
