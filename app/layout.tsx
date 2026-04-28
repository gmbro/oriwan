import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오리완 | 오늘의 리커버리 완료",
  description:
    "달리고, 회복하고, 도장 찍고! AI가 당신의 러닝을 분석해 맞춤형 회복 팁을 알려드려요.",
  keywords: ["러닝", "기록인증", "오리완", "리커버리", "달리기", "스트레칭"],
  openGraph: {
    title: "오리완 | 오늘의 리커버리 완료",
    description: "달리고, 회복하고, 도장 찍고! 매일 오리완을 완성하세요",
    type: "website",
    locale: "ko_KR",
  },
  icons: {
    icon: "/oriwan-logo.png",
    apple: "/oriwan-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAFAF7",
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
      <body className="min-h-full flex flex-col bg-oriwan-bg">{children}</body>
    </html>
  );
}
