const LEGACY_SAMPLE_IMAGE = "/images/poc/hello-2027/hello-2027-riverside.webp";

type DatabaseBannerFields = {
  id: string;
  owner_name: string;
  title: string;
  description: string;
  alt_text: string;
  image_url: string;
  mobile_focus: "left" | "center" | "right";
};

const FOURTH_SEASON_AD_PRESETS: Record<string, Omit<DatabaseBannerFields, "id">> = {
  "bee5c149-56c8-4931-a215-0b1de34adcfc": {
    owner_name: "리커버리 키친",
    title: "달린 뒤, 제대로 채우는 한 끼",
    description: "가볍게 준비하고 든든하게 회복하는 러너의 데일리 밸런스 식단.",
    alt_text: "한강을 배경으로 균형 잡힌 식단과 밀키트가 놓인 광고 이미지",
    image_url: "/images/poc/hello-2027/ads/recovery-food.webp",
    mobile_focus: "right",
  },
  "a1288786-d4b0-406d-a169-40025073d873": {
    owner_name: "리버룸",
    title: "달린 하루가 편안해지는 자리",
    description: "몸을 감싸는 깊은 휴식, 한강의 빛을 담은 모듈 소파.",
    alt_text: "한강이 보이는 거실에 크림색 모듈 소파가 놓인 광고 이미지",
    image_url: "/images/poc/hello-2027/ads/comfort-sofa.webp",
    mobile_focus: "right",
  },
  "c9746b24-4070-41ad-9f6c-a5e0619898aa": {
    owner_name: "ARKY",
    title: "움직임을 기록하면 변화가 보입니다",
    description: "러닝 자세부터 회복 리듬까지, 나만의 움직임 데이터를 한눈에.",
    alt_text: "움직임 분석 화면이 표시된 노트북과 휴대전화 광고 이미지",
    image_url: "/images/poc/hello-2027/ads/arky-workspace.webp",
    mobile_focus: "right",
  },
};

/**
 * Replaces the three original Han River placeholder rows with production-ready
 * sample ads. As soon as an operator saves a banner with a different image,
 * the database value wins and this compatibility seed no longer applies.
 */
export function hydrateLegacyFourthSeasonBanner<T extends DatabaseBannerFields>(row: T): T {
  const preset = FOURTH_SEASON_AD_PRESETS[row.id];
  if (!preset || row.image_url !== LEGACY_SAMPLE_IMAGE) return row;
  return { ...row, ...preset };
}
