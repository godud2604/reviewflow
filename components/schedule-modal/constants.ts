import type { Schedule } from '@/types';

export const CATEGORY_OPTIONS: Array<{
  value: Schedule['category'];
  label: string;
  description: string;
  icon: string;
}> = [
  { value: '맛집/식품', label: '맛집/식품', description: '맛집, 식품, 음료', icon: '🍽️' },
  { value: '뷰티', label: '뷰티', description: '화장품, 스킨/바디, 향수', icon: '💄' },
  { value: '생활/리빙', label: '생활/리빙', description: '생활용품, 홈데코/인테리어', icon: '🏡' },
  { value: '출산/육아', label: '출산/육아', description: '유아동, 출산 용품', icon: '🤱' },
  { value: '주방/가전', label: '주방/가전', description: '주방용품, 가전디지털', icon: '🧺' },
  { value: '반려동물', label: '반려동물', description: '반려동물 용품/서비스', icon: '🐶' },
  { value: '여행/레저', label: '여행/레저', description: '여행, 숙박, 체험/레저', icon: '✈️' },
  { value: '데이트', label: '데이트', description: '데이트 코스, 커플 체험', icon: '💑' },
  {
    value: '웨딩',
    label: '웨딩',
    description: '웨딩 스냅, 부케, 예복, 스튜디오',
    icon: '💍',
  },
  {
    value: '티켓/문화생활',
    label: '티켓/문화생활',
    description: '공연, 전시, 영화, 티켓',
    icon: '🎫',
  },
  {
    value: '디지털/전자기기',
    label: '디지털/전자기기',
    description: 'IT주변기기, 모바일, 카메라',
    icon: '🎧',
  },
  { value: '건강/헬스', label: '건강/헬스', description: '건강식품, 영양제, 운동용품', icon: '💪' },
  {
    value: '자동차/모빌리티',
    label: '자동차/모빌리티',
    description: '자동차, 모빌리티 용품',
    icon: '🚗',
  },
  { value: '문구/오피스', label: '문구/오피스', description: '문구류, 오피스 용품', icon: '✏️' },
  { value: '기타', label: '기타', description: '그 외 모든 카테고리', icon: '📦' },
];

export const DEFAULT_VISIT_REVIEW_CHECKLIST: NonNullable<Schedule['visitReviewChecklist']> = {
  naverReservation: false,
  platformAppReview: false,
  cafeReview: false,
  googleReview: false,
  other: false,
  otherText: '',
};

export const BENEFIT_FIELD = {
  field: 'benefit' as const,
  label: '제품/서비스 가격',
  description: '제품/서비스 가격',
};

export const MANAGE_BUTTON_CLASS =
  'flex items-center gap-1 rounded-[16px] border border-[#FF5722]/40 bg-white px-3 py-1 text-[12px] font-semibold text-[#FF5722] transition hover:bg-[#FF5722] hover:text-white hover:shadow-[0_10px_22px_rgba(255,87,34,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50';

export type VisitReviewChecklist = NonNullable<Schedule['visitReviewChecklist']>;
export type VisitReviewToggleKey = Exclude<keyof VisitReviewChecklist, 'otherText'>;

export const VISIT_REVIEW_OPTIONS: Array<{ key: VisitReviewToggleKey; label: string }> = [
  { key: 'naverReservation', label: '네이버 예약 리뷰' },
  { key: 'googleReview', label: '구글 리뷰' },
  { key: 'other', label: '기타' },
];

export const STATUS_ORDER: Schedule['status'][] = [
  '선정됨',
  '방문일 예약 완료',
  '방문',
  '구매 완료',
  '제품 배송 완료',
  '완료',
  '재확인',
];

export const COMMON_STATUSES: Schedule['status'][] = ['선정됨', '완료'];

export const STATUS_BY_REVIEW_TYPE: Record<Schedule['reviewType'], Schedule['status'][]> = {
  방문형: ['방문일 예약 완료', '방문'],
  구매형: ['구매 완료'],
  제공형: ['제품 배송 완료'],
  기자단: [],
  '미션/인증': [],
};
