# Cloudflare 실시간 서비스 마이그레이션 설계

- 작성일: 2026-08-09
- 상태: 설계 승인됨, 구현 전
- 대상: 커피 내기, 룰렛, 폭탄 돌리기, 팀 나누기의 방 공유 및 실시간 상태

## 1. 결론

Supabase의 `rooms` 테이블, Realtime Broadcast, Presence를 Cloudflare Worker와 SQLite 기반 Durable Objects로 교체한다. 방 하나를 Durable Object 하나에 대응시키고, 해당 객체가 현재 게임 상태, 최종 결과, 참여자 연결, 최근 채팅을 함께 관리한다.

초기 버전에는 Neon, D1 같은 별도 데이터베이스를 두지 않는다. Durable Object의 내장 SQLite 저장소만 사용하며, 방 생성 24시간 후 모든 저장 데이터와 연결을 만료시킨다. 장기 전적, 계정별 기록, 통계 검색이 필요해질 때만 D1을 별도 조회용 데이터베이스로 추가한다.

## 2. 목표

- Supabase 무료 프로젝트 일시정지가 방 생성과 실시간 공유에 미치는 위험을 제거한다.
- 공유 링크로 접속한 사용자가 생성 후 24시간 동안 최신 게임 상태와 최종 결과를 볼 수 있게 한다.
- 연결이 끊겼다가 복구되어도 Durable Object에 저장된 최신 스냅샷을 받게 한다.
- 방 상태, Presence, 채팅을 하나의 WebSocket 연결로 처리한다.
- 무료 플랜 한도를 고려해 유휴 방의 실행 비용과 저장 데이터를 최소화한다.
- 각 게임 화면의 상태 타입과 사용자 경험은 가능한 한 유지한다.

## 3. 범위 밖

- 회원가입과 로그인
- 24시간이 지난 게임 결과 또는 채팅 복구
- 사용자별 전적, 검색, 통계, 관리자 대시보드
- 무제한 트래픽 보장
- 기존 Supabase 방 데이터의 영구 이전

배포 전 이미 존재하는 Supabase 방 링크는 짧은 전환 기간에만 지원한다. 최종 전환 후에는 새 Cloudflare 방으로 다시 만들도록 안내한다.

## 4. 선택한 구조

```text
Next.js 클라이언트
  |-- POST /rooms ---------------------- 방 생성
  |-- GET /rooms/:roomId --------------- 최초 조회 및 재접속 복구
  `-- WebSocket /rooms/:roomId/connect - 상태, 결과, 채팅, Presence
                    |
              Cloudflare Worker
                    |
          roomId -> Durable Object ID
                    |
        Durable Object (방마다 하나)
          |-- 메모리: 활성 연결과 Presence
          |-- SQLite: 메타데이터와 최신 상태
          |-- SQLite: 24시간 내 채팅
          `-- Alarm: 생성 24시간 후 삭제
```

### 4.1 Next.js 클라이언트

현재 페이지가 직접 Supabase SDK를 호출하지 않도록 `lib/realtime` 뒤에 공급자 독립적인 인터페이스를 둔다. 기존 `createRoom`, `getRoom`, `updateRoomState`, `subscribeRoomState` 호출 형태는 최대한 유지하고 내부 구현만 Cloudflare HTTP/WebSocket 클라이언트로 교체한다.

클라이언트는 `NEXT_PUBLIC_REALTIME_API_URL`로 Worker 주소를 받는다. 운영 환경에서는 `realtime.<서비스 도메인>` 같은 고정 서브도메인을 사용하고, Worker의 CORS 허용 목록에는 실제 사이트 출처만 등록한다.

### 4.2 Cloudflare Worker

Worker는 요청 검증과 방 라우팅만 담당한다.

- `POST /rooms`: 방 ID와 호스트 토큰을 생성하고 Durable Object를 초기화한다.
- `GET /rooms/:roomId`: 만료 여부를 확인하고 공개 가능한 최신 스냅샷을 반환한다.
- `GET /rooms/:roomId/connect`: WebSocket으로 업그레이드한 뒤 해당 Durable Object에 연결한다.
- 본문 크기, 게임 종류, 방 이름, 정원, 메시지 형식을 검증한다.
- CORS, 요청 ID, IP별 10분당 방 5개 생성 제한을 처리한다.

Worker 자체는 방 상태를 보관하지 않는다. 동일 `roomId`의 모든 요청을 항상 같은 Durable Object로 전달한다.

### 4.3 Durable Object

