import Link from "next/link";
import { ADMIN_EMAIL } from "@/lib/admin";

export const metadata = {
  title: "개인정보처리방침 | TWTT 러닝보드",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen overflow-x-hidden pb-20">
      <header className="sticky top-0 z-50 border-b border-oriwan-border bg-white/95 px-3 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/4th" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="gradient-text text-base font-black sm:text-lg">개인정보처리방침</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-8">
        <div className="rounded-[26px] bg-white space-y-7 p-5 text-sm leading-7 text-oriwan-text-muted shadow-sm ring-1 ring-slate-950/5 sm:p-8 sm:text-[15px]">
          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">1. 처리 주체와 현재 상태</h2>
            <p>
              TWTT 러닝보드는 (주)아키랩이 운영합니다. 현재 4기 화면은 운영 준비 상태이며 실제 운영 저장소의
              데이터만 표시합니다. 댓글 작성·답글·반응은 운영 DB 스키마와 권한을 적용·검증하고 운영 플래그를
              켤 때까지 잠겨 있습니다.
            </p>
            <p className="mt-2">
              교정운동 신청도 별도 서버 활성화 전까지 건강 관련 정보를 제출하거나 저장할 수 없습니다. 운영·개인정보 및
              삭제 요청은 <a className="font-bold text-blue-600 underline underline-offset-2" href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a>로 받습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">2. 처리하는 정보와 수집 방법</h2>
            <p className="mb-2">
              카카오 로그인 과정에서 카카오가 이용자의 동의를 받아 Supabase Auth에 전달한 정보만 처리합니다.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>필수 카카오 정보:</strong> 프로필 닉네임</li>
              <li><strong>선택 카카오 정보:</strong> 프로필 이미지·썸네일 URL</li>
              <li><strong>수집하지 않는 카카오 정보:</strong> 카카오계정 이메일, 이름, 전화번호, 생년월일 등 현재 동의 화면에서 요청하지 않는 항목</li>
              <li><strong>로그인 식별 정보:</strong> Supabase 사용자 식별자, Kakao provider 식별자, 인증 세션</li>
              <li><strong>관리자 정보:</strong> 관리자 이메일, 인증 및 관리 세션, 변경 이력</li>
              <li><strong>계정 연결 정보:</strong> 운영자 확인 표시명, 승인 상태·시각, 연결된 시즌 참가자</li>
              <li><strong>크루프로필:</strong> 운영자가 등록한 이름, 자기소개, 캐릭터, 공개 순서와 공개 동의 상태</li>
              <li><strong>러닝 인증 정보:</strong> 날짜, 거리, 시간, 페이스, 인증 상태와 운영 메모</li>
              <li><strong>인증 검수 정보:</strong> 운영자가 다루는 러닝 기록 이미지, OCR 추출문과 신뢰도</li>
              <li><strong>댓글 정보:</strong> 본문, 답글, 반응, 작성 시각, 운영 상태와 작성자 연결 정보</li>
              <li><strong>익명 댓글 식별 정보:</strong> HttpOnly 방문자 쿠키와 그 원문을 저장하지 않은 SHA-256 actor key</li>
              <li><strong>응원 상자 정보:</strong> 시즌, 인증일, 개봉 결과와 개봉 시각</li>
              <li><strong>오늘의 운세:</strong> 별도 저장 없이 로그인 식별자와 한국 날짜로 당일 결과를 서버에서 일시 계산</li>
              <li><strong>교정운동 신청 민감정보:</strong> 크루 식별 정보, 희망 일정, 통증 부위·발생 상황, 병원 이용 상태, 선택 메모, 별도 동의 버전·시각</li>
              <li><strong>보안 정보:</strong> 오류·차단 결과, 요청 식별자 등 서비스 보호에 필요한 최소 로그</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">3. 이용 목적</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>시즌별 러닝 인증 현황과 통계 제공</li>
              <li>운영자가 카카오 계정과 참가자를 확인해 연결</li>
              <li>카카오 프로필 닉네임 또는 운영자 확인 표시명으로 댓글·답글 제공</li>
              <li>카카오 로그인 이용자에게 인증 없이 오늘의 운세 제공</li>
              <li>승인 참가자의 당일 인증 여부를 확인해 하루 한 번 응원 상자 제공</li>
              <li>별도 동의한 승인 참가자의 교정운동 상담 준비와 일정 조율</li>
              <li>운영자의 인증 이미지 검수, OCR 보조 및 기록 정정</li>
              <li>오류·남용 방지와 서비스 보안 유지</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">4. 로그인 상태별 기능과 이름 표시</h2>
            <p>
              대시보드는 로그인 없이 조회할 수 있습니다. 정식 댓글 기능이 열린 뒤 비로그인 방문자는 서버가 정한 랜덤
              닉네임으로 댓글을 남깁니다. 소유 확인용 256비트 방문자 토큰은 HttpOnly 쿠키로만 보관하고 DB에는 원문 대신
              SHA-256 actor key를 저장합니다. 사전 공개 기간에는 댓글을 작성할 수 없습니다.
            </p>
            <p className="mt-2">
              개인 카카오 로그인 이용자는 카카오가 제공한 프로필 닉네임으로 댓글을 작성합니다. 운영자가 크루 명단과
              대조해 표시명을 바꾸면 이후에는 변경된 이름을 사용합니다. 두 이름 모두 별도 본인확인 서비스가 확인한
              법적 실명을 뜻하지 않습니다.
            </p>
            <p className="mt-2">
              프로필 닉네임 동의는 카카오 로그인에 필요합니다. 프로필 이미지는 선택 항목이며 제공을 거부하거나 나중에
              동의를 철회해도 로그인과 개인 기능 이용에는 제한이 없습니다. 카카오계정 이메일은 요청하거나 수집하지
              않습니다.
            </p>
            <p className="mt-2">
              개인 이용자에게는 인증 등록, OCR 실행, 크루 관리, 프로필 자기수정 권한을 제공하지 않습니다. 로그인만 하면
              인증 없이 오늘의 운세를 볼 수 있고, 오늘 인증이 완료된 승인 참가자에게만 하루 한 번 응원 상자 개봉 기능을
              제공합니다. 운세 결과는 DB에 별도로 보관하지 않습니다.
            </p>
            <p className="mt-2">
              교정운동 신청은 운영자가 확인한 4기 참가자에게만 제공하며, 통증과 병원 이용 정보는 건강에 관한
              민감정보로 분리해 필수 동의를 다시 받습니다. 동의를 거부해도 대시보드·운세·댓글 등 다른 기능은 이용할
              수 있지만 교정운동 신청은 제출할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">5. 공개 범위</h2>
            <p>
              참가자 동의를 전제로 크루 표시명, 자기소개, 캐릭터, 인증 여부와 인증률 등 대시보드 운영에 필요한 필드만
              공개합니다. 댓글 작성에 선택된 표시 이름 외의 Kakao 계정 원본 필드, 로그인 식별자, 인증 원본 이미지,
              OCR 원문, 운영 메모, 계정 연결 이력과 교정운동 신청 내용은 공개하지 않습니다. 교정운동 신청 목록은
              최소 식별·일정·처리 상태만 운영자에게 보여주고, 통증·병원 정보 원문은 운영자가 상세를 열 때만 전송하며
              열람 사실을 감사 로그에 남깁니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">6. Supabase 보관·삭제와 처리 위치</h2>
            <p>
              교정운동 신청 정보는 접수일부터 최대 180일 보관합니다. 완료·취소·거절된 신청은 그 처리일부터 90일과
              기존 만료일 중 더 이른 날까지 보관한 뒤 자동 파기합니다. 이용자는 위 이메일로 더 이른 삭제를 요청할 수
              있으며, 법령상 보존 의무가 없다면 확인 후 지체 없이 삭제합니다. 만료 파기 작업과 권한 검증이 실제 운영
              환경에 연결되기 전에는 교정운동 신청 수집을 활성화하지 않습니다.
            </p>
            <p className="mt-2">
              로그인 식별자, 프로필 닉네임과 선택한 프로필 이미지는 계정 이용 기간 동안 Supabase Auth와 서비스 계정 연결
              정보로 보관합니다. 탈퇴 또는 연결 해제를 확인하면 법령상 보존 의무가 있는 경우를 제외하고 운영 중인 Auth와
              서비스 DB에서 삭제하거나 카카오 식별자와 분리하며, 기존 공개 댓글은 탈퇴 이용자로 비식별 처리합니다.
            </p>
            <p className="mt-2">
              현재 카카오 로그인에서는 카카오계정 이메일을 수집하지 않습니다. 다만 과거 동의 범위로 이미 저장된 이메일은
              설정 변경만으로 자동 삭제되지 않으므로 운영 전 점검하고, 별도 보관 근거가 없다면 계정 연결과 탈퇴 절차를
              훼손하지 않는 방식으로 삭제합니다.
            </p>
            <p className="mt-2">
              Supabase의 DB 백업 제공 여부와 보존기간은 실제 요금제 설정에 따라 달라집니다. 운영 활성화 전에 프로젝트
              리전, 처리 위치, 위탁·재위탁 정보와 백업 보존기간을 확인해 고지합니다. 삭제 정보가 제한된 기간 백업에 남는
              경우 접근을 제한하고 보존기간이 끝나면 삭제하며, 백업 복원 시 기존 삭제 요청을 다시 적용합니다. Supabase
              Storage 객체는 DB 백업에 포함되지 않으므로 별도 삭제·복구 절차로 관리합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">7. 이용자의 권리와 동의 선택</h2>
            <p>
              이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지와 동의 철회를 요청할 수 있습니다. 요청은
              <a className="mx-1 font-bold text-blue-600 underline underline-offset-2" href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a>
              로 접수하며, 필요한 경우 요청자 확인 후 법령상 예외를 제외하고 지체 없이 처리합니다.
            </p>
            <p className="mt-2">
              카카오의 연결된 서비스 관리에서 선택 동의를 철회하거나 앱 연결을 해제할 수 있습니다. 선택 프로필 이미지
              동의 철회는 다른 기능 이용에 불이익을 주지 않습니다. 필수 닉네임 동의를 거부하거나 앱 연결을 해제하면
              카카오 개인 기능은 이용할 수 없지만 공개 대시보드는 로그인 없이 볼 수 있습니다. TWTT 로그아웃은 카카오 앱
              연결 해제나 서비스 탈퇴와 다르므로, 계정 삭제를 원하면 위 연락처로 별도 요청해야 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">8. 보호 조치</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>카카오·Supabase 비밀값은 배포 환경과 공급자 설정에만 저장하고 공개 코드나 브라우저에 노출하지 않습니다.</li>
              <li>관리자 기능은 이메일 인증번호와 서버 측 권한 검사를 거치도록 구성합니다.</li>
              <li>일반 이용자는 인증·OCR·크루·운영 API를 호출할 수 없도록 서버에서 권한을 다시 확인합니다.</li>
              <li>인증 원본은 비공개 저장소에 보관하고 허용된 공개 데이터만 서버를 통해 제공합니다.</li>
              <li>교정운동 신청 테이블은 공개·로그인 역할의 직접 접근을 차단하고 서버 전용 권한만 사용합니다.</li>
              <li>교정운동 상세 열람은 최소 담당자에게만 허용하며 열람 대상과 시각만 감사 로그에 남깁니다.</li>
              <li>교정운동 수집은 서버 전용 활성화 값이 명시적으로 설정되지 않으면 닫히는 방식으로 운영합니다.</li>
              <li>정식 운영 전 Supabase RLS·권한 정책, 백업·복구 및 삭제 절차를 점검합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">9. 안내</h2>
            <p>
              이 문서는 현재 구현과 예정된 운영 구조를 설명하기 위한 사전 공개 방침입니다. 정식 운영 전 실제 설정과 적용
              가능한 의무를 별도로 검토하고, 미확정 항목을 확정한 최종 방침을 다시 고지합니다.
            </p>
          </section>

          <p className="border-t border-oriwan-border pt-4 text-xs text-oriwan-text-muted/60">
            개정일: 2026년 9월 6일 · 운영: (주)아키랩
          </p>
        </div>
      </div>
    </main>
  );
}
