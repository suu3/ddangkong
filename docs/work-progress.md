# 작업 진행상황

## 현재 상태
- 사용자 요청에 따라 다음 단계 구현을 진행했습니다.
  - 커피내기 로딩 단계에서 Host가 결과를 room 상태에 1회 기록하고, 참여자는 해당 결과를 구독해 동일 결과로 이동하도록 동기화했습니다.
  - 룰렛 로딩 단계에서 Host가 생성한 회전 계획(spin plan: speed/deceleration/time)을 room 상태에 기록하고 참여자가 같은 계획으로 애니메이션을 재생하도록 동기화했습니다.
- 실시간 UI 문구에서 "실시간" 텍스트는 제거된 상태를 유지했습니다.
- `@supabase/supabase-js`, `qrcode.react` 설치는 이 실행 환경에서 여전히 403으로 실패했습니다(레지스트리 인증 이슈 지속).

## Next Action Item
1. 사내 레지스트리 인증 완료 후 `@supabase/supabase-js`, `qrcode.react` 설치 재시도
2. 설치 성공 시 현재 REST/WebSocket 수동 구현을 Supabase SDK 기반으로 교체
3. 룰렛 최종 당첨 텍스트를 room 상태에 저장/표시하도록 확장
4. 모바일 실기기 2대 이상에서 재접속/백그라운드 복귀/지연 시나리오 검증

## 주의사항
- 현재 구현은 Supabase REST + Realtime WebSocket 직접 연결 방식입니다.
- 커피내기는 room 기반 결과 동기화를 추가했지만, `rooms` 스키마와 권한(RLS) 설정이 맞지 않으면 동작하지 않습니다.
- 룰렛은 회전 계획 동기화까지만 반영되어 있으며, 최종 당첨값 표시는 추가 구현이 필요합니다.

## 사용자가 해야 할 일
- 사내 npm 레지스트리 인증 문제 해결 (`pnpm login` 또는 `.npmrc` 토큰)
- Supabase 환경변수 확인
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase에서 `rooms` 테이블 Realtime UPDATE 활성화 및 RLS 정책 점검
