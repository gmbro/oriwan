# Healing crew banner release — 2026-09-08

## Deployment

- Project: existing TWTT, `prj_iBuqfuJYSpin7fg6JXuNtb8LNvB6`.
- Deployment: `dpl_yAJhzYMzAR83p5BCAp2nLPDVKDgP` (READY).
- Candidate: https://twtt-bgrrylzw3-gmbros-projects.vercel.app
- Production: https://xn--220bw61afob.kro.kr/4th/dashboard
- Built with `vercel deploy --prod --skip-domain --yes --logs`, verified, then promoted with `vercel promote`.
- Previous production: `dpl_Ef5yVZqVbCMaNGVBftLWka5cbfNa` (rollback reference only; no rollback performed).
- No database migrations, member changes, comment deletions, billing changes or service moves in this release.

## Validation

- Latest local production build (`node node_modules/next/dist/bin/next build --webpack`) passed compilation, TypeScript, all 32 static pages, tracing. Cloud production build also passed (~42 seconds).
- Scoped ESLint passed, `git diff --check` passed.
- 73 existing and new tests passed. Eight banner tests cover real counts, empty/invalid counts, completion wording, time periods, runner thresholds, distinct eight-frame sheets and asset budget.
- 320px/390px local previews and 1440px desktop checked at 0%, 68%, 100% and four time periods. No horizontal overflow. Production mobile measured equal widths (366px) for motivation, hero, summary, crew and comments.
- Fresh local load: background and all visible runner images loaded, motion enhanced, no browser console errors.
- Production browser: current API and rendered banner both show 5 members / 0 completions / 0%; no runner atlas is needed at 0%. Background loaded directly from the CDN asset. No browser console errors.
- Manual pause stops water/sprite CSS animation; resume works. Native modal stops animation locally (two-paint popup timing ~14.1ms). Other ad slide and off-screen scroll stop banner animation in production; returning resumes it.
- HTTP checks: candidate dashboard 200, background 200/120570 bytes, runner B atlas 200/31538 bytes; candidate preview 404. Production dashboard, `/4th`, `/admin`, public snapshot API all 200; production `/preview/crew-banner` 404.

## Measured budget and limits

All five WebP assets total **191,218 bytes** (~186.7KiB), versus the prior static scene's 210,040 bytes. Background 120,570 bytes; two atlases 62,510 bytes together; stills 8,138 bytes together. No animation library or video added. Optional atlas fetches wait for background/page load and idle time.

Local in-app browser, four-second rAF sample, approximately 120Hz display:

| Mode | Samples | Average interval | P95 | >50ms frames | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Static | 480 | 8.3ms | 8.9ms | 0 | 0 |
| Motion | 480 | 8.3ms | 9.3ms | 0 | 0 |

These are local comparative frame measurements, **not** field INP/LCP, CPU-throttled mobile tests, or a guarantee of zero slowdown on every device. Reduced-motion, save-data, 2G, atlas-load failure and a one-time poor-frame sample use static rendering. Off-screen, hidden tab, other carousel slide and open modal pause playback.

The original preload/optimizer path stalled during a fresh in-app-browser load despite the image endpoint returning 200. The final implementation serves the already-compressed background directly with eager/high priority, and only reveals figures after background readiness. A fresh reload then completed with all images ready and no errors. Transient deleted-CSS development logs were from file replacement, not the final build; both local and cloud builds passed afterward.

## Assets and reproduction

- Runtime files: `/Users/panda/Desktop/oriwan/public/images/poc/hello-2027/healing/`
- Original art and full built-in imagegen prompt set: `/Users/panda/Desktop/oriwan/output/imagegen/healing-banner/README.md`
- Mechanical crop/pack/compression: `/Users/panda/Desktop/oriwan/scripts/build-healing-banner-assets.mjs`
- The local-only preview completion note was updated after promotion; production never exposes that route.
