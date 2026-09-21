/** Opt-in diagnostics: ?scenePerf=1. No production collection or network export. */
export function sceneReadiness(id:string){
 const enabled=typeof location!=='undefined'&&new URLSearchParams(location.search).has('scenePerf');
 const prefix='scene:'+id+':';const stamps:Record<string,number>={};
 const mark=(name:string)=>{if(!enabled)return;const now=performance.now();stamps[name]=now;performance.mark(prefix+name);if(name!=='request'&&stamps.request!==undefined)performance.measure(prefix+name,prefix+'request',prefix+name);};
 if(enabled){(window as any).__sceneReadiness??={};(window as any).__sceneReadiness[id]={sha:import.meta.env.PUBLIC_BUILD_SHA??'local-working-tree',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,cache:'see resource timing transferSize',stamps};}
 return {mark};
}
