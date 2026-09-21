import type * as Three from 'three';import type {ClothConfig} from './config';
/** Cached bicubic weights and separate edge vertices: one middle surface, smooth shell normals. */
export function createClothSurface(T:typeof Three,cfg:ClothConfig){
 const nx=cfg.segmentsX*2,ny=cfg.segmentsY*2,n=(nx+1)*(ny+1),edge:number[]=[];
 for(let x=0;x<=nx;x++)edge.push(x);for(let y=1;y<=ny;y++)edge.push(y*(nx+1)+nx);for(let x=nx-1;x>=0;x--)edge.push(ny*(nx+1)+x);for(let y=ny-1;y>0;y--)edge.push(y*(nx+1));
 const total=2*n+edge.length*4,positions=new Float32Array(total*3),normals=new Float32Array(total*3),uv=new Float32Array(total*2),middle=new Float32Array(n*3);
 const sampleIds=new Uint16Array(n*16),weights=new Float32Array(n*16),indices:number[]=[];
 const weight=(t:number)=>[-.5*t+t*t-.5*t*t*t,1-2.5*t*t+1.5*t*t*t,.5*t+2*t*t-1.5*t*t*t,-.5*t*t+.5*t*t*t];
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const i=y*(nx+1)+x,ix=Math.floor(x/2),iy=Math.floor(y/2),wx=weight(x/2-ix),wy=weight(y/2-iy);
  for(let b=0;b<4;b++)for(let a=0;a<4;a++){const k=i*16+b*4+a;sampleIds[k]=Math.max(0,Math.min(cfg.segmentsY,iy+b-1))*(cfg.segmentsX+1)+Math.max(0,Math.min(cfg.segmentsX,ix+a-1));weights[k]=wx[a]*wy[b];}
  uv[i*2]=uv[(n+i)*2]=x/nx;uv[i*2+1]=uv[(n+i)*2+1]=1-y/ny;
  if(x<nx&&y<ny){const a=i,b=i+1,c=i+nx+1,d=c+1;indices.push(a,c,b,b,c,d,a+n,b+n,c+n,b+n,d+n,c+n);}
 }
 for(let e=0;e<edge.length;e++){const start=2*n+e*4;indices.push(start,start+1,start+2,start+2,start+1,start+3);for(let j=0;j<4;j++){const i=edge[(e+(j>=2?1:0))%edge.length];uv[(start+j)*2]=uv[i*2];uv[(start+j)*2+1]=uv[i*2+1];}}
 const geometry=new T.BufferGeometry();geometry.setIndex(indices);geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('normal',new T.BufferAttribute(normals,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.boundingSphere=new T.Sphere(new T.Vector3(),Math.hypot(cfg.width,cfg.height)+3);
 const update=(p:Float32Array)=>{
  for(let i=0;i<n;i++){let x=0,y=0,z=0;for(let a=0;a<16;a++){const k=sampleIds[i*16+a]*3,w=weights[i*16+a];x+=p[k]*w;y+=p[k+1]*w;z+=p[k+2]*w;}middle[i*3]=x;middle[i*3+1]=y;middle[i*3+2]=z;}
  const thickness=cfg.paper?.009:.022;
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const i=y*(nx+1)+x,k=i*3,left=(i-(x>0?1:0))*3,right=(i+(x<nx?1:0))*3,up=(i-(y>0?nx+1:0))*3,down=(i+(y<ny?nx+1:0))*3;
   const ax=middle[right]-middle[left],ay=middle[right+1]-middle[left+1],az=middle[right+2]-middle[left+2],bx=middle[up]-middle[down],by=middle[up+1]-middle[down+1],bz=middle[up+2]-middle[down+2];
   let vx=ay*bz-az*by,vy=az*bx-ax*bz,vz=ax*by-ay*bx;const l=Math.hypot(vx,vy,vz)||1;vx/=l;vy/=l;vz/=l;
   for(let a=0;a<3;a++){const v=a===0?vx:a===1?vy:vz;normals[k+a]=v;normals[(n+i)*3+a]=-v;positions[k+a]=middle[k+a]+v*thickness*.5;positions[(n+i)*3+a]=middle[k+a]-v*thickness*.5;}
  }
  for(let e=0;e<edge.length;e++){const a=edge[e],b=edge[(e+1)%edge.length],start=2*n+e*4;
   for(let j=0;j<4;j++){const from=((j>=2?b:a)+(j%2?n:0))*3;for(let k=0;k<3;k++)positions[(start+j)*3+k]=positions[from+k];}
   const k=start*3,ax=positions[k+3]-positions[k],ay=positions[k+4]-positions[k+1],az=positions[k+5]-positions[k+2],bx=positions[k+6]-positions[k],by=positions[k+7]-positions[k+1],bz=positions[k+8]-positions[k+2];const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,l=Math.hypot(x,y,z)||1;
   for(let j=0;j<4;j++){normals[k+j*3]=x/l;normals[k+j*3+1]=y/l;normals[k+j*3+2]=z/l;}
  }
  geometry.getAttribute('position').needsUpdate=true;geometry.getAttribute('normal').needsUpdate=true;
 };
 return {geometry,update,dispose:()=>{}};
}
