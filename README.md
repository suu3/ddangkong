# 심심풀이 땅콩

커피 내기, 룰렛, 폭탄 돌리기, 팀 나누기를 제공하는 Next.js PWA / Android TWA 앱.

- [웹](https://ddangkong.suulab.xyz)
- [Android](https://play.google.com/store/apps/details?id=xyz.ddangkong.twa)

## 개발

Node.js 24.14.0(`.nvmrc`), pnpm 9.15.9를 사용한다. Node 22는 22.12 이상을 지원한다.

```sh
pnpm install
pnpm dev
```

환경 변수 없이 혼자 하는 게임을 사용할 수 있다. 방 공유를 개발하려면 `.env.local`에 `NEXT_PUBLIC_REALTIME_API_URL=http://localhost:8787`을 설정하고 터미널 두 개에서 실행한다.

```sh
pnpm realtime:dev
pnpm dev
```

운영 웹은 Netlify, 실시간 서버는 Cloudflare Worker와 SQLite 기반 Durable Objects를 사용한다. 방마다 상태·참여자 정보를 WebSocket 하나로 받으며 생성 후 24시간이 지나면 삭제한다. 유휴 객체는 Hibernation API로 절전하며 프로젝트를 유지하기 위한 ping 작업은 없다.

## 구조

```text
app/                       Next.js 라우팅·Provider
src/views/<game>/model/    화면별 상태 선택·가공·행동 연결 훅
src/views/<game>/ui/       화면 구성
src/widgets/room-share/    방 만들기·참여·공유 패널
src/entities/room/         방 API·세션·공통 상태·구독 수명
src/shared/api/            HTTP·WebSocket·프로토콜
workers/realtime/          방의 권한·저장·revision·만료
domains/, components/     기존 게임 UI·공통 UI (점진적 정리 대상)
```

FSD 의존 방향은 views → widgets → entities → shared이며 필요한 레이어만 사용한다. Next.js가 `src/pages`를 라우팅 폴더로 인식하므로 페이지 레이어 이름은 `views`로 구분했다. TanStack Query와 Suspense 기반 데이터 로딩은 추가하지 않았다.

## 검증

```sh
pnpm test
pnpm test:worker
pnpm test:e2e
pnpm lint
pnpm build
pnpm exec tsc -p workers/realtime/tsconfig.json --noEmit
```

브라우저 테스트를 처음 실행할 때 `pnpm exec playwright install chromium`이 필요하다.

## 배포·Android

- [Cloudflare·Netlify 배포와 롤백](docs/cloudflare-realtime-deploy.md)
- [도메인 이전·Android 빌드](docs/domain-and-android.md)
- [V3 작업 기록](docs/v3-progress.md)

Android 설정은 `android/twa-manifest.json`, 생성된 프로젝트와 APK/AAB·서명키는 Git에서 제외한다. 기존 서명키로 빌드하려면 PowerShell 7에서 `pnpm twa:build`를 실행한다. 키 비밀번호는 로컬 입력으로만 받는다.
