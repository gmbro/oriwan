"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links=[['/about','소개'],['/magazine','매거진']] as const;
export function SpectatorNavigation(){const path=usePathname();return <nav aria-label="스내사 둘러보기" className="border-t border-slate-100 bg-white"><div className="mx-auto flex max-w-6xl gap-1 px-2 py-3 sm:gap-2 sm:px-4">{links.map(([href,label])=><Link key={href} href={href} aria-current={path.startsWith(href)?'page':undefined} className="flex-1 whitespace-nowrap rounded-full px-1 py-2 text-center text-xs sm:flex-none sm:px-4 sm:text-sm font-semibold text-slate-500 transition hover:bg-slate-50 aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-600"><span className="sm:hidden">{label}</span><span className="hidden sm:inline">{label}</span></Link>)}</div></nav>;}
