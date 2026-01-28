import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '공지사항 | 리뷰플로우',
  description: '리뷰플로우 공지사항을 확인하세요.',
};

export default function NoticePage() {
  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#0F172A]">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <Link
          href="/?page=home"
          className="inline-flex items-center text-sm font-semibold text-[#FF5722] hover:text-[#E64A19]"
        >
          ← 홈으로 돌아가기
        </Link>

        <div className="bg-white shadow-lg rounded-3xl p-8 md:p-10 border border-gray-100 space-y-4">
          <p className="text-xs font-semibold text-[#FF7043] uppercase tracking-[0.2em]">
            Notice
          </p>
          <h1 className="text-3xl md:text-4xl font-bold">공지사항</h1>
          <div className="text-[15px] leading-relaxed text-[#374151] whitespace-pre-line">
            {`안녕하세요, 리뷰플로우입니다.

그동안 리뷰플로우를 사용해주시고,
이벤트와 후기 작성에 참여해주신 모든 분들께
진심으로 감사드립니다.

리뷰플로우는
체험단 일정과 수익을
가장 깔끔하게 정리할 수 있는 도구를 목표로
서비스를 운영해오고 있습니다.

운영하면서 많은 분들께서
“과금보다는, 일단 제대로 써보고 싶다”
“관리만이라도 편해졌으면 좋겠다”
라는 이야기를 전해주셨어요.

그 의견들을 바탕으로 고민한 끝에,
리뷰플로우는 당분간
Free / Pro 구분 없이
모든 핵심 기능을 무료로 제공하기로 결정했습니다.

✔ 기존 이벤트 참여로 제공된 Pro 혜택은 그대로 유지되며
✔ 이번 변경으로 인한 불이익은 전혀 없습니다.

앞으로는
- 체험단 일정 관리
- 마감일 / 방문일 / 진행 상태 정리
- 수익 기록과 정리

이 본질에 더 집중해,
체험단 관리가 정말 편해지는 도구로
차분히 다듬어가겠습니다.

앞으로도 사용하시면서
불편한 점이나 개선되었으면 하는 부분이 있다면
언제든 편하게 말씀해주세요.

함께 만들어주셔서 감사합니다.`}
          </div>
        </div>
      </div>
    </div>
  );
}
