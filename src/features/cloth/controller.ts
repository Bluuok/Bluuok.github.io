import type * as Three from 'three';
import { clothConfig, type ClothConfig } from './config';
import { ClothSolver, resolveClothContacts } from './solver';
import { createWeaveNormal } from './material';
import { subscribeMotion } from '../../lib/motion';
type Surface={mesh:Three.Mesh<Three.BufferGeometry,Three.MeshPhysicalMaterial>;solver:ClothSolver};
/** One rendering/lifecycle owner; both installations share the same physical solver. */
export class ClothController {
  private abort=new AbortController();private canvas:HTMLCanvasElement;
  private disposed=false;private visible=false;private reduced=false;private loading=false;private failed=false;private lost=false;
  private frame=0;private last=0;private T:typeof Three|null=null;
  private renderer:Three.WebGLRenderer|null=null;private scene:Three.Scene|null=null;private camera:Three.PerspectiveCamera|null=null;
  private texture:Three.DataTexture|null=null;private surfaces:Surface[]=[];
  private ray:Three.Raycaster|null=null;private ndc:Three.Vector2|null=null;
  private pointer={x:0,y:0,inside:false};private previousHit:{x:number;y:number;time:number;surface:Surface}|null=null;
  private grabbed:Surface|null=null;private pointerId:number|null=null;private plane:Three.Plane|null=null;
  private observer:IntersectionObserver|null=null;private ro:ResizeObserver|null=null;private unsub:(()=>void)|null=null;
  constructor(private container:HTMLElement,private cfg:ClothConfig=clothConfig){
    const canvas=container.querySelector('canvas');if(!canvas)throw new Error('Cloth canvas missing');this.canvas=canvas;
  }
  init(){
    const signal=this.abort.signal;
    this.unsub=subscribeMotion(m=>{this.reduced=m.isReduced;if(this.reduced)this.clear();this.sync();});
    this.observer=new IntersectionObserver(([e])=>{this.visible=!!e?.isIntersecting;this.sync();});this.observer.observe(this.container);
    this.ro=new ResizeObserver(()=>{this.clear();this.resize();});this.ro.observe(this.container);
    this.container.addEventListener('pointermove',e=>this.move(e),{passive:true,signal});
    this.container.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.pointerType==='touch'||this.reduced)return;
      this.move(e);const hit=this.hit();if(!hit||!this.T||!this.camera)return;
      this.grabbed=hit.surface;this.pointerId=e.pointerId;this.container.setPointerCapture(e.pointerId);
      this.grabbed.solver.beginGrab(hit.local.x,hit.local.y,hit.local.z);
      const normal=this.camera.getWorldDirection(new this.T.Vector3());
      this.plane=new this.T.Plane().setFromNormalAndCoplanarPoint(normal,hit.world);
      this.container.dataset.grabbed='true';
    },{signal});
    this.container.addEventListener('pointerleave',()=>{if(!this.grabbed)this.clear();},{signal});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])this.container.addEventListener(event,()=>this.clear(),{signal});
    window.addEventListener('blur',()=>this.clear(),{signal});
    window.addEventListener('scroll',()=>{if(!this.grabbed)this.clear();},{passive:true,signal});
    document.addEventListener('visibilitychange',()=>{this.clear();this.sync();},{signal});
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.clear();this.stop();this.container.dataset.clothState='fallback';},{signal});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.sync();},{signal});
    window.addEventListener('pagehide',e=>{if(e.persisted){this.clear();this.stop();}else this.dispose();},{signal});
    window.addEventListener('pageshow',()=>this.sync(),{signal});
  }
  private move(e:PointerEvent){
    if(this.reduced||this.disposed||e.pointerType==='touch')return;
    const r=this.container.getBoundingClientRect();
    this.pointer={x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2,inside:true};
    if(!this.ray||!this.ndc||!this.camera||!this.T)return;
    this.ray.setFromCamera(this.ndc.set(this.pointer.x,this.pointer.y),this.camera);
    if(this.grabbed&&this.plane){
      const world=this.ray.ray.intersectPlane(this.plane,new this.T.Vector3());
      if(world){const local=this.grabbed.mesh.worldToLocal(world);const c=this.cfg;
        this.grabbed.solver.moveGrab(Math.max(-c.width,Math.min(c.width,local.x)),Math.max(-c.height*.75,Math.min(c.height*.75,local.y)),Math.max(-.7,Math.min(1.5,local.z)));}
      return;
    }
    const hit=this.hit();this.container.dataset.pointerHit=String(!!hit);
    if(hit){const now=performance.now(),prev=this.previousHit;
      const dt=prev?Math.max(.016,(now-prev.time)/1000):.016;
      hit.surface.solver.gustAt(hit.local.x,hit.local.y,prev?.surface===hit.surface?(hit.local.x-prev.x)/dt:0,prev?.surface===hit.surface?(hit.local.y-prev.y)/dt:0);
      this.previousHit={x:hit.local.x,y:hit.local.y,time:now,surface:hit.surface};
    }else this.previousHit=null;
  }
  private hit(){
    if(!this.ray||!this.ndc||!this.camera||!this.pointer.inside)return null;
    this.ray.setFromCamera(this.ndc.set(this.pointer.x,this.pointer.y),this.camera);
    this.scene?.updateMatrixWorld(true);
    const result=this.ray.intersectObjects(this.surfaces.map(s=>s.mesh),false)[0];if(!result)return null;
    const surface=this.surfaces.find(s=>s.mesh===result.object)!;
    return {surface,world:result.point.clone(),local:surface.mesh.worldToLocal(result.point.clone())};
  }
  private clear(){
    this.pointer.inside=false;this.previousHit=null;this.grabbed?.solver.endGrab();this.grabbed=null;this.plane=null;
    const id=this.pointerId;this.pointerId=null;if(id!==null&&this.container.hasPointerCapture(id))this.container.releasePointerCapture(id);
    this.container.dataset.pointerHit='false';this.container.dataset.grabbed='false';
  }
  private stop(){cancelAnimationFrame(this.frame);this.frame=0;}
  private sync(){
    if(this.disposed||this.lost)return;
    const active=this.visible&&!this.reduced&&!document.hidden;
    if(!this.renderer){this.container.dataset.clothState=this.failed?'fallback':this.reduced?'static':'idle';if(active&&!this.loading&&!this.failed)void this.load();return;}
    this.container.dataset.clothState=this.reduced?'static':active?'running':'paused';
    if(active&&!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(this.tick);}
    else if(!active){this.stop();this.clear();if(this.reduced){this.surfaces.forEach(s=>s.solver.reset());this.updateMeshes();}this.paint();}
  }
  private async load(){
    this.loading=true;
    try{this.T=await import('three');if(this.disposed)return;this.build();}
    catch(e){this.failed=true;this.release();console.warn('[cloth] Static fallback',e);}
    finally{this.loading=false;this.sync();}
  }
  private build(){
    const T=this.T!;
    this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true});
    this.renderer.setClearColor(0,0);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(34,1,.1,50);
    this.camera.position.set(...this.cfg.cameraPos);this.camera.lookAt(...this.cfg.cameraTarget);
    this.scene.add(new T.HemisphereLight(0xf7f8ff,0x56617a,1.1));
    const key=new T.DirectionalLight(0xfff5ea,2.5);key.position.set(-4,5,3);this.scene.add(key);
    const rim=new T.DirectionalLight(0xb8c3ef,1.3);rim.position.set(3,1,-3);this.scene.add(rim);
    this.texture=createWeaveNormal(T);const count=this.cfg.paper?3:1;
    for(let n=0;n<count;n++){
      const solver=new ClothSolver({...this.cfg,wind:this.cfg.wind*(1+n*.2)}),sx=this.cfg.segmentsX,sy=this.cfg.segmentsY;
      const geometry=new T.PlaneGeometry(this.cfg.width,this.cfg.height,sx,sy);
      // PlaneGeometry is row-major, top to bottom, matching the solver.
      geometry.setAttribute('position',new T.BufferAttribute(solver.positions,3).setUsage(T.DynamicDrawUsage));geometry.computeVertexNormals();
      const material=new T.MeshPhysicalMaterial({color:this.cfg.paper?[0xa5b9cc,0xc5ccdc,0x91adbc][n]:0xcbd3e4,
        roughness:this.cfg.paper?.86:.78,metalness:0,sheen:this.cfg.paper?.25:.8,sheenColor:0xe4dcf3,sheenRoughness:.8,
        clearcoat:0,transmission:0,normalMap:this.texture,normalScale:new T.Vector2(.18,.18),side:T.DoubleSide});
      const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;
      if(this.cfg.paper)mesh.position.set((n-1)*1.55,n===1?.2:-.05,(n-1)*.18);
      this.scene.add(mesh);this.surfaces.push({mesh,solver});
      // Visible hardware explains the hanging surface and remains at the fixed nodes.
      for(const index of [0,sx]){const pin=new T.Mesh(new T.SphereGeometry(.045,12,8),new T.MeshStandardMaterial({color:0x526377,metalness:.6,roughness:.4}));
        pin.position.fromArray(solver.rest,index*3).add(mesh.position);this.scene.add(pin);}
    }
    this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.container.dataset.clothMaterial='woven-normal';
    this.container.dataset.clothSolver='xpbd';this.container.dataset.clothVertices=String(this.surfaces.reduce((sum,s)=>sum+s.solver.positions.length/3,0));
    this.resize();this.paint();
  }
  private resize(){if(!this.renderer||!this.camera)return;const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.paint();}
  private updateMeshes(){for(const s of this.surfaces){s.mesh.geometry.getAttribute('position').needsUpdate=true;s.mesh.geometry.computeVertexNormals();s.mesh.geometry.computeBoundingSphere();}}
  private tick=(now:number)=>{this.frame=0;if(this.disposed||!this.visible||this.reduced||document.hidden||this.lost)return;
    const dt=Math.min(.05,(now-this.last)/1000);this.last=now;const substeps=Math.max(1,Math.ceil(dt*120));
    for(let i=0;i<substeps;i++){this.surfaces.forEach(s=>s.solver.advance(dt/substeps));
      if(this.surfaces.length>1)resolveClothContacts(this.surfaces.map(s=>({solver:s.solver,x:s.mesh.position.x,y:s.mesh.position.y,z:s.mesh.position.z})),true);}
    this.updateMeshes();this.paint();this.frame=requestAnimationFrame(this.tick);};
  private paint(){if(this.renderer&&this.scene&&this.camera&&!this.lost)this.renderer.render(this.scene,this.camera);}
  private release(){this.scene?.traverse(o=>{const m=o as Three.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());}});this.texture?.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.renderer=null;this.scene=null;this.surfaces=[];}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.stop();this.abort.abort();this.observer?.disconnect();this.ro?.disconnect();this.unsub?.();this.release();this.container.dataset.clothState='disposed';}
}
