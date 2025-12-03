"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import HomePage from "@/components/home-page"
import StatsPage from "@/components/stats-page"
import ProfilePage from "@/components/profile-page"
import NavigationBar from "@/components/navigation-bar"
import ScheduleModal from "@/components/schedule-modal"
import TodoModal from "@/components/todo-modal"
import type { Schedule, Todo } from "@/types"

export default function Page() {
  const [currentPage, setCurrentPage] = useState<"home" | "stats" | "profile">("home")
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)

  // Initialize with demo data
  useEffect(() => {
    const storedSchedules = localStorage.getItem("schedules")
    const storedTodos = localStorage.getItem("todos")

    if (storedSchedules) {
      setSchedules(JSON.parse(storedSchedules))
    } else {
      const demoData: Schedule[] = [
        {
          id: 1,
          title: "강남 오스테리아",
          status: "visit",
          platform: "레뷰",
          type: "맛집",
          visit: "2025-12-05",
          dead: "2025-12-07",
          benefit: 50000,
          income: 0,
          cost: 5000,
          link: "",
          memo: "",
        },
        {
          id: 2,
          title: "아이오페 세럼",
          status: "ready",
          platform: "강남맛집",
          type: "뷰티",
          visit: "",
          dead: "2025-12-10",
          benefit: 35000,
          income: 0,
          cost: 0,
          link: "",
          memo: "",
        },
        {
          id: 3,
          title: "제주 호텔",
          status: "done",
          platform: "디너의여왕",
          type: "숙박",
          visit: "2025-12-01",
          dead: "2025-12-03",
          benefit: 200000,
          income: 0,
          cost: 20000,
          link: "",
          memo: "",
        },
         {
          id: 4,
          title: "제주 호텔",
          status: "done",
          platform: "디너의여왕",
          type: "숙박",
          visit: "2025-12-01",
          dead: "2025-12-03",
          benefit: 200000,
          income: 0,
          cost: 20000,
          link: "",
          memo: "",
        },
         {
          id: 5,
          title: "제주 호텔",
          status: "done",
          platform: "디너의여왕",
          type: "숙박",
          visit: "2025-12-01",
          dead: "2025-12-03",
          benefit: 200000,
          income: 0,
          cost: 20000,
          link: "",
          memo: "",
        },
      ]
      setSchedules(demoData)
      localStorage.setItem("schedules", JSON.stringify(demoData))
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
    if (confirm("정말 삭제하시겠습니까?")) {
      setSchedules(schedules.filter((s) => s.id !== id))
      setIsScheduleModalOpen(false)
      setEditingScheduleId(null)
    }
  }

  const handleAddTodo = (text: string) => {
    setTodos([...todos, { id: Date.now(), text, done: false }])
  }

  const handleToggleTodo = (id: number) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter((t) => t.id !== id))
  }

  const getPageTitle = () => {
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
        <Header title={getPageTitle()} onProfileClick={() => setCurrentPage("profile")} />

        {currentPage === "home" && <HomePage schedules={schedules} onScheduleClick={handleOpenScheduleModal} />}

        {currentPage === "stats" && <StatsPage schedules={schedules} />}

        {currentPage === "profile" && <ProfilePage />}

        <NavigationBar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onAddClick={() => handleOpenScheduleModal()}
          onTodoClick={() => setIsTodoModalOpen(true)}
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
