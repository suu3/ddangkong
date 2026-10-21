# 낙서 이어달리기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user chooses delegation. Implement task-by-task and track the checkboxes.

**Goal:** main에 기존 땅콩 모바일 스타일을 최우선으로 따르는 4~10명 그림·문장 전달 파티게임을 추가한다.

**Architecture:** 기존 Next.js 화면과 방 연결, Cloudflare Worker/SQLite Durable Objects를 확장한다. 새 게임의 비공개 원본 상태와 참가자별 공개 상태를 분리하고 서버에서 단계와 제출을 확정한다.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind/CSS Modules, Canvas 2D, 기존 WebSocket/Worker, Vitest, Playwright.

**Spec:** [2026-10-21-drawing-relay-design.md](../specs/2026-10-21-drawing-relay-design.md)

## Global Constraints

- 사용자의 최우선 기준은 기존 게임 스타일과의 일치다. 기존 chocolate 토큰, UniqueText, MainButton, GameMenu, 공유 패널을 재사용한다. 별도 디자인 시스템과 글꼴을 추가하지 않는다.
- 사용자 요청대로 main에서 작업한다. 작업 시작 시 기존 변경과 저장소 지침을 확인하고 보존한다.
- 가칭 ‘낙서 이어달리기’, 경로 /drawing-relay, 게임 식별자 drawing_relay. UI는 한국어이며 독자 제작 에셋만 쓴다.
- 4~10명, 문장 100자/30초, 그림 60초, N개 체인/N단계, 점수 없음. 초대는 기존 링크 방식이다.
- 그림은 정규화 좌표의 선 데이터, 최대 120선/2,000점/48KiB, 기존 메시지 64KiB 이내. 6색·펜·지우개·되돌리기.
- 공개 전에는 방장을 포함해 담당 직전 제출물과 본인 초안만 받는다. 공개 중에도 공개 위치 이후 내용은 보내지 않는다.
- views → widgets → entities → shared 방향, 기존 게임 응답 유지, 임의 전체 상태 갱신 금지, 세션 인증, 저장 후 전송.
- 375px 화면, 최소 44px 도구 버튼, 캔버스만 touch-action: none. 24시간 만료 정책 유지.

## Review Focus

- 모바일 회전·크기 변경 후에도 그림 좌표와 선 굵기가 유지된다: Task 4에서 크기 변경 전후 좌표/렌더링 검사.
- 여러 탭의 같은 세션이 중복 제출해도 한 번만 기록된다: Task 2에서 동일 actor 중복 제출 검사.
- 마지막 제출과 alarm 경합이 다음 단계를 두 번 만들지 않는다: Task 2에서 동일 시각 전환 검사.
- 닉네임·문장에 HTML이 있어도 텍스트로 표시한다: Task 5에서 문자 그대로 표시 및 script 비실행 검사.
- 저장이 제한된 모바일 환경에서도 게임을 계속하고 결과 이미지를 볼 수 있다: Task 4/5에서 localStorage 예외·다운로드 대체 표시 검사.

## 실행 준비

- [ ] Git 연결을 복구한 뒤 /workspace/ddangkong의 main을 확보한다. 현재 git ls-remote는 proxy:8080 연결 실패다. 네트워크 우회나 비밀값 출력 없이 정상 환경 연결을 재확인한다.
- [ ] AGENTS.md, 프로젝트/게임 지침, git status와 최근 커밋을 확인한다. 현재 원격 코드는 GitHub 연결 도구로 확인했으나 전체 체크아웃과 실행 검증은 아직 안 됐다.
- [ ] 승인된 설계/계획 파일을 저장소 docs/superpowers에 옮긴다. 기존 Worker 전체 코드, authorization, store, realtime-client, 공통 UI/CSS와 e2e 설정을 읽고 아래 접점을 실제 코드에 맞춰 확인한다.

## 파일별 책임

