export type Hello2027Rate = {
  key: "weekly" | "monthly";
  label: string;
  value: number;
};

export type Hello2027Ad = {
  id: string;
  ownerName: string;
  title: string;
  description: string;
  alt: string;
  imageSrc: string;
  mediaId?: string;
};

export type Hello2027AuthorMode = "real" | "random" | "kakao";

export type Hello2027Reaction = {
  emoji: "👍" | "❤️" | "👏" | "🌱" | "🏃";
  count: number;
  reacted: boolean;
};

export type Hello2027ProfileIntroduction = {
  title: string;
  body: string;
};

export type Hello2027GuestbookReply = {
  id: string;
  author: string;
  authorMode: Hello2027AuthorMode;
  body: string;
  createdAt: string;
  reactions: readonly Hello2027Reaction[];
};

export type Hello2027GuestbookThread = {
  id: string;
  author: string;
  authorMode: Hello2027AuthorMode;
  body: string;
  createdAt: string;
  reactions: readonly Hello2027Reaction[];
  replies: readonly Hello2027GuestbookReply[];
};

export type Hello2027Participant = {
  id: string;
  fullName: string;
  pictogramIndex: number;
  completed: boolean;
  seasonCompletionRate: number;
  distanceKm: number | null;
  durationMinutes: number | null;
  product: {
    name: string;
    description: string;
  };
};

export type Hello2027Snapshot = {
  seasonName: string;
  versionName: string;
  referenceDateLabel: string;
  referenceDateShort: string;
  dayNumber: number;
  totalDays: number;
  daysUntil2027: number;
  completedToday: number;
  participantCount: number;
  rates: readonly Hello2027Rate[];
  ads: readonly Hello2027Ad[];
  encouragements: readonly string[];
  guestbook: readonly Hello2027GuestbookThread[];
  participants: readonly Hello2027Participant[];
};

