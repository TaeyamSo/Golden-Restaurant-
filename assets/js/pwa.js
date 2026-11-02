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

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const list = (steps) => `<ol class="sheet-text" style="padding-inline-start:20px;display:grid;gap:10px;margin:0 0 8px">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;

  btns.forEach((btn) => btn.addEventListener('click', async () => {
    // checked before the browser's own prompt: some browsers that build blocked packages offer one too
    if (isAndroid && !safeAndroidInstaller()) { openInChromeSheet(); return; }
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    if (isIOS) {
      sheet.open({
        title: 'نزّل غولدن عموبايلك',
        body: list(['اكبس على زر المشاركة بأسفل Safari (المربع مع السهم لفوق).', 'نزال لتحت واختار <b>"إضافة إلى الشاشة الرئيسية"</b>.', 'اكبس <b>إضافة</b>، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.']),
        foot: '<button class="btn btn-dark btn-block" type="button" data-close>تمام</button>',
      });
      return;
    }
    sheet.open({
      title: 'نزّل غولدن عموبايلك',
      body: list(['افتح قائمة المتصفح (النقاط التلاتة ⋮ فوق).', 'اختار <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>.', 'أكّد، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.']),
      foot: '<button class="btn btn-dark btn-block" type="button" data-close>تمام</button>',
    });
  }));
}

/**
 * On Android, "installing" a site makes the browser package it as an app. Chrome, Edge and Samsung Internet build
 * that package through an up-to-date service; some other browsers build it for old Android versions, and Google Play
 * Protect then blocks it as "built for an older version of Android". So only those three get install steps.
 */
function safeAndroidInstaller() {
  const brands = (navigator.userAgentData?.brands || []).map((b) => b.brand);
  if (brands.length) return brands.some((b) => /^(Google Chrome|Microsoft Edge|Samsung Internet)$/.test(b));
  const ua = navigator.userAgent;
  if (/SamsungBrowser|EdgA/.test(ua)) return true;
  // plain Chrome: a Chrome UA without another browser's marker or the in-app WebView flag
  return /Chrome\/\d+/.test(ua) && !/; wv\)|OPR|Opera|UCBrowser|MiuiBrowser|XiaoMi|HeyTap|OppoBrowser|VivoBrowser|YaBrowser|Vivaldi|PHX|Phoenix|Firefox|FBAN|FBAV|Instagram/.test(ua);
}

/** Other Android browsers: send the visitor to Chrome, where the install is safe. */
function openInChromeSheet() {
  const url = location.href.split('#')[0];
  const intent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  sheet.open({
    title: 'نزّلو من Google Chrome',
    body: `<p class="sheet-text">المتصفح يلي فاتح منو هلّق بيعمل نسخة قديمة من التطبيق، وGoogle بيمنعها وبيطلع تحذير. هالشي من المتصفح مو من الموقع، والموقع آمن.</p>
      <p class="sheet-text">افتح الموقع بـ <b>Google Chrome</b> ونزّل التطبيق من هناك، بيتنزّل بدون أي تحذير.</p>`,
    foot: `<a class="btn btn-gold btn-block" href="${intent}">افتح بـ Chrome</a>
      <button class="btn btn-ghost-ink btn-block" type="button" data-copy-link>انسخ رابط الموقع</button>`,
    onMount(el) {
      el.querySelector('[data-copy-link]').onclick = async () => {
        try { await navigator.clipboard.writeText(url); sheet.toast('انتسخ الرابط، الصقو بـ Chrome'); } catch { sheet.toast(url); }
      };
    },
  });
}
