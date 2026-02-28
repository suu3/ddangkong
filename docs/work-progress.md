# 작업 진행상황

## 현재 상태
- Supabase 설정 로더의 반환 키를 `publishableKey`로 명확화하여 클라이언트에서 Secret key를 사용할 여지를 줄였습니다.
- 실시간 REST/WebSocket 코드에서 `anonKey` 참조를 모두 `publishableKey`로 정리했습니다.
- `docs/supabase-rls-guide.md` 문서를 추가해 `rooms` 테이블의 RLS 활성화 및 정책 SQL 예시를 정리했습니다.
- README에 RLS/Policy 가이드 문서 링크를 추가했습니다.

## Next Action Item
1. Supabase DB에 RLS/Policy SQL 실제 적용
2. 실기기 2대(Host/Viewer)에서 커피내기/룰렛 방 생성-조회-동기화 검증
3. rooms 만료 정책(`expires_at`) 설계 및 정리 배치 전략 확정

## 주의사항
- 현재 정책 예시는 퍼블릭 링크 공유 기준의 최소 구성입니다. 운영 환경에서는 만료/남용 방지 정책이 필요합니다.
- Secret key(`sb_secret_...`)는 서버 전용이며 `NEXT_PUBLIC_*` 환경변수에 넣으면 안 됩니다.
- `.env.local` 파일은 절대 커밋/업로드하면 안 됩니다.

## 사용자가 해야 할 일
- Supabase SQL Editor에서 `docs/supabase-rls-guide.md`의 정책을 적용
- `.env.local`에 아래 값 설정
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 2대 이상 기기에서 링크 공유 동작과 실시간 반영을 점검
