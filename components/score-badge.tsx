import type { ScoreBadgeKind } from "@/lib/scoring";

export function ScoreBadge({ kind }: { kind: ScoreBadgeKind }) {
  const styles = {
    praise: {
      icon: "👍",
      label: "참 잘했어요",
      className: "bg-lime-300 text-slate-950 shadow-lime-300/30",
    },
    steady: {
      icon: "🙂",
      label: "잘하고 있어요",
      className: "bg-amber-100 text-amber-950 shadow-amber-100/40",
    },
    boost: {
      icon: "💪",
      label: "힘내세요 화이팅",
      className: "bg-orange-100 text-orange-950 shadow-orange-100/40",
    },
  }[kind];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black shadow-sm ${styles.className}`}>
      <span className="text-[12px] leading-none" aria-hidden="true">{styles.icon}</span>
      {styles.label}
    </span>
  );
}
