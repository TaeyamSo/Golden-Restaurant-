// Service worker registration, update prompt and the "install app" button.
import * as sheet from './sheet.js';

export function init() {
  register();
  setupInstall();
}

function register() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const offerUpdate = (worker) => sheet.toast('في نسخة جديدة من الموقع', {
        label: 'حدّث',
        run: () => worker.postMessage('skip-waiting'),
      });
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
        });
      });
      // reload only when a new version replaces an old one, not when the first worker takes control
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !hadController) return;
        reloaded = true;
        location.reload();
      });
    } catch { /* offline support is a bonus; the site works without it */ }
  });
}

/** Every [data-install] button (top bar + footer) installs the app, or explains how when the browser can't prompt. */
function setupInstall() {
  const btns = [...document.querySelectorAll('[data-install]')];
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || !btns.length) return;
  const show = (on) => btns.forEach((b) => { b.hidden = !on; });
  let deferred = null;
  show(true);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', () => { show(false); sheet.toast('تمام! صار غولدن عشاشتك'); });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const steps = isIOS
    ? ['اكبس على زر المشاركة بأسفل Safari (المربع مع السهم لفوق).', 'نزال لتحت واختار <b>"إضافة إلى الشاشة الرئيسية"</b>.', 'اكبس <b>إضافة</b>، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.']
    : ['افتح قائمة المتصفح (النقاط التلاتة ⋮ فوق).', 'اختار <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>.', 'أكّد، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.'];

  btns.forEach((btn) => btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    sheet.open({
      title: 'نزّل غولدن عموبايلك',
      body: `<ol class="sheet-text" style="padding-inline-start:20px;display:grid;gap:10px;margin:0 0 8px">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`,
      foot: '<button class="btn btn-dark btn-block" type="button" data-close>تمام</button>',
    });
  }));
}
