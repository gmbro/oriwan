import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | 스내사 3기 대시보드",
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
            <h2 className="text-base font-bold text-oriwan-text mb-2">1. 처리 주체</h2>
            <p>스내사 3기 대시보드는 (주)아키랩이 운영하며, 관리자 이경민이 참가자 및 러닝 인증 기록을 관리합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">2. 수집하는 정보</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>관리자 인증 정보:</strong> 관리자 이메일, 인증 세션</li>
              <li><strong>개별 로그인 정보:</strong> Google 계정 이메일, 인증 세션</li>
              <li><strong>참가자 정보:</strong> 운영자가 등록한 이름, 참가자가 직접 입력한 필수 이름</li>
              <li><strong>러닝 인증 기록:</strong> 날짜, 거리, 시간, 페이스, 인증 상태, 메모</li>
              <li><strong>인증 이미지:</strong> 운영자 또는 참가자가 업로드한 NRC, Garmin, Strava 등 러닝 기록 이미지와 추출 텍스트</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">3. 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>2026년 5월 1일부터 100일간의 러닝 인증 여부 확인</li>
              <li>전체 및 개별 참가자의 거리, 시간, 인증률 시각화</li>
              <li>참가자가 입력한 이름과 운영자가 등록한 참가자명 매칭</li>
              <li>관리자의 참가자 관리 및 기록 검수</li>
              <li>NRC, Garmin, Strava 등 이미지 기반 기록 추출과 수동 보정 지원</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">4. 공개 범위</h2>
            <p>전체 참가자 대시보드는 로그인 없이 볼 수 있습니다. 개별 기록 입력 화면은 Google 로그인이 필요하며, 공개되는 정보는 참가자명, 인증 여부, 거리, 시간, 랭킹 등 러닝 인증 현황에 필요한 항목으로 제한됩니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">5. 보관 및 삭제</h2>
            <p>수집된 정보는 스내사 3기 운영 기간 동안 보관됩니다. 참가자 삭제 시 참가자는 목록에서 비활성화되며, 기록 보존이 필요한 경우 기존 인증 기록은 유지될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">6. 보안</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>관리자 화면은 이메일 인증번호 기반으로 접근을 제한합니다.</li>
              <li>개별 기록 입력 화면은 Google 로그인 세션으로 접근을 제한합니다.</li>
              <li>API 통신은 HTTPS로 암호화됩니다.</li>
              <li>운영 데이터는 Supabase 권한 정책과 서버 검증을 통해 보호됩니다.</li>
            </ul>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2026년 5월 6일 · 운영: (주)아키랩 · 관리자: 이경민
          </p>
        </div>
      </div>
    </main>
  );
}
