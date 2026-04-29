# 오늘의 러닝 측정/동기화 기획안

작성일: 2026-04-29

## 1. 목표

오리완의 `오늘의 러닝 동기화` 경험을 단순 데이터 불러오기에서 `러닝 시작 -> 기록 측정 -> 인증 -> AI 리커버리` 흐름으로 확장한다.

핵심 사용자는 두 그룹으로 나눈다.

| 사용자 | 목표 경험 | 우선 해법 |
| --- | --- | --- |
| Apple Watch/Garmin 등 웨어러블 보유자 | 기존 기기로 기록한 러닝을 오리완에서 자동 인증 | Strava 연동 중심, Garmin은 승인형 API 검토 |
| 웨어러블 미보유자 | 휴대폰만 들고 러닝을 기록하고 인증 | Strava 앱 설치/가입/기록 후 오리완 동기화 |

## 2. 중요한 기술 판단

### 웹앱만으로 NRC처럼 완전한 백그라운드 러닝 기록은 어렵다

현재 오리완은 Next.js 웹앱이다. 모바일 브라우저/PWA는 화면이 꺼지거나 앱이 백그라운드로 내려가면 GPS 추적, 타이머, 센서 접근이 OS 정책에 의해 중단되거나 불안정해질 수 있다. 특히 심박수와 케이던스는 휴대폰 웹만으로 안정 측정하기 어렵고, 웨어러블 또는 Strava/Garmin/Apple Health 같은 네이티브 데이터 소스가 필요하다.

따라서 제품 방향은 아래처럼 나눈다.

| 단계 | 방향 | 가능 범위 |
| --- | --- | --- |
| MVP | Strava 앱/기기에서 기록한 오늘 러닝을 오리완이 동기화 | 거리, 시간, 속도, 고도, 일부 심박/케이던스 |
| V1 | 오리완에서 `러닝 시작`을 누르면 Strava 기록 가이드/앱 이동 제공 | 휴대폰 사용자의 기록 진입 장벽 축소 |
| V2 | 오리완 네이티브 앱 또는 React Native/Expo 앱에서 직접 기록 | 백그라운드 GPS, 타이머, HealthKit/Google Fit 연동 |
| V3 | Garmin/Apple Health 직접 연동 | 파트너 승인, 네이티브 권한, 개인정보 심사 필요 |

## 3. 플랫폼별 현실성

### Strava

현재 코드에 이미 Strava OAuth와 오늘 활동 조회가 구현되어 있다.

- 현재 scope: `read,activity:read_all`
- 현재 조회 데이터: 거리, 움직인 시간, elapsed time, 평균/최대 속도, 케이던스, 심박수, 고도, 칼로리
- 공식 문서상 활동 생성/업로드에는 `activity:write` 권한이 필요하다.
- Strava는 활동 파일 업로드도 지원하며 GPX/TCX/FIT 파일을 받을 수 있다.
- 휴대폰만 있는 사용자는 Strava iOS/Android 앱에서 직접 기록할 수 있다.

제품 판단:

- 가장 빠른 MVP는 `Strava 기록 후 오리완에서 동기화`다.
- `오리완에서 러닝 시작` 버튼은 초기에는 자체 측정보다 `Strava 앱으로 기록 시작 안내`가 안전하다.
- 추후 오리완 자체 GPS 기록을 만들 경우, 기록 결과를 GPX/TCX/FIT로 만들어 Strava 업로드하거나 오리완 DB에 자체 저장할 수 있다.

참고:

