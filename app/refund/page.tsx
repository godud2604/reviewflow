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
            {/* 기본 원칙 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">기본 원칙</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  리뷰플로우는 디지털 서비스의 특성상 서비스 이용이 개시된 이후에는 원칙적으로
                  환불이 제한됩니다.
                </p>
                <p>다만, 아래의 경우 환불을 검토하며, 개별 상황에 따라 결정됩니다.</p>
              </div>
            </section>

            {/* 환불 가능한 경우 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">환불 요청 가능한 경우</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>다음의 경우 환불을 요청하실 수 있습니다:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>서비스 장애로 인해 정상적으로 이용할 수 없었던 경우</li>
                  <li>회사의 귀책사유로 서비스 제공이 불가능한 경우</li>
                  <li>중복 결제가 발생한 경우</li>
                  <li>기타 관련 법령에 따라 환불이 필요하다고 판단되는 경우</li>
                </ul>
              </div>
            </section>

            {/* 환불 절차 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">환불 절차</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>환불을 요청하시려면:</p>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>
                    고객센터 이메일(
                    <a href="mailto:admin@reviewflow.kr" className="text-[#FF5722] hover:underline">
                      admin@reviewflow.kr
                    </a>
                    )로 환불 요청
                  </li>
                  <li>결제 내역 및 환불 사유를 구체적으로 작성</li>
                  <li>회사의 검토 후 3~5 영업일 내 환불 가능 여부 안내</li>
                  <li>승인 시 원래 결제 수단으로 환불 처리 (카드사 정책에 따라 3~7일 소요)</li>
                </ol>
              </div>
            </section>

            {/* 결제 대행사 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">결제 대행 및 환불 처리</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  리뷰플로우의 모든 결제는 Paddle을 통해 처리됩니다. 환불 또한 Paddle을 통해
                  진행되며, Paddle의 환불 정책도 적용될 수 있습니다.
                </p>
                <p>
                  Paddle 환불 정책:{' '}
                  <a
                    href="https://www.paddle.com/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF5722] hover:underline"
                  >
                    https://www.paddle.com/legal/terms
                  </a>
                </p>
              </div>
            </section>

            {/* 자동 갱신 취소 */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-[#111827]">자동 갱신 취소</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>
                  구독 서비스는 자동으로 갱신됩니다. 자동 갱신을 원하지 않으시는 경우, 다음 결제일
                  최소 24시간 전에 구독을 취소하셔야 합니다.
                </p>
                <p>구독 취소 후에도 남은 기간 동안 서비스를 계속 이용하실 수 있습니다.</p>
              </div>
            </section>

            {/* 문의 */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-[#111827]">환불 문의</h2>
              <div className="space-y-2 text-sm md:text-base leading-relaxed text-[#374151]">
                <p>환불 관련 문의는 아래로 연락 주시기 바랍니다:</p>
                <p className="font-medium">
                  📧 이메일:{' '}
                  <a href="mailto:admin@reviewflow.kr" className="text-[#FF5722] hover:underline">
                    admin@reviewflow.kr
                  </a>
                </p>
                <p className="text-[#6B7280] text-sm">영업일 기준 1~2일 내에 답변 드립니다.</p>
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
