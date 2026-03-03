# Supabase RLS/Policy 가이드 (rooms 테이블)

브라우저에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 사용할 때는 반드시 RLS를 활성화하고 정책을 설정해야 합니다.

## 1) RLS 활성화
```sql
alter table public.rooms enable row level security;
```

## 2) 최소 정책 예시
아래 정책은 이 프로젝트의 실시간 링크 공유(방 생성/조회/상태 업데이트)를 위한 최소 예시입니다.

```sql
-- 1) 방 생성 허용
create policy "rooms_insert_public"
on public.rooms
for insert
to anon
with check (
  status = 'active'
  and game_type in ('coffee', 'roulette', 'hot_potato')
);

-- 2) 방 조회 허용
create policy "rooms_select_public"
on public.rooms
for select
to anon
using (status = 'active');

-- 3) 방 상태 업데이트 허용
create policy "rooms_update_public"
on public.rooms
for update
to anon
using (status = 'active')
with check (status = 'active');
```

## 3) 주의사항
- 위 정책은 데모/퍼블릭 게임 링크 공유용 최소 정책입니다.
- 운영에서는 만료시간(`expires_at`) 컬럼 추가 후, 만료된 방 접근 차단 정책을 권장합니다.
- Secret key는 서버에서만 사용하고, 프론트 코드에는 넣지 않습니다.

## 4) 검증 체크리스트
- Host가 방 생성 가능
- Viewer가 같은 방 조회 가능
- Host 액션에 따라 `game_state` 업데이트 및 Realtime 수신 가능
- 만료/종료된 방 접근 제한 동작 확인
