# 도메인과 Android V3

## 도메인

사용자 확인 주소는 `ddangkong.suulab.xyz`다. `ddankong`이 아니다.

2026-10-19 확인 결과 Vercel nameserver에서 Netlify로 CNAME이 연결되어 있고 웹, `/manifest.json`, `/.well-known/assetlinks.json`이 HTTPS 200을 반환했다. 만료된 도메인의 redirect를 새 배포의 전제조건으로 두지 않는다.

Next metadata와 TWA host·icon·manifest·scope는 새 주소를 사용한다. 공유 링크는 현재 웹 origin으로 만든다. `public/.well-known/assetlinks.json`의 기존 Play 앱 서명 지문들은 유지한다.

## 기존 서명키

전달받은 `Downloads/android.keystore`의 alias는 `android`이며 암호로 인증서를 내보내는 데 성공했다.

```text
A1:5A:0A:D4:B2:0C:66:99:FF:97:BA:10:C6:0E:4A:1E:D2:3A:43:4E:3D:18:31:0D:56:A5:47:50:7E:5B:36:A4
```

이 지문은 새 도메인의 assetlinks에 이미 있다. 새 키 생성·업로드 키 초기화는 필요하지 않다. 실제 Play Console의 앱 서명 인증서와 업로드 인증서는 별개일 수 있으므로 기존 앱의 등록 정보를 유지한다.

## 재현 가능한 빌드

1. JDK 17과 Android SDK를 준비하고 Bubblewrap의 `~/.bubblewrap/config.json`에 경로를 등록한다.
2. PowerShell 7에서 `pnpm twa:build`를 실행한다. 키 경로 지정은 `pwsh -NoProfile -File scripts/build-android.ps1 -KeystorePath <path>`로 한다.
3. 고정된 Bubblewrap 1.27.0으로 프로젝트를 재생성하고 설치된 Build Tools를 지정해 Gradle APK/AAB를 빌드한다.
4. 빌드 성공 후 기존 키 비밀번호를 로컬에서 입력한다. 새 키를 자동 생성하지 않으며 비밀번호를 저장하지 않는다.
5. `android/app-release-bundle.aab`와 `android/app-release-signed.apk`를 만들고 서명을 검사한다.

환경변수 참조로 keytool·jarsigner·apksigner에 비밀번호를 전달하며 인수에 비밀번호 자체를 넣지 않는다. 로그·Git에 키와 비밀번호를 추가하지 않는다.

버전 이름은 `3.0.0`, versionCode는 `10`, target SDK는 `36`이다. Android Browser Helper의 최소 요구 때문에 minSdk는 `24`(Android 7.0)다. Play Console에 이미 10 이상이 올라갔다면 더 큰 versionCode로 다시 빌드해야 한다.

## Play Console 배포

빌드 산출물 생성과 Google Play 공개 배포는 별개다. 기존 앱 `xyz.ddangkong.twa`에 AAB를 올리고 서명·versionCode·정책 검사를 통과해야 한다. 기기에서 주소창 없이 열리는지와 기존 설치의 업데이트 동작은 실제 기기로 확인한다.
