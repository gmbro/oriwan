import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오리완 | 오늘의 리커버리 완료",
  description:
    "Strava 러닝 데이터와 AI를 결합한 스마트 기록 인증 서비스. 매일 뛰고, 회복하고, 오리완 도장을 모으세요!",
  keywords: ["러닝", "기록인증", "오리완", "리커버리", "스트라바", "달리기"],
  openGraph: {
    title: "오리완 | 오늘의 리커버리 완료",
    description: "매일 뛰고, 회복하고, 오리완 도장을 모으세요!",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
