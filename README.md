# TWTT 러닝보드

TWTT 크루의 시즌별 러닝 인증, 공개 현황, 개인 오늘의 운세·응원 상자와 운영자 OCR 검수를 제공하는 Next.js 대시보드입니다.

## 서비스 경로

| 경로 | 용도 |
| --- | --- |
| `/` | 카카오 로그인 또는 비로그인 공개 보기를 선택하는 공통 입구 |
| `/3th` | 3기 종료 시점의 정적 스냅샷을 보여주는 읽기 전용 대시보드 |
| `/4th` | 카카오 로그인 또는 비로그인 공개 보기를 선택하는 4기 진입 화면 |
| `/4th/dashboard` | 4기 `Hello 2027` 공통 대시보드 |
| `/admin` | 이메일 OTP 기반 공용 운영 어드민 |
| `/dashboard/report/3th` | 3기 전체·개인 시즌 리포트 |

기존 `/dashboard` 요청은 현재 시즌인 `/4th/dashboard`로 이동합니다.

## 현재 4기 준비 상태

`/4th/dashboard`는 코드에 고정된 가상 멤버·수치·배너·응원글·댓글을 사용하지 않습니다. Supabase의 실제 4기 데이터만 표시하며, 운영 저장소가 비어 있거나 조회에 실패하면 가짜 자료를 섞지 않는 빈 상태로 닫힙니다. 카카오 로그인 계정은 별도 운영자 승인 없이 비공개 4기 멤버로 바로 연결되고, 로그인 이용자는 인증 없이 오늘의 운세를 볼 수 있습니다. 2026-08-13 이후 오늘 인증을 완료하면 응원 상자를 하루 한 번 열 수 있으며, 9월 23일 전 준비 러닝은 개인 기록과 상자 자격에만 반영하고 공식 인증률·D-day에서는 제외합니다. 교정운동 문의는 민감정보 파기와 운영 권한을 검증한 환경에서만 열립니다.

4기 공식 100일 인증은 2026-09-23부터 2026-12-31까지 계산합니다. 3기 종료 다음 날인 2026-08-13부터 공식 시작 전까지 등록한 준비 러닝은 공용 인증률·D-day·크루 통계에서 제외하고, 승인된 본인의 `/me` 개인 기록에만 표시합니다. 개인 화면은 공식/준비 기록을 분리한 요약, 누적 거리, 주차별 거리, 100일 캘린더와 최근 기록을 제공해 시즌 종료 리포트에도 같은 구조를 이어 쓸 수 있습니다.

공개 응원글·배너·멤버 자기소개는 Supabase 서버 API만 사용합니다. `/admin`에서 응원글 56개, 배너 10개, 멤버 자기소개와 댓글 상태를 관리할 수 있습니다. 댓글은 누구나 읽을 수 있고 카카오 로그인 이용자만 닉네임 또는 공개 익명을 선택해 댓글·답글·반응을 남길 수 있습니다. 정식 오픈 전에는 실계정·권한·보존 정책을 최종 확인해야 합니다.

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
- `DAILY_FORTUNE_SECRET` (32바이트 이상의 운세 전용 난수값)
- `ADMIN_USER_ID`
- `GEMINI_API_KEY`

기능별 선택:

- `SITE_URL`
- `SUPABASE_GALLERY_BUCKET`
- `GEMINI_OCR_MODEL`
- `GEMINI_FORTUNE_MODEL` (기본 `gemini-3.1-flash-lite`)
- `GEMINI_FORTUNE_API_KEY` (권장. OCR 키와 쿼터를 분리한 운세 전용 키)
- `GEMINI_OCR_FALLBACK_MODEL`
- `GEMINI_OCR_MODEL_FALLBACKS`
- `GEMINI_OCR_FALLBACK_CONFIDENCE`
- `OCR_CONCURRENCY`
- `YOUTUBE_API_KEY`
- `GOOGLE_YOUTUBE_API_KEY`
- `HELLO_2027_COMMENTS_DISABLED` (긴급 점검 시에만 `true`)
- `CORRECTIVE_EXERCISE_LIVE` (민감정보 파기 Cron·권한 실검증 후에만 `true`)

