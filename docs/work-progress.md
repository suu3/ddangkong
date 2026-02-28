# 작업 진행상황

## 현재 상태
- 이전 PR(`feat: sync coffee/roulette realtime results`) 후속으로 React Hook 의존성 경고를 정리했습니다.
  - `pushRealtimeState`를 `useCallback`으로 감싸고 effect deps에 반영
  - 커피 결과 페이지 오디오 effect deps 누락 보완
- 룰렛 Loading의 엣지케이스를 수정했습니다.
  - 참여 항목 0개일 때 0으로 나누는 케이스 방지
  - 참여 항목 1개일 때 중앙 텍스트 처리 분리
- TOC/`prefetch={false}` 관련 컴포넌트는 현재 저장소에서 검색되지 않아 즉시 수정 대상 파일을 특정하지 못했습니다.

## Next Action Item
1. TOC UI가 있는 실제 파일 경로(또는 브랜치) 전달받아 하이라이트 책임 분리(클릭 이동 vs 스크롤 추적) 적용
2. `prefetch={false}` 코드 스타일/디자인 개선 대상 컴포넌트에 맞춰 버튼/링크 스타일 시스템 반영
3. 실환경(Supabase + 2대 기기)에서 커피/룰렛 실시간 결과 동기화 리그레션 테스트
4. 룰렛 결과 텍스트를 별도 UI로 노출하고 room 상태 스키마와 일치시키는 추가 개선

## 주의사항
- 현재 저장소에는 블로그/TOC 관련 코드가 확인되지 않아, 요청 주신 화면(첨부 이미지)과 코드 매핑이 필요합니다.
- 룰렛/커피 실시간 동기화는 Supabase 환경변수 미설정 시 로컬에서 완전 검증이 어렵습니다.
- room `game_state` 스키마 변경(`result`, `resultIndex`) 이후 구 room 데이터와 혼용 시 방어 로직이 필요할 수 있습니다.

## 사용자가 해야 할 일
- TOC 화면이 포함된 파일 경로 또는 해당 기능 브랜치 정보를 공유해주세요.
- `.env`에 Supabase 환경변수 설정
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Host/Viewer 각각 2대 이상 실기기로 링크 공유 동작을 확인해주세요.
