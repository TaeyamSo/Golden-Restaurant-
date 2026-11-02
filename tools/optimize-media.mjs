// Turns the raw WhatsApp media in ../imgvid into web-ready assets:
//   photos  -> assets/img/<name>-400.webp + -800.webp
//   stock photos (imgvid/stock, picked from Unsplash; see sources.txt) -> same
//   hero    -> assets/img/hero-<w>.webp (landscape) + hero-p-<w>.webp (portrait crop for phones)
//   reel stills -> same, cropped above the burned-in subtitles
//   reels   -> assets/video/reel-N.mp4 (+ poster)
//   icons   -> assets/icons/*.png
// Run once: `npm run media` (from tools/). Safe to re-run; outputs are overwritten.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'imgvid', f);
const out = (...p) => join(root, 'assets', ...p);
['img', 'video', 'icons'].forEach((d) => mkdirSync(out(d), { recursive: true }));

const WA = (t, n) => `WhatsApp Image 2026-11-02 at ${t} AM${n ? ` (${n})` : ''}.jpeg`;
const REEL_1 = src('WhatsApp Video 2026-11-02 at 9.18.34 AM.mp4');
const REEL_2 = src('WhatsApp Video 2026-11-02 at 9.20.55 AM.mp4');

// name -> source photo (+ optional crop as {left, top, width, height})
const photos = {
  'bakery-pizza-cheese': { file: WA('9.18.05') },
  'bakery-pizza-veggie': { file: WA('9.18.05', 1) },
  'bakery-pizza-buffalo': { file: WA('9.18.05', 2) },
  'bakery-pizza-pepperoni': { file: WA('9.18.05', 3) },
  'bakery-zaatar-cheese': { file: WA('9.18.06') },
  'bakery-pizza-mix': { file: WA('9.18.06', 1) },
  'bakery-zaatar': { file: WA('9.18.06', 2) },
  'bakery-lahm-ajeen-cheese': { file: WA('9.18.34', 1) },
  'bakery-meat-cheese': { file: WA('9.18.34', 2) },
  'bakery-muhammara-cheese': { file: WA('9.18.35') },
  'bakery-cheese': { file: WA('9.18.35', 1) },
  'bakery-sujuk-cheese': { file: WA('9.18.35', 2) },
  'meals-saj-bread': { file: WA('9.18.04', 1) },
  'meals-saj-griddle': { file: WA('9.18.04', 2) },
  'meals-fettuccine': { file: WA('9.18.36', 2) },
  'meals-chicken-rice': { file: WA('9.18.37', 1) },
  'meals-mulukhiya': { file: WA('9.18.37', 2) },
  'meals-bukhari': { file: WA('9.18.37', 3) },
  'meals-rice-peas': { file: WA('9.18.37', 4) },
};

// Golden Snack menu photos: stock shots (the store has no photos of these items yet)
const stock = ['snack-cover', 'snack-crispy', 'snack-zinger', 'snack-fajita', 'snack-escalope', 'snack-burger',
  'snack-crispy-meal', 'snack-fajita-meal', 'snack-burger-meal', 'snack-grilled-chicken', 'snack-broasted',
  'snack-fries', 'snack-toum', 'snack-soda'];

// stills pulled from reel 1 (720x1280); crops stop above the subtitle band.
// Storefronts keep the full frame width so the signs aren't zoomed in.
const stills = {
  'bakery-storefront': { at: 4.5, crop: 'crop=720:860:0:110' },
  'bakery-oven-manakish': { at: 11, crop: 'crop=660:825:60:75' },
  'snack-storefront': { at: 28.5, crop: 'crop=720:860:0:110' },
  'meals-storefront': { at: 29.5, crop: 'crop=720:860:0:110' },
};

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const kb = (p) => `${Math.round(statSync(p).size / 1024)} KB`;

// food shots are framed 4:5 everywhere in the UI, so crop them here instead of shipping unused pixels
const keepAspect = (name) => /^(hero|brand)-|storefront/.test(name);

