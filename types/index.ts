export interface Schedule {
  id: number
  title: string
  status: "선정됨" | "방문일 예약 완료" | "방문" | "구매 완료" | "제품 배송 완료" | "완료" | "취소" | "재확인"
  platform: string
  reviewType: "제공형" | "페이백형" | "페이백+구매평" | "구매평" | "기자단" | "미션/인증" | "방문형" | "배달형"
  channel: "네이버블로그" | "인스타그램" | "인스타그램 reels" | "네이버클립" | "유튜브 shorts" | "틱톡" | "쓰레드" | "기타(구매평/인증)"
  category: "맛집" | "식품" | "뷰티" | "여행" | "디지털" | "반려동물" | "기타"
  region: string
  visit: string
  dead: string
  benefit: number
  income: number
  cost: number
  postingLink: string
  purchaseLink: string
  guideLink: string
  guideFiles: string[]
  memo: string
}

export interface Todo {
  id: number
  text: string
  done: boolean
}

export interface Channel {
  id: number
  type: "네이버블로그" | "인스타그램" | "유튜브" | "틱톡" | "쓰레드"
  name: string // 채널명 (예: "김제미의 맛집일기")
  followers?: number // 팔로워/이웃 수
  monthlyVisitors?: number // 월 방문자 (블로그용)
  avgViews?: number // 평균 조회수
  avgReach?: number // 평균 도달 (인스타용)
  avgEngagement?: number // 평균 참여율 (%)
  url?: string // 채널 URL
}

export interface FeaturedPost {
  id: number
  title: string
  thumbnail: string
  url: string
  views: number
  channel: string
}
