import localFont from "next/font/local";
import type { ReactNode } from "react";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

export default function Hello2027Layout({ children }: { children: ReactNode }) {
  return <div className={pretendard.variable}>{children}</div>;
}
