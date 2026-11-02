// Dev-only: phone-sized screenshots with the locally installed Chrome, for visual checks.
// Usage: node shot.mjs <outDir> '<steps json>' [width] [height]
//   steps: [{"url":"..."}, {"js":"..."}, {"wait":500}, {"shot":"name","full":false}]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, stepsJson, w = '375', h = '812'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 2, isMobile: Number(w) < 768, hasTouch: Number(w) < 768 });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

for (const step of JSON.parse(stepsJson)) {
  if (step.url) await page.goto(step.url, { waitUntil: 'networkidle0' });
  if (step.js) console.log('js →', JSON.stringify(await page.evaluate(`(async () => { ${step.js} })()`)));
  if (step.wait) await new Promise((r) => setTimeout(r, step.wait));
  if (step.shot) {
    const file = join(outDir, `${step.shot}.png`);
    await page.screenshot({ path: file, fullPage: !!step.full });
    console.log('shot →', file);
  }
}
if (logs.length) console.log(logs.join('\n'));
await browser.close();
