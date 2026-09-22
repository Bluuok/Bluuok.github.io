import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startStaticPreview} from './static-preview.mjs';
const out='review-output/interaction-rebuild';await mkdir(out,{recursive:true});
const preview=await startStaticPreview();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const results={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),uncommitted:true,checks:[],errors:[],notes:['Desktop Chromium with software GPU; not physical mobile GPU performance.']};
const check=(name,pass,details={})=>{results.checks.push({name,pass:!!pass,details});if(!pass)results.errors.push(name);};
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference',recordVideo:{dir:out,size:{width:1440,height:1000}}});
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.errors.push(e.message));
const snap=async(name)=>page.screenshot({path:`${out}/${name}.png`});
try{
 for(const [name,path,selector] of [['wind','/','#cloth-stage'],['paper','/projects/threadcove/','[data-paper-cloth]']]){
  await page.goto(preview.base+path,{waitUntil:'networkidle'});const stage=page.locator(selector);await stage.scrollIntoViewIfNeeded();
  await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.clothState==='running',selector);
  await page.waitForTimeout(1200);await snap(name+'-rest');
  const b=await stage.boundingBox();let hit=null;
  for(const y of [.55,.45,.65,.35]){for(const x of [.5,.4,.6,.3,.7]){
   await page.mouse.move(b.x+b.width*x,b.y+b.height*y);await page.waitForTimeout(80);
   if(await stage.getAttribute('data-pointer-hit')==='true'){hit={x:b.x+b.width*x,y:b.y+b.height*y};break;}
  }if(hit)break;}
  check(name+': mesh raycast',!!hit);
  if(hit){await page.mouse.move(hit.x-40,hit.y);await page.mouse.move(hit.x,hit.y,{steps:5});await page.waitForTimeout(300);await snap(name+'-gust');
   let grabbed=false;
   for(const fy of [.55,.45,.65,.35]){for(const fx of [.5,.4,.6,.3,.7]){
     hit={x:b.x+b.width*fx,y:b.y+b.height*fy};await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x+12,hit.y-8,{steps:2});
     grabbed=await stage.getAttribute('data-grabbed')==='true';if(grabbed)break;await page.mouse.up();
   }if(grabbed)break;}
   check(name+': grab acquired',grabbed);
   await page.mouse.move(hit.x+130,hit.y-95,{steps:22});await page.waitForTimeout(350);await snap(name+'-drag');
   await page.mouse.up();await page.mouse.move(5,5);await page.waitForTimeout(250);await snap(name+'-release');
   check(name+': grab released',await stage.getAttribute('data-grabbed')==='false');await page.waitForTimeout(700);await snap(name+'-rebound');}
 }
 await page.goto(preview.base+'/projects/clawtide/',{waitUntil:'networkidle'});
 const art=page.locator('[data-tidal]'),viewport=art.locator('.tidal-viewport');await viewport.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-tidal]').dataset.renderState==='ready');
 const b=await viewport.boundingBox();await snap('ceramic-default');
 await page.mouse.move(b.x+b.width*.9,b.y+b.height*.5);await page.waitForTimeout(600);
 check('ceramic: visible hover angle',Math.abs(Number(await art.getAttribute('data-hover-angle')))>.25);await snap('ceramic-hover');
 const before=Number(await art.getAttribute('data-azimuth'));
 await page.mouse.move(b.x+b.width*.8,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.5,{steps:28});await page.mouse.up();await page.waitForTimeout(1000);
 const after=Number(await art.getAttribute('data-azimuth'));check('ceramic: can turn to rear',Math.abs(after-before)>1.5,{before,after});await snap('ceramic-back');
 await page.mouse.move(5,5);await page.waitForTimeout(800);const retained=Number(await art.getAttribute('data-azimuth'));check('ceramic: keeps view',Math.abs(after-retained)<.08,{after,retained});
 await art.locator('[data-reset-view]').click();await page.waitForTimeout(500);check('ceramic: reset',Math.abs(Number(await art.getAttribute('data-azimuth'))-before)<.05);await snap('ceramic-reset');
 await page.goto(preview.base+'/playground/',{waitUntil:'networkidle'});
 const intro=page.locator('[data-inline-spark]');await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.imagesDecoded==='true');await page.waitForTimeout(800);
 const timeline=await intro.evaluate(e=>({start:Number(e.dataset.scrollStart),end:Number(e.dataset.scrollEnd),decoded:e.dataset.imagesDecoded}));
 results.timeline=timeline;
 const sample=()=>intro.evaluate(e=>{const tips=[...e.querySelectorAll('[data-fingertip]')].map(x=>x.getBoundingClientRect());const opacity=s=>Number(getComputedStyle(e.querySelector(s)).opacity);return {progress:Number(e.dataset.progress),gap:Math.hypot(tips[0].x-tips[1].x,tips[0].y-tips[1].y),core:opacity('[data-core]'),ring:opacity('[data-ring]'),camera:opacity('[data-camera]'),exposure:opacity('[data-exposure]'),arrival:opacity('[data-arrival]')};});
 for(const [name,t] of [['approach',.45],['contact',.72],['fade',.86],['complete',.98],['reverse',.2]]){
  const target=timeline.start+(timeline.end-timeline.start)*t;
  for(let i=0;i<30;i++){const y=await page.evaluate(()=>scrollY);if(Math.abs(y-target)<3)break;
    const delta=Math.max(-180,Math.min(180,target-y));await page.mouse.wheel(0,delta);
    await page.waitForFunction(expected=>Math.abs(scrollY-expected)<3,y+delta,{timeout:5000});
  }
  await page.waitForTimeout(180);const state=await sample();results[name]=state;check('spark: reaches '+name,Math.abs(state.progress-t)<.025,state);await snap('spark-'+name);
 }
 check('spark: fingertip contact',results.contact.gap<3,results.contact);
 check('spark: sustained visible core and ring',results.contact.core>.9&&results.contact.ring>.8&&results.contact.camera>.9,results.contact);
 check('spark: fades after contact',results.fade.camera<.6&&results.fade.exposure>.5,results.fade);
 check('spark: completion',results.complete.arrival>.6&&results.complete.camera<.05,results.complete);
 check('spark: wheel reverses',results.reverse.gap>100&&results.reverse.core<.05&&results.reverse.exposure<.05,results.reverse);
 await page.locator('.skip-intro').click();check('spark: sticky scene needs no pin spacer',await page.locator('.pin-spacer').count()===0);
} catch(e){results.errors.push(String(e));await snap('failure');}
finally{await context.close();await browser.close();await preview.close();await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.errors.length)process.exitCode=1;
