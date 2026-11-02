// Cart state: one store at a time, persisted on the device.
import { findStore, findItem, unitPrice } from './data.js';

const KEY = 'golden.cart';
let state = { storeId: null, lines: [], note: '' };
const listeners = new Set();

const lineKey = (itemId, sizeId) => `${itemId}|${sizeId || ''}`;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: cart just won't persist */ }
  listeners.forEach((fn) => fn(state));
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;

/** Restore the saved cart, dropping anything the current menu no longer sells. */
export function restore(data) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.lines)) state = { storeId: saved.storeId, lines: saved.lines, note: saved.note || '' };
  } catch { /* ignore corrupt cart */ }
  const store = state.storeId && findStore(data, state.storeId);
  state.lines = store
    ? state.lines.filter((l) => {
        const item = findItem(store, l.itemId);
        if (!item || item.available === false || !(l.qty > 0)) return false;
        return !item.sizes?.length || item.sizes.some((s) => s.id === l.sizeId);
      })
    : [];
  if (!state.lines.length) state = { storeId: null, lines: [], note: '' };
  save();
}

/** Returns { conflict: storeId } instead of adding when the cart belongs to another store. */
export function add(storeId, itemId, sizeId = null, qty = 1) {
  if (state.lines.length && state.storeId !== storeId) return { conflict: state.storeId };
  state.storeId = storeId;
  const k = lineKey(itemId, sizeId);
  const line = state.lines.find((l) => lineKey(l.itemId, l.sizeId) === k);
  if (line) line.qty += qty;
  else state.lines.push({ itemId, sizeId, qty });
  save();
  return { ok: true };
}

export function setQty(itemId, sizeId, qty) {
  const k = lineKey(itemId, sizeId);
  if (qty <= 0) state.lines = state.lines.filter((l) => lineKey(l.itemId, l.sizeId) !== k);
  else {
    const line = state.lines.find((l) => lineKey(l.itemId, l.sizeId) === k);
    if (line) line.qty = qty;
  }
  if (!state.lines.length) { state.storeId = null; state.note = ''; }
  save();
}

export function setNote(note) {
  state.note = note;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function clear() {
  state = { storeId: null, lines: [], note: '' };
  save();
}

export const lineQty = (itemId, sizeId) => state.lines.find((l) => lineKey(l.itemId, l.sizeId) === lineKey(itemId, sizeId))?.qty || 0;
export const itemQty = (storeId, itemId) => (state.storeId === storeId ? state.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0) : 0);

/** Lines joined with menu data, plus count and total. */
export function summary(data) {
  const store = state.storeId && findStore(data, state.storeId);
  if (!store) return { store: null, lines: [], count: 0, total: 0 };
  const lines = state.lines.map((l) => {
    const item = findItem(store, l.itemId);
    const size = item?.sizes?.find((s) => s.id === l.sizeId) || null;
    const unit = item ? unitPrice(item, l.sizeId) : 0;
    return { ...l, item, size, unit, sum: unit * l.qty };
  }).filter((l) => l.item);
  return {
    store,
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    total: lines.reduce((n, l) => n + l.sum, 0),
  };
}
