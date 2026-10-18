# V3 작업 기록

## 확인한 상태 (2026-10-19)

- 작업 브랜치: `codex/cloudflare-migration-plan`, 시작 커밋 `0117762`.
- 미커밋 변경 및 별도 워크트리 없음. 로컬에 설계·계획 2커밋이 main보다 앞섬.
- 기존 설계 문서는 승인됨으로 기록되어 있고, 사용자가 해당 작업과 V3 FSD 적용을 진행하도록 요청함.
- 사용자 확인 주소: `ddangkong.suulab.xyz`.
- DNS: Vercel nameserver, 웹 CNAME은 `ddangkong.netlify.app`.
- Android 설정은 새 주소지만 프로젝트/SDK/서명키가 현재 폴더에 없음.
- 기준 검사: TypeScript 통과, lint 오류 0개/기존 경고 69개.

## 구현 기준

기존 `docs/superpowers/plans/2026-08-09-cloudflare-realtime-migration.md`를 사용하며 사용자 V3 요구를 우선 적용한다.

- Ruling: 기존 깨끗한 기능 브랜치에서 계속 작업한다. 추가 워크트리는 생성하지 않는다. 사용자가 찾으려던 기존 변경과 구현을 한 곳에서 확인할 수 있다.
- Ruling: 브라우저 통신 기반은 `src/shared/api`, 방 상태·구독·명령은 `src/entities/room`, 페이지 구성과 화면별 model은 `src/views`에 둔다. Next의 예약 `pages` 폴더 충돌을 피한다. 기존 공통 UI와 게임 도메인은 사용하는 범위부터 이동한다.
- Ruling: 기존 승인 계획에 있는 별도 채팅 기능보다 현재 사용자 V3 요구(서버 이전, FSD, 연결 수명, 도메인/빌드)를 우선한다. 불필요한 범위 확장을 피한다.
- Ruling: 계획에 고정된 8월 패키지 대신 호환되는 현재 Wrangler와 Cloudflare 테스트 도구를 확인해 고정한다.
- Ruling: SQLite 기반 DO의 storage API로 스냅샷·해시된 세션·최근 요청 ID를 보관한다. 현재 요구에는 별도 SQL 조회 테이블이 필요 없다.
- Ruling: 기존 useDeck에 맞춰 커피 카드 번호는 1..total을 사용한다. 0..total-1로 가정하면 마지막 카드 선택이 거절되는 문제를 재현·수정했다.
- Ruling: 최신 Android Browser Helper의 최소 버전 요구에 따라 Android 7.0(API 24) 이상을 지원한다. versionCode 10, 이름 3.0.0, target SDK 36을 사용한다.
- Ruling: 새 Wrangler의 Node 요구에 맞춰 `.nvmrc`와 Netlify를 검증한 Node 24.14.0으로 맞춘다.
- Ruling: Netlify 환경변수 API가 403을 반환하므로 공개 API 주소는 `netlify.toml`의 빌드 환경으로 관리한다. 비밀값은 여기에 두지 않는다.
- 방은 24시간 뒤 만료한다. 유휴 WebSocket은 Hibernation API를 사용한다.
- 참가자 권한은 actor 문자열이 아닌 방별 비밀 토큰으로 검증한다. 토큰은 URL에 노출하지 않는다.
- 같은 방의 게임·공유 패널·Presence는 공통 상태와 WebSocket 하나를 사용한다.
- 도메인/Android 준비 변경은 서버/구조 변경과 별도 커밋한다.

## 진행

- [x] 기존 작업 및 배포/Android 설정 조사
- [x] Worker 프로토콜·저장·권한·만료·WebSocket 검증
- [x] 클라이언트 연결 및 공통 도메인 상태
- [x] 화면별 훅/구성 분리와 4개 게임 전환
- [x] Supabase 의존 제거
- [x] 도메인·Android 배포 준비 및 실제 접근 가능한 배포 수행
- [x] 전체 자동검사와 브라우저 확인

## 검증과 리뷰

- 클라이언트/프로토콜/스토어/PWA 10개, Worker 15개 통과.
- 두 브라우저 E2E 5개: 룰렛 공유·재연결·새로고침, 팀 결과, 잘못된 링크, 커피 선택 복원·최종 결과, 폭탄 준비·전달·새로고침 통과.
- TypeScript(웹/Worker) 통과, lint 오류 0개(기존 UI 경고는 잔존).
- 독립 리뷰의 중요 지적 4개 모두 재현 후 수정: 교체된 소켓 이벤트 오염, 저장된 세션의 만료 복구, 오프라인 폭탄 전달 대상, 미인증 소켓 점유.
- 미인증 연결 10초 제한과 인증 시 정원 검사, 방 만료 HTTP 재확인, 단일 연결 가드와 소켓 identity 검사를 적용했다.
- 폭탄 라운드는 서버 alarm으로 종료하고, 짧은 새로고침으로 인원이 줄면 진행자 화면에서 10초간 재접속을 기다린다.
- 기존 Android 키 검증·APK/AAB 생성·서명 검증 성공. 인증서 지문이 기존 assetlinks 항목과 일치한다.
- 운영 도메인에서도 E2E 5개를 실행해 전부 통과했다. 첫 운영 검사에서 첫 PWA 설치가 방 생성 요청을 끊는 문제를 재현했고, 최초 controller 획득 시 새로고침하지 않도록 수정 후 재검증했다.

## 배포 결과

- 웹: https://ddangkong.suulab.xyz
- Netlify 게시 배포: `6ad54a60cc8161e146ca1a82`, 소스 `32a52066378ec317b98a70f6cb88195ce8ab530b`.
- Worker: https://ddangkong-realtime.mandalart.workers.dev, 버전 `6b3be9f9-f958-4daa-be00-6b7b9859b1e3`.
- Windows 로컬 배포 패키징은 심볼릭 링크 권한 오류가 있어 작업 브랜치를 푸시하고 Netlify Linux 빌드에서 게시했다. main 병합은 하지 않았다.
- 검토용 draft PR: https://github.com/suu3/ddangkong/pull/31
- 앱: `android/app-release-bundle.aab`, `android/app-release-signed.apk`, 패키지 `xyz.ddangkong.twa`, versionCode 10, 이름 3.0.0, min SDK 24, target SDK 36.
- AAB SHA-256: `97C468080437CAF4228D7E809EE412929F64E7EA60C1BDB633C350DF74C7D244`.
- APK SHA-256: `B7F61078EB00EB1D35C2C1BE56B07BBF049CEB30469B1AA3C07F0E82A66E695B`.
- Google Play 업로드·심사는 수행하지 않았다. 서명된 AAB를 기존 앱의 새 버전으로 제출할 수 있는 상태다.
