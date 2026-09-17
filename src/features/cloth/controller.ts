import { clothConfig, type ClothConfig } from './config';
import { getRestVertex, getAuthoredOffset } from './geometry';
import { subscribeMotion, type MotionState } from '../../lib/motion';

export class ClothController {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private cfg: ClothConfig;

  private abortController = new AbortController();
  private disposed = false;
  private running = false;
  private visible = false;
  private pageVisible = !document.hidden;
  private reducedMotion = false;
  private contextLost = false;
  private animFrame = 0;
  private lastTime = performance.now();

  // Lazy dynamic loading guards
  private loadPromise: Promise<void> | null = null;
  private threeLoaded = false;

  // Dynamic Three.js instances
  private THREE: any = null;
  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private mesh: any = null;
  private raycaster: any = null;
  private pointerNdc: any = null;

  // Geometry buffers
  private restPositions: Float32Array | null = null;
  private currentPositions: Float32Array | null = null;
  private offsetN: Float32Array | null = null;
  private offsetS: Float32Array | null = null;
  private offsetE: Float32Array | null = null;
  private offsetW: Float32Array | null = null;

  // Blended preset weights
  private currentWeights = { n: 0, s: 0, e: 0, w: 0 };
  private targetWeights = { n: 0, s: 0, e: 0, w: 0 };

  // Pointer & force state
  private pointerHit = false;
  private hitUv: { x: number; y: number } | null = null;
  private isPointerInside = false;
  private normalizedPointer = { x: 0, y: 0 };

