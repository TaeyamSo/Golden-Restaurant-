// Ordering UI: size picker, store-conflict prompt, order sheet, receipt and call sheet.
import * as cart from './cart.js';
import * as sheet from './sheet.js';
import { findStore, findItem, mockTag, monogram, isMock } from './data.js';
import { esc, money, moneyText, num, itemsLabel, telHref, statusHTML } from './format.js';

let data;
let lastCount = 0;
const cur = () => data.currency;

export function init(d) {
  data = d;
  cart.subscribe(updateBar);
  updateBar();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-order]')) openOrder();
    else if (e.target.closest('[data-open-call]')) openCall();
  });
}

/* ---------- cart bar + badge ---------- */
function updateBar() {
  const s = cart.summary(data);
  const bar = document.getElementById('cartBar');
  const badge = document.getElementById('cartBadge');
  bar.hidden = s.count === 0;
  document.body.classList.toggle('has-cart', s.count > 0);
  badge.hidden = s.count === 0;
  if (s.store) {
    document.getElementById('cbMono').textContent = s.store.monogram;
    document.getElementById('cbStore').innerHTML = `طلبك من <span dir="ltr">${esc(s.store.nameEn)}</span>`;
    document.getElementById('cbMeta').textContent = `${itemsLabel(s.count)} · ${moneyText(s.total, cur())}`;
  }
  badge.textContent = s.count;
  if (s.count > lastCount) {
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
  lastCount = s.count;
}

/* ---------- adding ---------- */
/** Entry point from the menu: handles sizes and the one-store rule. */
export function requestAdd(storeId, itemId) {
  const store = findStore(data, storeId);
  const item = store && findItem(store, itemId);
  if (!item || item.available === false) return;
  const st = cart.getState();
  if (st.lines.length && st.storeId !== storeId) openConflict(store, item);
  else if (item.sizes?.length) openSizes(store, item);
  else cart.add(store.id, item.id);
}

function openConflict(newStore, item) {
  const old = findStore(data, cart.getState().storeId);
  sheet.open({
    title: 'طلب جديد؟',
    body: `<p class="sheet-text">طلبك هلّق من <b dir="ltr">${esc(old.nameEn)}</b>. كل محل إلو طلب لحال، فما فينا نخلط بين المحلات.</p>
           <p class="sheet-text">بدك تفضّي الطلب وتبلّش من <b dir="ltr">${esc(newStore.nameEn)}</b>؟</p>`,
    foot: `<button class="btn btn-dark btn-block" type="button" data-yes>إي، فضّيه وبلّش من جديد</button>
           <button class="btn btn-ghost-ink btn-block" type="button" data-close>لا، خلّي طلبي</button>
           <button class="text-btn" type="button" data-view>شوف طلبي الحالي</button>`,
    onMount(el) {
      el.querySelector('[data-yes]').onclick = () => {
        cart.clear();
        // sized items go straight to the size picker; simple items are added right away
        if (item.sizes?.length) { openSizes(newStore, item); return; }
        cart.add(newStore.id, item.id);
        sheet.close();
        sheet.toast(`بلّشنا طلب جديد من <span dir="ltr">${esc(newStore.nameEn)}</span>`);
      };
      el.querySelector('[data-view]').onclick = () => openOrder();
    },
  });
}

function openSizes(store, item) {
  let sizeId = item.sizes[0].id;
  let qty = 1;
  const price = () => item.sizes.find((s) => s.id === sizeId).price * qty;
  const el = sheet.open({
    title: esc(item.name),
    body: `
      <div class="size-list" role="radiogroup" aria-label="الحجم">
        ${item.sizes.map((s) => `
          <button class="size-opt" type="button" role="radio" aria-checked="${s.id === sizeId}" data-size="${esc(s.id)}">
            <span>${esc(s.name)}</span><span class="price">${money(s.price, cur())}</span>
          </button>`).join('')}
      </div>
      <div class="size-qty"><span>الكمية</span>
        <span class="stepper light"><button type="button" data-q="1" aria-label="زيد واحد"><svg><use href="#i-plus"/></svg></button><output>1</output><button type="button" data-q="-1" aria-label="نقّص واحد"><svg><use href="#i-minus"/></svg></button></span>
      </div>`,
    foot: `<button class="btn btn-dark btn-block" type="button" data-confirm></button>`,
    onMount(root) {
      const confirm = root.querySelector('[data-confirm]');
      const paint = () => {
        root.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.size === sizeId)));
        root.querySelector('output').textContent = qty;
        confirm.innerHTML = `زيد عالطلب · ${num(price())} ${esc(cur())}`;
      };
      root.addEventListener('click', (e) => {
        const s = e.target.closest('[data-size]');
        if (s) { sizeId = s.dataset.size; paint(); }
        const q = e.target.closest('[data-q]');
        if (q) { qty = Math.max(1, Math.min(50, qty + Number(q.dataset.q))); paint(); }
      });
      confirm.onclick = () => {
        const res = cart.add(store.id, item.id, sizeId, qty);
        if (res.ok) sheet.close();
      };
      paint();
    },
  });
  return el;
}

