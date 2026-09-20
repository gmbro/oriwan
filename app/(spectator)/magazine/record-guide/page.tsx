import Link from "next/link";
import { publicPageMetadata } from "@/lib/public-site-metadata";

export const metadata = publicPageMetadata(
  "운동 인증 방법과 하루 한 장 기록 규칙 | 스내사 TWTT",
  "스내사 운동 인증 안내: 로그인 후 내 카드에서 사진을 올리면 업로드한 날의 인증이 완료됩니다. 하루 한 장 제한, 응원상자, 지난 기록 요청 방법을 확인하세요.",
  "/magazine/record-guide",
);

export default function RecordGuidePage() {
  return <article className="rounded-3xl bg-white p-6 [word-break:keep-all] sm:p-9">
    <p className="font-bold text-blue-600">스내사 인증 가이드</p>
    <h1 className="mt-3 text-3xl font-bold leading-tight">운동 인증, 사진 한 장이면 돼요</h1>
    <p className="mt-4 leading-8 text-slate-600">로그인 → 멤버에서 내 카드 → 사진 업로드 → 인증 완료 → 응원상자 열기. 완료한 기록은 내 캘린더에서 확인할 수 있어요.</p>
    <div className="mt-7 space-y-7 leading-8 text-slate-600">
      <section><h2 className="text-lg font-bold text-slate-900">인증 날짜는 업로드한 날이에요</h2><p className="mt-2">한국 시간으로 사진을 올린 날짜에 인증됩니다. 사진 속 날짜를 따로 선택하거나 입력할 필요가 없어요. 지난 날짜로 등록해야 하는 운동 기록은 운영자에게 직접 요청해주세요.</p></section>
      <section><h2 className="text-lg font-bold text-slate-900">날짜가 안 보이는 사진도 가능한가요?</h2><p className="mt-2">가능해요. 운동 앱의 캡처뿐 아니라 배경사진이 있는 인증샷도 올릴 수 있습니다. 거리나 시간이 읽히지 않는 값은 임의로 채워 넣지 않으며, 내 기록에서 확인하거나 운영자에게 수정을 요청할 수 있어요.</p></section>
      <section><h2 className="text-lg font-bold text-slate-900">오늘 인증을 이미 완료했어요</h2><p className="mt-2">하루에 한 장만 인증할 수 있습니다. 인증 후에는 ‘오늘 인증완료!’ 버튼이 비활성화되고, 다음 날 0시에 다시 인증할 수 있어요. 같은 날의 추가 사진이나 기존 기록 변경은 운영자에게 문의해주세요.</p></section>
      <section><h2 className="text-lg font-bold text-slate-900">응원상자는 언제 열 수 있나요?</h2><p className="mt-2">인증을 마친 직후 ‘응원상자가 도착했어요’ 안내의 ‘열어보기’를 눌러주세요. 인증과 연결된 흐름에서 열 수 있습니다.</p></section>
      <section><h2 className="text-lg font-bold text-slate-900">업로드가 되지 않을 때는</h2><p className="mt-2">화면에 표시된 오류 안내를 확인해주세요. 로그인이나 네트워크 상태를 확인한 뒤 다시 시도하고, 이미 인증됐는지는 내 카드의 캘린더에서 확인할 수 있어요. 계속 실패한다면 오류 문구와 사진을 운영자에게 전달해주세요.</p></section>
    </div>
    <nav aria-label="인증 관련 페이지" className="mt-8 flex flex-wrap gap-x-6 text-sm font-semibold text-blue-600">
      <Link href="/habit-challenge" className="inline-flex min-h-11 items-center">100일 챌린지 안내 →</Link>
      <Link href="/" className="inline-flex min-h-11 items-center">러닝보드로 돌아가기 →</Link>
    </nav>
  </article>;
}
