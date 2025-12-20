// components/MonthlyReport.tsx
"use client";
import Link from "next/link";
import { Award, Zap, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMonthlyRanking } from '@/hooks/use-monthly-ranking';
import { useRouter } from "next/navigation"

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const anonymousAliases = [
  '달빛 오로라',
  '비밀 노래터',
  '구름 자전거',
  '은하수 편지',
  '꿈꾸는 다람쥐',
  '별빛 도깨비',
  '파란 시계탑',
  '노을 속 감귤',
  '초코 모카팡',
  '밤하늘 표류자',
]

const getAnonymousAlias = (rank?: number) => {
  if (rank == null) {
    return '숨은 별님'
  }

  const index = (rank - 1) % anonymousAliases.length
  return anonymousAliases[index]
}

const MonthlyReport = () => {
    const router = useRouter()
  const { monthlyRanking, loading: rankingLoading } = useMonthlyRanking();

  const rankLabel = monthlyRanking?.rank ?? (rankingLoading ? '...' : '-');
  const rankDescription = monthlyRanking?.rank
    ? `전체 ${monthlyRanking.rank}위`
    : rankingLoading
      ? '순위를 확인 중이에요'
      : '순위 기록이 없습니다';
  const topPercentText = monthlyRanking?.topPercent != null
    ? `상위 ${monthlyRanking.topPercent}% 메이커 등급`
    : rankingLoading
      ? '순위를 확인 중이에요'
      : '상위 % 정보가 없습니다';

  const surroundingUsers = monthlyRanking?.surroundingUsers ?? [];

  return (
    <div className="min-h-screen bg-[#101012] text-white font-sans">
      <div className="mx-auto w-full max-w-[600px] px-6 py-2">
        {/* PRO Badge & Header */}
        <div className="flex items-center justify-between pt-7 mb-3">
          <button
            type="button"
            onClick={() => router.push("/?page=profile")}
            className="flex items-center gap-2 text-sm font-semibold text-white"
          >
            <ChevronLeft size={16} />
            프로필로 돌아가기
          </button>
        </div>
        <header className="mb-4 pt-4 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-[10px] font-black px-2 py-0.5 rounded-sm text-black">PRO</span>
              <span className="text-gray-500 text-xs font-medium">실시간 업데이트 중</span>
            </div>
            {/* <h1 className="text-2xl font-bold tracking-tight leading-tight">
              오늘 00님의 영향력은<br />
              <span className="text-[#3182f6]">어제보다 4계단 상승</span>했어요
            </h1> */}
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 p-2 rounded-full">
              <Zap size={20} className="text-amber-400 fill-amber-400" />
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-5">
          
          {/* Card 1: 실시간 수익 & 랭킹 (Main Dashboard) */}
          <section className="bg-[#1c1c1e] rounded-[28px] p-6">
            <div className="flex justify-between items-start mb-6">
              <span className="text-gray-400 text-sm font-medium">이번 달 실시간 수익 랭킹</span>
              <span className="text-[#3182f6] text-xs font-bold flex items-center">
                LIVE <span className="ml-1 w-1.5 h-1.5 bg-[#3182f6] rounded-full animate-pulse"></span>
              </span>
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#3182f6] to-[#a0c4ff] flex items-center justify-center text-2xl font-black">
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tighter">{topPercentText}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-t border-gray-800">
                <span className="text-gray-400 text-[15px]">이번달 경제적 가치</span>
                <span className="font-bold text-lg">{formatCurrency(monthlyRanking?.econValue ?? 0)}</span>
              </div>
             
            </div>
          </section>

          {/* Card 2: 챌린지 지표 (동기부여) */}
          <section className="bg-[#1c1c1e] rounded-[28px] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/10 p-3 rounded-2xl">
                <Award className="text-[#3182f6]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-0.5">상위 1%까지 남은 금액</p>
                <p className="font-bold text-white">
                  {monthlyRanking
                    ? monthlyRanking.amountToTopOnePercent === 0
                      ? '상위 1%에 진입했습니다!'
                      : formatCurrency(monthlyRanking.amountToTopOnePercent)
                    : '로딩 중'}
                </p>
              </div>
            </div>
          </section>

          {/* Card 3: 실시간 라이벌 현황 (익명 데이터) */}
          <section className="bg-[#1c1c1e] rounded-[28px] p-6">
            <h2 className="text-sm font-bold text-gray-400 mb-5">내 주변 랭킹 현황</h2>
            <div className="space-y-3">
              {surroundingUsers.length === 0 ? (
                <p className="text-xs text-gray-500">주변 랭킹 데이터가 아직 없습니다.</p>
              ) : (
                surroundingUsers.map((user) => (
                  <div
                    key={`${user.userId}-${user.rank}`}
                    className={`flex items-center justify-between p-3 rounded-2xl ${
                      user.isCurrentUser ? 'bg-[#3182f6]/20' : 'bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`ml-3 text-[15px] ${user.isCurrentUser ? 'font-bold' : ''}`}>
                        {user.isCurrentUser
                          ? '나 (본인)'
                          : `${getAnonymousAlias(user.rank)}`}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(user.econValue)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
          
          <div className="mt-4 flex justify-center pb-10">
            <Link
              href="/?page=home"
              className="inline-flex items-center justify-center rounded-[28px] border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/5"
            >
              모든 일정 보러가기
              <ChevronRight className="ml-2 w-4 h-4 text-[#3182f6]" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MonthlyReport;
