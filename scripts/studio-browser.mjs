import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticPreview } from './static-preview.mjs';
import assert from 'node:assert/strict';

const output = 'review-output';
await mkdir(`${output}/screenshots`, { recursive: true });
const preview=await startStaticPreview();
const base=preview.base;
const browser = await chromium.launch({ headless:true, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
const report = { commit:process.env.GITHUB_SHA ?? 'local', browser:browser.version(), platform:process.platform, checks:[], errors:[], notes:['Chromium software GPU in CI. Mobile sizes are viewport emulation, not physical mobile devices or field performance.'] };
const routes = [['home','/'],['clawtide','/projects/clawtide/'],['threadcove','/projects/threadcove/'],['playground','/playground/']];
const check = (name, ok, details='') => { report.checks.push({ name, pass:!!ok, details }); if (!ok) report.errors.push(name); };
const screenshot = (page, name, fullPage=false) => page.screenshot({ path:`${output}/screenshots/${name}.png`, fullPage, timeout:30000 });
async function verifyTabs(page, root, label) {
  const tabs = root.locator('[role="tab"]');
  await tabs.last().focus(); await page.keyboard.press('Space');
  check(`${label}: selected tab`, await tabs.last().getAttribute('aria-selected') === 'true');
  check(`${label}: one visible panel`, await root.locator('[role="tabpanel"]:visible').count() === 1);
  await tabs.last().focus(); await page.keyboard.press('Home');
  check(`${label}: Home key`, await tabs.first().evaluate(e => e === document.activeElement && e.getAttribute('aria-selected') === 'true'));
}
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    for (const [name,path] of routes) {
      const context = await browser.newContext({ viewport, deviceScaleFactor:1, reducedMotion:'no-preference' });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      const errors = [], requests = [], responses = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      page.on('response', response => { if(response.status()>=400)responses.push(`${response.status()} ${response.url()}`); });
      const label = `${name}-${viewport.width}`;
      try {
        const response = await page.goto(`${base}${path}`, { waitUntil:'networkidle' });
        await page.waitForTimeout(500);
        check(`${label}: HTTP`, response?.status() === 200);
        check(`${label}: single heading`, await page.locator('h1').count() === 1);
        check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
        // Cove begins preparing in the first viewport. Capture the complete scene,
        // rather than racing its asynchronous shader compilation on CI software GPUs.
        if(name==='threadcove')await page.waitForFunction(()=>document.querySelector('[data-paper-cloth]')?.dataset.clothState==='running',null,{timeout:30000});
        await screenshot(page, `${label}-hero`);
        if (name === 'home') {
          check(`${label}: particles preserved`, await page.locator('particle-field canvas').count() === 1);
          check(`${label}: original hands not loaded`, !requests.some(u => /paper-hand/.test(u)));
          const cloth = page.locator('#cloth-stage');
          await cloth.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => document.querySelector('#cloth-stage')?.getAttribute('data-cloth-state') === 'running');
          check(`${label}: live WebGL cloth`, await cloth.getAttribute('data-cloth-state') === 'running');
          check(`${label}: coated satin material`, await cloth.getAttribute('data-cloth-material') === 'coated-white-satin');
          await screenshot(page, `cloth-${viewport.width}`);
          const bounds = await cloth.boundingBox(); let hit = false;
          for(const x of [.35,.5,.65]) {
            await page.mouse.move(bounds.x+bounds.width*x,bounds.y+bounds.height*.5); await page.waitForTimeout(120);
            if(await cloth.getAttribute('data-pointer-hit') === 'true') {hit=true;break;}
          }
          check(`${label}: cloth raycast`,hit); await page.waitForTimeout(450);
          await screenshot(page, `cloth-pointer-${viewport.width}`);
          await cloth.locator('canvas').dispatchEvent('pointercancel',{pointerType:'touch'}); await page.waitForTimeout(150);
          check(`${label}: pointer cancellation`,await cloth.getAttribute('data-pointer-hit') === 'false');
          await page.mouse.move(2,2); await page.waitForTimeout(1300);
          check(`${label}: pointer released`,await cloth.getAttribute('data-pointer-hit') === 'false');
          // Wait for the actual preference-driven lifecycle transition, not a fixed
          // sleep that races software-GPU rendering. A missing transition still fails.
          await page.emulateMedia({reducedMotion:'reduce'});
          await page.waitForFunction(() => document.querySelector('#cloth-stage')?.getAttribute('data-cloth-state') === 'static');
          check(`${label}: reduced static`,await cloth.getAttribute('data-cloth-state') === 'static');
          await screenshot(page,`cloth-reduced-${viewport.width}`);
          await page.emulateMedia({reducedMotion:'no-preference'});
          await page.waitForFunction(() => document.querySelector('#cloth-stage')?.getAttribute('data-cloth-state') === 'running');
          check(`${label}: resumed`,await cloth.getAttribute('data-cloth-state') === 'running');
        }
        if(name === 'clawtide') {
          const art = page.locator('[data-tidal]');
          await art.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => document.querySelector('[data-tidal]')?.getAttribute('data-render-state') === 'ready');
          check(`${label}: live ceramic sculpture`,await art.getAttribute('data-render-state') === 'ready');
          await screenshot(page,`tidal-${viewport.width}`);
          await verifyTabs(page,art,`${label}: entry tabs`);
        }
        if(name === 'threadcove') {
          const desk = page.locator('[data-research-desk]');
          await desk.scrollIntoViewIfNeeded(); await verifyTabs(page,desk,`${label}: research stages`);
          const paper=desk.locator('[data-paper-cloth]'); await paper.scrollIntoViewIfNeeded();
          await page.waitForFunction(()=>document.querySelector('[data-paper-cloth]')?.getAttribute('data-cloth-state')==='running');
          check(`${label}: shared paper physics`,await paper.getAttribute('data-cloth-solver')==='xpbd');
          await screenshot(page,`desk-${viewport.width}`);
        }
        if(name === 'clawtide'||name === 'threadcove') {
          const evidence = page.locator('[data-evidence]');
          await evidence.scrollIntoViewIfNeeded(); await verifyTabs(page,evidence,`${label}: evidence tabs`);
          for(const tab of await evidence.locator('[role="tab"]').all()) {
            await tab.click();
            const image = evidence.locator('[role="tabpanel"]:visible img');
            await image.evaluate(img => img.decode());
            check(`${label}: real evidence image`,await image.evaluate(img => img.naturalWidth >= 1000));
          }
          await evidence.locator('[role="tab"]').first().click();
          await screenshot(page,`evidence-${name}-${viewport.width}`);
        }
        if(name === 'playground') {
          check(label+': stage rendered by server',await page.locator('[data-inline-spark] .hand-art').count()===2);
          check(label+': no startup button',await page.locator('.btn-start-first-spark').count()===0);
          await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.sparkState==='ready');
          check(label+': no initial scroll hijack',await page.evaluate(()=>scrollY<5));
          const intro=page.locator('[data-inline-spark]');
          const timing=await intro.evaluate(e=>({start:Number(e.dataset.scrollStart),end:Number(e.dataset.scrollEnd)}));
          await page.evaluate(t=>scrollTo({top:t.start+(t.end-t.start)*.72,behavior:'instant'}),timing);await page.waitForTimeout(300);
          check(label+': timeline follows scroll',Math.abs(Number(await intro.getAttribute('data-progress'))-.72)<.02);
          await screenshot(page,'first-spark-'+viewport.width);
          await intro.locator('.skip-intro').click();await page.waitForTimeout(500);
          check(label+': skip preserves stage',await intro.count()===1);
          await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.artState==='static-reduced');
          check(label+': reduced static hands',await intro.getAttribute('data-art-state')==='static-reduced');
        }
        const loaded = await page.locator('img').evaluateAll(async images => {
          return Promise.all(images.map(async img => {img.loading='eager';try{await img.decode();return {src:img.getAttribute('src'),ok:img.naturalWidth>0};}catch{return {src:img.getAttribute('src'),ok:false};}}));
        });
        check(`${label}: no broken media`,loaded.every(image=>image.ok),JSON.stringify(loaded.filter(image=>!image.ok)));
        check(`${label}: no failed HTTP resources`,responses.length===0,responses.join('\n'));
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'})); await page.waitForTimeout(150);
        await screenshot(page,label,true);
      } catch(error) { check(`${label}: workflow`,false,String(error)); await screenshot(page,`${label}-failure`).catch(captureError=>report.notes.push(`${label}: failure screenshot unavailable: ${captureError.message}`)); }
      check(`${label}: no page errors`,errors.length===0,errors.join('\n'));
      await context.close();
    }
  }
  for(const [name,path] of routes) {
    const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:720}});
    const page = await context.newPage(); await page.goto(`${base}${path}`,{waitUntil:'networkidle'});
    check(`${name}: no-JS heading`,await page.locator('h1').isVisible());
    check(`${name}: no-JS links`,await page.locator('a[href]').count()>2);
    if(name==='clawtide'||name==='threadcove')check(`${name}: no-JS evidence`,await page.locator('[data-evidence] figure:visible').count()===2);
    await context.close();
  }
} finally {
  await writeFile(`${output}/browser-results.json`,JSON.stringify(report,null,2));
  await browser.close(); await preview.close();
}
assert.equal(report.errors.length,0,report.errors.join('\n'));
