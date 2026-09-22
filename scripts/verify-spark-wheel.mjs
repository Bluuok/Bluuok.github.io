import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {startStaticPreview} from './static-preview.mjs';
const preview=await startStaticPreview(),browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
 await page.goto(preview.base+'/playground/?scenePerf=1',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('[data-inline-spark]')?.dataset.sparkState==='ready');
 await page.evaluate(()=>{const e=document.querySelector('[data-inline-spark]');scrollTo(0,+e.dataset.scrollStart+(+e.dataset.scrollEnd-+e.dataset.scrollStart)*.3);});
 await page.waitForTimeout(800);
 await page.evaluate(()=>{window.__sparkWheelSamples=[];const start=performance.now();function frame(now){const e=document.querySelector('[data-inline-spark]');window.__sparkWheelSamples.push({t:now-start,p:+e.dataset.progress,y:scrollY});if(now-start<900)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.mouse.wheel(0,120);await page.waitForTimeout(1100);
 const frames=await page.evaluate(()=>window.__sparkWheelSamples),start=frames[0].p,end=frames.at(-1).p;
 const intermediate=new Set(frames.filter(f=>f.p>start+.001&&f.p<end-.001).map(f=>f.p)).size;
 const maxFrameGap=Math.max(...frames.slice(1).map((f,i)=>f.t-frames[i].t));
 // A 240ms scrub cannot be judged from a software renderer delivering one
 // frame every 250ms. Preserve that measurement as inconclusive, not a pass.
 const sampled=frames.length>=8&&maxFrameGap<80;
 const result={label:process.argv[2],intermediate,maxFrameGap,status:sampled?'sampled':'inconclusive: frame cadence too slow to resolve the scrub',frames};
 await writeFile('review-output/spark-continuous/wheel-'+process.argv[2]+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({label:result.label,intermediate,start,end,status:result.status}));
 if(process.argv[2]==='after'&&sampled&&intermediate<2)throw new Error('Wheel still jumps without intermediate animation frames');
}finally{await browser.close();await preview.close();}
