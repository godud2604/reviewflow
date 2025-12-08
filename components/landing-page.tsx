"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { usePostHog } from 'posthog-js/react'

export default function LandingPage() {
  const router = useRouter()
  const posthog = usePostHog()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const isProd = process.env.NODE_ENV === 'production';

  const handleFreeTrial = () => {
    if (isProd) {
      posthog?.capture('free_trial_clicked', {
        source: 'landing_page'
      })
    }
    router.push("/?page=home")
  }

  const handlePreRegister = () => {
    if (isProd) {
      posthog?.capture('pre_register_clicked', {
        source: 'landing_page'
      })
    }
    const ctaSection = document.getElementById('waitlist-section')
    if (ctaSection) {
      ctaSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    if (isProd) {
      posthog?.capture('waitlist_submit_attempted', {
        email: email
      })
    }

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
        if (isProd) {
          posthog?.capture('waitlist_submit_success', {
            email: email
          })
        }
        setMessage({ type: 'success', text: data.message })
        setEmail("")
      } else {
        if (isProd) {
          posthog?.capture('waitlist_submit_failed', {
            email: email,
            error: data.error
          })
        }
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

  useEffect(() => {
    const scrollToHashTarget = () => {
      if (!window.location.hash) return
      const targetId = window.location.hash.slice(1)
      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    const timeoutId = window.setTimeout(scrollToHashTarget, 0)
    window.addEventListener('hashchange', scrollToHashTarget)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('hashchange', scrollToHashTarget)
    }
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
          <a href="/" className="flex items-center">
            <img src="/logo.png" alt="ReviewFlow" className="h-40" />
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFreeTrial}
              className="px-2.5 py-1 md:px-5 md:py-2 font-semibold text-[11px] md:text-sm text-[#4A5568] hover:text-[#FF5722] transition whitespace-nowrap cursor-pointer"
            >
              무료 체험하기 →
            </button>
          </div>
        </div>
      </nav>

      {/* Promo Banner - Gemini 스타일 */}
      <div className="fixed top-16 left-0 right-0 z-50 bg-gradient-to-r from-blue-50 via-purple-50 to-orange-50 py-2.5 md:py-3 flex justify-center">
        <button
          onClick={handlePreRegister}
          className="group relative flex items-center gap-2 bg-white px-4 py-3 md:px-6 md:py-2.5 rounded-full text-[13px] md:text-sm font-medium text-[#333D4B] hover:shadow-lg transition-all duration-300 cursor-pointer"
          style={{
            background: 'linear-gradient(white, white) padding-box, linear-gradient(90deg, #4285F4, #A855F7, #EC4899, #F97316) border-box',
            border: '1.5px solid transparent',
          }}
        >
          <span className="text-[#FF5722]">✦</span>
          <span><span className="font-bold text-[#FF5722]">PRO 3개월 무료 혜택 받으러 가기</span></span>
          <svg className="w-4 h-4 text-[#8B95A1] group-hover:translate-x-0.5 group-hover:text-[#FF5722] transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center pt-40 md:pt-44 pb-10 bg-gradient-to-b from-white via-orange-50/30 to-white relative overflow-hidden">
        {/* Background Animation Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        </div>

        <div className="max-w-4xl px-6 relative z-10">
          {/* Badge with animation */}
          <div className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-4 md:mb-6 animate-fade-in-down">
            <span className="text-base md:text-lg"></span>
            <span>엑셀·메모장으로 버티는 체험단 관리, 이제 그만.</span>
          </div>
          <h1 className="text-3xl md:text-7xl font-extrabold leading-tight mb-4 md:mb-4 text-[#1A1A1A] animate-fade-in-up tracking-tight">
            리뷰 관리,
            <br />
            <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 bg-clip-text text-transparent">
              이제 스트레스 받지 마세요.
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-[#4A5568] font-semibold leading-relaxed mb-8 md:mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            체험단·협찬 블로거를 위한 일정·정산 캘린더
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={handleFreeTrial}
              className="group bg-gradient-to-r from-orange-600 to-orange-500 text-white px-5 md:px-8 py-2.5 md:py-4 rounded-full text-xs md:text-lg font-bold shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-105 transition-all duration-300 flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span className="md:hidden">무료 체험하기</span>
              <span className="hidden md:inline">지금 무료로 체험하기</span>
              <svg className="w-3.5 h-3.5 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Problem Section - 1단계: 공감하기 */}
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center">
            <h2 className="text-2xl md:text-5xl font-bold leading-tight mb-2 md:mb-4 text-[#191F28]">
              체험단 마감 한 번만 깜빡해도, 바로 패널티.
            </h2>
            <p className="text-base md:text-xl text-[#8B95A1] font-medium">
              정산 날짜 놓쳐서 손해 보고... 
              <br/>
              복잡한 엑셀과 메모장으로는 한계가 있더라고요.
            </p>
          </div>
        </div>
      </section>

      {/* 해결책 제시 - Feature 1: 일정 관리 */}
      <section className="bg-white py-20 md:py-32 overflow-hidden scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-2 md:mb-4 text-[#191F28]">
              이렇게 도와드릴게요
            </h2>
            <p className="text-base md:text-xl text-[#6B7684]">
              체험단 관리에 필요한 모든 기능을 한 곳에
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] text-center md:text-left">
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">일정 관리</span>
                <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                  겹치는 일정,
                  <br />
                  한눈에 보여드려요
                </h2>
                <p className="text-base md:text-xl text-[#6B7684] leading-relaxed">
                  하루에 체험단이 여러 개여도,
                  <br />체험단 전용 캘린더로 깔끔하게 관리
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
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] md:ml-[100px] text-center md:text-left">
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">수익 분석</span>
                <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                  얼마 벌었는지
                  <br />
                  세어보지 않아도 돼요
                </h2>
                <p className="text-base md:text-xl text-[#6B7684] leading-relaxed">
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
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] text-center md:text-left">
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">할 일 관리</span>
                <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                  할 일 체크,
                  <br />
                  이걸로 끝나요
                </h2>
                <p className="text-base md:text-xl text-[#6B7684] leading-relaxed">
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
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[500px] md:ml-[100px] text-center md:text-left">
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">활동 내역 정리</span>
                <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                  내 활동 내역,
                  <br />
                  엑셀로 한 번에
                </h2>
                <p className="text-base md:text-xl text-[#6B7684] leading-relaxed">
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

      {/* Testimonials - 실제 사용자 후기 */}
      <section className="bg-white py-20 md:py-32 scroll-animate">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-6 md:mb-10 text-[#191F28]">
            실제 사용자들의 이야기
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F9FAFB] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-full bg-orange-100" 
                  style={{ 
                    backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Hyeyoung&backgroundColor=ffdfbf')", 
                    backgroundSize: 'cover' 
                  }} 
                />
                <div>
                  <div className="font-bold text-[#191F28]">김혜영 님</div>
                  <div className="text-sm text-[#8B95A1]">체험단 리뷰어 2년차</div>
                </div>
              </div>
              <p className="text-[#4A5568] leading-relaxed">
                "엑셀로 정리하다가 날짜 착각해서 패널티 받은 적 있어요. 이제는 알림도 오고 한눈에 보여서 너무 편해요!"
              </p>
            </div>
            <div className="bg-[#F9FAFB] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-full bg-purple-100" 
                  style={{ 
                    backgroundImage: "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Jieun&backgroundColor=e0d4f7')", 
                    backgroundSize: 'cover' 
                  }} 
                />
                <div>
                  <div className="font-bold text-[#191F28]">박지은 님</div>
                  <div className="text-sm text-[#8B95A1]">블로거, N잡러</div>
                </div>
              </div>
              <p className="text-[#4A5568] leading-relaxed">
                "한 달에 얼마 벌었는지 따로 계산 안 해도 되니까 좋아요. 수익 관리가 이렇게 쉬울 줄이야!"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3단계: 가격/FAQ - Pricing */}
      <section className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-[#191F28]">
            필요한 만큼만, 간단하게.
          </h2>
          <p className="text-base md:text-lg text-[#6B7684] mb-12">
            누구나 무료로 시작할 수 있어요.
            <br />
            더 강력한 기능이 필요하다면 PRO를 선택하세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            {/* FREE Plan */}
            <div className="bg-white rounded-[32px] p-10 border border-gray-100 flex flex-col items-start text-left hover:bg-white transition">
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
                  className="w-full bg-[#F9FAFB] border border-gray-300 text-[#191F28] px-6 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-50 transition cursor-pointer"
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
                <p className="text-[#FF5722] font-bold text-sm mb-6">🔥 사전 등록 시 3개월 무료</p>
                <button
                  onClick={handlePreRegister}
                  className="w-full bg-[#FF5722] text-white px-6 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-orange-500/30 hover:bg-[#E64A19] transition cursor-pointer"
                >
                  사전 등록하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-[#F9FAFB] py-20 md:py-32 scroll-animate">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12 text-[#191F28]">
            자주 묻는 질문
          </h2>
          <div className="space-y-4">
            <details className="bg-white rounded-2xl p-6 shadow-sm">
              <summary className="font-bold text-[#191F28] cursor-pointer text-sm md:text-base">
                정말 무료로 사용할 수 있나요?
              </summary>
              <p className="mt-4 text-[#6B7684] text-sm md:text-base leading-relaxed">
                네! 기본 기능은 완전 무료입니다. 일정 관리, 수익 조회, 할 일 체크 등 핵심 기능을 모두 사용하실 수 있어요.
              </p>
            </details>
            <details className="bg-white rounded-2xl p-6 shadow-sm">
              <summary className="font-bold text-[#191F28] cursor-pointer text-sm md:text-base">
                PRO 버전은 언제 필요한가요?
              </summary>
              <p className="mt-4 text-[#6B7684] text-sm md:text-base leading-relaxed">
                매일 요약된 알림을 받고 싶거나, 엑셀로 활동 내역을 정리하고 싶을 때 PRO가 유용해요.
              </p>
            </details>
            <details className="bg-white rounded-2xl p-6 shadow-sm">
              <summary className="font-bold text-[#191F28] cursor-pointer text-sm md:text-base">
                사전 등록하면 어떤 혜택이 있나요?
              </summary>
              <p className="mt-4 text-[#6B7684] text-sm md:text-base leading-relaxed">
                사전 등록자에게는 PRO 버전 3개월 무료 혜택을 드립니다. 정식 출시 전 가장 먼저 알림도 받으실 수 있어요.
              </p>
            </details>
            <details className="bg-white rounded-2xl p-6 shadow-sm">
              <summary className="font-bold text-[#191F28] cursor-pointer text-sm md:text-base">
                모바일에서도 사용할 수 있나요?
              </summary>
              <p className="mt-4 text-[#6B7684] text-sm md:text-base leading-relaxed">
                물론이죠! 웹 브라우저만 있으면 PC, 태블릿, 스마트폰 어디서든 사용 가능합니다.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* 끝맺음: CTA Section */}
      <section id="waitlist-section" className="bg-[#F2F4F6] py-20 md:py-32 scroll-animate">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-5 md:mb-6 text-[#191F28]">
            출시 알림을 가장 먼저 받고 싶다면
          </h2>
          <p className="text-base md:text-lg text-[#6B7684] mb-8 md:mb-10 leading-relaxed">
            사전 등록하고 <span className="text-[#FF5722] font-bold">PRO 버전 3개월 무료</span> 혜택 받으세요.
            <br />
            12월 20일 베타 오픈 예정 시 가장 먼저 연락드립니다.
          </p>

          <form
            className="w-full flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3"
            onSubmit={handleEmailSubmit}
          >
            <input
              type="email"
              placeholder="이메일 주소 입력"
              className="w-full md:w-2/3 px-3 py-2.5 md:px-6 md:py-4 rounded-2xl border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722] transition text-xs md:text-lg"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              className="w-full md:w-auto bg-[#FF5722] text-white px-5 py-2.5 md:px-8 md:py-4 rounded-2xl text-xs md:text-lg font-semibold shadow-lg shadow-orange-500/30 hover:bg-[#E64A19] transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
