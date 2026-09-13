# 다른 Mac에서 이어서 작업하기 — 2026-09-09

## 먼저 확인

이 인계본은 최신 작업 폴더의 스냅샷이다. GitHub의 커밋만으로 복원하면 안 된다.
기준 브랜치는 `codex/season-report-live-refresh`, HEAD는
`3cfa2b95f50102cd9e342ec9a3e8e56cebf09e84`이다.
백업 준비 전에는 변경된 추적 항목 87개와 미추적 항목 91개가 있었다.
이번 인계 문서가 추가되므로 최종 상태는 암호화 이미지 내부 `verification.json`을 기준으로 한다.

원본 저장소: https://github.com/gmbro/oriwan.git

## 보안과 포함 범위

- 사용자 요청에 따라 소스, `.git`, `.env.local`, `.vercel`, `node_modules`,
  `.next`, `.next-local`, `.pnpm-store`, TypeScript 캐시, 디자인 원본 `output/`을 포함한다.
- 로컬에서 발견한 Vercel CLI 인증/설정, GitHub CLI 설정, Codex 인증 파일,
  Git 전역 설정은 `private-settings/`에 분리한다. 자동으로 새 Mac의 계정을 덮어쓰지 않는다.
- 다운로드 가능한 Vercel development/production 환경설정은 `private-settings/vercel-env/`에 보관한다.
  다운로드가 제한되거나 실패한 항목은 `environment-export.json`에 표시한다.
- Node.js 24.19.0 arm64, pnpm 11.19.0, 휴대용 Git, Vercel CLI 59.11.7을 함께 제공한다.
- 브라우저 쿠키, macOS 키체인, 다른 프로젝트, 전체 Codex 대화 데이터베이스는 복사하지 않는다.
  로그인 토큰이 만료되거나 기기 보호를 받으면 새 Mac에서 다시 로그인해야 한다.
- 실행 중 프로세스의 소켓과 `.next-local/dev/lock` 같은 잠금 파일은 복원하지 않는다.
  캐시는 포함하지만 경로·OS·CPU가 달라지면 재생성이 필요할 수 있다.
- 이 파일은 DB/Storage의 전체 백업이 아니다. 기존 Supabase/Vercel 서비스에 다시 연결한다.

암호화 DMG에는 운영 비밀키와 인증 토큰이 들어 있다. 외부 공유·Git 업로드를 금지한다.
암호 파일은 DMG와 별도로 보관하고 전달한다. 새 Mac에서 정상 복원한 뒤에도
원본 Mac은 복원 검증이 끝날 때까지 보존한다.

이 Mac에서는 데스크탑 iCloud 동기화 설정이 켜져 있고 iCloud Desktop이 실제 Desktop과
같은 위치를 가리키는 것을 확인했다. 암호화 백업은
`Desktop/TWTT-Mac-Transfer-2026-09-09/`에, 복호화 키는 동기화 폴더 밖의
`/Users/panda/.twtt-transfer-keys/TWTT-2026-09-09.key.txt`에 보관한다.
설정 확인이 업로드 완료를 뜻하지는 않는다. 새 Mac에서 다운로드 완료와 SHA-256을 확인한다.
두 Mac에서 iCloud로 동기화된 같은 작업 폴더를 동시에 수정하지 않는다.
개발은 새 Mac의 비동기화 로컬 폴더에서 진행하는 것을 권장한다.

## 새 Mac에서 시작

1. DMG를 열고 별도로 받은 암호를 입력한다.
2. 이미지 안의 `TWTT-workspace` 폴더를 **새 Mac의 쓰기 가능한 로컬 폴더**로 통째로 복사한다.
   읽기 전용 DMG 안에서 바로 실행하지 않는다. 폴더가 이미 있으면 다른 이름으로 복사한다.
3. `00-먼저읽기.md`를 읽는다.
4. `03-환경설정선택.command`를 실행한다. 개발 환경을 우선 선택한다.
   로컬 원본에는 임시 Vercel 토큰만 있었기 때문에 서비스 환경설정을 별도로 복원해야 한다.
   운영 환경을 선택하면 로컬 앱도 **실제 운영 DB/Storage**에 연결될 수 있다.
   실제 회원 기록·댓글·프로필을 테스트 목적으로 등록/수정/삭제하지 않는다.
