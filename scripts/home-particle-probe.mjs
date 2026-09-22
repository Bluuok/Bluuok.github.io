/** Controlled input/simulation time; wall-clock GPU throughput is not asserted. */
export async function probeHome(browser,base,mode){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const epoch=new Date('2026-01-01T00:00:00Z');await page.clock.install({time:epoch});await page.clock.pauseAt(epoch);
  await page.goto(base+'/?scenePerf=1',{waitUntil:'networkidle'});await page.clock.runFor(32);
  const host=page.locator('particle-field').first();const snapshot=()=>host.evaluate(e=>e.particleSnapshot());
  const initial=await snapshot(),box=await host.boundingBox();
  if(mode==='trusted'){
   await page.mouse.move(box.x+180,box.y+box.height*.62);
   await page.mouse.move(box.x+1140,box.y+box.height*.62,{steps:30});
  }else{
   await host.evaluate(e=>{const b=e.getBoundingClientRect();for(let n=0;n<=30;n++)e.parentElement.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:b.x+180+n*32,clientY:b.y+b.height*.62+35*Math.sin(n/30*Math.PI*4)}));});
  }
  if(mode==='stale')await page.clock.fastForward(400);else await page.clock.runFor(16);const swept=await snapshot();
  await page.clock.runFor(256);const after=await snapshot();
  await page.clock.runFor(1808);const rest=await snapshot();
  const active=swept.particles.filter(p=>Math.hypot(p.vx,p.vy)>80),moves=active.map(p=>Math.hypot(after.particles[p.id].x-p.x,after.particles[p.id].y-p.y));
  return {mode,errors,clock:'controlled 16ms RAF; 256ms displacement interval',count:moves.length,mean:moves.length?moves.reduce((a,b)=>a+b,0)/moves.length:0,maxRestSpeed:Math.max(...rest.particles.map(p=>Math.hypot(p.vx,p.vy))),input:after.input,samples:{before:initial.particles.filter((_,i)=>i%80===0),swept:swept.particles.filter((_,i)=>i%80===0),after:after.particles.filter((_,i)=>i%80===0)}};
 }finally{await context.close();}
}
