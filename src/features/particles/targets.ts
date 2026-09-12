import type { ParticleShapeConfig } from './config';

export interface ShapeTarget { x: number; y: number }

const mulberry32 = (seed: number) => () => {
  let value = seed += 0x6d2b79f5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};

function sparkTargets(count: number, size: number): ShapeTarget[] {
  const random = mulberry32(count + Math.round(size));
  const targets: ShapeTarget[] = [];
  const rays = 8;
  for (let index = 0; index < count; index += 1) {
    const ray = index % rays;
    const angle = ray * Math.PI * 2 / rays;
    const diagonal = ray % 2 === 1;
    const distance = Math.pow(random(), 1.7) * size * (diagonal ? .36 : .5);
    const crossNoise = (random() - .5) * (2.5 + distance * .035);
    const alongNoise = (random() - .5) * 4;
    targets.push({
      x: Math.cos(angle) * (distance + alongNoise) - Math.sin(angle) * crossNoise,
      y: Math.sin(angle) * (distance + alongNoise) + Math.cos(angle) * crossNoise,
    });
  }
  return targets;
}

function textTargets(count: number, shape: ParticleShapeConfig): ShapeTarget[] {
  const label = shape.text.slice(0, 3) || 'B';
  const fontSize = Math.round(shape.size);
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  if (!measureContext) return sparkTargets(count, shape.size);
  measureContext.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const sampleWidth = Math.max(96, Math.ceil(measureContext.measureText(label).width + 16));
  const sampleHeight = Math.max(96, Math.ceil(shape.size * 1.25));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return sparkTargets(count, shape.size);
  context.fillStyle = '#fff';
  context.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, sampleWidth / 2, sampleHeight / 2);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const candidates: ShapeTarget[] = [];
  const step = Math.max(1, Math.floor(Math.max(sampleWidth, sampleHeight) / 90));
  for (let y = 0; y < sampleHeight; y += step) {
    for (let x = 0; x < sampleWidth; x += step) {
      if ((pixels[(y * sampleWidth + x) * 4 + 3] ?? 0) > 80) {
        candidates.push({ x: x - sampleWidth / 2, y: y - sampleHeight / 2 });
      }
    }
  }
  if (!candidates.length) return sparkTargets(count, shape.size);
  const random = mulberry32(count + sampleWidth + sampleHeight);
  return Array.from({ length: count }, (_, index) => {
    const candidateIndex = Math.min(
      candidates.length - 1,
      Math.floor((index + .5) / count * candidates.length),
    );
    const target = candidates[candidateIndex]!;
    return { x: target.x + (random() - .5) * step, y: target.y + (random() - .5) * step };
  });
}

export function createShapeTargets(count: number, shape: ParticleShapeConfig): ShapeTarget[] {
  return shape.type === 'text' ? textTargets(count, shape) : sparkTargets(count, shape.size);
}