Durable Object가 방의 단일 권위 서버가 된다. 여러 사용자가 동시에 변경을 보내더라도 객체 하나가 순서대로 처리하므로 현재 Supabase의 `revision` 조건 업데이트보다 충돌 처리가 단순해진다.

저장 항목은 다음과 같다.

| 항목 | 내용 |
| --- | --- |
| 방 메타데이터 | ID, 게임 종류, 이름, 정원, 상태, 생성 시각, 만료 시각 |
| 권한 정보 | 호스트 토큰의 해시 |
| 게임 스냅샷 | 최신 게임 상태, 최종 결과, revision |
| 채팅 | 메시지 ID, 익명 actor ID, 본문, 생성 시각 |

호스트 원본 토큰은 생성 응답에서 한 번만 전달하고 서버에는 SHA-256 해시만 저장한다. 토큰은 URL에 넣지 않고 TLS로 보호된 WebSocket의 최초 인증 이벤트로 전달한다. 게임 상태 변경은 유효한 호스트 토큰이 있는 연결만 허용한다. 조회와 Presence는 공유 링크 참가자에게 허용한다.

채팅은 actor별 10초당 5개, 메시지당 500자, 방별 최근 200개로 제한한다. 200개를 넘으면 가장 오래된 메시지부터 삭제하며 모든 채팅은 방과 함께 만료된다.

### 4.4 WebSocket과 절전

Durable Object의 WebSocket Hibernation API를 사용한다. 연결이 열려 있어도 메시지가 없는 동안 객체가 유휴 상태로 전환될 수 있고, 다음 메시지 때 다시 활성화된다. `setInterval`이나 지속적인 타이머는 사용하지 않는다.

하나의 연결에서 다음 이벤트를 처리한다.

| 방향 | 이벤트 | 용도 |
| --- | --- | --- |
| 서버 -> 클라이언트 | `snapshot` | 최초 연결 및 재접속 시 전체 최신 상태 전달 |
| 클라이언트 -> 서버 | `state_update` | 호스트의 게임 상태 변경 요청 |
| 서버 -> 클라이언트 | `state_updated` | 검증된 상태와 revision 전파 |
| 클라이언트 -> 서버 | `chat_send` | 채팅 전송 |
| 서버 -> 클라이언트 | `chat_added` | 검증된 채팅 전파 |
| 서버 -> 클라이언트 | `presence_updated` | 현재 참가자 목록 전파 |
| 서버 -> 클라이언트 | `room_expired` | 만료 안내 후 연결 종료 |
| 서버 -> 클라이언트 | `error` | 권한, 충돌, 입력 오류 전달 |

모든 이벤트에는 프로토콜 버전을 넣는다. 알 수 없는 버전이나 이벤트는 연결을 즉시 끊기보다 명시적인 오류로 응답한다.

## 5. 방 생성부터 만료까지

1. 호스트가 방 만들기를 누르면 클라이언트가 초기 게임 상태와 함께 `POST /rooms`를 호출한다.
2. Worker가 UUID 방 ID와 충분히 긴 임의 호스트 토큰을 만든다.
3. Durable Object가 메타데이터와 초기 스냅샷을 SQLite에 저장하고 `createdAt + 24시간`에 Alarm을 설정한다.
4. 클라이언트는 `roomId`, `role=viewer`가 포함된 공유 링크를 표시하고 호스트 토큰은 해당 브라우저 저장소에 보관한다.
5. 참가자가 링크로 접속하면 공개 스냅샷을 조회한 뒤 WebSocket을 연결한다.
6. 호스트가 룰렛을 돌리면 서버가 새 상태와 최종 결과를 저장한 후 모든 연결에 전파한다.
7. 참가자가 재접속하면 최신 스냅샷을 받아 동일한 결과 화면을 복원한다.
8. 생성 24시간 뒤 Alarm이 실행되면 저장 데이터 삭제, `room_expired` 전파, WebSocket 종료를 수행한다.
9. 삭제 전 만료 검사가 먼저 실행되면 `410 ROOM_EXPIRED`를 반환한다. 삭제가 완료된 뒤에는 존재 기록도 없으므로 `404 ROOM_NOT_FOUND_OR_EXPIRED`를 반환한다. 클라이언트는 두 응답을 같은 만료 또는 잘못된 링크 안내로 표시한다.

접속이나 상태 변경이 있어도 만료 시각은 연장하지 않는다. 따라서 사용자는 공유 링크가 언제 사라지는지 예측할 수 있다.

## 6. 현재 Supabase 기능 대응표

