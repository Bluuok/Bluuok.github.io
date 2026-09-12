import { resolveParticleFieldConfig, type NormalizedPoint, type ParticleFieldOptions } from './config';
import { createParticleRenderer, type RenderParticle } from './renderer';
import { createShapeTargets, type ShapeTarget } from './targets';

interface Particle extends RenderParticle {
  homeX: number; homeY: number; phase: number;
  orbitAngle: number; orbitRadius: number; twinkle: number; gatherDelay: number;
  shapeTarget?: ShapeTarget;
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
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export function mountParticleField(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  options: ParticleFieldOptions = {},
): ParticleFieldMount {
  const config = resolveParticleFieldConfig(options);
  const renderer = config.enabled ? createParticleRenderer(canvas, config.colors, config.bloomScale) : null;
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
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  let visible = true;
  let pageVisible = !document.hidden;
  let running = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let particles: Particle[] = [];
  let pointer: { x: number; y: number; type: string } | null = null;
  let touchActiveUntil = 0;
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
    // A broad field plus a denser lower-centre cloud, kept behind the main title.
    if (index % 5 < 2) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(-2 * Math.log(Math.max(.0001, Math.random())));
      return {
        x: Math.min(region.x + region.width, Math.max(region.x,
          config.shape.center.x + Math.cos(angle) * radius * .2)) * width,
        y: Math.min(region.y + region.height, Math.max(region.y,
          config.shape.center.y + Math.sin(angle) * radius * .105)) * height,
      };
    }
    return {
      x: (region.x + Math.random() * region.width) * width,
      y: (region.y + Math.random() * region.height) * height,
    };
  };

  const rebuildParticles = () => {
    const count = particleCount();
    const shapeCount = Math.round(count * config.shape.particleRatio);
    const shapeScale = Math.min(1.15, Math.max(.68, height / 1000));
    host.style.setProperty('--particle-shape-size', `${config.shape.size * shapeScale}px`);
    const targets = createShapeTargets(shapeCount, { ...config.shape, size: config.shape.size * shapeScale });
    particles = Array.from({ length: count }, (_, index) => {
      const home = makeHome(index);
      const depth = Math.random();
      return {
        x: home.x,
        y: home.y,
        homeX: home.x,
        homeY: home.y,
        vx: 0,
        vy: 0,
        radius: randomBetween(config.minRadius, config.maxRadius),
        depth,
        colorIndex: Math.floor(Math.random() * config.colors.length),
        alpha: .2 + depth * .7,
        phase: Math.random() * Math.PI * 2,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: Math.sqrt(-2 * Math.log(Math.max(.0001, Math.random()))) * config.gatherRadius * .5 / .35,
        gatherDelay: Math.random() * .28,
        twinkle: randomBetween(.45, 1.35),
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
      particle.alpha = fade * (.26 + particle.depth * .5) *
        (.88 + Math.sin(time * .0012 * particle.twinkle + particle.phase) * .12);
    }
    renderer.render(particles, config.opacity, bloom);
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
    const centerX = config.shape.center.x * width;
    const centerY = config.shape.center.y * height;
    const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY);
    const normalized = distance / config.shape.triggerRadius;
    return normalized <= .65 ? 1 : smooth((1 - normalized) / .35);
  };

  const update = (time: number) => {
    const delta = Math.min(2, (time - lastTime) / 16.667);
    lastTime = time;
    const wantedShape = pointerStrength(time);
    shapeMix += (wantedShape - shapeMix) * (wantedShape > shapeMix ? .085 : .035) * delta;
    reportShape(shapeMix > .16);

    const gathering = smooth((sceneProgress - config.phases.shapeEnd) /
      Math.max(.001, config.phases.gatherEnd - config.phases.shapeEnd));
    const focus = sceneFocus ?? { x: .5, y: .63 };
    const focusX = focus.x * width;
    const focusY = focus.y * height;
    const shapeX = config.shape.center.x * width;
    const shapeY = config.shape.center.y * height;
    const force = config.returnForce + shapeMix * config.shapeForce + gathering * config.gatherForce;

    for (const particle of particles) {
      particle.phase += (.003 + particle.depth * .004) * delta;
      particle.orbitAngle += (.0025 + particle.depth * .0035) * delta;
      let targetX = particle.homeX + Math.cos(particle.phase) * config.drift * 34;
      let targetY = particle.homeY + Math.sin(particle.phase * .83) * config.drift * 28;
      if (particle.shapeTarget && shapeMix > .001) {
        const shapedX = shapeX + particle.shapeTarget.x;
        const shapedY = shapeY + particle.shapeTarget.y;
        targetX += (shapedX - targetX) * shapeMix;
        targetY += (shapedY - targetY) * shapeMix;
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
    const bounds = host.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;
    pointer = { x, y, type: event.pointerType };
    if (event.pointerType === 'touch') touchActiveUntil = performance.now() + 1600;
    host.dataset.pointerActive = 'true';
  };
  const clearPointer = (event?: PointerEvent) => {
    if (event?.pointerType === 'touch' && performance.now() < touchActiveUntil) return;
    pointer = null;
    host.dataset.pointerActive = 'false';
  };
  const handleVisibility = () => { pageVisible = !document.hidden; syncAnimation(); };
  const handleMotion = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
    pointer = null;
    shapeMix = 0;
    reportShape(false);
    syncAnimation();
  };

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
  motionQuery.addEventListener('change', handleMotion);
  host.dataset.pointerActive = 'false';
  host.dataset.shapeActive = 'false';
  resize();
  syncAnimation();

  const cleanup = (() => {
    if (cleaned) return;
    cleaned = true;
    running = false;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    eventSource.removeEventListener('pointermove', setPointer);
    eventSource.removeEventListener('pointerdown', setPointer);
    eventSource.removeEventListener('pointerleave', clearPointer);
    eventSource.removeEventListener('pointerup', clearPointer);
    eventSource.removeEventListener('pointercancel', clearPointer);
    document.removeEventListener('visibilitychange', handleVisibility);
    motionQuery.removeEventListener('change', handleMotion);
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
    reportPhase(currentPhase());
    if (wasHidden !== (sceneProgress >= config.phases.fadeEnd)) syncAnimation();
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
