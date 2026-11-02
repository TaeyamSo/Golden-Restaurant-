// Admin demo: edits a copy of the menu and keeps it on this device (localStorage).
// The public site reads the same draft, so the owner sees changes immediately on the same phone.
// A real backend replaces save()/reset later; the data shape stays the same.
import { loadData, DRAFT_KEY, DATA_URL, imgTag, findStore, mockTag } from '../assets/js/data.js';
import { esc, num } from '../assets/js/format.js';
import * as sheet from '../assets/js/sheet.js';

const view = document.getElementById('view');
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let data, published, tab = 'menu', storeId;

async function main() {
  const loaded = await loadData();
  data = clone(loaded.data);
  if (!data.settings) data.settings = { showMock: true };
  published = await fetch(DATA_URL, { cache: 'no-cache' }).then((r) => r.json()).catch(() => null);
  storeId = data.stores[0].id;
  setSaved(loaded.isDraft ? 'في تعديلات محفوظة' : 'ما في تعديلات لسّا');

  document.querySelector('.adm-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.adm-nav [data-tab]').forEach((x) => {
      if (x === b) x.setAttribute('aria-current', 'page');
      else x.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  });
  view.addEventListener('click', onClick);
  view.addEventListener('change', onChange);
  render();
}

/* ---------- persistence ---------- */
function save(msg) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    const t = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { timeStyle: 'short' }).format(new Date());
    setSaved(`انحفظ ${t}`, true);
    if (msg) sheet.toast(msg);
    return true;
  } catch {
    sheet.toast('ما في مساحة كافية عالجهاز. جرّب صورة أصغر.');
    return false;
  }
}
function setSaved(text, ok = false) {
  document.getElementById('saved').innerHTML = `${ok ? '<svg><use href="#i-check"/></svg>' : ''}${esc(text)}`;
}
/** Once the owner types a real value, it is no longer mock. */
function unmock(obj, fields) {
  if (Array.isArray(obj.mock)) obj.mock = obj.mock.filter((f) => !fields.includes(f));
}

/* ---------- render ---------- */
function render() {
  document.getElementById('viewSite').href = `../#menu/${storeId}`;
  if (tab === 'menu') renderMenu();
  else if (tab === 'stores') renderStores();
  else if (tab === 'reels') renderReels();
  else renderSettings();
}

const store = () => findStore(data, storeId);
const priceLabel = (it) => (it.sizes?.length
  ? it.sizes.map((s) => `${esc(s.name)} ${num(s.price)}`).join(' · ')
  : `${num(it.price)} ${esc(data.currency)}`);
const thumb = (it) => `<span class="thumb">${it.img ? imgTag(it.img, { sizes: '52px', alt: '' }) : esc(String(it.name || '؟').trim().charAt(0))}</span>`;

function storeSwitch() {
  return `<div class="adm-stores">${data.stores.map((s) =>
    `<button class="chip${s.id === storeId ? ' on' : ''}" type="button" data-act="store" data-id="${esc(s.id)}"><b>${esc(s.nameEn)}</b></button>`).join('')}</div>`;
}

