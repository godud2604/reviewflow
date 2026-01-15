'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/hooks/use-auth';
import { Z_INDEX } from '@/lib/z-index';
import AppDownloadBanner from '@/components/app-download-banner';

export default function LandingPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  const isProd = process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/?page=home');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const handleFreeTrial = () => {
    if (isProd) {
      posthog?.capture('free_trial_clicked', {
        source: 'landing_page',
      });
    }
    router.push('/signin');
  };

  const handlePreRegister = () => {
    if (isProd) {
      posthog?.capture('pre_register_clicked', {
        source: 'landing_page',
      });
    }
    setMessage(null);
    setIsWaitlistModalOpen(true);
  };

  const handleCloseWaitlistModal = () => {
    setIsWaitlistModalOpen(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (isProd) {
      posthog?.capture('waitlist_submit_attempted', {
        email: email,
      });
    }

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isProd) {
          posthog?.capture('waitlist_submit_success', {
            email: email,
          });
        }
        setMessage({ type: 'success', text: data.message });
        setEmail('');
      } else {
        if (isProd) {
          posthog?.capture('waitlist_submit_failed', {
            email: email,
            error: data.error,
          });
        }
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다. 다시 시도해주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-visible');
        }
      });
    }, observerOptions);

    const animateElements = document.querySelectorAll('.scroll-animate');
    animateElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollToHashTarget = () => {
      if (!window.location.hash) return;
      const targetId = window.location.hash.slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const timeoutId = window.setTimeout(scrollToHashTarget, 0);
    window.addEventListener('hashchange', scrollToHashTarget);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('hashchange', scrollToHashTarget);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F2F4F6] overflow-x-hidden">
      <style jsx global>{`
        .scroll-animate {
          opacity: 0;
          transform: translateY(40px);
          transition:
            opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
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
      {isWaitlistModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-5"
          onClick={handleCloseWaitlistModal}
          style={{ zIndex: Z_INDEX.heroOverlay }}
        >
          <div
            className="w-90 max-w-sm bg-white rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-orange-600 mb-1">사전신청</p>
                <h3 className="text-xl font-bold text-neutral-900 leading-tight">
                  이메일을 남겨주세요
                </h3>
              </div>
              <button
                onClick={handleCloseWaitlistModal}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#ffd0b3] p-3">
              <div className="w-5 h-5 rounded-lg bg-white flex items-center justify-center text-xl">
                ⏰
              </div>
              <div className="leading-tight">
                <p className="text-[12px] font-bold text-[#c24b30]">선착순 50명 사전신청</p>
                <p className="text-[11px] font-semibold text-[#ff5c39]">몇자리 안 남았어요!</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-bold text-neutral-700 border border-neutral-200">
                    FREE
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-600">
                    지금 바로 이용 가능
                  </span>
                </div>
                <ul className="text-[12px] text-neutral-700 space-y-1.5 list-disc list-inside">
                  <li>체험단 일정 캘린더 관리</li>
                  <li>할 일(To-do) 관리</li>
                  <li>이번 달 수익/통계 페이지 제공</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#ffd6be] bg-gradient-to-r from-[#fff3ea] via-[#ffe6d6] to-[#ffd7bd] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-1 rounded-lg bg-white text-[11px] font-bold text-[#ff5c39] border border-white/70 shadow-sm">
                    Beta 무료
                  </span>
                  <span className="text-[12px] font-semibold text-[#c24b30]">
                    지금 무료로 이용 가능
                  </span>
                </div>
                <ul className="text-[12px] text-neutral-800 space-y-1.5 list-disc list-inside">
                  <li>월간 수익 리포트 · 알림</li>
                  <li>활동 내역 다운로드(엑셀)</li>
                  <li>하루 1번 요약 알림 제공</li>
                  <span className="ml-3">(오늘 해야 할 방문/작성/발행 일정 등)</span>
                </ul>
                <p className="text-[11px] text-[#c24b30] font-semibold mt-2">
                  사전신청 시 모든 고급 기능을 무료로 이용 가능
                </p>
              </div>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleEmailSubmit}>
              <input
                type="email"
                placeholder="example@email.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c39]"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="w-full bg-[#ff5c39] text-white py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-400/30 hover:bg-[#ff734f] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                disabled={isSubmitting}
              >
                {isSubmitting ? '등록 중...' : '사전신청 완료하기'}
              </button>
            </form>
            {message && (
              <div
                className={`mt-3 px-3 py-2 rounded-lg text-xs ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-3">
              입력하신 이메일은 출시 알림 외 다른 목적으로 사용하지 않아요.
            </p>
          </div>
        </div>
      )}
      {/* Navigation */}
      <nav
        className="fixed top-0 left-0 left-0 right-0 bg-white/80 backdrop-blur-md transition-all duration-300 border-b border-transparent"
        style={{ zIndex: Z_INDEX.modal }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <a href="/" className="flex items-center">
            <img src="/logo.png" alt="ReviewFlow" className="h-40" />
          </a>
          <div className="flex items-center gap-2 md:gap-3">
            {!authLoading && (
              <>
                {isAuthenticated ? (
                  <>
                    <span className="hidden md:inline text-xs text-[#6B7684] mr-1">
                      {user?.email}
                    </span>
                    <button
                      onClick={() => router.push('/?page=home')}
                      className="bg-white text-[#333D4B] border border-gray-300 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full font-semibold text-[12px] md:text-sm hover:bg-gray-100 transition whitespace-nowrap cursor-pointer"
                    >
                      내 대시보드
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="bg-white text-red-500 border border-red-300 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full font-semibold text-[12px] md:text-sm hover:bg-red-50 transition whitespace-nowrap cursor-pointer"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => router.push('/signin')}
                      className="bg-white text-[#333D4B] border border-gray-300 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full font-semibold text-[12px] md:text-sm hover:bg-gray-100 transition whitespace-nowrap cursor-pointer"
                    >
                      로그인
                    </button>
                    <button
                      onClick={() => router.push('/signup')}
                      className="bg-white text-[#FF5722] border border-[#FF5722] px-3 py-1.5 md:px-5 md:py-2.5 rounded-full font-semibold text-[12px] md:text-sm hover:bg-orange-50 transition whitespace-nowrap cursor-pointer"
                    >
                      회원가입
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center pt-40 md:pt-44 pb-10 bg-gradient-to-b from-white via-orange-50/30 to-white relative overflow-hidden">
        {/* Background Animation Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-20 left-10 w-72 h-72 bg-orange-200/20 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: '4s' }}
          />
          <div
            className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: '6s', animationDelay: '1s' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: '8s', animationDelay: '2s' }}
          />
        </div>

        <div className="max-w-4xl px-6 relative" style={{ zIndex: Z_INDEX.content }}>
          {/* Badge with animation */}
          <div className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-4 md:mb-6 animate-fade-in-down">
            <span className="text-base md:text-lg"></span>
            <span>어제는 엑셀, 오늘은 메모장… 나도 모르게 놓치는 리뷰들.</span>
          </div>
          <h1 className="text-3xl md:text-7xl font-extrabold leading-tight mb-4 md:mb-4 text-[#1A1A1A] animate-fade-in-up tracking-tight">
            체험단 일정·정산,
            <br />
            <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 bg-clip-text text-transparent">
              여기저기 흩어져 있지 않나요?
            </span>
          </h1>
          <p
            className="text-lg md:text-2xl text-[#4A5568] font-semibold leading-relaxed mb-8 md:mb-8 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            체험단 블로거를 위한 올인원 일정·정산 캘린더
          </p>
          <div
            className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            <button
              onClick={handleFreeTrial}
              className="group bg-gradient-to-r from-orange-600 to-orange-500 text-white px-5 md:px-8 py-2.5 md:py-4 rounded-full text-xs md:text-lg font-bold shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-105 transition-all duration-300 flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span className="md:hidden">무료 체험하기</span>
              <span className="hidden md:inline">지금 무료로 체험하기</span>
              <svg
                className="w-3.5 h-3.5 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <p
            className="mt-4 text-sm font-semibold text-[#FF5722] animate-fade-in"
            style={{ animationDelay: '0.6s' }}
          >
            회원가입 시 모든 기능을 무료로 이용할 수 있어요.
          </p>
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
              <br />
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
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">
                일정 관리
              </span>
              <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                겹치는 일정,
                <br />
                한눈에 보여드려요
              </h2>
              <div className="text-base md:text-xl text-[#6B7684] leading-relaxed">
                마감·방문·작성 일정이 흩어지지 않게,
                <br />
                하루 단위로 해야 할 일만 깔끔하게 모아드립니다. <br />
                <span className="text-[14px] font-bold">
                  마감초과는 🔥, 마감일은 숫자 핀으로 한눈에 구분해요{' '}
                </span>
                <br />
                <span className="text-[14px] font-bold">
                  "제품 주문하기", "사장님께 방문 문자 보내기" 등 할 일을 쉽게 관리해요
                </span>
              </div>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[36px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.12)] bg-white min-w-[320px] max-w-[380px] w-full mx-auto">
                <div className="p-4 space-y-3">
                  <div className="flex items-center">
                    <div className="inline-flex items-center gap-2 bg-white border border-neutral-200 shadow-sm px-3 py-1.5 rounded-full">
                      <span className="text-lg">🗒️</span>
                      <span className="text-[12px] font-semibold text-neutral-800">할 일</span>
                      <span className="h-5 min-w-[18px] px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                        2
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-[28px] border border-neutral-100 shadow-[0_16px_36px_rgba(15,23,42,0.08)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 border border-neutral-200">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                        <div className="text-base font-extrabold text-neutral-900">2025년 12월</div>
                        <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 border border-neutral-200">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                      <button className="text-[11px] font-semibold text-orange-600 hover:text-orange-700">
                        오늘로 이동
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 font-semibold">
                      {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
                        <div
                          key={d}
                          className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-2 text-center">
                      {[...Array(1)].map((_, i) => (
                        <div key={`emp-${i}`} className="h-9" />
                      ))}
                      {[
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
                        22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
                      ].map((day) => {
                        const meta: { overdue?: boolean; deadline?: number; reconfirm?: boolean } =
                          day === 9
                            ? { overdue: true, deadline: 4 }
                            : day === 16
                              ? { deadline: 1 }
                              : {};
                        const isSelected = [9, 16].includes(day);
                        const hasDeadline = !!meta.deadline;
                        return (
                          <div
                            key={day}
                            className={`relative h-9 w-9 mx-auto flex items-center justify-center text-[11px] font-semibold rounded-full ${
                              isSelected
                                ? 'shadow-[inset_0_0_0_2px_rgba(249,115,22,0.9)] text-orange-700'
                                : 'text-neutral-700'
                            } ${hasDeadline ? 'bg-white' : 'bg-[#F5F6F8]'}`}
                          >
                            {day}
                            {meta.deadline && (
                              <span className="absolute -bottom-1.5 right-0 flex h-4 min-w-[14px] px-1 items-center justify-center rounded-full bg-white text-orange-600 text-[9px] font-extrabold shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
                                {meta.deadline}
                              </span>
                            )}
                            {meta.overdue && (
                              <span className="absolute -bottom-1.5 left-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] shadow-[0_4px_10px_rgba(0,0,0,0.12)]">
                                🔥
                              </span>
                            )}
                          </div>
                        );
                      })}
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
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">
                수익 분석
              </span>
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
                <br />
                가계부처럼 항목별로 꼼꼼하게 확인할 수 있어요.
              </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.12)] bg-[#F7F7F8] min-w-[300px] max-w-[360px] w-full mx-auto">
                <div
                  className="w-full aspect-[9/19.5] px-5 py-4 flex flex-col"
                  style={{ height: '570px' }}
                >
                  {/* Hero Card */}
                  <div
                    className="rounded-[30px] p-5 mb-4 text-white"
                    style={{ background: 'linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)' }}
                  >
                    <div className="text-xs font-semibold opacity-90">이번 달 경제적 가치 💰</div>
                    <div className="text-3xl font-extrabold mb-2 tracking-tight">₩ 357,600</div>
                    <div className="flex gap-4 border-t border-white/20 pt-3">
                      <div className="flex-1">
                        <div className="text-[9px] opacity-80 mb-0.5 font-medium">
                          방어한 생활비
                        </div>
                        <div className="text-xs font-bold">325,000</div>
                      </div>
                      <div className="flex-1 flex">
                        <div>
                          <div className="text-[9px] opacity-80 mb-0.5 font-medium">
                            부수입 관리
                          </div>
                          <div className="text-xs font-bold">32,600</div>
                        </div>
                        <button className="h-5 px-1.5 bg-white/20 border border-white/30 rounded-lg text-[8px] text-white font-semibold ml-2">
                          + 추가
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Income Details */}
                  <div className="bg-white rounded-3xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-bold">수입 상세 내역</div>
                      <button className="text-[10px] text-neutral-600 font-semibold">
                        전체 내역 보기 →
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-neutral-700">
                          💰 방어한 생활비
                        </div>
                        <div className="text-xs font-bold text-orange-600">325,000원</div>
                      </div>
                      <div className="space-y-2 pl-1">
                        <div className="flex items-center gap-2">
                          <div className="w-12 text-[10px] font-medium text-neutral-600">식품</div>
                          <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-orange-400 rounded-full"
                              style={{ width: '50%' }}
                            />
                          </div>
                          <div className="w-8 text-right text-[9px] text-neutral-400 font-medium">
                            50%
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 text-[10px] font-medium text-neutral-600">뷰티</div>
                          <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-orange-400 rounded-full"
                              style={{ width: '30%' }}
                            />
                          </div>
                          <div className="w-8 text-right text-[9px] text-neutral-400 font-medium">
                            30%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-neutral-700">
                          💵 부수입 (현금)
                        </div>
                        <div className="text-xs font-bold text-green-600">32,600원</div>
                      </div>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  <div className="bg-white rounded-3xl p-4 flex-1">
                    <div className="text-sm font-bold mb-0.5">월별 성장 추이</div>
                    <div className="text-[9px] text-neutral-400 font-medium mb-3">
                      지난 4개월간의 활동입니다
                    </div>
                    <div className="flex justify-between items-end h-[100px]">
                      {[
                        { label: '9월', height: 30, value: '18만' },
                        { label: '10월', height: 50, value: '25만' },
                        { label: '11월', height: 40, value: '21만' },
                        { label: '이번달', height: 85, active: true, value: '36만' },
                      ].map((month, i) => (
                        <div
                          key={i}
                          className="w-[18%] rounded-lg relative flex justify-center"
                          style={{
                            height: `${month.height}%`,
                            background: month.active ? '#651FFF' : '#e5e5e5',
                          }}
                        >
                          <span className="absolute -top-5 text-[9px] font-bold text-neutral-800">
                            {month.value}
                          </span>
                          <span className="absolute -bottom-5 text-[9px] text-neutral-400 font-medium">
                            {month.label}
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

      {/* Feature 3: 하루 1번 요약 알림 */}
      <section className="bg-white py-20 md:py-32 scroll-animate">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-[100px]">
            <div className="w-full md:w-auto md:flex-1 md:max-w-[520px] text-center md:text-left">
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">
                카카오 알림톡으로,
              </span>
              <h2 className="text-2xl md:text-6xl font-bold leading-tight mb-4 md:mb-6 text-[#191F28]">
                일정이 있을 때,
                <br />
                잊지 않게 챙겨드려요
              </h2>
              <p className="text-base md:text-xl text-[#6B7684] leading-relaxed">
                방문, 마감 일정 또는 마감 초과가 있는 날
                <br />
                아침에 카카오 알림톡으로 요약해드려요.
                <br />
              </p>
            </div>
            <div className="w-full md:w-auto md:flex-shrink-0">
              <div className="border-[10px] border-white rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.14)] bg-[#EDEFF2] min-w-[300px] max-w-[380px] w-full mx-auto">
                <div className="w-full px-4 py-4 flex flex-col" style={{ height: '520px' }}>
                  <div className="bg-white rounded-[32px] shadow-[0_20px_40px_rgba(15,23,42,0.08)] flex flex-col h-full overflow-hidden">
                    <div className="bg-[#FFE500] px-4 py-4 relative">
                      <div className="text-[13px] font-extrabold text-[#1A1A1A]">알림톡 도착</div>
                    </div>
                    <div className="flex-1 bg-white px-5 py-4 text-[#111]">
                      <p className="text-[16px] font-bold mb-3">[오늘의 일정]</p>
                      <p className="text-[14px] font-semibold leading-relaxed mb-4">
                        좋은 아침이에요!
                        <br />
                        오늘 예정된 체험단 일정을 정리해서
                        <br />
                        알려드릴게요.
                      </p>
                      <div className="space-y-1.5 mb-4 text-[14px] font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px]">📌</span>
                          <span>오늘 마감 일정: 3건</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px]">📍</span>
                          <span>오늘 방문 일정: 3건</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px]">⏰</span>
                          <span>마감 초과 일정: 1건</span>
                        </div>
                      </div>
                      <p className="text-[14px] font-semibold mb-4">
                        오늘 하루도 천천히 화이팅이에요🧡
                      </p>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed mb-4">
                        해당 메시지는 고객님께서 일정 알림 수신에
                        <br />
                        동의하고 요청하신 경우, 체험단 일정이 있을 때마다
                        <br />
                        반복적으로 발송됩니다.
                      </p>
                      <button className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] py-3 text-[14px] font-bold text-[#111] shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                        일정 한눈에 보기
                      </button>
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
              <span className="text-[#FF5722] font-bold text-sm md:text-lg mb-3 md:mb-4 block">
                활동 내역 정리
              </span>
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
                <div
                  className="w-full aspect-[9/19.5] px-5 py-4 flex flex-col"
                  style={{ height: '500px' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#191F28]">활동 내역</h2>
                    <div
                      className="w-10 h-10 rounded-full bg-neutral-200"
                      style={{
                        backgroundImage:
                          "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')",
                        backgroundSize: 'cover',
                      }}
                    />
                  </div>

                  {/* Excel Preview Card */}
                  <div className="bg-white rounded-3xl p-4 mb-4 flex-1 relative overflow-hidden">
                    {/* Blur Overlay */}
                    <div
                      className="absolute inset-0 backdrop-blur-[3px] bg-white/40 flex items-center justify-center"
                      style={{ zIndex: Z_INDEX.content }}
                    >
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        </div>
                        <div className="text-sm font-bold text-[#191F28] mb-1">Excel 다운로드</div>
                        <div className="text-xs text-neutral-600">전체 활동 내역을 받아보세요</div>
                      </div>
                    </div>

                    {/* Excel Table Preview (Blurred) */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-700 mb-3">
                        📊 2025년 활동 요약
                      </div>

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
                        <div
                          key={idx}
                          className="grid grid-cols-4 gap-1 text-[9px] py-2 border-b border-neutral-100"
                        >
                          <div className="text-neutral-600">{row.date}</div>
                          <div className="text-neutral-800 font-medium">{row.name}</div>
                          <div className="text-right text-neutral-700">₩{row.value}</div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[8px] font-semibold">
                              {row.status}
                            </span>
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
                    backgroundImage:
                      "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Hyeyoung&backgroundColor=ffdfbf')",
                    backgroundSize: 'cover',
                  }}
                />
                <div>
                  <div className="font-bold text-[#191F28]">김혜영 님</div>
                  <div className="text-sm text-[#8B95A1]">체험단 리뷰어 2년차</div>
                </div>
              </div>
              <p className="text-[#4A5568] leading-relaxed">
                "엑셀로 정리하다가 날짜 착각해서 패널티 받은 적 있어요. 이제는 알림도 오고 한눈에
                보여서 너무 편해요!"
              </p>
            </div>
            <div className="bg-[#F9FAFB] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full bg-purple-100"
                  style={{
                    backgroundImage:
                      "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Jieun&backgroundColor=e0d4f7')",
                    backgroundSize: 'cover',
                  }}
                />
                <div>
                  <div className="font-bold text-[#191F28]">박지은 님</div>
                  <div className="text-sm text-[#8B95A1]">블로거, N잡러</div>
                </div>
              </div>
              <p className="text-[#4A5568] leading-relaxed">
                "한 달에 얼마 벌었는지 따로 계산 안 해도 되니까 좋아요. 수익 관리가 이렇게 쉬울
                줄이야!"
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
            <br />더 강력한 기능이 필요하다면 PRO를 선택하세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            {/* FREE Plan */}
            <div className="bg-white rounded-[32px] p-10 border border-gray-100 flex flex-col items-start text-left hover:bg-white transition">
              <h3 className="text-2xl font-bold mb-2 text-[#191F28]">FREE</h3>
              <p className="text-[#6B7684] mb-6">기본 기능을 모두 무료로 사용하세요.</p>
              <ul className="text-[16px] text-[#4E5968] space-y-3 mb-8 flex-grow">
                <li>✔ 체험단 일정 등록</li>
                <li>✔ 캘린더 확인</li>
                <li>✔ 방문 일정 브리핑</li>
                <li>✔ 이번 달 수익/통계 페이지 제공</li>
                {/* <li>✔ 수익 자랑하기</li>
                <li className="pl-6 mt-[-4px] text-xs">
                  ( 수익 자랑하기는 12월 중으로 찾아올게요. 조금만 기다려주세요 ! )
                </li> */}
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
              <h3 className="text-2xl font-bold mb-2 text-[#FF5722]">고급 기능</h3>
              <p className="text-[#6B7684] mb-6">더 깊고 편리한 리뷰 관리 기능</p>
              <ul className="text-[16px] text-[#333D4B] space-y-3 mb-9 flex-grow font-medium">
                <li>✔ 체험단 일정 등록</li>
                <li>✔ 캘린더 확인</li>
                <li>✔ 방문 일정 브리핑</li>
                <li>✔ 월별 수익 내용 전체 조회 가능</li>
                <li className="pl-5 mt-[-4px] text-xs">월별 성장 변화도 한눈에 확인</li>
                <li>✔ 카카오 알림톡으로 요약 제공 </li>
                <li className="pl-5 mt-[-4px] text-xs">
                  방문, 마감 일정 또는 마감 초과가 있는 날, <br />
                  아침에 카카오 알림톡으로 요약해드려요.
                </li>
                <li>✔ 활동 내역 엑셀 다운로드</li>
              </ul>
              <div className="w-full pt-6 border-t border-gray-100">
                <div className="flex items-end gap-2 mb-5">
                  <span className="text-3xl font-bold text-[#191F28]">Beta 무료</span>
                  <span className="text-lg text-[#8B95A1]">/ 현재 모든 기능 무료 제공</span>
                </div>
                <button
                  onClick={handleFreeTrial}
                  className="w-full bg-[#FF5722] text-white px-6 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-orange-500/30 hover:bg-[#E64A19] transition cursor-pointer"
                >
                  지금 무료로 시작하기
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
                네! 기본 기능은 완전 무료입니다. 일정 관리, 수익 조회, 이번달 통계 등 핵심 기능을
                모두 사용하실 수 있어요. 지금 바로 회원가입 후 PRO 1개월 무료 혜택으로 이용해 보세요
                :)
              </p>
            </details>
            <details className="bg-white rounded-2xl p-6 shadow-sm">
              <summary className="font-bold text-[#191F28] cursor-pointer text-sm md:text-base">
                PRO 버전은 언제 필요한가요?
              </summary>
              <p className="mt-4 text-[#6B7684] text-sm md:text-base leading-relaxed">
                마감일·방문일·마감 초과 알림을 카카오 알림톡으로 받고 싶을 때 PRO가 필요해요. 매월
                가계부처럼 정리해보고 싶을 때도 PRO가 잘 맞아요.
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

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-[#8B95A1] text-sm">
          <div className="mb-4 md:mb-0 flex items-center gap-2">
            <img src="/logo.png" alt="ReviewFlow" className="h-20" />
            <span className="mx-2">|</span>
            Copyright © 2025
          </div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[#333]">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-[#333]">
              개인정보처리방침
            </Link>
            <a href="#" className="hover:text-[#333]">
              문의하기
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
