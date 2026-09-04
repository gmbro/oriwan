# TWTT 4기 카카오 로그인·공개 대시보드·운영 어드민 아키텍처

- 기준일: 2026-09-04
- 운영 origin: `https://xn--220bw61afob.kro.kr`
- 상태: 4기 사전 공개(prelaunch). 실제 오픈 전 서버 데이터 이전과 외부 인증 검증이 남아 있음
- 관련 운영정책: [TWTT 4기 서비스 운영정책](./twtt-4th-operating-policy.md)

이 문서는 현재 저장소에 구현된 범위와 이번에 확정한 운영 요구를 함께 기록한다. 구현된 기능과 운영 전에 남은 기능을 구분하며, 실제 Kakao·Supabase·Vercel 비밀값은 문서에 기록하지 않는다.

## 1. 확정 경로

| 경로 | 역할 | 로그인 | 현재 상태 |
| --- | --- | --- | --- |
| `/` | TWTT 공통 진입 페이지 | 불필요 | `카카오로 시작하기`, `로그인 없이 대시보드 보기`, 3기 기록 진입 제공 |
| `/3th` | TWTT 3기 공통 대시보드 | 불필요 | 종료 시점 정적 스냅샷을 사용하는 읽기 전용 화면 |
| `/4th` | TWTT 4기 공통 대시보드 | 열람은 불필요 | 더미데이터 기반 사전 공개. 오픈 안내 팝업과 `noindex` 적용 |
| `/admin` | 인증·크루프로필·응원글·배너·댓글 운영 | 관리자 OTP 필요 | 기존 인증/OCR과 탭 UI 제공. 일부 콘텐츠 탭은 서버 저장 미완료 |
| `/dashboard/report/3th` | TWTT 3기 전체 상세 아카이브 | 불필요 | 3기 전체 통계와 개인 기록 링크 제공 |
| `/dashboard/report/3th/[participantId]` | TWTT 3기 개인 상세 아카이브 | 불필요 | 선택한 3기 참가자의 개인 기록 제공 |

`/3th`와 `/dashboard/report/3th`는 용도가 다르다. `/3th`는 기존 공통 대시보드의 종료 스냅샷이고, `/dashboard/report/3th`는 시즌 전체·개인 상세 리포트다. 둘 다 3기 읽기 전용 데이터만 사용한다.

개인 기능은 `/4th` 안에서 제공하는 것이 기본 동선이다. `/me`가 호환 경로로 남아 있어도 별도의 인증 등록·OCR·프로필 자기수정 권한을 만들지 않는다.

```text
/
├─ /4th ───────────────── 4기 공개 대시보드 + 카카오 개인 영역
│  ├─ 비로그인 ────────── 공개 현황 열람, 정식 오픈 후 랜덤 익명 댓글
│  └─ 카카오 로그인 ───── 오늘의 운세 + Kakao/운영자 이름 댓글 + 조건부 응원 상자
├─ /3th ───────────────── 3기 공통 대시보드 읽기 전용 스냅샷
├─ /dashboard/report/3th ─ 3기 전체·개인 상세 아카이브
└─ /admin ─────────────── 관리자 OTP + 운영 탭
```

## 2. 개인 로그인 권한

카카오 개인 로그인으로 가능한 일은 아래 세 가지뿐이다.

1. 인증 없이 오늘의 운세 확인
2. Kakao 프로필 닉네임 또는 운영자가 바꾼 표시명으로 댓글·답글 작성
3. 운영자가 연결한 4기 참가자가 오늘 인증을 완료한 경우 오늘의 응원 상자 개봉

개인 로그인에는 인증 등록, OCR 분석, 인증 수정, 크루프로필 수정, 다른 참가자 기록 조회, 운영 어드민 접근 권한이 없다.

### 현재 API 권한 계약