function renderMenu() {
  const s = store();
  const items = s.categories.flatMap((c) => c.items);
  const out = items.filter((i) => i.available === false).length;
  const last = s.categories.length - 1;
  view.innerHTML = `
    <div class="adm-h"><div><h1>المنيو</h1><p class="adm-sub">عدّل الأسعار والأصناف، وسكّر يلي خلص بكبسة.</p></div></div>
    ${storeSwitch()}
    <div class="stats">
      <div class="stat"><b>${items.length}</b><span>صنف</span></div>
      <div class="stat"><b>${out}</b><span>خلصان اليوم</span></div>
      <div class="stat"><b>${s.categories.length}</b><span>قسم</span></div>
    </div>
    ${s.categories.map((c, ci) => `
      <section class="card" data-cat="${ci}">
        <div class="card-h">
          <h2>${esc(c.name)} <small>${c.items.length}</small></h2>
          <button class="ibtn" type="button" data-act="cat-up" ${ci === 0 ? 'disabled' : ''} aria-label="طلّع القسم لفوق"><svg><use href="#i-up"/></svg></button>
          <button class="ibtn" type="button" data-act="cat-down" ${ci === last ? 'disabled' : ''} aria-label="نزّل القسم لتحت"><svg><use href="#i-down"/></svg></button>
          <button class="ibtn" type="button" data-act="cat-edit" aria-label="عدّل القسم"><svg><use href="#i-edit"/></svg></button>
        </div>
        ${c.items.map((it, ii) => `
          <div class="row${it.available === false ? ' off' : ''}" data-item="${ii}">
            ${thumb(it)}
            <button class="row-info" type="button" data-act="item-edit"><b>${esc(it.name)}</b><span>${priceLabel(it)}${mockTag(it, 'price')}</span></button>
            <label class="switch"><input type="checkbox" data-act="toggle" ${it.available === false ? '' : 'checked'} aria-label="${esc(it.name)} متوفر"><i></i></label>
            <button class="ibtn" type="button" data-act="item-edit" aria-label="عدّل ${esc(it.name)}"><svg><use href="#i-edit"/></svg></button>
          </div>`).join('')}
        <button class="add-row" type="button" data-act="item-add"><svg><use href="#i-plus"/></svg>زيد صنف لـ${esc(c.name)}</button>
      </section>`).join('')}
    <button class="btn btn-ghost-ink btn-block" type="button" data-act="cat-add"><svg><use href="#i-plus"/></svg> قسم جديد</button>`;
}

function renderStores() {
  const f = (s, key, label, { type = 'text', ltr = false, mock = key, area = false } = {}) => {
    const val = key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], s) : s[key];
    const input = area
      ? `<textarea data-field="${key}" rows="3">${esc(val)}</textarea>`
      : `<input type="${type}" data-field="${key}" value="${esc(val)}"${ltr ? ' class="ltr" dir="ltr"' : ''}>`;
    return `<label class="field"><span class="lbl">${label}${mock ? mockTag(s, mock) : ''}</span>${input}</label>`;
  };
  view.innerHTML = `
    <div class="adm-h"><div><h1>المحلات</h1><p class="adm-sub">الأرقام والعناوين والدوام. يلي عليه mock لسّا تجريبي.</p></div></div>
    ${storeSwitch()}
    ${(() => {
      const s = store();
      return `
      <section class="card store-form" data-store-form>
        <div class="card-h"><span class="mono" aria-hidden="true">${esc(s.monogram)}</span><h2 dir="ltr" style="text-align:right">${esc(s.nameEn)}</h2></div>
        <div class="form">
          <label class="switch" style="justify-content:space-between"><span><b>مسكّر اليوم</b><br><span class="adm-sub">بيبيّن "مسكّر اليوم" عالموقع مهما كان الدوام</span></span><input type="checkbox" data-field="closedToday" ${s.closedToday ? 'checked' : ''}><i></i></label>
          <div class="two">${f(s, 'nameEn', 'الاسم بالإنكليزي', { ltr: true, mock: null })}${f(s, 'nameAr', 'الاسم بالعربي', { mock: null })}</div>
          ${f(s, 'kind', 'شو بيبيع (سطر قصير)', { mock: null })}
          ${f(s, 'story', 'الحكاية (بتطلع ببطاقة المحل)', { area: true, mock: null })}
          ${f(s, 'phone', 'رقم التلفون', { type: 'tel', ltr: true })}
          ${f(s, 'address', 'العنوان')}
          ${f(s, 'mapsQuery', 'شو منكتب بالخريطة لنلاقيه', { mock: null })}
          <div class="two">${f(s, 'hours.open', 'بيفتح', { type: 'time', mock: 'hours' })}${f(s, 'hours.close', 'بيسكّر', { type: 'time', mock: null })}</div>
          ${f(s, 'facebook', 'رابط فيسبوك', { type: 'url', ltr: true })}
          ${f(s, 'instagram', 'رابط إنستغرام', { type: 'url', ltr: true })}
          <button class="btn btn-dark btn-block" type="button" data-act="store-save">احفظ</button>
        </div>
      </section>`;
    })()}`;
}

