## 심심풀이 땅콩
여러가지 인터렉션이 들어간 복불복 게임 애플리케이션.
- [o] 커피내기 게임
- [-] 룰렛 기능 개발 중
<img width="833" alt="스크린샷 2024-12-15 오후 10 56 39" src="https://github.com/user-attachments/assets/9162288e-a7a7-434d-8a2f-f87a9887ffc8" />

## Deploy
- 웹: [버셀 배포](https://ddangkong.xyz) - 룰렛 포함
- 모바일: [playstore](https://play.google.com/store/apps/details?id=xyz.ddangkong.twa) - 커피 내기

[플레이스토어 배포 과정을 담은 글](https://suu3.github.io/%EA%B8%B0%ED%83%80/[2023-12-16]PWA%EB%A1%9C_%EA%B5%AC%EA%B8%80_%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4%ED%86%A0%EC%96%B4_%EC%B6%9C%EC%8B%9C%ED%95%98%EA%B8%B0/[2023-12-16]PWA%EB%A1%9C_%EA%B5%AC%EA%B8%80_%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4%ED%86%A0%EC%96%B4_%EC%B6%9C%EC%8B%9C%ED%95%98%EA%B8%B0/)


## Local 개발 환경 설정
1. 의존성 설치
   ```bash
   pnpm install
   ```
2. `.env.local` 파일 생성 후 아래 값 설정
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<프로젝트 URL>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase Publishable key>
   # (하위호환) 기존 키 이름을 쓰고 있다면 NEXT_PUBLIC_SUPABASE_ANON_KEY 도 사용 가능
   ```
3. 개발 서버 실행
   ```bash
   pnpm dev
   ```

### Supabase 키 사용 규칙
- RLS/Policy 설정 예시는 `docs/supabase-rls-guide.md`를 참고하세요.
- 프론트엔드(브라우저)에는 **Publishable key**를 사용합니다.
- **Secret key는 절대 프론트엔드/클라이언트 코드에 넣지 마세요.**
- `.env.local` 및 실제 키 값은 Git에 커밋하거나 업로드하면 안 됩니다.
