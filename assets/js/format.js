// Small formatting helpers shared by the site and the admin page.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const nf = new Intl.NumberFormat('en-US');
export const num = (n) => nf.format(Math.round(Number(n) || 0));

/** "1,350 <small>ل.س</small>" */
export const money = (n, currency = 'ل.س') => `${num(n)} <small>${esc(currency)}</small>`;
export const moneyText = (n, currency = 'ل.س') => `${num(n)} ${currency}`;

/** Arabic counting for "items": صنف واحد / صنفين / 3 أصناف / 11 صنف */
export function itemsLabel(n) {
  if (n === 1) return 'صنف واحد';
  if (n === 2) return 'صنفين';
  if (n >= 3 && n <= 10) return `${n} أصناف`;
  return `${n} صنف`;
}

/** Syrian numbers are stored local-style (09…); dial with the country code so foreign SIMs work too. */
export const telHref = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `tel:+963${digits.slice(1)}` : `tel:${digits}`;
};

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Minutes since midnight in Sweida, regardless of the visitor's device timezone. */
function nowInSyria() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Damascus', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    return get('hour') * 60 + get('minute');
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

/** Handles hours that run past midnight (e.g. 12:00 → 01:00). */
export function isOpenNow(hours) {
  if (!hours || !hours.open || !hours.close) return false;
  const now = nowInSyria(), open = toMin(hours.open), close = toMin(hours.close);
  return close > open ? now >= open && now < close : now >= open || now < close;
}

export const hoursLabel = (hours) => (hours ? `من ${hours.open} لـ ${hours.close}` : '');

export function statusHTML(store) {
  if (store.closedToday) return '<span class="status is-closed">مسكّر اليوم</span>';
  return isOpenNow(store.hours)
    ? '<span class="status is-open">مفتوح هلّق</span>'
    : '<span class="status is-closed">مسكّر هلّق</span>';
}
