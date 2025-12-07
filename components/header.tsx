"use client"

import { FileText, LogOut } from "lucide-react"
import type { Todo } from "@/types"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Header({ 
  title, 
  onProfileClick, 
  onTodoClick,
  todos,
  showTodoButton = true
}: { 
  title: string
  onProfileClick: () => void
  onTodoClick: () => void
  todos: Todo[]
  showTodoButton?: boolean
}) {
  const incompleteTodoCount = todos.filter(t => !t.done).length
  const { user, isAuthenticated, signOut, loading } = useAuth()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("로그아웃 실패:", error)
    }
  }

  return (
    <header className="px-6 pt-12 pb-1">
      <div className="flex items-center justify-between mb-2">
        {showTodoButton ? (
          <button
            onClick={onTodoClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm hover:shadow-md transition-all active:scale-95 border border-neutral-200 relative"
          >
            <FileText className="w-4 h-4 text-neutral-700" />
            <span className="text-[13px] font-semibold text-neutral-700 cursor-pointer">할 일</span>
            {incompleteTodoCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                {incompleteTodoCount}
              </span>
            )}
          </button>
        ) : (
          <div />
        )}
        
        <div className="relative">
          <div
            className="w-10 h-10 rounded-full bg-neutral-200 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95"
            style={{
              backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
              backgroundSize: "cover",
            }}
            onClick={() => setShowMenu(!showMenu)}
          />
          
          {/* User Menu Dropdown */}
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                {!loading && (
                  <>
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-xs text-gray-500">로그인됨</p>
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {user?.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowMenu(false)
                            onProfileClick()
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          프로필
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          로그아웃
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setShowMenu(false)
                            router.push("/signin")
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          로그인
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false)
                            router.push("/signup")
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-[#FF5722] hover:bg-orange-50 cursor-pointer"
                        >
                          회원가입
                        </button>
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              onProfileClick()
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                          >
                            프로필 (체험 모드)
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
