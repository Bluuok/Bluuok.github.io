import {PointerTrail,advanceDust} from './home-flow';
import {sceneReadiness} from '../../lib/scene-readiness';
import { sparkStory, sparkParticles, sparkPosition } from '../first-spark/story';
import { pointerConfig, pointerInfluence } from './interaction';
import { resolveParticleFieldConfig, type NormalizedPoint, type ParticleFieldOptions } from './config';
import { createParticleRenderer, type RenderParticle } from './renderer';
import { createShapeTargets, type ShapeTarget } from './targets';
import { subscribeMotion, type MotionState } from '../../lib/motion';

interface Particle extends RenderParticle {
  homeX: number; homeY: number; phase: number;
  orbitAngle: number; orbitRadius: number; twinkle: number; gatherDelay: number;
  shapeTarget?: ShapeTarget; narrativeAlpha?:number;
}

export interface ParticleSceneInput {
  progress?: number;
  focus?: NormalizedPoint | null;
}

export interface ParticleFieldMount {
  (): void;
  setScene(scene: ParticleSceneInput): void;
  resetScene(): void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function mountParticleField(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  options: ParticleFieldOptions = {},
): ParticleFieldMount {
  const narrative=host.dataset.particleScene==='first-spark';
  const config = resolveParticleFieldConfig(narrative?{...options,phases:{shapeEnd:sparkStory.approach,gatherEnd:sparkStory.contact,coreEnd:sparkStory.holdEnd,fadeEnd:sparkStory.fadeEnd},gatherRadius:sparkParticles.coreRadius}:options);
  let seed:number=sparkParticles.seed;
  const random=()=>{if(!narrative)return Math.random();seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const between=(min:number,max:number)=>min+random()*(max-min);
  const renderer = config.enabled ? createParticleRenderer(canvas, config.colors, config.bloomScale) : null;
  const perf=sceneReadiness(narrative?'spark-particles':'home-particles');perf.mark('request');const trail=new PointerTrail();let hasPainted=false;let renderCount=0;
  let cleaned = false;
  let sceneProgress = 0;
  let sceneFocus: NormalizedPoint | null = null;

  const noop = (() => undefined) as ParticleFieldMount;
  noop.setScene = () => undefined;
  noop.resetScene = () => undefined;
  if (!renderer) {
    host.dataset.particleState = 'disabled';
    host.dataset.particleCount = '0';
    return noop;
  }

  const eventSource = host.parentElement ?? host;
  host.style.setProperty('--particle-shape-x', `${config.shape.center.x * 100}%`);
  host.style.setProperty('--particle-shape-y', `${config.shape.center.y * 100}%`);

  let reducedMotion = false;
  let visible = true;
  let pageVisible = !document.hidden;
  let running = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let particles: Particle[] = [];
  let pointer: { x: number; y: number; type: string } | null = null;
  let touchActiveUntil = 0;
  let pointerFocus: { x: number; y: number } | null = null;
  let previousPointer: { x: number; y: number } | null = null;
  let shapeMix = 0;
  let shapeReported = false;
  let phaseReported = '';
  let lastTime = performance.now();

  const reportPhase = (phase: string) => {
    if (phase === phaseReported) return;
    phaseReported = phase;
    host.dataset.particlePhase = phase;
  };
  const reportShape = (active: boolean) => {
    if (active === shapeReported) return;
    shapeReported = active;
    host.dataset.shapeActive = String(active);
  };

  const particleCount = () => {
    const area = width * height;
    const mobile = width <= 640;
    const baseline = mobile ? config.mobileCount : config.count;
    const reference = mobile ? 390 * 844 : config.referenceArea;
    const adaptive = baseline * Math.sqrt(Math.max(.35, area / reference));
    return Math.min(config.maxParticles, Math.max(0, Math.round(adaptive * config.density)));
  };

  const makeHome = (index: number) => {
    const region = config.region;
    if (index % 5 < 2) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(-2 * Math.log(Math.max(.0001, random())));
      return {
        x: Math.min(region.x + region.width, Math.max(region.x,
          config.shape.center.x + Math.cos(angle) * radius * .2)) * width,
        y: Math.min(region.y + region.height, Math.max(region.y,
          config.shape.center.y + Math.sin(angle) * radius * .105)) * height,
      };
    }
    return {
      x: (region.x + random() * region.width) * width,
      y: (region.y + random() * region.height) * height,
    };
  };

  const rebuildParticles = () => {
    seed=sparkParticles.seed;
    lastNarrativeProgress = -1;
    const count = particleCount();
    const shapeCount = Math.round(count * config.shape.particleRatio);
    const shapeScale = Math.min(1.15, Math.max(.68, height / 1000));
    host.style.setProperty('--particle-shape-size', `${config.shape.size * shapeScale}px`);
    const targets = createShapeTargets(shapeCount, { ...config.shape, size: config.shape.size * shapeScale });
    particles = Array.from({ length: count }, (_, index) => {
      const home = makeHome(index);
      const depth = random();
      return {
        x: home.x,
        y: home.y,
        homeX: home.x,
        homeY: home.y,
        vx: 0,
        vy: 0,
        radius: between(config.minRadius, config.maxRadius),
        depth,
        colorIndex: Math.floor(random() * config.colors.length),
        alpha: .2 + depth * .7,
        phase: random() * Math.PI * 2,
        orbitAngle: random() * Math.PI * 2,
        orbitRadius: Math.sqrt(-2 * Math.log(Math.max(.0001, random()))) * config.gatherRadius * .5 / .35,
        gatherDelay: random() * .28,
        twinkle: between(.45, 1.35),
        streak: index % 29 === 0,
        shapeTarget: targets[index],
      };
    });
    host.dataset.particleCount = String(count);
  };

  const render = (time = performance.now()) => {
    const { shapeEnd, gatherEnd, coreEnd, fadeEnd } = config.phases;
    const fade = sceneProgress <= coreEnd ? 1 : 1 - smooth((sceneProgress - coreEnd) / Math.max(.001, fadeEnd - coreEnd));
    const bloom = sceneProgress < shapeEnd ? shapeMix * .45 : smooth((sceneProgress - (gatherEnd - .2)) / .2);
    for (const particle of particles) {
      particle.alpha = fade * (particle.narrativeAlpha ?? 1) * (.55 + particle.depth * .4) *
        (.88 + Math.sin(time * .0012 * particle.twinkle + particle.phase) * .12);
    }
    renderer.render(particles, config.opacity, bloom);renderCount++;if(!hasPainted){hasPainted=true;perf.mark('first-render');perf.mark('interactive');}
  };

  const resize = () => {
    const bounds = host.getBoundingClientRect();
    const nextWidth = Math.max(1, bounds.width);
    const nextHeight = Math.max(1, bounds.height);
    if (Math.abs(nextWidth - width) < .5 && Math.abs(nextHeight - height) < .5 && particles.length) return;
    width = nextWidth;
    height = nextHeight;
    renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 1.5));
    rebuildParticles();
    render();
  };

  const pointerStrength = (time: number) => {
    if (sceneProgress >= config.phases.shapeEnd || reducedMotion || !pointer) return 0;
    if (pointer.type === 'touch' && time > touchActiveUntil) {
      pointer = null;
      host.dataset.pointerActive = 'false';
      return 0;
    }
    return 1;
  };

  let lastNarrativeProgress = -1, lastNarrativeFocusX = -1, lastNarrativeFocusY = -1, lastNarrativeWidth = -1, lastNarrativeHeight = -1;
  const updateNarrative=()=>{
    const focus=sceneFocus??{x:.5,y:.63};
    if(sceneProgress === lastNarrativeProgress && focus.x === lastNarrativeFocusX && focus.y === lastNarrativeFocusY && width === lastNarrativeWidth && height === lastNarrativeHeight) return;
    lastNarrativeProgress = sceneProgress; lastNarrativeFocusX = focus.x; lastNarrativeFocusY = focus.y; lastNarrativeWidth = width; lastNarrativeHeight = height;
    const size = { width, height }, count = particles.length;
    const invWidth = 1 / width, invHeight = 1 / height;
    for (let i = 0; i < count; i++) {
      const p = particles[i]!;
      const home = { x: p.homeX * invWidth, y: p.homeY * invHeight };
      const pos = sparkPosition(i, home, focus, size, sceneProgress);
      p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0; p.narrativeAlpha = pos.alpha;
      if (i % 23 === 0) {
        const next = sparkPosition(i, home, focus, size, sceneProgress + .003);
        p.vx = next.x - pos.x; p.vy = next.y - pos.y; p.streak = true;
      }
    }
  };
  const update = (time: number) => {
    if(narrative){updateNarrative();render(time);return;}
    const seconds=Math.min(.05,Math.max(0,(time-lastTime)/1000));
    if(pointerConfig.mode!=='shape'){
      const segments=trail.consume(time);for(let i=0;i<particles.length;i++){const p=particles[i];p.narrativeAlpha=advanceDust(p,seconds,time/1000,width,height,segments);p.streak=i%29===0&&Math.hypot(p.vx,p.vy)>65;}
      lastTime=time;render(time);return;
    }
    const delta = Math.min(2, (time - lastTime) / 16.667);
    lastTime = time;
    const wantedShape = pointerStrength(time);
    shapeMix += (wantedShape - shapeMix) * (wantedShape > shapeMix ? .085 : .035) * delta;
    reportShape(shapeMix > .16);
    pointerFocus = pointer ? {x:pointer.x,y:pointer.y} : null;
    if (!pointerFocus) previousPointer = null;

    const gathering = smooth((sceneProgress - config.phases.shapeEnd) /
      Math.max(.001, config.phases.gatherEnd - config.phases.shapeEnd));
    const focus = sceneFocus ?? { x: .5, y: .63 };
    const focusX = focus.x * width;
    const focusY = focus.y * height;
    const force = config.returnForce + shapeMix * config.shapeForce + gathering * config.gatherForce;

    for (const particle of particles) {
      particle.phase += (.003 + particle.depth * .004) * delta;
      particle.orbitAngle += (.0025 + particle.depth * .0035) * delta;
      let targetX = particle.homeX + Math.cos(particle.phase) * config.drift * 34;
      let targetY = particle.homeY + Math.sin(particle.phase * .83) * config.drift * 28;
      if (pointerConfig.mode === 'shape' && particle.shapeTarget && pointerFocus && shapeMix > .001) {
        targetX += (pointerFocus.x + particle.shapeTarget.x - targetX) * shapeMix;
        targetY += (pointerFocus.y + particle.shapeTarget.y - targetY) * shapeMix;
      } else if (pointerFocus && wantedShape > 0) {
        const influence = pointerInfluence(particle.x, particle.y, pointerFocus.x, pointerFocus.y, previousPointer ?? pointerFocus);
        particle.vx += influence.impulseX + ((pointerFocus.x-particle.x)*influence.pull*.018 + influence.swirlX)*delta;
        particle.vy += influence.impulseY + ((pointerFocus.y-particle.y)*influence.pull*.018 + influence.swirlY)*delta;
      }

      if (gathering > .001) {
        const localGather = smooth((gathering - particle.gatherDelay) / (1 - particle.gatherDelay));
        const orbit = particle.orbitRadius * (1 - localGather * .65);
        const angle = localGather * (3.5 + particle.depth * 2);
        const homeX = targetX - focusX, homeY = targetY - focusY;
        const rotatedX = homeX * Math.cos(angle) - homeY * Math.sin(angle);
        const rotatedY = homeX * Math.sin(angle) + homeY * Math.cos(angle);
        targetX = focusX + rotatedX * (1 - localGather) + Math.cos(particle.orbitAngle) * orbit * localGather;
        targetY = focusY + rotatedY * (1 - localGather) + Math.sin(particle.orbitAngle) * orbit * localGather * .72;
      }
      particle.vx += (targetX - particle.x) * force * delta;
      particle.vy += (targetY - particle.y) * force * delta;
      particle.vx *= Math.pow(config.friction, delta);
      particle.vy *= Math.pow(config.friction, delta);
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
    previousPointer = pointerFocus ? {...pointerFocus} : null;
    render(time);
  };

  const currentPhase = () => {
    if (reducedMotion) return 'static';
    if (sceneProgress < config.phases.shapeEnd) return 'ambient';
    if (sceneProgress < config.phases.gatherEnd) return 'gather';
    if (sceneProgress < config.phases.coreEnd) return 'core';
    if (sceneProgress < config.phases.fadeEnd) return 'fade';
    return 'hidden';
  };

  const tick = (time: number) => {
    if (!running) return;
    update(time);
    frame = requestAnimationFrame(tick);
  };

  const syncAnimation = () => {
    const shouldRun = visible && pageVisible && !reducedMotion && !cleaned &&
      sceneProgress < config.phases.fadeEnd;
    reportPhase(currentPhase());
    host.dataset.particleState = shouldRun ? 'running' : reducedMotion ? 'static' : 'paused';
    if (shouldRun === running) {
      if (!shouldRun) render();
      return;
    }
    running = shouldRun;
    cancelAnimationFrame(frame);
    frame = 0;
    if (running) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    } else {
      render();
    }
  };

  const setPointer = (event: PointerEvent) => {
    if (narrative || reducedMotion || !pageVisible || !visible) return;
    const bounds = host.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
      pointer = null;
      host.dataset.pointerActive = 'false';
      return;
    }
    pointer = { x, y, type: event.pointerType };
    const samples=event.getCoalescedEvents?.()??[];
    for(const sample of samples.length?samples:[event])trail.add({x:sample.clientX-bounds.left,y:sample.clientY-bounds.top,t:sample.timeStamp});
    if (event.pointerType === 'touch') touchActiveUntil = performance.now() + 1600;
    host.dataset.pointerActive = 'true';
  };
  const clearPointer = (event?: PointerEvent) => {
    if (event?.type !== 'pointercancel' && event?.pointerType === 'touch' && performance.now() < touchActiveUntil) return;
    trail.clear();pointer = null;
    previousPointer = null;
    host.dataset.pointerActive = 'false';
  };
  const handleVisibility = () => { trail.clear();pageVisible = !document.hidden; syncAnimation(); };
  const handlePageHide = () => { trail.clear();pageVisible = false; syncAnimation(); };
  const handlePageShow = () => { pageVisible = !document.hidden; syncAnimation(); };

  // Subscribe to unified motion controller
  const unsubscribeMotion = subscribeMotion((m: MotionState) => {
    reducedMotion = m.isReduced;
    if (reducedMotion) {
      lastNarrativeProgress = -1;
      trail.clear();
      pointer = null;
      pointerFocus = null;
      previousPointer = null;
      sceneProgress = 0;
      sceneFocus = null;
      shapeMix = 0;
      host.dataset.pointerActive = 'false';
      for (const particle of particles) {
        particle.x = particle.homeX;
        particle.y = particle.homeY;
        particle.vx = 0;
        particle.vy = 0;
      }
      reportShape(false);
    }
    syncAnimation();
  });

  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    syncAnimation();
  });
  resizeObserver.observe(host);
  intersectionObserver.observe(host);
  eventSource.addEventListener('pointermove', setPointer, { passive: true });
  eventSource.addEventListener('pointerdown', setPointer, { passive: true });
  eventSource.addEventListener('pointerleave', clearPointer);
  eventSource.addEventListener('pointerup', clearPointer);
  eventSource.addEventListener('pointercancel', clearPointer);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
  host.dataset.pointerActive = 'false';
  host.dataset.shapeActive = 'false';
  if(new URLSearchParams(location.search).has('scenePerf'))(host as any).particleSnapshot=()=>({progress:sceneProgress,renderCount,particles:particles.map((p,i)=>({id:i,x:p.x,y:p.y,vx:p.vx,vy:p.vy,alpha:p.alpha,homeX:p.homeX,homeY:p.homeY}))});
  resize();
  syncAnimation();

  const cleanup = (() => {
    if (cleaned) return;
    cleaned = true;
    running = false;
    cancelAnimationFrame(frame);
    unsubscribeMotion();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    eventSource.removeEventListener('pointermove', setPointer);
    eventSource.removeEventListener('pointerdown', setPointer);
    eventSource.removeEventListener('pointerleave', clearPointer);
    eventSource.removeEventListener('pointerup', clearPointer);
    eventSource.removeEventListener('pointercancel', clearPointer);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    renderer.clear();
    host.dataset.particleState = 'disconnected';
  }) as ParticleFieldMount;
  cleanup.setScene = scene => {
    if (cleaned || reducedMotion) return;
    const wasHidden = sceneProgress >= config.phases.fadeEnd;
    if (scene.progress !== undefined && Number.isFinite(scene.progress)) sceneProgress = clamp01(scene.progress);
    if (scene.focus === null) sceneFocus = null;
    else if (scene.focus && Number.isFinite(scene.focus.x) && Number.isFinite(scene.focus.y)) {
      sceneFocus = { x: clamp01(scene.focus.x), y: clamp01(scene.focus.y) };
    }
    // Progress is consumed by the single RAF; callbacks never draw.
    reportPhase(currentPhase());
    if (wasHidden !== (sceneProgress >= config.phases.fadeEnd)) {
      if(narrative&&sceneProgress>=config.phases.fadeEnd){cancelAnimationFrame(frame);running=false;frame=requestAnimationFrame(()=>{frame=0;updateNarrative();render();});}
      else syncAnimation();
    }
  };
  cleanup.resetScene = () => {
    const wasHidden = sceneProgress >= config.phases.fadeEnd;
    sceneProgress = 0;
    sceneFocus = null;
    reportPhase(currentPhase());
    if (wasHidden) syncAnimation();
  };
  return cleanup;
}
