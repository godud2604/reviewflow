"use client"

import type { Schedule, Channel, FeaturedPost } from "@/types"

export default function PortfolioPage({ 
  schedules,
  channels,
  featuredPosts,
  onBack
}: { 
  schedules: Schedule[]
  channels: Channel[]
  featuredPosts: FeaturedPost[]
  onBack: () => void
}) {
  // Calculate stats for advertisers
  const totalSchedules = schedules.length
  const completedSchedules = schedules.filter(s => s.status === "완료").length
  
  // Category distribution
  const typeCounts: Record<Schedule["category"], number> = {
    "맛집/식품": 0,
    "뷰티": 0,
    "생활/리빙": 0,
    "출산/육아": 0,
    "주방/가전": 0,
    반려동물: 0,
    "여행/레저": 0,
    "티켓/문화생활": 0,
    "디지털/전자기기": 0,
    "건강/헬스": 0,
    "자동차/모빌리티": 0,
    "문구/오피스": 0,
    기타: 0,
  }
  
  schedules.forEach((s) => {
    if (typeCounts[s.category] !== undefined) typeCounts[s.category]++
  })
  
  const topCategories = (Object.entries(typeCounts) as [Schedule["category"], number][])
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  
  const categoryIcons: Record<Schedule["category"], string> = {
    "맛집/식품": "🍽️",
    "뷰티": "💄",
    "생활/리빙": "🏡",
    "출산/육아": "🤱",
    "주방/가전": "🧺",
    반려동물: "🐶",
    "여행/레저": "✈️",
    "티켓/문화생활": "🎫",
    "디지털/전자기기": "🎧",
    "건강/헬스": "💪",
    "자동차/모빌리티": "🚗",
    "문구/오피스": "✏️",
    기타: "📦",
  }

  // Channel icons
  const channelIcons: Record<Channel["type"], string> = {
    네이버블로그: "📝",
    인스타그램: "📷",
    유튜브: "🎥",
    틱톡: "🎵",
    쓰레드: "🧵",
  }

  // Extract brands from schedules
  const brands = [...new Set(schedules
    .filter(s => s.status === "완료")
    .map(s => s.title.split(" ")[0])
    .slice(0, 6)
  )]

  const handleShare = () => {
    alert("🔗 포트폴리오 링크가 복사되었습니다!")
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-24 scrollbar-hide touch-pan-y relative">
      {/* Header with back button and share */}
      <div className="flex items-center justify-between pt-2 pb-4 sticky top-0 bg-[#F7F7F8] z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-neutral-600 font-semibold"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-sm">뒤로</span>
        </button>
        <span
          onClick={handleShare}
          className="bg-white px-3 py-1.5 rounded-2xl text-sm font-bold shadow-md cursor-pointer"
        >
          🔗 공유
        </span>
      </div>

      {/* Profile Header */}
      <div className="text-center mb-6">
        <div
          className="w-[100px] h-[100px] rounded-full mx-auto mb-4 bg-neutral-200"
          style={{
            backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
            backgroundSize: "cover",
          }}
        />
        <h2 className="text-xl font-bold mb-1">김제미</h2>
        <div className="text-neutral-500 text-sm mb-3">
          {topCategories.length > 0 
            ? `${topCategories.map(([cat]) => cat).join(" & ")} 리뷰어` 
            : "리뷰어"}
        </div>
        {/* Channel badges */}
        {channels.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {channels.map((channel) => (
              <span
                key={channel.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700"
              >
                {channelIcons[channel.type]} {channel.type}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Channel Statistics */}
      {channels.length > 0 && (
        <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
          <div className="text-lg font-bold mb-4">채널 통계</div>
          <div className="space-y-3">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-neutral-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{channelIcons[channel.type]}</span>
                  <span className="font-bold text-[15px]">{channel.type}</span>
                </div>
                <div className="text-sm text-neutral-600 space-y-1">
                  {channel.type === "네이버블로그" ? (
                    <>
                      {channel.followers && <div>이웃 {channel.followers.toLocaleString()}</div>}
                      {channel.monthlyVisitors && <div>월 방문 {(channel.monthlyVisitors / 10000).toFixed(1)}만</div>}
                    </>
                  ) : (
                    <>
                      {channel.followers && <div>팔로워 {channel.followers.toLocaleString()}</div>}
                      {channel.avgReach && <div>평균 도달 {(channel.avgReach / 10000).toFixed(1)}만</div>}
                      {channel.avgEngagement && <div>평균 참여율 {channel.avgEngagement}%</div>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expertise */}
      {topCategories.length > 0 && (
        <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
          <div className="text-lg font-bold mb-3">전문 분야</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {topCategories.map(([category, count], i) => {
              const percentage = Math.round((count / totalSchedules) * 100)
              return (
                <span key={i} className="text-neutral-600">
                  {categoryIcons[category]} {category} <span className="font-bold text-neutral-800">{percentage}%</span>
                  {i < topCategories.length - 1 && <span className="text-neutral-300 mx-1">|</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
        <div className="text-lg font-bold mb-3">최근 활동</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-50 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-neutral-800">{totalSchedules}건</div>
            <div className="text-xs text-neutral-500 mt-1">이번 달 협업</div>
          </div>
          <div className="bg-neutral-50 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-neutral-800">{completedSchedules}건</div>
            <div className="text-xs text-neutral-500 mt-1">누적 완료</div>
          </div>
        </div>
      </div>

      {/* Collaboration Brands */}
      {brands.length > 0 && (
        <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
          <div className="text-lg font-bold mb-3">주요 협업 브랜드</div>
          <div className="flex flex-wrap gap-2">
            {brands.map((brand, i) => (
              <span
                key={i}
                className="inline-block px-3 py-1.5 bg-neutral-100 rounded-full text-xs font-semibold text-neutral-700"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Featured Posts */}
      {featuredPosts.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="text-lg font-bold mb-3">대표 포스팅</div>
          <div className="grid grid-cols-3 gap-2">
            {featuredPosts.map((post) => (
              <div key={post.id} className="relative">
                <div 
                  className="aspect-square bg-neutral-200 rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => window.open(post.url, '_blank')}
                  style={{
                    backgroundImage: `url(${post.thumbnail})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {post.views >= 10000 ? `${(post.views / 10000).toFixed(1)}만` : post.views.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
