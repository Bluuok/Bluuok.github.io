import { SpatialHash } from './spatial-hash';
/** Original CPU XPBD solver. Distance constraints model stretch, shear and bending.
 * Fixed timesteps keep stiffness independent of render rate. No external simulation code.
 */
export interface ClothPhysics {
  width:number; height:number; segmentsX:number; segmentsY:number;
  bendCompliance:number; wind:number; gravity:number; damping:number;
}
interface Constraint { a:number; b:number; rest:number; compliance:number; lambda:number }
export class ClothSolver {
  readonly positions:Float32Array;
  readonly rest:Float32Array;
  readonly velocity:Float32Array;
  readonly inverseMass:Float32Array;
  private previous:Float32Array;
  private constraints:Constraint[]=[];
  private accumulator=0;
  private time=0;
  private gust:{x:number;y:number;vx:number;vy:number;life:number}|null=null;
  private grab:{indices:number[];weights:number[];offsets:number[];x:number;y:number;z:number}|null=null;
  constructor(readonly config:ClothPhysics,pose?:ArrayLike<number>) {
    const {width:w,height:h,segmentsX:nx,segmentsY:ny}=config;
    const count=(nx+1)*(ny+1);
    this.positions=new Float32Array(count*3);this.velocity=new Float32Array(count*3);
    this.inverseMass=new Float32Array(count).fill(1);
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=i/nx,v=j/ny,k=(i+j*(nx+1))*3;
      this.positions.set([(u-.5)*w,(.5-v)*h,.06*Math.sin(u*Math.PI*6)*v],k);
    }
    this.rest=this.positions.slice();this.previous=this.positions.slice();
    this.inverseMass[0]=0;this.inverseMass[nx]=0;
    // Bring the supports inward: gravity resolves the spare width into hanging folds.
    this.rest[0]+=.16*w;this.rest[nx*3]-=.12*w;this.rest[nx*3+1]-=.08*h;
    const add=(a:number,b:number,compliance:number)=>{
      const k=a*3,l=b*3;
      this.constraints.push({a,b,rest:Math.hypot(this.positions[k]-this.positions[l],this.positions[k+1]-this.positions[l+1],this.positions[k+2]-this.positions[l+2]),compliance,lambda:0});
    };
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const a=i+j*(nx+1);
      if(i<nx)add(a,a+1,1e-7);
      if(j<ny)add(a,a+nx+1,1e-7);
      if(i<nx&&j<ny){add(a,a+nx+2,2e-6);add(a+1,a+nx+1,2e-6);}
      if(i<nx-1)add(a,a+2,config.bendCompliance);
      if(j<ny-1)add(a,a+2*(nx+1),config.bendCompliance);
    }
    for(const index of [0,nx])this.positions.set(this.rest.subarray(index*3,index*3+3),index*3);
    if(pose)this.restorePose(pose);
    else {this.rest.set(this.positions);this.previous.set(this.positions);}
  }
  restorePose(pose:ArrayLike<number>){if(pose.length!==this.positions.length)throw new Error('Pose topology mismatch');for(let i=0;i<pose.length;i++)if(!Number.isFinite(pose[i]))throw new Error('Invalid pose');this.positions.set(pose);this.rest.set(pose);this.previous.set(pose);this.velocity.fill(0);this.time=0;this.accumulator=0;}
  settle(steps=180){for(let i=0;i<steps;i++)this.step(1/120,false);}
  async prepareRest(signal:AbortSignal){for(let i=0;i<180;i+=6){if(signal.aborted)throw new DOMException('Cancelled','AbortError');this.settle(6);await new Promise(resolve=>setTimeout(resolve,0));}this.restorePose(this.positions);}
  fixedStep(dt=1/120){this.step(dt,true);}
  reconcileVelocity(dt=1/120){const damp=Math.exp(-this.config.damping*dt);for(let i=0;i<this.positions.length;i++)this.velocity[i]=Math.max(-12,Math.min(12,(this.positions[i]-this.previous[i])/dt))*damp;}
  gustAt(x:number,y:number,vx:number,vy:number){this.gust={x,y,vx:Math.max(-9,Math.min(9,vx)),vy:Math.max(-9,Math.min(9,vy)),life:.15};}
  beginGrab(x:number,y:number,z:number){
    const indices:number[]=[],weights:number[]=[],offsets:number[]=[];
    for(let i=0;i<this.inverseMass.length;i++){
      const k=i*3,d=Math.hypot(this.positions[k]-x,this.positions[k+1]-y,this.positions[k+2]-z);
      if(this.inverseMass[i]&&d<.38){indices.push(i);weights.push(Math.max(.2,1-d/.5));offsets.push(this.positions[k]-x,this.positions[k+1]-y,this.positions[k+2]-z);}
    }
    this.grab={indices,weights,offsets,x,y,z};
  }
  moveGrab(x:number,y:number,z:number){if(this.grab){this.grab.x=x;this.grab.y=y;this.grab.z=z;}}
  endGrab(){this.grab=null;}
  reset(){this.positions.set(this.rest);this.velocity.fill(0);this.accumulator=0;this.grab=null;this.gust=null;}
  advance(dt:number){
    this.accumulator+=Math.max(0,Math.min(dt,1/15));
    while(this.accumulator>=1/120){this.step(1/120,true);this.accumulator-=1/120;}
  }
  private step(dt:number,interactive:boolean){
    const p=this.positions,v=this.velocity,prev=this.previous,cfg=this.config;
    this.time+=dt;prev.set(p);
    for(let i=0;i<this.inverseMass.length;i++){
      const k=i*3;
      if(!this.inverseMass[i]){p[k]=this.rest[k];p[k+1]=this.rest[k+1];p[k+2]=this.rest[k+2];continue;}
      v[k+1]+=cfg.gravity*dt;
      v[k+2]+=cfg.wind*(.65+Math.sin(this.time*1.7+p[k]*1.8)*.5+Math.sin(this.time*2.8+p[k+1]*2)*.25)*dt;
      if(interactive&&this.gust){
        const g=this.gust,d2=(p[k]-g.x)**2+(p[k+1]-g.y)**2,f=Math.exp(-d2/.45)*Math.min(1,g.life/.08);
        v[k]+=g.vx*f*dt*12;v[k+1]+=g.vy*f*dt*7;v[k+2]+=(2+Math.hypot(g.vx,g.vy))*f*dt*7;
      }
      for(let a=0;a<3;a++)p[k+a]+=v[k+a]*dt;
    }
    for(const c of this.constraints)c.lambda=0;
    for(let iteration=0;iteration<7;iteration++){
      for(const c of this.constraints){
        const a=c.a*3,b=c.b*3,wa=this.inverseMass[c.a],wb=this.inverseMass[c.b];
        const dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],length=Math.hypot(dx,dy,dz);
        if(length<1e-8)continue;
        const alpha=c.compliance/(dt*dt),dl=(-(length-c.rest)-alpha*c.lambda)/(wa+wb+alpha);
        c.lambda+=dl;const f=dl/length;
        p[a]+=wa*f*dx;p[a+1]+=wa*f*dy;p[a+2]+=wa*f*dz;
        p[b]-=wb*f*dx;p[b+1]-=wb*f*dy;p[b+2]-=wb*f*dz;
      }
      if(this.grab&&interactive){
        const g=this.grab;
        g.indices.forEach((index,n)=>{
          const k=index*3,o=n*3,w=g.weights[n]*.38;
          const target=[g.x+g.offsets[o],g.y+g.offsets[o+1],g.z+g.offsets[o+2]];
          for(let a=0;a<3;a++)p[k+a]+=(target[a]-p[k+a])*w;
        });
      }
      // Ground and rear stop prevent the fabric leaving its installation volume.
      for(let i=0;i<this.inverseMass.length;i++)if(this.inverseMass[i]){
        const k=i*3;p[k+1]=Math.max(-cfg.height*.78,p[k+1]);p[k+2]=Math.max(-.85,p[k+2]);
      }
    }
    resolveClothContacts([{solver:this,x:0,y:0,z:0}]);
    const damp=Math.exp(-cfg.damping*dt);
    for(let i=0;i<p.length;i++)v[i]=Math.max(-12,Math.min(12,(p[i]-prev[i])/dt))*damp;
    if(this.gust){this.gust.life-=dt;if(this.gust.life<=0)this.gust=null;}
  }
}

