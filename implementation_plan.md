# 오리완 (O-Ri-Wan) 웹사이트 구현 계획안 (Strava API 연동)

본 계획안은 순수 웹사이트(Next.js) 환경을 유지하면서도, 사용자의 **실제 러닝 데이터(키로수, 케이던스 등)**를 자동으로 가져와 인증할 수 있도록 기획된 버전입니다.

## User Review Required (피드백 요청 사항)

> [!IMPORTANT]
> **웹 환경에서의 건강 데이터 연동 방법: Strava(스트라바) API 도입**
> 순수 웹 브라우저에서는 스마트폰의 '애플 건강'이나 '삼성 헬스'에 직접 접근하는 것이 보안상 불가능합니다. 
> 이를 해결하기 위한 가장 대중적이고 완벽한 웹 기반 대안은 **Strava(스트라바) 연동**입니다. 
> 
> *대부분의 러너들은 애플워치, 가민, 코로스 등의 기록을 스트라바와 연동해 둡니다.*
> 오리완 웹사이트에서 사용자가 **[스트라바로 로그인/연동]** 버튼을 누르면, 백엔드에서 스트라바에 저장된 **오늘의 러닝 데이터(거리, 케이던스, 페이스, 심박수 등)를 자동으로 가져와서** 오리완 인증에 사용합니다. 
> 
> 이 방식을 채택하는 것에 동의하시나요?

---

## 1. 아키텍처 및 기술 스택 (Architecture)

* **UI Framework:** Next.js 14+ (App Router)
* **Auth & DB:** Supabase (PostgreSQL) + **Strava OAuth (스트라바 연동)**
* **AI:** Gemini API (실제 러닝 데이터(거리, 케이던스)를 분석하여 맞춤형 회복 팁 제공)
* **Styling:** Tailwind CSS (바닐라 CSS 지향, 필요시 Tailwind 병행)
* **Deployment:** Vercel

---

## 2. 개발 단계별 구현 계획 (Phases)

### Phase 1: Next.js 초기화 및 Strava API 세팅
* 기존 폴더 정리 및 Next.js 앱 새로 생성
* Supabase 연동 (DB 스키마: `users`, `workouts` 구성)
* **Strava API 애플리케이션 등록 및 OAuth 연동 로직 구현**

### Phase 2: 랜딩 페이지 및 연동(Auth) UI
* **`app/page.tsx`:** 오리완 서비스를 소개하는 단순하고 세련된 랜딩 페이지.
* **`app/login/page.tsx`:** **"Strava로 시작하기"** 버튼 (스트라바 소셜 로그인 및 데이터 접근 권한 획득).

### Phase 3: 데이터 동기화 및 대시보드 (오리완 코어)
* **`app/dashboard/page.tsx`:** 유저의 이번 달 오리완 달력(잔디) 표시.
* **`app/sync/page.tsx`:** 사용자가 대시보드에 들어오면, Strava API를 호출해 오늘 뛴 최신 러닝 기록(거리, 케이던스 등)을 자동으로 불러와 `workouts` 테이블에 저장.

### Phase 4: AI 맞춤형 회복 팁 (Gemini API)
* Strava에서 가져온 구체적인 수치(예: "오늘 5km를 평소보다 빠른 케이던스 170으로 뛰셨네요!")를 프롬프트로 구성하여 Gemini API에 전송.
* 생성된 맞춤형 회복 및 스트레칭 팁을 인증 완료 화면(`app/success/page.tsx`)에 오리완 도장과 함께 노출.

---

## 3. 검증 계획 (Verification Plan)

### Automated/Manual Verification
* **Strava 연동 테스트:** 로컬 환경에서 Strava OAuth 로그인이 정상적으로 수행되고 Access Token을 받아오는지 확인.
* **데이터 파싱 테스트:** Strava Activities API에서 거리(Distance)와 케이던스(Cadence) 필드를 정확하게 추출하는지 확인.
* **AI 맞춤형 팁 테스트:** 추출된 러닝 수치를 기반으로 Gemini API가 자연스럽고 유용한 회복 팁을 생성하는지 확인.
