import type { CSSProperties } from "react";

import styles from "./twtt-runner-pictogram.module.css";

type RunnerSize = "card" | "dialog" | "hero";
type RunnerPose = "run" | "stand";

type TwttRunnerPictogramProps = {
  variant: number;
  name: string;
  completed: boolean;
  pose?: RunnerPose;
  animated?: boolean;
  decorative?: boolean;
  portrait?: boolean;
  size?: RunnerSize;
};

type RunnerPalette = {
  shirt: string;
  shorts: string;
  shoes: string;
  skin: string;
  hair: string;
  accent: string;
};

const RUNNER_PALETTES: readonly RunnerPalette[] = [
  { shirt: "#f26d58", shorts: "#213454", shoes: "#fff7df", skin: "#efb17f", hair: "#33241f", accent: "#ffd166" },
  { shirt: "#4c91bd", shorts: "#1d3150", shoes: "#ff8a6f", skin: "#d99366", hair: "#241c1b", accent: "#f7d774" },
  { shirt: "#f2a65a", shorts: "#355070", shoes: "#fff8e8", skin: "#f2bd91", hair: "#563329", accent: "#e85d75" },
  { shirt: "#76a889", shorts: "#24334e", shoes: "#ffd0a8", skin: "#bd7b54", hair: "#231b20", accent: "#f6bd60" },
  { shirt: "#df7698", shorts: "#303b5d", shoes: "#fff3d4", skin: "#f0b184", hair: "#4a2c26", accent: "#7ec8b5" },
  { shirt: "#6f83c2", shorts: "#26334f", shoes: "#f28482", skin: "#d08c60", hair: "#201a1b", accent: "#f6d06f" },
  { shirt: "#ee8b5d", shorts: "#284b63", shoes: "#fff7df", skin: "#f3c29a", hair: "#5a352a", accent: "#76b5a0" },
  { shirt: "#66a69a", shorts: "#2d3656", shoes: "#ff9b7c", skin: "#a96847", hair: "#1f1a1c", accent: "#f4c95d" },
  { shirt: "#d77ea5", shorts: "#32405d", shoes: "#fff4dc", skin: "#e2a477", hair: "#3d2823", accent: "#72a9be" },
  { shirt: "#e8a04f", shorts: "#263650", shoes: "#ed6a5a", skin: "#f0b78e", hair: "#5a382c", accent: "#80b192" },
  { shirt: "#5f9fc3", shorts: "#243149", shoes: "#fff3d3", skin: "#bd7952", hair: "#251b1c", accent: "#f3b761" },
  { shirt: "#e87567", shorts: "#374363", shoes: "#f9d976", skin: "#f2c099", hair: "#4c3028", accent: "#75ad9a" },
  { shirt: "#7fa879", shorts: "#293957", shoes: "#fff4de", skin: "#d9966b", hair: "#241b1b", accent: "#ed8069" },
  { shirt: "#8b83bf", shorts: "#2c3552", shoes: "#f5a06e", skin: "#efb083", hair: "#55352b", accent: "#f2cf62" },
  { shirt: "#ef8a5f", shorts: "#24435a", shoes: "#fff7e4", skin: "#a96749", hair: "#21191b", accent: "#76af9b" },
  { shirt: "#4e9f94", shorts: "#323955", shoes: "#f08374", skin: "#e2a47b", hair: "#463029", accent: "#f5cb5c" },
  { shirt: "#d8799d", shorts: "#27334f", shoes: "#fff0d2", skin: "#f1bc91", hair: "#5a382e", accent: "#70a8bd" },
  { shirt: "#f0a158", shorts: "#30405e", shoes: "#eb7562", skin: "#ce895f", hair: "#221a1b", accent: "#81b29a" },
  { shirt: "#6b91bb", shorts: "#2a3554", shoes: "#fff5de", skin: "#efaf82", hair: "#493027", accent: "#f4ca62" },
  { shirt: "#e57162", shorts: "#27445d", shoes: "#ffd38f", skin: "#b87350", hair: "#21191a", accent: "#72aa98" },
];

type RunnerStyle = CSSProperties & {
  "--runner-delay": string;
};

