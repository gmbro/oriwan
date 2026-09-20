import Link from "next/link";
import styles from "./public-site-footer.module.css";

export function PublicSiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <nav aria-label="스내사 둘러보기" className={styles.navigation}>
        <Link href="/about">소개<span aria-hidden="true">→</span></Link>
        <Link href="/running-community">러닝 커뮤니티<span aria-hidden="true">→</span></Link>
        <Link href="/habit-challenge">100일 챌린지<span aria-hidden="true">→</span></Link>
        <Link href="/magazine">매거진<span aria-hidden="true">→</span></Link>
      </nav>
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