function renderReels() {
  view.innerHTML = `
    <div class="adm-h"><div><h1>الريلز</h1><p class="adm-sub">رفع فيديو جديد بدّو سيرفر. هلّق فيك تعدّل العناوين والترتيب وروابط الملفات.</p></div></div>
    <section class="card">
      ${data.reels.map((r, i) => `
        <div class="reel-row" data-reel="${i}">
          <img src="../${esc(r.poster)}" alt="" loading="lazy">
          <div class="form">
            <label class="field"><span class="lbl">العنوان</span><input type="text" data-rfield="title" value="${esc(r.title)}"></label>
            <label class="field"><span class="lbl">ملف الفيديو</span><input type="text" data-rfield="src" value="${esc(r.src)}" class="ltr" dir="ltr"></label>
            <div style="display:flex;gap:4px">
              <button class="ibtn" type="button" data-act="reel-up" ${i === 0 ? 'disabled' : ''} aria-label="لفوق"><svg><use href="#i-up"/></svg></button>
              <button class="ibtn" type="button" data-act="reel-down" ${i === data.reels.length - 1 ? 'disabled' : ''} aria-label="لتحت"><svg><use href="#i-down"/></svg></button>
              <button class="ibtn danger" type="button" data-act="reel-del" aria-label="امسح"><svg><use href="#i-trash"/></svg></button>
            </div>
          </div>
        </div>`).join('')}
    </section>`;
}

function renderSettings() {
  view.innerHTML = `
    <div class="adm-h"><div><h1>الإعدادات</h1></div></div>
    <section class="card">
      <div class="setting"><div><b>بيّن شارات mock</b><p>الشارة الصغيرة جنب المعلومات التجريبية. طفّيها لتاخد صور نظيفة.</p></div>
        <label class="switch"><input type="checkbox" data-act="show-mock" ${data.settings.showMock !== false ? 'checked' : ''}><i></i></label></div>
      <div class="setting"><div><b>نزّل المنيو كملف</b><p>ملف menu.json فيه كل التعديلات. منرفعو عالموقع لتوصل للكل.</p></div>
        <button class="btn btn-ghost-ink btn-sm" type="button" data-act="export"><svg><use href="#i-download"/></svg> نزّل</button></div>
      <div class="setting"><div><b>افتح ملف منيو</b><p>رجّع نسخة نزّلتها قبل.</p></div>
        <label class="btn btn-ghost-ink btn-sm"><svg><use href="#i-upload"/></svg> افتح<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
      <div class="setting"><div><b>رجّع الأصل</b><p>بيمسح كل التعديلات عهالجهاز.</p></div>
        <button class="btn btn-ghost-ink btn-sm danger" type="button" data-act="reset">رجّع</button></div>
    </section>
    <section class="card" style="padding:16px;display:grid;gap:8px">
      <b>كيف رح تشتغل بعدين؟</b>
      <p class="adm-sub" style="line-height:1.8">بنفس هالشاشات، بس التعديل بيروح عسيرفر وبيوصل لكل الزباين بثواني: تسجيل دخول لكل محل، رفع صور وفيديوهات من الموبايل، وتسكير الأصناف يلي خلصت أوتوماتيك.</p>
    </section>`;
}

