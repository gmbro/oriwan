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

const MEMBER_PICTOGRAMS = [
  { label: "햇살", glyph: "☀", bg: "#fff7ed", body: "#fde68a", accent: "#f97316" },
  { label: "별", glyph: "★", bg: "#eef2ff", body: "#c7d2fe", accent: "#4f46e5" },
  { label: "하트", glyph: "♥", bg: "#fff1f2", body: "#fecdd3", accent: "#e11d48" },
  { label: "번개", glyph: "⚡", bg: "#fefce8", body: "#bef264", accent: "#65a30d" },
  { label: "잎", glyph: "♣", bg: "#f0fdf4", body: "#bbf7d0", accent: "#16a34a" },
  { label: "음표", glyph: "♪", bg: "#fdf2f8", body: "#fbcfe8", accent: "#db2777" },
  { label: "달", glyph: "☾", bg: "#f8fafc", body: "#dbeafe", accent: "#2563eb" },
  { label: "다이아", glyph: "◆", bg: "#ecfeff", body: "#a5f3fc", accent: "#0891b2" },
  { label: "꽃", glyph: "✿", bg: "#fdf4ff", body: "#f5d0fe", accent: "#c026d3" },
  { label: "깃발", glyph: "⚑", bg: "#f0f9ff", body: "#bae6fd", accent: "#0284c7" },
  { label: "나침반", glyph: "✦", bg: "#fafaf9", body: "#fed7aa", accent: "#ea580c" },
  { label: "물결", glyph: "≈", bg: "#f0fdfa", body: "#99f6e4", accent: "#0f766e" },
  { label: "스파크", glyph: "✶", bg: "#fffbeb", body: "#fde68a", accent: "#d97706" },
  { label: "구름", glyph: "☁", bg: "#f1f5f9", body: "#e0f2fe", accent: "#64748b" },
  { label: "왕관", glyph: "♛", bg: "#fef3c7", body: "#fde68a", accent: "#92400e" },
  { label: "체크", glyph: "✓", bg: "#ecfccb", body: "#d9f99d", accent: "#4d7c0f" },
  { label: "불꽃", glyph: "♨", bg: "#fff1f2", body: "#fed7aa", accent: "#dc2626" },
  { label: "눈꽃", glyph: "✻", bg: "#eff6ff", body: "#bfdbfe", accent: "#1d4ed8" },
  { label: "씨앗", glyph: "●", bg: "#f7fee7", body: "#bef264", accent: "#15803d" },
  { label: "리본", glyph: "∞", bg: "#fdf2f8", body: "#f9a8d4", accent: "#be185d" },
  { label: "미소", glyph: "☺", bg: "#faf5ff", body: "#ddd6fe", accent: "#7c3aed" },
  { label: "화살", glyph: "➜", bg: "#f8fafc", body: "#cbd5e1", accent: "#334155" },
  { label: "반짝", glyph: "✧", bg: "#fefce8", body: "#fef08a", accent: "#ca8a04" },
  { label: "동그라미", glyph: "◎", bg: "#f5f5f4", body: "#e7e5e4", accent: "#57534e" },
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
        <circle cx="24" cy="25" r="16" fill={item.body} />
        <text
          x="24"
          y="24"
          textAnchor="middle"
          dominantBaseline="central"
          fill={item.accent}
          fontSize="15"
          fontWeight="900"
        >
          {item.glyph}
        </text>
        <circle cx="18" cy="30" r="1.7" fill="#0f172a" />
        <circle cx="30" cy="30" r="1.7" fill="#0f172a" />
        <path d="M20.5 35c1.8 1.5 5.2 1.5 7 0" fill="none" stroke="#0f172a" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="14.5" cy="33" r="2" fill="#fb7185" opacity=".45" />
        <circle cx="33.5" cy="33" r="2" fill="#fb7185" opacity=".45" />
        <path d="M16 42c1.8 1.2 3.5 1.2 5.3 0M26.7 42c1.8 1.2 3.5 1.2 5.3 0" stroke={item.accent} strokeLinecap="round" strokeWidth="2.2" opacity=".55" />
      </svg>
    </span>
  );
}
