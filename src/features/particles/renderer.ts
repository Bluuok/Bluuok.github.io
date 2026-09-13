export interface RenderParticle {
  x: number; y: number; vx: number; vy: number;
  radius: number; depth: number; colorIndex: number; alpha: number; streak: boolean;
}

interface SpriteSet { core: HTMLCanvasElement; glow: HTMLCanvasElement }

const makeSprite = (color: string, glow: boolean): HTMLCanvasElement => {
  const size = glow ? 32 : 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const radius = size / 2;
  // Apply opacity as a mask so any valid CSS color works, not only six-digit hex.
  context.fillStyle = glow ? color : '#ffffff';
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'destination-in';
  const mask = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
  mask.addColorStop(0, 'rgb(0 0 0 / 1)');
  mask.addColorStop(.12, `rgb(0 0 0 / ${glow ? .55 : .85})`);
  mask.addColorStop(.42, `rgb(0 0 0 / ${glow ? .14 : .3})`);
  mask.addColorStop(1, 'rgb(0 0 0 / 0)');
  context.fillStyle = mask;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'source-over';
  const core = context.createRadialGradient(radius, radius, 0, radius, radius, radius * .12);
  core.addColorStop(0, 'rgb(255 255 255 / .98)');
  core.addColorStop(.25, 'rgb(245 249 255 / .82)');
  core.addColorStop(1, 'rgb(255 255 255 / 0)');
  context.fillStyle = core;
  context.fillRect(0, 0, size, size);
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
      if (particle.alpha <= .01 || particle.depth < .9) continue;
      const sprite = sprites[particle.colorIndex % sprites.length] ?? sprites[0];
      if (!sprite) continue;
      const size = (2 + particle.radius * 3);
      bloomContext.globalAlpha = particle.alpha * opacity * (.12 + bloom * .45);
      bloomContext.drawImage(sprite.glow, particle.x - size / 2, particle.y - size / 2, size, size);
    }
    bloomContext.restore();
    context.save();
    context.globalAlpha = Math.min(1, .55 + bloom * .55);
    context.drawImage(bloomCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height, 0, 0, width, height);
    context.globalAlpha = 1;
    context.fillStyle = '#fff';
    for (const particle of particles) {
      if (particle.alpha <= .01) continue;
      const sprite = sprites[particle.colorIndex % sprites.length] ?? sprites[0];
      if (!sprite) continue;
      const size = particle.radius * 2;
      context.globalAlpha = Math.min(1, particle.alpha * opacity * (1 + particle.depth * .7));
      if (particle.streak && Math.abs(particle.vx) + Math.abs(particle.vy) > .5) {
        context.strokeStyle = colors[particle.colorIndex % colors.length] ?? '#698cf5';
        context.lineWidth = Math.max(.45, particle.radius * .65);
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
        const tail = Math.min(9, speed * 1.2);
        context.lineTo(particle.x - particle.vx / speed * tail, particle.y - particle.vy / speed * tail);
        context.stroke();
      } else {
        // Diameter is measured directly in CSS pixels, without a large disk.
        context.fillStyle = colors[particle.colorIndex % colors.length] ?? '#698cf5';
        const glint = size;
        context.fillRect(particle.x - glint / 2, particle.y - glint / 2, glint, glint);
      }
    }
    context.restore();
  };

  return { resize, render, clear };
}
