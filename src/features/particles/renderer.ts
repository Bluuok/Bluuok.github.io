export interface RenderParticle {
  x: number; y: number; vx: number; vy: number;
  radius: number; depth: number; colorIndex: number; alpha: number; streak: boolean;
}

interface SpriteSet { core: HTMLCanvasElement; glow: HTMLCanvasElement }

const makeSprite = (color: string, glow: boolean): HTMLCanvasElement => {
  const size = glow ? 20 : 10;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const radius = size / 2;

  if (glow) {
    // Soft short atmospheric aura
    const grad = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'transparent');
    context.fillStyle = grad;
    context.globalAlpha = 0.35;
    context.beginPath();
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
  } else {
    // Solid tiny bright spark: solid saturated core (100% color at center), short soft falloff, no hollow ring
    const grad = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color);
    grad.addColorStop(0.8, color);
    grad.addColorStop(1, 'transparent');
    context.fillStyle = grad;
    context.beginPath();
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
  }
  return canvas;
};

export interface ParticleRenderer {
  resize(width: number, height: number, dpr: number): void;
  render(particles: readonly RenderParticle[], opacity: number, bloom: number): void;
  clear(): void;
}

export function createParticleRenderer(canvas: HTMLCanvasElement, colors: readonly string[], bloomScale: number): ParticleRenderer | null {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;
  const bloomCanvas = document.createElement('canvas');
  const bloomContext = bloomCanvas.getContext('2d', { alpha: true });
  if (!bloomContext) return null;
  const sprites: SpriteSet[] = colors.map(color => ({ core: makeSprite(color, false), glow: makeSprite(color, true) }));
  let width = 1;
  let height = 1;
  let dpr = 1;

  const resize = (nextWidth: number, nextHeight: number, nextDpr: number) => {
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    bloomCanvas.width = Math.max(1, Math.round(width * bloomScale));
    bloomCanvas.height = Math.max(1, Math.round(height * bloomScale));
  };

  const clear = () => {
    context.clearRect(0, 0, width, height);
    bloomContext.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
  };

  const render = (particles: readonly RenderParticle[], opacity: number, bloom: number) => {
    clear();
    bloomContext.save();
    bloomContext.scale(bloomScale, bloomScale);
    for (const particle of particles) {
      if (particle.alpha <= .01 || particle.depth < .5) continue;
      const sprite = sprites[particle.colorIndex % sprites.length] ?? sprites[0];
      if (!sprite) continue;
      const size = (2.2 + particle.radius * 2.8) * (0.8 + particle.depth * 0.5);
      bloomContext.globalAlpha = particle.alpha * opacity * (.10 + bloom * .25);
      bloomContext.drawImage(sprite.glow, particle.x - size / 2, particle.y - size / 2, size, size);
    }
    bloomContext.restore();
    context.save();
    context.globalAlpha = Math.min(1, .45 + bloom * .35);
    context.drawImage(bloomCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height, 0, 0, width, height);
    context.globalAlpha = 1;
    for (const particle of particles) {
      if (particle.alpha <= .01) continue;
      const sprite = sprites[particle.colorIndex % sprites.length] ?? sprites[0];
      if (!sprite) continue;
      context.globalAlpha = Math.min(1, particle.alpha * opacity * (1.0 + particle.depth * .5));
      if (particle.streak && Math.abs(particle.vx) + Math.abs(particle.vy) > .4) {
        context.strokeStyle = colors[particle.colorIndex % colors.length] ?? '#5b86f5';
        context.lineWidth = Math.max(.4, particle.radius * .55);
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
        const tail = Math.min(7, speed * 1.0);
        context.lineTo(particle.x - particle.vx / speed * tail, particle.y - particle.vy / speed * tail);
        context.stroke();
      }
      const drawSize = (1.1 + particle.radius * 1.8) * (0.75 + particle.depth * 0.45);
      context.drawImage(sprite.core, particle.x - drawSize / 2, particle.y - drawSize / 2, drawSize, drawSize);
    }
    context.restore();
  };

  return { resize, render, clear };
}