/* ---------- order sheet ---------- */
export function openOrder() {
  const s = cart.summary(data);
  let unsubscribe = () => {};
  if (!s.count) {
    sheet.open({
      title: 'طلبك',
      body: `<div class="empty"><p>طلبك فاضي لسّا. نقّي شي من المنيو وارجع لهون.</p>
             <a class="btn btn-dark" href="#menu" data-close>روح عالمنيو</a></div>`,
    });
    return;
  }
  sheet.open({
    title: `طلبك من <span dir="ltr">${esc(s.store.nameEn)}</span>`,
    body: `<div class="order-lines"></div>
           <label class="note-field">ملاحظات للمحل (إذا في)
             <textarea rows="2" maxlength="240" placeholder="مثلاً: بلا بصل، زيادة ثومية…">${esc(cart.getState().note)}</textarea>
           </label>`,
    foot: `<div class="order-total"><span>المجموع</span><b></b></div>
           <button class="btn btn-gold btn-block" type="button" data-checkout><svg><use href="#i-phone"/></svg> اطلب بالتلفون</button>
           <button class="text-btn" type="button" data-clear>فضّي الطلب</button>`,
    onMount(el) {
      const paint = () => {
        const sum = cart.summary(data);
        if (!sum.count) { sheet.close(); return; }
        el.querySelector('.order-lines').innerHTML = sum.lines.map((l) => `
          <div class="line-item">
            <div><div class="li-name">${esc(l.item.name)}</div>
              <div class="li-sub">${l.size ? `${esc(l.size.name)} · ` : ''}${num(l.unit)} ${esc(cur())} للواحد</div></div>
            <div class="li-total">${money(l.sum, cur())}</div>
            <span class="stepper light">
              <button type="button" data-step="1" data-id="${esc(l.itemId)}" data-size="${esc(l.sizeId || '')}" aria-label="زيد واحد"><svg><use href="#i-plus"/></svg></button>
              <output>${l.qty}</output>
              <button type="button" data-step="-1" data-id="${esc(l.itemId)}" data-size="${esc(l.sizeId || '')}" aria-label="${l.qty === 1 ? 'شيل' : 'نقّص واحد'}"><svg><use href="#${l.qty === 1 ? 'i-trash' : 'i-minus'}"/></svg></button>
            </span>
          </div>`).join('');
        el.querySelector('.order-total b').innerHTML = money(sum.total, cur());
      };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-step]');
        if (!b) return;
        const sizeId = b.dataset.size || null;
        cart.setQty(b.dataset.id, sizeId, cart.lineQty(b.dataset.id, sizeId) + Number(b.dataset.step));
      });
      el.querySelector('textarea').addEventListener('input', (e) => cart.setNote(e.target.value.trim()));
      el.querySelector('[data-checkout]').onclick = openReceipt;
      el.querySelector('[data-clear]').onclick = () => { cart.clear(); sheet.close(); sheet.toast('فضّينا الطلب'); };
      unsubscribe = cart.subscribe(paint);
      paint();
    },
    onClose: () => unsubscribe(),
  });
}

