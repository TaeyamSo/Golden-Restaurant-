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

function setupInstall() {
  const btn = document.getElementById('installBtn');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || !btn) return;
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; sheet.toast('تمام! صار غولدن عشاشتك'); });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    sheet.open({
      title: 'نزّل غولدن عموبايلك',
      body: `<ol class="sheet-text" style="padding-inline-start:20px;display:grid;gap:10px;margin:0 0 8px">
          <li>اكبس على زر المشاركة بأسفل Safari (المربع مع السهم لفوق).</li>
          <li>نزال لتحت واختار <b>"إضافة إلى الشاشة الرئيسية"</b>.</li>
          <li>اكبس <b>إضافة</b>، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.</li>
        </ol>`,
      foot: '<button class="btn btn-dark btn-block" type="button" data-close>تمام</button>',
    });
  });
}