| API | 메서드 | 동작 |
| --- | --- | --- |
| `/api/auth/kakao` | `GET` | 서버에서 PKCE OAuth를 시작하고 검증된 내부 `next` 경로를 callback에 전달 |
| `/api/hello-2027/viewer` | `GET` | Kakao 로그인, 운영자 승인, 운영자 확인 표시명 상태 조회 |
| `/api/me` | `GET` | 현재 Kakao 계정의 연결 상태와 표시명만 조회 |
| `/api/me/fortune` | `GET` | Kakao 세션만 확인하고 KST 날짜별 고정 운세를 서버 HMAC으로 계산 |
| `/api/me` | `PATCH` | 항상 `403`. 표시명은 운영자만 변경 |
| `/api/me/records` | `POST` | 항상 `403`. 인증은 운영자 어드민에서 등록·검수 |
| `/api/me/records/analyze` | `POST` | 항상 `403`. OCR은 운영자 어드민에서만 실행 |
| `/api/me/gift-box` | `GET` | 승인·오늘 인증·기존 지급 결과 조회 |
| `/api/me/gift-box` | `POST` | 조건을 다시 검증한 뒤 하루 한 번 응원 문구 지급 |

클라이언트에서 버튼만 숨기는 방식이 아니라 개인 인증·OCR API 자체가 `403`을 반환한다. 새 개인용 기록 API를 추가할 때도 같은 권한 원칙을 유지한다.

## 3. 카카오 로그인과 표시명

### 로그인 흐름

```text
/ 또는 /4th
  → /api/auth/kakao?next=/4th
  → 서버 supabase.auth.signInWithOAuth({ provider: "kakao" })
  → Kakao 동의 화면
  → https://<project-ref>.supabase.co/auth/v1/callback
  → https://xn--220bw61afob.kro.kr/api/auth/callback?next=/4th
  → exchangeCodeForSession(code)
  → /4th
```

앱 callback은 `next`를 `/`, `/4th`, `/4th#member-features`, `/me` allowlist로 제한하고 제어문자·역슬래시·쿼리를 거부한다. URL 파싱 뒤에도 최종 origin을 `NEXT_PUBLIC_SITE_URL` 또는 `SITE_URL`의 운영 origin과 다시 비교한다. 인증 응답과 사용자별 API 응답은 `private, no-store`로 처리한다.

### Kakao 이름과 운영자 확인 표시명

- Kakao 프로필 닉네임은 로그인 댓글의 기본 표시명이며 법적 실명 확인값이 아니다.
- 댓글 저장 요청이 작성자명을 받지 않게 하고, 서버가 Kakao identity data의 닉네임을 읽는다. 사용자 수정 가능 metadata는 권한 판정에 사용하지 않는다.
- 운영자가 `/admin` 크루프로필 탭에서 실제 크루를 선택하고 `display_name_override`를 입력한 뒤 승인한다.
- 표시명 입력이 없으면 운영자가 등록한 크루 이름을 기본값으로 사용한다.
- 승인된 연결만 운영자 override와 `/api/hello-2027/viewer`의 `verified_name: true`를 받는다. 승인 전 로그인 이용자는 Kakao identity가 제공한 프로필 이름만 받는다.
- 운영자 확인 전에는 `name_source: "kakao"`, 확인 후에는 `name_source: "admin"`으로 구분한다.
- 로그인 댓글 저장 API는 요청 본문의 작성자명이 아니라 최신 세션과 서버의 표시명 우선순위로 작성자를 정한다.
- 같은 이름만으로 계정을 자동 연결하지 않는다.

화면 문구는 사용자의 법적 신원을 인증했다는 의미의 `실명 인증` 대신 `운영자 확인 이름`을 우선 사용한다.

## 4. 댓글 구조

### 확정 동작

