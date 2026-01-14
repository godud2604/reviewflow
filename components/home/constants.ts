export const AVAILABLE_STATUSES = [
  '선정됨',
  '방문일 예약 완료',
  '방문',
  '제품 배송 완료',
];
export const DEFAULT_SELECTED_STATUSES = AVAILABLE_STATUSES;

export const AVAILABLE_CATEGORIES = [
  '맛집/식품',
  '뷰티',
  '생활/리빙',
  '출산/육아',
  '주방/가전',
  '반려동물',
  '여행/레저',
  '티켓/문화생활',
  '디지털/전자기기',
  '건강/헬스',
  '자동차/모빌리티',
  '문구/오피스',
  '기타',
];

export const CALENDAR_RING_COLORS: Record<string, string> = {
  선정됨: '#f1a0b6',
  예약완료: '#61cedb',
  '방문일 예약 완료': '#61cedb',
  방문: '#5ba768',
  '제품 배송 완료': 'rgba(240, 221, 73, 1)',
  '배송 완료': '#f3c742',
  배송완료: '#f3c742',
};

export const CALENDAR_STATUS_LEGEND: { status: string; color: string; label: string }[] = [
  { status: '선정됨', color: '#f1a0b6', label: '선정됨' },
  { status: '방문일 예약 완료', color: '#61cedb', label: '방문 예약' },
  { status: '방문', color: '#5ba768', label: '방문' },
  { status: '제품 배송 완료', color: '#f3c742', label: '배송 완료' },
];

export const getScheduleRingColor = (status: string): string | undefined =>
  CALENDAR_RING_COLORS[status];
