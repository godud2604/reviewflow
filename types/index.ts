export interface GuideFile {
  name: string; // 원본 파일명
  path: string; // Storage 내 경로
  size: number; // 파일 크기 (bytes)
  type: string; // MIME type
}

export interface Schedule {
  id: number;
  title: string;
  status:
    | '선정됨'
    | '방문일 예약 완료'
    | '방문'
    | '구매 완료'
    | '제품 배송 완료'
    | '완료'
    | '재확인';
  platform: string;
  reviewType: '제공형' | '구매형' | '기자단' | '미션/인증' | '방문형';
  channel: ScheduleChannel[];
  category:
    | '맛집/식품'
    | '뷰티'
    | '생활/리빙'
    | '출산/육아'
    | '주방/가전'
    | '반려동물'
    | '여행/레저'
    | '티켓/문화생활'
    | '디지털/전자기기'
    | '건강/헬스'
    | '자동차/모빌리티'
    | '문구/오피스'
    | '기타';
  region?: string;
  regionDetail?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  ownerPhone?: string;
  visit: string;
  visitTime: string;
  dead: string;
  benefit: number;
  income: number;
  cost: number;
  incomeDetailsJson?: string | null;
  postingLink: string;
  purchaseLink: string;
  guideFiles: GuideFile[];
  memo: string;
  reconfirmReason?: string;
  visitReviewChecklist?: {
    naverReservation: boolean;
    platformAppReview: boolean;
    cafeReview: boolean;
    googleReview: boolean;
    other?: boolean;
    otherText?: string;
  };
  paybackExpected?: boolean;
  paybackConfirmed?: boolean;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface ScheduleTransactionItem {
  id: string;
  label: string;
  amount: number;
  type: TransactionType;
  enabled?: boolean;
}

export type ScheduleChannel = string;

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export interface Channel {
  id: number;
  type: '네이버블로그' | '인스타그램' | '유튜브' | '틱톡' | '쓰레드';
  name: string; // 채널명 (예: "김제미의 맛집일기")
  followers?: number; // 팔로워/이웃 수
  monthlyVisitors?: number; // 월 방문자 (블로그용)
  avgViews?: number; // 평균 조회수
  avgReach?: number; // 평균 도달 (인스타용)
  avgEngagement?: number; // 평균 참여율 (%)
  url?: string; // 채널 URL
}

export interface FeaturedPost {
  id: number;
  title: string;
  thumbnail: string;
  url: string;
  views: number;
  channel: string;
}

export interface ExtraIncome {
  id: number;
  title: string;
  amount: number;
  date: string;
  memo?: string;
}

export interface MonthlyGrowth {
  monthStart: string; // YYYY-MM-01 형식
  benefitTotal: number;
  incomeTotal: number;
  costTotal: number;
  extraIncomeTotal: number;
  econValue: number;
}

export interface MonthlyRankingUser {
  userId: string;
  econValue: number;
  rank: number;
}

export interface MonthlyRankingNeighbor extends MonthlyRankingUser {
  isCurrentUser: boolean;
}

export interface MonthlyRankingResponse {
  monthStart: string;
  totalUsers: number;
  rank: number | null;
  econValue: number;
  topPercent: number | null;
  amountToTopOnePercent: number;
  topOnePercentRank: number;
  topUsers: MonthlyRankingUser[];
  surroundingUsers: MonthlyRankingNeighbor[];
  hasRecord: boolean;
}

export type HistoryView = 'all' | 'benefit' | 'income' | 'cost';

export interface NotificationSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}
