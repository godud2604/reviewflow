'use client';
import { CheckCircle2, Crown } from 'lucide-react';

const Portfolio = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <header className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#05070f] via-[#0f172a] to-[#201a49] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)] mb-8 border border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-[12px] font-semibold tracking-wider text-white backdrop-blur">
            <CheckCircle2 size={16} className="text-green-300" />
            리뷰플로우 인증 파트너 · 상위 3%
          </div>
          <div className="flex items-center gap-2">
            <Crown
              size={22}
              className="text-amber-300 drop-shadow-[0_10px_10px_rgba(255,195,0,0.8)]"
            />
            <h1 className="text-3xl font-black tracking-tight">인플루언서 00님</h1>
          </div>
          <p className="text-sm text-white/70">뷰티 · 라이프스타일 전문 에디터</p>
        </div>
        <div className="mt-6 rounded-[28px] border border-white/20 bg-gradient-to-br from-[#0b0d15] to-[#1a162d] p-4 flex flex-col gap-3 relative">
          <div className="flex items-end justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-white border border-white/30 flex items-center justify-center text-black font-black text-xs tracking-tight">
                VIP
              </div>
              <div>
                <p className="text-white/70 text-xs uppercase">Elite Tier</p>
                <p className="text-2xl font-extrabold tracking-tight">상위 1%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">💎 메탈릭 배지</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/80">
            <span className="rounded-full bg-white/10 px-3 py-1">블랙 &amp; 골드 그라데이션</span>
            <span className="rounded-full bg-white/10 px-3 py-1">홀로그램 스파클</span>
            <span className="rounded-full bg-white/10 px-3 py-1">3D 엠블럼</span>
          </div>
        </div>
      </header>

      <section className="mb-8 space-y-4">
        <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between text-xs uppercase text-white/60">
            <span>진행 중 영향력 분석</span>
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <svg viewBox="0 0 100 100" className="h-52 w-full">
                <defs>
                  <linearGradient id="innerGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="gradientStroke" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-white/10"
                  strokeWidth="1"
                  fill="transparent"
                />
                <polygon
                  points="50,6 92,34 74,92 26,92 8,34"
                  fill="url(#innerGradient)"
                  stroke="transparent"
                />
                <polygon
                  points="50,18 82,40 70,82 30,82 18,40"
                  stroke="url(#gradientStroke)"
                  strokeWidth="1.5"
                  fill="rgba(255,255,255,0.15)"
                />
              </svg>
            </div>
            <div className="flex-1 space-y-2 text-sm text-white/80">
              <p>전문성 · 성실함 · 반응률 · 크리에이티브 · 신뢰도</p>
              <p className="text-white/90 text-xs">
                오각형으로 그려진 그래프는 &quot;나는 전반적인 영향력 면에서 균형감 있게 강하다&quot;는
                메시지를 전달합니다.
              </p>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>전문성</span>
                <span>92%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>반응률</span>
                <span>88%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Portfolio;
