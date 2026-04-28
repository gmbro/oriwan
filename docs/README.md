# 오리완 (O-Ri-Wan) 개발 가이드

## 프로젝트 소개

**오리완**은 "오늘의 리커버리 완료"의 줄임말로, Strava API를 통해 러닝 데이터를 자동으로 가져오고, Gemini AI가 맞춤형 회복 팁을 제공하는 웹 기반 기록 인증 서비스입니다.

## 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend/Backend | Next.js 16 (App Router) |
| 스타일링 | Tailwind CSS + Vanilla CSS |
| 러닝 데이터 | Strava OAuth2 API |
| AI | Google Gemini 2.0 Flash |
| 배포 | Vercel |

## 폴더 구조

```
oriwan/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── strava/           # Strava OAuth 시작
│   │   │   │   ├── route.ts
│   │   │   │   └── callback/     # OAuth 콜백 (토큰 교환)
│   │   │   │       └── route.ts
│   │   │   └── logout/           # 로그아웃
│   │   │       └── route.ts
│   │   ├── strava/
│   │   │   └── activities/       # Strava 활동 동기화
│   │   │       └── route.ts
│   │   └── ai/
│   │       └── recovery-tip/     # Gemini AI 회복 팁
│   │           └── route.ts
│   ├── dashboard/                # 대시보드 (잔디 달력, 러닝 카드)
│   │   └── page.tsx
│   ├── success/                  # 오리완 완료 & AI 회복 팁 표시
│   │   └── page.tsx
│   ├── globals.css               # 디자인 시스템
│   ├── layout.tsx                # 루트 레이아웃
│   └── page.tsx                  # 랜딩 페이지
├── lib/
│   ├── strava.ts                 # Strava API 유틸리티 (서버 전용)
│   └── supabase/
│       ├── server.ts             # 서버 전용 Supabase 클라이언트
│       └── client.ts             # 브라우저 전용 Supabase 클라이언트
├── middleware.ts                 # 보안 미들웨어
└── .env.local.example            # 환경 변수 템플릿
```

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 아래 값들을 채워주세요:

| 변수명 | 설명 | 발급 방법 |
|--------|------|-----------|
| `STRAVA_CLIENT_ID` | Strava API 클라이언트 ID | [Strava API Settings](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | Strava API 클라이언트 Secret | 위와 동일 |
| `GEMINI_API_KEY` | Google Gemini API 키 | [Google AI Studio](https://aistudio.google.com/) |

### 2. Strava 앱 등록

1. [Strava API Settings](https://www.strava.com/settings/api) 접속
2. **Authorization Callback Domain**: `localhost` (개발) / `your-domain.vercel.app` (배포)
3. 발급받은 Client ID와 Secret을 `.env.local`에 입력

### 3. 로컬 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)으로 접속하세요.

## 보안 설계

### 토큰 보호

| 항목 | 방식 |
|------|------|
| Strava Access/Refresh Token | `httpOnly` 쿠키로만 저장 (JS 접근 불가) |
| Gemini API Key | 서버 사이드 환경 변수 (`GEMINI_API_KEY`, NEXT_PUBLIC 접두사 없음) |
| Strava Client Secret | 서버 사이드 환경 변수 (`STRAVA_CLIENT_SECRET`) |

### CSRF 방지
- OAuth 시작 시 랜덤 `state` 토큰 생성 → `httpOnly` 쿠키 저장
- 콜백에서 state 값 일치 여부 검증 후 즉시 삭제 (일회성)

### 보안 HTTP 헤더 (미들웨어)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (클릭재킹 방지)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 라우트 보호
- `/dashboard`, `/success`: 세션 쿠키 없으면 자동 리다이렉트
- `/api/strava/*`, `/api/ai/*`: 세션 쿠키 없으면 401 반환
