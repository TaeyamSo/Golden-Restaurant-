// Turns filled calligraphy outlines into "pen strokes": centerlines in writing order, each with the brush
// width needed to cover its letters. Used by brand-svg.mjs to build a handwriting reveal mask.
//   rasterize → Zhang–Suen thinning → trace skeleton graph → order strokes right-to-left → simplify
import sharp from 'sharp';

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

async function rasterize(paths, box, height) {
  const s = height / box.h;
  const W = Math.ceil(box.w * s), H = Math.ceil(box.h * s);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#fff"/>${paths.map((d) => `<path d="${d}" fill="#000"/>`).join('')}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const img = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) img[i] = data[i * info.channels] < 128 ? 1 : 0;
  return { img, W, H, s };
}

/** Chamfer (3-4) distance to the nearest background pixel, divided by 3 ≈ pixels. */
function distance(img, W, H) {
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = img[i] ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!img[i]) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!img[i]) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}

function thin(src, W, H) {
  const img = Uint8Array.from(src);
  const p = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[y * W + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const kill = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!img[y * W + x]) continue;
        const n = [p(x, y - 1), p(x + 1, y - 1), p(x + 1, y), p(x + 1, y + 1), p(x, y + 1), p(x - 1, y + 1), p(x - 1, y), p(x - 1, y - 1)];
        const b = n.reduce((a, v) => a + v, 0);
        if (b < 2 || b > 6) continue;
        let a = 0;
        for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) a++;
        if (a !== 1) continue;
        if (step === 0 ? n[0] * n[2] * n[4] || n[2] * n[4] * n[6] : n[0] * n[2] * n[6] || n[0] * n[4] * n[6]) continue;
        kill.push(y * W + x);
      }
      for (const i of kill) img[i] = 0;
      if (kill.length) changed = true;
    }
  }
  return img;
}

