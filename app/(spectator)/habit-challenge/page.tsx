import Link from "next/link";
import { publicPageMetadata } from "@/lib/public-site-metadata";

export const metadata = publicPageMetadata(
  "100일 러닝 습관 챌린지 | 아침 운동을 이어가는 스내사",
  "운동 습관을 함께 만드는 스내사 100일 챌린지. 나의 다짐 설정, 하루 한 장 운동 인증, 기록 확인과 응원상자까지 참여 방법을 안내합니다.",
  "/habit-challenge",
);

export default function HabitChallengePage() {
  return <article className="[word-break:keep-all]">
    <p className="text-sm font-bold text-blue-600">TWTT · Hello 2027</p>
    <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">100일 러닝 습관 챌린지</h1>
    <p className="mt-5 text-lg leading-8 text-slate-600">내일도 다시 움직일 수 있도록 오늘의 운동을 남겨요. 스내사의 100일 도전은 멤버들이 운동 습관과 작은 실천을 함께 이어가는 챌린지입니다.</p>
    <p className="mt-4 rounded-2xl bg-blue-50 px-5 py-4 text-sm font-semibold leading-6 text-blue-700">4기 공식 인증 기간 · 2026년 9월 23일 ~ 12월 31일<br/>시즌 전 기록은 개인 기록에서 확인하며 공식 집계와는 구분됩니다.</p>
    <div className="mt-9 space-y-6">
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">1. 나만의 다짐을 구체적으로 적어요</h2>
        <p className="mt-4 leading-8 text-slate-600">‘꾸준히 운동하기’보다 ‘일어나면 운동화를 신고 밖으로 나가기’처럼 내가 바로 시작할 수 있는 행동을 적어보세요. 홈페이지에서 100일 다짐을 설정할 수 있고, 한 번 설정한 내용은 30일이 지난 뒤 바꿀 수 있어요.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">2. 운동한 날 사진 한 장을 올려요</h2>
        <p className="mt-4 leading-8 text-slate-600">로그인한 뒤 멤버 목록에서 내 카드를 누르고, 인증 날짜를 확인한 후 사진을 올립니다. 날짜는 오늘로 기본 설정되며 지난 날짜도 직접 선택할 수 있어요. 사진에 날짜가 없거나 배경이 있어도 괜찮고, 선택한 날짜마다 한 장만 인증할 수 있습니다.</p>
        <p className="mt-3 leading-8 text-slate-600">오늘 인증을 마치면 버튼이 ‘오늘 인증완료!’로 바뀌고 다음 날 0시에 다시 열려요. 기존 기록을 수정해야 한다면 운영자에게 직접 요청해주세요.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">3. 내 기록과 오늘의 응원을 확인해요</h2>
        <p className="mt-4 leading-8 text-slate-600">인증 직후 도착한 응원상자를 열어 오늘의 메시지를 받아보세요. 내 기록의 캘린더에서는 인증한 날을 확인할 수 있습니다. 크루의 인증 현황과 누적 기록도 함께 보면서 도전을 이어가요.</p>
      </section>
      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">아침 운동을 이어가기 위한 작은 준비</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-slate-600">
          <li>전날 운동복과 운동화를 준비해 시작할 때 필요한 선택을 줄여보세요.</li>
          <li>오늘의 실천을 마친 뒤 사진을 남기고 바로 인증하는 순서를 정해보세요.</li>
          <li>하루를 놓쳤다면 다음 실천부터 다시 이어가요. 누락된 날짜의 기록 처리는 운영자와 상의할 수 있습니다.</li>
        </ul>
      </section>
    </div>
    <nav className="mt-8 flex flex-wrap gap-3" aria-label="챌린지 관련 안내">
      <Link href="/magazine/record-guide" className="rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white">운동 인증 방법 자세히 보기</Link>
      <Link href="/running-community" className="rounded-2xl bg-white px-5 py-4 font-semibold text-slate-700">함께하는 크루 알아보기</Link>
    </nav>
  </article>;
}
