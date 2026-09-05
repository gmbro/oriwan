# 스내사 3기 대시보드 개발 가이드

> 4기 운영·인증의 현행 기준은 [4기 카카오 로그인·공개 대시보드·어드민 구조](./hello-2027-kakao-admin-architecture.md)와 [TWTT 4기 서비스 운영정책](./twtt-4th-operating-policy.md)을 따릅니다. 이 문서의 본문은 3기 개발 가이드입니다.

## 프로젝트 소개

스내사 3기 대시보드는 운영자가 참가자들의 러닝 인증 이미지를 업로드하면 AI가 이미지 속 텍스트를 읽어 날짜, 이름, 거리, 시간, 페이스를 추출하고, 인증 여부와 향상도를 대시보드로 보여주는 이미지 기반 러닝 인증 운영 도구입니다.

## 기술 스택

| 항목 | 기술 |
| --- | --- |
| Frontend/Backend | Next.js 16 App Router |
| Auth & DB | Supabase |
| Image Storage | Supabase Storage |
| OCR/AI | Google Gemini 2.0 Flash |
| Deploy | Vercel |

## 핵심 기능

- 참가자 직접 등록 및 관리
- 여러 인증 이미지 일괄 업로드
- 이미지 배경/앱 UI를 무시하고 텍스트/숫자 중심 추출
- 날짜 자동 추출, 없으면 운영자가 선택한 날짜를 임시 적용
- 시간이 없거나 참가자 매칭이 애매하면 `확인 필요` 처리
- 거리/시간/페이스 수동 보정
- 최근 14일 인증 시계열
- 인증 횟수, 누적 거리, 누적 시간 랭킹
- 개인별 거리/시간 그래프

## 주요 라우트

```text
app/dashboard/page.tsx              운영 대시보드
app/api/participants/route.ts       참가자 조회/추가
app/api/participants/[id]/route.ts  참가자 수정/비활성화
app/api/records/route.ts            기록 조회/수동 저장
app/api/records/[id]/route.ts       기록 수정/삭제
app/api/records/analyze/route.ts    이미지 OCR 분석 및 기록 생성
```

## 환경 변수

| 변수명 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage 업로드용 service role key |
| `CORRECTIVE_EXERCISE_LIVE` | 선택. 민감정보 파기 Cron·운영 권한을 실검증한 뒤에만 `true`로 설정 |
| `HELLO_2027_COMMENTS_DISABLED` | 선택. 긴급 점검 시에만 `true`로 설정해 댓글 쓰기·반응을 중단 |
| `GEMINI_API_KEY` | Gemini 이미지 분석 및 비식별 파생 정보 기반 오늘의 운세 API 키 |
| `GEMINI_FORTUNE_API_KEY` | 권장. OCR과 쿼터를 분리한 오늘의 운세 전용 Gemini API 키 |
| `GEMINI_FORTUNE_MODEL` | 선택. 기본 운세 모델이며 기본값은 `gemini-3.1-flash-lite` |
| `GEMINI_OCR_MODEL` | 선택. 기본 OCR 모델이며 기본값은 `gemini-3.1-flash-lite` |
| `GEMINI_OCR_FALLBACK_MODEL` | 선택. 품질 미달 때만 호출하며 기본값은 `gemini-3.5-flash` |
| `GEMINI_OCR_FALLBACK_CONFIDENCE` | 선택. 고급 모델 재분석 기준이며 기본값은 `0.8` |

4기 공통 대시보드는 별도의 전환 플래그 없이 항상 Supabase의 실제 4기 데이터만 조회합니다. 설정·테이블·데이터가 없거나 조회에 실패하면 코드 fixture로 대체하지 않고 빈 상태로 실패-폐쇄합니다.

## 데이터베이스

새 프로젝트는 아래 순서로 적용합니다.

1. `docs/supabase-schema.sql`: 공통 운영 테이블과 4기 콘텐츠 저장소
2. `docs/migrations/2026-09-04-corrective-exercise-audit-and-delete.sql`: 교정운동 변경 감사·즉시 삭제 보강
3. `docs/migrations/2026-09-04-corrective-exercise-retention-cron.sql`: 만료 데이터 자동 파기
4. `docs/supabase-security-hardening.sql`: 브라우저 직접 접근·Realtime·공개 Storage 차단

기존 운영 DB에 일부 저장소만 누락된 경우에는 범위가 작은 전용 SQL을 먼저 사용할 수 있습니다.

- `docs/migrations/2026-09-04-profile-introductions.sql`: 크루 자기소개 저장소
- `docs/migrations/2026-09-04-corrective-exercise.sql`: 교정운동 기본 일정·신청·열람 감사 로그

전용 SQL을 사용한 경우에도 교정운동 감사·삭제 보강 → Cron → 보안 하드닝 순서는 유지합니다.

주요 테이블:

- `participants`
- `upload_batches`
- `daily_run_records`

주요 Storage bucket:

- `photos`: 러닝 인증 원본 이미지
- `snasa-gallery`: 스내사 포토로그 이미지

`snasa-gallery`에는 날짜가 들어간 폴더를 만들고 사진을 넣으면 됩니다.
예: `2026-05-16 스내사 남산런/photo-001.jpg`, `0516 스내사 남산런/photo-001.jpg`

## 운영 플로우

1. 참가자 이름을 등록합니다.
2. 기본 날짜를 선택합니다.
3. 인증 이미지 여러 장을 업로드합니다.
4. AI가 이미지 속 텍스트와 숫자를 추출합니다.
5. 날짜/시간/이름이 없거나 애매한 항목은 검수 테이블에서 수정합니다.
6. 인증 시계열과 랭킹으로 진행 상황을 확인합니다.

## 제품 기획

- [이미지 기반 러닝 인증 대시보드 제품 기획](./image-dashboard-product-plan.md)
- [다음 시즌 운영·광고·OCR 에이전트 기획](./next-season-dashboard-ad-and-ocr-agent-plan.md)
- [4기 카카오 로그인·공개 대시보드·어드민 구조](./hello-2027-kakao-admin-architecture.md)
- [TWTT 4기 서비스 운영정책](./twtt-4th-operating-policy.md)
