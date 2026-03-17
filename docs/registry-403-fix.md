# 사내 레지스트리 403 해결 가이드

## 증상
- `pnpm add ...` 실행 시 `ERR_PNPM_FETCH_403` 발생
- 메시지: `No authorization header was set for the request`

## 원인
- 사내 npm 레지스트리 또는 프록시 레지스트리에 인증 토큰이 없거나 만료됨
- `.npmrc`의 registry 스코프가 잘못 지정되어 퍼블릭 패키지도 사내 레지스트리로 강제 라우팅됨

## 해결 순서
1. 현재 registry 확인
   - `pnpm config get registry`
   - `npm config get registry`
2. 사내 레지스트리 인증 재설정
   - `pnpm login --registry <사내_registry_url>`
   - 또는 `.npmrc`에 토큰 등록
3. 공개 npm으로 복구가 필요한 경우
   - `pnpm config set registry https://registry.npmjs.org/`
4. 스코프 패키지만 사내 레지스트리를 사용하도록 분리
   - 예: `@company:registry=https://<사내_registry_url>`
5. 캐시/잠금 확인 후 재시도
   - `pnpm store prune`
   - `pnpm add @supabase/supabase-js qrcode.react`

## 주의사항
- 토큰은 저장소에 커밋하지 말고 사용자 홈의 `.npmrc` 또는 CI Secret으로 관리
- 사내 보안정책상 외부 npm 접근이 차단된 경우, 보안팀/플랫폼팀에 패키지 미러 요청 필요

## 사용자가 해야 할 일
- 사내 레지스트리 URL과 토큰 발급 경로 확인
- 개인/CI 환경에 인증 설정 반영
- 정책상 외부 패키지 반입 승인 절차 진행
