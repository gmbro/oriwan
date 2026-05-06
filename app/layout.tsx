import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스내사 3기 대시보드",
  description:
    "러닝 인증 이미지를 업로드하면 AI가 거리, 시간, 날짜를 추출하고 스내사 3기 인증 현황과 러닝 인증보드를 실시간으로 보여줍니다.",
  keywords: ["스내사", "러닝", "기록인증", "대시보드", "OCR", "챌린지"],
  openGraph: {
    title: "스내사 3기 대시보드",
    description: "이미지 기반 러닝 인증을 빠르게 검수하고 스내사 3기 변화를 확인하세요",
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
  themeColor: "#101522",
  colorScheme: "light",
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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" />
      </head>
      <body className="min-h-full flex flex-col bg-oriwan-bg">{children}</body>
    </html>
  );
}
