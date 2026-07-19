# 심심풀이 땅콩 (ddangkong)

여러 인터랙션이 들어간 복불복 미니게임 웹앱. Next.js(App Router) + PWA + Android TWA.
게임: `/coffee`(커피내기), `/roulette`(룰렛), `/hot-potato`(폭탄 돌리기), `/team-split`(팀 나누기).

## 명령어

- `pnpm dev` — 개발 서버 (http://localhost:3000)
- `pnpm build` / `pnpm lint`
- `pnpm twa:update`, `pnpm twa:build` — Android TWA (`/android` 디렉터리 기준)

## 디렉터리 구조

```
app/<game>/page.tsx    # 게임 페이지. 상태 오케스트레이션 + 실시간 동기화 담당
domains/<game>/        # 게임 전용 스텝 컴포넌트 (Start, Order, Loading 등)
components/            # 공용 UI (button/, input/, @layout/, realtime/RoomSharePanel)
lib/reducer/<game>.ts  # 게임 상태 리듀서 (순수 함수)
lib/context/<game>.ts  # 게임 Context + 초기 상태
lib/hooks/             # useStep(스텝 전환), usePlayAudio, useTimeout 등
lib/realtime/          # rooms.ts(CRUD), channel.ts(구독/broadcast), clientActor.ts
lib/supabase/          # client.ts, env.ts (hasSupabaseConfig)
```

## 환경 변수 (선택)

`.env`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
**없어도 로컬(비실시간) 모드로 모든 게임이 동작해야 한다.** 실시간 방 공유만 비활성화됨.

## 컨벤션

- 모든 페이지/컴포넌트는 `'use client'` 클라이언트 컴포넌트. 서버 컴포넌트 도입하지 않는다.
- 스타일: Tailwind 유틸리티 + 컴포넌트별 CSS Module(`kebab-case.module.css`) 혼용.
- import는 `@/` 경로 별칭 사용.
- UI 텍스트는 한국어.
- `useSearchParams`를 쓰는 페이지는 반드시 `<Suspense>`로 감싼다 (Next 빌드 요구사항).
