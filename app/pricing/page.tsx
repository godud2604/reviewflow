import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '요금제 | 리뷰플로우',
  description: '리뷰플로우의 요금제를 확인하고 구독하세요',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#0F172A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8 sm:space-y-10">
        <Link
          href="/event"
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
            체험단 관리를 더 효율적으로. 지금 바로 시작하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white shadow-lg rounded-3xl p-6 sm:p-8 border border-gray-200 hover:border-[#FF5722] transition-all">
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
                  <span className="text-[#374151]">이번 달 및 예정 수익/비용 통계</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[#FF5722] mt-0.5 sm:mt-1">✓</span>
                  <span className="text-[#374151]">월별 성장 추이 내역 확인</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-[#FF5722] to-[#FF7043] shadow-xl rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">PRO</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold">₩2,900</span>
                  <span className="text-sm sm:text-base text-white/90">/월</span>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3 py-5 sm:py-6 border-t border-b border-white/20 text-sm sm:text-base">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>체험단 일정 관리</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>캘린더 뷰 모드</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>일정 리스트 (할 일/완료)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>일정 리스트 검색 및 필터</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>과거 포함 전체 수익/비용 통계</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>월별 성장 추이 내역 확인</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>카카오 알림톡으료 요약 제공 (방문, 마감, 마감 초과)</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 sm:mt-1">✓</span>
                  <span>활동 내역 엑셀 다운로드</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        {/* <div className="bg-white shadow-lg rounded-3xl p-8 md:p-10 max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-bold mb-8 text-center">자주 묻는 질문</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">결제 방법은 어떻게 되나요?</h3>
              <p className="text-[#6B7280]">
                Paddle을 통해 안전하게 결제하실 수 있으며, 신용카드 및 다양한 결제 수단을
                지원합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg">환불 정책은 어떻게 되나요?</h3>
              <p className="text-[#6B7280]">
                디지털 서비스 특성상 환불이 제한될 수 있습니다. 자세한 내용은{' '}
                <Link href="/refund" className="text-[#FF5722] hover:underline">
                  환불 정책
                </Link>
                을 참고하세요.
              </p>
            </div>
          </div>
        </div> */}

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
