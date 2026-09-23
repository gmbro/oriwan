import type { Metadata } from "next";

export const PUBLIC_SITE_URL = "https://xn--220bw61afob.kro.kr";
export const PUBLIC_SITE_NAME = "스스로 내던지는 사람들";

export function publicPageMetadata(title: string, description: string, pathname: string): Metadata {
  const url = new URL(pathname, PUBLIC_SITE_URL).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title, description, url, siteName: PUBLIC_SITE_NAME, locale: "ko_KR", type: "website",
      images: [{ url: `${PUBLIC_SITE_URL}/brand/ttt-logo.png`, width: 640, height: 310, alt: "스내사 · TWTT" }],
    },
    twitter: { card: "summary", title, description, images: [`${PUBLIC_SITE_URL}/brand/ttt-logo.png`] },
  };
}

export const publicSiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": `${PUBLIC_SITE_URL}/#website`,
      url: `${PUBLIC_SITE_URL}/`, name: PUBLIC_SITE_NAME,
      alternateName: ["스내사", "TWTT", "xn--220bw61afob.kro.kr"], inLanguage: "ko-KR",
      publisher: { "@id": `${PUBLIC_SITE_URL}/#community` },
    },
    {
      "@type": "Organization", "@id": `${PUBLIC_SITE_URL}/#community`,
      name: PUBLIC_SITE_NAME, alternateName: ["스내사", "TWTT"],
      url: `${PUBLIC_SITE_URL}/`, logo: `${PUBLIC_SITE_URL}/brand/ttt-logo.png`,
      description: "트레바리 모임 스내사는 창업가와 예비 창업자가 함께 달리고, 책을 읽고, 실천하는 커뮤니티입니다.",
    },
  ],
};