- 비로그인 이용자: 서버가 랜덤 익명 닉네임을 부여한다.
- 카카오 로그인 이용자: 운영자 override가 있으면 확인 표시명, 없으면 Kakao 프로필 닉네임을 사용한다.
- 로그인 이용자는 익명 모드를 선택할 수 없다.
- 댓글과 답글은 최대 150자다.
- 작성자명은 댓글 저장 요청에서 받지 않고 서버가 세션과 승인 연결에서 결정한다.
- 운영자는 `/admin` 댓글 탭에서 공개·숨김·복구·삭제를 관리한다.

### 현재 prelaunch 제약

`/4th`는 현재 `previewOnly`로 댓글 입력·답글·반응을 잠근다. 화면에 보이는 댓글은 더미 스냅샷이며 공용 댓글 저장소가 아니다. 개발용 Hello 2027 댓글 구현은 브라우저 IndexedDB를 사용하므로 다음 항목이 완료되기 전에는 정식 댓글 기능을 열지 않는다.

1. `guestbook_comments`, `guestbook_reactions` Supabase 테이블과 시즌 키
2. 공개 조회, 익명 작성, 로그인 작성, 답글, 반응 서버 API
3. 익명 HttpOnly 게스트 토큰과 서버 HMAC
4. 서버·DB의 150자 검증과 상태 제약
5. 서버리스 인스턴스 간 공유되는 지속형 rate limit과 스팸 방지
6. `/admin` 댓글 숨김·복구·삭제와 감사 로그
7. 작성자 삭제·Kakao 연결 해제 시 익명화 또는 삭제 절차

공용 댓글 서버 저장과 운영자 댓글 관리가 연결되기 전에는 `previewOnly`를 해제하지 않는다.

## 5. 오늘의 운세와 응원 상자

### 오늘의 운세

`/api/me/fortune`은 유효한 Kakao identity만 요구하며 참가자 승인이나 당일 인증은 확인하지 않는다. 서버가 계산한 Asia/Seoul 날짜와 Supabase auth user ID를 `DAILY_FORTUNE_SECRET`으로 HMAC해 카탈로그 인덱스를 정하므로 같은 사용자는 같은 날 같은 결과를 본다. 결과는 DB에 저장하지 않고, user ID·seed·digest를 응답하지 않는다. 응답은 `private, no-store, max-age=0`과 `Vary: Cookie`를 사용한다.

`DAILY_FORTUNE_SECRET`은 32바이트 이상의 운세 전용 난수로 배포 Secret에만 저장하며 `ADMIN_SESSION_SECRET`, Supabase service-role, Kakao Client Secret과 재사용하지 않는다.

### 오늘의 응원 상자

`/api/me/gift-box`는 아래 조건을 서버에서 확인한다.

1. 유효한 Supabase 사용자이며 실제 Kakao identity가 있는가.
2. 카카오 계정이 운영자에 의해 활성 참가자와 `approved`로 연결됐는가.
3. Asia/Seoul 기준 오늘이 4기 운영 기간(2026-09-23~2026-12-31) 안이며 오늘 날짜의 인증 레코드가 `certified`인가.
4. `season_key = "4th"`, 관리자 데이터 소유자, 참가자, auth user, 인증일이 모두 일치하는가.
5. 같은 4기 참가자·인증일에 이미 지급된 결과가 없는가.

랜덤 문구는 Node `crypto.randomInt`로 서버에서 고른다. DB에는 4기 시즌 키와 지급 당시 문구를 저장하고 고유 제약으로 동시 클릭·재요청을 중복 지급으로 만들지 않는다. 브라우저가 보낸 참가자, 날짜, 인증 상태, 문구를 권한 근거로 사용하지 않는다.

현재 구현은 `season_key = "4th"`를 사용한 과도기 구조다. 정식 시즌 테이블이 도입되면 문자열 키를 `season_id`와 `season_participant_id` 외래키로 교체하고, 3기 동결 데이터와 완전히 분리한다.

## 6. 운영 어드민

`/admin`은 기존 관리자 이메일 OTP와 2시간 서명 쿠키 흐름을 유지한다. 모든 관리자 API는 Supabase 사용자, 지정 관리자, 유효한 관리자 서명 세션을 다시 확인한다.