/* ---------- events ---------- */
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  const ci = Number(b.closest('[data-cat]')?.dataset.cat);
  const ii = Number(b.closest('[data-item]')?.dataset.item);
  const ri = Number(b.closest('[data-reel]')?.dataset.reel);
  const cats = store().categories;

  if (act === 'store') { storeId = b.dataset.id; render(); }
  else if (act === 'item-edit') editItem(ci, ii);
  else if (act === 'item-add') editItem(ci, -1);
  else if (act === 'cat-up' || act === 'cat-down') {
    const j = act === 'cat-up' ? ci - 1 : ci + 1;
    [cats[ci], cats[j]] = [cats[j], cats[ci]];
    save(); render();
  } else if (act === 'cat-edit') editCategory(ci);
  else if (act === 'cat-add') editCategory(-1);
  else if (act === 'store-save') saveStore();
  else if (act === 'reel-up' || act === 'reel-down') {
    const j = act === 'reel-up' ? ri - 1 : ri + 1;
    [data.reels[ri], data.reels[j]] = [data.reels[j], data.reels[ri]];
    save(); render();
  } else if (act === 'reel-del') {
    if (confirm('أكيد بدك تمسح هالريل من الموقع؟')) { data.reels.splice(ri, 1); save('انمسح'); render(); }
  } else if (act === 'export') exportJSON();
  else if (act === 'reset') {
    if (!confirm('أكيد؟ رح ترجع كل المعلومات متل ما كانت.')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    if (published) data = clone(published);
    if (!data.settings) data.settings = { showMock: true };
    setSaved('رجعنا للأصل');
    sheet.toast('رجعنا للأصل');
    render();
  }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.act === 'toggle') {
    const ci = Number(t.closest('[data-cat]').dataset.cat);
    const ii = Number(t.closest('[data-item]').dataset.item);
    const it = store().categories[ci].items[ii];
    it.available = t.checked;
    save(t.checked ? `${it.name}: رجع متوفر` : `${it.name}: خلصت لليوم`);
    renderMenu();
  } else if (t.dataset.act === 'show-mock') {
    data.settings.showMock = t.checked;
    save();
  } else if (t.dataset.act === 'import') importJSON(t.files[0]);
  else if (t.dataset.rfield) {
    const ri = Number(t.closest('[data-reel]').dataset.reel);
    data.reels[ri][t.dataset.rfield] = t.value.trim();
    save();
  }
}

