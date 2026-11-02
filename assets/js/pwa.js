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

/**
 * The "نزّل التطبيق" buttons (top bar + footer) show for everyone and act per browser:
 *  - Google Chrome: its own install prompt. Chrome is the only Android browser whose installed app Google builds;
 *    others (Samsung Internet included) build one for old Android versions, which Play Protect blocks.
 *  - Safari on iPhone: the "Add to Home Screen" steps (Safari makes a plain home-screen shortcut, no app package).
 *  - Any other browser: copy the link / open the page in Chrome.
 */
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

  btns.forEach((btn) => btn.addEventListener('click', async () => {
    if (isGoogleChrome()) {
      if (!deferred) { sheet.toast('التطبيق منزّل عندك، دوّر عليه بشاشة الموبايل'); return; }
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    if (isSafari()) { safariSheet(); return; }
    chromeSheet();
  }));
}

const UA = navigator.userAgent;
const isIOS = () => /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(UA);

/** Google Chrome itself — not Samsung Internet, Edge, Opera, Brave or other browsers built on Chrome's engine. */
function isGoogleChrome() {
  if (isIOS()) return false;
  const brands = (navigator.userAgentData?.brands || []).map((b) => b.brand);
  if (brands.length) return brands.includes('Google Chrome');
  // older phones without userAgentData: a Chrome UA without another browser's marker or the in-app WebView flag
  return /Chrome\/\d+/.test(UA) && !/; wv\)|SamsungBrowser|Edg|OPR|Opera|UCBrowser|MiuiBrowser|XiaoMi|HeyTap|OppoBrowser|VivoBrowser|YaBrowser|Vivaldi|Brave|PHX|Phoenix|Firefox|FBAN|FBAV|Instagram/.test(UA);
}

/** Safari on iPhone/iPad (not Chrome, Firefox or an app's built-in browser there). */
const isSafari = () => isIOS() && /Safari\//.test(UA) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(UA);

const list = (steps) => `<ol class="sheet-text" style="padding-inline-start:20px;display:grid;gap:10px;margin:0 0 8px">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;

function safariSheet() {
  sheet.open({
    title: 'نزّل غولدن عموبايلك',
    body: list(['اكبس على زر المشاركة بأسفل Safari (المربع مع السهم لفوق).', 'نزال لتحت واختار <b>"إضافة إلى الشاشة الرئيسية"</b>.', 'اكبس <b>إضافة</b>، وصار المنيو عشاشتك، وبيفتح حتى لو النت ضعيف.']),
    foot: '<button class="btn btn-dark btn-block" type="button" data-close>تمام</button>',
  });
}

/** Other browsers: copy the link for Chrome, or (Android) open the page straight in Chrome. */
function chromeSheet() {
  const url = location.href.split('#')[0];
  // Android intent link: opens this page in Chrome, or stays on the page if Chrome isn't installed
  const intent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  sheet.open({
    title: 'نزّل التطبيق من Google Chrome',
    body: '<p class="sheet-text">انسخ رابط الموقع والصقو بـ Google Chrome، ونزّل التطبيق من هناك.</p>',
    foot: `<button class="btn btn-gold btn-block" type="button" data-copy-link>انسخ الرابط</button>
      ${isAndroid() ? `<a class="btn btn-ghost-ink btn-block" href="${intent}">افتح بـ Chrome</a>` : ''}`,
    onMount(el) {
      const b = el.querySelector('[data-copy-link]');
      b.onclick = async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(url); ok = true; } catch {
          // older browsers: copy through a temporary text field
          const ta = Object.assign(document.createElement('textarea'), { value: url });
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        }
        if (ok) b.textContent = 'انتسخ ✓';
        else sheet.toast(url);
      };
    },
  });
}