| 현재 구현 | Cloudflare 구현 |
| --- | --- |
| `rooms` 테이블 INSERT/SELECT/UPDATE | Durable Object SQLite와 HTTP API |
| `postgres_changes` | WebSocket `state_updated` 이벤트 |
| Realtime Broadcast | Durable Object WebSocket 브로드캐스트 |
| Realtime Presence | 객체 메모리의 WebSocket 세션 및 attachment |
| `game_state.revision` 조건 업데이트 | Durable Object 내부 직렬 처리와 revision 검사 |
| 클라이언트의 24시간 TTL 검사 | 서버 Alarm과 클라이언트 표시용 `expiresAt` |
| Supabase RLS | Worker 입력 검증과 Durable Object 호스트 토큰 검증 |

현재 `RoomSharePanel`의 Presence와 각 게임 페이지의 Supabase 직접 참조도 공통 Cloudflare 클라이언트로 이동해야 한다. Supabase SDK를 호출하는 코드가 하나라도 남으면 프로젝트 일시정지 위험을 완전히 제거한 것이 아니다.

## 7. 오류 처리와 복구

- WebSocket 연결 실패 시 지수 백오프로 재접속하고, 재접속 성공 시 항상 전체 `snapshot`을 먼저 받는다.
- 상태 변경 요청에는 현재 `revision`을 포함한다. 오래된 revision이면 서버가 `409 STALE_REVISION`과 최신 스냅샷을 반환한다.
- 호스트 토큰이 없거나 올바르지 않으면 `403 HOST_PERMISSION_REQUIRED`를 반환한다.
- 만료 시각을 지났지만 삭제 전인 방은 `410 ROOM_EXPIRED`를 반환한다. 완전히 삭제된 방과 처음부터 없던 방은 `404 ROOM_NOT_FOUND_OR_EXPIRED`로 처리한다.
- 메시지 크기, 채팅 길이, 허용 게임 종류를 서버에서 다시 검증한다.
- 무료 한도 초과나 Cloudflare 장애 시 화면에 재시도 가능한 서비스 오류를 표시한다. 로컬 룰렛 자체는 계속 사용할 수 있게 하되 공유 기능만 비활성화한다.
- 룰렛 결과 저장 성공 전에 완료 화면을 확정하지 않는다. 저장 실패 시 호스트에게 재시도 상태를 명확히 보여준다.

## 8. 무료 플랜 운영 기준

2026-08-09 기준 Workers Free와 SQLite 기반 Durable Objects를 사용한다.

- Worker 요청: 하루 100,000건
- Durable Object 요청: 하루 100,000건
- Durable Object SQLite: 하루 5백만 행 읽기, 10만 행 쓰기, 총 5GB 저장
- 무료 한도를 넘은 작업은 다음 UTC 일일 초기화 전까지 실패할 수 있다.
- WebSocket 연결 생성은 요청으로 계산되고, Durable Object로 들어오는 WebSocket 메시지는 과금 계산에서 20개당 요청 1개 비율이 적용된다.
- WebSocket Hibernation을 사용해 유휴 연결의 실행 시간을 줄인다.

이는 유휴 상태라는 이유만으로 프로젝트 전체를 일시정지하는 구조는 아니지만, 무제한 또는 절대 무중단을 뜻하지 않는다. 운영 지표가 무료 한도의 70%에 도달하면 Workers Paid 전환을 검토한다. 현재 가격 체계에서 Workers Paid는 월 최소 5달러이며, 실제 비용은 사용량에 따라 늘어날 수 있다.

공식 자료:

