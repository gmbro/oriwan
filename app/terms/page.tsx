import Link from "next/link";
import { ADMIN_EMAIL } from "@/lib/admin";

export const metadata = {
  title: "이용약관 | TWTT 러닝보드",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden pb-20">
      <header className="sticky top-0 z-50 border-b border-oriwan-border bg-white/95 px-3 py-3.5 backdrop-blur-sm sm:px-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/4th" className="text-oriwan-text-muted text-sm hover:text-oriwan-text transition-colors">← 돌아가기</Link>
          <h1 className="gradient-text text-lg font-black">이용약관</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-8">
        <div className="rounded-[26px] bg-white space-y-7 p-5 text-sm leading-7 text-oriwan-text-muted shadow-sm ring-1 ring-slate-950/5 sm:p-8 sm:text-[15px]">
          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제1조 (목적과 현재 상태)</h2>
            <p>
              이 약관은 (주)아키랩이 운영하는 TWTT 러닝보드의 이용 조건과 운영 기준을 안내합니다. 현재 4기 화면은
              운영 준비 버전이며 실제 운영 저장소의 데이터만 표시하고, 정식 운영 전 미확정 정책과 외부 설정을 보완합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제2조 (서비스 내용)</h2>
            <p className="mb-2">서비스 범위는 다음과 같습니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>3기 읽기 전용 기록과 4기 공통 대시보드 제공</li>
              <li>시즌 참가자의 인증 여부와 인증률 등 공개 현황 제공</li>
              <li>운영자의 인증 이미지 검수, OCR 보조 및 인증 상태 관리</li>
              <li>카카오 로그인 이용자가 직접 입력한 정보의 비식별 파생 조건을 이용한 외부 AI 오늘의 운세</li>
              <li>연결된 4기 참가자의 당일 인증 완료 후 그날 한 번 응원 상자 제공</li>
              <li>로그인 이용자가 닉네임 또는 공개 익명을 선택하는 댓글·답글·반응 제공</li>
              <li>교정운동 문의와 운영자의 일정 조율</li>
              <li>운영자의 인증, 멤버프로필, 응원글, 배너와 댓글 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제3조 (비로그인 이용)</h2>
            <p>
              비로그인 방문자는 공개 대시보드, 멤버 현황과 공개 댓글을 조회할 수 있습니다. 댓글·답글·반응 작성,
              오늘의 운세, 응원 상자와 교정운동 문의는 이용할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제4조 (카카오 로그인 이용)</h2>
            <p>
              카카오 로그인은 계정 연결 수단입니다. 개인 이용자는 오늘의 운세, 닉네임 또는 공개 익명을 선택한 댓글,
              연결 참가자의 당일 인증 완료 후 응원 상자, 교정운동 문의를 이용할 수 있습니다. 개인 이용자는 인증 등록·수정,
              OCR 실행, 멤버 관리 또는 프로필 자기수정을 할 수 없습니다.
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
              카카오 로그인 계정은 별도 운영자 승인 없이 비공개 4기 참가자에 자동 연결됩니다. 카카오 프로필 닉네임과
              운영자가 공개 멤버 명단을 대조해 정한 표시명은 별도 본인확인 서비스가 인증한 법적 실명으로
              보지 않습니다. 댓글마다 표시 닉네임 또는 ‘익명’을 선택할 수 있습니다. 익명 선택은 공개 표시만 감추며
              안전한 운영과 남용 방지를 위한 계정 연결은 유지합니다. 참가자와 연결되지 않은 계정은 응원 상자를 이용할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제6조 (응원 상자)</h2>
            <p>
              응원 상자는 카카오 로그인, 4기 참가자 연결, Asia/Seoul 기준 당일 인증 완료 여부를 서버가 확인한 뒤 그날 한 번
              제공합니다. 2026년 9월 23일 전 인증은 공식 D-day와 인증률에 포함되지 않지만 개인 기록에는 표시되고, 해당일
              인증을 완료했다면 응원 상자를 받을 수 있습니다. 메시지는 무작위로 정해지며 현금이나 상품으로 교환되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제6조의2 (오늘의 운세)</h2>
            <p>
              오늘의 운세는 만 18세 이상 카카오 로그인 이용자에게 인증 여부와 관계없이 제공하는 오락용 메시지입니다.
              이용자가 이름, 생년월일, 태어난 시간과 생활 권역을 입력하고 외부 AI 이용 안내에 동의하면, 서버는 원문을
              저장하거나 외부로 보내지 않고 별자리·띠·시간대·광역 권역·비가역 이름 지표만 Google Gemini에 전송합니다.
              생성 결과도 DB에 저장하지 않으며, 남용 방지를 위해 사용자별 날짜와 새 결과 생성 횟수만 보관합니다.
              중요한 건강, 재정, 법률 또는 생활 결정의 근거로 사용할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-oriwan-text">제7조 (운영자 권한)</h2>
            <p>
              관리자 화면은 지정된 관리자 이메일 인증번호와 서버 측 권한 검사를 통과한 운영자만 접근할 수 있습니다.
              참가자 연결과 표시명, 멤버프로필, 인증 기록, 응원글, 배너 및 댓글 운영 상태를 관리하는 기능을
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