async function webp(input, name, crop) {
  for (const w of [400, 800]) {
    let img = sharp(input).rotate();
    if (crop) img = img.extract(crop);
    const file = out('img', `${name}-${w}.webp`);
    const size = keepAspect(name)
      ? { width: w, withoutEnlargement: true }
      : { width: w, height: Math.round(w * 1.25), fit: 'cover', position: sharp.strategy.attention };
    const info = await img.resize(size).webp({ quality: 68, effort: 6 }).toFile(file);
    if (w === 800) console.log(`img  ${name.padEnd(26)} ${info.width}x${info.height}  ${kb(file)}`);
  }
}

for (const [name, { file, crop }] of Object.entries(photos)) await webp(src(file), name, crop);
for (const name of stock) await webp(src(`stock/${name}.jpg`), name);

// hero: wide versions for landscape screens, plus a centered portrait crop so phones get a sharp image
// without downloading the full-width file
{
  const input = src('stock/hero.jpg');
  const { width, height } = await sharp(input).metadata();
  for (const w of [1080, 1600, 2200]) {
    const file = out('img', `hero-${w}.webp`);
    await sharp(input).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
    console.log(`hero ${`hero-${w}`.padEnd(26)} ${kb(file)}`);
  }
  const pw = Math.round(height * (2 / 3));
  const portrait = { left: Math.round((width - pw) / 2), top: 0, width: pw, height };
  for (const w of [720, 1080]) {
    const file = out('img', `hero-p-${w}.webp`);
    await sharp(input).extract(portrait).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
    console.log(`hero ${`hero-p-${w}`.padEnd(26)} ${kb(file)}`);
  }
}

const tmp = join(tmpdir(), 'golden-stills');
mkdirSync(tmp, { recursive: true });
for (const [name, { at, crop }] of Object.entries(stills)) {
  const png = join(tmp, `${name}.png`);
  run(['-ss', String(at), '-i', REEL_1, '-frames:v', '1', '-vf', crop, png]);
  await webp(png, name);
}

// reels: H.264 + AAC with faststart so playback starts before the whole file arrives
const reels = [
  { input: REEL_1, name: 'reel-1', scale: 'scale=540:-2', poster: 13 },
  { input: REEL_2, name: 'reel-2', scale: 'scale=360:-2', poster: 4 },
];
for (const r of reels) {
  const mp4 = out('video', `${r.name}.mp4`);
  if (!existsSync(mp4) || process.argv.includes('--force-video')) {
    run(['-i', r.input, '-vf', r.scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-profile:v', 'main',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', mp4]);
  }
  const png = join(tmp, `${r.name}-poster.png`);
  run(['-ss', String(r.poster), '-i', r.input, '-frames:v', '1', png]);
  const poster = out('video', `${r.name}-poster.webp`);
  await sharp(png).resize({ width: 540, withoutEnlargement: true }).webp({ quality: 60 }).toFile(poster);
  console.log(`vid  ${r.name.padEnd(26)} ${kb(mp4)}  poster ${kb(poster)}`);
}
rmSync(tmp, { recursive: true, force: true });

// app icon: a geometric gold "G" drawn as a path, so it doesn't depend on installed fonts
const icon = (pad) => {
  const s = 512, c = 256, r = 150 - pad * 0.45, sw = 46 - pad * 0.1;
  const a = (deg) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)];
  const [x1, y1] = a(-42), [x2, y2] = a(0);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0D58A"/><stop offset=".55" stop-color="#C9A24A"/><stop offset="1" stop-color="#9A7426"/></linearGradient></defs>
  <rect width="${s}" height="${s}" fill="#1E1410"/>
  <circle cx="${c}" cy="${c}" r="${r + sw * 1.35}" fill="none" stroke="#C9A24A" stroke-opacity=".35" stroke-width="3"/>
  <path d="M${x1} ${y1} A${r} ${r} 0 1 0 ${x2} ${y2} L${c + 8} ${y2}" fill="none" stroke="url(#g)" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="miter"/>
</svg>`);
};
await sharp(icon(0)).resize(512).png().toFile(out('icons', 'icon-512.png'));
await sharp(icon(0)).resize(192).png().toFile(out('icons', 'icon-192.png'));
await sharp(icon(0)).resize(180).png().toFile(out('icons', 'apple-touch-icon.png'));
await sharp(icon(0)).resize(32).png().toFile(out('icons', 'favicon-32.png'));
await sharp(icon(90)).resize(512).png().toFile(out('icons', 'icon-maskable-512.png'));
console.log('icons done');
