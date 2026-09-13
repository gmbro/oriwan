# Healing crew banner — 2026-09-08

Generated with the built-in image_gen tool (not CLI). User references: the approved Han River illustration and black TWTT crew shirts; private source photographs are not deployed.

## Assets

- background-original.png: clean background plate, no people.
- runner-a-original.png and runner-b-original.png: two 4×2 sheets of eight independently drawn jogging poses each.
- Runtime: public/images/poc/hello-2027/healing/river.webp, runner-{a,b}-8.webp, runner-{a,b}-still.webp.
- Regenerate compressed assets: node scripts/build-healing-banner-assets.mjs (Node runtime with sharp).
- Background uses 1600px WebP. Each atlas is 1536×256 (eight 192×256 cells).
- The transparent-alpha attempts returned painted checkerboards and were rejected. Final sheets use an opaque pure-white matte with CSS multiply blending. No pixel-based background-removal script was used.
- Mechanical processing only: crop, uniform resize, align, pack and compress generated images. Original source images remain intact.

## Motion rules

- Eight-frame CSS transform sprite loop, 1.2 seconds, independently staggered. No video, canvas loop, animation library, or per-frame React updates.
- Certification progress uses 0–5 illustrative runners, not identifiable member avatars: 0%=0, (0,20]%=1, (20,40]%=2, (40,60]%=3, (60,80]%=4, (80,100]%=5.
- Morning/day/evening/night follow existing Seoul-time phase data. Scene tint transition: 8 seconds. Water: 18 seconds. Cloud glow: 24 seconds. Metric/text never animate with scene.
- Optional atlases load only after the background and page load, during idle time, when visible and permitted. Static figures are the first paint.
- Pause off-screen, hidden tab, another carousel slide, native/ARIA modal, or manual pause. Respect reduced-motion, save-data and 2G; retain static figures on atlas failure. One 90-frame sample switches to static if >12% of frames exceed 50ms.
- Preview fixture is development-only; real production counts come from the existing live snapshot.

## Prompts, including rejected alpha pass

## healingBackgroundPrompt

Use case: precise-object-edit
Image 1: edit target, the approved panoramic hand-painted Han River running crew banner.
Remove only all five people, their clothes and their cast shadows from the path. Fill those areas seamlessly with the continuing softly painted running path, white path markings, riverside grass, trees, and distant scenery. Keep all other parts, panoramic composition, 1918:820 aspect ratio, skyline, bridge, Namsan hill, sky and brushwork unchanged. This is the clean background plate for separately animated runners. Absolutely no people, no silhouettes, no text or numbers. Preserve the warm gentle Studio Ghibli-inspired watercolor/gouache morning scene and low-contrast left-side space. No new objects.

## healingRunnerPrompt

Use case: stylized-concept
Asset type: production animation sprite sheet, 8 successive frames of ONE adult running character on real transparent alpha background.
Reference image 1 is ONLY a reference for the black crew T-shirt's white organic circular line illustration and the gentle hand-painted animation style.
Create exactly 8 full-body frames of the SAME male runner, wearing a black baseball cap, loose black crew T-shirt with the faithful thin white spiral/organic circular back illustration from reference, black running shorts, white crew socks, ivory running shoes. View: consistent rear three-quarter, facing away and slightly to the right (we see back graphic clearly).
Style: warm Studio Ghibli-inspired watercolor/gouache animated film character, hand-painted and soft but clear readable silhouette, matches the reference landscape.
CRITICAL GRID: a perfectly regular 4-column by 2-row sprite sheet, ideally 1536x1024 pixels. Each equal cell 384x512. One character per cell, centered at exactly the same relative x position. Fixed camera, identical character scale, head size, torso/clothing/cap across all 8 frames. Full body fits comfortably with transparent padding on every side. No frames overlap neighboring cells. Top row frames 1,2,3,4 then bottom row frames 5,6,7,8.
Motion: genuinely distinct successive phases of one relaxed gentle jogging gait: (1) left foot forward ground contact/right arm forward, (2) left leg compresses/right foot passes, (3) left leg pushes off/right knee forward, (4) brief flight phase/right leg extends, (5) right foot forward ground contact/left arm forward, (6) right leg compresses/left foot passes, (7) right leg pushes off/left knee forward, (8) brief flight phase/left leg extends, smoothly loops into frame 1. Arms swing oppositely to legs; moderate knee lift, calm exercise pace not sprinting. A subtle natural vertical bob, not eight copies of the same pose. No rotating the character between frames.
Background: GENUINELY TRANSPARENT ALPHA across all empty areas, no white backdrop, NO checkerboard painted into the image, no cast shadow, no ground, no scene.
No labels, frame numbers, grid lines, borders, watermarks or extra objects. Exactly one same character in each of the 8 cells.

## healingAlphaPrompt

Use case: background-extraction
Image 1 is the edit target, an 8-frame running sprite sheet. Remove the ENTIRE gray-and-white checkerboard background. Return a genuinely transparent PNG with alpha=0 everywhere outside each of the eight runner silhouettes. The checkerboard is an unwanted painted background, NOT part of the art. Keep all eight people, their exact positions, all body parts, clothing and shoes completely unchanged. Keep the original 1536x1024 canvas and 4-column 2-row arrangement. No new backdrop, no white matte, no checkerboard, no shadow, no grid. Output actual transparent alpha around every runner.

## healingMattePrompt

Use case: precise-object-edit
Edit target: image 1, a sheet of eight running animation frames.
Change only the background: replace every gray-and-white checkerboard square with a completely uniform pure white #FFFFFF background. Do not request transparency. It MUST be solid pure white, with absolutely no checkerboard, texture, vignette, ground shadow or gray pixels outside the runners.
Keep all eight runner poses, exact positions, 4-column by 2-row equal grid, canvas size, black shirts with white back graphic, body proportions, limbs and colors unchanged. This will be composited using multiply blending on the website. All empty areas must be pure white. No captions, borders, grids or numbers.

## healingSecondRunnerPrompt

Use case: identity-preserve
Image 1 is an animation sprite-sheet layout and gait reference, NOT eight separate characters.
Create the matching second crew runner sheet: change the character consistently across ALL 8 frames into one adult female runner with a pale sky-blue cap, a dark ponytail, loose black crew T-shirt with the same fine white organic circular back graphic, soft sage running shorts, white socks and ivory shoes. Keep the same painterly hand-drawn animation style, rear-three-quarter direction away to the right, scale, positions, 1536x1024 canvas, exact 4 columns x 2 rows, one full body per cell. Preserve the 8 jogging phases but make the second half clearly the opposite foot contact/arm swing to the first half so the cycle includes BOTH left and right steps. Natural gentle jogging not a sprint. No frame overlaps, heads/feet never clipped.
Keep every pixel outside the runners uniform pure white #FFFFFF. This is an opaque sprite sheet for multiply blending, NOT transparency, no checkerboard, no background scene, no ground, no shadow, no grid or captions.

