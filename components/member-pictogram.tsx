type MemberPictogramTarget = {
  id: string;
  name: string;
};

type MemberPictogramProps = {
  index?: number;
  participantId?: string;
  participantName?: string;
  size?: "sm" | "lg";
  className?: string;
};

type PictogramShape = "round" | "bean" | "drop" | "squircle" | "pill" | "pebble";
type PictogramExpression = "smile" | "wink" | "laugh" | "surprise" | "calm" | "heart" | "sleepy" | "grin" | "tongue" | "sparkle" | "rosy";
type PictogramPose = "wave" | "run" | "cheer" | "jump" | "stretch" | "shy";
type PictogramAccessory = "cap" | "bow" | "crown" | "spark" | "leaf" | "flag" | "headband" | "wings" | "partyHat" | "beanie" | "visor" | "scarf";

const MEMBER_PICTOGRAMS = [
  { label: "햇살 캡틴", glyph: "☀", bg: "#fff7ed", body: "#fde68a", accent: "#f97316", shape: "round", expression: "smile", pose: "wave", accessory: "cap" },
  { label: "별 점퍼", glyph: "★", bg: "#eef2ff", body: "#c7d2fe", accent: "#4f46e5", shape: "bean", expression: "wink", pose: "jump", accessory: "spark" },
  { label: "하트 응원단", glyph: "♥", bg: "#fff1f2", body: "#fecdd3", accent: "#e11d48", shape: "drop", expression: "heart", pose: "cheer", accessory: "bow" },
  { label: "번개 메롱러", glyph: "⚡", bg: "#fefce8", body: "#bef264", accent: "#65a30d", shape: "pill", expression: "tongue", pose: "run", accessory: "headband" },
  { label: "잎 스트레처", glyph: "♣", bg: "#f0fdf4", body: "#bbf7d0", accent: "#16a34a", shape: "pebble", expression: "calm", pose: "stretch", accessory: "leaf" },
  { label: "음표 댄서", glyph: "♪", bg: "#fdf2f8", body: "#fbcfe8", accent: "#db2777", shape: "squircle", expression: "laugh", pose: "cheer", accessory: "partyHat" },
  { label: "달 잠꾸러기", glyph: "☾", bg: "#fafaf9", body: "#e7e5e4", accent: "#57534e", shape: "drop", expression: "sleepy", pose: "shy", accessory: "beanie" },
  { label: "다이아 날개", glyph: "◆", bg: "#f7fee7", body: "#d9f99d", accent: "#65a30d", shape: "squircle", expression: "surprise", pose: "wave", accessory: "wings" },
  { label: "꽃 머리띠", glyph: "✿", bg: "#fdf4ff", body: "#f5d0fe", accent: "#c026d3", shape: "round", expression: "rosy", pose: "shy", accessory: "headband" },
  { label: "깃발 리더", glyph: "⚑", bg: "#fffbeb", body: "#fde68a", accent: "#d97706", shape: "bean", expression: "grin", pose: "cheer", accessory: "flag" },
  { label: "나침반 캡", glyph: "✦", bg: "#fafaf9", body: "#fed7aa", accent: "#ea580c", shape: "pebble", expression: "wink", pose: "run", accessory: "visor" },
  { label: "물결 반짝이", glyph: "≈", bg: "#f0fdfa", body: "#99f6e4", accent: "#0f766e", shape: "pill", expression: "sparkle", pose: "stretch", accessory: "spark" },
  { label: "스파크 파티", glyph: "✶", bg: "#fffbeb", body: "#fde68a", accent: "#d97706", shape: "drop", expression: "laugh", pose: "jump", accessory: "partyHat" },
  { label: "구름 리본", glyph: "☁", bg: "#f1f5f9", body: "#e0f2fe", accent: "#64748b", shape: "bean", expression: "sleepy", pose: "wave", accessory: "bow" },
  { label: "왕관 미소", glyph: "♛", bg: "#fef3c7", body: "#fde68a", accent: "#92400e", shape: "squircle", expression: "smile", pose: "cheer", accessory: "crown" },
  { label: "체크 날개", glyph: "✓", bg: "#ecfccb", body: "#d9f99d", accent: "#4d7c0f", shape: "round", expression: "grin", pose: "run", accessory: "wings" },
  { label: "불꽃 깜짝이", glyph: "♨", bg: "#fff1f2", body: "#fed7aa", accent: "#dc2626", shape: "pill", expression: "surprise", pose: "jump", accessory: "headband" },
  { label: "눈꽃 비니", glyph: "✻", bg: "#fff1f2", body: "#fecdd3", accent: "#e11d48", shape: "pebble", expression: "calm", pose: "shy", accessory: "beanie" },
  { label: "씨앗 목도리", glyph: "●", bg: "#f7fee7", body: "#bef264", accent: "#15803d", shape: "drop", expression: "heart", pose: "stretch", accessory: "scarf" },
  { label: "리본 윙크", glyph: "∞", bg: "#fdf2f8", body: "#f9a8d4", accent: "#be185d", shape: "bean", expression: "wink", pose: "wave", accessory: "bow" },
  { label: "미소 코치", glyph: "☺", bg: "#faf5ff", body: "#ddd6fe", accent: "#7c3aed", shape: "round", expression: "laugh", pose: "cheer", accessory: "cap" },
  { label: "화살 머리띠", glyph: "➜", bg: "#f8fafc", body: "#cbd5e1", accent: "#334155", shape: "pill", expression: "tongue", pose: "run", accessory: "headband" },
  { label: "반짝 서포터", glyph: "✧", bg: "#fefce8", body: "#fef08a", accent: "#ca8a04", shape: "squircle", expression: "sparkle", pose: "jump", accessory: "spark" },
  { label: "동글 목도리", glyph: "◎", bg: "#f5f5f4", body: "#e7e5e4", accent: "#57534e", shape: "pebble", expression: "rosy", pose: "shy", accessory: "scarf" },
] as const;

