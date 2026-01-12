import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '환불 정책 | 리뷰플로우',
  description: '리뷰플로우 서비스의 환불 정책 안내',
};

export default function RefundPage() {
  const lastUpdated = '최종 수정일: 2026년 1월 12일';

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
            {/* 1. 총칙 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">1. 총칙</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  리뷰플로우 유료 플랜의 모든 구매는 Paddle.com을 통해 처리되며, Paddle은 모든
                  거래에 대한 Merchant of Record(판매자 대행)로 작동합니다.
                </p>
                <p>환불은 Paddle의 Buyer Terms(구매자 약관)에 따라 처리됩니다.</p>
              </div>
            </section>

            {/* 2. 소비자 취소 권리 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">2. 소비자 취소 권리</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p className="font-semibold text-[#111827]">14일 이내 전액 환불 보장</p>
                <p>
                  소비자인 경우, 구매 완료일로부터 14일 이내에 구매를 취소하고 전액 환불을 받을 수
                  있는 권리가 있습니다. 별도의 사유 없이도 환불이 가능합니다.
                </p>
                <p>이 14일 취소 기간은 구매가 완료된 다음 날부터 시작됩니다.</p>
              </div>
            </section>

            {/* 3. 환불 처리 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">3. 환불 처리</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>모든 환불 요청은 Paddle에서 처리합니다.</p>
                <p>
                  14일 기간 내에 유효한 환불 요청이 제출되면, Paddle은 Paddle의 Buyer Terms에 따라
                  14일 이내에 원래 결제 수단으로 환불을 처리합니다.
                </p>
              </div>
            </section>

            {/* 4. 환불 요청 방법 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">4. 환불 요청 방법</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  환불을 요청하시려면 구매 영수증 이메일에 포함된 환불 링크를 사용하거나, 다음
                  주소로 직접 Paddle에 문의해주세요:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 my-2">
                  <p className="font-medium text-[#111827]">Paddle 고객 지원</p>
                  <p>
                    웹사이트:{' '}
                    <a
                      href="https://paddle.net"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF5722] hover:underline"
                    >
                      https://paddle.net
                    </a>
                  </p>
                </div>
                <p className="text-[#EF4444] font-medium text-sm">
                  중요: 리뷰플로우는 결제/환불을 직접 처리하지 않습니다. 환불 요청은 반드시 Paddle을
                  통해 접수해 주세요.
                </p>
              </div>
            </section>

            {/* 5. 14일 기간 경과 후 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">5. 14일 기간 경과 후</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  14일 취소 기간이 경과한 후 제출된 환불 요청은 보장되지 않으며, Paddle의 재량에
                  따라 검토될 수 있습니다.
                </p>
              </div>
            </section>

            {/* 6. 추가 정보 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">6. 추가 정보</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>더 자세한 정보는 Paddle의 Buyer Terms를 참조해주세요:</p>
                <a
                  href="https://www.paddle.com/legal/invoiced-consumer-terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF5722] hover:underline break-all"
                >
                  https://www.paddle.com/legal/invoiced-consumer-terms
                </a>
              </div>
            </section>

            {/* 7. 일반 문의 */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-[#111827]">7. 일반 문의</h2>
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
                <p className="text-[#6B7280] text-sm">
                  ※ 결제/환불 요청은 리뷰플로우에서 처리할 수 없으며, 반드시 Paddle을 통해서만
                  접수됩니다. (위의 Paddle 링크를 이용해 주세요.)
                </p>
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
            요금제
          </Link>
        </div>
      </div>
    </div>
  );
}
