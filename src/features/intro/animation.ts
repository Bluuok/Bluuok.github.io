import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { introConfig, type SceneLayout } from './config';

interface ParticleSceneElement extends HTMLElement {
  setScene?: (scene: { progress: number; focus?: { x: number; y: number } | null }) => void;
  resetScene?: () => void;
}

export function mountIntro(root: HTMLElement) {
  gsap.registerPlugin(ScrollTrigger);
  const query = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const stage = query('[data-stage]');
  const particleField = root.querySelector<ParticleSceneElement>('particle-field');
  const fingertips = [...root.querySelectorAll<HTMLElement>('[data-fingertip]')];
  const opening = query('[data-opening]');
  const arrival = query('[data-arrival]');
  const media = gsap.matchMedia();
  const images = [...root.querySelectorAll<HTMLImageElement>('.hand-art')];
  let disposed = false;
  let lastFocusRead = 0;
  let particleFocus: { x: number; y: number } | null = null;
  const updateParticleScene = (progress: number) => {
    if (!particleField?.setScene) return;
    const now = performance.now();
    if (fingertips.length === 2 && now - lastFocusRead >= 32) {
      const stageBounds = stage.getBoundingClientRect();
      const left = fingertips[0]!.getBoundingClientRect();
      const right = fingertips[1]!.getBoundingClientRect();
      if (stageBounds.width > 0 && stageBounds.height > 0) {
        particleFocus = {
          x: ((left.left + right.left) / 2 - stageBounds.left) / stageBounds.width,
          y: ((left.top + right.top) / 2 - stageBounds.top) / stageBounds.height,
        };
        lastFocusRead = now;
      }
    }
    particleField.setScene({ progress, focus: particleFocus });
  };
  if (particleField) customElements.whenDefined('particle-field').then(() => {
    if (!disposed) updateParticleScene(Number(root.dataset.progress ?? 0));
  });
  const restoreStatic = () => {
    root.dataset.artState = 'unavailable';
    media.revert();
    opening.inert = false;
    opening.removeAttribute('aria-hidden');
    particleField?.resetScene?.();
  };
  const buildTimeline = (layout: SceneLayout) => {
    if (root.dataset.artState === 'unavailable') return;
    const camera = query('[data-camera]');
    const left = query('[data-hand="left"]');
    const right = query('[data-hand="right"]');
    const t = introConfig.timing;
    const gapX = () => stage.clientWidth * layout.gap.x;
    const gapY = () => stage.clientHeight * layout.gap.y;
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'creation-intro', trigger: root, pin: stage, start: 'top top',
        end: () => `+=${window.innerHeight * layout.scrollScreens}`,
        scrub: introConfig.scrub, invalidateOnRefresh: true,
      },
      onUpdate: () => {
        const progress = timeline.progress();
        root.dataset.progress = progress.toFixed(3);
        updateParticleScene(progress);
        opening.inert = progress > .36;
        opening.setAttribute('aria-hidden', String(progress > .36));
        arrival.setAttribute('aria-hidden', String(progress < .88));
      },
    });
    // Animate the registered fingertip origin; artwork size/rotation are separate.
    // fromTo also recalculates the starting offsets on viewport refresh.
    timeline
      .to(opening, { opacity: 0, y: -28, duration: t.titleDuration }, t.titleOut)
      .fromTo(left, { x: () => -gapX(), y: () => -gapY() }, { x: 0, y: 0, duration: t.approachDuration, ease: 'power1.inOut' }, t.approach)
      .fromTo(right, { x: gapX, y: gapY }, { x: 0, y: 0, duration: t.approachDuration, ease: 'power1.inOut' }, t.approach)
      .to(camera, { scale: layout.zoom, yPercent: layout.cameraShiftY * 100, duration: t.zoomDuration, ease: 'power1.inOut' }, t.zoom)
      .to(query('[data-ambient]'), { opacity: .9, scale: 1.2, duration: .4 }, .22)
      .to(query('[data-core]'), { opacity: 1, scale: 1, duration: t.glowDuration }, t.contact)
      .to(query('[data-ring]'), { opacity: .65, scale: 1.7, duration: .15 }, t.contact + .02)
      .to(query('[data-exposure]'), { opacity: 1, duration: t.exposureDuration, ease: 'sine.inOut' }, t.exposure)
      .to(camera, { opacity: 0, duration: .16 }, t.exposure)
      .fromTo(arrival, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: t.arrivalDuration }, t.arrival);
    return () => {
      opening.inert = false;
      opening.removeAttribute('aria-hidden');
      arrival.setAttribute('aria-hidden', 'true');
      particleField?.resetScene?.();
      particleFocus = null;
      lastFocusRead = 0;
      delete root.dataset.progress;
    };
  };
  media.add(`(prefers-reduced-motion: no-preference) and (min-width: ${introConfig.mobileBreakpoint}px)`, () => buildTimeline(introConfig.desktop));
  media.add(`(prefers-reduced-motion: no-preference) and (width < ${introConfig.mobileBreakpoint}px)`, () => buildTimeline(introConfig.mobile));
  for (const image of images) image.addEventListener('error', restoreStatic);
  Promise.all(images.map(image => image.decode())).then(() => {
    if (!disposed) root.dataset.artState = 'ready';
  }).catch(() => { if (!disposed) restoreStatic(); });
  const cleanup = () => {
    disposed = true;
    particleField?.resetScene?.();
    media.revert();
    for (const image of images) image.removeEventListener('error', restoreStatic);
    document.removeEventListener('astro:before-swap', cleanup);
  };
  document.addEventListener('astro:before-swap', cleanup, { once: true });
  return cleanup;
}
