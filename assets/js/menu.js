// Menu section: store tabs, category chips with scroll-spy, item cards and their add/stepper controls.
import * as cart from './cart.js';
import { requestAdd } from './order.js';
import { findStore, imgTag, mockTag, minPrice, monogram } from './data.js';
import { esc, money, telHref, hoursLabel, statusHTML } from './format.js';

let data;
let storeId;
const $ = (id) => document.getElementById(id);

export function init(d, initialStore) {
  data = d;
  storeId = findStore(data, initialStore) ? initialStore : data.stores[0].id;
  renderTabs();
  render();
  $('storeTabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-store]');
    if (t && t.dataset.store !== storeId) select(t.dataset.store, { slide: true });
  });
  $('storeTabs').addEventListener('keydown', onTabKeys);
  $('catChips').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) jumpTo(c.dataset.cat);
  });
  $('menuList').addEventListener('click', onListClick);
  $('menuList').addEventListener('load', (e) => e.target.classList?.remove('lazy'), true);
  cart.subscribe(updateActions);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => moveInk(false), { passive: true });
}

export const current = () => storeId;

/**
 * Switch store. Tabs slide the list sideways (no visible page scroll); store cards, the hero button and
 * #menu/<id> links pass { scroll: true } to bring the start of the menu under the pinned tabs.
 */
export function select(id, { scroll = false, instant = false, slide = false } = {}) {
  if (!findStore(data, id)) return;
  const ids = data.stores.map((s) => s.id);
  const dir = ids.indexOf(id) > ids.indexOf(storeId) ? 1 : -1;
  const changed = id !== storeId;
  storeId = id;
  history.replaceState(history.state, '', `#menu/${id}`);
  if (changed) {
    if (slide) slideTo(dir);
    else render();
  }
  updateTabs();
  if (scroll) scrollToMenu(instant);
}

/* ---------- page position ---------- */
const topbar = () => document.getElementById('topbar');
const headerH = () => topbar().offsetHeight;

function hideHeader(ms = 0) {
  topbar().classList.add('away');
  document.body.classList.add('header-away');
  // keep app.js's scroll handler from bringing the header back after our own upward jump
  if (ms) {
    window.__golden = window.__golden || {};
    window.__golden.ignoreHeaderUntil = Date.now() + ms;
  }
}

function jumpPage(y) {
  // html has scroll-behavior: smooth, so switch it off for jumps that must not be seen
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  root.style.scrollBehavior = '';
}

/** Page offset of the store strip when it sits just under the pinned tabs (header hidden). */
const menuStartY = () => $('storeStrip').getBoundingClientRect().top + scrollY - $('menuNav').offsetHeight - 4;

/** Bring the start of the menu (store strip) just under the pinned tabs. */
export function scrollToMenu(instant = false) {
  const y = menuStartY();
  if (Math.abs(y - scrollY) <= 8) return;
  const goingDown = y > scrollY;
  if (instant) { hideHeader(400); jumpPage(y); return; }
  // going down hides the header; going up brings it back, so leave room for it
  window.scrollTo({ top: goingDown ? y : y - headerH(), behavior: 'smooth' });
}

/* ---------- sideways slide between stores ---------- */
let slideTimer;
/** dir 1 = the new tab is further left (RTL "next"): old list leaves to the right, new one comes in from the left. */
function slideTo(dir) {
  const el = $('menuSlide');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(slideTimer);
  // if the visitor is deep in the list, the new store starts at its top: jump there while the list is hidden.
  // The tabs stay pinned during the jump, so no scrolling is seen.
  const resetIfDeep = () => {
    const y = menuStartY();
    if (scrollY > y + 2) { hideHeader(700); jumpPage(y); }
  };
  if (reduce) { render(); resetIfDeep(); return; }
  el.style.transition = 'transform .2s cubic-bezier(.55, 0, 1, .45), opacity .2s ease-in';
  el.style.transform = `translateX(${dir * 28}%)`;
  el.style.opacity = '0';
  slideTimer = setTimeout(() => {
    render();
    resetIfDeep();
    el.style.transition = 'none';
    el.style.transform = `translateX(${-dir * 28}%)`;
    void el.offsetWidth;
    el.style.transition = 'transform .34s cubic-bezier(.22, 1, .36, 1), opacity .3s ease-out';
    el.style.transform = '';
    el.style.opacity = '';
  }, 200);
}

