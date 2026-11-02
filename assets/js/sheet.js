// Bottom sheets and the receipt dialog. One layer at a time; opening another swaps it.
// Integrates with history so the Android back button closes the sheet instead of leaving the page.

const layer = () => document.getElementById('layer');
let current = null; // { el, scrim, onClose, lastFocus }

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function sheetHTML({ title, body, foot }) {
  return `
    <div class="sheet-grab" aria-hidden="true"></div>
    <div class="sheet-head">
      <h3 id="sheetTitle">${title}</h3>
      <button class="icon-btn" type="button" data-close aria-label="سكّر"><svg><use href="#i-close"/></svg></button>
    </div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
}

/**
 * Open a sheet ({title, body, foot}) or a dialog ({dialog: html}).
 * onMount(el) wires events; onClose() runs after it is gone.
 */
export function open({ title = '', body = '', foot = '', dialog = null, onMount, onClose } = {}) {
  const swapping = !!current;
  if (current) teardown(current, true);

  const scrim = swapping ? layer().querySelector('.scrim') : document.createElement('div');
  if (!swapping) {
    scrim.className = 'scrim';
    layer().appendChild(scrim);
  }

  let el;
  if (dialog) {
    el = document.createElement('div');
    el.className = 'dialog';
    el.innerHTML = dialog;
    el.firstElementChild.setAttribute('role', 'dialog');
    el.firstElementChild.setAttribute('aria-modal', 'true');
  } else {
    el = document.createElement('section');
    el.className = 'sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'sheetTitle');
    el.innerHTML = sheetHTML({ title, body, foot });
    enableDrag(el);
  }
  layer().appendChild(el);

  const lastFocus = swapping ? current?.lastFocus : document.activeElement;
  current = { el, scrim, onClose, lastFocus };
  document.documentElement.classList.add('locked');
  if (!swapping && history.state?.golden !== 'sheet') history.pushState({ golden: 'sheet' }, '');

  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (!c) return;
    const href = c.getAttribute('href');
    if (href && href.startsWith('#')) {
      // in-page link inside a sheet: close first (history.back), then scroll, so the hash jump isn't undone
      e.preventDefault();
      close();
      setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }), 120);
    } else close();
  });
  scrim.onclick = () => close();
  onMount?.(el);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    scrim.classList.add('on');
    (dialog ? el.firstElementChild : el).classList.add('on');
    // focus the panel itself so screen readers land in the dialog without a stray focus ring on a button
    const panel = dialog ? el.firstElementChild : el;
    panel.tabIndex = -1;
    (el.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true });
  }));
  return el;
}

/** Close via history so back/forward stay in sync. */
export function close() {
  if (!current) return;
  if (history.state?.golden === 'sheet') history.back();
  else finish();
}

export const isOpen = () => !!current;

function finish() {
  if (!current) return;
  const c = current;
  current = null;
  teardown(c, false);
  document.documentElement.classList.remove('locked');
  c.lastFocus?.focus?.({ preventScroll: true });
}

function teardown(c, swapping) {
  const panel = c.el.classList.contains('dialog') ? c.el.firstElementChild : c.el;
  panel.classList.remove('on');
  if (!swapping) c.scrim.classList.remove('on');
  const remove = () => { c.el.remove(); if (!swapping) c.scrim.remove(); };
  if (swapping) remove();
  else setTimeout(remove, 450);
  c.onClose?.();
}

window.addEventListener('popstate', () => { if (current) finish(); });

document.addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key !== 'Tab') return;
  const nodes = [...current.el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/** Drag the grab bar or header down to dismiss. */
function enableDrag(sheet) {
  let startY = 0, dy = 0, t0 = 0, dragging = false;
  const handles = () => [sheet.querySelector('.sheet-grab'), sheet.querySelector('.sheet-head')];
  const down = (e) => {
    if (e.target.closest('button, a')) return;
    dragging = true; startY = e.clientY; dy = 0; t0 = performance.now();
    sheet.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const v = dy / Math.max(1, performance.now() - t0);
    sheet.style.transform = '';
    if (dy > 110 || (dy > 40 && v > 0.6)) close();
  };
  requestAnimationFrame(() => handles().forEach((h) => {
    if (!h) return;
    h.addEventListener('pointerdown', down);
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  }));
}

let toastTimer;
/** Short status message; optional action button. */
export function toast(msg, action) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${msg}</span>${action ? `<button type="button">${action.label}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { action.run(); t.classList.remove('on'); };
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), action ? 8000 : 2600);
}
