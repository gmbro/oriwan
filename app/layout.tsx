import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스내사 러닝보드",
  description: "100일동안 함께 잘 뻐팅기기!",
  keywords: ["스내사", "러닝", "기록인증", "대시보드", "OCR", "챌린지"],
  openGraph: {
    title: "스내사 러닝보드",
    description: "100일동안 함께 잘 뻐팅기기!",
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
      <body className="min-h-full flex flex-col bg-oriwan-bg">{children}</body>
    </html>
  );
}
