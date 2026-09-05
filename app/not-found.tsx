import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen min-h-svh place-items-center bg-[#f4f7fb] px-4 py-10 text-slate-950">
      <section className="w-full max-w-[460px] rounded-[30px] bg-white p-7 text-center shadow-[0_20px_60px_rgba(27,45,74,0.1)] ring-1 ring-slate-950/5 sm:p-9" aria-labelledby="not-found-title">
        <p className="text-xs font-black text-blue-600">404 · TWTT</p>
        <h1 id="not-found-title" className="mt-3 text-2xl font-black tracking-[-0.03em]">길을 잠시 벗어났어요</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">요청한 화면이 없거나 주소가 바뀌었습니다.</p>
        <Link href="/4th" className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white">4기 화면으로 돌아가기</Link>
      </section>
    </main>
  );
}
