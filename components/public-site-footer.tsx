import Link from "next/link";
import styles from "./public-site-footer.module.css";

export function PublicSiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.top}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink} aria-label="스내사 홈">스내사<span>TWTT</span></Link>
          <p>스스로를 내던지는 사람들</p>
          <p className={styles.description}>함께 달리고, 읽고, 실천하며<br/>우리의 하루를 주도적으로 만들어갑니다.</p>
        </div>
        <nav className={styles.links} aria-label="푸터 서비스 안내">
          <h2>스내사 알아보기</h2>
          <Link href="/about">소개</Link>
          <Link href="/magazine">매거진</Link>
          <Link href="/4th/dashboard">4기 대시보드</Link>
        </nav>
        <div className={styles.contact}>
          <h2>함께 만드는 스내사</h2>
          <a href="mailto:gmbro7942@gmail.com" className={styles.contactLink}>운영 문의 : 아키랩<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
          <span className={styles.email}>gmbro7942@gmail.com</span>
          <p>이용 중 궁금한 점이나<br/>함께 나누고 싶은 의견을 보내주세요.</p>
        </div>
      </div>
      <div className={styles.bottom}>
        <nav aria-label="이용 정책" className={styles.policies}>
          <Link href="/privacy" className={styles.privacy}>개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
        <span className={styles.signature}>스내사 · 스스로를 내던지는 사람들</span>
      </div>
    </div>
  </footer>;
}
