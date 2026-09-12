import { chromium } from 'file:///C:/Users/ertstyuqk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('verification-luminous');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const results = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await context.newPage();
page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER ERROR', error.message); });
page.on('response', response => { if(response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const base = 'http://127.0.0.1:4321';
const check = (name, pass, detail) => { results.push({ name, pass, detail }); if (!pass) console.error('FAIL', name, detail); };
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
console.log('INITIAL', await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, scripts: Array.from(document.scripts).map(s=>s.src), pinned: !!document.querySelector('.pin-spacer'), progress: document.querySelector('[data-intro]').dataset.progress })));
await page.screenshot({ path: path.join(output, 'desktop-start.png') });
check('desktop no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
check('no development error overlay', await page.locator('vite-error-overlay').count() === 0, null);
check('both project slots exist', await page.locator('.project-card').count() === 2, null);
check('paper assets decoded', await page.locator('[data-intro]').getAttribute('data-art-state') === 'ready', null);
check('two raster paper layers', await page.locator('.hand-art').count() === 2, null);
const diagonal = await page.evaluate(() => {
  const l = document.querySelector('[data-fingertip="left"]').getBoundingClientRect();
  const r = document.querySelector('[data-fingertip="right"]').getBoundingClientRect();
  return { dx:r.x-l.x, dy:r.y-l.y };
});
check('upper-left and lower-right diagonal composition', diagonal.dx > 300 && diagonal.dy > 100, diagonal);
const particleMass = ({x, y, radius=100}) => page.locator('particle-field canvas').evaluate((canvas, region) => {
  if (!canvas.clientWidth || !canvas.clientHeight) return 0;
  const c = canvas.getContext('2d'); const dpr = canvas.width / canvas.clientWidth;
  const data = c.getImageData(0,0,canvas.width,canvas.height).data;
  let mass = 0;
  for(let y=Math.max(0,(region.y-region.radius)*dpr|0);y<Math.min(canvas.height,(region.y+region.radius)*dpr);y++)for(let x=Math.max(0,(region.x-region.radius)*dpr|0);x<Math.min(canvas.width,(region.x+region.radius)*dpr);x++) {
    if(Math.hypot(x/dpr-region.x,y/dpr-region.y)<region.radius) mass += data[(y*canvas.width+x)*4+3];
  }
  return mass;
}, {x,y,radius});
const shapeRegion = {x:720,y:700,radius:115};
const massBefore = await particleMass(shapeRegion);
check('dense desktop particle field', Number(await page.locator('particle-field').getAttribute('data-particle-count')) >= 3000, await page.locator('particle-field').getAttribute('data-particle-count'));
await page.mouse.move(shapeRegion.x,shapeRegion.y,{steps:15});
await page.waitForTimeout(2400);
const massAfter = await particleMass(shapeRegion);
check('mouse activates field', await page.locator('particle-field').getAttribute('data-pointer-active') === 'true', null);
check('approaching light dust activates shape', await page.locator('particle-field').getAttribute('data-shape-active') === 'true', null);
check('visible light concentrates into shape region', massAfter > massBefore*1.15, {massBefore,massAfter});
await page.screenshot({path:path.join(output,'desktop-shape.png')});
const frameTiming = await page.evaluate(() => new Promise(resolve=>{
  let previous=performance.now(); const samples=[];
  function next(t){samples.push(t-previous);previous=t;if(samples.length<120)requestAnimationFrame(next);else {samples.sort((a,b)=>a-b);resolve({medianMs:samples[60],p95Ms:samples[114],maxMs:samples[119]});}}
  requestAnimationFrame(next);
}));
console.log('FRAME TIMING (local headless, not device guarantee)',frameTiming);
await fs.writeFile(path.join(output,'frame-timing.json'),JSON.stringify(frameTiming,null,2));
await page.mouse.move(5,40);
await page.waitForTimeout(2000);
check('mouse leave releases field', await page.locator('particle-field').getAttribute('data-pointer-active') === 'false',null);
check('mouse leave releases shape', await page.locator('particle-field').getAttribute('data-shape-active') === 'false',null);
const massReleased=await particleMass(shapeRegion);
check('shape disperses again',massReleased<massAfter*.92,{massReleased,massAfter});
for (const progress of [0.3, 0.55, 0.69, 0.83, 1]) {
  await page.evaluate(p => window.scrollTo(0, innerHeight * 2.2 * p), progress);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(output, `desktop-progress-${progress}.png`) });
  const state = await page.evaluate(() => {
    const point = selector => {
      const p = document.querySelector(selector).getBoundingClientRect();
      return { x: p.x, y: p.y };
    };
    const left = point('[data-fingertip="left"]'); const right = point('[data-fingertip="right"]');
    return { progress: document.querySelector('[data-intro]').dataset.progress, gap: Math.hypot(left.x-right.x,left.y-right.y), stageTop: document.querySelector('[data-stage]').getBoundingClientRect().top };
  });
  check(`stage pinned at ${progress}`, Math.abs(state.stageTop) < 2, state);
  if (progress === 0.69) {
    check('fingertips meet within 2px', state.gap < 2, state);
    const focus = await page.evaluate(()=>{const l=document.querySelector('[data-fingertip="left"]').getBoundingClientRect(),r=document.querySelector('[data-fingertip="right"]').getBoundingClientRect(),s=document.querySelector('[data-stage]').getBoundingClientRect();return {x:(l.x+r.x)/2-s.left,y:(l.y+r.y)/2-s.top};});
    const coreMass=await particleMass({...focus,radius:70});
    const awayMass=await particleMass({x:150,y:800,radius:70});
    check('later stage concentrates light at fingertips',coreMass>awayMass*3,{focus,coreMass,awayMass});
  }
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1100);
check('reverse restores opening', await page.locator('[data-opening]').evaluate(el => Number(getComputedStyle(el).opacity) > .99 && !el.inert), null);
await page.mouse.move(shapeRegion.x,shapeRegion.y,{steps:10});
await page.waitForTimeout(2000);
check('reverse scroll restores interactive shape',await page.locator('particle-field').getAttribute('data-shape-active')==='true',null);
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
check('offscreen particles pause', await page.locator('particle-field').getAttribute('data-particle-state') === 'paused', null);
await page.screenshot({ path: path.join(output, 'desktop-footer.png') });
await page.evaluate(() => window.scrollTo(0, 0));
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(90); await page.mouse.wheel(0,-350); }
await page.waitForTimeout(1000);
check('rapid wheel leaves body accessible', await page.locator('main').isVisible(), null);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference',hasTouch:true });
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: path.join(output, 'mobile-start.png') });
check('mobile no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
const mobileCount=Number(await mobile.locator('particle-field').getAttribute('data-particle-count'));
check('small viewport reduces workload',mobileCount>0&&mobileCount<3000,mobileCount);
await mobile.evaluate(() => window.scrollTo(0, innerHeight * 1.65 * .69));
await mobile.waitForTimeout(1100);
const mobileGap = await mobile.evaluate(() => {
  const p = s => document.querySelector(s).getBoundingClientRect();
  const l = p('[data-fingertip="left"]'), r = p('[data-fingertip="right"]'); return Math.hypot(l.x-r.x,l.y-r.y);
});
check('mobile fingertips meet', mobileGap < 2, mobileGap);
await mobile.locator('.skip-intro').click();
await mobile.waitForTimeout(1100);
await mobile.screenshot({ path: path.join(output, 'mobile-projects.png') });

const reduced = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await reduced.goto(base, { waitUntil: 'networkidle' });
check('reduced motion has no pin spacer', await reduced.locator('.pin-spacer').count() === 0, null);
check('reduced motion freezes particles', await reduced.locator('particle-field').getAttribute('data-particle-state') === 'static', null);
const staticBefore=await reduced.locator('particle-field canvas').evaluate(c=>c.toDataURL());
await reduced.mouse.move(720,700);
await reduced.waitForTimeout(500);
const staticAfter=await reduced.locator('particle-field canvas').evaluate(c=>c.toDataURL());
check('reduced motion pixels remain static on pointer',staticBefore===staticAfter,null);
check('reduced motion has no long scroll intro', await reduced.locator('[data-intro]').evaluate(el => el.getBoundingClientRect().height <= innerHeight+1), null);
await reduced.screenshot({ path: path.join(output, 'reduced-motion.png') });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(500);
check('live reduced motion cleans up pin', await page.locator('.pin-spacer').count() === 0, null);

const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
await nojs.goto(base, { waitUntil: 'networkidle' });
await nojs.locator('.skip-intro').click();
check('without JS projects remain accessible', await nojs.locator('#projects').evaluate(el => Math.abs(el.getBoundingClientRect().top) < 150), null);
const broken = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
await broken.route('**/images/hands/*.webp', route=>route.abort());
await broken.goto(base,{waitUntil:'networkidle'});
await broken.waitForTimeout(500);
check('failed images remove pin safely', await broken.locator('.pin-spacer').count()===0 && await broken.locator('[data-intro]').getAttribute('data-art-state')==='unavailable', null);
await broken.locator('.skip-intro').click();
check('failed images never block projects', await broken.locator('#projects').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<150),null);
const resized = await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
await resized.goto(base,{waitUntil:'networkidle'});
await resized.evaluate(()=>scrollTo(0,innerHeight*2.2*.69));
await resized.waitForTimeout(1100);
await resized.setViewportSize({width:1280,height:800});
await resized.waitForTimeout(500);
await resized.evaluate(()=>scrollTo(0,innerHeight*2.2*.69));
await resized.waitForTimeout(1100);
const resizedGap = await resized.evaluate(()=>{const l=document.querySelector('[data-fingertip="left"]').getBoundingClientRect(),r=document.querySelector('[data-fingertip="right"]').getBoundingClientRect();return Math.hypot(l.x-r.x,l.y-r.y)});
check('resize keeps fingertips aligned',resizedGap<2,resizedGap);
await resized.setViewportSize({width:640,height:900});
await resized.goto(base,{waitUntil:'networkidle'});
const boundary = await resized.evaluate(()=>({handWidth:document.querySelector('[data-hand="left"]').getBoundingClientRect().width,stageHeight:document.querySelector('[data-stage]').clientHeight}));
check('640px uses matching desktop layout',Math.abs(boundary.handWidth - 640*.65)<1,boundary);
await resized.evaluate(()=>scrollTo(0,innerHeight*2.2*.69));
await resized.waitForTimeout(1100);
const boundaryGap=await resized.evaluate(()=>{const l=document.querySelector('[data-fingertip="left"]').getBoundingClientRect(),r=document.querySelector('[data-fingertip="right"]').getBoundingClientRect();return Math.hypot(l.x-r.x,l.y-r.y)});
check('640px fingertips meet',boundaryGap<2,boundaryGap);
check('no runtime errors', errors.length === 0, errors);
await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
console.log(JSON.stringify({ passed: results.filter(r=>r.pass).length, total: results.length, failures: results.filter(r=>!r.pass) }, null, 2));
await browser.close();
if (results.some(r=>!r.pass)) process.exitCode = 1;
