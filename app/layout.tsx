import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스내사 러닝보드",
  description:
    "오늘의 러닝 인증을 함께 확인하고, 이미지 기록도 가볍게 올리는 스내사 러닝보드입니다.",
  keywords: ["스내사", "러닝", "기록인증", "대시보드", "OCR", "챌린지"],
  openGraph: {
    title: "스내사 러닝보드",
    description: "오늘의 인증과 100일 러닝 흐름을 친근하게 확인해요",
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
