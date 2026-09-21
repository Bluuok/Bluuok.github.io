import type { ParticleFieldMount } from '../particles/field';
/** Static route markup is never cloned, removed or scrolled into view on load. */
export async function mountInlineSpark(root:HTMLElement){
 let disposed=false,particles:ParticleFieldMount|undefined,cleanupIntro:(()=>void)|undefined;
 const abort=new AbortController();
 const dispose=()=>{if(disposed)return;disposed=true;abort.abort();cleanupIntro?.();particles?.();document.documentElement.classList.remove('has-inline-spark');};
 document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
 window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();},{signal:abort.signal});
 try {
  const [{mountIntro},{mountParticleField}]=await Promise.all([import('../intro/animation'),import('../particles/field'),Promise.all([...root.querySelectorAll<HTMLImageElement>('.hand-art')].map(image=>image.decode()))]);
  if(disposed||!root.isConnected)return;
  root.dataset.imagesDecoded='true';
  const host=root.querySelector<HTMLElement>('[data-particle-host]')!,canvas=host.querySelector('canvas')!;
  particles=mountParticleField(canvas,host);
  Object.assign(host,{setScene:particles.setScene,resetScene:particles.resetScene});
  cleanupIntro=mountIntro(root,{id:'inline-first-spark'});root.dataset.sparkState='ready';
 }catch(error){root.dataset.sparkState='fallback';console.warn('[first-spark] Static scene retained',error);}
 return dispose;
}
