import Link from "next/link";
import type {Metadata} from "next";
import {OperatorSupport} from "@/components/operator-support";
export const metadata:Metadata={title:"TWTT 운영자 후원",description:"마음으로 응원하기, 커피 선물, 인프라 비용 지원",robots:{index:false,follow:false}};
export default function SupportPage(){return <main className="min-h-dvh bg-[#f2f4f6] px-3 py-6 sm:py-10"><div className="mx-auto max-w-lg space-y-5"><Link href="/4th/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600">대시보드로 돌아가기</Link><div className="rounded-3xl bg-white p-5 sm:p-7"><OperatorSupport/></div></div></main>;}
