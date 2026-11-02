# GOLDEN غولدن — landing page + digital menu

Static site (HTML/CSS/JS, no build step) for Golden Bakery, Golden Snack and مخبز ومأكولات غولدن in Sweida.

- `index.html`: the landing page, reels, three-store menu and call-to-order receipt
- `admin/`: CMS **demo**. Edits are saved in the browser of the device you edit on, and the site on that same device shows them.
- `data/menu.json`: all stores, items, prices and links. Anything tagged in `"mock"` is placeholder data to confirm with the owner.

## Run locally

```bash
node tools/serve.mjs
```

Open http://localhost:5173/golden/. The site is served under a sub-path, the same way GitHub Pages serves it.

## Upload to GitHub Pages

1. Upload everything **except** `imgvid/` (raw source media) and `tools/node_modules/`.
2. In the repo, go to Settings → Pages → deploy from the branch root.
3. When you change files later, bump `VERSION` in `sw.js` (e.g. `golden-v3`) so phones that installed the app get the update.

## Updating the menu without the admin

Edit `data/menu.json` directly. Alternatively, use **admin → الإعدادات → نزّل المنيو كملف** and replace `data/menu.json` with the downloaded file.

## Dev tools (`tools/`, not needed on the server)

- `npm install`, then `npm run media`: rebuilds `assets/img`, `assets/video` and the icons from `imgvid/` (including the stock photos in `imgvid/stock/`).
- `node brand-svg.mjs`: rebuilds the loading-screen wordmark (غولدن + GOLDEN, both in Reem Kufi) as inline SVG in `index.html`.
- `node fetch-fonts.mjs`: re-downloads the self-hosted fonts.
- `node shot.mjs`: takes phone-size screenshots with local Chrome, for visual checks.

## Photo credits

The hero photo and the Golden Snack menu photos are free stock photos from Unsplash (Unsplash License: free to use, no attribution required). Swap them for the store's own photos when available. Sources:

- `hero`: https://unsplash.com/photos/pizza-baking-in-wood-fired-oven-vHRFraV4U00
- `snack-cover`: https://unsplash.com/photos/hamburger-by-french-fries-on-board-uVPV_nV17Tw
- `snack-crispy`: https://unsplash.com/photos/a-chicken-sandwich-with-lettuce-and-mayonnaise-on-a-black-background-VFVnZfogE7s
- `snack-zinger`: https://unsplash.com/photos/a-fried-chicken-sandwich-on-a-wooden-table-UDYjeBwFZf8
- `snack-fajita`: https://unsplash.com/photos/cooked-food-WYnj4atCRFY
- `snack-escalope`: https://unsplash.com/photos/a-plate-of-food-q4D17QbFH28
- `snack-burger`: https://unsplash.com/photos/double-cheeseburger-with-pickles-pu6b4yIlQF4
- `snack-crispy-meal`: https://unsplash.com/photos/a-wooden-plate-topped-with-fried-chicken-and-french-fries-HNObIv6zmN0
- `snack-fajita-meal`: https://unsplash.com/photos/a-wooden-table-topped-with-plates-of-food-G3hZMCdLUdw
- `snack-burger-meal`: https://unsplash.com/photos/burger-and-fries-on-white-ceramic-plate-DHxLfzqhoIk
- `snack-grilled-chicken`: https://unsplash.com/photos/chickens-rotating-and-roasting-over-open-flames-WsGjb9FWUyE
- `snack-broasted`: https://unsplash.com/photos/brown-cookies-in-white-container-qcLlJvBK3eI
- `snack-fries`: https://unsplash.com/photos/a-bowl-of-french-fries-W10EFJvbu4c
- `snack-toum`: https://unsplash.com/photos/white-garlic-on-black-table-2yNBQFwZCA8
- `snack-soda`: https://unsplash.com/photos/clear-drinking-glass-with-ice-and-black-liquid-i597Mg_WSPw
