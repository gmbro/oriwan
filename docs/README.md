# 스내사 3기 대시보드 개발 가이드

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
| `GEMINI_API_KEY` | Gemini 이미지 분석 API 키 |

## 데이터베이스

`docs/supabase-schema.sql`을 Supabase SQL Editor에서 실행합니다.
운영 배포 전에는 이어서 `docs/supabase-security-hardening.sql`도 실행해 anon 직접 접근, Realtime 직접 구독, 공개 Storage 버킷 설정을 잠급니다.

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
