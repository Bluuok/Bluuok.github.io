import type * as Three from 'three';
import type { ClothConfig } from './config';
/** A smooth, closed display shell driven by one low-resolution simulation. */
export function createClothSurface(T:typeof Three,cfg:ClothConfig){
 const nx=cfg.segmentsX*2,ny=cfg.segmentsY*2,n=(nx+1)*(ny+1);
 const front=new T.PlaneGeometry(cfg.width,cfg.height,nx,ny);
 const geometry=new T.BufferGeometry(),positions=new Float32Array(n*6),uv=new Float32Array(n*4);
 const originalUV=front.getAttribute('uv');for(let i=0;i<n;i++){uv[i*2]=uv[(i+n)*2]=originalUV.getX(i);uv[i*2+1]=uv[(i+n)*2+1]=originalUV.getY(i);}
 const indices=Array.from(front.index!.array);
 for(let i=0;i<front.index!.count;i+=3)indices.push(front.index!.getX(i)+n,front.index!.getX(i+2)+n,front.index!.getX(i+1)+n);
 const edge:number[]=[];for(let x=0;x<=nx;x++)edge.push(x);for(let y=1;y<=ny;y++)edge.push(y*(nx+1)+nx);for(let x=nx-1;x>=0;x--)edge.push(ny*(nx+1)+x);for(let y=ny-1;y>0;y--)edge.push(y*(nx+1));
 for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,a+n,b,b,a+n,b+n);}
 geometry.setIndex(indices);geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
 const cubic=(a:number,b:number,c:number,d:number,t:number)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
 const sample=(p:Float32Array,x:number,y:number,k:number)=>p[(Math.max(0,Math.min(cfg.segmentsY,y))*(cfg.segmentsX+1)+Math.max(0,Math.min(cfg.segmentsX,x)))*3+k];
 const update=(p:Float32Array)=>{
  const fp=front.getAttribute('position');
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const gx=x/2,gy=y/2,ix=Math.floor(gx),iy=Math.floor(gy),i=y*(nx+1)+x;
   for(let k=0;k<3;k++){const row=(dy:number)=>cubic(sample(p,ix-1,iy+dy,k),sample(p,ix,iy+dy,k),sample(p,ix+1,iy+dy,k),sample(p,ix+2,iy+dy,k),gx-ix);fp.array[i*3+k]=cubic(row(-1),row(0),row(1),row(2),gy-iy);}}
  front.computeVertexNormals();const normal=front.getAttribute('normal'),thickness=cfg.paper?.009:.022;
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){const v=fp.array[i*3+k],d=normal.array[i*3+k]*thickness*.5;positions[i*3+k]=v+d;positions[(i+n)*3+k]=v-d;}
  geometry.getAttribute('position').needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 };
 return {geometry,update,dispose:()=>front.dispose()};
}
