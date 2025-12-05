"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function LandingPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleFreeTrial = () => {
    router.push("/?page=home")
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setEmail("")
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다. 다시 시도해주세요.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-visible')
        }
      })
    }, observerOptions)

    const animateElements = document.querySelectorAll('.scroll-animate')
    animateElements.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-[#F2F4F6] overflow-x-hidden">
      <style jsx global>{`
        .scroll-animate {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .scroll-animate.scroll-visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .scroll-animate {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }

        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.8s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md transition-all duration-300 border-b border-transparent">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <a href="#" className="flex items-center">
            <img src="/logo.png" alt="ReviewFlow" className="h-40" />
          </a>
          <button
            onClick={handleFreeTrial}
            className="bg-[#FF5722] text-white px-5 py-2 rounded-3xl font-medium text-sm hover:bg-[#E64A19] transition"
          >
            무료체험
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center pt-32 pb-10 bg-gradient-to-b from-white via-orange-50/30 to-white relative overflow-hidden">
        {/* Background Animation Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        </div>

        <div className="max-w-4xl px-6 relative z-10">
          {/* Badge with animation */}
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold mb-6 animate-fade-in-down">
            <span className="text-lg">🎉</span>
            <span>체험단 관리의 새로운 기준</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold leading-tight mb-4 text-[#1A1A1A] animate-fade-in-up tracking-tight">
            리뷰 관리,
            <br />
            <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 bg-clip-text text-transparent">
              이제 스트레스 받지 마세요
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-[#4A5568] font-semibold leading-relaxed mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            일정 체크부터 수익 정산까지.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={handleFreeTrial}
              className="group bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-base md:text-lg font-bold shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-105 transition-all duration-300 flex items-center gap-3 cursor-pointer"
            >
              지금 무료로 체험하기
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="bg-white text-orange-600 px-6 md:px-8 py-3 md:py-4 rounded-full text-base md:text-lg font-bold border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 cursor-pointer">
              사전 신청하기
            </button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-5xl font-bold leading-tight mb-6 text-[#191F28]">
            "아 맞다, 그 체험단 오늘까지였나?"
          </h2>
          <p className="text-lg md:text-xl text-[#8B95A1] font-medium">
            깜빡해서 패널티 물고, 정산 놓치고...
            <br />
            복잡한 엑셀과 메모장은 이제 그만두세요.
          </p>
        </div>
      </section>

      {/* Feature 1: 일정 관리 */}
      <section className="bg-white py-20 md:py-32 overflow-hidden scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px]">
              <span className="text-[#FF5722] font-bold text-base md:text-lg mb-4 block">일정 관리</span>
                <h2 className="text-3xl md:text-6xl font-bold leading-tight mb-6 text-[#191F28]">
                  겹치는 일정,
                  <br />
                  한눈에 보여드려요
                </h2>
                <p className="text-lg md:text-xl text-[#6B7684] leading-relaxed">
                  마감일이 달력 위에 색깔로 정리되니까
                  <br />더 이상 스케줄 꼬일 걱정이 없어요.
                </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-[#F7F7F8] min-w-[300px] max-w-[360px] w-full mx-auto">
                <div className="w-full px-5 py-4 flex flex-col">
                  {/* Header with Todo Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full">
                      <span className="text-sm">📋 할 일</span>
                      <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">1</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-neutral-200" style={{ backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')", backgroundSize: 'cover' }} />
                  </div>

                  {/* Economic Value Card */}
                  <div className="bg-white p-3 rounded-2xl mb-3 flex justify-between items-center">
                    <span className="text-xs text-neutral-500 font-semibold">이번 달 경제적 가치 ✨</span>
                    <span className="text-base font-extrabold text-[#333]">292,400원</span>
                  </div>

                  {/* Calendar */}
                  <div className="bg-white rounded-3xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-100">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <div className="text-sm font-bold text-neutral-800">2025년 12월</div>
                      <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-100">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-[10px] text-neutral-400 mb-2">
                      {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
                        <div key={d} className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}>{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((day) => {
                        const hasDot = [3, 14, 23, 24, 30, 31].includes(day)
                        const isToday = day === 5
                        const isSunday = (day) % 7 === 0
                        const isSaturday = (day + 1) % 7 === 0
                        return (
                          <div key={day} className={`h-[26px] w-[26px] flex flex-col items-center justify-center text-[11px] font-semibold rounded-lg mx-auto relative ${
                            isToday ? 'bg-orange-500 text-white' : 
                            isSunday ? 'text-red-500' : 
                            isSaturday ? 'text-blue-500' : 
                            'text-neutral-700'
                          }`}>
                            {day}
                            {hasDot && !isToday && <div className="w-1 h-1 bg-orange-500 rounded-full absolute bottom-0.5" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Schedule List */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold">진행 중인 체험단 (3건)</h3>
                    <span className="text-xs font-semibold text-orange-600">전체보기 (10)</span>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    <div className="p-3 rounded-2xl flex items-center bg-white">
                      <div className="text-xl mr-2.5">💄</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold mb-0.5 text-[#1A1A1A]">신선선정</div>
                        <div className="text-[10px] text-neutral-500">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-semibold text-[9px]">선정됨</span>
                        </div>
                      </div>
                      <div className="font-bold text-xs text-[#333]">₩23,400</div>
                    </div>
                    <div className="p-3 rounded-2xl flex items-center bg-white">
                      <div className="text-xl mr-2.5">🍕</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold mb-0.5 text-[#1A1A1A]">맛집 탐방</div>
                        <div className="text-[10px] text-neutral-500">
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold text-[9px]">방문 예정</span>
                        </div>
                      </div>
                      <div className="font-bold text-xs text-[#333]">₩45,000</div>
                    </div>
                    <div className="p-3 rounded-2xl flex items-center bg-white">
                      <div className="text-xl mr-2.5">☕</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold mb-0.5 text-[#1A1A1A]">카페 리뷰</div>
                        <div className="text-[10px] text-neutral-500">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold text-[9px]">작성 중</span>
                        </div>
                      </div>
                      <div className="font-bold text-xs text-[#333]">₩28,000</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: 수익 분석 */}
      <section className="bg-[#F9FAFB] py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] md:ml-[100px]">
              <span className="text-[#FF5722] font-bold text-base md:text-lg mb-4 block">수익 분석</span>
                <h2 className="text-3xl md:text-6xl font-bold leading-tight mb-6 text-[#191F28]">
                  얼마 벌었는지
                  <br />
                  세어보지 않아도 돼요
                </h2>
                <p className="text-lg md:text-xl text-[#6B7684] leading-relaxed">
                  제공받은 서비스 금액부터 원고료까지.
                  <br />
                  이번 달 내가 만든 경제적 가치를
                  <br />
                  자동으로 계산해 드립니다.
                </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-[#F7F7F8] min-w-[300px] max-w-[360px] w-full mx-auto">
                <div className="w-full aspect-[9/19.5] px-5 py-4 flex flex-col" style={{ height: '570px' }}>
                  {/* Hero Card */}
                  <div className="rounded-[30px] p-5 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)' }}>
                    <div className="text-xs font-semibold opacity-90">이번 달 경제적 가치 💰</div>
                    <div className="text-3xl font-extrabold mb-2 tracking-tight">₩ 292,400</div>
                    <div className="flex gap-4 border-t border-white/20 pt-3">
                      <div className="flex-1">
                        <div className="text-[9px] opacity-80 mb-0.5 font-medium">방어한 생활비</div>
                        <div className="text-xs font-bold">325,000</div>
                      </div>
                      <div className="flex-1 flex">
                        <div>
                          <div className="text-[9px] opacity-80 mb-0.5 font-medium">부수입 관리</div>
                          <div className="text-xs font-bold">32,600</div>
                        </div>
                        <button className="h-5 px-1.5 bg-white/20 border border-white/30 rounded-lg text-[8px] text-white font-semibold ml-2">+ 추가</button>
                      </div>
                    </div>
                  </div>

                  {/* Income Details */}
                  <div className="bg-white rounded-3xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-bold">수입 상세 내역</div>
                      <button className="text-[10px] text-neutral-600 font-semibold">전체 내역 보기 →</button>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-neutral-700">💰 방어한 생활비</div>
                        <div className="text-xs font-bold text-orange-600">285,000원</div>
                      </div>
                      <div className="space-y-2 pl-1">
                        <div className="flex items-center gap-2">
                          <div className="w-12 text-[10px] font-medium text-neutral-600">맛집</div>
                          <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full" style={{ width: '50%' }} />
                          </div>
                          <div className="w-8 text-right text-[9px] text-neutral-400 font-medium">50%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 text-[10px] font-medium text-neutral-600">뷰티</div>
                          <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full" style={{ width: '30%' }} />
                          </div>
                          <div className="w-8 text-right text-[9px] text-neutral-400 font-medium">30%</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-neutral-700">💵 부수입 (현금)</div>
                        <div className="text-xs font-bold text-green-600">32,600원</div>
                      </div>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  <div className="bg-white rounded-3xl p-4 flex-1">
                    <div className="text-sm font-bold mb-0.5">월별 성장 추이</div>
                    <div className="text-[9px] text-neutral-400 font-medium mb-3">지난 4개월간의 활동입니다</div>
                    <div className="flex justify-between items-end h-[100px]">
                      {[
                        { label: '9월', height: 30, value: '18만' },
                        { label: '10월', height: 50, value: '25만' },
                        { label: '11월', height: 40, value: '21만' },
                        { label: '이번달', height: 85, active: true, value: '29만' },
                      ].map((month, i) => (
                        <div key={i} className="w-[18%] rounded-lg relative flex justify-center" style={{ height: `${month.height}%`, background: month.active ? '#651FFF' : '#e5e5e5' }}>
                          <span className="absolute -top-5 text-[9px] font-bold text-neutral-800">{month.value}</span>
                          <span className="absolute -bottom-5 text-[9px] text-neutral-400 font-medium">{month.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: 할 일 체크리스트 */}
      <section className="bg-white py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px]">
              <span className="text-[#FF5722] font-bold text-base md:text-lg mb-4 block">할 일 관리</span>
                <h2 className="text-3xl md:text-6xl font-bold leading-tight mb-6 text-[#191F28]">
                  할 일 체크,
                  <br />
                  이걸로 끝나요
                </h2>
                <p className="text-lg md:text-xl text-[#6B7684] leading-relaxed">
                  오늘 해야 할 일부터 중요한 마감까지.
                  <br />
                  체크박스로 하나씩 완료하면서
                  <br />
                  깔끔하게 정리하세요.
                </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-[#F7F7F8] min-w-[300px] max-w-[360px] w-full mx-auto">
                <div className="w-full px-5 py-4 flex flex-col" style={{ height: '400px' }}>
                  {/* Todo Modal */}
                  <div className="relative bg-white rounded-[32px] shadow-lg p-5 flex flex-col h-full">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
                      <h3 className="text-lg font-bold text-[#191F28]">할 일 체크</h3>
                      <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Todo List */}
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {[
                        { label: '방문 예약하기', done: true },
                        { label: '매장 방문 & 체험', done: true },
                        { label: '사진 촬영 (최소 5장)', done: false, active: true },
                        { label: '리뷰 작성하기', done: false },
                        { label: '리뷰 URL 제출', done: false },
                      ].map((todo, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl transition ${
                            todo.active ? 'bg-orange-50 border border-orange-200' : 'bg-neutral-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            todo.done ? 'bg-orange-500 border-orange-500' : 'border-neutral-300'
                          }`}>
                            {todo.done && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${
                            todo.done ? 'text-neutral-400 line-through' : todo.active ? 'text-orange-700 font-semibold' : 'text-neutral-700'
                          }`}>
                            {todo.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4: 엑셀 다운로드 */}
      <section className="bg-[#F9FAFB] py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] md:ml-[100px]">
              <span className="text-[#FF5722] font-bold text-base md:text-lg mb-4 block">활동 내역 정리</span>
                <h2 className="text-3xl md:text-6xl font-bold leading-tight mb-6 text-[#191F28]">
                  내 활동 내역,
                  <br />
                  엑셀로 한 번에
                </h2>
                <p className="text-lg md:text-xl text-[#6B7684] leading-relaxed">
                  그동안의 체험단 활동을 한눈에.
                  <br />
                  엑셀 파일로 다운로드하면
                  <br />
                  내역 정리가 간편해집니다.
                </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-[#F7F7F8] min-w-[300px] max-w-[360px] w-full mx-auto">
                <div className="w-full aspect-[9/19.5] px-5 py-4 flex flex-col" style={{ height: '500px' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#191F28]">활동 내역</h2>
                    <div className="w-10 h-10 rounded-full bg-neutral-200" style={{ backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')", backgroundSize: 'cover' }} />
                  </div>

                  {/* Excel Preview Card */}
                  <div className="bg-white rounded-3xl p-4 mb-4 flex-1 relative overflow-hidden">
                    {/* Blur Overlay */}
                    <div className="absolute inset-0 backdrop-blur-[3px] bg-white/40 z-10 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        </div>
                        <div className="text-sm font-bold text-[#191F28] mb-1">Excel 다운로드</div>
                        <div className="text-xs text-neutral-600">전체 활동 내역을 받아보세요</div>
                      </div>
                    </div>

                    {/* Excel Table Preview (Blurred) */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-700 mb-3">📊 2025년 활동 요약</div>
                      
                      {/* Table Header */}
                      <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-neutral-600 pb-2 border-b">
                        <div>날짜</div>
                        <div>캠페인명</div>
                        <div className="text-right">가치</div>
                        <div className="text-right">상태</div>
                      </div>

                      {/* Table Rows */}
                      {[
                        { date: '12/03', name: '신선선정', value: '23,400', status: '완료' },
                        { date: '12/01', name: '뷰티 카페', value: '45,000', status: '완료' },
                        { date: '11/28', name: '맛집 체험', value: '38,000', status: '완료' },
                        { date: '11/25', name: '헬스케어', value: '52,000', status: '완료' },
                        { date: '11/20', name: '패션 리뷰', value: '29,000', status: '완료' },
                      ].map((row, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-1 text-[9px] py-2 border-b border-neutral-100">
                          <div className="text-neutral-600">{row.date}</div>
                          <div className="text-neutral-800 font-medium">{row.name}</div>
                          <div className="text-right text-neutral-700">₩{row.value}</div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[8px] font-semibold">{row.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-2xl p-3">
                      <div className="text-[10px] text-neutral-500 mb-1">총 활동</div>
                      <div className="text-lg font-bold text-[#191F28]">23건</div>
                    </div>
                    <div className="bg-white rounded-2xl p-3">
                      <div className="text-[10px] text-neutral-500 mb-1">총 가치</div>
                      <div className="text-lg font-bold text-orange-600">₩892K</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Types */}
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-12 text-[#191F28]">이런 분들이 쓰고 있어요</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-4">📸</div>
              <h3 className="font-bold text-lg text-[#191F28]">체험단 리뷰어</h3>
            </div>
            <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="font-bold text-lg text-[#191F28]">블로그 운영자</h3>
            </div>
            <div className="bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="font-bold text-lg text-[#191F28]">N잡러</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-20 md:py-32 scroll-animate">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-[#191F28]">
            필요한 만큼만, 간단하게.
          </h2>
          <p className="text-base md:text-lg text-[#6B7684] mb-12">
            누구나 무료로 사용할 수 있습니다.
            <br />
            PRO 버전에서 더 강력한 기능을 경험해보세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            {/* FREE Plan */}
            <div className="bg-[#F9FAFB] rounded-[32px] p-10 border border-gray-100 flex flex-col items-start text-left hover:bg-[#F2F4F6] transition">
              <h3 className="text-2xl font-bold mb-2 text-[#191F28]">FREE</h3>
              <p className="text-[#6B7684] mb-6">기본 기능을 모두 무료로 사용하세요.</p>
              <ul className="text-lg text-[#4E5968] space-y-3 mb-8 flex-grow">
                <li>✔ 체험단 일정 등록</li>
                <li>✔ 캘린더 확인</li>
                <li>✔ 할 일 관리</li>
                <li>✔ 이번 달 수익 내용 조회</li>
                <li>✔ 수익 자랑하기 (이미지 생성)</li>
              </ul>
              <div className="w-full pt-6 border-t border-gray-200">
                <div className="text-3xl font-bold mb-6 text-[#191F28]">₩0</div>
                <button
                  onClick={handleFreeTrial}
                  className="w-full bg-white border border-gray-300 text-[#191F28] px-6 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  무료 체험하기
                </button>
              </div>
            </div>

            {/* PRO Plan */}
            <div className="bg-white rounded-[32px] p-10 border-2 border-[#FF5722] shadow-xl flex flex-col items-start text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#FF5722] text-white text-xs font-bold px-4 py-2 rounded-bl-2xl">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-2 text-[#FF5722]">PRO</h3>
              <p className="text-[#6B7684] mb-6">더 깊고 편리한 리뷰 관리 기능</p>
              <ul className="text-lg text-[#333D4B] space-y-3 mb-8 flex-grow font-medium">
                <li>✨ 하루 1번 요약 알림 제공 </li>
                <li className="pl-6 mt-[-4px] text-xs">( 당일 아침, 오늘 해야 할 방문/작성/발행 일정을 깔끔하게 알려드려요. )</li>
                <li>✨ 활동 내역 엑셀 다운로드</li>
                <li>✨ 월별 요약 리포트 제공</li>
                <li>✨ 월별 수익 내용 전체 조회 가능</li>
                <li className="pl-6 mt-[-4px] text-xs">( 월별 성장 변화도 한눈에 확인 )</li>
              </ul>
              <div className="w-full pt-6 border-t border-gray-100">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold text-[#191F28]">₩2,900</span>
                  <span className="text-lg text-[#8B95A1]">/월</span>
                </div>
                <p className="text-[#FF5722] font-bold text-sm mb-6">🔥 사전 등록 시 3개월간 40% 할인</p>
                <button
                  onClick={handleFreeTrial}
                  className="w-full bg-[#FF5722] text-white px-6 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-orange-500/30 hover:bg-[#E64A19] transition cursor-pointer"
                >
                  PRO 미리 신청하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-6 text-[#191F28]">
            출시 알림을 <br className="md:hidden" />
            가장 먼저 받고 싶다면
          </h2>
          <p className="text-base md:text-lg text-[#6B7684] mb-10 leading-relaxed">
            베타 오픈 시 가장 먼저 안내해드려요.
            <br />
            사전 등록자에게는 <span className="text-[#FF5722] font-bold">PRO 버전 할인 혜택</span>도
            제공됩니다.
          </p>

          <form
            className="w-full flex flex-col md:flex-row items-center justify-center gap-3"
            onSubmit={handleEmailSubmit}
          >
            <input
              type="email"
              placeholder="이메일 주소를 입력하세요"
              className="w-full md:w-2/3 px-6 py-4 rounded-2xl border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722] transition text-lg"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              className="w-full md:w-auto bg-[#FF5722] text-white px-8 py-4 rounded-2xl text-lg font-semibold shadow-lg shadow-orange-500/30 hover:bg-[#E64A19] transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '알림 받기'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-4 rounded-xl ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <p className="text-sm text-[#B0B8C1] mt-6">
            입력하신 이메일은 출시 알림 외 다른 목적으로 사용되지 않습니다.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-[#8B95A1] text-sm">
          <div className="mb-4 md:mb-0 flex items-center gap-2">
            <img src="/logo.png" alt="ReviewFlow" className="h-20" />
            <span className="mx-2">|</span>
            Copyright © 2025
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#333]">
              이용약관
            </a>
            <a href="#" className="hover:text-[#333]">
              개인정보처리방침
            </a>
            <a href="#" className="hover:text-[#333]">
              문의하기
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
