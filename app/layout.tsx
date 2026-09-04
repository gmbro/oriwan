import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xn--220bw61afob.kro.kr"),
  title: "TWTT 러닝보드",
  description: "함께 달리고, 인증하고, 응원하는 TWTT 크루 대시보드",
  keywords: ["TWTT", "러닝", "기록인증", "대시보드", "OCR", "챌린지"],
  openGraph: {
    title: "TWTT 러닝보드",
    description: "함께 달리고, 인증하고, 응원하는 TWTT 크루 대시보드",
    type: "website",
    locale: "ko_KR",
  },
  icons: {
    icon: "/brand/twtt-icon-20260902.png",
    apple: "/brand/twtt-icon-20260902.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
  themeColor: "#101522",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-oriwan-bg">{children}</body>
    </html>
  );
}
