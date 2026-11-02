// Builds the loading-screen wordmark as inline SVG paths (no font download needed to animate it):
//   غولدن in Aref Ruqaa (shaped with HarfBuzz so the letters join properly), written on by a pen-stroke mask
//   (see ink-path.mjs) + GOLDEN in Reem Kufi.
// Writes it into index.html between <!-- loader:start --> and <!-- loader:end -->.
// Run once: `node brand-svg.mjs` (from tools/). Safe to re-run. INK_DEBUG=<file.png> also saves a stroke-order check image.
import * as hb from 'harfbuzzjs';
import sharp from 'sharp';
import { inkStrokes } from './ink-path.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(root, 'index.html');

/** Google Fonts serves plain TTF when no browser user-agent is sent. */
async function ttf(family) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}`)).text();
  const url = css.match(/url\((https:[^)]+\.ttf)\)/)[1];
  return (await fetch(url)).arrayBuffer();
}

/**
 * Move a glyph outline to (gx, gy) and flip it to SVG's y-down axis, baking the result into the path data.
 * No transform attribute is left on the <path>, so CSS can animate transforms freely.
 * HarfBuzz paths only use absolute M/L/Q/C/Z commands, so every number pair is an (x, y) point.
 */
function place(d, gx, gy) {
  return d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd, args) => {
    const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push(`${Math.round(n[i] + gx)} ${Math.round(-(n[i + 1] + gy))}`);
    return cmd + pts.join(' ');
  });
}

/** Shape text and return positioned glyph paths in font units (y up) plus the word's bounding box. */
function shape(buffer, text, trackingEm = 0) {
  const face = new hb.Face(new hb.Blob(buffer));
  const font = new hb.Font(face);
  const upem = face.upem;
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);
  const infos = buf.getGlyphInfos(), positions = buf.getGlyphPositions();
  let x = 0;
  const glyphs = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  infos.forEach((info, i) => {
    const p = positions[i];
    const d = font.glyphToPath(info.codepoint);
    const e = font.glyphExtents(info.codepoint);
    const gx = x + p.xOffset, gy = p.yOffset;
    if (d && e) {
      glyphs.push({ d: place(d, gx, gy), x: gx, y: gy });
      box.x1 = Math.min(box.x1, gx + e.xBearing);
      box.x2 = Math.max(box.x2, gx + e.xBearing + e.width);
      box.y2 = Math.max(box.y2, gy + e.yBearing);            // top (font units, y up)
      box.y1 = Math.min(box.y1, gy + e.yBearing + e.height); // bottom
    }
    x += p.xAdvance + trackingEm * upem;
  });
  return { glyphs, box, upem };
}

const viewBox = ({ box }, pad) => ({
  x: Math.round(box.x1 - pad), y: Math.round(-box.y2 - pad),
  w: Math.round(box.x2 - box.x1 + pad * 2), h: Math.round(box.y2 - box.y1 + pad * 2),
});

/** GOLDEN: one <path> per letter, --i = its position, for the letter-by-letter rise. */
function letters(word, { cls, label, pad }) {
  const vb = viewBox(word, pad);
  const order = word.glyphs.map((g, i) => [g.x, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const paths = word.glyphs.map((g, i) => `<path style="--i:${order.indexOf(i)}" d="${g.d}"/>`).join('');
  return `<svg class="${cls}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${label}">${paths}</svg>`;
}

// handwriting timing, in seconds from page start
const WRITE_START = 0.25, WRITE_TIME = 1.9, LIFT = 0.12;

/**
 * غولدن: the filled letters sit under a mask made of pen strokes (their centerlines, in writing order).
 * Each stroke draws itself at the same pen speed, so the ink appears exactly where the pen passes.
 */
async function handwriting(word, { cls, label, pad }) {
  const vb = viewBox(word, pad);
  const { strokes } = await inkStrokes(word.glyphs.map((g) => g.d), vb);
  const lifts = strokes.filter((s) => s.lift).length;
  const total = strokes.reduce((n, s) => n + (s.length || 0), 0);
  const speed = total / (WRITE_TIME - lifts * LIFT);
  let t = WRITE_START;
  const pen = strokes.map((s) => {
    if (s.lift) { t += LIFT; return ''; }
    const dur = s.length / speed;
    const el = `<path class="ld-pen" pathLength="1" stroke-width="${s.width}" style="--s:${t.toFixed(3)}s;--t:${dur.toFixed(3)}s" d="${s.d}"/>`;
    t += dur;
    return el;
  }).join('');
  const done = t;
  // gold fill with a highlight that sweeps right-to-left once the word is written
  const shine = `<linearGradient id="ldShine" gradientUnits="userSpaceOnUse" x1="${vb.x}" y1="0" x2="${vb.x + vb.w}" y2="0">` +
    '<stop offset="0" stop-color="#B98A2F"/><stop offset=".44" stop-color="#E2BE6A"/><stop offset=".5" stop-color="#FFF0C4"/><stop offset=".56" stop-color="#E2BE6A"/><stop offset="1" stop-color="#B98A2F"/>' +
    `<animateTransform attributeName="gradientTransform" type="translate" from="${vb.w} 0" to="${-vb.w} 0" dur="1.3s" begin="${(done + 0.1).toFixed(2)}s" fill="freeze"/></linearGradient>`;
  // .ld-all fills in whatever the centerlines missed (letter tips) right as the pen finishes
  const mask = `<mask id="ldInk" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">${pen}` +
    `<rect class="ld-all" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff" style="--s:${(done - 0.1).toFixed(2)}s"/></mask>`;
  const glyphs = word.glyphs.map((g) => `<path d="${g.d}"/>`).join('');
  const svg = `<svg class="${cls}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${label}"><defs>${shine}${mask}</defs>` +
    `<g mask="url(#ldInk)" fill="url(#ldShine)">${glyphs}</g></svg>`;
  return { svg, strokes, vb, done };
}

