import { clothConfig, type ClothConfig } from './config';
export interface VertexPos { x: number; y: number; z: number }

/** Reproducible authored rest surface; not a physical cloth solver. */
export function getRestVertex(u: number, v: number, cfg: ClothConfig = clothConfig): VertexPos {
  const envelope = Math.sin(Math.PI * u);
  const taper = .77 + .23 * envelope;
  const fold = v - .48 - .15 * Math.sin(u * Math.PI * 1.3);
  const crest = .64 * Math.exp(-fold * fold * 42);
  const valley = -.32 * Math.exp(-Math.pow(fold - .2, 2) * 35);
  const freeEdge = Math.pow(u, 3) * (.65 * Math.cos(v * Math.PI * 1.3) + .2);
  return {
    x: (u - .5) * cfg.width + Math.sin(v * Math.PI) * envelope * .2,
    y: (.5 - v) * cfg.height * taper + .3 * Math.sin(u * Math.PI * 1.6) - .38 * envelope * v,
    z: crest + valley + freeEdge - .3 * envelope * Math.sin(v * Math.PI)
      + .06 * Math.sin(u * 15 + v * 5) * (1 - v) + .1 * Math.sin(v * 5) * (1 - u),
  };
}
export function getAuthoredOffset(u: number, v: number, preset: 'north' | 'south' | 'east' | 'west'): VertexPos {
  const e = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  const dx = preset === 'east' ? 1 : preset === 'west' ? -1 : 0;
  const dy = preset === 'north' ? 1 : preset === 'south' ? -1 : 0;
  return { x: dx * e * .12, y: dy * e * .12, z: e * .18 * (dx * Math.cos(v * 4) + dy * Math.sin(u * 4)) };
}
/** Same rest surface/camera; painter-sorted poster usable without JavaScript. */
export function generateFacetedSvgPoster(): string {
  const e = clothConfig.cameraPos, t = clothConfig.cameraTarget;
  const norm = (a: number[]) => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const f = norm(t.map((x, i) => x - e[i]));
  const r = norm([-f[2], 0, f[0]]);
  const up = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const scale = 200 / Math.tan(34 * Math.PI / 360);
  const project = (p: VertexPos) => {
    const d = [p.x-e[0], p.y-e[1], p.z-e[2]], z = dot(d, f);
    return { x: 340 + dot(d,r)*scale/z, y: 200-dot(d,up)*scale/z, z };
  };
  const nx = 56, ny = 42, facets: { z: number; svg: string }[] = [];
  const light = norm([.4,.7,1]);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) {
    const a=getRestVertex(i/nx,j/ny), b=getRestVertex((i+1)/nx,j/ny), c=getRestVertex((i+1)/nx,(j+1)/ny), d=getRestVertex(i/nx,(j+1)/ny);
    const ab=[b.x-a.x,b.y-a.y,b.z-a.z], ad=[d.x-a.x,d.y-a.y,d.z-a.z];
    let n=norm([ab[1]*ad[2]-ab[2]*ad[1],ab[2]*ad[0]-ab[0]*ad[2],ab[0]*ad[1]-ab[1]*ad[0]]);
    if(n[2]<0)n=n.map(x=>-x);
    const l=.2+.8*Math.max(0,dot(n,light));
    const color=`rgb(${Math.round(190+l*62)},${Math.round(197+l*56)},${Math.round(210+l*43)})`;
    const p=[a,b,c,d].map(project);
    facets.push({z:p.reduce((s,q)=>s+q.z,0)/4,svg:`<polygon points="${p.map(q=>`${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".45"/>`});
  }
  return facets.sort((a,b)=>b.z-a.z).map(x=>x.svg).join('');
}