5. `01-작업시작.command`를 실행한다. 기본 주소는 `http://localhost:3000/4th/dashboard`이다.
   스크립트는 localhost에만 바인딩한다. 포트가 사용 중이면 기존 프로세스를 무단 종료하지 않는다.
6. 배포/원격 Git 작업이 필요할 때만 `02-로그인정보복원.command`에서 해당 도구를 선택한다.
   이미 설정 파일이 있으면 덮어쓰지 않는다. 키체인 로그인은 필요 시 직접 다시 인증한다.
7. 새 Mac의 Codex에서 **복사한 `TWTT-workspace/oriwan` 폴더**를 프로젝트로 열고
   아래 이어받기 지시문을 전달한다.

Apple Silicon(M 시리즈) Mac용 실행 파일이다. Intel Mac에서는 네이티브 Node.js 24와 Git을
설치한 뒤 `npm ci`로 의존성을 다시 설치해야 한다. 기존 `node_modules`와 `.next*`는 필요하면
이름을 바꿔 보존한 뒤 재생성한다. 이 백업 도구는 보안 설정이나 Gatekeeper를 끄지 않는다.
macOS가 실행 확인을 요구하면 신뢰할 수 있는 본인 백업인지 확인한 후 시스템 안내를 따른다.

이번 내보내기에서 development에는 `VERCEL_OIDC_TOKEN` 1개만 있었고,
production에는 38개 환경변수가 있었다. 현재 기능을 연결하려면 환경설정 선택 도구의
운영 환경(2번)을 명시적으로 선택하거나 별도 개발 Supabase 환경을 준비해야 한다.
도구는 원본 환경설정을 암호화 백업에 보존하면서 로컬 복원본에서 배포 전용 동작 플래그·
Vercel 메타데이터를 제거하고 사이트 주소를 localhost로 바꾼다.
운영 DB에 실데이터 쓰기를 허용하는 안전장치를 추가하는 것은 아니므로 주의한다.

## 터미널에서 사용하는 방법

`TWTT-workspace` 폴더에서:

```bash
./tooling/check.command
./tooling/test.command
./tooling/vercel.command --version
./tooling/git.command -C oriwan status --short
```

일반 Node.js/npm 환경을 설치한 경우 `oriwan` 폴더에서:

```bash
npm ci
node --experimental-strip-types --test --test-reporter=dot tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run dev
```

Git의 Xcode 라이선스 오류가 나면 무단으로 라이선스를 동의하지 않는다.
백업의 `tooling/git.command`는 기존 Mac에서 쓰던 휴대용 Git을 사용한다.

## 현재 배포와 복구 기준

- Vercel 프로젝트: `twtt`, 범위: `gmbros-projects`
- projectId: `prj_iBuqfuJYSpin7fg6JXuNtb8LNvB6`
- orgId: `team_lAV6HBxR3RJ3o607SEjVe6Oj`
- 마지막 확인된 운영 배포: `dpl_5kjqieQsE9VWq1poPYyd2UoPmRC5`
- 해당 배포: https://twtt-ooncojaa7-gmbros-projects.vercel.app
- 운영 주소: https://xn--220bw61afob.kro.kr/4th/dashboard
- 직전 롤백 기준: `dpl_9zm9eM5cK7WDwKq6EpZpgQfiqv7T`
- 직전 주소: https://twtt-6d1g7rz2h-gmbros-projects.vercel.app

위 배포 상태는 2026-09-08 릴리스 문서의 마지막 검증 기준이다. 이번 Mac 이전 준비에서는
운영 배포나 DB를 수정하지 않았다. 실제 배포 전 현재 상태를 다시 확인한다.

기존 릴리스 절차는 후보 생성 → 검사 → 승격이다. 예시는 `oriwan` 폴더에서 실행하며,
백업 도구를 사용할 경우 `vercel` 대신 `../tooling/vercel.command`를 사용한다.

```bash
vercel deploy --prod --skip-domain --yes --logs --build-env TWTT_VERIFY_MEMBER_UPLOAD=1
# 후보 URL의 빌드/기능/모바일 검증을 통과한 경우에만:
vercel promote <검증한-후보-URL> --yes
```