- [Durable Objects 개요](https://developers.cloudflare.com/durable-objects/)
- [Durable Objects 가격과 무료 한도](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects WebSocket 권장 방식](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Workers 가격](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)

## 9. 마이그레이션 단계

### 1단계: Cloudflare 기반 추가

- Worker와 SQLite 기반 Durable Object 프로젝트를 추가한다.
- 방 생성, 조회, 상태 변경, WebSocket, Alarm API를 구현한다.
- 프로토콜 타입과 오류 코드를 클라이언트와 공유한다.

### 2단계: 공급자 어댑터 분리

- `lib/realtime`의 공개 함수 형태는 유지하고 Supabase와 Cloudflare 구현을 분리한다.
- 임시 환경 변수로 실시간 공급자를 선택할 수 있게 한다.
- 이 전환 스위치는 검증 기간에만 사용하고 최종 정리 단계에서 제거한다.

### 3단계: 룰렛 우선 전환

- 룰렛을 Cloudflare 공급자로 연결한다.
- 두 개 이상의 브라우저에서 회전 상황과 최종 결과가 일치하는지 확인한다.
- 연결 종료 후 재접속, 새로고침, 호스트 권한, revision 충돌을 확인한다.
- 24시간 만료는 테스트 환경에서 짧은 TTL로 대체해 검증한다.

### 4단계: 나머지 게임과 공통 Presence 전환

- 커피 내기, 폭탄 돌리기, 팀 나누기를 차례로 전환한다.
- `RoomSharePanel`과 게임 페이지 안의 Supabase Presence 직접 호출을 제거한다.
- 공통 WebSocket 하나에서 상태와 Presence를 함께 처리한다.

### 5단계: 채팅 연결

- 같은 WebSocket 프로토콜에 채팅 이벤트를 활성화한다.
- 최근 채팅을 방의 SQLite에 저장하고 방과 함께 만료시킨다.
- actor별 10초당 5개, 본문 500자, 방별 최근 200개 제한을 적용한다.

### 6단계: 운영 전환과 Supabase 제거

- 새 방 생성을 Cloudflare로 완전히 전환한다.
- 기존 Supabase 방 링크에는 만료 또는 새 방 생성 안내를 표시한다.
- 안정화 확인 후 `@supabase/supabase-js`, Supabase 환경 변수, 클라이언트, RLS 문서 및 직접 참조를 제거한다.
- 공급자 선택용 임시 코드도 함께 제거해 Cloudflare만 남긴다.

## 10. 검증 전략

### 자동 테스트

- 방 생성 입력 검증과 호스트 토큰 검증 단위 테스트
- revision 증가와 오래된 변경 거절 테스트
- 스냅샷 저장 및 객체 재시작 후 복원 테스트
- WebSocket 연결, 브로드캐스트, Presence 정리 테스트
- Alarm 직전 `410` 응답, Alarm 실행 후 데이터 삭제와 `404` 응답 테스트
- 채팅 길이 및 속도 제한 테스트

Durable Objects 테스트에는 `cloudflare:test`와 Vitest 기반 통합 테스트를 사용한다. 객체를 강제로 메모리에서 제거한 뒤에도 SQLite 스냅샷으로 복원되는지 확인한다.

### 브라우저 검증

- 호스트와 참가자 브라우저에서 룰렛 진행 상황과 결과 일치
- 참가자 새로고침 후 최종 결과 복원
- 호스트 네트워크 단절 후 재연결 및 조작 권한 유지
- 참가자가 호스트 이벤트를 보내려 할 때 거절
- 모바일과 데스크톱 간 공유 링크 접속
- 만료된 링크의 안내 화면

## 11. 전환 및 롤백

Cloudflare 구현 검증 중에는 환경 변수로 Supabase 공급자로 되돌릴 수 있게 한다. 데이터 이중 쓰기는 충돌과 비용을 늘리므로 사용하지 않는다. 공급자 전환은 새로 생성되는 방에만 적용하며, 방 ID에 공급자 접두사를 넣거나 생성 시점의 배포 버전으로 라우팅을 구분한다.

룰렛 검증에서 심각한 문제가 발견되면 새 방 생성 공급자를 Supabase로 되돌리고 Cloudflare 방은 24시간 동안 자연 만료시킨다. 전체 게임 전환과 안정화가 끝난 뒤 Supabase 코드를 삭제하면 이 롤백 경로도 종료된다.

## 12. 완료 조건

- 네 가지 게임 모두 Supabase 없이 방 생성, 참여, 상태 공유가 동작한다.
- 룰렛의 진행 상태와 최종 결과가 두 개 이상의 브라우저에서 동일하다.
- 새로고침과 재접속 후 24시간 이내 최종 결과가 복원된다.
- 방 생성 24시간 후 상태, 결과, 채팅이 삭제되고 링크가 만료 안내를 표시한다.
- 참가자는 호스트 전용 게임 상태를 변경할 수 없다.
- 코드와 운영 환경에서 Supabase SDK 및 환경 변수 의존성이 제거된다.
- 무료 한도 사용량과 오류를 Cloudflare 대시보드에서 확인할 수 있다.

## 13. 향후 별도 DB를 추가하는 기준

다음 요구가 생기기 전에는 별도 DB를 추가하지 않는다.

- 24시간이 지난 결과나 채팅을 다시 조회해야 한다.
- 사용자 계정과 전적을 연결해야 한다.
- 여러 방을 가로질러 검색, 순위, 통계를 계산해야 한다.
- 운영자가 전체 방 기록을 조회해야 한다.

이 경우 Durable Object는 실시간 방 조정 역할을 계속 맡고, 완료된 결과만 D1에 비동기로 기록한다. 실시간 메시지마다 D1에 쓰지는 않는다.
