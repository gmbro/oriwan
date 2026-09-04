import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Hello2027Poc } from "./hello-2027-poc";
import { hello2027Snapshot } from "./hello-2027-poc-data";

function getSeoulDayPhase(date: Date) {
  const hour = (date.getUTCHours() + 9) % 24 + date.getUTCMinutes() / 60;
  if (hour < 5 || hour >= 22) return "night" as const;
  if (hour < 7) return "dawn" as const;
  if (hour < 10) return "morning" as const;
  if (hour < 17) return "day" as const;
  if (hour < 19) return "sunset" as const;
  return "evening" as const;
}

export const metadata: Metadata = {
  title: "TWTT 4th Hello 2027 · 로컬 PoC",
  description: "TWTT 4th Hello 2027의 로컬 전용 대시보드 와이어프레임",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Hello2027PocPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <Hello2027Poc snapshot={hello2027Snapshot} initialDayPhase={getSeoulDayPhase(new Date())} />;
}
