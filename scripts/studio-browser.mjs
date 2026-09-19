import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const output = 'review-output';
await mkdir(`${output}/screenshots`, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '4321', '--bind', '127.0.0.1', '--directory', 'dist'], { stdio: 'ignore' });
const base = 'http://127.0.0.1:4321';
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(base)).ok) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 100));
}
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const report = { commit: process.env.GITHUB_SHA ?? 'local', browser: browser.version(), platform: process.platform, checks: [], errors: [], notes: ['Chromium software GPU in CI; not physical mobile or field performance.'] };
const routes = [['home', '/'], ['clawtide', '/projects/clawtide/'], ['threadcove', '/projects/threadcove/'], ['playground', '/playground/']];
const check = (name, ok, details = '') => {
  report.checks.push({ name, pass: !!ok, details });
  if (!ok) report.errors.push(name);
};
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const [name, path] of routes) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const label = `${name}-${viewport.width}`;
      check(`${label}: HTTP`, response?.status() === 200);
      check(`${label}: single heading`, await page.locator('h1').count() === 1);
      check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/screenshots/${label}.png`, fullPage: true });
      if (name === 'home') {
        check(`${label}: hands not loaded`, !requests.some(url => /hand-(left|right)|paper-hand/.test(url)));
        const cloth = page.locator('#cloth-stage');
        if (await cloth.count()) {
          await cloth.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1800);
          const state = await cloth.getAttribute('data-cloth-state');
          check(`${label}: cloth lifecycle`, ['running', 'fallback', 'static', 'paused'].includes(state), state);
          await page.screenshot({ path: `${output}/screenshots/cloth-${viewport.width}.png` });
          if (state === 'running') {
            const bounds = await cloth.boundingBox();
            let hit = false;
            for (const x of [.35, .5, .65]) {
              await page.mouse.move(bounds.x + bounds.width * x, bounds.y + bounds.height * .5);
              await page.waitForTimeout(100);
              if (await cloth.getAttribute('data-pointer-hit') === 'true') { hit = true; break; }
            }
            check(`${label}: cloth raycast`, hit);
            await page.screenshot({ path: `${output}/screenshots/cloth-pointer-${viewport.width}.png` });
            await page.mouse.move(2, 2);
            await page.waitForTimeout(1300);
            check(`${label}: cloth release`, await cloth.getAttribute('data-pointer-hit') === 'false');
          }
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForTimeout(200);
          check(`${label}: static on reduced motion`, await cloth.getAttribute('data-cloth-state') === 'static');
          await page.screenshot({ path: `${output}/screenshots/cloth-reduced-${viewport.width}.png` });
        }
      }
      check(`${label}: no page errors`, errors.length === 0, errors.join('\n'));
      await context.close();
    }
  }
  for (const [name, path] of routes) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    check(`${name}: no-JS heading`, await page.locator('h1').isVisible());
    check(`${name}: no-JS links`, await page.locator('a[href]').count() > 2);
    await context.close();
  }
} finally {
  await writeFile(`${output}/browser-results.json`, JSON.stringify(report, null, 2));
  await browser.close();
  server.kill();
}
assert.equal(report.errors.length, 0, report.errors.join('\n'));