| 탭 | 역할 | 현재 상태 |
| --- | --- | --- |
| 인증 | 이미지 업로드, OCR, 검수, 수동 등록·수정·삭제 | 기존 서버 기능 연결 |
| 크루프로필 | 크루 등록·수정, 자기소개, 카카오 계정 연결, 운영자 확인 표시명 | 계정 승인·표시명 API 연결 |
| 응원글 | 최대 56개, 순서·활성 상태 관리 | UI 안내 중심. Supabase 서버 저장 미완료 |
| 배너 | 최대 10개, 이미지·대체텍스트·순서·게시 상태 관리 | UI 안내 중심. Supabase 서버 저장 미완료 |
| 댓글 | 댓글·답글·반응 공개·숨김·복구·삭제 | UI 안내 중심. Supabase 서버 저장 미완료 |

응원글·배너·댓글 탭은 실제 Supabase CRUD와 감사 로그가 연결되기 전까지 운영 완료로 보지 않는다. 브라우저 IndexedDB 데이터는 운영 데이터의 원본이 될 수 없다.

## 7. 시즌과 데이터 경계

현재 3기는 코드의 읽기 전용 스냅샷으로 `/3th`와 `/dashboard/report/3th`에 분리돼 있다. 실제 Supabase 운영 데이터도 다음 순서로 분리해야 한다.

1. DB와 private Storage를 각각 백업한다.
2. `seasons`, `season_participants`를 생성한다.
3. 기존 참가자·인증·배치·뱃지에 3기 시즌을 백필한다.
4. 백필 전후 참가자 수, 인증 수, 거리·시간 합계를 대조한다.
5. 3기 snapshot과 해시를 저장하고 `archived`로 전환한다.
6. PostgreSQL trigger에서 3기 수정·삭제를 차단한다.
7. 4기 `draft` 시즌에 더미데이터를 넣고 실제 데이터와 명시적으로 구분한다.
8. 정식 오픈 직전 4기 더미데이터만 제거하고 3기 기준값이 변하지 않았는지 확인한다.

관리자 Auth 계정의 삭제가 참가자·인증·선물상자에 cascade되지 않도록 시즌 데이터 소유권을 관리자 계정과 분리한다.

## 8. 새 TWTT Kakao 앱 설정 순서

실제 키 값은 채팅, 문서, 저장소, 화면 캡처에 남기지 않는다.

### 1단계: Kakao Developers 앱 생성

1. Kakao Developers에서 새 앱을 만든다.
2. 앱 이름은 실제 서비스와 일치하는 `TWTT` 계열 이름을 사용한다.
3. 사용자 제공 TWTT 로고를 앱 아이콘으로 등록한다.
4. 회사·운영 주체를 실제 정보로 입력한다.
5. 앱 기본 도메인과 Web 도메인에 다음 origin을 등록한다.

```text
https://xn--220bw61afob.kro.kr
```

6. REST API key를 확인한다. 이 값은 Supabase Kakao Provider의 Client ID로 사용한다.
7. Kakao Login Client Secret을 생성하고 활성화한다.
8. Kakao Login을 활성화한다.
9. 동의항목은 `profile_nickname`부터 최소 범위로 설정한다. 서비스에서 필요하지 않으면 이메일·프로필 이미지를 요청하지 않는다.

### 2단계: Kakao Redirect URI 등록

Supabase Dashboard의 Authentication → Sign In / Providers → Kakao에서 Callback URL을 복사한다. Kakao Developers의 해당 REST API key Redirect URI에 복사한 값을 정확히 등록한다.

```text
https://<실제-supabase-project-ref>.supabase.co/auth/v1/callback
```

Kakao Developers에 등록하는 URI는 TWTT의 `/api/auth/callback`이 아니라 Supabase Auth callback이다. `<실제-supabase-project-ref>`를 추측하지 말고 현재 Supabase 화면에서 복사한다.