  private unsubMotion: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(container: HTMLElement, cfg: ClothConfig = clothConfig) {
    this.container = container;
    const canvas = container.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) throw new Error('Cloth canvas element not found');
    this.canvas = canvas;
    this.cfg = cfg;
    this.canvas.setAttribute('aria-hidden', 'true');
  }

  init(): void {
    if (this.disposed) return;

    // 1. Setup motion subscription
    this.unsubMotion = subscribeMotion((m: MotionState) => {
      this.reducedMotion = m.isReduced;
      this.syncLifecycle();
    });

    // 2. Setup intersection & resize observers
    this.setupObservers();

    // 3. Setup window & pointer event listeners
    this.setupEvents();

    // 4. Check initial lifecycle (lazy load triggers only when visible && !reduced)
    this.syncLifecycle();
  }

  private setupObservers(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.clearPointerForces();
      if (!this.renderer || !this.camera) return;
      const w = this.container.clientWidth || 600;
      const h = this.container.clientHeight || 400;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderFrame();
    });
    this.resizeObserver.observe(this.container);

    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? false;
      this.syncLifecycle();
    });
    this.intersectionObserver.observe(this.container);
  }

  private setupEvents(): void {
    const signal = this.abortController.signal;
    window.addEventListener('scroll', () => this.clearPointerForces(), { passive: true, capture: true, signal });
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.running = false;
      cancelAnimationFrame(this.animFrame);
      this.clearPointerForces();
      this.container.dataset.clothState = 'fallback';
    }, { signal });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.resetToStatic();
      this.syncLifecycle();
    }, { signal });

    const onMove = (e: PointerEvent) => {
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        this.clearPointerForces();
        return;
      }
      this.isPointerInside = true;
      const ndcX = (x / rect.width) * 2 - 1;
      const ndcY = -(y / rect.height) * 2 + 1;
      if (this.pointerNdc) {
        this.pointerNdc.set(ndcX, ndcY);
      }
      this.normalizedPointer.x = ndcX;
      this.normalizedPointer.y = ndcY;
    };

    const onLeave = () => {
      this.clearPointerForces();
    };

    this.container.addEventListener('pointermove', onMove, { passive: true, signal });
    this.container.addEventListener('pointerdown', onMove, { passive: true, signal });
    this.container.addEventListener('pointerup', onLeave, { passive: true, signal });
    this.container.addEventListener('pointerleave', onLeave, { signal });
    this.container.addEventListener('pointercancel', onLeave, { signal });

    window.addEventListener('blur', () => {
      this.clearPointerForces();
    }, { signal });

    document.addEventListener('visibilitychange', () => {
      this.pageVisible = !document.hidden;
      if (!this.pageVisible) this.clearPointerForces();
      this.syncLifecycle();
    }, { signal });

    window.addEventListener('pagehide', (e: PageTransitionEvent) => {
      if (e.persisted) {
        this.pageVisible = false;
        this.clearPointerForces();
        this.syncLifecycle();
      } else {
        this.dispose();
      }
    }, { signal });

    window.addEventListener('pageshow', () => {
      this.pageVisible = !document.hidden;
      this.syncLifecycle();
    }, { signal });
  }

  private clearPointerForces(): void {
    this.isPointerInside = false;
    this.pointerHit = false;
    this.hitUv = null;
    if (this.pointerNdc) {
      this.pointerNdc.set(-999, -999);
    }
    this.targetWeights.n = 0;
    this.targetWeights.s = 0;
    this.targetWeights.e = 0;
    this.targetWeights.w = 0;
    this.container.dataset.pointerHit = 'false';
  }

  private syncLifecycle(): void {
    if (this.disposed) return;
    if (this.contextLost) return;
    const shouldRun = this.visible && this.pageVisible && !this.reducedMotion;

    // Trigger lazy load ONLY when section is visible and motion is enabled
    if (shouldRun && !this.threeLoaded) {
      if (!this.loadPromise) {
        this.loadPromise = this.lazyLoadThree();
      }
      return;
    }

    if (!this.threeLoaded) {
      this.container.dataset.clothState = this.reducedMotion ? 'static' : 'idle';
      return;
    }

    this.container.dataset.clothState = shouldRun
      ? 'running'
      : this.reducedMotion
      ? 'static'
      : 'paused';

    if (shouldRun && !this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.tick(this.lastTime);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.animFrame);
      this.clearPointerForces();
      this.resetToStatic();
    } else if (!shouldRun) {
      this.clearPointerForces();
      this.resetToStatic();
    }
  }

  private async lazyLoadThree(): Promise<void> {
    this.container.dataset.clothState = 'loading';
    try {
      const threeModule = await import('three');
      if (this.disposed) return;
      this.THREE = threeModule;
      this.buildScene();
      this.threeLoaded = true;
      this.syncLifecycle();
    } catch (err) {
      console.warn('[cloth] Three.js dynamic import / WebGL error:', err);
      this.cleanPartialResources();
      this.container.dataset.clothState = 'fallback';
    }
  }

  private buildScene(): void {
    const { THREE, cfg, canvas } = this;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 400;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    this.camera.position.set(...cfg.cameraPos);
    this.camera.lookAt(...cfg.cameraTarget);

    // Controlled lighting: lowered ambient/hemi to avoid washed-out gray; strong side key light
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe9e9ed, 1.8);
    this.scene.add(hemi);

    const dirKey = new THREE.DirectionalLight(0xffffff, 3.2);
    dirKey.position.set(4.5, 5.0, 4.0);
    this.scene.add(dirKey);

    const dirAccent = new THREE.DirectionalLight(0xc8c1eb, 0.18);
    dirAccent.position.set(-4, -2, 2.5);
    this.scene.add(dirAccent);

    // Geometry calculation & 4 authored preset buffers
    const segX = cfg.segmentsX;
    const segY = cfg.segmentsY;
    const vertexCount = (segX + 1) * (segY + 1);
    this.container.dataset.clothVertices = String(vertexCount);

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    this.offsetN = new Float32Array(vertexCount * 3);
    this.offsetS = new Float32Array(vertexCount * 3);
    this.offsetE = new Float32Array(vertexCount * 3);
    this.offsetW = new Float32Array(vertexCount * 3);

    let idx = 0;
    let uvIdx = 0;
    for (let j = 0; j <= segY; j++) {
      const v = j / segY;
      for (let i = 0; i <= segX; i++) {
        const u = i / segX;
        const pt = getRestVertex(u, v, cfg);
        positions[idx] = pt.x;
        positions[idx + 1] = pt.y;
        positions[idx + 2] = pt.z;
        uvs[uvIdx] = u;
        uvs[uvIdx + 1] = v;

        const offN = getAuthoredOffset(u, v, 'north');
        this.offsetN[idx] = offN.x;
        this.offsetN[idx + 1] = offN.y;
        this.offsetN[idx + 2] = offN.z;

        const offS = getAuthoredOffset(u, v, 'south');
        this.offsetS[idx] = offS.x;
        this.offsetS[idx + 1] = offS.y;
        this.offsetS[idx + 2] = offS.z;

        const offE = getAuthoredOffset(u, v, 'east');
        this.offsetE[idx] = offE.x;
        this.offsetE[idx + 1] = offE.y;
        this.offsetE[idx + 2] = offE.z;

        const offW = getAuthoredOffset(u, v, 'west');
        this.offsetW[idx] = offW.x;
        this.offsetW[idx + 1] = offW.y;
        this.offsetW[idx + 2] = offW.z;

        idx += 3;
        uvIdx += 2;
      }
    }

    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segX; i++) {
        const a = i + j * (segX + 1);
        const b = i + (j + 1) * (segX + 1);
        const c = i + 1 + (j + 1) * (segX + 1);
        const d = i + 1 + j * (segX + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();

    this.restPositions = new Float32Array(positions);
    this.currentPositions = new Float32Array(positions);

    const material = new THREE.MeshPhysicalMaterial({
      color: cfg.color,
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      clearcoat: cfg.clearcoat,
      sheen: cfg.sheen,
      sheenRoughness: cfg.sheenRoughness,
      sheenColor: cfg.sheenColor,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2(-999, -999);
  }

  private resetToStatic(): void {
    if (!this.mesh || !this.restPositions || !this.currentPositions) return;
    this.currentPositions.set(this.restPositions);
    const posAttr = this.mesh.geometry.attributes.position;
    posAttr.copyArray(this.restPositions);
    posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.renderFrame();
  }

  private tick = (time: number): void => {
    if (!this.running || this.disposed) return;
    const delta = Math.min(this.cfg.maxDelta, (time - this.lastTime) / 16.667);
    this.lastTime = time;

    this.updatePhysics(time, delta);
    this.renderFrame();

    this.animFrame = requestAnimationFrame(this.tick);
  };

  private updatePhysics(time: number, delta: number): void {
    if (!this.mesh || !this.restPositions || !this.currentPositions) return;

    // 1. Raycast against cloth mesh — CLEAR MISS IMMEDIATELY
    let hitFound = false;
    if (this.isPointerInside && this.raycaster && this.camera) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const intersects = this.raycaster.intersectObject(this.mesh);
      if (intersects.length > 0 && intersects[0].uv) {
        hitFound = true;
        this.pointerHit = true;
        this.hitUv = { x: intersects[0].uv.x, y: intersects[0].uv.y };
      }
    }

    if (!hitFound) {
      this.pointerHit = false;
      this.hitUv = null;
    }
    this.container.dataset.pointerHit = String(this.pointerHit);

    // 2. Drive 4 authored preset weights from pointer position
    if (this.pointerHit) {
      const px = this.normalizedPointer.x;
      const py = this.normalizedPointer.y;
      const mag = Math.min(1, Math.sqrt(px * px + py * py));
      const wN = Math.max(0, py) * mag;
      const wS = Math.max(0, -py) * mag;
      const wE = Math.max(0, px) * mag;
      const wW = Math.max(0, -px) * mag;
      const sum = wN + wS + wE + wW || 1;
      const scale = mag * this.cfg.maxPresetWeight;
      this.targetWeights.n = (wN / sum) * scale;
      this.targetWeights.s = (wS / sum) * scale;
      this.targetWeights.e = (wE / sum) * scale;
      this.targetWeights.w = (wW / sum) * scale;
    } else {
      this.targetWeights.n = 0;
      this.targetWeights.s = 0;
      this.targetWeights.e = 0;
      this.targetWeights.w = 0;
    }

    // Damp weights
    const damp = this.cfg.returnDamping * delta;
    this.currentWeights.n += (this.targetWeights.n - this.currentWeights.n) * damp;
    this.currentWeights.s += (this.targetWeights.s - this.currentWeights.s) * damp;
    this.currentWeights.e += (this.targetWeights.e - this.currentWeights.e) * damp;
    this.currentWeights.w += (this.targetWeights.w - this.currentWeights.w) * damp;

    // 3. Apply physics deformation & blend presets
    const posAttr = this.mesh.geometry.attributes.position;
    const pos = posAttr.array as Float32Array;
    const rest = this.restPositions;
    const curr = this.currentPositions;
    const offN = this.offsetN!;
    const offS = this.offsetS!;
    const offE = this.offsetE!;
    const offW = this.offsetW!;

    const segX = this.cfg.segmentsX;
    const segY = this.cfg.segmentsY;
    const radius = this.cfg.pointerRadius;
    const maxDepress = this.cfg.maxDepression;

    let modified = false;
    let idx = 0;

    for (let j = 0; j <= segY; j++) {
      const v = j / segY;
      for (let i = 0; i <= segX; i++) {
        const u = i / segX;

        // Base rest position
        let tx = rest[idx];
        let ty = rest[idx + 1];
        let tz = rest[idx + 2];

        // Blend 4 authored direction presets
        tx += offN[idx] * this.currentWeights.n +
              offS[idx] * this.currentWeights.s +
              offE[idx] * this.currentWeights.e +
              offW[idx] * this.currentWeights.w;
        ty += offN[idx + 1] * this.currentWeights.n +
              offS[idx + 1] * this.currentWeights.s +
              offE[idx + 1] * this.currentWeights.e +
              offW[idx + 1] * this.currentWeights.w;
        tz += offN[idx + 2] * this.currentWeights.n +
              offS[idx + 2] * this.currentWeights.s +
              offE[idx + 2] * this.currentWeights.e +
              offW[idx + 2] * this.currentWeights.w;

        // Gentle breathing time oscillation
        const breath = Math.sin(time * 0.0012 + u * 2.2 + v * 1.6) * 0.02;
        tz += breath;

        // Local Gaussian depression around hit UV
        if (this.hitUv) {
          const du = u - this.hitUv.x;
          const dv = v - this.hitUv.y;
          const distSq = (du * du + dv * dv) * 16;
          if (distSq < radius * radius * 12) {
            const influence = Math.exp(-distSq * 2.6);
            tz -= influence * maxDepress;
          }
        }

        // Damped integration
        curr[idx] += (tx - curr[idx]) * damp;
        curr[idx + 1] += (ty - curr[idx + 1]) * damp;
        curr[idx + 2] += (tz - curr[idx + 2]) * damp;

        if (Math.abs(pos[idx] - curr[idx]) > 0.0004 ||
            Math.abs(pos[idx + 1] - curr[idx + 1]) > 0.0004 ||
            Math.abs(pos[idx + 2] - curr[idx + 2]) > 0.0004) {
          pos[idx] = curr[idx];
          pos[idx + 1] = curr[idx + 1];
          pos[idx + 2] = curr[idx + 2];
          modified = true;
        }

        idx += 3;
      }
    }

    if (modified) {
      posAttr.needsUpdate = true;
      // Recompute normals every frame so lighting updates accurately with deformation
      this.mesh.geometry.computeVertexNormals();
    }
  }

  private renderFrame(): void {
    if (this.contextLost || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  private cleanPartialResources(): void {
    if (this.mesh) {
      this.mesh.geometry?.dispose();
      this.mesh.material?.dispose();
      this.mesh = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.animFrame);
    this.abortController.abort();

    if (this.unsubMotion) this.unsubMotion();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();

    this.cleanPartialResources();
    this.container.dataset.clothState = 'disposed';
  }
}
