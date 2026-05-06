import type { ScoreBadgeKind } from "@/lib/scoring";

export function ScoreBadge({ kind }: { kind: ScoreBadgeKind }) {
  const styles = {
    praise: {
      fill: "#A3E635",
      label: "참 잘했어요",
      className: "bg-lime-300 text-slate-950 shadow-lime-300/30",
      mouth: "M10 16.3c1.8 1.9 6.2 1.9 8 0",
    },
    steady: {
      fill: "#FDE68A",
      label: "잘하고 있어요",
      className: "bg-amber-100 text-amber-950 shadow-amber-100/40",
      mouth: "M10 16.5c1.7 1.3 6.3 1.3 8 0",
    },
    boost: {
      fill: "#FDBA74",
      label: "분발해보아요",
      className: "bg-orange-100 text-orange-950 shadow-orange-100/40",
      mouth: "M10.5 17c1.5-1.1 5.5-1.1 7 0",
    },
  }[kind];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black shadow-sm ${styles.className}`}>
      <svg viewBox="0 0 28 28" className="h-4 w-4" aria-hidden="true">
        <path d="M14 2.5 17.1 8.8 24 9.8 19 14.7l1.2 6.9L14 18.3 7.8 21.6 9 14.7 4 9.8l6.9-1L14 2.5Z" fill={styles.fill} />
        <circle cx="10.7" cy="12.4" r="1.2" fill="#101522" />
        <circle cx="17.3" cy="12.4" r="1.2" fill="#101522" />
        <path d={styles.mouth} stroke="#101522" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
      {styles.label}
    </span>
  );
}
