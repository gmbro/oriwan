import Link from "next/link";
import { publicPageMetadata } from "@/lib/public-site-metadata";

export const metadata = publicPageMetadata(
  "창업가 러닝 커뮤니티 | 함께 달리는 스내사 TWTT",
  "혼자 달리기의 꾸준함을 함께 만들어가는 스내사 러닝 커뮤니티. 각자의 운동 인증부터 크루 기록, 러닝 번개와 독서 모임까지 활동 방식을 소개합니다.",
  "/running-community",
);

export default function RunningCommunityPage() {
  return <article className="[word-break:keep-all]">
    <p className="text-sm font-bold text-blue-600">스내사 러닝 커뮤니티</p>
    <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">각자의 자리에서 달리고,<br/>꾸준함은 함께 만들어요</h1>
    <p className="mt-6 text-lg leading-8 text-slate-600">스내사는 창업가와 예비 창업자가 달리기, 독서, 작은 실행을 함께 이어가는 모임입니다. TWTT 러닝보드는 멤버들이 각자의 운동을 기록하고 서로의 실천을 확인하는 공간이에요.</p>
    <div className="mt-10 space-y-6">
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">이런 러닝 동료를 찾는다면</h2>
        <p className="mt-4 leading-8 text-slate-600">바쁜 업무 사이에도 몸을 움직이는 시간을 만들고 싶은 분, 혼자 시작한 아침 러닝을 꾸준히 이어가고 싶은 분, 창업의 고민을 책과 활동으로 나누고 싶은 분을 위한 커뮤니티입니다. 기록을 비교하기 전에 오늘 한 번 실천했다는 사실을 함께 확인해요.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">매일 같은 장소에 모여야 하나요?</h2>
        <p className="mt-4 leading-8 text-slate-600">일상의 러닝은 각자의 자리에서 하고, 운동한 날 러닝보드에 인증합니다. 함께 달리는 번개와 정기모임 일정은 달력에서 확인할 수 있어요. 로그인하지 않아도 일정 제목은 볼 수 있고, 시간·장소 등 자세한 내용은 로그인 후 확인합니다.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">함께하는 방식은 단순해요</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-slate-600">
          <li>나의 100일 다짐을 적어 두고 오늘의 운동을 시작합니다.</li>
          <li>운동 사진이나 앱 캡처 한 장을 올려 그날의 인증을 남깁니다.</li>
          <li>내 기록과 크루의 인증 현황을 보고, 인증 후 도착한 응원상자를 열어봅니다.</li>
        </ol>
        <p className="mt-4 text-sm leading-7 text-slate-500">비로그인 참관객은 하트로 크루 전체를 응원할 수 있습니다.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">달리기에서 독서와 실행으로</h2>
        <p className="mt-4 leading-8 text-slate-600">스내사는 러닝 외에도 책을 읽고 창업가의 고민을 나눕니다. 예비 창업자는 첫 시도를, 기존 창업자는 다음 단계를 위한 작은 미션을 정하고 한 달간의 과정과 결과를 나눠요. 몸을 움직이는 습관이 일상의 실행으로 이어지기를 바랍니다.</p>
        <Link href="/about" className="mt-4 inline-flex min-h-11 items-center font-semibold text-blue-600">클럽과 활동 소개 읽기 →</Link>
      </section>
    </div>
    <nav className="mt-8 flex flex-wrap gap-3" aria-label="러닝 커뮤니티 관련 안내">
      <Link href="/habit-challenge" className="rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white">100일 챌린지 알아보기</Link>
      <Link href="/#crew" className="rounded-2xl bg-white px-5 py-4 font-semibold text-slate-700">크루 기록 둘러보기</Link>
    </nav>
  </article>;
}
