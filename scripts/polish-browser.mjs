import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {startStaticPreview} from './static-preview.mjs';
const dir='review-output/polish-latest';await mkdir(dir,{recursive:true});const preview=await startStaticPreview();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const report={checks:[],errors:[],notes:['Headless Chromium software GPU; viewport emulation is not a physical-device performance measurement.']};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)report.errors.push(name);};
try{
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,recordVideo:{dir}}),page=await ctx.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));
  for(const [name,route,selector,state] of [['cloth','/','#cloth-stage','clothState'],['cove','/projects/threadcove/','[data-paper-cloth]','clothState'],['tidal','/projects/clawtide/','[data-tidal]','renderState']]){
   await page.goto(preview.base+route,{waitUntil:'networkidle'});const art=page.locator(selector);await art.scrollIntoViewIfNeeded();
   await page.waitForFunction(([selector,state])=>['running','ready'].includes(document.querySelector(selector)?.dataset[state]),[selector,state]);await page.waitForTimeout(800);
   await page.screenshot({path:dir+'/'+name+'-'+width+'.png'});
   check(name+' '+width+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(name==='cove'){
    check('four surfaces '+width,await art.getAttribute('data-surface-count')==='4');
    const tabs=page.locator('[data-research-desk] [role=tab]');await tabs.first().focus();await page.keyboard.press('End');
    check('Cove keyboard End '+width,await tabs.last().getAttribute('aria-selected')==='true');
    check('Cove visual selected '+width,await art.getAttribute('data-selection')==='3');
    await page.keyboard.press('Home');check('Cove keyboard Home '+width,await tabs.first().getAttribute('aria-selected')==='true');
    await page.locator('h1').click();await art.scrollIntoViewIfNeeded();
    const canvas=art.locator('canvas'),b=await canvas.boundingBox();let selected=false;
    for(const y of [.38,.48,.62,.72]){for(const x of [.28,.4,.6,.72]){await page.mouse.click(b.x+b.width*x,b.y+b.height*y);if(await art.getAttribute('data-selection')!=='0'){selected=true;break;}}if(selected)break;}
    check('Cove mesh click '+width,selected);
    const before=await art.getAttribute('data-selection');let grab=false;
    for(const y of [.4,.6]){for(const x of [.25,.5,.75]){await page.mouse.move(b.x+b.width*x,b.y+b.height*y);await page.mouse.down();await page.mouse.move(b.x+b.width*x+35,b.y+b.height*y-20,{steps:5});grab=await art.getAttribute('data-grabbed')==='true';await page.mouse.up();if(grab)break;}if(grab)break;}
    check('Cove drag '+width,grab);check('Cove drag does not select '+width,before===await art.getAttribute('data-selection'));
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-paper-cloth]')?.dataset.clothState==='static');
    check('Cove reduced cards '+width,await tabs.first().isVisible());await tabs.last().click();check('Cove reduced selection '+width,await tabs.last().getAttribute('aria-selected')==='true');
    await page.screenshot({path:dir+'/cove-reduced-'+width+'.png'});await page.emulateMedia({reducedMotion:'no-preference'});
   }
   if(name==='tidal'){
    const canvas=art.locator('canvas'),b=await canvas.boundingBox();let selected=false;
    for(const y of [.3,.4,.5,.6,.7]){for(const x of [.25,.4,.55,.7]){await page.mouse.click(b.x+b.width*x,b.y+b.height*y);if(await art.getAttribute('data-selection')!=='0'){selected=true;break;}}if(selected)break;}
    check('ceramic mesh selection '+width,selected);
    await page.mouse.move(b.x+b.width*.8,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.5,{steps:20});await page.mouse.up();await page.waitForTimeout(800);
    const angle=Number(await art.getAttribute('data-azimuth'));await art.locator('[role=tab]').last().click();await page.waitForTimeout(200);
    check('ceramic selecting retains rotation '+width,Math.abs(Number(await art.getAttribute('data-azimuth'))-angle)<.06);
   }
  }
  await page.goto(preview.base+'/playground/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.sparkState==='ready');
  check('no startup gate '+width,await page.locator('.btn-start-first-spark').count()===0);check('no scroll hijack '+width,await page.evaluate(()=>scrollY<5));
  const intro=page.locator('[data-inline-spark]'),bounds=await intro.evaluate(e=>({start:Number(e.dataset.scrollStart),end:Number(e.dataset.scrollEnd)}));
  await page.screenshot({path:dir+'/spark-cold-'+width+'.png'});
  const sample=()=>intro.evaluate(e=>{const tips=[...e.querySelectorAll('[data-fingertip]')].map(t=>t.getBoundingClientRect());return {progress:Number(e.dataset.progress),gap:Math.hypot(tips[0].x-tips[1].x,tips[0].y-tips[1].y),phase:e.querySelector('[data-particle-host]').dataset.particlePhase};});
  for(const p of [.45,.58,.72,.86,.98,.2]){
   const target=bounds.start+(bounds.end-bounds.start)*p;
   for(let n=0;n<30;n++){const y=await page.evaluate(()=>scrollY);if(Math.abs(target-y)<3)break;const delta=Math.max(-200,Math.min(200,target-y));await page.mouse.wheel(0,delta);await page.waitForFunction(y=>Math.abs(scrollY-y)<4,y+delta);}
   await page.waitForTimeout(100);const result=await sample();check('spark wheel '+width+' '+p,Math.abs(result.progress-p)<.015,result);
   if(p===.58)check('fingertips meet '+width,result.gap<2,result);
   await page.screenshot({path:dir+'/spark-'+width+'-'+p+'.png'});
  }
  await intro.locator('.skip-intro').click();await page.waitForFunction(()=>{const r=document.querySelector('#other-experiments').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;},null,{timeout:5000});check('skip keeps scene '+width,await intro.count()===1);check('skip reaches content '+width,await page.locator('#other-experiments').evaluate(e=>e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0));
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.artState==='static-reduced');check('spark reduced pose '+width,await intro.getAttribute('data-art-state')==='static-reduced');
  await ctx.close();
 }
 const ctx=await browser.newContext({javaScriptEnabled:false});const page=await ctx.newPage();await page.goto(preview.base+'/projects/threadcove/');check('no JS four cards',await page.locator('[data-research-desk] [role=tab]:visible').count()===4);await page.goto(preview.base+'/playground/');check('no JS hands present',await page.locator('.hand-art').count()===2);await ctx.close();
} catch(e){report.errors.push(String(e));}finally{await writeFile(dir+'/results.json',JSON.stringify(report,null,2));await browser.close();await preview.close();}
console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
