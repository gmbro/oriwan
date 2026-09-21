import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const GOOGLE_TAG_ID = "AW-18451924880";

export const metadata: Metadata = {
  metadataBase: new URL("https://xn--220bw61afob.kro.kr"),
  title: "스내사 · 스스로 내던지는 사람들 · TWTT 아침러닝 챌린지 | 창업가를 위한 심신단련 커뮤니티",
  description: "스내사, 스스로 내던지는 사람들. TWTT 아침러닝 챌린지는 창업가를 위한 심신단련 커뮤니티입니다.",
  openGraph: {
    title: "스내사 · 스스로 내던지는 사람들 · TWTT 아침러닝 챌린지 | 창업가를 위한 심신단련 커뮤니티",
    description: "스내사, 스스로 내던지는 사람들. TWTT 아침러닝 챌린지는 창업가를 위한 심신단련 커뮤니티입니다.",
    siteName: "스스로 내던지는 사람들",
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
      <body className="min-h-full flex flex-col bg-oriwan-bg">
        {children}
        <Script
          id="google-tag-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-tag-config" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_TAG_ID}');`}
        </Script>
      </body>
    </html>
  );
}
