// Builds the loading-screen wordmark as inline SVG paths (no font download needed to animate it):
//   غولدن in Reem Kufi, the site font (shaped with HarfBuzz so the letters join properly), written on by a pen-stroke mask
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
const WRITE_START = 0.25, WRITE_TIME = 1.9, LIFT = 0.14, DAB = 0.16;

/** Pen speed over one pen-down: starts gently, flows, settles — but never fully stops. */
const ease = (x) => 0.55 * x + 0.45 * (1 - Math.cos(Math.PI * x)) / 2;
function easeInv(y) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ease(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const polyLen = (pts) => pts.slice(1).reduce((n, p, i) => n + segLen(pts[i], p), 0);
const fmt = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`;

/** Cut a polyline into pieces no longer than `max` (so each piece can get its own slice of the eased timing). */
function chunk(pts, max) {
  const out = [];
  let cur = [pts[0]], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = cur[cur.length - 1];
    const b = pts[i];
    let rest = segLen(a, b);
    while (acc + rest > max) {
      const f = (max - acc) / rest;
      const cut = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      cur.push(cut);
      out.push(cur);
      cur = [cut]; a = cut; rest = segLen(a, b); acc = 0;
    }
    cur.push(b);
    acc += rest;
  }
  if (cur.length > 1 && polyLen(cur) > 0.01) out.push(cur);
  return out;
}

/**
 * غولدن: the filled letters sit under a mask of pen strokes along their centerlines, in writing order.
 * Each connected letter group is one pen-down whose speed eases over the whole run (approximated by short
 * linear chunks), dots are quick dabs, and a soft gold tip rides along with the pen.
 */
async function handwriting(word, { cls, label, pad }) {
  const vb = viewBox(word, pad);
  const { items } = await inkStrokes(word.glyphs.map((g) => g.d), vb);
  // run duration grows sub-linearly with length so short strokes aren't rushed; then scale to the time budget
  const raw = items.map((it) => (it.dab ? DAB : Math.pow(it.strokes.reduce((n, s) => n + polyLen(s.pts), 0), 0.85)));
  const fixed = items.filter((it) => it.dab).length * DAB + (items.length - 1) * LIFT;
  const runRaw = raw.reduce((n, r, i) => n + (items[i].dab ? 0 : r), 0);
  const k = (WRITE_TIME - fixed) / runRaw;

  let t = WRITE_START;
  const mask = [], tips = [], debug = [];
  items.forEach((it, idx) => {
    if (idx) t += LIFT;
    if (it.dab) {
      mask.push(`<circle class="ld-dab" cx="${it.cx}" cy="${it.cy}" r="${it.r}" fill="#fff" style="--s:${t.toFixed(3)}s"/>`);
      debug.push({ dab: it });
      t += DAB;
      return;
    }
    const D = raw[idx] * k;
    const L = it.strokes.reduce((n, s) => n + polyLen(s.pts), 0);
    const max = L / 14;
    let done = 0;
    for (const s of it.strokes) {
      for (const piece of chunk(s.pts, max)) {
        const len = polyLen(piece);
        const a = t + D * easeInv(done / L), b = t + D * easeInv(Math.min(1, (done + len) / L));
        const timing = `--s:${a.toFixed(3)}s;--t:${Math.max(0.01, b - a).toFixed(3)}s`;
        mask.push(`<path class="ld-pen" pathLength="1" stroke-width="${s.width}" style="${timing}" d="${fmt(piece)}"/>`);
        // the pen tip rides the same piece on the same CSS timing (offset-path), so it never drifts from the ink
        tips.push(`<circle class="ld-tip" r="${(s.width * 0.42).toFixed(1)}" style="${timing};offset-path:path('${fmt(piece)}')"/>`);
        done += len;
      }
      debug.push({ d: fmt(s.pts) });
    }
    t += D;
  });
  const done = t;

  const defs = `<linearGradient id="ldShine" gradientUnits="userSpaceOnUse" x1="${vb.x}" y1="0" x2="${vb.x + vb.w}" y2="0">` +
    '<stop offset="0" stop-color="#B98A2F"/><stop offset=".44" stop-color="#E2BE6A"/><stop offset=".5" stop-color="#FFF0C4"/><stop offset=".56" stop-color="#E2BE6A"/><stop offset="1" stop-color="#B98A2F"/>' +
    `<animateTransform attributeName="gradientTransform" type="translate" from="${vb.w} 0" to="${-vb.w} 0" dur="1.3s" begin="${(done + 0.15).toFixed(2)}s" fill="freeze"/></linearGradient>` +
    '<radialGradient id="ldTipGlow"><stop offset="0" stop-color="#FFF6DA"/><stop offset=".45" stop-color="#F0D58A" stop-opacity=".9"/><stop offset="1" stop-color="#E2BE6A" stop-opacity="0"/></radialGradient>' +
    // .ld-all softly fills any tiny tips the centerlines missed, as the pen finishes
    `<mask id="ldInk" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">${mask.join('')}` +
    `<rect class="ld-all" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff" style="--s:${(done - 0.05).toFixed(2)}s"/></mask>`;
  const glyphs = word.glyphs.map((g) => `<path d="${g.d}"/>`).join('');
  const svg = `<svg class="${cls}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${label}"><defs>${defs}</defs>` +
    `<g mask="url(#ldInk)" fill="url(#ldShine)">${glyphs}</g>${tips.join('')}</svg>`;
  return { svg, debug, vb, done, pieces: mask.length };
}