/* ---------- tabs ---------- */
function renderTabs() {
  $('storeTabs').innerHTML = data.stores.map((s) => `
    <button class="store-tab" type="button" role="tab" id="tab-${esc(s.id)}" data-store="${esc(s.id)}" aria-controls="menuList">
      <b>${esc(s.nameEn.replace(/^Golden\s+/i, ''))}</b><small>${esc(String(s.kind || '').split('·')[0].trim())}</small>
    </button>`).join('') + '<span class="tab-ink" aria-hidden="true"></span>';
  updateTabs();
}

function updateTabs() {
  $('storeTabs').querySelectorAll('[data-store]').forEach((t) => {
    const on = t.dataset.store === storeId;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  moveInk(true);
}

function moveInk(animate) {
  const tab = $('storeTabs').querySelector('[aria-selected="true"]');
  const ink = $('storeTabs').querySelector('.tab-ink');
  if (!tab || !ink) return;
  const inset = 18;
  if (!animate) ink.style.transition = 'none';
  ink.style.width = `${tab.offsetWidth - inset * 2}px`;
  ink.style.transform = `translateX(${tab.offsetLeft + inset}px)`;
  if (!animate) requestAnimationFrame(() => { ink.style.transition = ''; });
}

function onTabKeys(e) {
  const keys = { ArrowLeft: 1, ArrowRight: -1 }; // RTL: left moves forward
  if (!(e.key in keys)) return;
  const ids = data.stores.map((s) => s.id);
  const next = ids[(ids.indexOf(storeId) + keys[e.key] + ids.length) % ids.length];
  select(next, { slide: true });
  document.getElementById(`tab-${next}`).focus();
}

/* ---------- list ---------- */
function render() {
  const store = findStore(data, storeId);
  $('storeStrip').innerHTML = `
    <div class="strip-name">${monogram(store, 'sm')}<div><b dir="ltr">${esc(store.nameEn)}</b><span class="strip-sub">${esc(store.nameAr)} · ${esc(store.address)}${mockTag(store, 'address')}</span></div></div>
    ${statusHTML(store)}
    <span class="strip-item"><svg><use href="#i-clock"/></svg>${esc(hoursLabel(store.hours))}${mockTag(store, 'hours')}</span>
    <a href="${telHref(store.phone)}"><svg><use href="#i-phone"/></svg>${esc(store.phone)}</a>${mockTag(store, 'phone')}`;

  $('catChips').innerHTML = store.categories.map((c, i) =>
    `<button class="chip${i === 0 ? ' on' : ''}" type="button" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('');

  $('menuList').innerHTML = store.categories.map((c) => `
    <section class="cat" id="cat-${esc(c.id)}" data-cat-id="${esc(c.id)}" aria-label="${esc(c.name)}">
      <h3 class="cat-title">${esc(c.name)} <small>${c.items.length}</small></h3>
      <div class="items">${c.items.map((it) => itemHTML(store, it)).join('')}</div>
    </section>`).join('');

  $('menuList').querySelectorAll('img.lazy').forEach((img) => { if (img.complete) img.classList.remove('lazy'); });
}

function itemHTML(store, it) {
  const out = it.available === false;
  const priceHTML = it.sizes?.length
    ? `<span class="price"><span class="from">من</span>${money(minPrice(it), data.currency)}</span>`
    : `<span class="price">${money(it.price, data.currency)}</span>`;
  const media = it.img
    ? imgTag(it.img, { alt: it.name, sizes: '(min-width: 980px) 360px, 120px', cls: 'lazy' })
    : `<div class="ph" aria-hidden="true"><span class="ph-letter">${esc(String(it.name).trim().charAt(0))}</span>${mockTag(it, 'img') ? '<span class="mock">صورة mock</span>' : ''}</div>`;
  return `
    <article class="item${out ? ' is-out' : ''}" data-item="${esc(it.id)}">
      <div class="item-body">
        <h4 class="item-name">${esc(it.name)}</h4>
        ${it.desc ? `<p class="item-desc">${esc(it.desc)}</p>` : ''}
        <div class="item-foot">
          <span>${priceHTML}${mockTag(it, ['price', 'name', 'desc'])}</span>
          <div class="item-action">${actionHTML(store, it)}</div>
        </div>
      </div>
      <div class="item-media">${media}</div>
    </article>`;
}

function actionHTML(store, it) {
  if (it.available === false) return '<span class="out-tag">خلصت لليوم</span>';
  const q = cart.itemQty(store.id, it.id);
  if (it.sizes?.length) {
    return q
      ? `<button class="add" type="button" data-pick="${esc(it.id)}">تعديل <span class="count">×${q}</span></button>`
      : `<button class="add" type="button" data-pick="${esc(it.id)}"><svg><use href="#i-plus"/></svg>زيد</button>`;
  }
  return q
    ? `<span class="stepper"><button type="button" data-inc="${esc(it.id)}" aria-label="زيد واحد ${esc(it.name)}"><svg><use href="#i-plus"/></svg></button><output aria-live="polite">${q}</output><button type="button" data-dec="${esc(it.id)}" aria-label="نقّص واحد ${esc(it.name)}"><svg><use href="#i-minus"/></svg></button></span>`
    : `<button class="add" type="button" data-add="${esc(it.id)}" aria-label="زيد ${esc(it.name)} عالطلب"><svg><use href="#i-plus"/></svg>زيد</button>`;
}

function updateActions() {
  const store = findStore(data, storeId);
  $('menuList').querySelectorAll('[data-item]').forEach((el) => {
    const it = store.categories.flatMap((c) => c.items).find((i) => i.id === el.dataset.item);
    if (!it) return;
    const slot = el.querySelector('.item-action');
    const html = actionHTML(store, it).trim();
    if (slot.innerHTML.trim() !== html) {
      // keep keyboard focus on the same control (or the stepper that replaced the add button)
      const fa = slot.contains(document.activeElement) ? document.activeElement : null;
      const which = fa && ['inc', 'dec', 'add', 'pick'].find((k) => fa.hasAttribute(`data-${k}`));
      slot.innerHTML = html;
      if (which) (slot.querySelector(`[data-${which}]`) || slot.querySelector('button'))?.focus({ preventScroll: true });
    }
  });
}

function onListClick(e) {
  const b = e.target.closest('[data-add], [data-inc], [data-dec], [data-pick]');
  if (!b) return;
  const { add, inc, dec, pick } = b.dataset;
  if (add || pick) requestAdd(storeId, add || pick);
  else if (inc) cart.setQty(inc, null, cart.lineQty(inc, null) + 1);
  else if (dec) cart.setQty(dec, null, cart.lineQty(dec, null) - 1);
}

/* ---------- category chips + scroll-spy ---------- */
let spyLock = 0;

function jumpTo(catId) {
  const sec = document.getElementById(`cat-${catId}`);
  if (!sec) return;
  const y = sec.getBoundingClientRect().top + scrollY;
  const goingDown = y > scrollY;
  // going down hides the header (tabs pin to the very top); going up brings it back above the tabs
  const offset = $('menuNav').offsetHeight + (goingDown ? 0 : headerH()) + 6;
  setActiveChip(catId);
  spyLock = Date.now() + 900;
  window.scrollTo({ top: y - offset, behavior: 'smooth' });
}

function setActiveChip(catId) {
  const row = $('catChips');
  let active;
  row.querySelectorAll('.chip').forEach((c) => {
    const on = c.dataset.cat === catId;
    c.classList.toggle('on', on);
    if (on) active = c;
  });
  if (!active) return;
  // center the chip inside its own row; works the same in RTL and LTR
  const r = active.getBoundingClientRect(), rr = row.getBoundingClientRect();
  const delta = r.left + r.width / 2 - (rr.left + rr.width / 2);
  if (Math.abs(delta) > 4) row.scrollBy({ left: delta, behavior: 'smooth' });
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (Date.now() < spyLock) return;
    const navBottom = $('menuNav').getBoundingClientRect().bottom + 24;
    let currentCat = null;
    $('menuList').querySelectorAll('.cat').forEach((sec) => {
      if (sec.getBoundingClientRect().top <= navBottom) currentCat = sec.dataset.catId;
    });
    const first = $('catChips').querySelector('.chip');
    currentCat = currentCat || first?.dataset.cat;
    const on = $('catChips').querySelector('.chip.on');
    if (currentCat && on?.dataset.cat !== currentCat) setActiveChip(currentCat);
  });
}
