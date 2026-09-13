import Link from "next/link";
import styles from "./public-site-footer.module.css";

export function PublicSiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.top}>
        <div className={styles.contact}>
          <a href="mailto:gmbro7942@gmail.com" className={styles.contactLink}>아키랩<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
          <span className={styles.email}>gmbro7942@gmail.com</span>
          <p>이용 중 궁금한 점이나<br/>함께 나누고 싶은 의견을 보내주세요.</p>
        </div>
      </div>
      <div className={styles.bottom}>
        <nav aria-label="이용 정책" className={styles.policies}>
          <Link href="/privacy" className={styles.privacy}>개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
        <span className={styles.signature}>TWTT · ARKYLAB</span>
      </div>
    </div>
  </footer>;
}