// 가나다순으로 고정한 로컬 PoC 전용 가상 참가자입니다.
const participants: readonly Hello2027Participant[] = [
  { id: "hello-2027-14", fullName: "강태윤", pictogramIndex: 0, completed: true, seasonCompletionRate: 78, distanceKm: 3.76, durationMinutes: 29, product: { name: "태윤 레더", description: "손에 익을수록 멋스러운 작은 가죽 물건" } },
  { id: "hello-2027-16", fullName: "권민준", pictogramIndex: 1, completed: false, seasonCompletionRate: 64, distanceKm: null, durationMinutes: null, product: { name: "민준 스튜디오", description: "브랜드의 첫인상을 만드는 작은 디자인" } },
  { id: "hello-2027-01", fullName: "김가람", pictogramIndex: 2, completed: true, seasonCompletionRate: 84, distanceKm: 3.24, durationMinutes: 22, product: { name: "MORNING LOOP", description: "달린 뒤의 시간을 위한 작은 커피 도구" } },
  { id: "hello-2027-18", fullName: "남도현", pictogramIndex: 3, completed: true, seasonCompletionRate: 73, distanceKm: 3.19, durationMinutes: 26, product: { name: "도현의 공구함", description: "작은 수리를 돕는 생활 도구 큐레이션" } },
  { id: "hello-2027-13", fullName: "문서아", pictogramIndex: 4, completed: false, seasonCompletionRate: 61, distanceKm: null, durationMinutes: null, product: { name: "서아의 식탁", description: "계절 재료로 만든 한 끼의 레시피" } },
  { id: "hello-2027-03", fullName: "박도윤", pictogramIndex: 5, completed: false, seasonCompletionRate: 57, distanceKm: null, durationMinutes: null, product: { name: "도윤 목공소", description: "오래 곁에 두는 손바닥 크기의 나무 소품" } },
  { id: "hello-2027-11", fullName: "배유진", pictogramIndex: 6, completed: true, seasonCompletionRate: 88, distanceKm: 4.31, durationMinutes: 35, product: { name: "유진 세라믹", description: "천천히 마시는 아침을 위한 작은 잔" } },
  { id: "hello-2027-17", fullName: "백하은", pictogramIndex: 7, completed: true, seasonCompletionRate: 91, distanceKm: 4.58, durationMinutes: 34, product: { name: "하은 티룸", description: "달린 몸을 천천히 깨우는 블렌딩 티" } },
  { id: "hello-2027-15", fullName: "서예린", pictogramIndex: 8, completed: true, seasonCompletionRate: 82, distanceKm: 3.34, durationMinutes: 25, product: { name: "예린의 향기", description: "아침 공기를 닮은 차분한 룸 스프레이" } },
  { id: "hello-2027-08", fullName: "송민재", pictogramIndex: 9, completed: true, seasonCompletionRate: 93, distanceKm: 5.04, durationMinutes: 39, product: { name: "MORNING BEAN", description: "가벼운 산미로 시작하는 오늘의 원두" } },
  { id: "hello-2027-10", fullName: "오준서", pictogramIndex: 10, completed: false, seasonCompletionRate: 66, distanceKm: null, durationMinutes: null, product: { name: "준서 러닝랩", description: "몸에 맞는 움직임을 찾는 러닝 클래스" } },
  { id: "hello-2027-06", fullName: "윤지호", pictogramIndex: 11, completed: false, seasonCompletionRate: 59, distanceKm: null, durationMinutes: null, product: { name: "지호의 음악상점", description: "산뜻한 아침을 위한 짧은 플레이리스트" } },
  { id: "hello-2027-02", fullName: "이나래", pictogramIndex: 12, completed: true, seasonCompletionRate: 86, distanceKm: 3.51, durationMinutes: 26, product: { name: "나래의 작은 화원", description: "하루를 환하게 여는 계절 꽃 한 다발" } },
  { id: "hello-2027-09", fullName: "임채원", pictogramIndex: 13, completed: true, seasonCompletionRate: 80, distanceKm: 3.22, durationMinutes: 27, product: { name: "채원의 그림가게", description: "일상의 장면을 담은 포근한 엽서" } },
  { id: "hello-2027-19", fullName: "장수빈", pictogramIndex: 14, completed: false, seasonCompletionRate: 63, distanceKm: null, durationMinutes: null, product: { name: "수빈 북클럽", description: "한 달에 한 권, 함께 읽는 느린 모임" } },
  { id: "hello-2027-05", fullName: "정하람", pictogramIndex: 15, completed: true, seasonCompletionRate: 76, distanceKm: 3.1, durationMinutes: 26, product: { name: "하람 베이크", description: "러닝 뒤 나누기 좋은 담백한 구움과자" } },
  { id: "hello-2027-12", fullName: "조현우", pictogramIndex: 16, completed: true, seasonCompletionRate: 71, distanceKm: 3.0, durationMinutes: 27, product: { name: "현우 사진관", description: "평범한 하루를 오래 남기는 프로필 사진" } },
  { id: "hello-2027-04", fullName: "최서윤", pictogramIndex: 17, completed: true, seasonCompletionRate: 89, distanceKm: 4.02, durationMinutes: 34, product: { name: "SLOW PAGE", description: "아침의 생각을 붙잡는 작은 기록 노트" } },
  { id: "hello-2027-07", fullName: "한소율", pictogramIndex: 18, completed: true, seasonCompletionRate: 83, distanceKm: 3.68, durationMinutes: 27, product: { name: "소율 패브릭", description: "포근한 색을 담은 러닝 손수건" } },
  { id: "hello-2027-20", fullName: "홍재윤", pictogramIndex: 19, completed: true, seasonCompletionRate: 74, distanceKm: 3.87, durationMinutes: 30, product: { name: "재윤 클린업", description: "가볍게 시작하는 일상 정리 서비스" } },
];

