import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { introConfig } from './config';
import { subscribeMotion, getMotionState, type MotionState } from '../../lib/motion';

interface ParticleSceneElement extends HTMLElement {
  setScene?: (scene: { progress: number; focus?: { x: number; y: number } | null }) => void;
  resetScene?: () => void;
}

export interface MountIntroOptions {
  id?: string;
  onUpdate?: (progress: number) => void;
}

export function mountIntro(root: HTMLElement, options: MountIntroOptions = {}) {
  gsap.registerPlugin(ScrollTrigger);
  const triggerId = options.id ?? 'creation-intro';
  const query = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const stage = query('[data-stage]');
  const particleField = root.querySelector<ParticleSceneElement>('[data-particle-host], particle-field');
  const opening = root.querySelector<HTMLElement>('[data-opening]');
  const arrival = root.querySelector<HTMLElement>('[data-arrival]');
  const images = [...root.querySelectorAll<HTMLImageElement>('.hand-art')];
  let disposed = false;
  let imagesReady=root.dataset.imagesDecoded==='true';
  let particleFocus: { x: number; y: number } | null = null;
  let activeTimeline: gsap.core.Timeline | null = null;

  const getLayout = () => window.innerWidth < introConfig.mobileBreakpoint ? introConfig.mobile : introConfig.desktop;
  const computeFocus = (progress: number) => {
    const layout = getLayout();
    const t = introConfig.timing;
    const zoomProgress = Math.max(0, Math.min(1, (progress - t.zoom) / t.zoomDuration));
    const easedZoom = zoomProgress < 0.5 ? 2 * zoomProgress * zoomProgress : 1 - Math.pow(-2 * zoomProgress + 2, 2) / 2;
    return {
      x: layout.contact.x,
      y: layout.contact.y + layout.cameraShiftY * easedZoom,
    };
  };

  const updateParticleScene = (progress: number) => {
    if (!particleField?.setScene) return;
    particleFocus = computeFocus(progress);
    particleField.setScene({ progress, focus: particleFocus });
  };

  if (particleField) {
    if (particleField.setScene) {
      if (!disposed) updateParticleScene(Number(root.dataset.progress ?? 0));
    } else if (typeof customElements !== 'undefined' && customElements.get('particle-field')) {
      if (!disposed) updateParticleScene(Number(root.dataset.progress ?? 0));
    } else if (typeof customElements !== 'undefined') {
      customElements.whenDefined('particle-field').then(() => {
        if (!disposed) updateParticleScene(Number(root.dataset.progress ?? 0));
      });
    }
  }

  const killTimeline = () => {
    const st = activeTimeline?.scrollTrigger ?? ScrollTrigger.getById(triggerId);
    st?.kill(true);
    if (activeTimeline) {
      activeTimeline.revert();
      activeTimeline = null;
    }
    gsap.set(root.querySelectorAll('[data-camera], [data-hand], [data-opening], [data-arrival], [data-ambient], [data-core], [data-ring], [data-exposure]'), { clearProps: 'transform,opacity' });
    delete root.dataset.progress;
    particleFocus = null;

  };

  const restoreStatic = () => {
    root.dataset.artState = 'unavailable';
    killTimeline();
    if (opening) {
      opening.inert = false;
      opening.removeAttribute('aria-hidden');
    }
    if (arrival) {
      arrival.setAttribute('aria-hidden', 'true');
    }
    particleField?.resetScene?.();
  };

  const applyStaticReducedPose = () => {
    killTimeline();
    root.dataset.artState = 'static-reduced';
    if (opening) {
      opening.inert = false;
      opening.removeAttribute('aria-hidden');
      gsap.set(opening, { opacity: 1, y: 0 });
    }
    if (arrival) {
      arrival.setAttribute('aria-hidden', 'true');
      gsap.set(arrival, { opacity: 0 });
    }
    const exposure = root.querySelector<HTMLElement>('[data-exposure]');
    if (exposure) gsap.set(exposure, { opacity: 0 });
    const core = root.querySelector<HTMLElement>('[data-core]');
    if (core) gsap.set(core, { opacity: 0 });
    const ring = root.querySelector<HTMLElement>('[data-ring]');
    if (ring) gsap.set(ring, { opacity: 0 });
    const left = root.querySelector<HTMLElement>('[data-hand="left"]');
    const right = root.querySelector<HTMLElement>('[data-hand="right"]');
    if (left) gsap.set(left, { x: 0, y: 0 });
    if (right) gsap.set(right, { x: 0, y: 0 });
    particleField?.resetScene?.();
  };

  const buildTimeline = () => {
    if (disposed || !imagesReady || root.dataset.artState === 'unavailable') return;
    killTimeline();

    const isMobile = window.innerWidth < introConfig.mobileBreakpoint;
    const layout = isMobile ? introConfig.mobile : introConfig.desktop;

    const camera = query('[data-camera]');
    const left = query('[data-hand="left"]');
    const right = query('[data-hand="right"]');
    const t = introConfig.timing;
    const gapX = () => stage.clientWidth * layout.gap.x;
    const gapY = () => stage.clientHeight * layout.gap.y;

    activeTimeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: triggerId,
        trigger: root,
        pin: root.hasAttribute('data-inline-spark') ? false : stage,
        start: 'top top',
        end: () => `+=${window.innerHeight * layout.scrollScreens}`,
        scrub: introConfig.scrub,
        invalidateOnRefresh: true,
        onRefresh: self => { root.dataset.scrollStart=String(self.start); root.dataset.scrollEnd=String(self.end); },
      },
      onUpdate: () => {
        if (!activeTimeline) return;
        const progress = activeTimeline.progress();
        root.dataset.progress = progress.toFixed(3);
        updateParticleScene(progress);
        if (options.onUpdate) options.onUpdate(progress);
        if (opening) {
          opening.inert = progress > .36;
          opening.setAttribute('aria-hidden', String(progress > .36));
        }
        if (arrival) {
          arrival.setAttribute('aria-hidden', String(progress < .92));
        }
      },
    });

    activeTimeline
      .to(opening, { opacity: 0, y: -28, duration: t.titleDuration }, t.titleOut)
      .fromTo(left, { x: () => -gapX(), y: () => -gapY() }, { x: 0, y: 0, duration: t.approachDuration, ease: 'power1.inOut' }, t.approach)
      .fromTo(right, { x: gapX, y: gapY }, { x: 0, y: 0, duration: t.approachDuration, ease: 'power1.inOut' }, t.approach)
      .to(camera, { scale: layout.zoom, yPercent: layout.cameraShiftY * 100, duration: t.zoomDuration, ease: 'power1.inOut' }, t.zoom)
      .to(query('[data-ambient]'), { opacity: .9, scale: 1.2, duration: .4 }, .22)
      .to(query('[data-core]'), { opacity: 1, scale: 1, duration: t.glowDuration }, t.contact)
      .to(query('[data-ring]'), { opacity: .95, scale: 1.25, duration: .08 }, t.contact + .02)
      .to(query('[data-exposure]'), { opacity: 1, duration: t.exposureDuration, ease: 'sine.inOut' }, t.exposure)
      .to(camera, { opacity: 0, duration: .14 }, t.exposure)
      .fromTo(arrival, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: t.arrivalDuration }, t.arrival);
  };

  // Determine initial state: single source of truth from motion.ts
  const initialMotion = getMotionState();
  if (initialMotion.isReduced) {
    applyStaticReducedPose();
  } else {
    buildTimeline();
  }

  // Subscribe to unified motion controller without competing gsap.matchMedia
  const unsubMotion = subscribeMotion((state: MotionState) => {
    if (disposed) return;
    if (state.isReduced) {
      applyStaticReducedPose();
    } else {
      if (imagesReady && (root.dataset.artState === 'static-reduced' || !activeTimeline)) {
        root.dataset.artState = 'ready';
        buildTimeline();
        ScrollTrigger.refresh();
      }
    }
  });

  const breakpoint = window.matchMedia(`(min-width: ${introConfig.mobileBreakpoint}px)`);
  const onBreakpoint = () => {
    if (disposed || getMotionState().isReduced) return;
    const previousTrigger = ScrollTrigger.getById(triggerId);
    const wasActive = previousTrigger?.isActive ?? false;
    const progress = activeTimeline?.progress() ?? 0;
    buildTimeline();
    ScrollTrigger.refresh();
    const trigger = ScrollTrigger.getById(triggerId);
    if (trigger && wasActive) {
      window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * progress, behavior: 'instant' });
      trigger.update();
      activeTimeline?.progress(progress);
    }
  };
  breakpoint.addEventListener('change', onBreakpoint);

  for (const image of images) image.addEventListener('error', restoreStatic);
  Promise.all(images.map(image => image.decode())).then(() => {
    if (!disposed) { imagesReady=true; root.dataset.imagesDecoded='true'; if (!getMotionState().isReduced) { root.dataset.artState = 'ready'; if(!activeTimeline)buildTimeline(); ScrollTrigger.refresh(); activeTimeline?.scrollTrigger?.update(); updateParticleScene(activeTimeline?.progress()??0); } }
  }).catch(() => { if (!disposed) restoreStatic(); });

  const cleanup = () => {
    disposed = true;
    unsubMotion();
    breakpoint.removeEventListener('change', onBreakpoint);
    particleField?.resetScene?.();
    killTimeline();
    for (const image of images) image.removeEventListener('error', restoreStatic);
    document.removeEventListener('astro:before-swap', cleanup);
  };

  document.addEventListener('astro:before-swap', cleanup, { once: true });
  return cleanup;
}
