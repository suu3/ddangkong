# 실시간 서버 가이드 (Cloudflare Worker + Durable Object)

실시간 방 공유는 `worker/`의 Cloudflare Worker가 담당합니다. Next 앱(Netlify)과 **별도로 배포**되며,
앱은 `NEXT_PUBLIC_REALTIME_URL`로 이 Worker에 붙습니다. 이 값이 없으면 모든 게임이 로컬 모드로만 동작합니다.

## 구조

- 방 하나 = `Room` Durable Object 하나 (SQLite 백엔드, WebSocket hibernation).
- Durable Object는 요청을 하나씩 처리하므로 revision 비교와 저장이 원자적으로 끝납니다.

| 엔드포인트 | 역할 |
| --- | --- |
| `POST /rooms` | 방 생성. `game_type` 화이트리스트, 방 이름(30자), `max_capacity`(2~20) 검증 |
| `GET /rooms/:id` | 방 조회. 없거나 만료면 404 |
| `PUT /rooms/:id` | 상태 저장. `expectedRevision`이 현재 revision과 다르면 409 |
| `GET /rooms/:id/ws` | WebSocket. 접속 시 현재 상태 + 접속자 목록을 받고, 이후 저장된 상태와 presence 변경을 받음 |

- **상태 broadcast**: 클라이언트가 직접 broadcast하지 않습니다. `PUT`이 성공한 상태만 서버가 전원에게 보냅니다.
- **Presence**: 소켓마다 `{ actor, cardIndex? }` 메타를 `track` 메시지로 올리고, 서버가 접속자 목록을 다시 내려줍니다.
  게임 결과에 영향을 주는 상태는 presence에 싣지 않습니다.
- **만료**: 방 생성 24시간 뒤 Durable Object alarm이 저장소를 비우고 소켓을 닫습니다 (close code `4404`).
  `lib/realtime/rooms.ts`의 `ROOM_TTL_MS`와 `worker/src/index.ts`의 `ROOM_TTL_MS`는 같은 값으로 유지하세요.
- **Origin 제한**: `worker/wrangler.jsonc`의 `ALLOWED_ORIGINS`에 있는 origin만 호출할 수 있습니다.
  도메인을 추가/변경하면 이 값을 고치고 다시 배포하세요.

## 로컬 개발

```bash
pnpm realtime:dev   # http://localhost:8787
pnpm dev            # http://localhost:3000
```

`.env`:

```
NEXT_PUBLIC_REALTIME_URL=http://localhost:8787
```

2창 검증 시 두 번째 창을 `http://127.0.0.1:3000`으로 열면 쿠키가 분리돼 다른 참가자로 접속됩니다.
로컬 방 데이터는 `.wrangler/`에 저장됩니다(커밋하지 않음).

## 배포

1. Cloudflare 계정 로그인 (최초 1회)

   ```bash
   npx wrangler login
   ```

2. Worker 배포

   ```bash
   pnpm realtime:deploy
   ```

   출력되는 `https://ddangkong-realtime.<계정>.workers.dev` 주소를 확인합니다.

3. Netlify 환경 변수에 `NEXT_PUBLIC_REALTIME_URL`을 위 주소로 등록하고 사이트를 다시 배포합니다.
   (`NEXT_PUBLIC_*` 값은 빌드 시점에 번들에 들어가므로 재배포가 필요합니다.)

Worker 코드(`worker/`)를 고치면 `pnpm realtime:deploy`를 다시 실행해야 반영됩니다. Netlify 배포와는 별개입니다.

## 무료 플랜 한도 (Workers Free)

- 요청 100,000건/일, Durable Object duration 13,000 GB-s/일, 저장 5GB.
- WebSocket 수신 메시지는 20개가 요청 1건으로 계산됩니다.
- hibernation 상태의 유휴 연결은 duration이 과금되지 않습니다.
- 비활성 기간이 길어도 프로젝트가 정지되지 않습니다.

## 보안 메모

- 로그인 없는 익명 방식이라 방 링크(UUID)를 아는 사람은 누구나 상태를 바꿀 수 있습니다.
- 방 생성 rate limit은 클라이언트(localStorage) 기준이라 오조작 방지 수준입니다.
  남용이 보이면 Worker에 IP 단위 제한(Cloudflare Rate Limiting 바인딩)을 추가하세요.