/** Ramer–Douglas–Peucker. */
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const dist = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (dist > max) { max = dist; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

/**
 * @param paths  filled glyph path data, in the viewBox's user units
 * @param box    {x, y, w, h} viewBox
 * @returns strokes in writing order: [{ d, width, length }] in user units, plus debug info
 */
export async function inkStrokes(paths, box, { height = 420 } = {}) {
  const { img, W, H, s } = await rasterize(paths, box, height);
  const dist = distance(img, W, H);
  const sk = thin(img, W, H);
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && sk[y * W + x] === 1;
  const nbrs = (x, y) => N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([u, v]) => on(u, v));

  // connected components of the skeleton
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y) || comp[y * W + x] >= 0) continue;
    const id = comps.length, px = [], stack = [[x, y]];
    comp[y * W + x] = id;
    while (stack.length) {
      const [u, v] = stack.pop(); px.push([u, v]);
      for (const [a, b] of nbrs(u, v)) if (comp[b * W + a] < 0) { comp[b * W + a] = id; stack.push([a, b]); }
    }
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
    comps.push({ id, px, x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) });
  }

  // dots (small marks) are written right after the letter body underneath them
  const isDot = (c) => Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < H * 0.16;
  const bodies = comps.filter((c) => !isDot(c)).sort((a, b) => b.x2 - a.x2);
  const order = [];
  for (const body of bodies) {
    order.push(body);
    comps.filter(isDot).filter((d) => {
      const cx = (d.x1 + d.x2) / 2;
      const owner = bodies.reduce((best, b) => {
        const gap = cx < b.x1 ? b.x1 - cx : cx > b.x2 ? cx - b.x2 : 0;
        return gap < best.gap ? { b, gap } : best;
      }, { b: null, gap: Infinity }).b;
      return owner === body;
    }).sort((a, b) => b.x2 - a.x2).forEach((d) => order.push(d));
  }

  const toUser = ([x, y]) => [box.x + (x + 0.5) / s, box.y + (y + 0.5) / s];
  const items = [];
  for (const c of order) {
    const key = (x, y) => y * W + x;
    // dots: their skeleton collapses to a point, so the pen just dabs them, sized from the thickest pixel
    if (isDot(c)) {
      const [cx, cy] = c.px.reduce((a, b) => (dist[key(...b)] > dist[key(...a)] ? b : a));
      const r = Math.max(...c.px.map(([x, y]) => dist[key(x, y)]));
      const [ux, uy] = toUser([cx, cy]);
      items.push({ dab: true, cx: +ux.toFixed(1), cy: +uy.toFixed(1), r: +((r * 1.35 + 2) / s).toFixed(1) });
      continue;
    }
    const deg = (x, y) => nbrs(x, y).length;
    const usedStep = new Set(); // undirected pixel steps already drawn
    const stepKey = (a, b) => (key(...a) < key(...b) ? `${key(...a)}-${key(...b)}` : `${key(...b)}-${key(...a)}`);
    const nodes = c.px.filter(([x, y]) => deg(x, y) !== 2);
    // a pen starts top-right: pick the end that is furthest right and up; closed loops start at their rightmost pixel
    const penScore = ([x, y]) => x - y;
    const ends = c.px.filter(([x, y]) => deg(x, y) <= 1);
    const startPool = ends.length ? ends : nodes.length ? nodes : c.px;
    const start = startPool.reduce((a, b) => (penScore(b) > penScore(a) ? b : a));
    const own = [];

    // depth-first walk: follow the smoothest continuation, branches become separate strokes
    const pending = [{ from: start, dir: [-1, 0] }];
    const seenNode = new Set();
    while (pending.length) {
      const { from, dir } = pending.pop();
      let options = nbrs(...from).filter((n) => !usedStep.has(stepKey(from, n)));
      if (!options.length) continue;
      // prefer continuing in the same direction, then heading left
      options.sort((a, b) => {
        const sa = (a[0] - from[0]) * dir[0] + (a[1] - from[1]) * dir[1] - 0.3 * (a[0] - from[0]);
        const sb = (b[0] - from[0]) * dir[0] + (b[1] - from[1]) * dir[1] - 0.3 * (b[0] - from[0]);
        return sb - sa;
      });
      // the others are revisited later from this node, as their own strokes
      for (const o of options.slice(1).reverse()) pending.push({ from, dir: [o[0] - from[0], o[1] - from[1]], only: o });
      let cur = from, next = options[0];
      const run = [cur];
      while (next) {
        usedStep.add(stepKey(cur, next));
        const d = [next[0] - cur[0], next[1] - cur[1]];
        run.push(next);
        cur = next;
        const more = nbrs(...cur).filter((n) => !usedStep.has(stepKey(cur, n)) && !(n[0] === run[run.length - 2][0] && n[1] === run[run.length - 2][1]));
        if (!more.length) break;
        if (more.length > 1 && !seenNode.has(key(...cur))) {
          seenNode.add(key(...cur));
          more.sort((a, b) => ((b[0] - cur[0]) * d[0] + (b[1] - cur[1]) * d[1]) - ((a[0] - cur[0]) * d[0] + (a[1] - cur[1]) * d[1]));
          for (const o of more.slice(1).reverse()) pending.push({ from: cur, dir: [o[0] - cur[0], o[1] - cur[1]] });
        }
        next = more[0];
      }
      if (run.length < 2) continue;
      // each stroke runs from its top-right end, like a pen would
      if (penScore(run[run.length - 1]) > penScore(run[0])) run.reverse();
      const thick = Math.max(...run.map(([x, y]) => dist[key(x, y)]));
      own.push({ pts: simplify(run, 1.2), thick, len: run.length, right: Math.max(...run.map((p) => p[0])) });
    }
    // within a letter group, side branches are written where they sit, so the ink keeps moving right to left.
    // Skeleton spurs shorter than ~the stroke's thickness are thinning noise at letter tips: dropped.
    // (measured against the group's full stroke thickness: a spur's own tip is always thin)
    const groupThick = Math.max(...own.map((st) => st.thick));
    const kept = own.filter((st) => st.len >= groupThick * 0.9).sort((a, b) => b.right - a.right);
    if (!kept.length) continue;
    items.push({
      run: true,
      strokes: kept.map((st) => {
        const u = st.pts.map(toUser);
        return {
          pts: u,
          // tight brush: just the letter's thickness plus a pixel, so neighbouring strokes aren't revealed early
          width: +((st.thick * 2 + 1.5) / s).toFixed(1),
          length: st.len / s,
        };
      }),
    });
  }
  // items, in writing order: { run, strokes: [{ pts, width, length }] } for each connected letter group
  // (one pen-down), and { dab, cx, cy, r } for each dot
  return { items, debug: { W, H, s, sk, order: order.map((c) => c.id) } };
}
