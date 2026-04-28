import Link from "next/link";

export const metadata = {
  title: "이용약관 | ORIWAN",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-50 px-5 py-3.5 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="text-lg font-black gradient-text">이용약관</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="card p-6 space-y-6 text-sm leading-relaxed text-oriwan-text-muted">
          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제1조 (목적)</h2>
            <p>본 약관은 ORIWAN(이하 &quot;서비스&quot;)이 제공하는 러닝 기록 인증 및 AI 회복 팁 서비스의 이용 조건과 절차를 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제2조 (서비스 내용)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Strava 계정 연동을 통한 러닝 데이터 조회</li>
              <li>AI 기반 맞춤형 회복 팁 제공</li>
              <li>일일 러닝 인증 기록 관리 (잔디 달력)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제3조 (이용자의 의무)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>타인의 계정을 도용하지 않아야 합니다.</li>
              <li>서비스를 부정한 목적으로 이용하지 않아야 합니다.</li>
              <li>서비스 이용 시 관련 법령을 준수해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제4조 (서비스 제공의 변경 및 중단)</h2>
            <p>운영상 또는 기술상의 사유로 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다. 이 경우 사전에 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제5조 (면책 조항)</h2>
            <p>본 서비스에서 제공하는 AI 회복 팁은 참고용이며, 전문 의료 조언을 대체하지 않습니다. 건강 관련 결정은 반드시 전문가와 상담하시기 바랍니다.</p>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2025년 4월 28일
          </p>
        </div>
      </div>
    </main>
  );
}
