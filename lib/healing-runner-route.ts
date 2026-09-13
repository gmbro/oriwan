// Foot-contact coordinates in the original river image (percent, not viewport).
// The route stays inside the grey lane, away from both white boundary lines.
export const HEALING_RUNNER_ROUTE = [
  { at: 0, x: 71, y: 98, scale: 1 },
  { at: 16, x: 74.8, y: 89, scale: .82 },
  { at: 32, x: 78, y: 80.5, scale: .65 },
  { at: 48, x: 80.3, y: 73, scale: .48 },
  { at: 64, x: 81.3, y: 68, scale: .32 },
  { at: 80, x: 80.7, y: 65.2, scale: .18 },
  { at: 92, x: 78, y: 63.4, scale: .09 },
  { at: 100, x: 75.4, y: 61.9, scale: .035 },
] as const;

export const HEALING_STRIDE_SECONDS = 2.4;
export const HEALING_TRAVEL_SECONDS = 64;
export const HEALING_RUNNERS = [
  { type: "a", travelDelay: -3, strideDelay: -.3 },
  { type: "b", travelDelay: -15, strideDelay: -1.45 },
  { type: "a", travelDelay: -27, strideDelay: -.85 },
  { type: "b", travelDelay: -39, strideDelay: -1.92 },
  { type: "a", travelDelay: -51, strideDelay: -1.1 },
] as const;

export function getHealingRoutePoint(progress: number) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  for (let index = 1; index < HEALING_RUNNER_ROUTE.length; index++) {
    const start = HEALING_RUNNER_ROUTE[index - 1];
    const end = HEALING_RUNNER_ROUTE[index];
    if (safeProgress > end.at) continue;
    const fraction = (safeProgress - start.at) / (end.at - start.at);
    return {
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction,
      scale: start.scale + (end.scale - start.scale) * fraction,
    };
  }
  return HEALING_RUNNER_ROUTE[HEALING_RUNNER_ROUTE.length - 1];
}

export function healingRouteTransform(point: { x: number; y: number; scale: number }) {
  // A planted shoe is at 86% of the 256px sprite cell. Scaling about that
  // anchor keeps the runner on the road, including in the static fallback.
  return `translate(calc(${point.x.toFixed(4)}cqi - 50%), calc(${point.y.toFixed(4)}cqb - 86%)) scale(${point.scale.toFixed(4)})`;
}
