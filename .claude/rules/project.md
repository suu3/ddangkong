# 심심풀이 땅콩 V3

Next.js App Router + React 19 + PWA + Android TWA. 웹은 Netlify, 실시간 서버는 Cloudflare Worker + SQLite Durable Objects.

- 경로: /coffee, /roulette, /hot-potato, /team-split
- app/: 라우팅과 전역 Provider
- src/views/<game>/model/: 화면별 훅, src/views/<game>/ui/: 화면 구성
- src/widgets/room-share/: 방 공유 UI
- src/entities/room/: 방 데이터, 세션, 공통 상태와 구독
- src/shared/api/: HTTP/WebSocket 및 런타임 프로토콜 검증
- workers/realtime/: 권한, SQLite 저장, revision, WebSocket, 만료
- domains/, components/, lib/: 기존 게임 UI·공통 도구를 사용하는 범위부터 점진적으로 정리

의존 방향: views → widgets → entities → shared. 같은 레이어의 다른 슬라이스를 직접 참조하지 않는다. 불필요한 features/widgets 레이어는 만들지 않는다.

개발: pnpm dev. 로컬 실시간 서버: pnpm realtime:dev. .env.local에 NEXT_PUBLIC_REALTIME_API_URL=http://localhost:8787 설정. 미설정이어도 로컬 게임은 사용할 수 있어야 한다.

검증: pnpm test, pnpm test:worker, pnpm test:e2e, pnpm lint, pnpm build. Worker 타입 검사는 pnpm exec tsc -p workers/realtime/tsconfig.json --noEmit.

화면은 한국어, 기존 chocolate 색 토큰과 공통 UI를 사용한다. useSearchParams 화면은 Suspense 경계로 감싼다. 이 경계는 라우팅용이며 연결 로딩은 명시적 상태로 처리한다.

배포 및 Android는 docs/cloudflare-realtime-deploy.md와 docs/domain-and-android.md를 따른다. 비밀번호·서명키·토큰은 로그나 Git에 넣지 않는다.
