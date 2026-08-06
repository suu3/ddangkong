# Supabase RLS/Policy 가이드 (rooms 테이블)

브라우저에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 사용할 때는 반드시 RLS를 활성화하고 정책을 설정해야 합니다.

이 문서의 SQL은 Supabase 대시보드 > SQL Editor에서 실행합니다. 앱 코드가 아니라 **DB 쪽에서 직접 적용해야 하는 부분**입니다.

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
  and game_type in ('coffee', 'roulette', 'hot_potato', 'team_split')
  and char_length(coalesce(name, '')) <= 30
  and max_capacity between 2 and 20
);

-- 2) 방 조회 허용 (24시간 이내에 만들어진 방만)
create policy "rooms_select_public"
on public.rooms
for select
to anon
using (
  status = 'active'
  and created_at > now() - interval '24 hours'
);

-- 3) 방 상태 업데이트 허용 (24시간 이내에 만들어진 방만)
create policy "rooms_update_public"
on public.rooms
for update
to anon
using (
  status = 'active'
  and created_at > now() - interval '24 hours'
)
with check (status = 'active');
```

`name` 길이와 `max_capacity` 범위는 클라이언트(`lib/realtime/rooms.ts`의 `sanitizeRoomName` / `sanitizeMaxCapacity`)에서도 한 번 걸러지지만,
브라우저 요청은 얼마든지 위조할 수 있으므로 **정책 쪽 검증이 실제 방어선**입니다. 두 값의 상한을 바꿀 때는 양쪽을 함께 수정하세요.

## 3) 방 만료 정리 (Cleanup)

정책만으로도 24시간이 지난 방은 접근이 차단되지만, 행 자체는 남습니다. `pg_cron`으로 주기적으로 삭제합니다.

```sql
-- 1) 확장 활성화 (Database > Extensions에서 pg_cron 활성화 후)
create extension if not exists pg_cron with schema extensions;

-- 2) 만료 방 삭제 함수
create or replace function public.cleanup_expired_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms
  where created_at < now() - interval '24 hours';
$$;

-- 3) 매시 정각 실행
select cron.schedule(
  'cleanup-expired-rooms',
  '0 * * * *',
  $$select public.cleanup_expired_rooms();$$
);
```

앱 쪽 만료 기준은 `lib/realtime/rooms.ts`의 `ROOM_TTL_MS`(24시간)입니다. 위 interval과 값을 맞춰 두세요.

## 4) 방 생성 Rate Limiting

브라우저에서 anon key로 직접 insert하는 구조라 **IP 단위 제한은 DB만으로는 불가능**합니다. 현재는 두 겹으로 완화합니다.

1. **클라이언트 제한(적용됨)**: `lib/realtime/rooms.ts`의 `assertCreateRateLimit`이 localStorage 기록을 보고 10분에 5개까지만 허용합니다.
   → 일반 사용자의 오조작/연타는 막지만, 스크립트 남용은 막지 못합니다.
2. **DB 안전밸브(선택)**: 짧은 시간에 비정상적으로 많은 방이 생기면 insert를 거부합니다.

```sql
create or replace function public.enforce_room_insert_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.rooms
  where created_at > now() - interval '1 minute';

  if recent_count > 60 then
    raise exception 'room creation rate limit exceeded';
  end if;

  return new;
end;
$$;

create trigger rooms_rate_limit
before insert on public.rooms
for each row execute function public.enforce_room_insert_rate();
```

⚠️ 이 트리거는 **전역 카운트**라 트래픽이 몰리면 정상 사용자도 막힐 수 있습니다. 임계값(60)은 실제 사용량을 보고 조정하세요.
IP/세션 단위로 정확히 제한하려면 방 생성을 Edge Function이나 Next.js Route Handler(서버)에서 처리하도록 옮겨야 합니다.

## 5) 주의사항

- 위 정책은 데모/퍼블릭 게임 링크 공유용 최소 정책입니다.
- 익명(anon) 접근이므로 **신원 보장은 없습니다.** 같은 방 링크를 아는 사람은 누구나 상태를 바꿀 수 있습니다.
- 강한 권한 통제(방장만 수정 등)가 필요하면 Supabase Auth + `auth.uid()` 기반 정책으로 옮겨야 합니다.
- Secret key는 서버에서만 사용하고, 프론트 코드에는 넣지 않습니다.

## 6) 검증 체크리스트

- Host가 방 생성 가능
- Viewer가 같은 방 조회 가능
- Host 액션에 따라 `game_state` 업데이트 및 Realtime 수신 가능
- 길이 31자 이상 방 이름 / `max_capacity` 범위 밖 값으로 insert 시 거부되는지 확인
- 24시간이 지난 방 ID로 참여 시 "만료된 방" 안내가 뜨는지 확인
- `cleanup_expired_rooms()` 수동 실행 후 오래된 행이 삭제되는지 확인
