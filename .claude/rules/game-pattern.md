# 게임 개발 패턴 — coffee가 기준 코드

새 게임을 만들거나 기존 게임을 수정할 때 **`app/coffee/page.tsx` + `domains/coffee/` + `lib/reducer/coffee.ts`를 기준 패턴으로 삼는다.** hot-potato/team-split은 로직이 page.tsx 안에 몰려 있는데, 일회성 게임이라 허용된 형태일 뿐 따라 할 기준은 아니다.

## coffee 패턴 요약

1. **스텝 흐름**: `useStep(0)`이 `[step, Container, handleStep]`을 반환. `<Container curStep={n}>`의 자식 중 n번째만 렌더. 스텝 컴포넌트는 `domains/<game>/`에 하나씩 분리.
2. **게임 상태**: `lib/reducer/<game>.ts`에 순수 리듀서 + 액션 타입, `lib/context/<game>.ts`에 Context와 초기값. 페이지에서 `useReducer`로 로컬 상태 관리, Context.Provider로 하위 전달.
3. **로컬/실시간 이중 모드**: `?roomId=` 쿼리 존재 여부로 분기.
   - 로컬: 그냥 `dispatch` / `handleStep`.
   - 실시간: 상태 전체를 `{ ...게임상태, step, revision, lastActor }` 형태로 방(room)에 저장.
4. **실시간 동기화 (pushRealtimeState)**:
   - 낙관적 업데이트: 로컬 state 먼저 갱신 + `sendState`로 broadcast.
   - `updateRoomState(roomId, state, expectedRevision)`로 DB 저장. revision 불일치 시 `Realtime conflict` 에러 → `getRoom`으로 최신 상태 받아 반영(필요하면 1회 재시도).
   - 수신은 `subscribeRoomState` 하나로 처리 (broadcast + postgres_changes 백업).
5. **Presence(선택)**: 실시간 하이라이트(누가 뭘 선택 중인지)는 `supabase.channel('presence:...')`로 별도 처리. 게임 결과에 영향을 주는 상태는 절대 presence에 싣지 않는다.
6. **방 공유 UI**: `<RoomSharePanel gameType=... hasConfig={hasSupabaseConfig()} onCreateRoom=... />` 재사용. 직접 만들지 않는다.
7. **결과 결정**: 랜덤 결과(`getLottery` 등)는 결과가 아직 없을 때 한 번만 계산해 state에 저장. 실시간 모드에서는 결과도 방 상태에 넣어 전원이 같은 결과를 본다.

## 검증 체크리스트 (게임 수정/추가 시 필수)

1. **실시간 2창 검증**: 방 만들기 후 두 클라이언트(창/iframe)를 열어 **양방향** 동기화를 확인한다.
   - 버튼 연타(같은 tick에 여러 액션)에도 상태가 유실/역행하지 않아야 한다. 반드시 `realtimeStateRef` 기반 mutator로 push할 것 — `realtimeState`를 클로저로 직접 읽으면 stale 상태로 계산되어 유실된다 (coffee에서 실제로 있었던 버그).
   - 랜덤 결과는 두 창이 **동일한 값**을 봐야 한다.
   - 로컬 Supabase가 없으면 `node scripts/supabase-mock.js` (54321 포트) + `.env`를 `http://localhost:54321`로 설정해 검증한다.
2. **모바일 UI**: 375px 뷰포트에서 각 스텝 화면과 방 공유 모달의 가로 오버플로/줄바꿈 깨짐이 없어야 한다.
3. **UI 스타일**: 기존 디자인 시스템을 따른다 — chocolate 계열 색 토큰(`text-chocolate07` 등), 둥근 모서리 카드(`rounded-[1.75rem]` 등), `MainButton`/`UniqueText`/`Tooltip` 같은 기존 컴포넌트 재사용. 새로운 색/폰트/버튼 스타일을 임의로 도입하지 않는다.

## 오버엔지니어링 금지

- 상태관리 라이브러리(zustand/redux 등), 서버 컴포넌트, API 추상화 레이어 도입 금지. 지금 스택(useReducer + Context + Supabase 직접 호출)으로 충분하다.
- 게임 하나를 위한 범용 프레임워크를 만들지 않는다. 공통화는 실제로 두 게임 이상에서 중복이 생겼을 때만.
- 테스트 인프라가 없다. 요청 없이 테스트 프레임워크를 추가하지 않는다.
- Supabase 미설정 환경을 항상 고려한다: 실시간 코드는 `hasSupabaseConfig()` / `roomId` 가드 뒤에만 둔다.
- 새 파일보다 기존 파일 수정을 우선한다. 컴포넌트 분리는 재사용되거나 파일이 과도하게 커질 때만.
