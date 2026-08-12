import Image from "next/image";

const BONANZA_INSTAGRAM_URL = "https://www.instagram.com/bonanzacoffee_korea/";

const bannerFrameClassName =
  "relative aspect-[1718/802] min-h-[138px] overflow-hidden rounded-[22px] bg-slate-800 shadow-lg shadow-slate-950/15 ring-1 ring-slate-950/10 sm:aspect-[5/2] sm:rounded-[28px] lg:aspect-[3/1]";

export function MemberServiceAdPocBanner() {
  return (
    <aside className="mb-3 px-2.5 sm:mb-4 sm:px-0" aria-label="멤버 서비스 광고 POC">
      <a
        href={BONANZA_INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="광고: Bonanza Coffee Korea 인스타그램 새 탭에서 열기"
        className={`group block focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime-300 ${bannerFrameClassName}`}
      >
        <Image
          src="/images/poc/bonanza-coffee-korea-store.jpg"
          alt=""
          fill
          sizes="(max-width: 639px) calc(100vw - 20px), (max-width: 1312px) calc(100vw - 32px), 1280px"
          preload
          className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/5 to-slate-950/30" aria-hidden="true" />

        <span className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3 sm:p-5">
          <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-black text-slate-950 shadow-sm sm:px-3 sm:text-[10px]">
            POC · MEMBER SERVICE
          </span>
          <span className="rounded-full bg-slate-950/70 px-2.5 py-1 text-[9px] font-black text-white ring-1 ring-white/25 backdrop-blur-sm sm:text-[10px]">
            광고
          </span>
        </span>

        <span className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-3 p-3 text-white sm:p-5">
          <span className="min-w-0">
            <span className="block text-[10px] font-black text-lime-200 sm:text-xs">BONANZA COFFEE KOREA</span>
            <span className="mt-0.5 block text-lg font-black leading-tight drop-shadow-sm sm:text-2xl">
              오늘의 러닝 뒤, 좋은 커피 한 잔
            </span>
          </span>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-300 text-xl font-black text-slate-950 shadow-lg transition-colors group-hover:bg-lime-200 sm:h-12 sm:w-12" aria-hidden="true">
            ↗
          </span>
        </span>
      </a>
    </aside>
  );
}

export function MemberServiceAdPocBannerSkeleton() {
  return (
    <div className="mb-3 px-2.5 sm:mb-4 sm:px-0" aria-hidden="true">
      <div className={`${bannerFrameClassName} animate-pulse bg-slate-300`} />
    </div>
  );
}
