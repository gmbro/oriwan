# TWTT 러닝보드

TWTT 크루의 시즌별 러닝 인증, 공개 현황, 개인 응원 상자와 운영자 OCR 검수를 제공하는 Next.js 대시보드입니다.

## 서비스 경로

| 경로 | 용도 |
| --- | --- |
| `/` | 3기·4기 대시보드와 카카오 로그인을 연결하는 공통 입구 |
| `/3th` | 3기 종료 시점의 정적 스냅샷을 보여주는 읽기 전용 대시보드 |
| `/4th` | 4기 `Hello 2027` 오픈 전 미리보기 대시보드 |
| `/admin` | 이메일 OTP 기반 공용 운영 어드민 |
| `/dashboard/report/3th` | 3기 전체·개인 시즌 리포트 |

기존 `/dashboard` 요청은 현재 시즌인 `/4th`로 이동합니다.

## 현재 오픈 전 상태

`/4th`에는 화면 검증용 크루·배너·응원글·댓글 더미데이터가 들어 있으며 검색엔진 색인을 막아 두었습니다. 서버 댓글 저장소가 준비되기 전까지 댓글·답글·반응은 읽기 전용입니다. 광고·응원글의 로컬 편집 내용은 현재 브라우저 IndexedDB에만 저장되어 기기나 어드민 사이에서 공유되지 않습니다. 정식 오픈 전 더미데이터를 제거하고 운영 Supabase API로 전환해야 합니다.

3기 화면과 리포트는 `data/third-season-public-dashboard.json`의 2026-05-05~08-12 동결본을 함께 읽습니다. 공개본은 운영 UUID와 불필요한 생성 시각을 제거한 전용 식별자를 사용합니다.

## 브랜드 자산

- 공통 로고: `public/brand/twtt-logo.png`
- 파비콘·앱 아이콘: `public/brand/twtt-icon-20260902.png`, `app/icon.png`
- 공통 렌더링 컴포넌트: `components/twtt-brand-mark.tsx`

브라우저 파비콘 캐시를 고려해 자산을 교체할 때는 파일명 또는 메타데이터 URL 버전도 함께 갱신합니다.

## 개발과 검증

```bash
npm install
npm run dev
```

배포 전 검증:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 환경 변수

값과 비밀키는 저장소나 문서에 기록하지 않고 로컬 환경 및 배포 서비스의 Secret 설정에만 저장합니다.

필수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_SESSION_SECRET`
- `ADMIN_USER_ID`
- `GEMINI_API_KEY`

기능별 선택:

- `SITE_URL`
- `SUPABASE_GALLERY_BUCKET`
- `GEMINI_OCR_MODEL`
- `GEMINI_OCR_FALLBACK_MODEL`
- `GEMINI_OCR_MODEL_FALLBACKS`
- `GEMINI_OCR_FALLBACK_CONFIDENCE`
- `OCR_CONCURRENCY`
- `YOUTUBE_API_KEY`
- `GOOGLE_YOUTUBE_API_KEY`

Kakao REST API 키와 Client Secret은 애플리케이션 환경 변수가 아니라 Supabase Authentication의 Kakao Provider 설정에 직접 등록합니다.

## Supabase 적용 순서

운영 DB와 Storage를 먼저 백업한 뒤 Supabase SQL Editor에서 다음 순서로 적용합니다.

1. 기본 스키마: [`docs/supabase-schema.sql`](docs/supabase-schema.sql)
2. RLS·권한 하드닝: [`docs/supabase-security-hardening.sql`](docs/supabase-security-hardening.sql)

적용 후 anon/authenticated 직접 쓰기 차단, service role 권한, private Storage, 관리자 OTP와 카카오 계정 연결을 실제 계정으로 확인합니다.

## 운영 문서

- [TWTT 4기 서비스 운영정책](docs/twtt-4th-operating-policy.md)
- [배포·데이터 보존·어드민 준비 가이드](docs/hello-2027-production-readiness.md)
- [4기 카카오 로그인·공개 대시보드·어드민 구조](docs/hello-2027-kakao-admin-architecture.md)
- [오늘의 응원 상자 기획과 보안 기준](docs/hello-2027-daily-gift-box-plan.md)