Kakao REST API 키와 Client Secret은 애플리케이션 환경 변수가 아니라 Supabase Authentication의 Kakao Provider 설정에 직접 등록합니다. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 또는 publishable key는 공개 클라이언트 식별값이며 보안 경계는 RLS와 grants입니다. `SUPABASE_SERVICE_ROLE_KEY`, Kakao Client Secret, `ADMIN_SESSION_SECRET`, `DAILY_FORTUNE_SECRET`, `GEMINI_API_KEY`는 브라우저 코드와 `NEXT_PUBLIC_*` 변수에 넣지 않습니다.

Kakao 동의항목은 닉네임(`profile_nickname`) 필수, 프로필 이미지(`profile_image`) 선택, 이메일(`account_email`) 미요청으로 설정하고 Supabase Kakao Provider의 `Allow users without an email`을 반드시 켭니다. 현재 이메일 scope를 계속 요청하는 Supabase Auth 동작은 서버가 검증된 Kakao redirect의 scope만 최소화하는 임시 호환 처리로 대응합니다. 상세한 보안 검증과 제거 조건은 [4기 카카오 로그인·공개 대시보드·어드민 구조](docs/hello-2027-kakao-admin-architecture.md)를 따릅니다.

운세 입력 원문은 저장·로깅하거나 Google에 보내지 않고, 서버에서 만든 별자리·띠·출생 시간대·광역 생활 권역·비가역 이름 지표만 Gemini에 전달합니다. 댓글은 기본 활성 상태이며 `HELLO_2027_COMMENTS_DISABLED=true` 또는 기존 `HELLO_2027_COMMENTS_LIVE=false`로 긴급 중단할 수 있습니다. 교정운동 문의는 민감정보 파기 Cron과 운영 권한을 실검증한 뒤 `CORRECTIVE_EXERCISE_LIVE=true`로 명시할 때만 활성화됩니다.

## Supabase 적용 순서

운영 DB와 Storage를 먼저 백업한 뒤 Supabase SQL Editor에서 다음 순서로 적용합니다.

1. 기본 스키마: [`docs/supabase-schema.sql`](docs/supabase-schema.sql)
2. RLS·권한 하드닝: [`docs/supabase-security-hardening.sql`](docs/supabase-security-hardening.sql)

두 SQL은 순서대로 모두 적용합니다. 기본 스키마도 일반 `anon`·`authenticated` 권한을 차단하고, 하드닝 SQL이 이를 다시 검증합니다. 적용 후 service role 권한, private Storage, 관리자 OTP, 기수별 카카오 계정 연결, 댓글 비식별 삭제를 실제 계정으로 확인합니다.

이미 운영 중인 DB에 교정운동 기능만 추가할 때는 전체 스키마 대신 비파괴 전용 마이그레이션
[`docs/migrations/2026-09-04-corrective-exercise.sql`](docs/migrations/2026-09-04-corrective-exercise.sql)을 적용합니다.
만료 신청 자동 파기는 opt-in 파일
[`docs/migrations/2026-09-04-corrective-exercise-retention-cron.sql`](docs/migrations/2026-09-04-corrective-exercise-retention-cron.sql)을
SQL Editor에서 별도로 적용하고 `cron.job`·`cron.job_run_details` 결과까지 확인합니다.

## 운영 문서

- [TWTT 4기 서비스 운영정책](docs/twtt-4th-operating-policy.md)
- [배포·데이터 보존·어드민 준비 가이드](docs/hello-2027-production-readiness.md)
- [4기 카카오 로그인·공개 대시보드·어드민 구조](docs/hello-2027-kakao-admin-architecture.md)
- [오늘의 응원 상자 기획과 보안 기준](docs/hello-2027-daily-gift-box-plan.md)
- [스내사 4기 관리자 OTP 메일 템플릿](docs/supabase-admin-otp-email-template.md)