`TWTT_VERIFY_MEMBER_UPLOAD=1`을 유지한다. 이 검사는 임시 합성 객체의 업로드·읽기·익명 접근
차단과 실제 Gemini OCR을 검증하고 임시 객체를 정리한다. 비용과 외부 쓰기가 있으므로
일반 로컬 시작/이전 검사에서는 실행하지 않는다.
`TWTT_QUOTES_MODE`는 설정하지 않는다. 명언 50개 교체는 이미 완료된 일회성 작업이다.

## 최신 완료 내용과 주의할 회귀

- 카카오 로그인/새로고침은 메인으로 복귀. 내 정보 명시적 바로가기는 한 번만 열고 해시를 소비한다.
- TODAY·날짜·서울 현재 시각의 폰트, 크기, 굵기, 색상 통일. 화면 크기가 바뀌어도 가로 배치.
- 프로필 편집 통합, 큰 인증샷 업로드 영역, 내 정보 하단 4개 기능과 각종 주석 반영 완료.
- 멤버 정렬 컨트롤 축소, 인원수 위치 조정, 댓글 익명 체크박스, 중복 제목/설명 삭제.
- 메인 요약의 누적 거리/시간은 공식 시즌 승인 기록을 집계한다. 공식 시작은 2026-09-23이다.
- 멤버 개인 통계의 준비 러닝·검수 대기 수치 보존은 별도 기존 규칙이다. 공용 공식 통계와 혼동하지 않는다.
- 개인 인증 캘린더의 `확인 중` 표시와 자기소개 UI 제거. 기록 상태나 저장된 자기소개 데이터는 삭제하지 않았다.
- 3개 요약 수치와 6주 달력이 모바일 세로/가로 화면에 맞춰 조밀하게 배치된다.
  극단적으로 작은 화면이나 텍스트 확대에서는 접근성을 위해 세로 스크롤을 허용한다.
- 인증 이미지 Storage는 비공개다. 소유자/운영자 검증 API를 유지하고 공개 URL 방식으로 되돌리지 않는다.
- 공개 콘텐츠 fetch의 `credentials: "same-origin"`을 유지한다. 배포 후보 보호 쿠키와 관련된 회귀가 있었다.
- 원본 사진·DB 기록을 일괄 삭제하거나 스키마 SQL을 새 Mac 설정용으로 다시 실행하지 않는다.
- dirty worktree 전체를 무분별하게 커밋/초기화하지 않는다. 기존 작업과 인계 파일을 구분한다.

직전 릴리스의 검증은 자동 테스트 122개, TypeScript, 변경 TS/TSX ESLint, 운영 빌드와
보안/OCR 검사였다. 6주 달력은 320×480, 320×568, 390×844, 612×998, 568×320,
844×390에서 검증했다. 이번 백업 검사는 이미지 내부 `verification.json`을 참고한다.

최신 참고 문서:

- `docs/dashboard-entry-calendar-release-2026-09-08.md`
- `docs/dashboard-detail-polish-release-2026-09-08.md`
- `docs/performance-security-mobile-2026-09-08.md`
- `docs/dashboard-comment-ui-release-2026-09-08.md`
- `docs/activity-speed-quotes-release-2026-09-08.md`
- `docs/hello-2027-kakao-admin-architecture.md`
- `docs/hello-2027-production-readiness.md`
- `docs/migrations/2026-09-08-private-run-image-access.sql`

일부 오래된 README의 명언 개수·UI 설명은 최신 릴리스보다 오래됐다. 충돌하면 최신 코드와
날짜가 명시된 릴리스 문서를 먼저 확인한다. Next 코드를 수정하기 전 `AGENTS.md`와
설치된 `node_modules/next/dist/docs/`의 관련 문서를 읽는다.

## 새 Codex에 전달할 지시문

> 이 폴더는 기존 Mac에서 작업 중이던 TWTT/oriwan 프로젝트의 전체 이전본입니다.
> 먼저 AGENTS.md와 docs/mac-handoff-2026-09-09.md를 읽고 git status를 확인하세요.
> 최신 미커밋·미추적 변경을 보존하고 초기화하지 마세요. 비밀키/인증 파일을 출력하거나
> Git에 올리지 마세요. 2026-09-08 최신 릴리스까지 구현·테스트·배포되어 있습니다.
> 먼저 로컬 환경과 테스트를 확인하고, 다음 요청 범위에서만 수정하세요.
> 실제 운영 회원 데이터 변경, DB 초기화, 재배포는 별도 요청 없이 하지 마세요.
