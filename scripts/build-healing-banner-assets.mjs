import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Mechanical atlas packing only: the illustration/poses/matte are image_gen
// outputs. Keep the originals; no retouching or generated pixels here.
const input = "output/imagegen/healing-banner";
const output = "public/images/poc/hello-2027/healing";
await mkdir(output, { recursive: true });
await sharp(`${input}/background-original.png`).resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 82, effort: 6 }).toFile(`${output}/river.webp`);

for (const runner of ["a", "b"]) {
  const path = `${input}/runner-${runner}-original.png`;
  const { width, height } = await sharp(path).metadata();
  if (width !== 1536 || height !== 1024) throw new Error("Expected a 4×2 1536×1024 sheet");
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const tile = await sharp(path).extract({ left: (i % 4) * 384, top: Math.floor(i / 4) * 512, width: 384, height: 512 }).png().toBuffer();
    const { data, info } = await sharp(tile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = 384, right = 0, top = 512, bottom = 0;
    // Read the non-white bounding box to align each drawing in an equal cell.
    for (let y = 0; y < 512; y++) for (let x = 0; x < 384; x++) {
      const p = (y * 384 + x) * info.channels;
      if (Math.min(data[p], data[p + 1], data[p + 2]) < 225) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (left >= right || top >= bottom) throw new Error(`Empty frame ${runner}/${i}`);
    const cut = await sharp(tile).extract({ left, top, width: right-left+1, height: bottom-top+1 })
      .resize({ width: Math.round((right-left+1) / 2) }).png().toBuffer();
    const meta = await sharp(cut).metadata();
    const normalized = await sharp({ create: { width: 192, height: 256, channels: 3, background: "#fff" } })
      .composite([{ input: cut, left: Math.round((192-meta.width)/2), top: 20 }]).png().toBuffer();
    frames.push(normalized);
  }
  await sharp(frames[0]).webp({ quality: 90, effort: 6 }).toFile(`${output}/runner-${runner}-still.webp`);
  const atlas = await sharp({ create: { width: 1536, height: 256, channels: 3, background: "#fff" } })
    .composite(frames.map((frame, i) => ({ input: frame, left: i*192, top: 0 })))
    .webp({ quality: 90, effort: 6 }).toFile(`${output}/runner-${runner}-8.webp`);
  console.log(runner, atlas);
}