- [Strava API Reference](https://developers.strava.com/docs/reference/)
- [Strava Uploads](https://developers.strava.com/docs/uploads)
- [How to get your Activities to Strava](https://support.strava.com/hc/en-us/articles/223297187-How-to-get-your-Activities-to-Strava)

### NRC

Nike Run Club은 일반적인 서드파티 공개 API를 전제로 하기 어렵다. 따라서 오리완의 인증 데이터 소스로 NRC를 직접 붙이는 것은 MVP 범위에서 제외한다.

제품 판단:

- NRC 사용자는 Strava/Apple Health 등으로 활동을 내보내거나 동기화 가능한 경로가 있을 때만 간접 지원한다.
- 앱 내 문구는 `NRC처럼 시작`이라는 경험 목표로 쓰되, 기술 구현은 Strava/HealthKit 중심으로 잡는다.

### Garmin

Garmin Activity API는 상세 활동 데이터와 FIT 파일 접근을 제공하지만, Garmin Connect Developer Program 승인 및 상업 조건 검토가 필요하다.

제품 판단:

- MVP에서는 Garmin 직접 연동보다 `Garmin -> Strava 자동 동기화 -> 오리완 Strava 조회` 경로를 추천한다.
- Garmin 직접 연동은 MAU/수요가 확인된 뒤 신청/심사/라이선스 검토를 진행한다.

참고:

- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/)

### Apple Watch / Apple Health

Apple Watch 심박, GPS route, workout 데이터는 HealthKit/Workout APIs로 다루는 영역이다. 이는 웹앱이 아니라 iOS 네이티브 앱이 필요하다.

제품 판단:

- Apple Watch 직접 측정/HealthKit 읽기는 V2 이후 네이티브 앱 범위로 둔다.
- 현재 웹앱 MVP에서는 Apple Watch 사용자가 Strava에 자동 업로드한 활동을 오리완에서 동기화하는 흐름이 가장 현실적이다.

참고:

- [Apple HealthKit Workout Route](https://developer.apple.com/documentation/healthkit/creating-a-workout-route)

## 4. 사용자 플로우

### MVP: Strava 기반 인증 플로우

1. 대시보드에서 `오늘의 러닝 시작/동기화` 버튼 클릭
2. Strava 미연동이면 `Strava 연결하기` 화면 표시
3. 연결 완료 후 사용자가 Strava 앱으로 러닝 기록
4. 러닝 종료 후 오리완으로 돌아와 `오늘 러닝 불러오기` 클릭
5. 오리완이 Strava API로 오늘의 최신 Run/VirtualRun 조회
6. 거리, 시간, 페이스, 속도, 심박, 케이던스, 고도, 칼로리 표시
7. AI 리커버리 미션 생성
8. 사진 인증 후 오늘 완료 처리

### 휴대폰만 있는 사용자 온보딩

1. `애플워치가 없어도 괜찮아요` 안내
2. Strava 설치/가입 CTA 제공
3. Strava에서 휴대폰 GPS로 러닝 기록하는 방법 3단계 안내
4. 오리완으로 돌아와 동기화

### V2: 오리완 자체 기록 플로우

1. `오리완으로 직접 기록` 클릭
2. 위치 권한 요청
3. 시작/일시정지/종료
4. 거리, 시간, 현재 페이스, 평균 페이스 측정
5. 백그라운드 안정 기록을 위해 네이티브 앱 사용
6. 종료 후 자체 기록 저장 및 선택적으로 Strava 업로드

## 5. 측정 데이터 정의

| 데이터 | Strava 조회 | 휴대폰 웹 직접 측정 | 네이티브 앱 직접 측정 | 비고 |
| --- | --- | --- | --- | --- |
| 거리 | 가능 | 제한적 가능 | 가능 | 웹은 백그라운드 불안정 |
| 시간 | 가능 | 가능 | 가능 | moving/elapsed 구분 필요 |
| 평균 속도 | 가능 | 계산 가능 | 계산 가능 | m/s -> min/km 변환 |
| 페이스 | 계산 가능 | 계산 가능 | 계산 가능 | 사용자에게는 min/km 표시 |
| 심박수 | 기기 기록 시 가능 | 불가에 가까움 | HealthKit/웨어러블 필요 | 휴대폰 단독 불가 |
| 케이던스 | 기기/Strava 제공 시 가능 | 불안정 | 센서/웨어러블 필요 | Strava detail에서 없을 수 있음 |
| 고도 | 가능 | 제한적 가능 | 가능 | GPS 고도 정확도 낮음 |
| 칼로리 | 가능 | 추정 가능 | 추정 가능 | 프로필 정보 필요 |

## 6. 화면/UX 변경안

### 대시보드 CTA 문구

현재 버튼의 의미가 `동기화`에 치우쳐 있으므로 다음처럼 상태별로 나눈다.

| 상태 | CTA | 보조 문구 |
| --- | --- | --- |
| Strava 미연동 | `Strava 연결하고 러닝 시작하기` | `애플워치가 없어도 휴대폰 Strava 앱으로 기록할 수 있어요` |
| Strava 연동 완료, 오늘 기록 없음 | `러닝 기록하고 불러오기` | `Strava 앱에서 기록한 뒤 다시 눌러주세요` |
| 오늘 기록 있음 | `오늘 러닝 불러오기` | `최신 러닝 데이터를 분석해 리커버리 미션을 만들어요` |
| 완료됨 | `오늘의 오리완 완료` | `충분한 휴식을 취하세요` |

### 러닝 시작 안내 모달

버튼 클릭 시 바로 API 조회만 하지 않고, 아래 선택지를 제공한다.

1. `Strava 앱으로 기록하기`
2. `이미 기록했어요. 오늘 러닝 불러오기`
3. `연동 방법 보기`

## 7. API/데이터 설계

### 현재 유지

- `GET /api/auth/strava/status`
- `GET /api/auth/strava`
- `GET /api/strava/activities`
- `POST /api/ai/recovery-tip`

### MVP 추가 제안

- `GET /api/strava/latest-run?date=YYYY-MM-DD`
  - 오늘 러닝 조회 전용 API로 이름을 명확화
  - 중복 활동이 있으면 최신 1개 또는 목록 반환
- `POST /api/runs/import-strava`
  - Strava activity id 기준으로 내부 DB에 저장
  - 같은 activity id 중복 저장 방지
- `POST /api/completions`
  - 현재 완료 처리와 연계

### V2 추가 제안

- `POST /api/runs`
  - 자체 기록 저장
- `POST /api/runs/:id/samples`
  - GPS/속도 샘플 저장
- `POST /api/strava/uploads`
  - GPX/TCX/FIT 업로드

## 8. DB 설계 초안

```sql
create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('strava', 'garmin', 'apple_health', 'oriwan')),
  external_id text,
  name text,
  started_at timestamptz not null,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  average_speed_mps numeric,
  max_speed_mps numeric,
  average_pace_s_per_km numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  average_cadence numeric,
  elevation_gain_m numeric,
  calories numeric,
  raw jsonb,
  created_at timestamptz default now(),
  unique (user_id, source, external_id)
);

create table run_samples (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  sampled_at timestamptz not null,
  latitude double precision,
  longitude double precision,
  altitude_m numeric,
  speed_mps numeric,
  heart_rate numeric,
  cadence numeric
);
```

## 9. 개발 로드맵

### Sprint 1: Strava MVP 정리

- CTA를 `러닝 시작/불러오기` 흐름으로 변경
- Strava 미연동/연동/기록 없음/기록 있음 상태별 안내 추가
- 휴대폰만 있는 사용자용 Strava 가입/기록 가이드 추가
- Strava activity id를 내부 `runs` 테이블에 저장
- 완료 기록과 run id 연결

### Sprint 2: 데이터 신뢰도 강화

- 오늘 활동 여러 개일 때 선택 UI 제공
- `average_cadence`, `average_heartrate`가 없을 때 왜 없는지 안내
- Strava webhook 검토로 자동 동기화 준비
- API rate limit 대응 캐시 추가

### Sprint 3: 직접 기록 실험

- 웹 foreground GPS 기록 프로토타입
- 백그라운드 불안정성 안내
- 자체 기록 저장 스키마 확정
- GPX export 생성

### Sprint 4: 네이티브 앱 검토

- Expo/React Native 또는 Swift/Kotlin 방향 결정
- iOS HealthKit, Android Health Connect 조사
- 백그라운드 location 권한 UX 설계
- App Store/Play Store 개인정보 고지 준비

## 10. 바로 구현할 다음 작업

1. 대시보드 버튼을 `오늘의 러닝 시작`으로 바꾸고 상태별 안내 모달을 추가한다.
2. Strava 미연동 사용자를 위해 `휴대폰만으로 기록하기` 안내 UI를 만든다.
3. `/api/strava/activities` 응답을 내부 `Run` 모델에 맞게 정규화한다.
4. Supabase에 `runs` 테이블을 추가하고 Strava activity id 중복 저장을 막는다.
5. 리커버리 페이지는 `sessionStorage` 대신 저장된 `run_id` 기반으로 열도록 바꾼다.

## 11. 결론

오리완이 당장 안정적으로 제공해야 하는 경험은 `자체 백그라운드 측정`이 아니라 `Strava를 중심으로 한 믿을 수 있는 인증/동기화`다. NRC 같은 시작 경험은 UX로 흡수하되, 백그라운드 GPS와 심박/케이던스 직접 측정은 네이티브 앱 단계에서 추진하는 것이 안전하다.
