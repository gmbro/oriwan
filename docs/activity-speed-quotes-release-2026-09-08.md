# 내 활동 속도·기록 정리·명언 교체

## 범위

- 개인 기능 4종과 내 활동의 첫 표시 지연 개선.
- 수정된 댓글은 수정 시각 하나만 표시, 작성란 레이블은 `내용`.
- 내 활동 기록: `기록` 제목, 공식 요약 3개, 날짜별 캘린더만 유지.
- 그래프 선택기·누적 그래프/표·하단 총 인증일·제출 목록·캘린더 상단 범례 제거.
- 캘린더 날짜별 확인 상태와 승인 전 OCR 거리·시간은 유지. 공개 멤버 프로필의 총 인증일은 유지.
- 4기 기존 응원글 12개를 고전 명언 50개로 교체. 관리자 편집 기능 유지.
- 추가 요청: 배너 섹션 제목을 `내던지는 명언 50선`으로 변경.

## 지연 원인과 수정

1. 내 활동 부모 화면이 클릭 후 동적 import되어 홈 메뉴에도 청크 왕복이 필요했다. 가벼운 홈/프로필/캘린더 UI를 미리 준비하고 업로드·개인 기능은 분할 로딩을 유지한다.
2. 개인 기능 영역이 미리 받은 문의/타임머신/응원 상자 상태를 새 내 활동 팝업으로 전달하지 않아 GET을 다시 실행했다. 현재 로그인 멤버에 묶인 메모리 캐시와 상태를 그대로 전달한다.
3. 팝업을 열 때마다 전체 개인 기록을 다시 조회했다. 로그인 후 미리 읽고 30초 동안 재사용하며 기록 변경 알림에서 무효화한다. 메뉴·팝업은 서버 응답을 기다리지 않는다.
4. 요청 캐시는 계정별로 분리한다. 실패는 재시도할 수 있고, 만료 시 갱신하며, 오래된 응답은 새 응답을 덮어쓰지 않는다. 닫힌 타임머신의 주기적 조회는 중단한다.
5. raw import만 미리 실행하면 React.lazy의 첫 렌더에서 짧은 fallback이 남는다. 해결된 컴포넌트 참조도 로그인 후 보관하여 첫 클릭에 바로 렌더링한다. API가 준비된 경우 최초 상태도 넘겨 effect 이후까지 폼을 기다리지 않는다.

API 응답, 새로 생성하는 운세 및 OCR 처리까지 0초라고 보장하지 않는다. 처음 표시하는 창과 메뉴에서 네트워크 대기를 제거하는 변경이다.

## 명언 출처

50개 원문 대조 기록: `lib/encouragement-quotes.json`. 한국어는 직접 번역·축약했으며 현대 한국어 번역본 문구를 복제하지 않았다. 저자별 10개를 교차 배치하고 배너에는 저자 이름을 함께 표시한다.

- 노자: [도덕경, James Legge 번역](https://www.gutenberg.org/cache/epub/216/pg216-images.html), 8·23·33·36·44·63·64장.
- 공자: [논어](https://classics.mit.edu/Confucius/analects.1.1.html), 학이·위정·이인 편.
- 에픽테토스: [엥케이리디온, Elizabeth Carter 번역](https://classics.mit.edu/Epictetus/epicench.html), 1·5·8·10·12·13·17·20·29·30절.
- 마르쿠스 아우렐리우스: [명상록 4권](https://classics.mit.edu/Antoninus/meditations.4.four.html), [5권](https://classics.mit.edu/Antoninus/meditations.5.five.html), George Long 번역.
- 세네카: [편지 1](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_1), [6](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_6), [7](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_7), [13](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_13), [20](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_20), Richard M. Gummere 번역.

## 데이터 변경 안전장치

`scripts/replace-encouragement-quotes.mjs`는 명시적인 `TWTT_QUOTES_MODE`가 없으면 실행하지 않는다. 먼저 audit로 설정된 운영자의 4기 응원글만 읽고 스냅샷 해시를 확인한다. apply는 일치하는 해시와 비공개 백업이 모두 있어야 실행한다. 관리자 키는 빌드 환경 안에서만 사용하며 출력하거나 로컬로 내보내지 않는다.

사전 확인: 12행, 활성 12행. SHA-256 `ef8165f2dfb1c391715268b90ffa6aef6f6e2ea74cf46bee704f3644322eb0f0`.

기존 12개 ID를 재사용하고 38개를 추가하는 한 번의 upsert로 교체한다. 게시글·댓글·회원·인증 데이터는 수정하지 않는다. 원본 메시지는 비공개 백업으로 복구 가능하다. 이후 일반 배포에서는 교체 스크립트를 실행하지 않아 운영자 편집이 보존된다.

## 검증

- 자동 테스트 109개 통과, 변경 파일 ESLint 및 TypeScript 통과.
- 로컬 390px: 가로 넘침 없음, 홈 메뉴 3개 한 줄, 기록 요약 1회, 승인 전 예시 5.2km/32분 캘린더 표시.
- 실제 회원 글/인증 데이터에 시험 수정·삭제·업로드를 실행하지 않는다.
- 실제 휴대폰 성능 수치로 오해하지 않도록 브라우저 뷰포트 검증과 물리 기기 검증을 구분한다.

운영 배포 및 공개 API 검증 결과는 아래에 기록한다.

- 2026-09-08 16:39 KST: 명언 교체 빌드 `dpl_2QmKGff6PUQzDp4Htgx7TSGz2m1V` 완료. 12개 → 50개 활성 문구 DB 검증 PASS.
- 비공개 원본 백업: `member-run-uploads/release-backups/2026-09-08-classics-50-788e4011-90e7-4647-9316-a1727d0ed7ec.json`.
- 이 빌드는 운영 도메인으로 승격하지 않는다. 인증 업로드 후 캐시 무효화 보완까지 포함한 후속 빌드를 최종 승격한다.

### 최종 운영 배포

- 최종: `dpl_4bFB2FThFitDUWTVYLqvUAzHS1yC`, `https://twtt-gf6pznuz8-gmbros-projects.vercel.app` → `https://xn--220bw61afob.kro.kr` 승격 완료.
- 직전 운영 UI: `dpl_EXwKefZnSHCeHCtJoXp58pfcvNqv` (제목 변경/최초 fallback 제거 이전). 앱 롤백은 명언 DB를 되돌리지 않는다.
- 공개 콘텐츠 API HTTP 200, 활성 명언 50개, 중복 0, source supabase 확인.
- 로그인 운영 화면: `내던지는 명언 50선` 제목 확인. 첫 클릭 직후 운세·문의·타임머신 폼에 `준비 중` 문구 없이 표시. 팝업 닫기 및 내 활동 재진입 정상.
- 기존에 사용자가 수정한 답글의 `<time>`이 수정 시각 하나뿐인 것 확인. 테스트 목적으로 글을 수정하지 않았다.
- 운영 390px: 메뉴 3개 같은 y좌표, 각 110px, 가로 넘침 없음. 기록 총 인증일 1회, 범례·그래프 선택기 없음. 콘솔 오류 없음.
- 응원 상자는 현재 계정의 오늘 인증이 없어 잠금 상태였다. 자격 우회·인증 생성·실제 상자 수령은 하지 않았고 상태 전달 경로를 코드로 검증했다.
- 별도 물리 휴대폰이나 계측된 응답 시간 보장은 하지 않는다. API가 아직 도착하지 않은 첫 로드·네트워크 장애 시에는 상태 확인이 필요하다.
