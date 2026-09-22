import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticPreview } from './static-preview.mjs';

const dir = 'review-output/spark-continuous';
await mkdir(dir, { recursive: true });
const preview = await startStaticPreview();
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
});

const report = {
  timestamp: new Date().toISOString(),
  checks: [],
  errors: [],
  notes: [
    'Headless Chromium software GPU (SwiftShader); viewport emulation does not represent physical mobile/desktop hardware GPU performance.'
  ],
  samples: {}
};

const check = (name, pass, detail) => {
  report.checks.push({ name, pass: !!pass, detail });
  if (!pass) {
    report.errors.push(name);
    console.error(`FAIL: ${name}`, detail);
  } else {
    console.log(`PASS: ${name}`);
  }
};

try {
  for (const width of [1440, 390]) {
    const isMobile = width === 390;
    const ctx = await browser.newContext({
      viewport: { width, height: isMobile ? 844 : 900 },
      hasTouch: isMobile,
      reducedMotion: 'no-preference'
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => report.errors.push(e.message));

    await page.goto(preview.base + '/playground/?scenePerf=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[data-inline-spark]')?.dataset.sparkState === 'ready');

    check(`stage rendered (${width})`, await page.locator('[data-inline-spark] .hand-art').count() === 2);
    check(`no startup button (${width})`, await page.locator('.btn-start-first-spark').count() === 0);
    check(`no scroll hijack (${width})`, await page.evaluate(() => scrollY < 5));

    const intro = page.locator('[data-inline-spark]');
    const bounds = await intro.evaluate(e => ({
      start: Number(e.dataset.scrollStart),
      end: Number(e.dataset.scrollEnd)
    }));

    await page.screenshot({ path: `${dir}/spark-cold-${width}.png` });

    const sample = () => intro.evaluate(e => {
      const tips = [...e.querySelectorAll('[data-fingertip]')].map(t => t.getBoundingClientRect());
      const opacity = s => Number(getComputedStyle(e.querySelector(s)).opacity);
      const hostEl = e.querySelector('[data-particle-host]');
      const snapshot = hostEl?.particleSnapshot ? hostEl.particleSnapshot() : null;
      return {
        progress: Number(e.dataset.progress),
        gap: tips.length === 2 ? Math.hypot(tips[0].x - tips[1].x, tips[0].y - tips[1].y) : 0,
        phase: hostEl?.dataset.particlePhase,
        core: opacity('[data-core]'),
        ring: opacity('[data-ring]'),
        camera: opacity('[data-camera]'),
        exposure: opacity('[data-exposure]'),
        arrival: opacity('[data-arrival]'),
        snapshot
      };
    });

    // 1. Forward scrolling through key checkpoints
    const forwardSnapshots = {};
    for (const p of [0.20, 0.35, 0.45, 0.58, 0.70, 0.86, 0.98]) {
      const target = bounds.start + (bounds.end - bounds.start) * p;
      for (let n = 0; n < 35; n++) {
        const y = await page.evaluate(() => scrollY);
        if (Math.abs(target - y) < 3) break;
        const delta = Math.max(-180, Math.min(180, target - y));
        await page.mouse.wheel(0, delta);
        await page.waitForFunction(y => Math.abs(scrollY - y) < 4, y + delta, { timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(450);
      const result = await sample();
      forwardSnapshots[p] = result;
      check(`spark forward reach ${p} (${width})`, Math.abs(result.progress - p) < 0.025, {
        target: p,
        actual: result.progress
      });

      if (p === 0.45) {
        // Continuous convergence check: all moving particles funnel toward focal point
        if (result.snapshot) {
          const moving = result.snapshot.particles.filter(pt => pt.alpha > 0.01);
          check(`visible particles at 0.45 (${width})`, moving.length > 200, moving.length);
          const avgX = moving.reduce((s, pt) => s + pt.x, 0) / moving.length;
          const focusX = width * 0.5;
          check(`funnel centered near focus at 0.45 (${width})`, Math.abs(avgX - focusX) < width * 0.08, {
            avgX,
            focusX
          });
        }
      }

      if (p === 0.58) {
        check(`fingertip contact at 0.58 (${width})`, result.gap < 2, { gap: result.gap });
      }

      if (p === 0.70) {
        check(`sustained core at 0.70 (${width})`, result.core > 0.9, { core: result.core });
        // Both main and tail cohorts absorbed by 0.70
        if (result.snapshot) {
          const unabsorbed = result.snapshot.particles.filter(pt => pt.alpha > 0.001);
          check(`particles fully absorbed by 0.70 (${width})`, unabsorbed.length === 0, {
            unabsorbedCount: unabsorbed.length
          });
        }
      }

      if (p === 0.86) {
        check(`fade after contact (${width})`, result.camera < 0.6 && result.exposure > 0.5, result);
      }

      if (p === 0.98) {
        check(`completion at 0.98 (${width})`, result.arrival > 0.6 && result.camera < 0.05, result);
      }

      await page.screenshot({ path: `${dir}/spark-fwd-${width}-${p}.png` });
    }

    // 2. Reverse scrolling test: wheel backward to 0.45, then 0.20
    for (const p of [0.45, 0.20]) {
      const target = bounds.start + (bounds.end - bounds.start) * p;
      for (let n = 0; n < 35; n++) {
        const y = await page.evaluate(() => scrollY);
        if (Math.abs(target - y) < 3) break;
        const delta = Math.max(-180, Math.min(180, target - y));
        await page.mouse.wheel(0, delta);
        await page.waitForFunction(y => Math.abs(scrollY - y) < 4, y + delta, { timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(450);
      const revResult = await sample();
      check(`spark reverse reach ${p} (${width})`, Math.abs(revResult.progress - p) < 0.025, {
        target: p,
        actual: revResult.progress
      });

      if (p === 0.45 && forwardSnapshots[0.45]?.snapshot && revResult.snapshot) {
        const fwdPts = forwardSnapshots[0.45].snapshot.particles;
        const revPts = revResult.snapshot.particles;
        let maxDiff = 0;
        for (let i = 0; i < Math.min(fwdPts.length, revPts.length); i++) {
          const diff = Math.hypot(fwdPts[i].x - revPts[i].x, fwdPts[i].y - revPts[i].y);
          if (diff > maxDiff) maxDiff = diff;
        }
        check(`reverse seek positions match (${width})`, maxDiff < 0.1, { maxDiff });
      }

      if (p === 0.20) {
        check(`hands separate on reverse (${width})`, revResult.gap > 80, { gap: revResult.gap });
        check(`core inactive on reverse (${width})`, revResult.core < 0.05, revResult.core);
      }

      await page.screenshot({ path: `${dir}/spark-rev-${width}-${p}.png` });
    }

    // 3. Skip intro button test
    await intro.locator('.skip-intro').click();
    await page.waitForFunction(() => {
      const r = document.querySelector('#other-experiments')?.getBoundingClientRect();
      return r && r.top < innerHeight && r.bottom > 0;
    }, null, { timeout: 5000 });
    check(`skip keeps scene (${width})`, await intro.count() === 1);
    check(`skip reaches content (${width})`, await page.locator('#other-experiments').evaluate(e => {
      const r = e.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }));
    check(`sticky scene needs no pin spacer (${width})`, await page.locator('.pin-spacer').count() === 0);

    // 4. Reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-inline-spark]')?.dataset.artState === 'static-reduced');
    check(`reduced pose active (${width})`, await intro.getAttribute('data-art-state') === 'static-reduced');
    await page.screenshot({ path: `${dir}/spark-reduced-${width}.png` });

    await ctx.close();
  }
} catch (err) {
  report.errors.push(String(err));
  console.error('Fatal error during test run:', err);
} finally {
  await browser.close();
  await preview.close();
  await writeFile(`${dir}/results.json`, JSON.stringify(report, null, 2));
}

console.log('\n--- VERIFICATION SUMMARY ---');
console.log(`Checks run: ${report.checks.length}`);
console.log(`Passed: ${report.checks.filter(c => c.pass).length}`);
console.log(`Errors: ${report.errors.length}`);
if (report.errors.length) {
  process.exitCode = 1;
}