### 3단계: Supabase Kakao Provider 설정

1. Authentication → Sign In / Providers → Kakao를 연다.
2. Kakao Enabled를 켠다.
3. Client ID에 Kakao REST API key를 입력한다.
4. Client Secret에 활성화한 Kakao Login Client Secret을 입력한다.
5. Kakao 이메일을 요청하지 않을 경우 `Allow users without an email`을 켠다.
6. 저장한다.

Kakao Client Secret은 Supabase Provider 비밀 설정에만 입력한다. 앱 코드나 Vercel의 `NEXT_PUBLIC_*` 환경변수에는 넣지 않는다.

### 4단계: Supabase URL Configuration

Authentication → URL Configuration에서 다음 값을 설정한다.

```text
Site URL
https://xn--220bw61afob.kro.kr

Redirect Allow List - production
https://xn--220bw61afob.kro.kr/api/auth/callback

Redirect Allow List - local development only
http://localhost:3000/api/auth/callback
```

production에는 미리보기 도메인 wildcard를 불필요하게 허용하지 않는다. Vercel Preview에서 로그인 검증이 꼭 필요하다면 해당 Preview URL을 임시로 정확히 등록하고 검증 후 제거한다.

### 5단계: Vercel 환경변수

Production 환경에 아래 이름을 설정한다. 값은 Vercel의 암호화된 환경변수 입력 화면에 직접 넣고 문서나 채팅에 붙여넣지 않는다.

| 이름 | 공개 여부 | 값의 형태와 위치 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 공개 가능 | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 공개 가능 | Supabase의 public anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 비밀 | Supabase service-role 또는 서버용 secret key |
| `NEXT_PUBLIC_SITE_URL` | 공개 | `https://xn--220bw61afob.kro.kr` |
| `SITE_URL` | 서버 설정 | `https://xn--220bw61afob.kro.kr` |
| `ADMIN_SESSION_SECRET` | 서버 비밀 | 관리자 쿠키 서명 전용 32바이트 이상 난수 |
| `DAILY_FORTUNE_SECRET` | 서버 비밀 | 오늘의 운세 HMAC 전용 32바이트 이상 난수 |
| `FOURTH_GIFT_BOX_LIVE` | 서버 설정 | 운영 점검 완료 뒤 `true`로 바꿀 때만 응원 상자 지급 허용 |
| `ADMIN_USER_ID` | 서버 설정 | 관리자 Supabase auth UUID |
| `GEMINI_API_KEY` | 서버 비밀 | 관리자 OCR에 사용하는 Gemini 프로젝트 키 |
| `GEMINI_OCR_MODEL` | 서버 설정 | 운영에 확정한 OCR 모델명 |
| `GEMINI_OCR_FALLBACK_MODEL` | 서버 설정 | 선택한 fallback 모델명 |

Kakao REST API key와 Client Secret은 Supabase Provider가 토큰 교환에 사용하므로 현재 구조에서는 Vercel에 중복 저장하지 않는다. Kakao unlink webhook을 추가하면 검증용 `KAKAO_APP_ID`, `KAKAO_ADMIN_KEY` 같은 서버 전용 설정이 별도로 필요하지만, webhook endpoint와 삭제 절차가 구현되기 전에는 형식만 정하고 실제 값을 문서에 남기지 않는다.

### 6단계: 스키마 적용과 배포

1. 운영 DB를 백업한다.
2. 저장소에 관리되는 migration 또는 검토된 SQL로 `participant_accounts.display_name_override`, `participant_accounts.season_key`, `daily_gift_claims.season_key`와 고유 제약을 적용한다. 기존 승인 행의 `season_key`는 자동 백필하지 않고 운영자가 4기 연결을 다시 확인해 저장한다.
3. 모든 public 테이블의 RLS와 grants를 확인한다.
4. 일반 `anon`·`authenticated`가 참가자·인증·계정 연결·선물상자를 직접 변경하지 못하는지 테스트한다.
5. Vercel Production 배포 후 custom domain의 `/`, `/3th`, `/4th`, `/admin`, `/dashboard/report/3th`를 확인한다.
6. 실제 Kakao 테스트 계정으로 로그인·취소·로그아웃·승인·해제·세션 만료를 테스트한다.

