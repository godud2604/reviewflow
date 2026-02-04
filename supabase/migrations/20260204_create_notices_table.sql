-- 공지사항 테이블 생성
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 공지사항 읽음 상태 테이블 생성
create table if not exists public.notice_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_id uuid not null references public.notices(id) on delete cascade,
  read_at timestamptz default now(),
  unique(user_id, notice_id)
);

-- 인덱스 생성
create index if not exists idx_notices_created_at on public.notices(created_at desc);
create index if not exists idx_notices_is_pinned on public.notices(is_pinned, created_at desc);
create index if not exists idx_notice_reads_user_id on public.notice_reads(user_id);
create index if not exists idx_notice_reads_notice_id on public.notice_reads(notice_id);

-- RLS 정책 설정
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

-- 모든 사용자가 공지사항을 읽을 수 있음
create policy "공지사항은 누구나 읽을 수 있음"
  on public.notices for select
  using (true);

-- 자신의 읽음 상태 조회 가능
create policy "자신의 읽음 상태 조회 가능"
  on public.notice_reads for select
  using (auth.uid() = user_id);

-- 자신의 읽음 상태 추가 가능
create policy "자신의 읽음 상태 추가 가능"
  on public.notice_reads for insert
  with check (auth.uid() = user_id);

-- 초기 공지사항 데이터 추가
insert into public.notices (title, content, is_pinned) values
(
  '홈 화면 위젯이 추가되었어요! 🎉',
  E'일정을 한눈에 확인할 수 있는 홈 화면 위젯이 추가되었습니다.\n스토어에서 최신 버전으로 업데이트해주세요.\n\n📱 위젯 설치 방법\n• iOS: 홈 화면 길게 누르기 → 왼쪽 상단 + 버튼 → 리뷰플로우 검색\n• Android: 홈 화면 길게 누르기 → 위젯 → 리뷰플로우 검색\n\n🌟 갤럭시 위젯 동기화 문제 해결됨!\n최신 업데이트에서 갤럭시 위젯 동기화 문제가 해결되었습니다.\n\n1️⃣ 기존 위젯 삭제 후 다시 추가 → 앱 재로그인\n2️⃣ 그래도 동기화가 안 된다면, 피드백 > 오류 신고로 문의해주세요.',
  true
);
