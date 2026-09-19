import type * as Three from 'three';
import { clothConfig, type ClothConfig } from './config';
import { getRestVertex, getAuthoredOffset } from './geometry';
import { createWeaveNormal } from './material';
import { subscribeMotion } from '../../lib/motion';

/** One owner for the mesh, listeners, observers, texture and frame loop. */
export class ClothController {
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private disposed=false; private visible=false; private reduced=false;
  private loaded=false; private loading=false; private failed=false; private lost=false;
  private running=false; private frame=0; private time=0; private elapsed=0;
  private T:typeof Three|null=null; private renderer:Three.WebGLRenderer|null=null;
  private scene:Three.Scene|null=null; private camera:Three.PerspectiveCamera|null=null;
  private mesh:Three.Mesh<Three.BufferGeometry,Three.MeshPhysicalMaterial>|null=null;
  private texture:Three.DataTexture|null=null; private raycaster:Three.Raycaster|null=null;
  private ndc:Three.Vector2|null=null;
  private rest:Float32Array|null=null; private offsets:Float32Array[]=[];
  private weights=[0,0,0,0]; private pointer={x:0,y:0,inside:false};
  private uv={x:.5,y:.5}; private strength=0;
  private resizeObserver:ResizeObserver|null=null; private observer:IntersectionObserver|null=null;
  private unsub:(()=>void)|null=null;
  constructor(private container:HTMLElement, private cfg:ClothConfig=clothConfig){
    const canvas=container.querySelector('canvas');if(!canvas)throw new Error('Cloth canvas missing');this.canvas=canvas;
  }
  init(){
    const signal=this.abort.signal;
    this.unsub=subscribeMotion(m=>{this.reduced=m.isReduced;this.sync();});
    this.resizeObserver=new ResizeObserver(()=>{this.clear();this.resize();});this.resizeObserver.observe(this.container);
    this.observer=new IntersectionObserver(([e])=>{this.visible=!!e?.isIntersecting;this.sync();});this.observer.observe(this.container);
    const move=(e:PointerEvent)=>{
      if(this.reduced||this.disposed)return;
      const r=this.container.getBoundingClientRect();
      this.pointer={x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2,inside:true};
    };
    this.container.addEventListener('pointermove',move,{passive:true,signal});
    this.container.addEventListener('pointerdown',move,{passive:true,signal});
    for(const name of ['pointerleave','pointercancel','pointerup'])this.container.addEventListener(name,()=>this.clear(),{signal});
    window.addEventListener('blur',()=>this.clear(),{signal});
    window.addEventListener('scroll',()=>this.clear(),{passive:true,signal});
    document.addEventListener('visibilitychange',()=>{this.clear();this.sync();},{signal});
    window.addEventListener('pagehide',(e)=>{if(e.persisted){this.stop();this.reset();}else this.dispose();},{signal});
    window.addEventListener('pageshow',()=>this.sync(),{signal});
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.stop();this.clear();this.container.dataset.clothState='fallback';},{signal});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.reset();this.sync();},{signal});
  }
  private clear(){this.pointer.inside=false;this.container.dataset.pointerHit='false';}
  private stop(){this.running=false;cancelAnimationFrame(this.frame);this.frame=0;}
  private sync(){
    if(this.disposed||this.lost)return;
    const active=this.visible&&!document.hidden&&!this.reduced;
    if(!this.loaded){
      this.container.dataset.clothState=this.failed?'fallback':this.reduced?'static':this.loading?'loading':'idle';
      if(active&&!this.loading&&!this.failed)void this.load();return;
    }
    this.container.dataset.clothState=active?'running':this.reduced?'static':'paused';
    if(active&&!this.running){this.running=true;this.time=performance.now();this.frame=requestAnimationFrame(this.tick);}
    else if(!active){this.stop();this.clear();this.reset();}
  }
  private async load(){
    this.loading=true;this.container.dataset.clothState='loading';
    try{this.T=await import('three');if(this.disposed)return;this.build();this.loaded=true;}
    catch(error){this.failed=true;this.release();console.warn('[cloth] Static artwork fallback',error);}
    finally{this.loading=false;this.sync();}
  }
  private build(){
    const T=this.T!;
    this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setClearColor(0x000000,0);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(34,1,.1,50);
    this.camera.position.set(...this.cfg.cameraPos);this.camera.lookAt(...this.cfg.cameraTarget);
    this.scene.add(new T.HemisphereLight(0xf8faff,0x9ca1ad,1.3));
    const key=new T.DirectionalLight(0xffffff,3.1);key.position.set(-3,4,5);this.scene.add(key);
    const fill=new T.DirectionalLight(0xc9c5eb,.65);fill.position.set(4,-1,3);this.scene.add(fill);
    const sx=this.cfg.segmentsX,sy=this.cfg.segmentsY,count=(sx+1)*(sy+1);
    const p=new Float32Array(count*3),uv=new Float32Array(count*2),indices:number[]=[];
    this.offsets=Array.from({length:4},()=>new Float32Array(count*3));
    const presets=['north','south','east','west'] as const;
    for(let j=0;j<=sy;j++)for(let i=0;i<=sx;i++){
      const u=i/sx,v=j/sy,n=i+j*(sx+1),pt=getRestVertex(u,v,this.cfg);
      p.set([pt.x,pt.y,pt.z],n*3);uv.set([u,v],n*2);
      presets.forEach((preset,k)=>{const o=getAuthoredOffset(u,v,preset);this.offsets[k].set([o.x,o.y,o.z],n*3);});
    }
    for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){const a=i+j*(sx+1),b=a+sx+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geometry=new T.BufferGeometry();geometry.setIndex(indices);
    geometry.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
    if(geometry.boundingSphere)geometry.boundingSphere.radius+=1;
    this.rest=new Float32Array(p);this.texture=createWeaveNormal(T);
    this.texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
    const material=new T.MeshPhysicalMaterial({color:0xf4f5f8,roughness:.78,metalness:0,clearcoat:0,sheen:.7,sheenColor:0xc7c8e1,sheenRoughness:.72,normalMap:this.texture,normalScale:new T.Vector2(.38,.38),side:T.DoubleSide});
    this.mesh=new T.Mesh(geometry,material);this.scene.add(this.mesh);
    this.raycaster=new T.Raycaster();this.ndc=new T.Vector2();
    this.container.dataset.clothVertices=String(count);this.container.dataset.clothMaterial='woven-normal';
    this.resize();this.render();
  }
  private resize(){
    if(!this.renderer||!this.camera)return;
    const width=Math.max(1,this.container.clientWidth),height=Math.max(1,this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<500?1.25:1.5));
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.render();
  }
  private reset(){
    this.strength=0;this.weights.fill(0);this.elapsed=0;
    if(this.mesh&&this.rest){const p=this.mesh.geometry.getAttribute('position') as Three.BufferAttribute;p.copyArray(this.rest);p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();this.render();}
  }
  private tick=(now:number)=>{
    if(!this.running||this.disposed)return;
    const dt=Math.max(0,Math.min(.033,(now-this.time)/1000));this.time=now;this.elapsed+=dt;
    this.update(dt);this.render();this.frame=requestAnimationFrame(this.tick);
  };
  private update(dt:number){
    if(!this.mesh||!this.rest||!this.camera||!this.raycaster||!this.ndc)return;
    let hit=false;
    if(this.pointer.inside){
      this.ndc.set(this.pointer.x,this.pointer.y);this.raycaster.setFromCamera(this.ndc,this.camera);this.mesh.updateMatrixWorld();
      const found=this.raycaster.intersectObject(this.mesh)[0];
      if(found?.uv){this.uv={x:found.uv.x,y:found.uv.y};hit=true;}
    }
    this.container.dataset.pointerHit=String(hit);
    const follow=1-Math.exp(-dt*8), settle=1-Math.exp(-dt*10);
    this.strength+=((hit?1:0)-this.strength)*follow;
    const targets=hit?[Math.max(0,this.pointer.y),Math.max(0,-this.pointer.y),Math.max(0,this.pointer.x),Math.max(0,-this.pointer.x)]:[0,0,0,0];
    const total=Math.max(1,targets.reduce((a,b)=>a+b,0));
    this.weights.forEach((_,k)=>this.weights[k]+=(targets[k]/total*this.cfg.maxPresetWeight-this.weights[k])*follow);
    const p=this.mesh.geometry.getAttribute('position') as Three.BufferAttribute;
    const uv=this.mesh.geometry.getAttribute('uv');
    const radius=Math.max(.05,this.cfg.pointerRadius);
    for(let i=0;i<p.count;i++){
      const u=uv.getX(i),v=uv.getY(i),k=i*3;
      const dx=(u-this.uv.x)*this.cfg.width,dy=(v-this.uv.y)*this.cfg.height;
      const force=Math.exp(-(dx*dx+dy*dy)/(radius*radius*.5))*this.strength;
      const ambient=Math.sin(this.elapsed*.55+u*4+v*2)*.018*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
      for(let axis=0;axis<3;axis++){
        let target=this.rest[k+axis];for(let n=0;n<4;n++)target+=this.offsets[n][k+axis]*this.weights[n];
        if(axis===2)target+=ambient-force*this.cfg.maxDepression;
        p.array[k+axis]+=(target-p.array[k+axis])*settle;
      }
    }
    p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();
  }
  private render(){if(!this.lost&&this.renderer&&this.scene&&this.camera)this.renderer.render(this.scene,this.camera);}
  private release(){this.mesh?.geometry.dispose();this.mesh?.material.dispose();this.texture?.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.mesh=null;this.texture=null;this.renderer=null;this.scene=null;this.rest=null;this.offsets=[];}
  dispose(){if(this.disposed)return;this.disposed=true;this.stop();this.abort.abort();this.observer?.disconnect();this.resizeObserver?.disconnect();this.unsub?.();this.release();this.container.dataset.clothState='disposed';}
}