/** Optional check image: letters in grey, each pen stroke in its own colour with its order number, dots ringed. */
async function debugImage(file, word, { debug, vb }) {
  const scale = vb.h / 500;
  const marks = debug.map((s, i) => {
    const hue = Math.round((i / debug.length) * 300);
    if (s.dab) return `<circle cx="${s.dab.cx}" cy="${s.dab.cy}" r="${s.dab.r}" fill="none" stroke="hsl(${hue} 80% 45%)" stroke-width="${5 * scale}"/>` +
      `<text x="${s.dab.cx}" y="${s.dab.cy}" font-size="${30 * scale}" font-family="Arial" font-weight="bold">${i}</text>`;
    const [x, y] = s.d.slice(1).split('L')[0].split(' ').map(Number);
    return `<path d="${s.d}" fill="none" stroke="hsl(${hue} 80% 45%)" stroke-width="${6 * scale}" stroke-linecap="round"/>` +
      `<text x="${x}" y="${y}" font-size="${30 * scale}" font-family="Arial" font-weight="bold" fill="#000">${i}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vb.w / scale)}" height="500" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">` +
    `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>${word.glyphs.map((g) => `<path d="${g.d}" fill="#ddd"/>`).join('')}${marks}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

// both words in Reem Kufi, the site's display face (the header wordmark and headings use it too)
const [kufiBold, kufi] = await Promise.all([ttf('Reem+Kufi:wght@700'), ttf('Reem+Kufi:wght@600')]);
const ar = shape(kufiBold, 'غولدن');
const en = shape(kufi, 'GOLDEN', 0.42);

const written = await handwriting(ar, { cls: 'ld-ar', label: 'غولدن', pad: ar.upem * 0.04 });
if (process.env.INK_DEBUG) await debugImage(process.env.INK_DEBUG, ar, written);
const markup = [written.svg, letters(en, { cls: 'ld-en', label: 'GOLDEN', pad: en.upem * 0.02 })].join('\n    ');

const html = readFileSync(INDEX, 'utf8');
const re = /(<!-- loader:start -->)[\s\S]*?(<!-- loader:end -->)/;
if (!re.test(html)) throw new Error('loader markers not found in index.html');
if (/NaN/.test(markup)) throw new Error('wordmark has NaN coordinates');
writeFileSync(INDEX, html.replace(re, `$1\n    ${markup}\n    $2`));
console.log(`wordmark written: ${Math.round(markup.length / 1024)} KB inline, ${written.pieces} mask pieces, written by ${written.done.toFixed(2)} s`);
