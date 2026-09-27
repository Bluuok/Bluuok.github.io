import type * as Three from 'three';
import { subscribeMotion } from '../../lib/motion';
import { sceneReadiness } from '../../lib/scene-readiness';
import { BadgeMotion, suspension } from './motion';
import { createBadgeObjects } from './appearance';

const importModules = () => Promise.all([
  import('three'),
  import('three/addons/environments/RoomEnvironment.js'),
  import('three/addons/geometries/RoundedBoxGeometry.js'),
]);
let modules: ReturnType<typeof importModules> | undefined;

type Press = { id: number; x: number; y: number; touch: boolean; dragging: boolean; offset: Three.Vector3 };

function loadPortrait(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const portrait = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      portrait.onload = portrait.onerror = null;
      if (error) { portrait.src = ''; reject(error); } else resolve(portrait);
    };
    const abort = () => finish(new Error('Portrait loading canceled'));
    const timeout = window.setTimeout(() => finish(new Error('Portrait loading timed out')), 12000);
    portrait.onload = () => finish();
    portrait.onerror = () => finish(new Error('Portrait could not be loaded'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else portrait.src = src;
  });
}

export class BadgeController {
  private readonly abort = new AbortController();
  private readonly canvas: HTMLCanvasElement;
  private readonly motion = new BadgeMotion();
  private readonly perf = sceneReadiness('home');
  private readonly buttons: HTMLButtonElement[];
  private T: typeof Three | null = null;
  private renderer: Three.WebGLRenderer | null = null;
  private scene: Three.Scene | null = null;
  private camera: Three.PerspectiveCamera | null = null;
  private environment: Three.WebGLRenderTarget | null = null;
  private objects: ReturnType<typeof createBadgeObjects> | null = null;
  private ray: Three.Raycaster | null = null;
  private pointer: Three.Vector2 | null = null;
  private dragPlane: Three.Plane | null = null;
  private dragPoint: Three.Vector3 | null = null;
  private press: Press | null = null;
  private pendingPointer: PointerEvent | null = null;
  private previousHover: { x: number; time: number } | null = null;
  private visibility: IntersectionObserver | null = null;
  private preparation: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private unsubscribe: (() => void) | null = null;
  private loadingAbort: AbortController | null = null;
  private near = false;
  private visible = false;
  private reduced = false;
  private frozen = false;
  private disposed = false;
  private loading = false;
  private ready = false;
  private failed = false;
  private lost = false;
  private epoch = 0;
  private frame = 0;
  private last = 0;
  private nextNudge = 1;

  constructor(private readonly container: HTMLElement) {
    this.canvas = container.querySelector<HTMLCanvasElement>('canvas')!;
    this.buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
  }

