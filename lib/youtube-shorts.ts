export type TipCategory = "running" | "recovery" | "stretching";

export type YoutubeShortTip = {
  id: string;
  title: string;
  channel: string;
  category: TipCategory;
  tag: string;
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
];

export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/shorts/${id}`;
}
