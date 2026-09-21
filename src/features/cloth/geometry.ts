import baked from './baked-poses.json';
import {poseKey,validPose} from './pose';
import { clothConfig } from './config';
import { ClothSolver } from './solver';
interface VertexPos { x:number;y:number;z:number }

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
  const solver=new ClothSolver(clothConfig,validPose(clothConfig,(baked as Record<string,any>)[poseKey(clothConfig)]));
  const nx=clothConfig.segmentsX,ny=clothConfig.segmentsY;
  const getRestVertex=(u:number,v:number):VertexPos=>{const k=(Math.round(u*nx)+Math.round(v*ny)*(nx+1))*3;return {x:solver.rest[k],y:solver.rest[k+1],z:solver.rest[k+2]};};
  const facets: { z: number; svg: string }[] = [];
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
