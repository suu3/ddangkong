## 심심풀이 땅콩
여러가지 인터렉션이 들어간 복불복 게임 애플리케이션.
- [o] 커피내기 게임
- [o] 룰렛 기능 (실시간 공유 지원)
<img width="833" alt="스크린샷 2024-12-15 오후 10 56 39" src="https://github.com/user-attachments/assets/9162288e-a7a7-434d-8a2f-f87a9887ffc8" />

## Deploy
- 웹: [버셀 배포](https://ddangkong.xyz) - 룰렛 포함
- 모바일: [playstore](https://play.google.com/store/apps/details?id=xyz.ddangkong.twa) - 커피 내기

[플레이스토어 배포 과정을 담은 글](https://suu3.github.io/%EA%B8%B0%ED%83%80/[2023-12-16]PWA%EB%A1%9C_%EA%B5%AC%EA%B8%80_%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4%ED%86%A0%EC%96%B4_%EC%B6%9C%EC%8B%9C%ED%95%98%EA%B8%B0/[2023-12-16]PWA%EB%A1%9C_%EA%B5%AC%EA%B8%80_%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4%ED%86%A0%EC%96%B4_%EC%B6%9C%EC%8B%9C%ED%95%98%EA%B8%B0/)


## Run (Local)
- `pnpm install`
- `pnpm dev`
- 브라우저에서 `http://localhost:3000` 접속

### 실시간 공유 테스트(선택)
- `.env`에 Supabase 설정
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `/roulette` 또는 `/coffee`에서 `방 만들기` 후 링크를 공유하면 Host/Viewer 동기화 가능
