import { clothConfig, type ClothConfig } from './config';
export interface VertexPos { x: number; y: number; z: number }

/** Sculptural authored rest surface; realistic textile folds with cascading ripples and curved edges. */
export function getRestVertex(u: number, v: number, cfg: ClothConfig = clothConfig): VertexPos {
  const envelope = Math.sin(Math.PI * u);
  const vEnvelope = Math.sin(Math.PI * v);
  const taper = .82 + .18 * envelope;

  // Primary diagonal crest fold
  const fold = v - .44 - .22 * Math.sin(u * Math.PI * 1.25);
  const crest = .74 * Math.exp(-fold * fold * 36);

  // Secondary soft valley drape
  const valley = -.36 * Math.exp(-Math.pow(fold - .22, 2) * 32);

  // Cascading textile micro-ripples along weave direction
  const microRipples = .065 * Math.sin(u * 12 + v * 6) * vEnvelope
    + .04 * Math.cos(u * 7 - v * 9) * envelope
    + .035 * Math.sin(v * 14 + u * 4) * (1 - u);

  // Gracefully draped free edge with natural fluttering curvature
  const freeEdge = Math.pow(u, 2.6) * (.58 * Math.cos(v * Math.PI * 1.35) + .18);

  // Natural edge outline contours (gentle curve instead of straight ruler borders)
  const edgeContourX = Math.sin(v * Math.PI * 2) * .12 * envelope - Math.sin(v * Math.PI) * .08;
  const edgeContourY = Math.sin(u * Math.PI * 1.8) * .16 * vEnvelope;

  return {
    x: (u - .5) * cfg.width + edgeContourX + Math.sin(v * Math.PI) * envelope * .22,
    y: (.5 - v) * cfg.height * taper + edgeContourY + .26 * Math.sin(u * Math.PI * 1.5) - .34 * envelope * v,
    z: crest + valley + freeEdge + microRipples - .25 * envelope * Math.sin(v * Math.PI),
  };
}

export function getAuthoredOffset(u: number, v: number, preset: 'north' | 'south' | 'east' | 'west'): VertexPos {
  const e = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  const dx = preset === 'east' ? 1 : preset === 'west' ? -1 : 0;
  const dy = preset === 'north' ? 1 : preset === 'south' ? -1 : 0;
  return {
    x: dx * e * .14 + Math.sin(v * 8) * .02 * dy,
    y: dy * e * .14 + Math.cos(u * 8) * .02 * dx,
    z: e * .22 * (dx * Math.cos(v * 4.2) + dy * Math.sin(u * 4.2)),
  };
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
  const light = norm([.35,.75,.9]);
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) {
    const a=getRestVertex(i/nx,j/ny), b=getRestVertex((i+1)/nx,j/ny), c=getRestVertex((i+1)/nx,(j+1)/ny), d=getRestVertex(i/nx,(j+1)/ny);
    const ab=[b.x-a.x,b.y-a.y,b.z-a.z], ad=[d.x-a.x,d.y-a.y,d.z-a.z];
    let n=norm([ab[1]*ad[2]-ab[2]*ad[1],ab[2]*ad[0]-ab[0]*ad[2],ab[0]*ad[1]-ab[1]*ad[0]]);
    if(n[2]<0)n=n.map(x=>-x);
    const l=.28+.72*Math.max(0,dot(n,light));
    const color=`rgb(${Math.round(208+l*47)},${Math.round(212+l*43)},${Math.round(224+l*31)})`;
    const p=[a,b,c,d].map(project);
    facets.push({z:p.reduce((s,q)=>s+q.z,0)/4,svg:`<polygon points="${p.map(q=>`${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".45"/>`});
  }
  return facets.sort((a,b)=>b.z-a.z).map(x=>x.svg).join('');
}