- 신규 src/shared/lib/drawing-relay.ts: 직렬화 가능한 타입, 배정, 그림 검증, Canvas 비의존 규칙.
- 신규 workers/realtime/src/drawing-relay.ts: 비공개 상태 전이와 참가자별 projection.
- 수정 workers/realtime/src/index.ts, authorization.ts: 인증된 명령·저장·alarm·세션별 응답 연결.
- 수정 src/shared/api/realtime-protocol.ts, realtime-client.ts: 게임 타입과 명령/응답 검증.
- 수정 src/entities/room/api/rooms.ts, model/store.ts, index.ts: 방 생성/세션과 새 게임 명령 전송, 기존 연결 하나 재사용.
- 신규 src/views/drawing-relay/model/useDrawingRelayView.ts: 화면 상태, 명령, 초안 동기화.
- 신규 src/views/drawing-relay/ui/{DrawingRelayPage,DrawingCanvas,RelayResults}.tsx 및 drawing-relay.module.css: 기존 UI 조립, 그림판, 결과 저장.
- 신규 src/views/drawing-relay/index.ts, app/drawing-relay/page.tsx: 뷰 공개와 라우팅.
- 신규 public/logos/games/drawing-relay.svg, 수정 app/page.tsx: 독자 아이콘과 기존 파티게임 카드.

### Task 1: 전달 규칙과 데이터 계약

**Files:** src/shared/lib/drawing-relay.ts, src/shared/lib/drawing-relay.test.ts, src/shared/api/realtime-protocol.ts.

**Interfaces:** RelayPhase = 'lobby' | 'playing' | 'reveal' | 'complete'; Drawing = { strokes: Stroke[] }; Stroke = { tool: 'pen' | 'eraser'; color: 허용 6색; width: number; points: [number, number][] }. RelayEntry는 text/drawing 판별 공용체이며 authorId, autoSubmitted를 가진다. RelayPrivateState는 gameId, revision, lastActor, hostId, players, order, phase, round, deadlineMs, chains, drafts, submitted, revealCursor를 소유한다. RelayPublicState는 비공개 필드 없이 public players/order/진행값, ownDraft, ownSubmitted, previousEntry, revealedChains를 가진다.

- [ ] 배정 테스트 작성: N=4,5,10에서 chain c/round r의 actor가 order[(c+r)%N]이고 각 체인에 N명이 중복 없이 기여한다. 단계 0/2는 text 30초, 1/3은 drawing 60초를 검사한다.
- [ ] `pnpm exec vitest run src/shared/lib/drawing-relay.test.ts`로 미구현 실패를 확인한다.
- [ ] `assignedActor(order: string[], chain: number, round: number): string`, `entryKind(round: number): 'text' | 'drawing'`, `roundDurationMs(round: number): number`, `validateDrawing(input: unknown): Drawing`과 타입을 구현한다. 폭/색/좌표/점 수/직렬화 크기를 서버에서도 검사한다.
- [ ] 100자 초과, 비유한 좌표, 외부 URL, 잘못된 색, 121선, 2,001점, 48KiB 초과 거절 테스트를 추가하고 동일 명령 PASS를 확인한다.
- [ ] 해당 파일을 선택해 커밋한다: `feat: define drawing relay rules and payload validation`.

### Task 2: 비공개 게임 상태와 서버 전이

**Files:** workers/realtime/src/drawing-relay.ts, workers/realtime/test/drawing-relay.test.ts.

**Interfaces:** `createRelay(hostId: string, now: number): RelayPrivateState`; `applyRelayCommand(state: RelayPrivateState, actorId: string, command: RelayCommand, now: number): RelayPrivateState`; `advanceRelayDeadline(state: RelayPrivateState, now: number): RelayPrivateState`; `projectRelay(state: RelayPrivateState, actorId: string | null, now: number): RelayPublicState`. RelayCommand는 join/rename/ready/start/draft/submit/reveal-next/reset 판별 공용체다. draft/submit은 gameId와 round, commandId를 포함한다. 클라이언트가 chain/author를 결정하지 않는다.

