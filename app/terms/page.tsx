import Link from "next/link";

export const metadata = {
  title: "이용약관 | 스내사 3기 대시보드",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden pb-20">
      <header className="sticky top-0 z-50 border-b border-oriwan-border bg-oriwan-bg/90 px-3 py-3.5 backdrop-blur-md sm:px-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="gradient-text text-lg font-black">이용약관</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 sm:px-5 sm:py-8">
        <div className="card mobile-page-card space-y-6 p-4 text-sm leading-relaxed text-oriwan-text-muted sm:p-6">
          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제1조 (목적)</h2>
            <p>본 약관은 (주)아키랩이 운영하고 관리자 이경민이 관리하는 스내사 3기 대시보드의 이용 조건과 운영 기준을 규정합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제2조 (서비스 내용)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>인증 기록은 2026년 5월 1일부터 100일간 집계</li>
              <li>전체 참가자의 오늘 인증 여부와 인증률 제공</li>
              <li>참가자의 Google 로그인 기반 개인 기록 입력, 이미지 등록 및 조회</li>
              <li>운영자의 참가자 추가, 변경, 삭제 및 기록 수동 입력</li>
              <li>NRC, Garmin, Strava 등 러닝 인증 이미지 업로드, 텍스트 추출, 기록 검수 지원</li>
              <li>러닝 인증보드, 순위, 구간별 뱃지 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제3조 (참가자 화면)</h2>
            <p>참가자 화면은 로그인 없이 전체 인증 현황을 볼 수 있는 공개 대시보드입니다. 개별 참가자는 Google 로그인 후 이름을 필수로 등록해야 하며, 해당 이름이 운영자가 등록한 참가자명과 일치할 때 본인 기록 입력, 러닝 앱 이미지 등록, 조회가 가능합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제4조 (관리자 권한)</h2>
            <p>관리자 화면은 지정된 관리자 이메일 인증번호로만 접근할 수 있습니다. 관리자는 참가자 정보와 인증 기록을 추가, 변경, 삭제할 수 있으며, 입력된 기록의 정확성을 확인할 책임이 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">제5조 (면책)</h2>
            <p>이미지 분석 및 텍스트 추출 결과는 보조 도구이며, 인증 여부와 기록의 최종 판단은 관리자에게 있습니다.</p>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2026년 5월 6일 · 운영: (주)아키랩 · 관리자: 이경민
          </p>
        </div>
      </div>
    </main>
  );
}
