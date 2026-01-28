import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '환불 정책 | 리뷰플로우',
  description: '리뷰플로우는 현재 무료로 제공됩니다.',
};

export default function RefundPage() {
  const lastUpdated = '최종 수정일: 2026년 1월 28일';

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#0F172A]">
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold text-[#FF5722] hover:text-[#E64A19]"
        >
          ← 홈으로 돌아가기
        </Link>

        <div className="bg-white shadow-lg rounded-3xl p-8 md:p-10 border border-gray-100">
          <div className="flex flex-col gap-3 mb-8">
            <p className="text-xs font-semibold text-[#FF7043] uppercase tracking-[0.2em]">
              Refund Policy
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">환불 정책</h1>
            <p className="text-sm text-[#6B7280]">{lastUpdated}</p>
          </div>

          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">1. 안내</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>리뷰플로우는 현재 모든 기능을 무료로 제공하며, 별도의 결제/구독을 제공하지 않습니다.</p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">2. 과거 결제/환불 문의</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  과거 결제 내역에 대한 환불 문의가 필요한 경우, 구매 영수증 이메일에 포함된 안내에 따라
                  결제 대행사로 문의해 주세요.
                </p>
              </div>
            </section>

            {/* 7. 일반 문의 */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-[#111827]">3. 일반 문의</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  리뷰플로우 서비스 이용(기능/계정/기술 지원 등)과 관련된 일반 문의는 아래로 연락해
                  주세요.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 my-2">
                  <p className="font-medium text-[#111827]">리뷰플로우 고객 지원 (비결제/비환불)</p>
                  <p>
                    이메일:{' '}
                    <a href="mailto:admin@reviewflow.kr" className="text-[#FF5722] hover:underline">
                      admin@reviewflow.kr
                    </a>
                  </p>
                  <p className="text-[#6B7280] text-sm mt-1">응답 시간: 영업일 기준 24시간 이내</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-x-6 text-sm text-[#6B7280]">
          <Link href="/terms" className="hover:text-[#FF5722] transition-colors">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-[#FF5722] transition-colors">
            개인정보처리방침
          </Link>
          <Link href="/pricing" className="hover:text-[#FF5722] transition-colors">
            무료 안내
          </Link>
        </div>
      </div>
    </div>
  );
}