## 9. 비밀값 보관 위치

| 비밀값 | 저장 위치 | 금지 위치 |
| --- | --- | --- |
| Kakao Login Client Secret | Supabase Kakao Provider 설정 | Git, 문서, 채팅, `NEXT_PUBLIC_*` |
| Supabase service-role/secret key | Vercel 서버 환경변수 | 브라우저 번들, 로그, 응답, 문서 |
| 관리자 세션 비밀값 | Vercel `ADMIN_SESSION_SECRET` | Supabase public metadata, Git, 채팅 |
| 운세 HMAC 비밀값 | Vercel `DAILY_FORTUNE_SECRET` | 다른 비밀값과 재사용, Git, 채팅, `NEXT_PUBLIC_*` |
| Gemini API key | Vercel `GEMINI_API_KEY` | OCR 응답, 브라우저, 로그 |
| Kakao Admin key | unlink webhook 구현 시 Vercel 서버 환경변수 | Supabase public metadata, 브라우저, 문서 |

비밀값을 교체할 때는 새 값을 먼저 대상 콘솔에 설정하고 배포·로그인·OCR을 검증한 뒤 기존 값을 폐기한다. 보안사고가 의심되면 즉시 관련 키를 재발급하고 영향을 받은 세션과 endpoint를 제한한다.

## 10. 현재 구현 상태

### 구현됨

- `/`의 4기·카카오 로그인·3기 진입 동선
- `/3th` 읽기 전용 공통 대시보드 스냅샷
- `/4th` 더미데이터 미리보기, 멤버 영역, 오픈 전 팝업, `noindex`
- `/dashboard/report/3th`와 개인 상세 리포트
- 서버 `/api/auth/kakao`에서 시작하는 Supabase Kakao OAuth와 PKCE callback code 교환
- `/4th` 헤더의 compact 로그인·로그아웃과 공유 viewer 상태
- 로그인만 요구하는 KST 날짜별 오늘의 운세 모달
- 운영 origin 고정과 내부 `next` 경로 검증
- Kakao provider 판정
- `/admin` OTP와 인증·크루프로필·응원글·배너·댓글 탭
- 운영자 카카오 계정 승인·해제와 표시명 override
- Kakao 기본 닉네임과 운영자 표시명 override 구분
- 개인 표시명 변경 `PATCH`, 개인 인증 저장 `POST`, 개인 OCR `POST`의 `403` 차단
- 응원 상자의 Kakao provider·승인·KST 오늘 인증·4기 시즌 키·auth user 재검증
- 서버 난수와 DB 고유 제약을 이용한 응원 상자 중복 방지

### 아직 prelaunch 제약

- 실제 TWTT Kakao Developers 앱과 Supabase Provider의 운영 설정·실계정 검증이 완료되지 않음
- Supabase SSR 세션 갱신 Proxy는 구현됐으나 운영 세션 만료·쿠키 갱신 실계정 테스트가 남아 있음
- Kakao 외부 연결 해제 webhook과 계정 삭제·익명화 자동화가 없음
- `/4th` 댓글은 `previewOnly`; 공용 Supabase 댓글·답글·반응 저장이 없음
- `/admin` 응원글·배너·댓글 탭의 Supabase CRUD와 감사 로그가 없음
- `/4th` 광고·응원글·프로필·댓글이 운영 DB가 아닌 코드 더미/브라우저 로컬 데이터에 의존함
- 3기 Supabase 데이터의 `season_id` 백필·합계 대조·snapshot·DB 동결이 완료되지 않음
- 4기 정식 `seasons`, `season_participants`와 더미데이터 삭제 절차가 DB에 연결되지 않음
- in-memory rate limit을 서버리스 공유 저장소로 교체하지 않음
- 운영 연락처, Supabase 리전, 실제 백업 보존기간과 Storage 별도 백업이 확정되지 않음

