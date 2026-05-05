# 스내사 3기 대시보드

이미지 기반 러닝 인증 운영 대시보드입니다. 운영자가 참가자를 등록하고 러닝 인증 이미지를 업로드하면 AI가 날짜, 이름, 거리, 시간, 페이스를 추출합니다. 누락되거나 애매한 값은 검수 테이블에서 수동으로 보정하고, 인증 시계열과 랭킹/그래프로 참가자들의 변화를 확인합니다.

## 주요 기능

- 참가자 직접 등록
- 인증 이미지 일괄 업로드
- Gemini Vision 기반 텍스트/숫자 추출
- 날짜 누락 시 기본 날짜 임시 적용
- 시간 누락 시 수동 입력
- 최근 14일 인증 시계열
- 인증 횟수, 누적 거리, 누적 시간 랭킹
- 개인별 거리/시간 그래프

## 개발

```bash
npm install
npm run dev
```

## 데이터베이스

Supabase SQL Editor에서 `docs/supabase-schema.sql`을 실행하세요.

필요한 환경 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
