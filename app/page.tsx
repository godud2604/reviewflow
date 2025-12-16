"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"
import HomePage from "@/components/home-page"
import AllSchedulesPage from "@/components/all-schedules-page"
import StatsPage from "@/components/stats-page"
import ProfilePage from "@/components/profile-page"
import PortfolioPage from "@/components/portfolio-page"
import NavigationBar from "@/components/navigation-bar"
import ScheduleModal from "@/components/schedule-modal"
import TodoModal from "@/components/todo-modal"
import LandingPage from "@/components/landing-page"
import { useAuth } from "@/hooks/use-auth"
import { useSchedules } from "@/hooks/use-schedules"
import { useTodos } from "@/hooks/use-todos"
import { useChannels } from "@/hooks/use-channels"
import { useFeaturedPosts } from "@/hooks/use-featured-posts"
import { useExtraIncomes } from "@/hooks/use-extra-incomes"
import type { Schedule } from "@/types"

function PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 기반 상태 관리 (먼저 계산)
  const page = searchParams.get("page") || "landing"
  const view = searchParams.get("view")
  const isLandingPage = page === "landing"
  const currentPage = (page === "home" || page === "stats" || page === "profile") ? page : "home"
  const showPortfolio = view === "portfolio"
  
  // Auth Hook
  const { user, loading: authLoading } = useAuth()
  
  // 페이지별 필요한 데이터만 fetch하도록 enabled 옵션 설정
  // - schedules: home, stats, profile, portfolio 모두 필요
  // - todos: home에서만 필요
  // - channels: portfolio에서만 필요
  // - featuredPosts: portfolio에서만 필요
  // - extraIncomes: profile에서만 필요
  const isLoggedIn = !!user && !isLandingPage
  
  const { 
    schedules, 
    loading: schedulesLoading, 
    createSchedule, 
    updateSchedule, 
    deleteSchedule 
  } = useSchedules({ enabled: isLoggedIn })
  
  const { 
    todos, 
    loading: todosLoading, 
    addTodo, 
    toggleTodo, 
    deleteTodo 
  } = useTodos({ enabled: isLoggedIn && currentPage === "home" })
  
  const { channels, loading: channelsLoading } = useChannels({ 
    enabled: isLoggedIn && showPortfolio 
  })
  
  const { featuredPosts, loading: featuredPostsLoading } = useFeaturedPosts({ 
    enabled: isLoggedIn && showPortfolio 
  })
  
  const { extraIncomes, loading: extraIncomesLoading } = useExtraIncomes({ 
    enabled: isLoggedIn && currentPage === "profile" 
  })
  
  // 현재 페이지에 필요한 데이터만 로딩 체크
  const getIsDataLoading = () => {
    // 스케줄은 항상 필요
    if (schedulesLoading) return true
    
    // home 페이지: todos 필요
    if (currentPage === "home" && todosLoading) return true
    
    // portfolio 뷰: channels, featuredPosts 필요
    if (showPortfolio && (channelsLoading || featuredPostsLoading)) return true
    
    // profile 페이지: extraIncomes 필요
    if (currentPage === "profile" && extraIncomesLoading) return true
    
    return false
  }
  
  const isDataLoading = getIsDataLoading()
  const scheduleId = searchParams.get("schedule")
  const isNewSchedule = searchParams.get("new") === "true"
  const isTodoModalOpen = searchParams.get("todo") === "true"

  const showAllSchedules = view === "all"
  const isScheduleModalOpen = scheduleId !== null || isNewSchedule
  const editingScheduleId = scheduleId ? parseInt(scheduleId) : null

  const handleOpenScheduleModal = (scheduleId?: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (scheduleId) {
      params.set("schedule", scheduleId.toString())
    } else {
      params.set("new", "true")
    }
    router.push(`?${params.toString()}`)
  }

  const handleCloseScheduleModal = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("schedule")
    params.delete("new")
    router.push(`?${params.toString()}`)
  }

  const handleSaveSchedule = async (schedule: Schedule) => {
    if (editingScheduleId) {
      // 기존 스케줄 업데이트
      const { id, ...updates } = schedule
      await updateSchedule(editingScheduleId, updates)
    } else {
      // 새 스케줄 생성
      const { id, ...newSchedule } = schedule
      await createSchedule(newSchedule)
    }
    handleCloseScheduleModal()
  }

  const handleDeleteSchedule = async (id: number) => {
    await deleteSchedule(id)
    handleCloseScheduleModal()
  }

  const handleUpdateScheduleFiles = async (id: number, files: import("@/types").GuideFile[]) => {
    await updateSchedule(id, { guideFiles: files })
  }

  const handleCompleteSchedule = async (id: number) => {
    await updateSchedule(id, { status: "완료" })
  }

  const handleAddTodo = async (text: string) => {
    await addTodo(text)
  }

  const handleToggleTodo = async (id: number) => {
    await toggleTodo(id)
  }

  const handleDeleteTodo = async (id: number) => {
    await deleteTodo(id)
  }

  const handlePageChange = (newPage: "home" | "stats" | "profile") => {
    router.push(`?page=${newPage}`)
  }

  const handleGoRoot = () => {
    router.push("/")
  }

  const handleShowAllSchedules = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", "all")
    router.push(`?${params.toString()}`)
  }

  const handleBackFromAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    router.push(`?${params.toString()}`)
  }

  const handleShowPortfolio = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", "portfolio")
    router.push(`?${params.toString()}`)
  }

  const handleBackFromPortfolio = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    router.push(`?${params.toString()}`)
  }

  const handleOpenTodoModal = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("todo", "true")
    router.push(`?${params.toString()}`)
  }

  const handleCloseTodoModal = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("todo")
    router.push(`?${params.toString()}`)
  }

  const getPageTitle = () => {
    if (showPortfolio) return "내 포트폴리오"
    if (showAllSchedules) return "전체 체험단 리스트"
    switch (currentPage) {
      case "home":
        return "나의 일정"
      case "stats":
        return "수익 리포트"
      case "profile":
        return "내 프로필"
    }
  }

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 랜딩 페이지 표시 (비로그인 상태 또는 landing 페이지)
  if (isLandingPage || !user) {
    return <LandingPage />
  }

  // 데이터 로딩 중
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-neutral-200 md:flex md:items-center md:justify-center md:p-4">
        <div className="w-full md:max-w-[390px] h-screen md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mb-2"></div>
          <p className="text-gray-500 text-sm">데이터 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-200 md:flex md:items-center md:justify-center md:p-4">
      <div className="w-full md:max-w-[390px] h-screen md:h-[844px] md:max-h-[90vh] bg-[#F7F7F8] relative overflow-hidden md:rounded-[40px] shadow-2xl flex flex-col">
        <Header />

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
          />
        ) : (
          <>
            {currentPage === "home" && (
              <HomePage
                schedules={schedules}
                onScheduleClick={handleOpenScheduleModal}
                onShowAllClick={handleShowAllSchedules}
                onCompleteClick={handleCompleteSchedule}
                onAddClick={() => handleOpenScheduleModal()}
              />
            )}

            {currentPage === "stats" && (
              <StatsPage
                schedules={schedules}
                onScheduleItemClick={(schedule) => handleOpenScheduleModal(schedule.id)}
                isScheduleModalOpen={isScheduleModalOpen}
              />
            )}

            {currentPage === "profile" && (
              <ProfilePage 
                onShowPortfolio={handleShowPortfolio} 
                schedules={schedules}
                extraIncomes={extraIncomes}
              />
            )}
          </>
        )}

        <NavigationBar
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onAddClick={() => handleOpenScheduleModal()}
          onHomeClick={handleGoRoot}
        />

        {isScheduleModalOpen && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={handleCloseScheduleModal}
            onSave={handleSaveSchedule}
            onDelete={handleDeleteSchedule}
            onUpdateFiles={handleUpdateScheduleFiles}
            schedule={editingScheduleId ? schedules.find((s) => s.id === editingScheduleId) : undefined}
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
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-200 flex items-center justify-center">Loading...</div>}>
      <PageContent />
    </Suspense>
  )
}
