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
  constructor(readonly config:ClothPhysics) {
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
    for(let i=0;i<180;i++)this.step(1/120,false);
    this.rest.set(this.positions);this.velocity.fill(0);this.time=0;
  }
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
export function resolveClothContacts(surfaces:ClothContactSurface[],crossOnly=false){
  const gap=.115,buckets=new Map<string,{surface:ClothContactSurface;index:number}[]>();
  for(const surface of surfaces){const solver=surface.solver,p=solver.positions;
    for(let index=0;index<solver.inverseMass.length;index++){
      const k=index*3,x=p[k]+surface.x,y=p[k+1]+surface.y,z=p[k+2]+surface.z;
      const cx=Math.floor(x/gap),cy=Math.floor(y/gap),cz=Math.floor(z/gap);
      for(let iz=-1;iz<=1;iz++)for(let iy=-1;iy<=1;iy++)for(let ix=-1;ix<=1;ix++){
        const bucket=buckets.get(`${cx+ix},${cy+iy},${cz+iz}`);if(!bucket)continue;
        for(const other of bucket){
          if(other.surface===surface){if(crossOnly)continue;
            const nx=solver.config.segmentsX+1;
            if(Math.abs(index%nx-other.index%nx)<=2&&Math.abs(Math.floor(index/nx)-Math.floor(other.index/nx))<=2)continue;
          }
          const q=other.surface.solver.positions,j=other.index*3;
          const dx=p[k]+surface.x-q[j]-other.surface.x,dy=p[k+1]+surface.y-q[j+1]-other.surface.y,dz=p[k+2]+surface.z-q[j+2]-other.surface.z;
          const d2=dx*dx+dy*dy+dz*dz;if(d2>=gap*gap)continue;
          const wa=solver.inverseMass[index],wb=other.surface.solver.inverseMass[other.index],mass=wa+wb;if(!mass)continue;
          const d=Math.sqrt(d2),nx=d>1e-8?dx/d:0,ny=d>1e-8?dy/d:0,nz=d>1e-8?dz/d:1;
          const correction=(gap-d)/mass;
          p[k]+=nx*correction*wa;p[k+1]+=ny*correction*wa;p[k+2]+=nz*correction*wa;
          q[j]-=nx*correction*wb;q[j+1]-=ny*correction*wb;q[j+2]-=nz*correction*wb;
        }
      }
      const key=`${cx},${cy},${cz}`,bucket=buckets.get(key),entry={surface,index};
      if(bucket)bucket.push(entry);else buckets.set(key,[entry]);
    }
  }
}
