export default function SeasonReportLoading() {
  return (
    <main className="bg-oriwan-bg" aria-busy="true" aria-label="100일 시즌 리포트 불러오는 중">
      <section className="mx-auto w-full max-w-7xl px-2.5 py-3 sm:px-4 sm:py-6">
        <section className="overflow-hidden rounded-[26px] bg-[#101522] px-4 py-5 text-white sm:rounded-[30px] sm:px-7 sm:py-8">
          <div className="h-6 w-44 animate-pulse rounded-full bg-lime-300/70" />
          <div className="mt-4 h-12 w-4/5 max-w-xl animate-pulse rounded-2xl bg-white/10 sm:h-16" />
          <div className="mt-3 h-4 w-3/4 max-w-lg animate-pulse rounded-full bg-white/10" />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[66px] animate-pulse rounded-2xl bg-white/8 ring-1 ring-white/10 sm:h-[74px]" />
            ))}
          </div>
        </section>
        <section className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-[24px] bg-white ring-1 ring-slate-950/5" />
          <div className="h-64 animate-pulse rounded-[24px] bg-white ring-1 ring-slate-950/5" />
        </section>
      </section>
    </main>
  );
}
