// Entry point: load data, render the brand sections and wire the shared page behaviour.
import { loadData, DRAFT_KEY, imgTag, mockTag } from './data.js';
import { esc, telHref, hoursLabel, statusHTML } from './format.js';
import * as cart from './cart.js';
import * as order from './order.js';
import * as menu from './menu.js';
import * as reels from './reels.js';
import * as pwa from './pwa.js';

const $ = (id) => document.getElementById(id);
const hashStore = () => (location.hash.match(/^#menu\/([\w-]+)/) || [])[1];

async function main() {
  let loaded;
  try {
    loaded = await loadData();
  } catch {
    $('menuList').innerHTML = `<div class="empty"><p>ما قدرنا نحمّل المنيو. شيّك عالنت وجرّب كمان مرة.</p>
      <button class="btn btn-dark" type="button" onclick="location.reload()">جرّب كمان مرة</button></div>`;
    return;
  }
  const { data, isDraft } = loaded;

  if (data.settings?.showMock === false) document.documentElement.classList.add('hide-mock');
  if (isDraft) {
    $('draftChip').hidden = false;
    $('draftReset').onclick = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } location.reload(); };
  }

  cart.restore(data);
  order.init(data);
  menu.init(data, hashStore());
  renderStores(data);
  rowDots($('storesRow'), $('storeDots'));
  reels.init(data);
  renderVisit(data);
  rowDots($('visitGrid'), $('visitDots'));
  renderFooter(data);
  setupHeader();
  setupReveal();
  setupRouting();
  pwa.init();

  if (hashStore()) requestAnimationFrame(() => menu.select(hashStore(), { scroll: true, instant: true }));
}

/* ---------- stores (story cards) ---------- */
const STEPS = ['أول محل', 'المحل التاني', 'المحل التالت'];

function renderStores(data) {
  $('storesRow').innerHTML = data.stores.map((s, i) => `
    <a class="store-card" href="#menu/${esc(s.id)}" data-reveal>
      ${imgTag(s.cover, { alt: '', sizes: '(min-width: 980px) 340px, 80vw', w: 400, h: 500 })}
      <span class="store-num">0${i + 1}</span>
      <span class="store-step">${STEPS[i] || ''}</span>
      <h3 class="store-name">${esc(s.nameEn)}</h3>
      <p class="store-kind">${esc(s.nameAr)} · ${esc(s.kind)}</p>
      <p class="store-story">${esc(s.story || s.tagline)}</p>
      <span class="store-go">شوف المنيو <svg><use href="#i-arrow"/></svg></span>
    </a>`).join('');
}

/* ---------- visit ---------- */
function renderVisit(data) {
  const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  $('visitGrid').innerHTML = data.stores.map((s) => `
    <article class="place" data-reveal>
      ${imgTag(s.storefront, { alt: `واجهة ${s.nameEn}`, sizes: '(min-width: 980px) 360px, 80vw', w: 400, h: 478 })}
      <div class="place-body">
        <h3>${esc(s.nameEn)}</h3>
        <p class="place-line"><svg><use href="#i-pin"/></svg><span>${esc(s.address)}${mockTag(s, 'address')}</span></p>
        <p class="place-line"><svg><use href="#i-clock"/></svg><span>${esc(hoursLabel(s.hours))}${mockTag(s, 'hours')}</span></p>
        <p class="place-line">${statusHTML(s)}</p>
        <div class="place-actions">
          <a class="btn btn-gold" href="${telHref(s.phone)}"><svg><use href="#i-phone"/></svg>اتصل</a>
          <a class="btn btn-line" href="${maps(s.mapsQuery || `${s.nameEn} ${data.brand.city}`)}" target="_blank" rel="noopener"><svg><use href="#i-pin"/></svg>عالخريطة</a>
        </div>
      </div>
    </article>`).join('');
}

function renderFooter(data) {
  $('footerSocial').innerHTML = data.stores.map((s) =>
    `<a class="social" href="${esc(s.facebook)}" target="_blank" rel="noopener"><svg><use href="#i-fb"/></svg><span dir="ltr">${esc(s.nameEn)}</span>${mockTag(s, 'facebook')}</a>`).join('') +
    `<a class="social" href="${esc(data.brand.instagram)}" target="_blank" rel="noopener"><svg><use href="#i-ig"/></svg>إنستغرام${mockTag(data.brand, 'instagram')}</a>`;
}

/* ---------- header: transparent over the hero, hides on scroll down ---------- */
function setupHeader() {
  const bar = $('topbar');
  const hero = document.querySelector('.hero');
  let lastY = scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY;
    bar.classList.toggle('solid', y > hero.offsetHeight - bar.offsetHeight - 10);
    const away = y > lastY + 4 && y > hero.offsetHeight * 0.8 && !document.documentElement.classList.contains('locked');
    const back = y < lastY - 4 || y < 80;
    if (away) bar.classList.add('away');
    else if (back) bar.classList.remove('away');
    document.body.classList.toggle('header-away', bar.classList.contains('away'));
    lastY = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- reveal on scroll ---------- */
/* ---------- swipe rows: position dots ---------- */
function rowDots(row, dots) {
  const cards = [...row.children];
  dots.innerHTML = cards.map(() => '<i></i>').join('');
  dots.firstElementChild?.classList.add('on');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting || en.intersectionRatio < 0.6) return;
    const i = cards.indexOf(en.target);
    dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i));
  }), { root: row, threshold: 0.6 });
  cards.forEach((c) => io.observe(c));
}

function setupReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

/* ---------- #menu/<store> links (store cards, PWA shortcuts, shared links) ---------- */
function setupRouting() {
  // handled in JS (not as a hash jump) so tapping the same store twice still works, and the menu lands docked
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#menu/"], a[href="#menu"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    const id = a.getAttribute('href').split('/')[1];
    if (id) menu.select(id, { scroll: true });
    else menu.dock();
  });
  window.addEventListener('hashchange', () => {
    const id = hashStore();
    if (id) menu.select(id, { scroll: true });
  });
}

main();