/* ---------- receipt ---------- */
function orderText(s) {
  const lines = s.lines.map((l) => `${l.qty}× ${l.item.name}${l.size ? ` (${l.size.name})` : ''} — ${moneyText(l.sum, cur())}`);
  const note = cart.getState().note;
  return [`طلب من ${s.store.nameEn}`, ...lines, note ? `ملاحظات: ${note}` : '', `المجموع: ${moneyText(s.total, cur())}`].filter(Boolean).join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function openReceipt() {
  const s = cart.summary(data);
  if (!s.count) return;
  const store = s.store;
  const when = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Damascus' }).format(new Date());
  const anyMock = s.lines.some((l) => isMock(l.item, 'price'));
  const note = cart.getState().note;
  sheet.open({
    dialog: `
      <div class="receipt" aria-labelledby="rTitle">
        <button class="icon-btn close" type="button" data-close aria-label="سكّر"><svg><use href="#i-close"/></svg></button>
        <div class="r-head">
          ${monogram(store, 'lg')}
          <h3 id="rTitle">${esc(store.nameEn)}</h3>
          <p>فاتورة طلب · ${esc(when)}</p>
        </div>
        <div class="r-lines">
          ${s.lines.map((l) => `<div class="r-line"><span class="q">${l.qty}×</span><span class="n">${esc(l.item.name)}${l.size ? ` <small>(${esc(l.size.name)})</small>` : ''}</span><span class="dots-fill"></span><span class="t">${num(l.sum)}</span></div>`).join('')}
        </div>
        ${note ? `<div class="r-note">ملاحظات: ${esc(note)}</div>` : ''}
        <div class="r-total"><span>المجموع</span><b>${money(s.total, cur())}</b></div>
        ${anyMock ? '<p class="r-mocknote">الأسعار هون تجريبية (mock) لحتى يعتمدها المحل.</p>' : ''}
        <div class="r-call">
          <p>اتصل وقول للموظف إنك شفت المنيو عالموقع، واقرالو هالطلب.</p>
          <a class="r-phone" href="${telHref(store.phone)}">${esc(store.phone)}</a>${mockTag(store, 'phone')}
          <div class="r-actions">
            <a class="btn btn-gold" href="${telHref(store.phone)}"><svg><use href="#i-phone"/></svg> اتصل هلّق</a>
            <button class="btn btn-ghost-ink" type="button" data-copy aria-label="انسخ الطلب"><svg><use href="#i-copy"/></svg></button>
          </div>
        </div>
        <button class="text-btn" type="button" data-back style="display:block;margin:14px auto 0">رجوع للطلب</button>
      </div>`,
    onMount(el) {
      el.querySelector('[data-copy]').onclick = async (e) => {
        const ok = await copyText(orderText(s));
        const b = e.currentTarget;
        if (ok) {
          b.innerHTML = '<svg><use href="#i-check"/></svg>';
          sheet.toast('انتسخ الطلب، فيك تلصقو برسالة');
        }
      };
      el.querySelector('[data-back]').onclick = openOrder;
    },
  });
}

/* ---------- call sheet (hero button) ---------- */
export function openCall() {
  sheet.open({
    title: 'اتصل بأي محل',
    body: `<div class="store-pick">
      ${data.stores.map((st) => `
        <a href="${telHref(st.phone)}">
          ${monogram(st)}
          <span class="pick-info"><b>${esc(st.nameEn)}</b><span class="pick-phone">${esc(st.phone)}${mockTag(st, 'phone')}</span>${statusHTML(st)}</span>
          <span class="call-ico"><svg><use href="#i-phone"/></svg></span>
        </a>`).join('')}
      </div>
      <p class="sheet-text" style="margin-top:14px">بدك تشوف الأسعار قبل؟ <a href="#menu" data-close>افتح المنيو</a></p>`,
  });
}