function memberHash(value: string) {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

export function getMemberPictogramIndex(participantId = "", participantName = "") {
  return memberHash(`${participantId}:${participantName}`) % MEMBER_PICTOGRAMS.length;
}

export function buildMemberPictogramMap<T extends MemberPictogramTarget>(participants: T[]) {
  const randomLikeOrder = [...participants].sort((a, b) => {
    const hashDiff = memberHash(`${a.id}:${a.name}`) - memberHash(`${b.id}:${b.name}`);
    return hashDiff || a.name.localeCompare(b.name, "ko");
  });

  return new Map(randomLikeOrder.map((participant, index) => [participant.id, index % MEMBER_PICTOGRAMS.length]));
}

function renderBody(shape: PictogramShape, fill: string) {
  if (shape === "bean") return <path d="M12 27c-2.4-9.3 5.6-17 15.4-15.2 9 1.7 14.2 11.4 9.5 20.1-4.9 9.2-21.7 8.1-24.9-4.9Z" fill={fill} />;
  if (shape === "drop") return <path d="M24 10c7.4 7.2 13 13.1 13 21.3 0 7.5-5.6 11.5-13 11.5s-13-4-13-11.5C11 23.1 16.6 17.2 24 10Z" fill={fill} />;
  if (shape === "squircle") return <rect x="10" y="12" width="28" height="27" rx="10" fill={fill} />;
  if (shape === "pill") return <rect x="9" y="14" width="30" height="24" rx="12" fill={fill} />;
  if (shape === "pebble") return <path d="M10.5 25.5c0-8.9 6.9-15.4 15.4-14.4 9.2 1 13.4 7.7 11.7 17.1-1.4 7.8-8.7 12.7-17.7 11.4-6.5-.9-9.4-6.9-9.4-14.1Z" fill={fill} />;
  return <circle cx="24" cy="25" r="16" fill={fill} />;
}

function renderPose(pose: PictogramPose, accent: string) {
  if (pose === "run") {
    return (
      <>
        <path d="M12 27c-3.2 1-5.2 2.8-6.7 5.7M36 23c3 .7 5.2 2.1 7 4.6" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
        <path d="M19 40c-2 2.3-3.8 3.6-6.3 4.2M29 40c2.8 1.7 5.3 2.4 8.1 1.5" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
      </>
    );
  }
  if (pose === "cheer") {
    return (
      <>
        <path d="M15 18c-2.5-3.2-4.4-5.8-5.8-8.4M33 18c2.5-3.2 4.4-5.8 5.8-8.4" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
        <path d="M17 42c1.6 1.4 3.2 1.5 4.8.2M26.2 42.2c1.6 1.3 3.2 1.2 4.8-.2" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.6" />
      </>
    );
  }
  if (pose === "jump") {
    return (
      <>
        <path d="M12 28c-3.1-.8-5.5-2.4-7.2-4.8M36 28c3.1-.8 5.5-2.4 7.2-4.8" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
        <path d="M18 40c-2 2.3-4.3 3.3-7 3.1M30 40c2 2.3 4.3 3.3 7 3.1" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.8" />
      </>
    );
  }
  if (pose === "stretch") {
    return (
      <>
        <path d="M12 25H5M36 25h7M19 42c-1.2 1.6-2.8 2.4-4.9 2.4M29 42c1.2 1.6 2.8 2.4 4.9 2.4" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.8" />
      </>
    );
  }
  if (pose === "shy") {
    return (
      <>
        <path d="M13 31c-2.7.8-4.9.8-6.7-.1M35 31c2.7.8 4.9.8 6.7-.1" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.8" />
        <path d="M17 42c1.5 1.2 3 1.2 4.5 0M26.5 42c1.5 1.2 3 1.2 4.5 0" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="2.5" />
      </>
    );
  }
  return (
    <>
      <path d="M13 25c-3.6-1.6-5.5-4.3-5.7-8M35 29c2.7 1.1 5 2.7 6.4 5" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
      <path d="M16.2 42c1.7 1.2 3.4 1.2 5.1 0M26.7 42c1.7 1.2 3.4 1.2 5.1 0" stroke={accent} strokeLinecap="round" strokeWidth="2.5" />
    </>
  );
}

function renderBackAccessory(accessory: PictogramAccessory, accent: string) {
  if (accessory !== "wings") return null;
  return (
    <>
      <path d="M13 19c-6.2.8-9.2 5.1-8.2 10.4 4.3.1 7.9-1.8 10.6-5.7" fill="#fff" opacity=".9" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M35 19c6.2.8 9.2 5.1 8.2 10.4-4.3.1-7.9-1.8-10.6-5.7" fill="#fff" opacity=".9" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 25c2.1.8 4.1.8 6 .1M40 25c-2.1.8-4.1.8-6 .1" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="1.4" opacity=".7" />
    </>
  );
}

function renderAccessory(accessory: PictogramAccessory, accent: string) {
  if (accessory === "cap") return <path d="M15 13c3.2-4.2 12.2-4.8 17.4-.4l1.9 4.4H14.1L15 13Z" fill={accent} opacity=".9" />;
  if (accessory === "bow") {
    return (
      <>
        <path d="M18 12 10 8.5l2.8 8.2L18 12Zm12 0 8-3.5-2.8 8.2L30 12Z" fill={accent} opacity=".85" />
        <circle cx="24" cy="12.3" r="3" fill={accent} />
      </>
    );
  }
  if (accessory === "crown") return <path d="M14 16.5 17.4 9l6.6 6.1L30.6 9l3.4 7.5H14Z" fill={accent} opacity=".9" />;
  if (accessory === "leaf") return <path d="M21 12.5c2-5.1 7.4-6.6 11.5-4-1.3 5.9-6.1 8.6-11.5 4Z" fill={accent} opacity=".82" />;
  if (accessory === "flag") return <path d="M17 9v9M17 9h12l-2.2 3L29 15H17" fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />;
  if (accessory === "headband") {
    return (
      <>
        <path d="M13.5 18.5c5.7-4.1 15.3-4.1 21 0" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
        <circle cx="31" cy="17" r="1.8" fill="#fff" opacity=".85" />
      </>
    );
  }
  if (accessory === "partyHat") return <path d="M19 15 25.2 5.5 31.5 15H19Z" fill={accent} opacity=".9" />;
  if (accessory === "beanie") {
    return (
      <>
        <path d="M15 16c2.3-6 15.3-6 18 0H15Z" fill={accent} opacity=".88" />
        <circle cx="24" cy="8.6" r="3" fill={accent} opacity=".8" />
        <path d="M17.5 15.5h13" stroke="#fff" strokeLinecap="round" strokeWidth="1.8" opacity=".65" />
      </>
    );
  }
  if (accessory === "visor") {
    return (
      <>
        <path d="M14 15.5c4-3.8 13.5-4.2 18.5-.5" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="4" />
        <path d="M28 15.2h8.5" stroke={accent} strokeLinecap="round" strokeWidth="3.2" />
      </>
    );
  }
  if (accessory === "scarf") {
    return (
      <>
        <path d="M14.5 36c5.7 3.2 13.3 3.2 19 0" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3.2" />
        <path d="M30.5 37.2 36 42" fill="none" stroke={accent} strokeLinecap="round" strokeWidth="3" />
      </>
    );
  }
  if (accessory === "wings") return null;
  return (
    <>
      <path d="M35 9v7M31.5 12.5h7" stroke={accent} strokeLinecap="round" strokeWidth="2.3" />
      <path d="M14 11v5M11.5 13.5h5" stroke={accent} strokeLinecap="round" strokeWidth="2" opacity=".8" />
    </>
  );
}

function renderExpression(expression: PictogramExpression) {
  if (expression === "wink") {
    return (
      <>
        <circle cx="18" cy="29" r="1.8" fill="#0f172a" />
        <path d="M28 29c1.3-1 2.7-1 4 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M20.5 35c1.8 1.4 5.2 1.4 7 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
      </>
    );
  }
  if (expression === "laugh") {
    return (
      <>
        <path d="M15.5 28.8c1.1-1 2.5-1 3.6 0M28.9 28.8c1.1-1 2.5-1 3.6 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M20 34c1.9 3.2 6.1 3.2 8 0Z" fill="#0f172a" />
        <path d="M22 35.8c1.2.8 2.8.8 4 0" stroke="#fb7185" strokeLinecap="round" strokeWidth="1.4" />
      </>
    );
  }
  if (expression === "surprise") {
    return (
      <>
        <circle cx="18" cy="29" r="1.7" fill="#0f172a" />
        <circle cx="30" cy="29" r="1.7" fill="#0f172a" />
        <circle cx="24" cy="35" r="2.6" fill="#0f172a" />
      </>
    );
  }
  if (expression === "calm") {
    return (
      <>
        <path d="M15.5 29c1.2 1 2.7 1 4 0M28.5 29c1.2 1 2.7 1 4 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M21 35c1.5 1 4.5 1 6 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.7" />
      </>
    );
  }
  if (expression === "heart") {
    return (
      <>
        <text x="18" y="30" textAnchor="middle" dominantBaseline="central" fill="#e11d48" fontSize="5.8" fontWeight="900">♥</text>
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central" fill="#e11d48" fontSize="5.8" fontWeight="900">♥</text>
        <path d="M20 35c2.2 2 5.8 2 8 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
      </>
    );
  }
  if (expression === "sleepy") {
    return (
      <>
        <path d="M15.5 29h4M28.5 29h4" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M21 35c1.5.9 4.5.9 6 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.7" />
        <text x="34.5" y="23" fill="#64748b" fontSize="5" fontWeight="900">Z</text>
      </>
    );
  }
  if (expression === "grin") {
    return (
      <>
        <circle cx="18" cy="30" r="1.7" fill="#0f172a" />
        <circle cx="30" cy="30" r="1.7" fill="#0f172a" />
        <path d="M19 34.2h10c-.8 3-2.4 4.4-5 4.4s-4.2-1.4-5-4.4Z" fill="#0f172a" />
        <path d="M20.8 35.3h6.4" stroke="#fff" strokeLinecap="round" strokeWidth="1.2" opacity=".9" />
      </>
    );
  }
  if (expression === "tongue") {
    return (
      <>
        <path d="M15.5 28.8c1.1-1 2.5-1 3.6 0M28.9 28.8c1.1-1 2.5-1 3.6 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M20.4 34c2.1 1.8 5.1 1.8 7.2 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M24 35.4c1.8.5 2.5 1.6 1.8 3-.6 1.2-2.9 1.2-3.6 0-.6-1.4 0-2.5 1.8-3Z" fill="#fb7185" />
      </>
    );
  }
  if (expression === "sparkle") {
    return (
      <>
        <text x="18" y="30" textAnchor="middle" dominantBaseline="central" fill="#0f172a" fontSize="6" fontWeight="900">✦</text>
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central" fill="#0f172a" fontSize="6" fontWeight="900">✦</text>
        <path d="M20 35c2.2 1.8 5.8 1.8 8 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
      </>
    );
  }
  if (expression === "rosy") {
    return (
      <>
        <path d="M15.5 29c1.1-.9 2.4-.9 3.5 0M29 29c1.1-.9 2.4-.9 3.5 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M20.5 35c1.8 1.4 5.2 1.4 7 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
      </>
    );
  }
  return (
    <>
      <circle cx="18" cy="30" r="1.7" fill="#0f172a" />
      <circle cx="30" cy="30" r="1.7" fill="#0f172a" />
      <path d="M20.5 35c1.8 1.5 5.2 1.5 7 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
    </>
  );
}

export function MemberPictogram({
  index,
  participantId = "",
  participantName = "",
  size = "sm",
  className = "",
}: MemberPictogramProps) {
  const item = MEMBER_PICTOGRAMS[(index ?? getMemberPictogramIndex(participantId, participantName)) % MEMBER_PICTOGRAMS.length];
  const sizeClass = size === "lg" ? "h-12 w-12" : "h-7 w-7";

  return (
    <span
      aria-label={`${participantName || "멤버"} ${item.label} 픽토그램`}
      className={`inline-flex shrink-0 items-center justify-center ${sizeClass} ${className}`}
      title={item.label}
    >
      <svg viewBox="0 0 48 48" role="img" className="h-full w-full drop-shadow-sm">
        <circle cx="24" cy="24" r="22" fill={item.bg} />
        {renderPose(item.pose, item.accent)}
        {renderBackAccessory(item.accessory, item.accent)}
        {renderBody(item.shape, item.body)}
        {renderAccessory(item.accessory, item.accent)}
        <text
          x="24"
          y="24.2"
          textAnchor="middle"
          dominantBaseline="central"
          fill={item.accent}
          fontSize="11"
          fontWeight="900"
        >
          {item.glyph}
        </text>
        {renderExpression(item.expression)}
        <circle cx="14.5" cy="33" r="2" fill="#fb7185" opacity=".45" />
        <circle cx="33.5" cy="33" r="2" fill="#fb7185" opacity=".45" />
      </svg>
    </span>
  );
}