/** Optional check image: letters in grey, each pen stroke in its own colour with its order number. */
async function debugImage(file, word, { strokes, vb }) {
  const pens = strokes.filter((s) => !s.lift);
  const scale = vb.h / 500;
  const marks = pens.map((s, i) => {
    const [x, y] = s.d.slice(1).split('L')[0].split(' ').map(Number);
    const hue = Math.round((i / pens.length) * 300);
    return `<path d="${s.d}" fill="none" stroke="hsl(${hue} 80% 45%)" stroke-width="${6 * scale}" stroke-linecap="round"/>` +
      `<text x="${x}" y="${y}" font-size="${30 * scale}" font-family="Arial" font-weight="bold" fill="#000">${i}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vb.w / scale)}" height="500" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">` +
    `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>${word.glyphs.map((g) => `<path d="${g.d}" fill="#ddd"/>`).join('')}${marks}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

const [ruqaa, kufi] = await Promise.all([ttf('Aref+Ruqaa:wght@700'), ttf('Reem+Kufi:wght@600')]);
const ar = shape(ruqaa, 'غولدن');
const en = shape(kufi, 'GOLDEN', 0.42);

const written = await handwriting(ar, { cls: 'ld-ar', label: 'غولدن', pad: ar.upem * 0.04 });
if (process.env.INK_DEBUG) await debugImage(process.env.INK_DEBUG, ar, written);
const markup = [written.svg, letters(en, { cls: 'ld-en', label: 'GOLDEN', pad: en.upem * 0.02 })].join('\n    ');

const html = readFileSync(INDEX, 'utf8');
const re = /(<!-- loader:start -->)[\s\S]*?(<!-- loader:end -->)/;
if (!re.test(html)) throw new Error('loader markers not found in index.html');
if (/NaN/.test(markup)) throw new Error('wordmark has NaN coordinates');
writeFileSync(INDEX, html.replace(re, `$1\n    ${markup}\n    $2`));
console.log(`wordmark written: ${Math.round(markup.length / 1024)} KB inline, ${written.strokes.filter((s) => !s.lift).length} pen strokes, written by ${written.done.toFixed(2)} s`);
