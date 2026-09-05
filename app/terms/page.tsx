import Link from "next/link";
import { ADMIN_EMAIL } from "@/lib/admin";

export const metadata = {
  title: "이용약관 | TWTT 러닝보드",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden pb-20">
      <header className="sticky top-0 z-50 border-b border-oriwan-border bg-oriwan-bg/90 px-3 py-3.5 backdrop-blur-md sm:px-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/4th" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="gradient-text text-lg font-black">이용약관</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 sm:px-5 sm:py-8">
        <div className="card mobile-page-card space-y-6 p-4 text-sm leading-relaxed text-oriwan-text-muted sm:p-6">
          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제1조 (목적과 현재 상태)</h2>
            <p>
              이 약관은 (주)아키랩이 운영하는 TWTT 러닝보드의 이용 조건과 운영 기준을 안내합니다. 현재 4기 화면은
              운영 준비 버전이며 실제 운영 저장소의 데이터만 표시하고, 정식 운영 전 미확정 정책과 외부 설정을 보완합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제2조 (서비스 내용)</h2>
            <p className="mb-2">정식 운영을 위해 준비 중인 서비스 범위는 다음과 같습니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>3기 읽기 전용 기록과 4기 공통 대시보드 제공</li>
              <li>시즌 참가자의 인증 여부와 인증률 등 공개 현황 제공</li>
              <li>운영자의 인증 이미지 검수, OCR 보조 및 인증 상태 관리</li>
              <li>카카오 로그인 이용자의 인증 없는 오늘의 운세 확인</li>
              <li>승인된 4기 참가자의 당일 인증 완료 후 하루 한 번 응원 상자 제공</li>
              <li>비로그인 랜덤 닉네임 또는 운영자 확인 표시명을 사용하는 댓글·답글·반응 제공</li>
              <li>운영자의 인증, 크루프로필, 응원글, 배너와 댓글 관리</li>
            </ul>
            <p className="mt-2">
              사전 공개 기간에는 댓글·답글·반응이 잠겨 있으며, 운영용 서버 저장소와 관리 기능을 연결한 뒤 별도 안내와 함께
              엽니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제3조 (비로그인 이용)</h2>
            <p>
              비로그인 방문자는 공개 대시보드를 조회할 수 있습니다. 정식 댓글 기능이 열린 뒤에는 서버가 배정한 랜덤
              닉네임으로 댓글을 작성할 수 있으나 응원 상자는 열 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제4조 (카카오 로그인 이용)</h2>
            <p>
              카카오 로그인은 계정 연결 수단입니다. 개인 이용자가 로그인해 사용할 수 있는 기능은 오늘의 운세 확인,
              카카오 프로필 닉네임 또는 운영자 확인 표시명으로 댓글을 작성하는 기능과, 승인된 참가자가 당일 인증을
              완료했을 때 응원 상자를 여는 기능으로 제한됩니다.
              개인 이용자는 인증 등록·수정, OCR 실행, 크루 관리 또는 프로필 자기수정을 할 수 없습니다.
            </p>
            <p className="mt-2">
              로그인에 필요한 필수 동의항목은 프로필 닉네임이며, 프로필 이미지는 선택 동의항목입니다. 프로필 이미지를
              제공하지 않아도 로그인과 개인 기능을 이용할 수 있습니다. 서비스는 카카오계정 이메일을 동의항목으로
              요청하거나 수집하지 않습니다. 필수 닉네임 제공에 동의하지 않으면 카카오 개인 기능은 이용할 수 없지만,
              공개 대시보드는 로그인 없이 볼 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제5조 (표시명과 참가자 연결)</h2>
            <p>
              카카오 프로필 닉네임과 운영자가 크루 명단을 대조해 정한 표시명은 별도 본인확인 서비스가 인증한 법적 실명으로
              보지 않습니다. 댓글은 카카오 프로필 닉네임을 기본으로 사용하고 운영자 확인 표시명이 있으면 그 이름을 사용합니다.
              이름 유사성만으로 참가자와 자동 연결하지 않으며, 미승인·승인 해제 계정은 응원 상자를 이용할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제6조 (응원 상자)</h2>
            <p>
              응원 상자는 카카오 로그인, 운영자 승인, 4기 참가자 연결, Asia/Seoul 기준 당일 인증 완료 여부를 서버가 확인한
              뒤 하루 한 번 제공합니다. 메시지형 결과는 무작위로 정해지며 현금이나 유상 상품으로 교환되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제6조의2 (오늘의 운세)</h2>
            <p>
              오늘의 운세는 카카오 로그인 이용자에게 인증 여부와 관계없이 제공하는 오락용 응원 메시지입니다. 중요한 건강,
              재정, 법률 또는 생활 결정을 위한 예측이나 조언이 아니며, 결과는 별도 DB에 저장하지 않고 Asia/Seoul 날짜를
              기준으로 당일 계산합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제7조 (운영자 권한)</h2>
            <p>
              관리자 화면은 지정된 관리자 이메일 인증번호와 서버 측 권한 검사를 통과한 운영자만 접근할 수 있습니다.
              정식 운영에서는 참가자 연결과 표시명, 크루프로필, 인증 기록, 응원글, 배너 및 댓글 운영 상태를 관리하는 기능을
              서버에 연결하고 중요한 변경 이력을 남기는 것을 운영 기준으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제8조 (이용자 책임과 제한)</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>타인의 계정이나 이름을 도용하거나 개인정보·불법 정보·권리 침해 내용을 게시해서는 안 됩니다.</li>
              <li>자동화 요청, 반복 댓글, 서비스 방해 또는 권한 우회 시도를 해서는 안 됩니다.</li>
              <li>정식 댓글 관리 기능이 열린 뒤 운영자는 정책 위반 댓글을 숨기거나 삭제하고 기능 이용을 제한할 수 있으며 조치 사유를 기록합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제9조 (인증 판단과 서비스 변경)</h2>
            <p>
              이미지 분석과 OCR 결과는 운영자의 인증 검수를 돕는 보조 정보이며 최종 인증 상태는 운영자가 결정합니다.
              장애, 보안 점검, 외부 서비스 변경 또는 시즌 운영상 필요에 따라 일부 기능이 제한되거나 변경될 수 있고, 중요한
              변경은 가능한 범위에서 서비스 화면을 통해 안내합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제10조 (동의 철회와 계정 종료)</h2>
            <p>
              이용자는 카카오의 연결된 서비스 관리에서 선택 동의를 철회하거나 앱 연결을 해제할 수 있습니다. 선택 프로필
              이미지 동의를 철회해도 다른 기능 이용에는 제한이 없습니다. 앱 연결 해제 또는 서비스 탈퇴 시 카카오 개인
              기능은 종료됩니다. TWTT 로그아웃은 앱 연결 해제나 서비스 탈퇴를 뜻하지 않습니다.
            </p>
            <p className="mt-2">
              서비스 계정과 개인정보의 열람·정정·삭제·처리정지 또는 탈퇴는
              <a className="mx-1 font-bold text-blue-600 underline underline-offset-2" href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a>
              로 요청할 수 있습니다. 법령상 보존 의무나 별도 동의를 받은 시즌 기록이 있는 경우에는 해당 범위만 분리하거나
              비식별 처리하고, 그 밖의 계정 연결 정보는 개인정보처리방침에 따라 처리합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제11조 (미확정 사항과 문의)</h2>
            <p>
              개인정보와 운영 데이터의 세부 보관기간, Supabase 리전·백업 잔존기간, 삭제 요청 절차와 운영 문의처는 정식
              운영 전에 확정해 개인정보처리방침과 함께 고지합니다. 이 사전 공개 문구는 현재 구현과 운영 계획을 설명하며,
              구체적인 법적 판단을 대신하지 않습니다.
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
