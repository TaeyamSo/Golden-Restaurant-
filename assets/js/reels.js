// Reels carousel: swipe between videos, tap to play, last card links out to the socials.
// Videos use preload="none" so nothing downloads until the visitor taps play.
import { mockTag } from './data.js';
import { esc } from './format.js';

export function init(data) {
  const row = document.getElementById('reelsRow');
  const dots = document.getElementById('reelDots');

  row.innerHTML = data.reels.map((r, i) => `
    <div class="reel" data-i="${i}">
      <video playsinline preload="none" poster="${esc(r.poster)}" src="${esc(r.src)}" aria-label="${esc(r.title)}"></video>
      <button class="reel-play" type="button" aria-label="شغّل: ${esc(r.title)}">
        <span class="disc"><svg><use href="#i-play"/></svg></span>
        ${r.size ? `<span class="reel-size">${esc(r.size)}</span>` : ''}
      </button>
      <div class="reel-meta">
        <span class="reel-title">${esc(r.title)}</span>
        <button class="reel-sound" type="button" aria-label="كتم الصوت"><svg><use href="#i-sound"/></svg></button>
      </div>
      <div class="reel-bar"><i></i></div>
    </div>`).join('') + `
    <div class="reel-more" data-i="${data.reels.length}">
      <h3>بدك تشوف أكتر؟</h3>
      <p>كل يوم في شي جديد عصفحاتنا.</p>
      ${data.stores.map((s) => `<a class="btn btn-line" href="${esc(s.facebook)}" target="_blank" rel="noopener"><svg><use href="#i-fb"/></svg><span dir="ltr">${esc(s.nameEn)}</span>${mockTag(s, 'facebook')}</a>`).join('')}
      <a class="btn btn-line" href="${esc(data.brand.instagram)}" target="_blank" rel="noopener"><svg><use href="#i-ig"/></svg>إنستغرام${mockTag(data.brand, 'instagram')}</a>
    </div>`;

  // the loading screen buffers the start of reel 1 in its own element; swap that element in so playback
  // starts at once (it may still be waiting for its src if the page opened before the buffering began)
  const G = window.__golden;
  const first = row.querySelector('.reel video');
  const abs = (u) => new URL(u, document.baseURI).href;
  if (G?.reel && first && abs(G.reelSrc) === abs(first.getAttribute('src'))) {
    G.reel.poster = first.getAttribute('poster');
    G.reel.setAttribute('aria-label', first.getAttribute('aria-label'));
    G.reel.dataset.src = first.getAttribute('src');
    G.reel.muted = false;
    first.replaceWith(G.reel);
  }

  const cards = [...row.children];
  dots.innerHTML = cards.map(() => '<i></i>').join('');
  const videos = [...row.querySelectorAll('video')];

  const pauseOthers = (keep) => videos.forEach((v) => { if (v !== keep && !v.paused) v.pause(); });

  row.addEventListener('click', (e) => {
    const card = e.target.closest('.reel');
    if (!card) return;
    const v = card.querySelector('video');
    const soundBtn = e.target.closest('.reel-sound');
    if (soundBtn) {
      v.muted = !v.muted;
      soundBtn.innerHTML = `<svg><use href="#i-${v.muted ? 'mute' : 'sound'}"/></svg>`;
      soundBtn.setAttribute('aria-label', v.muted ? 'شغّل الصوت' : 'كتم الصوت');
      return;
    }
    if (v.paused) {
      pauseOthers(v);
      if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    } else v.pause();
  });

  videos.forEach((v) => {
    const card = v.closest('.reel');
    const bar = card.querySelector('.reel-bar i');
    v.addEventListener('play', () => card.classList.add('playing'));
    v.addEventListener('pause', () => card.classList.remove('playing'));
    v.addEventListener('ended', () => { card.classList.remove('playing'); bar.style.width = '0'; v.currentTime = 0; });
    v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = `${(v.currentTime / v.duration) * 100}%`; });
  });

  // active card -> dots; pause anything that scrolls out of view
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const i = Number(en.target.dataset.i);
        if (en.isIntersecting && en.intersectionRatio > 0.6) {
          dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i));
        }
        if (!en.isIntersecting || en.intersectionRatio < 0.35) en.target.querySelector('video')?.pause();
      });
    }, { root: row, threshold: [0, 0.35, 0.6, 1] });
    cards.forEach((c) => io.observe(c));

    // also pause when the whole section leaves the screen
    new IntersectionObserver(([en]) => { if (!en.isIntersecting) pauseOthers(null); }).observe(row);
  }
  dots.firstElementChild?.classList.add('on');
}
