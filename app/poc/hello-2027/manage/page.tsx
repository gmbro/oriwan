import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Hello2027LocalManager } from "./hello-2027-local-manager";
import { hello2027Snapshot } from "../hello-2027-poc-data";

export const metadata: Metadata = {
  title: "Hello 2027 운영자 관리 · 로컬 PoC",
  description: "Hello 2027 광고, 크루 프로필과 자기소개, 응원글을 이 브라우저에서 관리하는 개발용 화면",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Hello2027ManagePage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <Hello2027LocalManager snapshot={hello2027Snapshot} />;
}
