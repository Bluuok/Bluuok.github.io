import { chromium } from 'file:///C:/Users/ertstyuqk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('verification');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const results = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER ERROR', error.message); });
const base = 'http://127.0.0.1:4321';
const check = (name, pass, detail) => { results.push({ name, pass, detail }); if (!pass) console.error('FAIL', name, detail); };
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
console.log('INITIAL', await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, scripts: Array.from(document.scripts).map(s=>s.src), pinned: !!document.querySelector('.pin-spacer'), progress: document.querySelector('[data-intro]').dataset.progress })));
await page.screenshot({ path: path.join(output, 'desktop-start.png') });
check('desktop no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
check('no development error overlay', await page.locator('vite-error-overlay').count() === 0, null);
check('both project slots exist', await page.locator('.project-card').count() === 2, null);
for (const progress of [0.3, 0.55, 0.69, 0.83, 1]) {
  await page.evaluate(p => window.scrollTo(0, innerHeight * 2.2 * p), progress);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(output, `desktop-progress-${progress}.png`) });
  const state = await page.evaluate(() => {
    const point = selector => {
      const svg = document.querySelector(selector);
      const p = new DOMPoint(600, 132).matrixTransform(svg.getScreenCTM());
      return { x: p.x, y: p.y };
    };
    const left = point('.hand-svg--left'); const right = point('.hand-svg--right');
    return { progress: document.querySelector('[data-intro]').dataset.progress, gap: Math.hypot(left.x-right.x,left.y-right.y), stageTop: document.querySelector('[data-stage]').getBoundingClientRect().top };
  });
  check(`stage pinned at ${progress}`, Math.abs(state.stageTop) < 2, state);
  if (progress === 0.69) check('fingertips meet within 2px', state.gap < 2, state);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1100);
check('reverse restores opening', await page.locator('[data-opening]').evaluate(el => Number(getComputedStyle(el).opacity) > .99 && !el.inert), null);
await page.locator('.skip-intro').click();
await page.waitForTimeout(1100);
let top = await page.locator('#projects').evaluate(el => el.getBoundingClientRect().top);
check('skip reaches projects below fixed header', top >= 88 && top <= 130, top);
await page.screenshot({ path: path.join(output, 'desktop-projects.png') });
await page.locator('.project-cover').first().click();
await page.waitForLoadState('networkidle');
check('project detail route works', await page.locator('main h1').innerText() === 'Clawtide', page.url());
await page.locator('main').getByRole('link', { name: '返回全部作品', exact: false }).click();
await page.waitForTimeout(1300);
top = await page.locator('#projects').evaluate(el => el.getBoundingClientRect().top);
check('return from detail preserves project anchor', top >= 88 && top <= 130, top);
await page.goto(`${base}/#projects`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);
top = await page.locator('#projects').evaluate(el => el.getBoundingClientRect().top);
check('direct project hash survives pin initialization', top >= 88 && top <= 130, top);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(output, 'desktop-footer.png') });
await page.evaluate(() => window.scrollTo(0, 0));
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(90); await page.mouse.wheel(0,-350); }
await page.waitForTimeout(1000);
check('rapid wheel leaves body accessible', await page.locator('main').isVisible(), null);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: path.join(output, 'mobile-start.png') });
check('mobile no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
await mobile.evaluate(() => window.scrollTo(0, innerHeight * 1.65 * .69));
await mobile.waitForTimeout(1100);
const mobileGap = await mobile.evaluate(() => {
  const p = s => new DOMPoint(600,132).matrixTransform(document.querySelector(s).getScreenCTM());
  const l = p('.hand-svg--left'), r = p('.hand-svg--right'); return Math.hypot(l.x-r.x,l.y-r.y);
});
check('mobile fingertips meet', mobileGap < 2, mobileGap);
await mobile.locator('.skip-intro').click();
await mobile.waitForTimeout(1100);
await mobile.screenshot({ path: path.join(output, 'mobile-projects.png') });

const reduced = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await reduced.goto(base, { waitUntil: 'networkidle' });
check('reduced motion has no pin spacer', await reduced.locator('.pin-spacer').count() === 0, null);
check('reduced motion has no long scroll intro', await reduced.locator('[data-intro]').evaluate(el => el.getBoundingClientRect().height <= innerHeight+1), null);
await reduced.screenshot({ path: path.join(output, 'reduced-motion.png') });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(500);
check('live reduced motion cleans up pin', await page.locator('.pin-spacer').count() === 0, null);

const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
await nojs.goto(base, { waitUntil: 'networkidle' });
await nojs.locator('.skip-intro').click();
check('without JS projects remain accessible', await nojs.locator('#projects').evaluate(el => Math.abs(el.getBoundingClientRect().top) < 150), null);
check('no runtime errors', errors.length === 0, errors);
await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
console.log(JSON.stringify({ passed: results.filter(r=>r.pass).length, total: results.length, failures: results.filter(r=>!r.pass) }, null, 2));
await browser.close();
if (results.some(r=>!r.pass)) process.exitCode = 1;