위 항목이 완료될 때까지 다음 제한을 유지한다.

- `/4th`의 오픈 전 안내 팝업과 `오늘 그만보기`
- `/4th`의 검색엔진 `noindex`
- 댓글·답글·반응 입력 잠금
- 더미데이터임을 알 수 있는 사전 공개 상태
- 3기 화면과 데이터의 읽기 전용 처리

## 11. 운영 전 검증 게이트

### Kakao와 세션

- [ ] TWTT 전용 앱 이름·로고·운영 주체·도메인을 확인했다.
- [ ] Supabase 화면의 callback을 Kakao Redirect URI에 정확히 등록했다.
- [ ] Supabase Site URL과 production Redirect Allow List가 정확하다.
- [ ] 이메일 미수집 계정으로 로그인이 성공한다.
- [ ] 로그인 취소, callback 오류, 잘못된 `next`, 로그아웃, 만료 세션을 처리한다.
- [ ] 외부 Kakao 연결 해제 후 신규 권한이 즉시 차단되고 개인정보 삭제가 완료된다.

### 권한

- [ ] 비로그인 이용자는 공개 화면만 보고 응원 상자를 열 수 없다.
- [ ] 미승인·승인 해제 계정은 응원 상자를 사용할 수 없고 비Kakao 계정은 모든 개인 기능이 거부된다.
- [ ] 운영자 override 전에는 Kakao 이름, 적용 후에는 확인 표시명으로 댓글 작성자가 정해진다.
- [ ] Kakao 로그인 계정은 승인·인증 없이 오늘의 운세를 볼 수 있다.
- [ ] 개인 `/api/me` PATCH, 기록 POST, OCR POST는 실제 배포에서도 `403`이다.
- [ ] 비관리자와 만료된 관리자 세션은 모든 관리자 API에서 거부된다.
- [ ] 일반 Supabase `anon`·`authenticated` 직접 쓰기가 RLS/grants에서 거부된다.

### 데이터

- [ ] 3기 백업·백필·합계 대조·snapshot·동결이 완료됐다.
- [ ] 4기 더미데이터가 실제 데이터와 구분되고 제거 리허설을 마쳤다.
- [ ] 공용 댓글 저장과 관리자 콘텐츠 CRUD가 연결됐다.
- [ ] 응원 상자 동시 요청, 재요청, 계정 재연결, KST 자정 경계를 검증했다.
- [ ] DB와 private Storage를 각각 백업하고 복구를 시험했다.
- [ ] `DAILY_FORTUNE_SECRET`을 다른 비밀과 분리해 배포 Secret에 설정하고 저장소·브라우저 번들에서 누락됨을 확인했다.

### 화면과 성능

- [ ] 320, 360, 390, 412px 모바일에서 로그인·댓글·응원 상자·팝업이 잘린 부분 없이 동작한다.
- [ ] 768, 985, 1280, 1440px에서 대시보드·어드민 레이아웃을 확인했다.
- [ ] 저속 네트워크에서도 로고와 첫 화면이 빠르게 표시되고 로그인 상태 로딩이 명확하다.
- [ ] 200% 확대, 키보드, 스크린리더와 reduced-motion을 점검했다.

모든 게이트를 통과하기 전에는 4기 정식 오픈 상태로 전환하거나 prelaunch 제한을 제거하지 않는다.

## 12. 공식 참고자료

- [Supabase: Login with Kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase: Creating a client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Kakao Login 사전 설정](https://developers.kakao.com/docs/en/kakaologin/prerequisite)
- [Kakao Platform 보안 가이드](https://developers.kakao.com/docs/en/getting-started/security-guideline)
- [Kakao Login 연결 해제 Webhook](https://developers.kakao.com/docs/en/kakaologin/callback)
