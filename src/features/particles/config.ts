export interface NormalizedPoint { x: number; y: number }
export interface ParticleRegion extends NormalizedPoint { width: number; height: number }

export interface ParticleShapeConfig {
  type: 'spark' | 'text';
  text: string;
  center: NormalizedPoint;
  size: number;
  triggerRadius: number;
  particleRatio: number;
}

export interface ParticlePhaseConfig {
  shapeEnd: number;
  gatherEnd: number;
  coreEnd: number;
  fadeEnd: number;
}

export interface ParticleFieldConfig {
  enabled: boolean;
  count: number;
  mobileCount: number;
  density: number;
  maxParticles: number;
  referenceArea: number;
  minRadius: number;
  maxRadius: number;
  returnForce: number;
  shapeForce: number;
  gatherForce: number;
  friction: number;
  drift: number;
  opacity: number;
  bloomScale: number;
  /** Final luminous cloud radius in CSS pixels, around the supplied focus. */
  gatherRadius: number;
  region: ParticleRegion;
  shape: ParticleShapeConfig;
  phases: ParticlePhaseConfig;
  colors: readonly string[];
}

export const particleFieldDefaults: Readonly<ParticleFieldConfig> = {
  enabled: true,
  count: 9200,
  mobileCount: 3000,
  density: 1,
  maxParticles: 10000,
  referenceArea: 1440 * 1000,
  minRadius: .18,
  maxRadius: .44,
  returnForce: .007,
  shapeForce: .035,
  gatherForce: .024,
  friction: .9,
  drift: .032,
  opacity: .95,
  bloomScale: .38,
  gatherRadius: 62,
  region: { x: .015, y: .025, width: .97, height: .95 },
  shape: {
    type: 'spark',
    text: 'B',
    center: { x: .5, y: .7 },
    size: 184,
    triggerRadius: 215,
    particleRatio: .46,
  },
  phases: { shapeEnd: .28, gatherEnd: .7, coreEnd: .76, fadeEnd: .92 },
  colors: ['#5b86f5', '#8f6eec', '#4ebbe8', '#b58ae8', '#73abff'],
};

export type ParticleFieldOptions = Partial<
  Omit<ParticleFieldConfig, 'region' | 'shape' | 'phases' | 'colors'>
> & {
  region?: Partial<ParticleRegion>;
  shape?: Partial<Omit<ParticleShapeConfig, 'center'>> & { center?: Partial<NormalizedPoint> };
  phases?: Partial<ParticlePhaseConfig>;
  colors?: readonly string[];
};

export function resolveParticleFieldConfig(options: ParticleFieldOptions = {}): ParticleFieldConfig {
  const finite = (value: number | undefined, fallback: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value as number)) : fallback;
  const point = (value: Partial<NormalizedPoint> | undefined, fallback: NormalizedPoint) => ({
    x: finite(value?.x, fallback.x, 0, 1),
    y: finite(value?.y, fallback.y, 0, 1),
  });
  const region = {
    ...point(options.region, particleFieldDefaults.region),
    width: finite(options.region?.width, particleFieldDefaults.region.width, 0, 1),
    height: finite(options.region?.height, particleFieldDefaults.region.height, 0, 1),
  };
  region.width = Math.min(region.width, 1 - region.x);
  region.height = Math.min(region.height, 1 - region.y);
  const shapeEnd = finite(options.phases?.shapeEnd, particleFieldDefaults.phases.shapeEnd, 0, 1);
  const gatherEnd = Math.max(shapeEnd,
    finite(options.phases?.gatherEnd, particleFieldDefaults.phases.gatherEnd, 0, 1));
  const coreEnd = Math.max(gatherEnd,
    finite(options.phases?.coreEnd, particleFieldDefaults.phases.coreEnd, 0, 1));
  const fadeEnd = Math.max(coreEnd,
    finite(options.phases?.fadeEnd, particleFieldDefaults.phases.fadeEnd, 0, 1));

  return {
    enabled: options.enabled ?? particleFieldDefaults.enabled,
    count: Math.round(finite(options.count, particleFieldDefaults.count, 0, 10000)),
    mobileCount: Math.round(finite(options.mobileCount, particleFieldDefaults.mobileCount, 0, 5000)),
    density: finite(options.density, particleFieldDefaults.density, 0, 3),
    maxParticles: Math.round(finite(options.maxParticles, particleFieldDefaults.maxParticles, 0, 10000)),
    referenceArea: finite(options.referenceArea, particleFieldDefaults.referenceArea, 10000, 10000000),
    minRadius: finite(options.minRadius, particleFieldDefaults.minRadius, .1, 3),
    maxRadius: finite(options.maxRadius, particleFieldDefaults.maxRadius, .1, 5),
    returnForce: finite(options.returnForce, particleFieldDefaults.returnForce, 0, .1),
    shapeForce: finite(options.shapeForce, particleFieldDefaults.shapeForce, 0, .2),
    gatherForce: finite(options.gatherForce, particleFieldDefaults.gatherForce, 0, .2),
    friction: finite(options.friction, particleFieldDefaults.friction, .7, .995),
    drift: finite(options.drift, particleFieldDefaults.drift, 0, .3),
    opacity: finite(options.opacity, particleFieldDefaults.opacity, 0, 1),
    bloomScale: finite(options.bloomScale, particleFieldDefaults.bloomScale, .2, .75),
    gatherRadius: finite(options.gatherRadius, particleFieldDefaults.gatherRadius, 10, 160),
    region,
    shape: {
      type: options.shape?.type ?? particleFieldDefaults.shape.type,
      text: options.shape?.text ?? particleFieldDefaults.shape.text,
      center: point(options.shape?.center, particleFieldDefaults.shape.center),
      size: finite(options.shape?.size, particleFieldDefaults.shape.size, 50, 420),
      triggerRadius: finite(options.shape?.triggerRadius, particleFieldDefaults.shape.triggerRadius, 40, 600),
      particleRatio: finite(options.shape?.particleRatio, particleFieldDefaults.shape.particleRatio, .05, .9),
    },
    phases: {
      shapeEnd,
      gatherEnd,
      coreEnd,
      fadeEnd,
    },
    colors: options.colors?.length ? [...options.colors] : [...particleFieldDefaults.colors],
  };
}
