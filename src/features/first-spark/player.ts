import { getMotionState } from '../../lib/motion';
let activeToken = 0;
let currentInstance: { token: number; close: () => void } | null = null;

export interface StartPlayerOptions {
  cardEl: HTMLElement;
  cardViewEl: HTMLElement;
  mountEl: HTMLElement;
  templateEl: HTMLTemplateElement;
  startBtn: HTMLButtonElement;
  errorEl: HTMLElement;
}

export async function startFirstSpark(options: StartPlayerOptions): Promise<void> {
  const { cardEl, cardViewEl, mountEl, templateEl, startBtn, errorEl } = options;

  // If another instance is running, cleanly close it first
  if (currentInstance) {
    currentInstance.close();
  }

  // 1. Monotonically incrementing token (never reset to 0)
  const token = ++activeToken;
  const abortController = new AbortController();
  const signal = abortController.signal;
  let disposed = false;

  const previousUrl = window.location.href;
  const originalBtnText = startBtn.innerHTML;

  startBtn.disabled = true;
  startBtn.setAttribute('aria-busy', 'true');
  startBtn.innerHTML = '正在加载...';
  errorEl.textContent = '';
  errorEl.hidden = true;

  // 2. Clone template, unhide mountEl, and render stage toolbar immediately so user can cancel during loading
  const clone = templateEl.content.cloneNode(true) as DocumentFragment;
  mountEl.innerHTML = '';
  mountEl.appendChild(clone);

  cardViewEl.hidden = true;
  mountEl.hidden = false;
  cardEl.dataset.sparkState = 'loading';

  // Force layout flush so dimensions are valid before initializing pin/canvas
  void mountEl.offsetHeight;

  const introRoot = mountEl.querySelector<HTMLElement>('[data-intro]');
  const triggerId = 'first-spark-trigger-' + token;

  let introCleanup: (() => void) | null = null;
  let particleCleanup: (() => void) | null = null;
  let ScrollTriggerModule: any = null;
  let entranceFrame = 0;
  const currentTrigger = () => ScrollTriggerModule?.getById(triggerId);
  const scrollBehavior = (): ScrollBehavior => getMotionState().isReduced ? 'instant' : 'smooth';

  // 3. Define the idempotent close function BEFORE any await
  const close = (explicit = true) => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(entranceFrame);
    abortController.abort();

    if (currentInstance?.token === token) {
      currentInstance = null;
    }

    // Clean animation, local ScrollTrigger, and PinSpacer
    try {
      if (introCleanup) introCleanup();
      if (ScrollTriggerModule) {
        const st = ScrollTriggerModule.getById(triggerId);
        st?.kill(true);
      }
    } catch (e) {
      console.warn('[first-spark] error killing animation:', e);
    }

    // Clean particles
    try {
      if (particleCleanup) particleCleanup();
    } catch (e) {
      console.warn('[first-spark] error cleaning particles:', e);
    }

    // Clean any lingering unmounted pin-spacer elements
    mountEl.querySelectorAll('.pin-spacer').forEach((spacer) => {
      const parent = spacer.parentElement;
      while (spacer.firstChild && parent) {
        parent.insertBefore(spacer.firstChild, spacer);
      }
      spacer.remove();
    });

    // Teardown DOM
    mountEl.innerHTML = '';
    mountEl.hidden = true;
    cardViewEl.hidden = false;
    cardEl.dataset.sparkState = 'idle';

    // Reset start button
    startBtn.disabled = false;
    startBtn.removeAttribute('aria-busy');
    startBtn.innerHTML = originalBtnText;

    // Explicit close actions only: restore URL, focus, and scroll position
    if (explicit) {
      if (window.location.hash === '#first-spark') {
        const targetUrl = previousUrl.includes('#first-spark')
          ? window.location.pathname + window.location.search
          : previousUrl;
        history.replaceState(null, '', targetUrl);
      }
      startBtn.focus({ preventScroll: true });
      cardEl.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    }
  };

  currentInstance = { token, close: () => close(true) };

  // Register stage toolbar controls immediately (works during loading too)
  const closeBtn = mountEl.querySelector<HTMLButtonElement>('[data-action="close"]');
  const replayBtn = mountEl.querySelector<HTMLButtonElement>('[data-action="replay"]');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => close(true), { signal });
  }

  // Register popstate/hashchange, pagehide/pageshow, and astro transitions
  window.addEventListener('popstate', () => {
    if (window.location.hash !== '#first-spark') {
      close(false);
    }
  }, { signal });

  window.addEventListener('hashchange', () => {
    if (window.location.hash !== '#first-spark') {
      close(false);
    }
  }, { signal });

  document.addEventListener('astro:before-swap', () => {
    close(false);
  }, { signal, once: true });

  window.addEventListener('pagehide', (e: PageTransitionEvent) => {
    if (e.persisted) {
      // Local pause without global timeline pollution
      currentTrigger()?.disable(false);
    } else {
      close(false);
    }
  }, { signal });

  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) {
      if (currentTrigger()) {
        currentTrigger().enable();
        ScrollTriggerModule?.refresh();
      }
    }
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      currentTrigger()?.disable(false);
    } else {
      if (currentTrigger()) {
        currentTrigger().enable();
        ScrollTriggerModule?.refresh();
      }
    }
  }, { signal });

  // Update hash if not present
  if (window.location.hash !== '#first-spark') {
    history.pushState(null, '', '#first-spark');
  }

  try {
    // 4. Dynamic import with token and connection guards after each await
    const [{ mountIntro }, { mountParticleField }, { ScrollTrigger }] = await Promise.all([
      import('../intro/animation'),
      import('../particles/field'),
      import('gsap/ScrollTrigger'),
    ]);

    ScrollTriggerModule = ScrollTrigger;

    if (disposed || token !== activeToken || !mountEl.isConnected || !introRoot) {
      close(false);
      return;
    }

    // 5. Mount ParticleField without invalid options
    const canvas = introRoot.querySelector<HTMLCanvasElement>('.particle-field__canvas');
    const particleHost = introRoot.querySelector<HTMLElement>('[data-particle-host]');

    if (canvas && particleHost) {
      canvas.setAttribute('aria-hidden', 'true');
      particleHost.setAttribute('aria-hidden', 'true');
      const pMount = mountParticleField(canvas, particleHost);
      particleCleanup = pMount;
      (particleHost as any).setScene = pMount.setScene;
      (particleHost as any).resetScene = pMount.resetScene;
    }

    if (disposed || token !== activeToken || !mountEl.isConnected) {
      close(false);
      return;
    }

    // 6. Mount Intro timeline
    introCleanup = mountIntro(introRoot, { id: triggerId });

    // Refresh ScrollTrigger now that layout is completely unhidden and measured
    ScrollTrigger.refresh();

    cardEl.dataset.sparkState = 'active';

    // 7. Setup replay using ScrollTrigger.start absolute position
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        const st = ScrollTrigger.getById(triggerId);
        if (st) {
          window.scrollTo({ top: st.start, behavior: 'instant' });
          st.update();
          st.animation?.progress(0);
        }
      }, { signal });
    }

    // Smooth scroll to stage entrance
    entranceFrame = requestAnimationFrame(() => {
      if (disposed || token !== activeToken || !introRoot.isConnected) return;
      const trigger = currentTrigger();
      if (trigger) {
        window.scrollTo({ top: trigger.start, behavior: scrollBehavior() });
      } else {
        introRoot.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }
    });

  } catch (err) {
    if (disposed || token !== activeToken || !mountEl.isConnected) return;
    console.error('[first-spark] Failed to launch interactive stage:', err);
    close(false);
    errorEl.textContent = '体验资源加载失败，请重试。';
    errorEl.hidden = false;
    cardEl.dataset.sparkState = 'error';
  }
}
