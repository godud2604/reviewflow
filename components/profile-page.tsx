"use client"

import { useState } from "react"

export default function ProfilePage() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const handleLogout = () => {
    alert("로그아웃 되었습니다.")
  }

  const menuItems = [
    { id: "notification", icon: "🔔", label: "알림 설정" },
    { id: "backup", icon: "📂", label: "데이터 백업" },
    { id: "support", icon: "📞", label: "고객센터" },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 scrollbar-hide">
      <div className="text-center mt-5 mb-10">
        <div
          className="w-[100px] h-[100px] rounded-full mx-auto mb-5 bg-neutral-200"
          style={{
            backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
            backgroundSize: "cover",
          }}
        />
        <h2 className="text-xl font-bold my-2.5">김제미 님</h2>
        <div className="text-neutral-500 text-sm">Super Blogger · Lv. 3</div>
      </div>

      <div className="bg-white rounded-3xl p-4 mb-5 shadow-sm">
        {menuItems.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => setActiveMenu(item.id)}
            className={`
              py-3.5 px-3 font-semibold cursor-pointer rounded-xl
              flex items-center gap-3
              transition-all duration-200
              hover:bg-neutral-50
              active:scale-[0.98]
              ${idx !== menuItems.length - 1 ? "border-b border-neutral-100" : ""}
              ${activeMenu === item.id ? "bg-neutral-50" : ""}
            `}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="flex-1 text-[15px]">{item.label}</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-neutral-400"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="w-full p-4 bg-neutral-200 text-[#333] border-none rounded-2xl font-bold cursor-pointer
          transition-all duration-200 hover:bg-neutral-300 active:scale-[0.98]"
      >
        로그아웃
      </button>
    </div>
  )
}
