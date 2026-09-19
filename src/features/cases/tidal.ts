import type * as Three from 'three';
import {subscribeMotion} from '../../lib/motion';

/** Rigid, beveled ceramic shapes. On-demand frames, no perpetual orbit loop. */
export function mountTidal(root:HTMLElement){
  const canvas=root.querySelector('canvas')!;
  const viewport=root.querySelector<HTMLElement>('.tidal-viewport')!;
  const abort=new AbortController();let disposed=false,visible=false,reduced=false,loading=false,lost=false;
  let renderer:Three.WebGLRenderer|null=null,scene:Three.Scene|null=null,camera:Three.PerspectiveCamera|null=null,group:Three.Group|null=null;
  let frame=0,last=0,x=0,y=0,tx=0,ty=0,selected=0,pulseStart=-1;
  const traces:Three.Mesh<Three.TubeGeometry,Three.MeshStandardMaterial>[]=[];
  const paths:Three.CatmullRomCurve3[]=[];
  let dot:Three.Mesh<Three.SphereGeometry,Three.MeshBasicMaterial>|null=null;
  const paint=()=>{if(renderer&&scene&&camera&&!lost)renderer.render(scene,camera);};
  const stop=()=>{cancelAnimationFrame(frame);frame=0;};
  const reset=()=>{stop();x=y=tx=ty=0;pulseStart=-1;if(group)group.rotation.set(0,0,0);if(dot)dot.visible=false;paint();};
  const tick=(now:number)=>{
    frame=0;if(!visible||reduced||document.hidden||disposed||lost)return;
    const dt=Math.min(.04,(now-last)/1000);last=now;const f=1-Math.exp(-dt*8);x+=(tx-x)*f;y+=(ty-y)*f;
    if(group)group.rotation.set(y,x,0);
    const phase=(now-pulseStart)/1300;
    if(dot){dot.visible=pulseStart>0&&phase<1;if(dot.visible)dot.position.copy(paths[selected].getPointAt(Math.max(0,phase)));}
    paint();if(Math.abs(tx-x)+Math.abs(ty-y)>.0002||dot?.visible)frame=requestAnimationFrame(tick);
  };
  const wake=()=>{if(!frame&&renderer&&visible&&!reduced&&!document.hidden&&!lost){last=performance.now();frame=requestAnimationFrame(tick);}};
  const resize=()=>{if(!renderer||!camera)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(w,h,false);paint();};
  const release=()=>{
    if(scene)scene.traverse(object=>{const mesh=object as Three.Mesh;if(mesh.isMesh){mesh.geometry.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m.dispose());}});
    renderer?.dispose();renderer?.forceContextLoss();renderer=null;scene=null;group=null;
  };
  const load=async()=>{
    if(loading||renderer||disposed||reduced)return;loading=true;
    try{
      const T=await import('three');if(disposed)return;
      renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      scene=new T.Scene();camera=new T.PerspectiveCamera(34,1,.1,50);camera.position.set(4.2,3.1,7.1);camera.lookAt(0,.2,0);
      scene.add(new T.HemisphereLight(0xf7f9ff,0x9da3b4,1.8));
      const light=new T.DirectionalLight(0xffffff,3.5);light.position.set(-3,5,4);scene.add(light);
      const rim=new T.DirectionalLight(0xcac9ed,.6);rim.position.set(4,1,-2);scene.add(rim);
      group=new T.Group();scene.add(group);
      for(let i=0;i<3;i++){
        const shape=new T.Shape();shape.moveTo(-2.5,0);shape.bezierCurveTo(-1.3,.02,-1.4,1.35,-.1,1.04);shape.bezierCurveTo(1,.8,1.15,-.05,2.45,.17);shape.lineTo(2.45,.02);shape.bezierCurveTo(.95,-.2,.87,.67,-.12,.86);shape.bezierCurveTo(-1.16,1.14,-1.16,-.17,-2.5,-.15);shape.closePath();
        const geo=new T.ExtrudeGeometry(shape,{depth:.27,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.065,bevelThickness:.065,curveSegments:36});
        const mesh=new T.Mesh(geo,new T.MeshPhysicalMaterial({color:[0xf1f3f8,0xfafafa,0xe5e9f3][i],roughness:.43,metalness:0,clearcoat:.18,clearcoatRoughness:.55}));
        mesh.position.set((i-1)*.13,-.3,(i-1)*.83);group.add(mesh);
        const curve=new T.CubicBezierCurve3(new T.Vector3(-2.47,.035,0),new T.Vector3(-1.15,1.26,0),new T.Vector3(.4,1.28,0),new T.Vector3(2.4,.2,0));
        const points=curve.getPoints(50).map(p=>new T.Vector3(p.x+mesh.position.x,p.y+mesh.position.y+.025,mesh.position.z+.14));
        const path=new T.CatmullRomCurve3(points);paths.push(path);
        const trace=new T.Mesh(new T.TubeGeometry(path,60,.009,5,false),new T.MeshStandardMaterial({color:0xabb6d1,emissive:0x7987b4,emissiveIntensity:.1,transparent:true,opacity:.22}));traces.push(trace);group.add(trace);
      }
      dot=new T.Mesh(new T.SphereGeometry(.026,12,8),new T.MeshBasicMaterial({color:0x8999db}));dot.visible=false;group.add(dot);
      resize();select(selected);paint();root.dataset.renderState='ready';
    }catch(error){release();root.dataset.renderState='fallback';console.warn('[tidal] Static artwork fallback',error);}
    finally{loading=false;}
  };
  function select(index:number){selected=Math.max(0,Math.min(2,index));traces.forEach((trace,i)=>{trace.material.opacity=i===selected?.8:.16;});if(reduced){paint();return;}pulseStart=performance.now();wake();}
  const unsub=subscribeMotion(m=>{reduced=m.isReduced;if(reduced)reset();else if(visible){void load();wake();}});
  const observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;if(visible){void load();wake();}else reset();});observer.observe(viewport);
  const ro=new ResizeObserver(resize);ro.observe(viewport);
  viewport.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduced)return;const r=viewport.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*.11;ty=((e.clientY-r.top)/r.height-.5)*.07;wake();},{passive:true,signal:abort.signal});
  for(const event of ['pointerleave','pointercancel'])viewport.addEventListener(event,()=>{tx=ty=0;wake();},{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else wake();},{signal:abort.signal});window.addEventListener('blur',reset,{signal:abort.signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();root.dataset.renderState='fallback';},{signal:abort.signal});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;reset();root.dataset.renderState='ready';},{signal:abort.signal});
  const dispose=()=>{if(disposed)return;disposed=true;stop();abort.abort();observer.disconnect();ro.disconnect();unsub();release();};
  window.addEventListener('pagehide',e=>{if(e.persisted)reset();else dispose();},{signal:abort.signal});window.addEventListener('pageshow',wake,{signal:abort.signal});document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
  return {select,dispose};
}