- [ ] 방장도 미공개 체인을 못 받는 projection, 비회원 projection, 본인 직전 제출물만 반환, 공개 커서 이후 비노출 테스트를 작성한다.
- [ ] `pnpm test:worker -- workers/realtime/test/drawing-relay.test.ts`를 실행해 실패를 확인한다.
- [ ] 고정 순서/N단계, 준비된 4~10명만 방장 시작, 본인 제출, 중복 무해 처리, 오래된 단계 거절, 마지막 제출 후 자동 전환을 구현한다. 서버 만료 판정에는 now를 주입한다.
- [ ] 미제출자의 마지막 초안/빈 내용을 timeout으로 확정하고, 퇴장한 자리 유지, 진행 중 신규 참가 금지, 공개 위치 진행, reset 시 새 gameId와 초안/준비 초기화를 구현한다.
- [ ] 4/5/10명 완주, 두 탭 중복 제출, alarm/마지막 제출 경합, 만료 직후 재접속, 비방장 시작·공개·reset 거절을 테스트하고 PASS 확인 후 커밋한다.

### Task 3: 기존 HTTP/WebSocket·공통 방 연결 확장

**Files:** workers/realtime/src/index.ts, authorization.ts, src/shared/api/realtime-protocol.ts, realtime-client.ts, src/entities/room/api/rooms.ts, model/store.ts, index.ts. Tests: workers/realtime/test/drawing-relay-transport.test.ts, src/shared/api/realtime-protocol.test.ts.

**Interfaces:** `drawing_relay` GameType 추가. `ParticipantCommand`에 RelayCommand를 담는 `drawing_relay.command`를 추가하며 새 게임의 state_update는 거절한다. public room의 state는 RelayPublicState이고 서버 저장 원본은 RelayPrivateState다. 공통 store에 `sendRelayCommand(command: RelayCommand): Promise<void>`를 연결한다. 동일 방은 기존 store 연결 하나만 사용한다.

- [ ] HTTP create/get/join, 인증 WS snapshot/update/error/reconnect 모든 경로에서 미공개 텍스트 고유 문자열이 없음을 검사하는 실패 테스트를 작성한다.
- [ ] 위 Worker 테스트와 `pnpm exec vitest run src/shared/api/realtime-protocol.test.ts` 실패를 확인한다.
- [ ] 새 게임 생성 시 서버가 초기 상태/방장 정원을 확정한다. 모든 응답 경로에서 Task 2 projection을 사용한다. raw private room을 broadcast하지 않는다. 초안은 본인 응답만 갱신하고 공개 제출 상태가 바뀔 때에만 타인에게 갱신한다.
- [ ] 직렬 큐 안에서 인증·전이·저장·세션별 전송을 수행한다. submit/draft는 gameId/round를 검사하고 전역 revision 충돌 때문에 다른 사람의 유효 제출을 버리지 않는다. alarm을 새 게임 마감/기존 게임 마감/인증 만료/방 만료 중 가장 이르게 예약한다.
- [ ] 재연결 본인 초안 복원, 위조 actor 거절, 잘못된 payload, HTTP 비인증 노출 방지와 기존 네 게임 회귀 테스트를 통과시키고 커밋한다.

### Task 4: 기존 스타일의 모바일 화면과 그림판

**Files:** 신규 app/drawing-relay/page.tsx, src/views/drawing-relay/index.ts, model/useDrawingRelayView.ts, ui/DrawingRelayPage.tsx, ui/DrawingCanvas.tsx, ui/drawing-relay.module.css. Test: e2e/drawing-relay-mobile.spec.ts (기존 설정의 testDir에 맞춘다).

**Interfaces:** `DrawingCanvas({ value, onChange, disabled }: { value: Drawing; onChange: (drawing: Drawing) => void; disabled: boolean })`. `useDrawingRelayView()`는 기존 useRoom에서 public state/connection status를 읽고 nickname, localDraft, remainingMs, create/join/ready/start/submit/retry 핸들러를 반환한다. 페이지에는 Suspense 경계를 둔다.