/* ---------- item editor ---------- */
function editItem(ci, ii) {
  const s = store();
  const isNew = ii < 0;
  const original = isNew ? null : s.categories[ci].items[ii];
  const it = isNew ? { id: uid('item'), name: '', desc: '', img: null, price: 0, available: true, mock: [] } : clone(original);
  let hasSizes = !!it.sizes?.length;

  const sizesHTML = () => (it.sizes || []).map((z, k) => `
    <div class="size-row" data-size="${k}">
      <input type="text" data-z="name" value="${esc(z.name)}" placeholder="الحجم" aria-label="اسم الحجم">
      <input type="number" inputmode="numeric" min="0" data-z="price" value="${esc(z.price)}" aria-label="السعر">
      <button class="ibtn danger" type="button" data-zdel aria-label="امسح الحجم"><svg><use href="#i-trash"/></svg></button>
    </div>`).join('');

  sheet.open({
    title: isNew ? 'صنف جديد' : 'عدّل الصنف',
    body: `<div class="form">
      <div class="img-edit">
        <span class="thumb" data-preview>${it.img ? imgTag(it.img, { sizes: '84px' }) : '<svg style="width:28px;height:28px"><use href="#i-image"/></svg>'}</span>
        <div class="btns">
          <label class="btn btn-ghost-ink btn-sm"><svg><use href="#i-image"/></svg> ${it.img ? 'غيّر الصورة' : 'زيد صورة'}<input type="file" accept="image/*" data-img hidden></label>
          <button class="text-btn" type="button" data-noimg ${it.img ? '' : 'hidden'}>شيل الصورة</button>
        </div>
      </div>
      <label class="field"><span class="lbl">الاسم${mockTag(it, 'name')}</span><input type="text" data-f="name" value="${esc(it.name)}" required></label>
      <label class="field"><span class="lbl">الوصف${mockTag(it, 'desc')}</span><textarea data-f="desc" rows="2">${esc(it.desc)}</textarea></label>
      <label class="switch" style="justify-content:space-between"><b>في أكتر من حجم؟</b><input type="checkbox" data-hassizes ${hasSizes ? 'checked' : ''}><i></i></label>
      <label class="field" data-single ${hasSizes ? 'hidden' : ''}><span class="lbl">السعر (${esc(data.currency)})${mockTag(it, 'price')}</span><input type="number" inputmode="numeric" min="0" data-f="price" value="${esc(it.price ?? 0)}"></label>
      <div class="field" data-multi ${hasSizes ? '' : 'hidden'}><span class="lbl">الأحجام والأسعار${mockTag(it, 'price')}</span>
        <div class="sizes">${sizesHTML()}</div>
        <button class="text-btn" type="button" data-zadd style="justify-self:start">+ زيد حجم</button>
      </div>
      <label class="field"><span class="lbl">القسم</span><select data-f="cat">${s.categories.map((c, k) => `<option value="${k}"${k === ci ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="switch" style="justify-content:space-between"><b>متوفر اليوم</b><input type="checkbox" data-f="available" ${it.available === false ? '' : 'checked'}><i></i></label>
      ${isNew ? '' : `<div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost-ink btn-sm" type="button" data-move="-1"><svg><use href="#i-up"/></svg> لفوق</button>
        <button class="btn btn-ghost-ink btn-sm" type="button" data-move="1"><svg><use href="#i-down"/></svg> لتحت</button>
        <button class="btn btn-ghost-ink btn-sm danger" type="button" data-del style="margin-inline-start:auto"><svg><use href="#i-trash"/></svg> امسح</button></div>`}
    </div>`,
    foot: `<div class="two"><button class="btn btn-dark" type="button" data-save>احفظ</button><button class="btn btn-ghost-ink" type="button" data-close>إلغاء</button></div>`,
    onMount(el) {
      const $ = (sel) => el.querySelector(sel);
      const syncSizes = () => {
        it.sizes = [...el.querySelectorAll('.size-row')].map((r, k) => ({
          id: it.sizes?.[k]?.id || uid('z'),
          name: r.querySelector('[data-z="name"]').value.trim() || 'حجم',
          price: Number(r.querySelector('[data-z="price"]').value) || 0,
        }));
      };
      $('[data-hassizes]').onchange = (e) => {
        hasSizes = e.target.checked;
        if (hasSizes && !it.sizes?.length) {
          const p = Number($('[data-f="price"]').value) || 0;
          it.sizes = [{ id: 's', name: 'صغير', price: p }, { id: 'l', name: 'كبير', price: p }];
          $('.sizes').innerHTML = sizesHTML();
        }
        $('[data-single]').hidden = hasSizes;
        $('[data-multi]').hidden = !hasSizes;
      };
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-zadd]')) { syncSizes(); it.sizes.push({ id: uid('z'), name: '', price: 0 }); $('.sizes').innerHTML = sizesHTML(); }
        const del = e.target.closest('[data-zdel]');
        if (del) { syncSizes(); it.sizes.splice(Number(del.closest('[data-size]').dataset.size), 1); $('.sizes').innerHTML = sizesHTML(); }
        if (e.target.closest('[data-noimg]')) { it.img = null; $('[data-preview]').innerHTML = '<svg style="width:28px;height:28px"><use href="#i-image"/></svg>'; $('[data-noimg]').hidden = true; }
        const mv = e.target.closest('[data-move]');
        if (mv) {
          const list = s.categories[ci].items, j = ii + Number(mv.dataset.move);
          if (j < 0 || j >= list.length) return;
          [list[ii], list[j]] = [list[j], list[ii]];
          save('انحفظ الترتيب'); sheet.close(); renderMenu();
        }
        if (e.target.closest('[data-del]') && confirm(`أكيد بدك تمسح "${original.name}"؟`)) {
          s.categories[ci].items.splice(ii, 1);
          save('انمسح'); sheet.close(); renderMenu();
        }
      });
      $('[data-img]').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          it.img = await shrinkImage(file);
          $('[data-preview]').innerHTML = `<img src="${it.img}" alt="">`;
          $('[data-noimg]').hidden = false;
        } catch { sheet.toast('ما قدرنا نقرا الصورة'); }
      };
      $('[data-save]').onclick = () => {
        const name = $('[data-f="name"]').value.trim();
        if (!name) { $('[data-f="name"]').focus(); sheet.toast('اكتب اسم الصنف'); return; }
        const changed = [];
        if (name !== (original?.name ?? '')) changed.push('name');
        const desc = $('[data-f="desc"]').value.trim();
        if (desc !== (original?.desc ?? '')) changed.push('desc');
        if (it.img !== (original?.img ?? null)) changed.push('img');
        it.name = name; it.desc = desc;
        it.available = $('[data-f="available"]').checked;
        if (hasSizes) {
          syncSizes();
          delete it.price;
          if (JSON.stringify(it.sizes) !== JSON.stringify(original?.sizes)) changed.push('price');
        } else {
          it.price = Number($('[data-f="price"]').value) || 0;
          delete it.sizes;
          if (it.price !== original?.price) changed.push('price');
        }
        unmock(it, changed);
        const target = Number($('[data-f="cat"]').value);
        if (isNew) s.categories[target].items.push(it);
        else if (target !== ci) { s.categories[ci].items.splice(ii, 1); s.categories[target].items.push(it); }
        else s.categories[ci].items[ii] = it;
        if (save(isNew ? 'انضاف الصنف' : 'انحفظ')) { sheet.close(); renderMenu(); }
      };
    },
  });
}

/** Resize a picked photo so a few dozen fit in the browser's storage. */
function shrinkImage(file, max = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/webp', 0.72);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.78);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

/* ---------- categories ---------- */
function editCategory(ci) {
  const s = store();
  const isNew = ci < 0;
  const cat = isNew ? { id: uid('cat'), name: '', items: [] } : s.categories[ci];
  sheet.open({
    title: isNew ? 'قسم جديد' : 'عدّل القسم',
    body: `<div class="form"><label class="field"><span class="lbl">اسم القسم</span><input type="text" data-name value="${esc(cat.name)}" placeholder="مثلاً: حلويات"></label>
      ${isNew ? '' : `<button class="btn btn-ghost-ink btn-sm danger" type="button" data-del style="justify-self:start"><svg><use href="#i-trash"/></svg> امسح القسم</button>`}</div>`,
    foot: `<div class="two"><button class="btn btn-dark" type="button" data-save>احفظ</button><button class="btn btn-ghost-ink" type="button" data-close>إلغاء</button></div>`,
    onMount(el) {
      el.querySelector('[data-save]').onclick = () => {
        const name = el.querySelector('[data-name]').value.trim();
        if (!name) return;
        cat.name = name;
        if (isNew) s.categories.push(cat);
        save('انحفظ'); sheet.close(); renderMenu();
      };
      el.querySelector('[data-del]')?.addEventListener('click', () => {
        const n = cat.items.length;
        if (!confirm(n ? `القسم فيه ${n} أصناف. أكيد بدك تمسحو مع أصنافو؟` : 'أكيد بدك تمسح القسم؟')) return;
        s.categories.splice(ci, 1);
        save('انمسح'); sheet.close(); renderMenu();
      });
    },
  });
}

/* ---------- stores ---------- */
function saveStore() {
  const s = store();
  const form = view.querySelector('[data-store-form]');
  const MOCKABLE = { phone: 'phone', address: 'address', 'hours.open': 'hours', 'hours.close': 'hours', facebook: 'facebook', instagram: 'instagram' };
  const changed = new Set();
  form.querySelectorAll('[data-field]').forEach((input) => {
    const key = input.dataset.field;
    const val = input.type === 'checkbox' ? input.checked : input.value.trim();
    const path = key.split('.');
    if (path.length > 1 && !s[path[0]]) s[path[0]] = {};
    const parent = path.length > 1 ? s[path[0]] : s;
    const k = path[path.length - 1];
    if (parent[k] !== val) {
      parent[k] = val;
      if (MOCKABLE[key]) changed.add(MOCKABLE[key]);
    }
  });
  unmock(s, [...changed]);
  save('انحفظت معلومات المحل');
  renderStores();
}

/* ---------- import / export ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'menu.json' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function importJSON(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.stores) || !parsed.stores.length) throw new Error('shape');
    data = parsed;
    if (!data.settings) data.settings = { showMock: true };
    storeId = data.stores[0].id;
    save('انفتح الملف');
    render();
  } catch {
    sheet.toast('هالملف مو ملف منيو صحيح');
  }
}

main();
