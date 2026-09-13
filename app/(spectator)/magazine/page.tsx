import Link from 'next/link';

export const metadata = { title: '스내사 매거진 | TWTT' };
const categories = [
  ['interviews', '멤버 인터뷰'],
  ['activities', '활동 이야기'],
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const selected = categories.find(([key]) => key === category)?.[0] ?? 'interviews';
  const label = categories.find(([key]) => key === selected)![1];
  return <>
    <p className="text-sm font-bold text-blue-600">스내사 매거진</p>
    <h1 className="mt-4 text-[28px] font-bold leading-[1.35] tracking-tight [word-break:keep-all] sm:text-4xl">4기 멤버들의 이야기를 기록합니다.</h1>
    <nav aria-label="매거진 콘텐츠 분류" className="mt-8 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/60 p-1">
      {categories.map(([key, name]) => <Link key={key} href={`/magazine?category=${key}`} scroll={false} aria-current={selected === key ? 'page' : undefined} className="flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-sm font-semibold text-slate-500 transition hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-[current=page]:bg-white aria-[current=page]:text-blue-600 aria-[current=page]:shadow-sm sm:text-sm">{name}</Link>)}
    </nav>
    <section className="mt-7" aria-labelledby="magazine-category-title">
      <h2 id="magazine-category-title" className="mb-4 text-xl font-bold">{label}</h2>
      <div className="rounded-3xl bg-white px-6 py-10"><h3 className="text-lg font-bold">준비 중</h3><p className="mt-3 text-sm leading-7 text-slate-500">모임이 시작되면 {label} 콘텐츠를 이곳에서 전할게요.</p></div>
    </section>
  </>;
}
