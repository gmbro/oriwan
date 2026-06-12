import { RECOVERY_CERTIFICATION_LIMIT } from "@/lib/run-records";

export function RecoveryBadgeStrip({
  usedCount,
  className = "",
}: {
  usedCount: number;
  className?: string;
}) {
  const used = Math.max(0, Math.min(Math.floor(usedCount), RECOVERY_CERTIFICATION_LIMIT));

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 ${className}`.trim()}
      aria-label={`리커버리 인증 ${used}/${RECOVERY_CERTIFICATION_LIMIT}회 사용`}
    >
      {Array.from({ length: RECOVERY_CERTIFICATION_LIMIT }, (_, index) => {
        const isUsed = index < used;
        return (
          <span
            key={index}
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black leading-none ring-1 ${
              isUsed
                ? "bg-slate-200 text-slate-500 grayscale ring-slate-300"
                : "bg-lime-300 text-slate-950 shadow-sm shadow-lime-300/25 ring-lime-400"
            }`}
            aria-hidden="true"
          >
            R
          </span>
        );
      })}
    </span>
  );
}
