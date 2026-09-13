import Link from 'next/link';
export function PublicSiteFooter(){return <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-5 py-9 text-xs text-slate-500"><a href="mailto:gmbro7942@gmail.com" className="font-bold text-slate-600">운영 문의 : 아키랩</a><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link></footer>}
