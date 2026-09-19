import {subscribeMotion} from '../../lib/motion';
/** Small spring-like response in the art region; never moves text outside it. */
export function mountPaperDesk(root:HTMLElement):()=>void {
  const abort=new AbortController();let reduced=false,visible=false,frame=0,last=0;
  let x=0,y=0,tx=0,ty=0;
  const paint=()=>{root.style.setProperty('--desk-x',`${x.toFixed(2)}px`);root.style.setProperty('--desk-y',`${y.toFixed(2)}px`);};
  const tick=(now:number)=>{frame=0;if(!visible||reduced||document.hidden)return;const dt=Math.min(.04,(now-last)/1000);last=now;const f=1-Math.exp(-dt*9);x+=(tx-x)*f;y+=(ty-y)*f;paint();if(Math.abs(tx-x)+Math.abs(ty-y)>.05)frame=requestAnimationFrame(tick);};
  const start=()=>{if(!frame&&!reduced&&visible&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}};
  const clear=()=>{tx=ty=0;start();};
  const reset=()=>{cancelAnimationFrame(frame);frame=0;x=y=tx=ty=0;paint();};
  const unsubscribe=subscribeMotion(m=>{reduced=m.isReduced;if(reduced)reset();});
  const observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;if(!visible)reset();});observer.observe(root);
  root.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduced)return;const r=root.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*12;ty=((e.clientY-r.top)/r.height-.5)*8;start();},{passive:true,signal:abort.signal});
  for(const event of ['pointerleave','pointercancel'])root.addEventListener(event,clear,{signal:abort.signal});
  window.addEventListener('blur',reset,{signal:abort.signal});document.addEventListener('visibilitychange',reset,{signal:abort.signal});
  const dispose=()=>{reset();abort.abort();observer.disconnect();unsubscribe();};
  window.addEventListener('pagehide',e=>{if(e.persisted)reset();else dispose();},{signal:abort.signal});document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
  return dispose;
}
