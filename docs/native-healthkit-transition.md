# 네이티브 HealthKit 전환 계획

작성일: 2026-04-29

## 결정

오리완의 러닝 측정 경험은 웹 MVP가 아니라 iOS 네이티브 앱으로 전환한다. 목표는 NRC처럼 사용자가 오리완에서 직접 러닝을 시작하고, 백그라운드에서도 거리/시간/속도/페이스/경로를 측정하며, 가능한 경우 심박수와 케이던스까지 수치화해 Apple 건강 앱에 저장하는 것이다.

## 왜 네이티브인가

모바일 웹/PWA는 백그라운드 GPS, 잠금화면 운동 상태, HealthKit 읽기/쓰기, Apple Watch/외부 심박 센서 연동을 안정적으로 처리하기 어렵다. Apple 공식 API 기준으로 이 영역은 `HealthKit`, `CoreLocation`, `CoreMotion`을 사용하는 iOS 앱 책임이다.

## 1차 네이티브 범위

| 기능 | 구현 방식 | 상태 |
| --- | --- | --- |
| 러닝 시작/일시정지/재개/종료 | SwiftUI + `RunTracker` | 소스 골격 추가 |
| 백그라운드 위치 측정 | `CLLocationManager`, background location mode | 소스 골격 추가 |
| 거리/속도/페이스/고도 | GPS location stream 계산 | 소스 골격 추가 |
| HealthKit 운동 세션 | `HKWorkoutSession`, `HKLiveWorkoutBuilder` | 소스 골격 추가 |
| 건강앱 저장 | `HKWorkout`, `HKWorkoutRouteBuilder` | 소스 골격 추가 |
| 케이던스 | `CMPedometer.currentCadence` | 소스 골격 추가 |
| 심박수 | HealthKit live workout statistics | 소스 골격 추가 |
| 오리완 서버 동기화 | 완료 후 run payload 업로드 | 다음 작업 |
| AI 리커버리 | 기존 Next API 재사용 | 다음 작업 |

## 앱 구조

```text
apps/ios/Oriwan/
├── README.md
└── Oriwan/
    ├── OriwanApp.swift
    ├── ContentView.swift
    ├── Info.plist
    ├── Oriwan.entitlements
    └── Features/
        └── RunTracking/
            ├── HealthKitWorkoutStore.swift
            ├── RunMetrics.swift
            ├── RunState.swift
            └── RunTracker.swift
```

## 권한/Capabilities

Xcode target에 반드시 추가한다.

- HealthKit capability
- Background Modes > Location updates
- `NSHealthShareUsageDescription`
- `NSHealthUpdateUsageDescription`
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `NSMotionUsageDescription`

## 측정 정책

### 거리

GPS location 간 거리를 누적한다. 정확도가 낮은 샘플은 제외한다.

- `horizontalAccuracy <= 25m` 샘플만 사용
- 1m 미만 이동은 노이즈로 보고 누적하지 않음
- 추후 칼만 필터 또는 smoothing 적용 가능

### 시간

러닝 중 표시 시간은 pause 구간을 제외한 moving time으로 계산한다. 추후 서버 저장 시에는 `moving_time_s`와 `elapsed_time_s`를 분리해서 저장한다.

### 속도/페이스

- 현재 속도: `CLLocation.speed`
- 평균 페이스: `elapsedTime / distanceKm`
- 사용자 표시는 `min/km`

### 심박수

iPhone 자체에는 심박 센서가 없다. 심박수는 Apple Watch 또는 외부 심박 센서가 HealthKit workout session에 데이터를 제공할 때만 표시된다. 없는 경우 `--`로 표시한다.

### 케이던스

`CMPedometer.currentCadence`를 사용한다. 기기/권한/상황에 따라 제공되지 않을 수 있으므로 optional metric으로 둔다.

## 기존 웹앱과의 관계

Next.js 앱은 폐기하지 않고 다음 역할로 축소/재배치한다.

- 랜딩 페이지
- Supabase auth
- AI 리커버리 API
- 인증 사진 업로드
- 웹 대시보드/공유 화면

iOS 앱은 러닝 측정과 HealthKit 저장을 담당한다. 러닝 종료 후 normalized run payload를 Next/Supabase backend에 업로드하고, 기존 리커버리 API를 호출한다.

## 다음 구현 작업

1. Xcode project 생성 및 `apps/ios/Oriwan/Oriwan` 소스 target 연결
2. 실제 기기에서 HealthKit/location 권한 확인
3. pause/resume 구간을 제외한 moving time 계산 추가
4. route 저장 성공/실패 UI 추가
5. 완료된 run을 Supabase `runs` 테이블에 저장하는 API 추가
6. iOS 앱에서 Supabase 세션 또는 OAuth auth handoff 구현
7. 러닝 종료 후 AI 리커버리 화면을 네이티브로 만들지, 웹뷰/딥링크로 열지 결정

## 참고 공식 문서

- [HKWorkoutSession](https://developer.apple.com/documentation/healthkit/hkworkoutsession)
- [HKLiveWorkoutBuilder](https://developer.apple.com/documentation/HealthKit/HKLiveWorkoutBuilder)
- [Running workout sessions](https://developer.apple.com/documentation/healthkit/workouts_and_activity_rings/running_workout_sessions)
- [Core Location](https://developer.apple.com/documentation/corelocation)
- [Handling location updates in the background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [NSHealthShareUsageDescription](https://developer.apple.com/documentation/BundleResources/Information-Property-List/NSHealthShareUsageDescription)
