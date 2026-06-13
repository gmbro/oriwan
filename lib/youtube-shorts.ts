export type TipCategory = "running" | "recovery" | "stretching";

export type YoutubeShortTip = {
  id: string;
  title: string;
  channel: string;
  category: TipCategory;
  tag: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

export const tipCategoryLabels: Record<TipCategory, string> = {
  running: "러닝팁",
  recovery: "리커버리",
  stretching: "스트레칭",
};

export const youtubeShortTips: YoutubeShortTip[] = [
  {
    id: "lKLvk1zs4RQ",
    title: "러닝 두 달 배운 후 자세 변화",
    channel: "소터플라이",
    category: "running",
    tag: "자세",
  },
  {
    id: "gYFKHN25AJs",
    title: "마라톤 코치가 알려주는 러닝 자세",
    channel: "YouTube Shorts",
    category: "running",
    tag: "자세",
  },
  {
    id: "zaRvUqVX5Nc",
    title: "효율을 높이는 달리기 포인트",
    channel: "YouTube Shorts",
    category: "running",
    tag: "효율",
  },
  {
    id: "MtTo3e06K3I",
    title: "러닝 초보가 바로 고칠 기본 자세",
    channel: "YouTube Shorts",
    category: "running",
    tag: "기본",
  },
  {
    id: "9KQFHh8nq78",
    title: "부상 줄이는 러닝 체크포인트",
    channel: "YouTube Shorts",
    category: "running",
    tag: "부상방지",
  },
  {
    id: "nbGVNwWqLog",
    title: "러닝 페이스를 편하게 잡는 법",
    channel: "YouTube Shorts",
    category: "running",
    tag: "페이스",
  },
  {
    id: "YxUajV7HPmE",
    title: "초보 러너 호흡 리듬 만들기",
    channel: "YouTube Shorts",
    category: "running",
    tag: "호흡",
  },
  {
    id: "2rwRdULOGjY",
    title: "오래 달리기 위한 몸의 각도",
    channel: "YouTube Shorts",
    category: "running",
    tag: "자세",
  },
  {
    id: "ameGigj5W7Q",
    title: "러닝 초반에 힘 빼는 방법",
    channel: "YouTube Shorts",
    category: "running",
    tag: "초반",
  },
  {
    id: "t2bdzttnyYs",
    title: "러닝 전 꼭 확인할 착지 습관",
    channel: "YouTube Shorts",
    category: "running",
    tag: "착지",
  },
  {
    id: "_at0nBrJBSg",
    title: "발을 뒤로 차면 안 되는 이유",
    channel: "런클리어 RUNCLEAR",
    category: "running",
    tag: "초보",
  },
  {
    id: "hHvz6IVrlx4",
    title: "매일 달리면 안 되는 이유",
    channel: "션과 함께",
    category: "running",
    tag: "루틴",
  },
  {
    id: "OJHg7gaqKao",
    title: "러닝 전 필수 드릴 6가지",
    channel: "힙으뜸",
    category: "stretching",
    tag: "워밍업",
  },
  {
    id: "vAEScOwGfSY",
    title: "초보러너 러닝 전 필수 스트레칭",
    channel: "런주호",
    category: "stretching",
    tag: "스트레칭",
  },
  {
    id: "0MjId6tCjVQ",
    title: "러닝 전 워밍업 5가지",
    channel: "운동선생님 비니",
    category: "stretching",
    tag: "워밍업",
  },
  {
    id: "viwNg4P_J1Q",
    title: "러닝 전 꼭 해야 할 스트레칭",
    channel: "지니코치",
    category: "stretching",
    tag: "부상방지",
  },
  {
    id: "Qym4PbVGqug",
    title: "달리기 전 몸을 깨우는 루틴",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "루틴",
  },
  {
    id: "wb9QWkNsSXU",
    title: "고관절을 여는 러닝 스트레칭",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "고관절",
  },
  {
    id: "HCdsP78TBQc",
    title: "종아리와 햄스트링 준비운동",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "하체",
  },
  {
    id: "2piciRQ5ebU",
    title: "러닝 후 굳은 다리 풀기",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "쿨다운",
  },
  {
    id: "Hj-2r7OlXuE",
    title: "러너를 위한 짧은 전신 스트레칭",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "전신",
  },
  {
    id: "up9oOcl7dmE",
    title: "무릎 부담을 줄이는 준비운동",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "무릎",
  },
  {
    id: "N1W3NqHdMO4",
    title: "발목 가동성 빠르게 깨우기",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "발목",
  },
  {
    id: "W9AECbtqiYg",
    title: "달리기 전 1분 워밍업",
    channel: "YouTube Shorts",
    category: "stretching",
    tag: "1분",
  },
  {
    id: "_mAJutRh7OU",
    title: "리커버리 러닝을 해야 되는 이유",
    channel: "장삐의 슬기로운 러닝생활",
    category: "recovery",
    tag: "회복",
  },
  {
    id: "QC1_E-RQpB8",
    title: "러닝 후 종아리 관리 방법",
    channel: "효진 HYOJIN",
    category: "recovery",
    tag: "종아리",
  },
  {
    id: "u-WCtnzttQo",
    title: "달리기 후 회복과 영양",
    channel: "런클리어 RUNCLEAR",
    category: "recovery",
    tag: "영양",
  },
  {
    id: "Qym4PbVGqug",
    title: "러닝 후 몸을 풀어주는 회복 루틴",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "쿨다운",
  },
  {
    id: "Hj-2r7OlXuE",
    title: "피로 누적을 줄이는 스트레칭",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "피로",
  },
  {
    id: "up9oOcl7dmE",
    title: "무릎과 발목 회복 관리",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "관절",
  },
  {
    id: "N1W3NqHdMO4",
    title: "러닝 후 발목과 종아리 풀기",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "하체",
  },
  {
    id: "W9AECbtqiYg",
    title: "짧게 끝내는 러닝 후 쿨다운",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "쿨다운",
  },
  {
    id: "YxUajV7HPmE",
    title: "심박을 안정시키는 회복 호흡",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "호흡",
  },
  {
    id: "9KQFHh8nq78",
    title: "다음 러닝을 위한 회복 체크",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "체크",
  },
  {
    id: "nbGVNwWqLog",
    title: "페이스가 무너진 날 회복법",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "페이스",
  },
  {
    id: "2piciRQ5ebU",
    title: "달린 뒤 다리 피로 풀기",
    channel: "YouTube Shorts",
    category: "recovery",
    tag: "다리",
  },
];

const tipCategories: TipCategory[] = ["running", "recovery", "stretching"];
export const recoveryYoutubeTipCategories: TipCategory[] = ["recovery", "stretching"];
const blockedYoutubeShortIds = new Set([
  // Removed from YouTube thumbnails; keeping it out prevents repeated 404s.
  "MtTo3e06K3I",
]);

export function isTipCategory(value: string | null): value is TipCategory {
  return Boolean(value && tipCategories.includes(value as TipCategory));
}

export function isRecoveryYoutubeTipCategory(value: string | null): value is TipCategory {
  return Boolean(value && recoveryYoutubeTipCategories.includes(value as TipCategory));
}

export function youtubeThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function seededRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function seededShuffle<T>(items: T[], seed: number) {
  const random = seededRandom(seed + 1);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isPostRunRecoveryTip(tip: YoutubeShortTip) {
  if (tip.category === "recovery") return true;
  if (tip.category !== "stretching") return false;

  const value = `${tip.title} ${tip.tag}`.replace(/\s/g, "");
  if (/러닝전|달리기전|운동전|워밍업|준비운동|드릴|몸을깨우/.test(value)) return false;
  return /러닝후|달리기후|운동후|쿨다운|회복|리커버리|피로|풀기|스트레칭|종아리|하체|발목|무릎|전신/.test(value);
}

export function getCuratedYoutubeShortTips(category: TipCategory, seed = 0, limit = 10) {
  return seededShuffle(
    youtubeShortTips
      .filter((tip) => tip.category === category)
      .filter(isPostRunRecoveryTip)
      .filter((tip) => !blockedYoutubeShortIds.has(tip.id))
      .map((tip) => ({ ...tip, thumbnailUrl: tip.thumbnailUrl || youtubeThumbnailUrl(tip.id) })),
    seed
  ).slice(0, limit);
}

export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&controls=1&fs=1`;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/shorts/${id}`;
}
