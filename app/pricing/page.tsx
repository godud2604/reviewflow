import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '무료 안내 | 리뷰플로우',
  description: '리뷰플로우는 모든 기능을 무료로 제공합니다.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#0F172A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8 sm:space-y-10">
        <Link
          href="/?page=landing"
          className="inline-flex items-center text-sm sm:text-[18px] font-semibold text-[#FF5722] hover:text-[#E64A19]"
        >
          ← 이전으로
        </Link>

        <div className="text-center space-y-1 sm:space-y-4 mb-6 sm:mb-12">
          <p className="text-[10px] sm:text-xs font-semibold text-[#FF7043] uppercase tracking-[0.2em]">
            Pricing
          </p>
          <h1 className="text-xl sm:text-4xl md:text-5xl font-bold">간편한 요금제</h1>
          <p className="text-[12px] sm:text-lg text-[#6B7280] max-w-2xl mx-auto">
            리뷰플로우는 모든 기능을 무료로 제공해요. 지금 바로 시작하세요.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow-lg rounded-3xl p-6 sm:p-8 border border-gray-200">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">무료</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold">₩0</span>
                  <span className="text-sm sm:text-base text-[#6B7280]">/월</span>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 py-5 sm:py-6 border-t border-b border-gray-200 text-sm sm:text-base">
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">체험단 일정 등록</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">캘린더 뷰 모드</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">일정 리스트 (할 일/완료)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">일정 리스트 검색 및 필터</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">전체 기간 수익/비용 통계</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">월별 성장 추이 내역 확인</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">카카오 알림톡 요약 제공</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">활동 내역 엑셀 다운로드</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-x-4 sm:space-x-6 text-xs sm:text-sm text-[#6B7280] pt-6 sm:pt-8">
          <Link href="/terms" className="hover:text-[#FF5722] transition-colors">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-[#FF5722] transition-colors">
            개인정보처리방침
          </Link>
          <Link href="/refund" className="hover:text-[#FF5722] transition-colors">
            환불 정책
          </Link>
        </div>
      </div>
    </div>
  );
}