export function TwttRunnerPictogram({
  variant,
  name,
  completed,
  pose = "stand",
  animated = false,
  decorative = true,
  portrait = false,
  size = "card",
}: TwttRunnerPictogramProps) {
  const normalizedVariant = Number.isFinite(variant)
    ? ((Math.trunc(variant) % RUNNER_PALETTES.length) + RUNNER_PALETTES.length) % RUNNER_PALETTES.length
    : 0;
  const palette = RUNNER_PALETTES[normalizedVariant];
  const accessory = normalizedVariant % 5;
  const runnerStyle: RunnerStyle = {
    "--runner-delay": `${-(normalizedVariant % 7) * 0.07}s`,
  };

  return (
    <span
      className={`${styles.runner} ${styles[size]} ${styles[pose]} ${completed ? styles.completed : styles.waiting} ${animated && pose === "run" ? styles.animated : ""}`}
      style={runnerStyle}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${name} 러닝 캐릭터`}
    >
      <svg viewBox={portrait ? "24 5 48 42" : "0 0 96 96"} focusable="false" aria-hidden="true" shapeRendering="geometricPrecision">
        <ellipse className={styles.groundShadow} cx="48" cy="86" rx="25" ry="5" fill="#17243d" opacity="0.18" />

        <g className={styles.bodyFrame}>
          <g className={styles.backArm}>
            <path d={pose === "run" ? "M39 43 28 53 20 47" : "M39 43 35 56 37 66"} fill="none" stroke={palette.skin} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" />
          </g>
          <g className={styles.backLeg}>
            <path d={pose === "run" ? "M43 65 34 76 23 79" : "M44 65 43 78 41 86"} fill="none" stroke={palette.skin} strokeLinecap="round" strokeLinejoin="round" strokeWidth="9" />
            <path d={pose === "run" ? "M24 79 16 82" : "M41 86 34 86"} fill="none" stroke={palette.shoes} strokeLinecap="round" strokeWidth="8" />
          </g>

          <path d="M36 37q12-7 24 1l-3 28H39Z" fill={palette.shirt} stroke="#17243d" strokeLinejoin="round" strokeWidth="2.5" />
          <path d="m39 61 18 1-2 10-9-1-8 1Z" fill={palette.shorts} stroke="#17243d" strokeLinejoin="round" strokeWidth="2.5" />
          <path d="M39 42 57 55" fill="none" stroke={palette.accent} strokeLinecap="round" strokeWidth="3" />

          <g className={styles.frontLeg}>
            <path d={pose === "run" ? "M51 68 62 76 73 73" : "M52 65 54 78 57 86"} fill="none" stroke={palette.skin} strokeLinecap="round" strokeLinejoin="round" strokeWidth="9" />
            <path d={pose === "run" ? "M73 73 82 75" : "M57 86 64 86"} fill="none" stroke={palette.shoes} strokeLinecap="round" strokeWidth="8" />
          </g>
          <g className={styles.frontArm}>
            <path d={pose === "run" ? "M57 42 67 49 75 42" : "M57 42 62 56 60 66"} fill="none" stroke={palette.skin} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" />
          </g>

          <g className={styles.headGroup}>
            <circle cx="48" cy="24" r="15" fill={palette.skin} stroke="#17243d" strokeWidth="2.5" />
            <path d="M34 23q1-17 16-16 14 1 14 16l-7-7-5 4-5-5-5 6Z" fill={palette.hair} />
            <circle cx="43" cy="26" r="1.5" fill="#17243d" />
            <circle cx="54" cy="26" r="1.5" fill="#17243d" />
            <path d="M45 31q4 3 8 0" fill="none" stroke="#17243d" strokeLinecap="round" strokeWidth="1.8" />

            {accessory === 0 ? <path d="M35 18h27" fill="none" stroke={palette.accent} strokeWidth="4" /> : null}
            {accessory === 1 ? <path d="M36 14q12-8 24 1l7 4H36Z" fill={palette.accent} stroke="#17243d" strokeLinejoin="round" strokeWidth="2" /> : null}
            {accessory === 2 ? <path d="M62 18q10 4 7 13-4-2-8-1" fill={palette.hair} stroke="#17243d" strokeWidth="2" /> : null}
            {accessory === 3 ? <path d="M34 18q3-14 15-13 12 0 15 14Z" fill={palette.accent} stroke="#17243d" strokeWidth="2" /> : null}
            {accessory === 4 ? (
              <g fill={palette.accent} stroke="#17243d" strokeWidth="1.5">
                <circle cx="34" cy="25" r="3.5" />
                <circle cx="63" cy="25" r="3.5" />
              </g>
            ) : null}
          </g>
        </g>
      </svg>
    </span>
  );
}
