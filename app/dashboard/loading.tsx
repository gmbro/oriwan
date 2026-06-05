import Image from "next/image";

function GaugeSkeleton() {
  return (
    <div className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-slate-950/5 sm:px-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-3">
        <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-oriwan-surface-light sm:h-10 sm:w-10" />
        <span className="grid min-w-0 gap-2">
          <span className="h-3.5 w-24 animate-pulse rounded-full bg-oriwan-surface-light" />
          <span className="h-2 w-full animate-pulse rounded-full bg-oriwan-surface-light" />
        </span>
        <span className="h-7 w-12 animate-pulse rounded-full bg-oriwan-surface-light" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-oriwan-bg">
      <header className="sticky top-0 z-50 border-b border-slate-950/10 bg-[#101522]/95 px-3 py-2.5 text-white backdrop-blur-2xl sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/oriwan-logo-v2.png" alt="스내사 러닝보드" width={38} height={38} className="rounded-2xl bg-lime-300" priority />
            <h1 className="font-rounded-title truncate text-[24px] leading-none sm:text-[32px]">스내사 러닝보드</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-4 sm:py-6">
        <section className="overflow-hidden bg-white sm:rounded-[32px] sm:shadow-2xl sm:shadow-slate-950/10 sm:ring-1 sm:ring-slate-950/5">
          <div className="overflow-hidden bg-[#101522] px-4 py-5 text-white sm:p-7">
            <div className="mx-auto max-w-6xl">
              <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-6">
                <h2 className="whitespace-nowrap text-[clamp(2.05rem,8.8vw,3.75rem)] font-black leading-[1.04] text-white">
                  오늘의 인증
                </h2>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <span className="h-8 w-14 animate-pulse rounded-full bg-white/10 ring-1 ring-white/10 sm:w-16" />
                  <span className="h-8 w-14 animate-pulse rounded-full bg-lime-300/80 sm:w-16" />
                </div>
              </div>

              <div className="w-full rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10 shadow-2xl shadow-slate-950/20 sm:rounded-[30px] sm:p-5 lg:ml-auto lg:max-w-[27rem] lg:p-6">
                <div className="flex items-center justify-between gap-4 sm:gap-5">
                  <div className="min-w-0">
                    <div className="h-16 w-32 animate-pulse rounded-3xl bg-lime-200/35 sm:h-20 sm:w-40" />
                    <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-white/10" />
                  </div>
                  <div className="h-[clamp(5.75rem,24vw,8.5rem)] w-[clamp(5.75rem,24vw,8.5rem)] shrink-0 animate-pulse rounded-full border-[14px] border-lime-300/70 border-r-white/10" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2">
                {["진행일", "주차별 인증률", "매일 인증률"].map((label, index) => (
                  <div
                    key={label}
                    className={`min-w-0 rounded-2xl px-1.5 py-2.5 text-center ring-1 ring-white/10 sm:rounded-3xl sm:px-3 sm:py-4 ${
                      index === 2 ? "bg-lime-300 text-slate-950" : "bg-white/10 text-white"
                    }`}
                  >
                    <p className={`truncate text-[10px] font-black ${index === 2 ? "opacity-60" : "text-white/50"}`}>{label}</p>
                    <div className={`mx-auto mt-2 h-6 w-14 animate-pulse rounded-full ${index === 2 ? "bg-slate-950/15" : "bg-white/10"}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-2.5 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-base font-black leading-tight text-oriwan-text">스내사 크루별 인증게이지</h4>
              <span className="h-7 w-20 animate-pulse rounded-full bg-lime-300" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 8 }, (_, index) => (
                <GaugeSkeleton key={index} />
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
