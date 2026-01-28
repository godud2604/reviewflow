# 위젯 데이터 저장 규격 (Home Page 기반) v1

본 문서는 `components/home-page.tsx`, `components/schedule-item.tsx` 기준으로 **달력 + 할일 리스트**를 위젯에서 “웬만해선 그대로” 표현하기 위한 **앱(네이티브) 저장 스냅샷 규격**입니다.

## 0. 목표/원칙

- 위젯 렌더링은 앱/위젯이 **공유 저장소**에서 JSON 스냅샷을 읽어 수행한다.
- 날짜/정렬/할일 판별 로직은 `home-page`와 동일한 결과가 나오도록 한다.
- 저장 데이터는 위젯 표시를 위한 최소 필드만 포함한다(가이드 파일, 링크 등은 제외).
- 시간대는 `Asia/Seoul` 기준으로 날짜 문자열(`YYYY-MM-DD`)을 사용한다.

## 1. 저장 위치(권장)

> 저장 위치는 앱 구현에 따라 달라질 수 있으나, 아래 형태를 권장합니다.

- iOS: App Groups `UserDefaults` 또는 파일(`Application Support` + App Group)
- Android: `SharedPreferences` 또는 `Room` (AppWidget에서 접근 가능하게 구성)

## 2. 저장 키(권장)

- `widget.home.v1` : 홈 위젯(달력 + 할일리스트) 1개 JSON 스냅샷
- (옵션) `widget.lastSyncedAt` : epoch ms (위젯에 “마지막 업데이트” 노출용)

## 3. 공통 규칙

### 3-1. 날짜 포맷

- `date`: `YYYY-MM-DD` (KST 기준)
- `month`: `YYYY-MM`
- `issuedAt`: epoch milliseconds

### 3-2. 버전/호환

- `version`이 다른 경우: 앱/위젯은 **안전하게 무시**하고 “업데이트 필요” 상태를 표시한다.
- 필드 추가는 optional로만 진행(하위호환 유지).

## 4. 데이터 스키마

### 4-1. Root: `WidgetHomeSnapshotV1`

```ts
type WidgetHomeSnapshotV1 = {
  version: '1';
  issuedAt: number; // epoch ms
  timeZone: 'Asia/Seoul';
  userId: string; // 앱에서 사용자 구분용(로그아웃/계정전환 시 스냅샷 폐기)

  today: string; // YYYY-MM-DD

  calendar: WidgetCalendarMonthV1;
  todo: WidgetTodoListV1;
};
```

### 4-2. Calendar: `WidgetCalendarMonthV1`

`home-page`의 `CalendarSection`이 계산하는 `scheduleByDate` 결과를 위젯이 바로 렌더링할 수 있도록 저장합니다.

```ts
type WidgetCalendarMonthV1 = {
  month: string; // YYYY-MM (위젯이 렌더링하는 “현재 월”)
  selectedDate?: string | null; // YYYY-MM-DD (옵션: 위젯 UX에 따라)

  // key: YYYY-MM-DD
  days: Record<string, WidgetCalendarDayInfoV1>;

  // (옵션) 웹과 동일한 색상 매핑을 앱에 하드코딩하지 않으려면 함께 저장
  statusRingColors?: Record<string, string>; // status -> hex/rgba
  statusLegend?: Array<{ status: string; label: string; color: string }>;
};

type WidgetCalendarDayInfoV1 = {
  // home-page 로직 그대로:
  deadlineCount: number; // dead + 추가마감(미완료) 카운트
  visitCount: number; // visit 카운트
  hasDeadline: boolean; // 미완료 dead/추가마감이 존재
  hasVisit: boolean; // visit 존재
  overdue: boolean; // 미완료 dead/추가마감 중 오늘 이전 존재
  hasCompleted: boolean; // 완료 표시 점(마감 없는 완료 또는 완료 상태 등)
  hasPaybackPending: boolean; // paybackExpected && !paybackConfirmed

  // home-page는 상태별 링을 gradient로 표시하므로, 렌더링에 필요한 색상 배열을 저장
  ringStatusColors: string[]; // ex) ['#f1a0b6', '#61cedb', ...]
};
```

#### 4-2-1. `days` 계산 규칙(원본: `components/home-page.tsx`)

각 `Schedule`에 대해 아래를 적용해 `days[date]`를 채웁니다.

- 완료 여부: `isCompleted = schedule.status === '완료'`
- 링 색상:
  - `isCompleted`이면 링 색상 없음
  - 아니면 `statusRingColors[status]`에 해당하면 `ringStatusColors`에 push
- `dead`:
  - `dead`가 있고 `isCompleted`면 `hasCompleted = true`
  - `dead`가 있고 미완료면 `hasDeadline = true`, `deadlineCount++`
  - `dead < today`면 `overdue = true`
- `additionalDeadlines[]`:
  - `deadline.date`가 있고 `deadline.completed !== true`면 `hasDeadline = true`, `deadlineCount++`
  - `deadline.date < today`면 `overdue = true`
  - 미완료인 경우에 한해 링 색상도 push(웹 로직 동일)
  - `deadline.completed === true`면 `hasCompleted = true`
- `paybackExpected && !paybackConfirmed`:
  - `paybackDate = paybackExpectedDate || dead`
  - `paybackDate`가 있으면 해당 날짜에 `hasPaybackPending = true`
- `visit`:
  - `visit`가 있으면 `hasVisit = true`, `visitCount++`
  - `isCompleted && !dead`인 경우 `hasCompleted = true` (웹 로직 동일)

