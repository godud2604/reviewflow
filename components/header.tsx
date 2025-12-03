"use client"

export default function Header({ title, onProfileClick }: { title: string; onProfileClick: () => void }) {
  const now = new Date()
  const days = ["일", "월", "화", "수", "목", "금", "토"]
  const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`

  return (
    <header className="px-6 pt-12 pb-2 flex justify-between items-start">
      <div>
        <div className="text-[13px] text-neutral-500 font-semibold mb-1">{dateStr}</div>
        <h1 className="text-[26px] font-extrabold text-[#1A1A1A] tracking-tight">{title}</h1>
      </div>
      <div
        className="w-10 h-10 rounded-full bg-neutral-200 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95"
        style={{
          backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
          backgroundSize: "cover",
        }}
        onClick={onProfileClick}
      />
    </header>
  )
}
