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
            <h2 className="text-base font-bold text-oriwan-text mb-2">1. 수집하는 개인정보</h2>
            <p>스내사 3기 대시보드는 이미지 기반 러닝 인증 운영을 위해 다음 정보를 수집합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google 계정:</strong> 이름, 이메일, 프로필 이미지</li>
              <li><strong>참가자 정보:</strong> 운영자가 등록한 이름, 닉네임</li>
              <li><strong>인증 이미지:</strong> 운영자가 업로드한 러닝 기록 이미지</li>
              <li><strong>추출 기록:</strong> 날짜, 거리, 시간, 페이스, 앱 출처, 인증 상태</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">2. 개인정보 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 인증</li>
              <li>참가자별 러닝 인증 여부 확인</li>
              <li>거리, 시간, 페이스 변화 분석</li>
              <li>이미지 텍스트 추출 및 검수 지원</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">3. 이미지 분석</h2>
            <p>업로드된 이미지는 러닝 인증에 필요한 텍스트와 숫자를 추출하기 위해 AI 분석에 사용될 수 있습니다. 운영자는 추출 결과를 직접 수정하거나 반려할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">4. 보관 및 파기</h2>
            <p>수집된 정보는 서비스 이용 기간 동안 보관되며, 삭제 요청 또는 회원 탈퇴 시 관련 데이터를 삭제합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-oriwan-text mb-2">5. 보안</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>모든 API 통신은 HTTPS로 암호화됩니다.</li>
              <li>Supabase Row Level Security로 사용자별 데이터 접근을 제한합니다.</li>
              <li>이미지 저장 경로와 분석 결과는 로그인한 운영자 계정에 귀속됩니다.</li>
            </ul>
          </section>

          <p className="text-xs text-oriwan-text-muted/60 pt-4 border-t border-oriwan-border">
            시행일: 2026년 5월 5일
          </p>
        </div>
      </div>
    </main>
  );
}
