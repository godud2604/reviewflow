"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import HomePage from "@/components/home-page"
import AllSchedulesPage from "@/components/all-schedules-page"
import StatsPage from "@/components/stats-page"
import ProfilePage from "@/components/profile-page"
import PortfolioPage from "@/components/portfolio-page"
import NavigationBar from "@/components/navigation-bar"
import ScheduleModal from "@/components/schedule-modal"
import TodoModal from "@/components/todo-modal"
import type { Schedule, Todo, Channel, FeaturedPost } from "@/types"

export default function Page() {
  const [currentPage, setCurrentPage] = useState<"home" | "stats" | "profile">("home")
  const [showAllSchedules, setShowAllSchedules] = useState(false)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)

  // Initialize with demo data
  useEffect(() => {
    const storedSchedules = localStorage.getItem("schedules")
    const storedTodos = localStorage.getItem("todos")
    const storedChannels = localStorage.getItem("channels")
    const storedFeaturedPosts = localStorage.getItem("featuredPosts")

    if (storedSchedules) {
      setSchedules(JSON.parse(storedSchedules))
    } else {
      const demoData: Schedule[] = [
        {
          id: 1,
          title: "강남 오스테리아",
          status: "방문",
          platform: "레뷰",
          reviewType: "방문형",
          channel: "네이버블로그",
          category: "맛집",
          region: "서울",
          visit: "2025-12-05",
          dead: "2025-12-07",
          benefit: 50000,
          income: 0,
          cost: 5000,
          postingLink: "",
          purchaseLink: "",
          guideLink: "",
          guideFiles: [],
          memo: "",
        },
        {
          id: 2,
          title: "아이오페 세럼",
          status: "선정됨",
          platform: "리뷰노트",
          reviewType: "제공형",
          channel: "인스타그램",
          category: "뷰티",
          region: "서울",
          visit: "",
          dead: "2025-12-10",
          benefit: 35000,
          income: 0,
          cost: 0,
          postingLink: "",
          purchaseLink: "",
          guideLink: "",
          guideFiles: [],
          memo: "",
        },
        {
          id: 3,
          title: "제주 호텔",
          status: "완료",
          platform: "리뷰플레이스",
          reviewType: "제공형",
          channel: "네이버블로그",
          category: "여행",
          region: "제주",
          visit: "2025-12-01",
          dead: "2025-12-03",
          benefit: 200000,
          income: 0,
          cost: 20000,
          postingLink: "",
          purchaseLink: "",
          guideLink: "",
          guideFiles: [],
          memo: "",
        },
      ]
      setSchedules(demoData)
      localStorage.setItem("schedules", JSON.stringify(demoData))
    }

    if (storedChannels) {
      setChannels(JSON.parse(storedChannels))
    } else {
      const demoChannels: Channel[] = [
        {
          id: 1,
          type: "네이버블로그",
          name: "김제미의 맛집일기",
          followers: 1234,
          monthlyVisitors: 52000,
          url: "https://blog.naver.com/example"
        },
        {
          id: 2,
          type: "인스타그램",
          name: "@jemi_review",
          followers: 8500,
          avgReach: 21000,
          avgEngagement: 8.5,
          url: "https://instagram.com/example"
        }
      ]
      setChannels(demoChannels)
      localStorage.setItem("channels", JSON.stringify(demoChannels))
    }

    if (storedFeaturedPosts) {
      setFeaturedPosts(JSON.parse(storedFeaturedPosts))
    } else {
      const demoPosts: FeaturedPost[] = [
        {
          id: 1,
          title: "강남 맛집 리뷰",
          thumbnail: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
          url: "https://example.com/post1",
          views: 12000,
          channel: "네이버블로그"
        },
        {
          id: 2,
          title: "뷰티 제품 후기",
          thumbnail: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400",
          url: "https://example.com/post2",
          views: 8500,
          channel: "인스타그램"
        },
        {
          id: 3,
          title: "제주 여행 브이로그",
          thumbnail: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
          url: "https://example.com/post3",
          views: 15000,
          channel: "네이버블로그"
        }
      ]
      setFeaturedPosts(demoPosts)
      localStorage.setItem("featuredPosts", JSON.stringify(demoPosts))
    }

    if (storedTodos) {
      setTodos(JSON.parse(storedTodos))
    } else {
      const demoTodos: Todo[] = [
        { id: 1, text: "영수증 챙기기", done: false },
        { id: 2, text: "답방 가기", done: true },
      ]
      setTodos(demoTodos)
      localStorage.setItem("todos", JSON.stringify(demoTodos))
    }
  }, [])

  // Persist schedules to localStorage
  useEffect(() => {
    if (schedules.length > 0) {
      localStorage.setItem("schedules", JSON.stringify(schedules))
    }
  }, [schedules])

  // Persist todos to localStorage
  useEffect(() => {
    if (todos.length > 0) {
      localStorage.setItem("todos", JSON.stringify(todos))
    }
  }, [todos])

  const handleOpenScheduleModal = (scheduleId?: number) => {
    setEditingScheduleId(scheduleId || null)
    setIsScheduleModalOpen(true)
  }

  const handleSaveSchedule = (schedule: Schedule) => {
    if (editingScheduleId) {
      setSchedules(schedules.map((s) => (s.id === editingScheduleId ? schedule : s)))
    } else {
      setSchedules([...schedules, { ...schedule, id: Date.now() }])
    }
    setIsScheduleModalOpen(false)
    setEditingScheduleId(null)
  }

  const handleDeleteSchedule = (id: number) => {
    setSchedules(schedules.filter((s) => s.id !== id))
    setIsScheduleModalOpen(false)
    setEditingScheduleId(null)
  }

  const handleAddTodo = (text: string) => {
    setTodos(prevTodos => {
      const newId = prevTodos.length > 0 ? Math.max(...prevTodos.map(t => t.id)) + 1 : 1
      return [...prevTodos, { id: newId, text, done: false }]
    })
  }

  const handleToggleTodo = (id: number) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter((t) => t.id !== id))
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

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-[#F7F7F8] relative overflow-hidden rounded-[40px] shadow-2xl flex flex-col">
        <Header 
          title={getPageTitle()} 
          onProfileClick={() => setCurrentPage("profile")} 
          onTodoClick={() => setIsTodoModalOpen(true)}
          todos={todos}
          showTodoButton={currentPage === "home" && !showAllSchedules && !showPortfolio}
        />

        {showPortfolio ? (
          <PortfolioPage
            schedules={schedules}
            channels={channels}
            featuredPosts={featuredPosts}
            onBack={() => setShowPortfolio(false)}
          />
        ) : showAllSchedules ? (
          <AllSchedulesPage
            schedules={schedules}
            onScheduleClick={handleOpenScheduleModal}
            onBack={() => setShowAllSchedules(false)}
          />
        ) : (
          <>
            {currentPage === "home" && (
              <HomePage
                schedules={schedules}
                onScheduleClick={handleOpenScheduleModal}
                onShowAllClick={() => setShowAllSchedules(true)}
              />
            )}

            {currentPage === "stats" && <StatsPage schedules={schedules} />}

            {currentPage === "profile" && <ProfilePage onShowPortfolio={() => setShowPortfolio(true)} />}
          </>
        )}

        <NavigationBar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onAddClick={() => handleOpenScheduleModal()}
        />

        {isScheduleModalOpen && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => {
              setIsScheduleModalOpen(false)
              setEditingScheduleId(null)
            }}
            onSave={handleSaveSchedule}
            onDelete={handleDeleteSchedule}
            schedule={editingScheduleId ? schedules.find((s) => s.id === editingScheduleId) : undefined}
          />
        )}

        {isTodoModalOpen && (
          <TodoModal
            isOpen={isTodoModalOpen}
            onClose={() => setIsTodoModalOpen(false)}
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
