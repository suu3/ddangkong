# 커피내기/룰렛 링크공유 동기화 구현 현황

## 현재 적용된 내용
- 공통
  - `roomId` 기반 방 생성/입장
  - Host/Viewer 역할 분리 (Viewer 입력 차단)
  - `rooms.game_state` 업데이트 + Realtime 구독
- 커피내기
  - 단계/입력값 동기화
  - **결과(boom)까지 Host 1회 생성 후 room 상태로 동기화**
- 룰렛
  - 단계/입력값 동기화
  - **회전 계획(spin plan) 동기화**로 참여자 애니메이션 편차 축소

## 아직 필요한 작업
1. 룰렛 최종 당첨 항목을 room 상태로 확정 저장
2. Supabase SDK 전환 (`@supabase/supabase-js`) 및 코드 단순화
3. QR 코드 공유 UI(`qrcode.react`) 추가
4. 방 만료/정리 정책 및 RLS 고도화

## 운영 체크리스트
- `rooms` 테이블 스키마 확인
- Realtime UPDATE 이벤트 활성화 확인
- 환경변수 설정 확인
- 2대 이상 실기기 동시 테스트
