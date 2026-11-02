// Loads the menu data (or the admin's on-device draft) and renders shared fragments.
import { esc } from './format.js';

export const DRAFT_KEY = 'golden.draft';
export const DATA_URL = new URL('../../data/menu.json', import.meta.url).href;

export async function loadData() {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) return { data: JSON.parse(draft), isDraft: true };
  } catch { /* storage blocked or corrupt draft: fall back to the published menu */ }
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  return { data: await res.json(), isDraft: false };
}

export const findStore = (data, id) => data.stores.find((s) => s.id === id);

export function findItem(store, itemId) {
  for (const cat of store.categories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return null;
}

/** Unit price for an item (and size, when the item has sizes). */
export function unitPrice(item, sizeId) {
  if (item.sizes && item.sizes.length) {
    const size = item.sizes.find((s) => s.id === sizeId) || item.sizes[0];
    return size.price;
  }
  return item.price;
}

export const minPrice = (item) => (item.sizes && item.sizes.length ? Math.min(...item.sizes.map((s) => s.price)) : item.price);

const MOCK_FIELDS = { price: 'السعر', desc: 'الوصف', name: 'الاسم', img: 'الصورة', phone: 'الرقم', address: 'العنوان', hours: 'الدوام', facebook: 'الرابط', instagram: 'الرابط' };

export const isMock = (obj, field) => Array.isArray(obj?.mock) && obj.mock.includes(field);

/** A small "mock" tag shown next to values we made up until the owner gives us the real ones. */
export function mockTag(obj, fields) {
  const list = (Array.isArray(fields) ? fields : [fields]).filter((f) => isMock(obj, f));
  if (!list.length) return '';
  const title = `بيانات تجريبية: ${list.map((f) => MOCK_FIELDS[f] || f).join('، ')}`;
  return `<span class="mock" title="${esc(title)}">mock</span>`;
}

const IMG_DIR = new URL('../img/', import.meta.url).href;

/** Responsive <img> for a named asset (assets/img/<name>-400|800.webp) or an admin-uploaded data URL. */
export function imgTag(name, { alt = '', sizes = '120px', eager = false, cls = '', w = 400, h = 500 } = {}) {
  if (!name) return '';
  const loading = eager ? 'eager' : 'lazy';
  const klass = cls ? ` class="${cls}"` : '';
  if (name.startsWith('data:') || name.startsWith('http')) {
    return `<img${klass} src="${esc(name)}" alt="${esc(alt)}" width="${w}" height="${h}" loading="${loading}" decoding="async">`;
  }
  const base = IMG_DIR + encodeURIComponent(name);
  return `<img${klass} src="${base}-400.webp" srcset="${base}-400.webp 400w, ${base}-800.webp 800w" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}" loading="${loading}" decoding="async">`;
}

export const monogram = (store, size = '') => `<span class="mono${size ? ` mono-${size}` : ''}" aria-hidden="true">${esc(store.monogram)}</span>`;
