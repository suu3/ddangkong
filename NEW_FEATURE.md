# 심심풀이 땅콩 – 미니게임 기획서: 폭탄 돌리기(Hot Potato)

## 0. 개요

- 링크 공유로 익명 유저들이 방에 들어와 **실시간으로 같은 화면**을 보며 플레이하는 복불복 미니게임.
- 타이머 종료 시점에 폭탄을 가진 사람이 당첨(벌칙 수행).

---

## 1. 시작 조건 / 진행 조건 (가드 룰)

### 필수 시작 조건

- **참가자 수가 2명 이상이어야 시작 가능**
    - `minPlayers = 2` (기본)
    - 미만일 경우 `GAME_START` 요청 거부

### 진행 중 조건

- 게임 진행 중 참가자 수가 2명 미만이 되면:
    - (권장 정책 A) **즉시 중단(ended) + “인원 부족으로 종료”**
    - (대안 정책 B) **일시정지(paused) 후 인원 충족 시 재개**
- 기본값은 구현 난이도 낮은 **정책 A** 추천

### 참여자 상태

- 진행 중 늦게 들어온 사용자는 기본적으로:
    - `spectatorUntilNextRound` (관전)
    - 다음 라운드부터 자동 참가 가능(혹은 Ready 필요)

---

## 2. 역할

- **Host(진행자)**: 시작/리셋/설정 변경 권한
- **Player(참가자)**: 시청 + “다음 사람” 버튼 입력(옵션으로 Host만 입력 가능)

---

## 3. 게임 흐름

1. 방 입장 → 닉네임 자동 생성(수정 가능) → Ready
2. Host가 설정 후 Start
3. 서버가 단일 라운드 생성(`roundId`) + `startedAtMs/endsAtMs` 확정 + 초기 소유자 선정
4. “다음 사람” 요청이 들어오면 서버가 폭탄 소유자를 랜덤 재할당
5. 타이머 0초 → 서버가 종료 선언 → 당시 소유자가 당첨
6. 결과 화면 + 히스토리 기록 → Host가 Replay/Reset

---

## 4. 설정값(옵션)

- `durationSec`: 라운드 시간(기본 30)
- `cooldownMs`: PASS 쿨다운(기본 800)
- `hostOnlyPass`: Host만 PASS 가능(기본 false)
- `allowSelfPass`: 자기 자신에게도 갈 수 있음(기본 false)
- `antiRepeatWindow`: 최근 N명 재선정 방지(기본 2)
- `lateJoinPolicy`: 진행 중 입장 정책(기본 spectator)

---

## 5. UI/UX 요구사항 + 문구(필수)

### 로비(시작 전)

- 참가자 리스트 + Ready 토글
- Start 버튼(Host만 활성)
- **시작 불가 조건 문구**
    - 참가자 수 < 2:
        - 토스트/배너: **“2인 이상 들어와야 시작할 수 있습니다.”**
        - Start 버튼 비활성 + 툴팁 동일 문구
    - Ready 기반으로 운영 시(선택):
        - **“모두 준비되면 시작할 수 있습니다.”**

### 게임 진행 화면

- 큰 폭탄 아이콘 + 현재 소유자 표시
- 타이머(숫자 + 바)
- “다음 사람” 버튼(권한 있는 사용자만 활성)
- PASS 쿨다운 시:
    - 버튼 비활성 + **“잠시 후 다시 시도하세요 (0.4s)”** 같은 카운트
- 진행 중 참가자 수 < 2가 되면(정책 A 기준):
    - 중앙 팝업: **“인원이 부족해 게임이 종료되었습니다.”**
    - 하단: “다시하기는 2인 이상일 때 가능합니다.”

### 종료 화면

- **“당첨: {nickname} 🎉”**
- 선택 벌칙 표시(있다면)
- Replay/Reset(Host만)

---

## 6. 동시성/일관성 요구사항 (필수)

동시 입력이 있어도 **상태가 절대 꼬이지 않도록** 설계한다.

### 필수 원칙

- 서버 권위(authoritative): 소유자/타이머/종료 결정은 서버만
- `roundId`로 라운드 식별, 불일치 요청 무시
- `clientActionId`로 PASS 요청 중복 제거(재전송 대비)
- 방(roomId) 단위로 PASS 요청을 **단일 큐로 직렬 처리**
- 종료와 PASS가 겹치면 **종료 우선** (now ≥ endsAtMs면 PASS 무시)

---

## 7. 상태 모델(권장)

### RoomState

- `roomId`, `hostId`
- `players: [{ userId, nickname, isReady, isSpectator }]`
- `game: GameState | null`

### GameState

- `status: "idle" | "running" | "ended"`
- `roundId`
- `startedAtMs`, `endsAtMs`
- `holderUserId`
- `lastPassAtMs`
- `lastHolders: userId[]`
- `history: [{ roundId, winnerUserId, endedAtMs, reason? }]`

---

## 8. 이벤트/메시지 스펙(예시)

### Client → Server

- `ROOM_JOIN { roomId, nickname?, clientId }`
- `PLAYER_READY_SET { roomId, userId, isReady }`
- `GAME_START { roomId, userId, config }` (Host only)
- `PASS_REQUEST { roomId, userId, roundId, clientActionId }`
- `GAME_RESET { roomId, userId }` (Host only)

### Server → Clients

- `ROOM_STATE` (스냅샷)
- `GAME_STATE_UPDATE`
- `PASS_APPLIED`
- `GAME_ENDED { winnerUserId, reason: "timeout" | "insufficient_players" }`
- `ERROR { code, message }`

---

## 9. 시작/요청 거부 에러 코드(권장)

- `ERR_MIN_PLAYERS`: **“2인 이상 들어와야 시작할 수 있습니다.”**
- `ERR_NOT_HOST`: “진행자만 시작할 수 있습니다.”
- `ERR_NOT_RUNNING`: “게임이 진행 중이 아닙니다.”
- `ERR_ROUND_MISMATCH`: “라운드가 변경되었습니다. 최신 화면으로 다시 시도하세요.”
- `ERR_COOLDOWN`: “잠시 후 다시 시도하세요.”
- `ERR_ALREADY_ENDED`: “이미 종료된 라운드입니다.”

---

## 10. 개발 완료 기준(DoD)

- 2인 미만이면 시작 불가 + 문구 노출
- 종료 직전 PASS 연타해도 결과 1회만 발생(중복 종료 없음)
- 동시에 PASS 요청 다발 발생해도 holder 정합성 유지
- 진행 중 인원 2명 미만 → `reason=insufficient_players`로 종료 처리 + 문구 노출