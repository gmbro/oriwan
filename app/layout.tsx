import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오리완 | 러닝 인증 운영 대시보드",
  description:
    "러닝 인증 이미지를 업로드하면 AI가 거리, 시간, 날짜를 추출하고 참가자별 인증 현황과 향상도를 보여줘요.",
  keywords: ["러닝", "기록인증", "오리완", "대시보드", "OCR", "챌린지"],
  openGraph: {
    title: "오리완 | 러닝 인증 운영 대시보드",
    description: "이미지 기반 러닝 인증을 빠르게 검수하고 참가자별 변화를 확인하세요",
    type: "website",
    locale: "ko_KR",
  },
  icons: {
    icon: "/oriwan-logo-v2.png",
    apple: "/oriwan-logo-v2.png",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-oriwan-bg">{children}</body>
    </html>
  );
}