export interface ClothContactSurface { solver:ClothSolver; x:number;y:number;z:number }
/** Spatially hashed particle thickness, including different suspended panels.
 * Grid neighbours are excluded: their rest separation is governed by stretch/bend.
 * This is a discrete contact approximation, not continuous triangle collision.
 */
const hashes=new WeakMap<ClothSolver,SpatialHash>();
function hashFor(s:ClothSolver){let h=hashes.get(s);if(!h){h=new SpatialHash(s.inverseMass.length);hashes.set(s,h);}return h;}
function resolvePair(a:ClothContactSurface,i:number,b:ClothContactSurface,j:number,gap:number){
 const p=a.solver.positions,q=b.solver.positions,k=i*3,l=j*3;
 const dx=p[k]+a.x-q[l]-b.x,dy=p[k+1]+a.y-q[l+1]-b.y,dz=p[k+2]+a.z-q[l+2]-b.z,d2=dx*dx+dy*dy+dz*dz;if(d2>=gap*gap)return;
 const wa=a.solver.inverseMass[i],wb=b.solver.inverseMass[j],mass=wa+wb;if(!mass)return;
 const d=Math.sqrt(d2),x=d>1e-8?dx/d:0,y=d>1e-8?dy/d:0,z=d>1e-8?dz/d:1,c=(gap-d)/mass;
 p[k]+=x*c*wa;p[k+1]+=y*c*wa;p[k+2]+=z*c*wa;q[l]-=x*c*wb;q[l+1]-=y*c*wb;q[l+2]-=z*c*wb;
}
const boundsCache=new WeakMap<ClothSolver,Float32Array>();
function bounds(surface:ClothContactSurface){let b=boundsCache.get(surface.solver);if(!b){b=new Float32Array(6);boundsCache.set(surface.solver,b);}b.set([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);const p=surface.solver.positions;for(let i=0;i<p.length;i+=3){b[0]=Math.min(b[0],p[i]+surface.x);b[1]=Math.min(b[1],p[i+1]+surface.y);b[2]=Math.min(b[2],p[i+2]+surface.z);b[3]=Math.max(b[3],p[i]+surface.x);b[4]=Math.max(b[4],p[i+1]+surface.y);b[5]=Math.max(b[5],p[i+2]+surface.z);}return b;}
export function resolveClothContacts(surfaces:ClothContactSurface[],crossOnly=false){
 const gap=.115;
 if(!crossOnly)for(const surface of surfaces){const solver=surface.solver,p=solver.positions,hash=hashFor(solver),nx=solver.config.segmentsX+1;hash.clear();
  for(let i=0;i<solver.inverseMass.length;i++){const k=i*3,cx=Math.floor(p[k]/gap),cy=Math.floor(p[k+1]/gap),cz=Math.floor(p[k+2]/gap);
   for(let z=cz-1;z<=cz+1;z++)for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)for(let j=hash.first(x,y,z);j>=0;j=hash.nextId(j)){
    if(!hash.matches(j,x,y,z)||(Math.abs(i%nx-j%nx)<=2&&Math.abs(Math.floor(i/nx)-Math.floor(j/nx))<=2))continue;resolvePair(surface,i,surface,j,gap);
   }hash.add(i,cx,cy,cz);
  }
 }
 for(let a=0;a<surfaces.length;a++)for(let b=a+1;b<surfaces.length;b++){
  const one=surfaces[a],two=surfaces[b],A=bounds(one),B=bounds(two);if(A[0]>B[3]+gap||B[0]>A[3]+gap||A[1]>B[4]+gap||B[1]>A[4]+gap||A[2]>B[5]+gap||B[2]>A[5]+gap)continue;
  const hash=hashFor(two.solver),q=two.solver.positions,p=one.solver.positions;hash.clear();
  for(let j=0;j<two.solver.inverseMass.length;j++){const k=j*3;hash.add(j,Math.floor((q[k]+two.x)/gap),Math.floor((q[k+1]+two.y)/gap),Math.floor((q[k+2]+two.z)/gap));}
  for(let i=0;i<one.solver.inverseMass.length;i++){const k=i*3,cx=Math.floor((p[k]+one.x)/gap),cy=Math.floor((p[k+1]+one.y)/gap),cz=Math.floor((p[k+2]+one.z)/gap);
   for(let z=cz-1;z<=cz+1;z++)for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)for(let j=hash.first(x,y,z);j>=0;j=hash.nextId(j))if(hash.matches(j,x,y,z))resolvePair(one,i,two,j,gap);
  }
 }
}
