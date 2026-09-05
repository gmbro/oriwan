import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardGatewayActions, DashboardGatewayAuthNotice } from "@/components/dashboard-gateway-actions";
import { FourthViewerProvider } from "@/components/fourth-viewer-provider";
import { TwttBrandMark } from "@/components/twtt-brand-mark";
import riversideImage from "@/public/images/poc/hello-2027/hello-2027-riverside.webp";
import styles from "./gateway.module.css";

export const metadata: Metadata = {
  title: "TWTT 4기 공통 대시보드",
  description: "TWTT 4기 공통 대시보드 입구",
  alternates: { canonical: "/4th" },
  robots: { index: false, follow: false },
};

export default function FourthSeasonGatewayPage() {
  return (
    <main className={styles.page}>
      <section className={styles.visual} aria-label="한강을 달리는 TWTT 4기">
        <Image
          src={riversideImage}
          alt="한강 산책로를 달리는 러너들이 있는 풍경"
          fill
          preload
          placeholder="blur"
          sizes="(max-width: 819px) 100vw, 64vw"
          className={styles.visualImage}
        />
        <div className={styles.brandChip}>
          <TwttBrandMark className="aspect-[640/310] w-full" sizes="108px" />
        </div>
        <div className={styles.sceneMessage}>
          <span>TWTT 4TH · HAN RIVER RUNNING</span>
          <p>각자의 속도로 달리고,<br />같은 100일을 완성합니다.</p>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="gateway-title">
        <div className={styles.panelInner}>
          <p className={styles.eyebrow}>스스로 내던지는 사람들 4기</p>
          <h1 id="gateway-title" className={styles.title}>한강에서 시작하는<br />100일의 약속</h1>
          <p className={styles.description}>
            함께 달린 기록을 확인하고, 카카오 로그인으로 나만의 운세와 개인 러닝 리포트를 만나보세요.
          </p>

          <dl className={styles.facts} aria-label="4기 일정">
            <div className={styles.fact}>
              <dt>공식 시작</dt>
              <dd>2026. 09. 23</dd>
            </div>
            <div className={styles.fact}>
              <dt>함께하는 기간</dt>
              <dd>100 DAYS</dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <Suspense fallback={null}>
              <DashboardGatewayAuthNotice />
            </Suspense>
            <FourthViewerProvider>
              <DashboardGatewayActions />
            </FourthViewerProvider>
          </div>

          <footer className={styles.footer}>
            <p>(주)아키랩</p>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