- [ ] 375px에서 캔버스 터치 선 입력, 지우개·되돌리기, 크기 변경 후 좌표 유지, 캔버스 외부 스크롤 테스트를 작성하고 `pnpm exec playwright test drawing-relay-mobile` 실패를 확인한다.
- [ ] 기존 폭탄 돌리기의 소개 제목/버튼/대기실 카드와 공통 구성요소를 재사용한다. 색이나 폰트를 독자 지정하지 않고 기존 토큰/크기를 사용한다. 기존 화면을 비교 기준으로 스크린샷을 남긴다.
- [ ] Pointer Events·포인터 캡처·DPR 대응 캔버스와 정규화 좌표를 구현한다. 한 점 선과 지우개를 재생하고 120선/2,000점/48KiB 제한 도달을 안내한다.
- [ ] 본인 초안을 로컬에 즉시 저장하고 변경을 최대 1초 간격으로 서버 저장한다. 저장소 예외에는 메모리로 계속 진행한다. 단계 변경/해제 시 이전 비동기 저장을 취소하고 제출 시 최신 내용을 전송한다. 연결 끊김/재시도/만료를 표시한다.
- [ ] 실패 테스트 PASS, 기본 키보드 조작, 44px 도구 영역, 375px 가로 넘침 없음과 기존 화면 스타일 비교를 확인하고 커밋한다.

### Task 5: 결과 공개·이미지 저장·홈 등록

**Files:** src/views/drawing-relay/ui/RelayResults.tsx, DrawingRelayPage.tsx, public/logos/games/drawing-relay.svg, app/page.tsx. Test: e2e/drawing-relay-game.spec.ts.

**Interfaces:** `RelayResults({ state, isHost, onRevealNext, onReset }: { state: RelayPublicState; isHost: boolean; onRevealNext: () => void; onReset: () => void })`. PNG 저장은 revealedChains만 로컬 Canvas에 합성한다. 외부 이미지/HTML 캡처를 사용하지 않는다.

- [ ] 독립 4개 browser context로 방 생성/참가/준비/완주/한 장 공개/모두 공개/다시하기 검증을 작성한다. HTML 닉네임·문장이 문자 그대로 표시되고 script가 실행되지 않는지 검사한다.
- [ ] `pnpm exec playwright test drawing-relay-game` 실패를 확인한다.
- [ ] 기존 ResultMoment와 카드 스타일로 공개 화면을 구현하고 방장 공개 위치를 전원 동기화한다. 공개 완료 체인을 PNG로 저장하며 다운로드 제한 시 이미지 보기 대체를 제공한다. 빈/자동 제출은 한국어로 표시한다.
- [ ] 독자 SVG 아이콘을 만들고 기존 app/page.tsx의 party 게임에 GameMenu 카드/NEW·4~10명·실시간 공유 배지를 추가한다. 기존 게임 카드와 여백/높이/글꼴을 비교한다.
- [ ] 완주 테스트와 저장 대체 동작을 통과시키고 커밋한다.

### Task 6: 통합 검증과 인계

**Files:** 위 변경 전체, docs/cloudflare-realtime-deploy.md의 필요한 새 게임 배포 안내.

- [ ] `pnpm test`, `pnpm test:worker`, `pnpm test:e2e`, `pnpm lint`, `pnpm build`, `pnpm exec tsc -p workers/realtime/tsconfig.json --noEmit`를 실행해 모든 종료 코드와 실패 내용을 확인한다.
- [ ] 데스크톱/375px에서 기존 게임과 신규 게임의 색·제목·버튼·카드·메뉴를 나란히 확인한다. 네트워크 차단/복원, 새로고침, 동시 제출, 방장 부재 중 자동 진행, 결과 PNG를 확인한다.
- [ ] `git diff --check`와 변경 diff를 검토한다. 승인 범위 밖 변경/외부 에셋/비밀값을 포함하지 않는지 확인하고 필요한 문서를 커밋한다.
- [ ] 요청된 실행 방식에 따른 리뷰를 완료하고 실제 검증 결과와 미검증 항목을 보고한다. Worker·웹 배포는 자격증명과 요청 범위를 확인해 진행하며 실제 배포 전에는 배포 완료라고 표시하지 않는다.

## 계획 자체 검토

설계의 단계 배정/타이머/비공개성/복구/모바일/스타일/결과 저장을 Tasks 1~5에 매핑했다. 다섯 Review Focus는 해당 과제에 검증을 포함했다. 기존 게임 동작 유지와 배포 순서는 Task 6에서 확인한다. 새 명령/서버 상태/참가자 상태 명칭은 전 과제에서 동일하다. GitHub 복제의 환경 연결 장애가 실행 준비의 현재 제약이다. 이 문서는 구현 완료 보고가 아니다.
