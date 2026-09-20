import type * as Three from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { subscribeMotion } from '../../lib/motion';

/** Rigid, beveled ceramic shapes. Frames run only during interaction/settling. */
export function mountTidal(root: HTMLElement) {
  const canvas = root.querySelector('canvas')!;
  const viewport = root.querySelector<HTMLElement>('.tidal-viewport')!;
  const abort = new AbortController();
  let disposed=false, visible=false, reduced=false, loading=false, lost=false, failed=false;
  let renderer:Three.WebGLRenderer|null=null, scene:Three.Scene|null=null;
  let camera:Three.PerspectiveCamera|null=null, group:Three.Group|null=null;
  let controls:OrbitControls|null=null, environment:Three.WebGLRenderTarget|null=null;
  let dragging=false, dragged=false, touchViewing=false, updatingControls=false;
  let frame=0, last=0, x=0, y=0, tx=0, ty=0, selected=0, pulseStart=-1;
  const meshes:Three.Mesh<Three.ExtrudeGeometry,Three.MeshPhysicalMaterial>[]=[];
  const traces:Three.Mesh<Three.TubeGeometry,Three.MeshStandardMaterial>[]=[];
  const paths:Three.CatmullRomCurve3[]=[];
  let dot:Three.Mesh<Three.SphereGeometry,Three.MeshBasicMaterial>|null=null;
  const baseColors=[0x829fb9, 0x8db9ad, 0xb3a3c7];
  const pulseColors=[0xdaa250, 0x2f8c62, 0x22879f];
  const traceColors=[0xa68958, 0x327d5d, 0x287a91];

  const paint = () => { if(renderer&&scene&&camera&&!lost)renderer.render(scene,camera); };
  const stop = () => { cancelAnimationFrame(frame); frame=0; };
  const reset = () => {
    stop(); x=y=tx=ty=0; pulseStart=-1;
    dragged=false;controls?.reset();if(group)group.rotation.set(0,0,0); if(dot)dot.visible=false; paint();
  };
  const tick = (now:number) => {
    frame=0; if(!visible||reduced||document.hidden||disposed||lost)return;
    const dt=Math.min(.04,(now-last)/1000); last=now;
    const f=1-Math.exp(-dt*8); x+=(tx-x)*f; y+=(ty-y)*f;
    if(group)group.rotation.set(y,x,0);
    if(controls)controls.dampingFactor=1-Math.exp(-dt*18);
    updatingControls=true;
    const orbitChanged=controls?.update()??false;
    updatingControls=false;
    root.dataset.azimuth=String(controls?.getAzimuthalAngle()??0);
    root.dataset.hoverAngle=String(x);
    const phase=(now-pulseStart)/1200;
    if(dot) {
      dot.visible=pulseStart>0&&phase<1;
      if(dot.visible) {
        dot.position.copy(paths[selected].getPointAt(Math.max(0,Math.min(1,phase))));
        // Pulse size peaks in mid-flight
        const scale=1+Math.sin(phase*Math.PI)*.4;
        dot.scale.set(scale,scale,scale);
      }
    }
    paint();
    if(Math.abs(tx-x)+Math.abs(ty-y)>.0002||dot?.visible||orbitChanged||dragging)frame=requestAnimationFrame(tick);
  };
  const wake = () => {
    if(!frame&&renderer&&visible&&!reduced&&!document.hidden&&!lost) { last=performance.now(); frame=requestAnimationFrame(tick); }
  };
  const resize = () => {
    if(!renderer||!camera)return;
    const w=Math.max(1,viewport.clientWidth), h=Math.max(1,viewport.clientHeight);
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.setSize(w,h,false); paint();
  };
  const release = () => {
    controls?.dispose();controls=null;environment?.dispose();environment=null;
    scene?.traverse(object => {
      const mesh=object as Three.Mesh;
      if(mesh.isMesh) { mesh.geometry.dispose(); const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]; materials.forEach(m=>m.dispose()); }
    });
    renderer?.dispose(); renderer?.forceContextLoss(); renderer=null; scene=null; group=null; dot=null; meshes.length=traces.length=paths.length=0;
  };
  const load = async () => {
    if(loading||renderer||disposed||reduced||failed)return;
    loading=true;
    try {
      const [T,{OrbitControls},{RoomEnvironment}]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')]); if(disposed)return;
      renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setClearColor(0,0); renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
      scene=new T.Scene(); camera=new T.PerspectiveCamera(34,1,.1,50);
      camera.position.set(4.2,3.1,7.1); camera.lookAt(0,.2,0);
      const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
      environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
      controls=new OrbitControls(camera,canvas);controls.target.set(0,.2,0);controls.enableZoom=false;controls.enablePan=false;
      controls.enableDamping=true;controls.dampingFactor=.25;controls.rotateSpeed=.65;controls.minPolarAngle=.3;controls.maxPolarAngle=Math.PI-.3;
      controls.update();controls.saveState();
      controls.enabled=matchMedia('(pointer:fine)').matches&&!reduced;
      canvas.style.touchAction='pan-y pinch-zoom';
      controls.addEventListener('start',()=>{dragging=true;dragged=true;tx=x;ty=y;wake();});
      controls.addEventListener('end',()=>{dragging=false;wake();});
      controls.addEventListener('change',()=>{paint();if(!updatingControls)wake();});
      scene.add(new T.HemisphereLight(0xffffff,0xe6eaf2,.7));
      const keyLight=new T.DirectionalLight(0xfffaf0,1.8); keyLight.position.set(-3.2,5.2,4.5); scene.add(keyLight);
      const rimLight=new T.DirectionalLight(0xd4e9e5,1.2); rimLight.position.set(4.5,1.5,-2.5); scene.add(rimLight);
      const specLight=new T.DirectionalLight(0xfff8ee,1.0); specLight.position.set(1.0,4.0,5.0); scene.add(specLight);
      group=new T.Group(); scene.add(group);
      for(let i=0;i<3;i++) {
        const shape=new T.Shape();
        shape.moveTo(-2.5,0);
        shape.bezierCurveTo(-1.3,.02,-1.4,1.35,-.1,1.04);
        shape.bezierCurveTo(1,.8,1.15,-.05,2.45,.17);
        shape.lineTo(2.45,.02);
        shape.bezierCurveTo(.95,-.2,.87,.67,-.12,.86);
        shape.bezierCurveTo(-1.16,1.14,-1.16,-.17,-2.5,-.15);
        shape.closePath();
        // Thick sculptural arch with generous beveled chamfer
        const geo=new T.ExtrudeGeometry(shape,{depth:.36,bevelEnabled:true,bevelSegments:6,steps:1,bevelSize:.08,bevelThickness:.08,curveSegments:40});
        // Glazed ceramic with subtle warm ivory (Web), forest hint (IM), and cyan tint (Scheduler)
        const material=new T.MeshPhysicalMaterial({
          color:baseColors[i],
          roughness:.18,
          metalness:0,
          clearcoat:.95,
          clearcoatRoughness:.08,
          reflectivity:.88,
        });
        const mesh=new T.Mesh(geo,material); mesh.position.set((i-1)*.14,-.3,(i-1)*.86);
        meshes.push(mesh); group.add(mesh);
        // The light path samples the SAME two Bezier segments as the ceramic top.
        const first=new T.CubicBezierCurve3(new T.Vector3(-2.5,0,0),new T.Vector3(-1.3,.02,0),new T.Vector3(-1.4,1.35,0),new T.Vector3(-.1,1.04,0));
        const second=new T.CubicBezierCurve3(new T.Vector3(-.1,1.04,0),new T.Vector3(1,.8,0),new T.Vector3(1.15,-.05,0),new T.Vector3(2.45,.17,0));
        const points=[...first.getPoints(36),...second.getPoints(36).slice(1)].map(p=>new T.Vector3(p.x+mesh.position.x,p.y+mesh.position.y+.006,mesh.position.z+.18));
        const path=new T.CatmullRomCurve3(points); paths.push(path);
        // Embedded groove with crisp ceramic trench presence
        const trace=new T.Mesh(new T.TubeGeometry(path,100,.016,8,false),new T.MeshStandardMaterial({
          color:traceColors[i],
          emissive:traceColors[i],
          emissiveIntensity:.2,
          transparent:true,
          opacity:.22,
        }));
        traces.push(trace); group.add(trace);
      }
      dot=new T.Mesh(new T.SphereGeometry(.036,16,12),new T.MeshBasicMaterial({color:pulseColors[0]}));
      dot.visible=false; group.add(dot);
      resize(); select(selected); paint(); root.dataset.renderState='ready';
    } catch(error) { failed=true; release(); root.dataset.renderState='fallback'; console.warn('[tidal] Static artwork fallback',error); }
    finally { loading=false; }
  };
  function select(index:number) {
    selected=Math.max(0,Math.min(2,index));
    traces.forEach((trace,i)=>{
      const isCur=i===selected;
      trace.material.opacity=isCur ? .92 : .18;
      trace.material.emissiveIntensity=isCur ? .85 : .15;
    });
    meshes.forEach((mesh,i)=>{
      const isCur=i===selected;
      mesh.material.roughness=isCur ? .14 : .24;
      mesh.material.clearcoat=isCur ? 1.0 : .85;
    });
    if(dot) {
      (dot.material as Three.MeshBasicMaterial).color.setHex(pulseColors[selected]);
    }
    if(reduced) { paint(); return; }
    pulseStart=performance.now(); wake();
  }
  const unsub=subscribeMotion(m=>{reduced=m.isReduced;if(controls)controls.enabled=!reduced&&(matchMedia('(pointer:fine)').matches||touchViewing);if(reduced)reset();else if(visible){void load();wake();}});
  const observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;if(visible){void load();wake();}else stop();}); observer.observe(viewport);
  const ro=new ResizeObserver(resize); ro.observe(viewport);
  viewport.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse'||reduced||dragging||dragged)return;
    const r=viewport.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*1.22;ty=((e.clientY-r.top)/r.height-.5)*.70;wake();
  },{passive:true,signal:abort.signal});
  for(const event of ['pointerleave','pointercancel'])viewport.addEventListener(event,()=>{if(!dragged){tx=ty=0;}wake();},{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else wake();},{signal:abort.signal});
  window.addEventListener('blur',()=>{dragging=false;stop();},{signal:abort.signal});
  root.querySelector('[data-reset-view]')?.addEventListener('click',()=>{reset();wake();},{signal:abort.signal});
  root.querySelector('[data-touch-view]')?.addEventListener('click',e=>{
    touchViewing=!touchViewing;if(controls)controls.enabled=!reduced&&(touchViewing||matchMedia('(pointer:fine)').matches);
    canvas.style.touchAction=touchViewing?'none':'pan-y pinch-zoom';
    const button=e.currentTarget as HTMLButtonElement;button.setAttribute('aria-pressed',String(touchViewing));button.textContent=touchViewing?'结束三维查看':'三维查看';
  },{signal:abort.signal});
  canvas.addEventListener('pointerdown',e=>{if(controls)controls.enabled=!reduced&&(e.pointerType!=='touch'||touchViewing);},{capture:true,signal:abort.signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();root.dataset.renderState='fallback';},{signal:abort.signal});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;reset();root.dataset.renderState='ready';},{signal:abort.signal});
  const dispose=()=>{if(disposed)return;disposed=true;stop();abort.abort();observer.disconnect();ro.disconnect();unsub();release();};
  window.addEventListener('pagehide',e=>{if(e.persisted)reset();else dispose();},{signal:abort.signal});
  window.addEventListener('pageshow',wake,{signal:abort.signal});
  document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
  return {select,dispose};
}
