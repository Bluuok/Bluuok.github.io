import { subscribeMotion } from '../lib/motion';
/** Stable full-text layout, one accessible sentence, and a decorative grapheme layer. */
export function mountTypeLine(root:HTMLElement){
 const visual=root.querySelector<HTMLElement>('.type-line__visual')!,text=root.dataset.text??'';
 const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);
 const spans=segments.map(char=>{const span=document.createElement('span');span.className='type-letter';span.textContent=char;visual.append(span);return span;});
 let count=0,timer=0,visible=false,reduced=false,done=false,disposed=false;
 const stop=()=>{window.clearTimeout(timer);timer=0;root.dataset.paused='true';};
 const step=()=>{timer=0;if(!visible||reduced||disposed||document.hidden)return;delete root.dataset.paused;
  spans[count-1]?.classList.remove('caret');const span=spans[count++];span?.classList.add('shown','caret');
  if(count<spans.length)timer=window.setTimeout(step,/[，。！？；、]/.test(span.textContent??'')?180:55);else {done=true;timer=window.setTimeout(()=>spans.at(-1)?.classList.remove('caret'),4000);}
 };
 const sync=()=>{stop();if(reduced){delete root.dataset.enhanced;done=true;return;}if(done){delete root.dataset.enhanced;return;}root.dataset.enhanced='true';if(visible&&!document.hidden)timer=window.setTimeout(step,70);};
 const unsub=subscribeMotion(m=>{reduced=m.isReduced;sync();});
 const observer=new IntersectionObserver(([entry])=>{visible=!!entry?.isIntersecting;sync();});observer.observe(root);
 const abort=new AbortController();document.addEventListener('visibilitychange',sync,{signal:abort.signal});
 const dispose=()=>{disposed=true;stop();observer.disconnect();unsub();abort.abort();};
 document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();else stop();},{signal:abort.signal});window.addEventListener('pageshow',sync,{signal:abort.signal});
}
