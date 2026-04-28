import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | ORIWAN",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-50 px-5 py-3.5 bg-oriwan-bg/90 backdrop-blur-md border-b border-oriwan-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="text-lg font-black gradient-text">개인정보처리방침</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="card p-6 space-y-6 text-sm leading-relaxed text-oriwan-text-muted">
          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">1. 수집하는 개인정보</h2>
            <p>ORIWAN은 서비스 이용을 위해 다음과 같은 최소한의 정보를 수집합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google 계정:</strong> 이름, 이메일, 프로필 이미지</li>
              <li><strong>Strava 연동:</strong> 러닝 기록(거리, 시간, 페이스, 케이던스, 심박수)</li>
              <li><strong>서비스 이용 기록:</strong> ORIWAN 완료 날짜</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">2. 개인정보 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 인증</li>
              <li>러닝 데이터 기반 AI 맞춤 회복 팁 제공</li>
              <li>잔디(달력) 기록 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">3. 개인정보 보관 및 파기</h2>
            <p>수집된 개인정보는 서비스 이용 기간 동안 보관되며, 회원 탈퇴 시 즉시 파기됩니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">4. 제3자 제공</h2>
            <p>ORIWAN은 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 따른 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">5. 이용자의 권리</h2>
            <p>이용자는 언제든지 자신의 개인정보 열람, 수정, 삭제를 요청할 수 있습니다. Google 계정 연동 해제 또는 회원 탈퇴를 통해 데이터를 삭제할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">6. 보안</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>모든 API 통신은 HTTPS로 암호화됩니다.</li>
              <li>인증 토큰은 서버 사이드에서만 처리됩니다.</li>
              <li>Supabase Row Level Security(RLS)로 데이터 접근을 제어합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">7. 문의</h2>
            <p>개인정보 관련 문의는 서비스 내 채널을 통해 연락해주세요.</p>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2025년 4월 28일
          </p>
        </div>
      </div>
    </main>
  );
}
