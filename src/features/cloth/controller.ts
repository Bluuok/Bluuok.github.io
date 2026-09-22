import {poseKey,validPose} from './pose';
import {sceneReadiness} from '../../lib/scene-readiness';
let modules:Promise<any>|undefined;
const prepareModules=()=>modules??=Promise.all([import('three'),import('three/addons/environments/RoomEnvironment.js'),import('./baked-poses.json')]);
import type * as Three from 'three';
import { clothConfig, type ClothConfig } from './config';
import { ClothSolver, resolveClothContacts } from './solver';
import { createWeaveNormal, clothMaterials, createStageTexture } from './material';
import { createClothSurface } from './surface';
import { coveStages } from '../../data/studio-art';
import { subscribeMotion } from '../../lib/motion';
type Surface={mesh:Three.Mesh<Three.BufferGeometry,Three.MeshPhysicalMaterial>;solver:ClothSolver;display:ReturnType<typeof createClothSurface>;pins:Three.Mesh[];baseZ:number;proxy:Three.Mesh;selection:{value:number}};
type Press={id:number;x:number;y:number;touch:boolean;surface:Surface;world:Three.Vector3;local:Three.Vector3;drag:boolean};
/** Shared physics/render lifecycle; stage content and material profiles remain independent. */
export class ClothController {
 private abort=new AbortController();private canvas:HTMLCanvasElement;
 private preparationAbort:AbortController|null=null;private disposed=false;private visible=false;private reduced=false;private loading=false;private failed=false;private lost=false;
 private frame=0;private last=0;private T:typeof Three|null=null;private selected=0;private accumulator=0;private pendingPointer:PointerEvent|null=null;private prepared=false;private preparing:IntersectionObserver|null=null;private pickMeshes:Three.Mesh[]=[];private contacts:any[]=[];private poses:Record<string,any>={};private epoch=0;private perf:ReturnType<typeof sceneReadiness>;
 private renderer:Three.WebGLRenderer|null=null;private scene:Three.Scene|null=null;private camera:Three.PerspectiveCamera|null=null;
 private environment:Three.WebGLRenderTarget|null=null;private texture:Three.DataTexture|null=null;private surfaces:Surface[]=[];
 private hitBuffer:Three.Intersection[]=[];private hitWorld:Three.Vector3|null=null;private hitLocal:Three.Vector3|null=null;private dragWorld:Three.Vector3|null=null;
 private ray:Three.Raycaster|null=null;private ndc:Three.Vector2|null=null;
 private pointer={x:0,y:0,inside:false};private previousHit:{x:number;y:number;time:number;surface:Surface}|null=null;
 private press:Press|null=null;private grabbed:Surface|null=null;private plane:Three.Plane|null=null;
 private observer:IntersectionObserver|null=null;private ro:ResizeObserver|null=null;private unsub:(()=>void)|null=null;
 constructor(private container:HTMLElement,private cfg:ClothConfig=clothConfig,private onSelect?:(index:number)=>void){
  this.perf=sceneReadiness(cfg.paper?'cove':'home');
  const canvas=container.querySelector('canvas');if(!canvas)throw new Error('Cloth canvas missing');this.canvas=canvas;
 }
 init(){
  const signal=this.abort.signal;
  this.unsub=subscribeMotion(m=>{this.reduced=m.isReduced;if(this.reduced)this.clear();this.sync();});
  this.preparing=new IntersectionObserver(([e])=>{if(e?.isIntersecting&&!this.reduced&&!this.loading&&!this.renderer&&!this.failed)void this.load();},{rootMargin:this.cfg.paper?'250px 0px':'800px 0px'});this.preparing.observe(this.container);
  this.observer=new IntersectionObserver(([e])=>{this.visible=!!e?.isIntersecting;this.sync();});this.observer.observe(this.container);
  this.ro=new ResizeObserver(()=>{this.clear();this.resize();});this.ro.observe(this.container);
  this.canvas.addEventListener('pointermove',e=>{this.pendingPointer=e;},{passive:true,signal});
  this.canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.reduced||!this.T||!this.camera)return;
   this.locate(e);const hit=this.hit();if(!hit)return;
   this.press={id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',surface:hit.surface,world:hit.world.clone(),local:hit.local.clone(),drag:false};
   // Keep native touch scrolling; only a fine-pointer drag captures the pointer.
  },{signal});
  this.canvas.addEventListener('pointerup',e=>{
   const press=this.press;this.locate(e);const hit=this.hit();
   if(press&&e.pointerId===press.id&&!press.drag&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<(press.touch?10:6)&&hit?.surface===press.surface){
    this.onSelect?.(this.surfaces.indexOf(press.surface));
   }
   this.clear();
  },{signal});
  this.canvas.addEventListener('pointerleave',()=>{if(!this.grabbed)this.clear();},{signal});
  for(const event of ['pointercancel','lostpointercapture'])this.canvas.addEventListener(event,()=>this.clear(),{signal});
  window.addEventListener('blur',()=>this.clear(),{signal});
  window.addEventListener('scroll',()=>{if(!this.grabbed)this.clear();},{passive:true,signal});
  document.addEventListener('visibilitychange',()=>{this.clear();this.sync();},{signal});
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.preparationAbort?.abort();this.epoch++;this.clear();this.stop();this.container.dataset.clothState='fallback';},{signal});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.release();this.failed=false;this.sync();},{signal});
  window.addEventListener('pagehide',e=>{if(e.persisted){this.clear();this.stop();}else this.dispose();},{signal});
  window.addEventListener('pageshow',()=>this.sync(),{signal});
 }
 select(index:number){
  this.selected=Math.max(0,Math.min(coveStages.length-1,index));this.container.dataset.selection=String(this.selected);
  this.surfaces.forEach((s,i)=>{s.selection.value=i===this.selected?1:0;});if(this.prepared)this.paint();
 }
 private locate(e:PointerEvent){const r=this.canvas.getBoundingClientRect();this.pointer={x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2,inside:true};}
 private move(e:PointerEvent){
  if(this.reduced||this.disposed)return;this.locate(e);
  if(!this.ray||!this.ndc||!this.camera||!this.T)return;
  this.ray.setFromCamera(this.ndc.set(this.pointer.x,this.pointer.y),this.camera);
  const p=this.press;
  if(p&&p.id===e.pointerId&&!p.drag&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>= (p.touch?10:6)){
   p.drag=true;if(!p.touch){this.grabbed=p.surface;this.canvas.setPointerCapture(e.pointerId);p.surface.solver.beginGrab(p.local.x,p.local.y,p.local.z);
    this.plane=new this.T.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new this.T.Vector3()),p.world);this.container.dataset.grabbed='true';}
  }
  if(e.pointerType==='touch')return;
  if(this.grabbed&&this.plane){const world=this.ray.ray.intersectPlane(this.plane,this.dragWorld!);if(world){const local=this.grabbed.mesh.worldToLocal(world),c=this.cfg;
   this.grabbed.solver.moveGrab(Math.max(-c.width,Math.min(c.width,local.x)),Math.max(-c.height*.75,Math.min(c.height*.75,local.y)),Math.max(-.7,Math.min(1.5,local.z)));}return;}
  const hit=this.hit();this.container.dataset.pointerHit=String(!!hit);
  if(hit&&!p){const now=performance.now(),prev=this.previousHit,dt=prev?Math.max(.016,(now-prev.time)/1000):.016;
   hit.surface.solver.gustAt(hit.local.x,hit.local.y,prev?.surface===hit.surface?(hit.local.x-prev.x)/dt:0,prev?.surface===hit.surface?(hit.local.y-prev.y)/dt:0);
   this.previousHit={x:hit.local.x,y:hit.local.y,time:now,surface:hit.surface};}else this.previousHit=null;
 }
 private hit(){
  if(!this.ray||!this.ndc||!this.camera||!this.pointer.inside)return null;
  this.ray.setFromCamera(this.ndc.set(this.pointer.x,this.pointer.y),this.camera);this.scene?.updateMatrixWorld(true);
  this.hitBuffer.length=0;const result=this.ray.intersectObjects(this.pickMeshes,false,this.hitBuffer)[0];if(!result)return null;
  const surface=this.surfaces.find(s=>s.proxy===result.object)!;
  return {surface,world:this.hitWorld!.copy(result.point),local:surface.mesh.worldToLocal(this.hitLocal!.copy(result.point))};
 }
 private clear(){
  this.pendingPointer=null;const id=this.press?.id;this.press=null;this.pointer.inside=false;this.previousHit=null;this.grabbed?.solver.endGrab();this.grabbed=null;this.plane=null;
  if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  this.container.dataset.pointerHit='false';this.container.dataset.grabbed='false';
 }
 private stop(){cancelAnimationFrame(this.frame);this.frame=0;this.accumulator=0;}
 private sync(){
  if(this.disposed||this.lost||this.loading)return;const active=this.visible&&!this.reduced&&!document.hidden;
  if(!this.renderer){this.container.dataset.clothState=this.failed?'fallback':this.reduced?'static':'idle';if(active&&!this.loading&&!this.failed)void this.load();return;}
  this.container.dataset.clothState=this.reduced?'static':active?'running':'paused';
  if(active&&!this.frame){this.last=performance.now();this.frame=requestAnimationFrame(this.tick);}
  else if(!active){this.stop();this.clear();if(this.reduced){this.surfaces.forEach(s=>s.solver.reset());this.updateMeshes();}this.paint();}
 }
 private async load(){
  if(this.loading||this.disposed||this.failed)return;this.loading=true;this.preparationAbort=new AbortController();const token=this.epoch;this.perf.mark('request');
  try{const [T,{RoomEnvironment},baked]=await prepareModules();if(this.disposed||this.lost||token!==this.epoch)return;this.T=T;this.poses=baked.default;this.perf.mark('module');
   this.build();this.perf.mark('geometry');
   for(const surface of this.surfaces)if(!validPose(surface.solver.config,this.poses[poseKey(surface.solver.config)]))await surface.solver.prepareRest(this.preparationAbort.signal);
   if(this.disposed||this.lost||token!==this.epoch)return;this.updateMeshes();this.perf.mark('pose');this.resize();
   const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer!);this.environment=pmrem.fromScene(room,.035);this.scene!.environment=this.environment!.texture;this.scene!.environmentIntensity=.8;room.dispose();pmrem.dispose();this.perf.mark('environment');
   if(this.cfg.paper){await Promise.race([document.fonts.load('600 32px sans-serif','问题过程材料继续'),new Promise(resolve=>setTimeout(resolve,250))]);if(this.disposed||this.lost||token!==this.epoch)return;}
   this.surfaces.forEach((s,i)=>{if(this.cfg.paper)s.mesh.material.map=createStageTexture(T,coveStages[i],i,this.container.clientWidth<600);});this.perf.mark('text');
   await this.renderer!.compileAsync(this.scene!,this.camera!);if(this.disposed||this.lost||token!==this.epoch)return;this.perf.mark('shader');
   this.surfaces.forEach(s=>{if(s.mesh.material.map)this.renderer!.initTexture(s.mesh.material.map);});if(this.texture)this.renderer!.initTexture(this.texture);
   this.prepared=true;this.paint();this.perf.mark('first-render');this.perf.mark('interactive');
  }catch(e){if(!this.disposed&&!this.lost&&token===this.epoch){this.failed=true;this.release();console.warn('[cloth] Static fallback',e);}}finally{this.loading=false;this.sync();}
 }
 private build(){
  const T=this.T!;this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true});
  this.renderer.setClearColor(0,0);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(34,1,.1,50);this.camera.position.set(...this.cfg.cameraPos);this.camera.lookAt(...this.cfg.cameraTarget);
  this.scene.add(new T.HemisphereLight(0xffffff,0x606777,.65));const key=new T.DirectionalLight(0xffffff,2);key.position.set(-4,5,3);this.scene.add(key);
  const rim=new T.DirectionalLight(0xe7edff,.7);rim.position.set(3,1,-3);this.scene.add(rim);
  this.texture=createWeaveNormal(T);const count=this.cfg.paper?coveStages.length:1;
  for(let n=0;n<count;n++){
   const solver=new ClothSolver({...this.cfg,wind:this.cfg.wind*(1+n*.08)},validPose({...this.cfg,wind:this.cfg.wind*(1+n*.08)},this.poses[poseKey({...this.cfg,wind:this.cfg.wind*(1+n*.08)})])),display=createClothSurface(T,this.cfg);display.update(solver.positions);
   const profile=this.cfg.paper?clothMaterials.card:clothMaterials.satin;
   const material=new T.MeshPhysicalMaterial({color:this.cfg.paper?0xffffff:profile.color,roughness:profile.roughness,metalness:0,sheen:profile.sheen,
    clearcoat:profile.clearcoat,clearcoatRoughness:profile.clearcoatRoughness,transmission:0,opacity:1,normalMap:this.texture,normalScale:new T.Vector2(profile.normalStrength,profile.normalStrength),side:T.DoubleSide});
   const selection={value:n===this.selected?1:0};
   if(this.cfg.paper){material.onBeforeCompile=shader=>{shader.uniforms.uSelected=selection;shader.fragmentShader='uniform float uSelected;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n float edge=min(min(vMapUv.x,1.0-vMapUv.x),min(vMapUv.y,1.0-vMapUv.y)); float border=1.0-smoothstep(.018,.026,abs(edge-.035)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.98,1.0),border*uSelected*.9);\n#endif');};material.customProgramCacheKey=()=> 'stage-selection-v1';}
   const mesh=new T.Mesh(display.geometry,material);mesh.frustumCulled=false;mesh.userData.stageId=this.cfg.paper?coveStages[n].id:'satin';
   this.scene.add(mesh);const pins:Three.Mesh[]=[];
   for(const index of [0,this.cfg.segmentsX]){const pin=new T.Mesh(new T.SphereGeometry(.032,10,8),new T.MeshStandardMaterial({color:0x667383,metalness:.5,roughness:.4}));pin.position.fromArray(solver.rest,index*3);mesh.add(pin);pins.push(pin);}
   const pickGeometry=new T.PlaneGeometry(this.cfg.width,this.cfg.height,this.cfg.segmentsX,this.cfg.segmentsY);pickGeometry.setAttribute('position',new T.BufferAttribute(solver.positions,3));const proxy=new T.Mesh(pickGeometry,new T.MeshBasicMaterial({side:T.DoubleSide}));proxy.visible=false;this.scene.add(proxy);this.pickMeshes.push(proxy);
   this.surfaces.push({mesh,solver,display,pins,baseZ:0,proxy,selection});
  }
  this.hitWorld=new T.Vector3();this.hitLocal=new T.Vector3();this.dragWorld=new T.Vector3();this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.container.dataset.clothMaterial=this.cfg.paper?'printed-paper-cloth':'coated-white-satin';
  this.container.dataset.clothSolver='xpbd';this.container.dataset.clothVertices=String(this.surfaces.reduce((sum,s)=>sum+s.solver.positions.length/3,0));
  this.container.dataset.surfaceCount=String(count);this.select(this.selected);this.resize();
 }
 private resize(){
  if(!this.renderer||!this.camera)return;const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;
  if(this.cfg.paper){const mobile=w<600;this.surfaces.forEach((s,i)=>{s.baseZ=(i%2)*.08;s.mesh.position.set(mobile?(i%2-.5)*1.95:(i-1.5)*1.95,mobile?(i<2?1.5:-1.5):(i%2)*.12,s.baseZ);});
   const worldWidth=mobile?4.2:8.2,worldHeight=mobile?6.3:3.5,distance=Math.max(worldHeight,worldWidth/this.camera.aspect)/(2*Math.tan(34*Math.PI/360));
   this.camera.position.set(0,0,distance);this.camera.lookAt(0,0,0);
  }
  this.camera.updateProjectionMatrix();this.surfaces.forEach(s=>s.proxy.position.copy(s.mesh.position));if(this.prepared)this.paint();
 }
 private updateMeshes(){for(const s of this.surfaces){s.display.update(s.solver.positions);s.proxy.position.copy(s.mesh.position);s.proxy.geometry.getAttribute('position').needsUpdate=true;s.proxy.geometry.computeBoundingSphere();}}
 private tick=(now:number)=>{this.frame=0;if(this.disposed||!this.visible||this.reduced||document.hidden||this.lost)return;
  const dt=Math.min(.05,(now-this.last)/1000);this.last=now;
  if(this.pendingPointer){const event=this.pendingPointer;this.pendingPointer=null;this.move(event);}
  this.accumulator=Math.min(this.accumulator+dt,1/20);
  if(!this.contacts.length)this.contacts=this.surfaces.map(s=>({solver:s.solver,x:0,y:0,z:0}));
  this.surfaces.forEach((s,i)=>{const c=this.contacts[i];c.x=s.mesh.position.x;c.y=s.mesh.position.y;c.z=s.mesh.position.z;});
  while(this.accumulator>=1/120){this.surfaces.forEach(s=>s.solver.fixedStep());if(this.surfaces.length>1){resolveClothContacts(this.contacts,true);this.surfaces.forEach(s=>s.solver.reconcileVelocity());}this.accumulator-=1/120;}
  if(this.cfg.paper)this.surfaces.forEach((s,i)=>{s.mesh.position.z+=(s.baseZ+(i===this.selected ? .18 : 0)-s.mesh.position.z)*(1-Math.exp(-dt*12));});
  this.updateMeshes();this.paint();this.frame=requestAnimationFrame(this.tick);
 };
 private paint(){if(this.prepared&&this.renderer&&this.scene&&this.camera&&!this.lost)this.renderer.render(this.scene,this.camera);}
 private release(){this.surfaces.forEach(s=>{s.display.dispose();s.mesh.material.map?.dispose();});this.scene?.traverse(o=>{const m=o as Three.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());}});this.environment?.dispose();this.texture?.dispose();this.renderer?.dispose();this.renderer=null;this.scene=null;this.surfaces=[];this.pickMeshes=[];this.contacts=[];this.prepared=false;}
 dispose(){if(this.disposed)return;this.disposed=true;this.preparationAbort?.abort();this.clear();this.stop();this.abort.abort();this.observer?.disconnect();this.preparing?.disconnect();this.ro?.disconnect();this.unsub?.();this.release();this.container.dataset.clothState='disposed';}
}
