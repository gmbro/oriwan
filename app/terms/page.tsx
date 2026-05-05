import Link from "next/link";

export const metadata = {
  title: "이용약관 | 스내사 3기 대시보드",
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
            <p>본 약관은 스내사 3기 대시보드가 제공하는 이미지 기반 러닝 인증 관리 및 대시보드 서비스의 이용 조건과 절차를 규정합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제2조 (서비스 내용)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>참가자 등록 및 관리</li>
              <li>러닝 인증 이미지 업로드 및 AI 텍스트 추출</li>
              <li>날짜, 거리, 시간, 페이스 수동 검수</li>
              <li>인증 시계열, 랭킹, 그래프 대시보드 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제3조 (운영자의 책임)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>참가자 이미지 업로드에 필요한 동의를 확보해야 합니다.</li>
              <li>AI 추출 결과가 부정확할 수 있으므로 최종 인증 여부를 직접 확인해야 합니다.</li>
              <li>타인의 개인정보 또는 민감정보가 불필요하게 포함된 이미지를 업로드하지 않아야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제4조 (면책)</h2>
            <p>AI 이미지 분석 결과는 보조 도구이며, 인증 여부와 기록의 정확성에 대한 최종 판단은 운영자에게 있습니다.</p>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2026년 5월 5일
          </p>
        </div>
      </div>
    </main>
  );
}