export const hello2027Snapshot: Hello2027Snapshot = {
  seasonName: "TWTT 4th",
  versionName: "Hello 2027",
  referenceDateLabel: "2026. 10. 16. 금요일",
  referenceDateShort: "10.16 금",
  dayNumber: 24,
  totalDays: 100,
  daysUntil2027: 77,
  completedToday: 14,
  participantCount: 20,
  rates: [
    { key: "weekly", label: "이번 주", value: 68 },
    { key: "monthly", label: "이번 달", value: 71 },
  ],
  ads: [
    {
      id: "ad-morning-loop",
      ownerName: "김가람",
      title: "MORNING LOOP",
      description: "달린 뒤의 시간을 위한 작은 커피 도구",
      alt: "해 뜨는 강변 벤치 위 러닝 재킷과 커피 도구",
      imageSrc: "/images/poc/hello-2027/ads/morning-loop.webp",
    },
    {
      id: "ad-haram-bake",
      ownerName: "정하람",
      title: "하람 베이크",
      description: "러닝 뒤 나누기 좋은 담백한 구움과자",
      alt: "아침 강변 테이블 위 갓 구운 마들렌과 빵",
      imageSrc: "/images/poc/hello-2027/ads/haram-bake.webp",
    },
    {
      id: "ad-slow-page",
      ownerName: "최서윤",
      title: "SLOW PAGE",
      description: "아침의 생각을 붙잡는 작은 기록 노트",
      alt: "햇살 드는 강변 테이블 위 빈 노트와 러닝 모자",
      imageSrc: "/images/poc/hello-2027/ads/slow-page.webp",
    },
  ],
  encouragements: [
    "오늘의 한 걸음이 내일의 아침을 조금 더 가볍게 만들어요.",
    "빠르지 않아도 괜찮아요. 오늘도 함께 출발했다는 게 중요해요.",
    "서로 다른 속도로, 같은 아침을 달리고 있어요.",
    "무리하지 말고 기분 좋은 여운이 남는 만큼만 달려요.",
    "한 사람의 출발이 우리 모두의 아침을 깨워요.",
    "아침 3km는 기록보다 나를 깨우는 작은 약속이에요.",
    "문을 나서는 순간, 오늘의 가장 어려운 일은 이미 해냈어요.",
    "좋은 달리기는 내일도 달릴 마음을 남겨두는 달리기예요.",
    "오늘의 목표는 빠르게가 아니라 가볍게 돌아오는 거예요.",
    "숨이 차오르면 속도를 낮춰도 괜찮아요. 우리는 오래 함께 달릴 거니까요.",
    "어제보다 조금 느려도, 오늘의 출발은 온전히 오늘의 것이에요.",
    "먼저 달린 사람의 아침이 아직 준비 중인 사람을 조용히 응원해요.",
    "딱 3km, 하루를 바꾸기에는 충분한 거리예요.",
    "몸의 소리를 들으며 달리는 것도 멋진 인증이에요.",
    "오늘도 스무 개의 서로 다른 리듬이 한 방향으로 흐르고 있어요.",
    "완벽한 컨디션을 기다리지 않아도 작은 시작은 가능해요.",
    "가벼운 발걸음 하나가 하루의 분위기를 바꿔놓기도 해요.",
    "아침 공기를 먼저 만난 오늘의 나를 다정하게 기억해요.",
    "각자의 길에서 출발해도 우리는 같은 아침에 도착해요.",
    "달리기 좋은 날도, 천천히 가야 하는 날도 모두 내 루틴이에요.",
    "호흡이 편안한 속도가 오늘의 가장 좋은 속도예요.",
    "작은 반복은 눈에 띄지 않게 단단한 힘이 되어줘요.",
    "오늘의 3km가 2027년의 나에게 보내는 짧은 편지예요.",
    "같이한다는 건 같은 속도가 아니라 서로의 출발을 알아주는 일이에요.",
    "새벽의 망설임보다 운동화 끈을 한 번 먼저 묶어봐요.",
    "달리고 돌아온 자리에는 조금 더 맑은 하루가 기다리고 있어요.",
    "잘 달린 아침보다 편안하게 마친 아침을 오래 기억해요.",
    "기록은 숫자로 남고, 루틴은 나를 바꿔요.",
    "오늘의 인증 한 칸이 우리 모두의 풍경을 채워가요.",
    "힘든 날엔 보폭을 줄이고, 함께하는 마음은 그대로 두어요.",
    "출발선은 매일 새로 생기고, 우리는 매일 다시 선택할 수 있어요.",
    "세상의 속도보다 내 호흡에 맞춰 달려요.",
    "아침 햇살보다 조금 먼저 움직인 나를 칭찬해요.",
    "꾸준함은 거창한 결심보다 오늘의 3km에 가까워요.",
    "달린 뒤 기분 좋은 힘이 남아 있다면 오늘은 충분해요.",
    "한 번의 빠른 기록보다 백 번의 편안한 출발을 응원해요.",
    "오늘도 누군가 같은 시간에 운동화를 신고 있다는 걸 기억해요.",
    "비교하지 않는 아침은 생각보다 훨씬 가볍게 흘러가요.",
    "몸이 보내는 작은 신호를 존중하는 것도 우리 약속이에요.",
    "천천히 달려도 아침은 같은 방향으로 열리고 있어요.",
    "오늘의 리듬을 찾았다면 그것으로 멋진 완주예요.",
    "함께 채운 인증률은 순위가 아니라 서로의 안부예요.",
    "상쾌함을 데려오고 피로는 남기지 않는 만큼 달려요.",
    "매일 같은 길도 오늘의 마음에 따라 새로운 풍경이 돼요.",
    "내일의 부담을 만들지 않는 오늘의 달리기를 선택해요.",
    "세 걸음만 가보자던 마음이 어느새 3km를 데려와요.",
    "조금 늦은 출발이어도 포기보다 훨씬 앞에 있어요.",
    "오늘의 나는 어제의 나와 경쟁하지 않아도 충분해요.",
    "서로의 인증을 보는 순간, 혼자 달린 길도 함께한 길이 돼요.",
    "숨을 고르고 어깨의 힘을 빼면 길도 조금 부드러워져요.",
    "루틴은 나를 몰아붙이는 규칙이 아니라 나를 돌보는 방식이에요.",
    "한 사람의 꾸준함이 크루 전체에 잔잔한 용기를 건네요.",
    "2027년을 향해 서두르지 말고 오늘 한 칸만 채워요.",
    "달리기 전의 나와 달린 뒤의 나 사이에는 작은 자신감이 있어요.",
    "좋은 아침은 멀리 있지 않아요. 운동화 바로 앞에서 시작해요.",
    "오늘도 안전하게, 편안하게, 그리고 함께 돌아와요.",
  ],
  guestbook: [
    {
      id: "guestbook-1",
      author: "새벽다람쥐",
      authorMode: "random",
      body: "오늘은 출발할 때 조금 무거웠는데, 다녀오고 나니 하루가 훨씬 가벼워졌어요.",
      createdAt: "2026-10-16T07:42:00+09:00",
      reactions: [
        { emoji: "👍", count: 4, reacted: false },
        { emoji: "❤️", count: 2, reacted: false },
      ],
      replies: [
        {
          id: "guestbook-1-reply-1",
          author: "문서아",
          authorMode: "real",
          body: "저도 그랬어요. 내일 아침에도 천천히 같이 나가요!",
          createdAt: "2026-10-16T08:06:00+09:00",
          reactions: [{ emoji: "👏", count: 1, reacted: false }],
        },
      ],
    },
    {
      id: "guestbook-2",
      author: "저녁반딧불",
      authorMode: "random",
      body: "주말 인증 시간도 평일과 동일한지 궁금해요.",
      createdAt: "2026-10-15T21:18:00+09:00",
      reactions: [{ emoji: "🌱", count: 3, reacted: false }],
      replies: [],
    },
  ],
  participants,
};
