# 실시간 서버 배포

## 운영 구성

- 웹: `https://ddangkong.suulab.xyz` (Netlify 사이트 `ddangkong`)
- DNS: Vercel nameserver, 웹 CNAME `ddangkong.netlify.app`
- 실시간 서버: `https://ddangkong-realtime.mandalart.workers.dev`
- Room Durable Object와 CreationLimiter는 `new_sqlite_classes`로 생성한다. 별도 D1·Neon은 사용하지 않는다.

## 배포 순서

1. `pnpm exec wrangler login`으로 배포 계정을 연결한다.
2. `pnpm test:worker`와 Worker 타입 검사를 통과시킨다.
3. `pnpm realtime:deploy`를 실행한다. 로컬 개발용 `--env local`은 운영 배포에 사용하지 않는다.
4. `netlify.toml`의 `build.environment.NEXT_PUBLIC_REALTIME_API_URL`을 위 Worker 주소로 설정하고 웹을 다시 빌드·배포한다. 공개 서버 주소이며 빌드 시 브라우저 코드에 들어간다. 사이트 환경변수 API가 403을 반환해 저장소의 빌드 설정으로 관리한다.
5. 새 도메인에서 두 브라우저로 방 생성·참여·결과 일치·새로고침·재연결을 확인한다.

설정만 검사하려면 `pnpm exec wrangler deploy --config workers/realtime/wrangler.jsonc --dry-run`을 사용한다. CORS `ALLOWED_ORIGINS`는 운영 웹만 허용한다. 로컬 `--env local`은 localhost 두 출처만 허용한다. 프리뷰 도메인에서 방 공유를 검증하려면 해당 출처도 명시적으로 추가한다.

## 저장·권한·수명

- 방 생성 시 고정한 `expiresAt`은 접속·조작으로 연장하지 않는다.
- SQLite 기반 DO의 storage API로 방 스냅샷, 해시된 세션 토큰, 제한된 최근 요청 ID를 저장한다.
- 호스트 토큰이 있는 연결만 전체 상태를 수정한다. 참가자 ID는 서버가 발급하고 본인 카드 선택·별명·준비·폭탄 전달만 명령으로 허용한다.
- 토큰은 브라우저 저장소에 방별로 보관하고 WebSocket의 첫 인증 프레임으로 전송한다. 링크·쿼리에는 넣지 않는다.
- 재접속 때 HTTP로 만료를 확인하고 스냅샷을 받은 뒤 조작을 활성화한다.
- 같은 브라우저·방의 구독자들이 소켓 하나를 공유한다. 마지막 구독 해제 시 소켓·재접속 타이머를 정리한다.
- Hibernation API, attachment와 alarm을 사용한다. 서버 주기 타이머나 유지를 위한 ping은 없다.
- 인증하지 않은 연결은 10초 뒤 닫고, 정원은 인증 시에도 검사한다.
- 폭탄 라운드도 서버 alarm으로 종료해 호스트가 없어도 결과를 남긴다.
- 방 생성 제한은 IP 해시당 10분에 5개다. 개발 브라우저 테스트는 실행별 임시 저장소를 사용한다.

기존 서버의 단기 방은 새 서버에 없으므로 만료 안내를 표시한다. 장기 데이터 이전은 하지 않는다.

## 장애와 롤백

오류·재연결 상태를 화면에 표시한다. 방 기능 설정이 없으면 혼자 하는 게임을 사용할 수 있다.

웹은 Netlify의 이전 배포로 복원할 수 있다. Worker 버전은 Wrangler deployment/version 기록에서 확인하고 검증한 버전으로 롤백한다. SQLite DO 클래스를 삭제하는 migration은 만들지 않는다. 이전 프론트가 이전 서버를 요구하면 환경 설정도 같이 복구한다.

Cloudflare 대시보드에서 요청·오류·저장소 사용량을 확인한다. 무료 한도는 무제한이 아니므로 실제 사용량과 당시 공식 요금표를 기준으로 판단한다. 유휴 객체 절전과 방 데이터 만료는 다른 개념이다.