> 참고: 위젯에서 링 색상 중복을 제거하고 싶다면, 저장 시 `ringStatusColors`를 unique 처리할 수 있습니다(시각적 차이가 있으면 그대로 유지).

### 4-3. Todo List: `WidgetTodoListV1`

`home-page` 기본 화면은 `viewFilter='TODO'`, `sortOption='DEADLINE_SOON'`, `selectedDate=null` 상태를 기반으로 표시됩니다.

```ts
type WidgetTodoListV1 = {
  viewFilter: 'TODO'; // v1은 홈 위젯에 TODO만 저장(완료/페이백은 별도 위젯에서 관리 권장)
  sortOption: 'DEADLINE_SOON' | 'DEADLINE_LATE' | 'VISIT_SOON' | 'VISIT_LATE' | 'AMOUNT_HIGH' | 'AMOUNT_LOW';

  totalCount: number; // TODO 스케줄 전체 개수
  items: WidgetScheduleLiteV1[]; // 위젯에 표시할 상위 N개(정렬 적용 후 slice)
};
```

#### 4-3-1. TODO 판별 규칙(원본: `components/home-page.tsx`)

```ts
// 추가마감 미완료가 있으면 TODO
hasIncompleteAdditionalDeadlines(schedule) =
  (schedule.additionalDeadlines ?? []).some(d => d.date && !d.completed)

// 방문일이 오늘이고 visitTime이 아직 남아있거나, 방문일이 미래면 TODO
isVisitUpcoming(schedule) =
  schedule.visit > today ||
  (schedule.visit === today && toMinutes(schedule.visitTime, 23:59) >= nowMinutes)

isTodoSchedule(schedule) =
  schedule.status !== '완료' ||
  hasIncompleteAdditionalDeadlines(schedule) ||
  isVisitUpcoming(schedule)
```

### 4-4. Schedule Lite: `WidgetScheduleLiteV1`

`components/schedule-item.tsx`의 UI를 “최대한 동일하게” 재현하기 위해 필요한 최소 필드 집합입니다.

```ts
type WidgetScheduleLiteV1 = {
  id: number;
  title: string;

  status: string; // Schedule['status']
  platform: string;
  reviewType: string; // Schedule['reviewType']
  channel: string[]; // ScheduleChannel[]
  category: string; // Schedule['category']

  regionDetail?: string;

  // 날짜/타임라인 표시용
  visit?: string; // YYYY-MM-DD (비어있을 수 있음)
  visitTime?: string; // HH:mm (비어있을 수 있음)
  dead?: string; // YYYY-MM-DD (비어있을 수 있음)
  additionalDeadlines?: Array<{
    id: string;
    label: string;
    date: string; // YYYY-MM-DD
    completed?: boolean;
  }>;

  // 금액 표시(₩total)
  benefit: number;
  income: number;
  cost: number;

  // 페이백 배지/타임라인
  paybackExpected?: boolean;
  paybackExpectedDate?: string;
  paybackExpectedAmount?: number;
  paybackConfirmed?: boolean;

  // “영수증 리뷰”/메모 뱃지 표시용
  visitReviewChecklist?: {
    naverReservation: boolean;
    platformAppReview: boolean;
    cafeReview: boolean;
    googleReview: boolean;
    other?: boolean;
    otherText?: string;
  };
  memoExists?: boolean; // 위젯에서는 boolean만으로 충분(웹은 memo 내용 자체는 사용하지 않음)
};
```

> `memoExists`는 서버/웹에서 `Boolean(schedule.memo?.trim())`로 계산해 저장하는 것을 권장합니다.

## 5. JSON 예시

```json
{
  "version": "1",
  "issuedAt": 1769487600000,
  "timeZone": "Asia/Seoul",
  "userId": "u_123",
  "today": "2026-01-27",
  "calendar": {
    "month": "2026-01",
    "days": {
      "2026-01-27": {
        "deadlineCount": 1,
        "visitCount": 0,
        "hasDeadline": true,
        "hasVisit": false,
        "overdue": false,
        "hasCompleted": false,
        "hasPaybackPending": false,
        "ringStatusColors": ["#f1a0b6"]
      }
    }
  },
  "todo": {
    "viewFilter": "TODO",
    "sortOption": "DEADLINE_SOON",
    "totalCount": 12,
    "items": [
      {
        "id": 101,
        "title": "강남 파스타 리뷰",
        "status": "선정됨",
        "platform": "instagram",
        "reviewType": "방문형",
        "channel": ["@mychannel"],
        "category": "맛집/식품",
        "regionDetail": "서울 강남구 ...",
        "visit": "2026-01-27",
        "visitTime": "15:00",
        "dead": "2026-01-30",
        "additionalDeadlines": [{"id":"d1","label":"리뷰","date":"2026-01-29","completed":false}],
        "benefit": 55000,
        "income": 0,
        "cost": 0,
        "paybackExpected": true,
        "paybackExpectedDate": "2026-02-05",
        "paybackExpectedAmount": 20000,
        "paybackConfirmed": false,
        "memoExists": true
      }
    ]
  }
}
```

## 6. 위젯 액션(딥링크) 메모(옵션)

위젯에서 탭 시 앱 내 특정 화면으로 이동하려면, 앱에서 아래 형태의 딥링크를 지원하는 것을 권장합니다.

- 일정 상세: `reviewflow://schedule/{id}`
- 특정 날짜 홈: `reviewflow://home?date=YYYY-MM-DD`