  init() {
    const signal = this.abort.signal;
    this.unsubscribe = subscribeMotion(state => {
      this.reduced = state.isReduced;
      if (this.reduced) { this.clearPointer(); this.motion.reset(); }
      this.sync();
    });
    this.preparation = new IntersectionObserver(([entry]) => {
      this.near = !!entry?.isIntersecting; this.sync();
    }, { rootMargin: '350px 0px' });
    this.preparation.observe(this.container);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = !!entry?.isIntersecting; this.sync();
    });
    this.visibility.observe(this.container);
    this.resizeObserver = new ResizeObserver(() => { this.clearPointer(); this.resize(); });
    this.resizeObserver.observe(this.container);
    this.canvas.addEventListener('pointermove', event => { this.pendingPointer = event; }, { passive: true, signal });
    this.canvas.addEventListener('pointerdown', event => this.down(event), { signal });
    this.canvas.addEventListener('pointerup', event => {
      if (event.pointerId !== this.press?.id) return;
      if (this.pendingPointer) this.move(this.pendingPointer);
      if (this.press?.touch && !this.press.dragging && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) < 10) this.motion.nudge(1, 0.65);
      this.clearPointer();
    }, { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.press?.dragging) this.clearPointer(); }, { signal });
    for (const type of ['pointercancel', 'lostpointercapture']) this.canvas.addEventListener(type, () => this.clearPointer(), { signal });
    window.addEventListener('blur', () => this.clearPointer(), { signal });
    window.addEventListener('scroll', () => { if (!this.press?.dragging) this.clearPointer(); }, { passive: true, signal });
    document.addEventListener('visibilitychange', () => { this.clearPointer(); this.sync(); }, { signal });
    window.addEventListener('pagehide', event => {
      if (event.persisted) { this.frozen = true; this.sync(); } else this.dispose();
    }, { signal });
    window.addEventListener('pageshow', () => { this.frozen = false; this.sync(); }, { signal });
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.lost = true; this.epoch++; this.loading = false;
      this.loadingAbort?.abort(); this.stop(); this.clearPointer(); this.releaseGraphics(); this.setState('fallback');
    }, { signal });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false; this.releaseGraphics(); this.failed = false; this.sync();
    }, { signal });
    this.container.querySelector('[data-badge-nudge]')?.addEventListener('click', () => {
      this.motion.nudge(this.nextNudge); this.nextNudge *= -1;
    }, { signal });
    this.container.querySelector('[data-badge-nudge]')?.addEventListener('keydown', event => {
      const key = (event as KeyboardEvent).key;
      if (key === 'ArrowLeft' || key === 'ArrowRight') { event.preventDefault(); this.motion.nudge(key === 'ArrowLeft' ? -1 : 1); }
    }, { signal });
    this.container.querySelector('[data-badge-reset]')?.addEventListener('click', () => {
      this.clearPointer(); this.motion.reset(); this.paint();
    }, { signal });
  }

  private setState(state: string) {
    this.container.dataset.badgeState = state;
    for (const button of this.buttons) button.disabled = state !== 'running';
  }

  private sync() {
    if (this.disposed || this.lost) return;
    const active = this.visible && !this.reduced && !document.hidden && !this.frozen;
    if (!active) { this.stop(); this.clearPointer(); }
    if (!this.ready) {
      this.setState(this.reduced ? 'static' : this.failed ? 'fallback' : 'idle');
      if ((this.near || this.visible) && !this.reduced && !document.hidden && !this.frozen && !this.loading && !this.failed) void this.load();
      return;
    }
    this.setState(this.reduced ? 'static' : active ? 'running' : 'paused');
    if (active && !this.frame) { this.last = performance.now(); this.frame = requestAnimationFrame(this.tick); }
    else if (!active && this.reduced) this.paint();
  }

  private async load() {
    const token = ++this.epoch;
    this.loading = true; this.loadingAbort = new AbortController();
    this.perf.mark('request');
    try {
      const [[T, { RoomEnvironment }, { RoundedBoxGeometry }], portrait] = await Promise.all([
        modules ??= importModules(),
        loadPortrait(this.container.dataset.portrait!, this.loadingAbort.signal),
      ]);
      if (this.disposed || this.lost || token !== this.epoch) return;
      this.T = T;
      this.perf.mark('module');
      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0, 0);
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.96;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(32, 1, 0.1, 40);
      this.scene.add(new T.HemisphereLight(0xffffff, 0xb2bfd3, 0.65));
      const key = new T.DirectionalLight(0xffffff, 1.15); key.position.set(-3, 5, 5); this.scene.add(key);
      const fill = new T.DirectionalLight(0xd1deff, 0.3); fill.position.set(4, 1, 2); this.scene.add(fill);
      const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
      try { this.environment = pmrem.fromScene(room, 0.06); this.scene.environment = this.environment.texture; }
      finally { room.dispose(); pmrem.dispose(); }
      this.objects = createBadgeObjects(T, RoundedBoxGeometry, portrait, {
        name: this.container.dataset.name!, role: this.container.dataset.role!,
      });
      this.scene.add(this.objects.root);
      this.perf.mark('geometry');
      this.ray = new T.Raycaster(); this.pointer = new T.Vector2(); this.dragPoint = new T.Vector3();
      this.resize(); this.objects.update(this.motion);
      await this.renderer.compileAsync(this.scene, this.camera);
      if (this.disposed || this.lost || token !== this.epoch) return;
      this.perf.mark('shader');
      this.ready = true; this.paint(); this.perf.mark('first-render'); this.perf.mark('interactive');
    } catch (error) {
      if (!this.disposed && !this.lost && token === this.epoch) {
        this.failed = true; this.releaseGraphics();
        console.warn('[badge] Showing the static personal pass.', error);
      }
    } finally {
      if (token === this.epoch) { this.loading = false; this.sync(); }
    }
  }

  private resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const compact = width < 480;
    this.motion.maxAngle = compact ? 0.23 : suspension.maxAngle;
    const viewHeight = compact ? Math.max(7, 5.4 / this.camera.aspect) : Math.max(7.35, 7.1 / this.camera.aspect);
    const distance = viewHeight / (2 * Math.tan(32 * Math.PI / 360));
    const centerY = compact ? 0.1 : 0.62;
    this.camera.position.set(0, centerY, distance); this.camera.lookAt(0, centerY, 0);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(); this.paint();
  }

  private locate(event: PointerEvent) {
    if (!this.ray || !this.pointer || !this.camera) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    return true;
  }

  private hit() {
    if (!this.ray || !this.objects) return null;
    this.objects.root.updateMatrixWorld(true);
    return this.ray.intersectObject(this.objects.hitMesh, false)[0] ?? null;
  }

  private down(event: PointerEvent) {
    if (event.button !== 0 || this.reduced || !this.ready || this.press || !this.T || !this.objects || !this.locate(event)) return;
    const hit = this.hit(); if (!hit) return;
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', dragging: false, offset: hit.point.clone().sub(this.objects.badge.position) };
    this.dragPlane = new this.T.Plane().setFromNormalAndCoplanarPoint(this.camera!.getWorldDirection(new this.T.Vector3()), hit.point);
    if (!this.press.touch) this.beginDrag();
  }

  private beginDrag() {
    if (!this.press) return;
    this.press.dragging = true; this.motion.grab(this.motion.x, this.motion.y);
    this.canvas.setPointerCapture(this.press.id); this.container.dataset.grabbed = 'true';
  }

  private move(event: PointerEvent) {
    if (this.reduced || !this.ready || !this.locate(event)) return;
    const press = this.press;
    if (press && press.id === event.pointerId) {
      if (press.touch && !press.dragging) {
        const dx = event.clientX - press.x, dy = event.clientY - press.y;
        // Native vertical scrolling and pinch zoom retain priority on touchscreens.
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { this.clearPointer(); return; }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) this.beginDrag();
      }
      if (press.dragging && this.dragPlane && this.dragPoint) {
        const point = this.ray!.ray.intersectPlane(this.dragPlane, this.dragPoint);
        if (point) this.motion.move(point.x - press.offset.x, point.y - press.offset.y);
      }
      return;
    }
    if (event.pointerType === 'touch') return;
    const hit = this.hit(); this.container.dataset.pointerHit = String(!!hit);
    if (hit) {
      const now = performance.now(), previous = this.previousHover;
      if (previous && now - previous.time > 50) {
        const dx = event.clientX - previous.x;
        this.motion.nudge(Math.sign(dx), Math.min(0.1, Math.abs(dx) / 500));
        this.previousHover = { x: event.clientX, time: now };
      } else if (!previous) this.previousHover = { x: event.clientX, time: now };
    } else this.previousHover = null;
  }

  private clearPointer() {
    const id = this.press?.id;
    this.press = null; this.pendingPointer = null; this.previousHover = null; this.dragPlane = null;
    this.motion.release();
    this.container.dataset.grabbed = 'false'; this.container.dataset.pointerHit = 'false';
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }

  private tick = (now: number) => {
    this.frame = 0;
    if (this.disposed || this.lost || this.reduced || !this.visible || document.hidden || this.frozen) return;
    const dt = (now - this.last) / 1000; this.last = now;
    if (this.pendingPointer) { const event = this.pendingPointer; this.pendingPointer = null; this.move(event); }
    this.motion.step(dt); this.paint(); this.frame = requestAnimationFrame(this.tick);
  };

  private paint() {
    if (!this.ready || !this.objects || !this.renderer || !this.scene || !this.camera || this.lost) return;
    this.objects.update(this.motion); this.renderer.render(this.scene, this.camera);
    this.container.dataset.badgeAngle = this.motion.angle.toFixed(4);
    this.container.dataset.badgeYaw = this.motion.yaw.toFixed(4);
  }

  private stop() { cancelAnimationFrame(this.frame); this.frame = 0; }

  private releaseGraphics() {
    const geometries = new Set<Three.BufferGeometry>(), materials = new Set<Three.Material>(), textures = new Set<Three.Texture>();
    this.scene?.traverse(object => {
      const mesh = object as Three.Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.environment?.dispose(); this.renderer?.dispose();
    this.environment = null; this.renderer = null; this.scene = null; this.camera = null; this.objects = null;
    this.ray = null; this.pointer = null; this.dragPoint = null; this.ready = false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.epoch++; this.loadingAbort?.abort(); this.stop(); this.clearPointer(); this.abort.abort();
    this.visibility?.disconnect(); this.preparation?.disconnect(); this.resizeObserver?.disconnect(); this.unsubscribe?.();
    this.releaseGraphics(); this.setState('disposed');
  }
}
