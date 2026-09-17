import { clothConfig, type ClothConfig } from './config';

export interface VertexPos {
  x: number;
  y: number;
  z: number;
}

/**
 * Deterministic mathematical rest shape:
 * Produces an asymmetrical, free-edged sheet with pronounced traversing crest folds,
 * deep troughs, hanging catenary sag, edge curls, and organic micro-creases.
 */
export function getRestVertex(u: number, v: number, cfg: ClothConfig = clothConfig): VertexPos {
  // Non-rectangular organic edge perturbation
  const edgeWaveX = Math.sin(v * Math.PI * 3.6) * 0.18 * (1 - 3.2 * (u - 0.5) * (u - 0.5));
  const edgeWaveY = Math.cos(u * Math.PI * 3.0) * 0.12 * (1 - 2.8 * (v - 0.5) * (v - 0.5));
  // Gravity droop on the lower hanging edge
  const droopY = -Math.sin(u * Math.PI) * 0.32 * Math.pow(v, 1.6);

  const x = (u - 0.5) * cfg.width + edgeWaveX;
  const y = (0.5 - v) * cfg.height + edgeWaveY + droopY;

  // Primary diagonal traversing crest fold (narrowed, higher relief)
  const fold1 = u * 0.9 + v * 0.65 - 0.72;
  const crest1 = Math.exp(-fold1 * fold1 * 34) * 0.72;
  const trough1 = -Math.exp(-(fold1 - 0.2) * (fold1 - 0.2) * 30) * 0.44;

  // Secondary intersecting fold & valley
  const fold2 = u * 0.5 - v * 0.85 + 0.2;
  const crest2 = Math.exp(-fold2 * fold2 * 26) * 0.42;
  const trough2 = -Math.exp(-(fold2 + 0.22) * (fold2 + 0.22) * 24) * 0.30;

  // Curled hem / turn-up on borders
  const curlBottom = Math.pow(Math.max(0, v - 0.75) / 0.25, 2) * Math.sin(u * Math.PI * 2.5) * 0.22;
  const curlTop = Math.pow(Math.max(0, 0.25 - v) / 0.25, 2) * Math.cos(u * Math.PI * 2) * 0.18;

  // Natural catenary belly sag
  const sag = -Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.28;

  // Fine organic micro-creases
  const ripple = Math.sin(u * 8.0 + v * 5.0) * 0.05 + Math.cos(u * 4.2 - v * 7.5) * 0.035;

  const z = crest1 + trough1 + crest2 + trough2 + curlBottom + curlTop + sag + ripple;
  return { x, y, z };
}

/**
 * 4 authored direction deformation presets with identical topology.
 */
export function getAuthoredOffset(
  u: number,
  v: number,
  preset: 'north' | 'south' | 'east' | 'west',
): VertexPos {
  switch (preset) {
    case 'north':
      return {
        x: Math.sin(v * Math.PI * 2) * 0.06,
        y: Math.sin(u * Math.PI) * 0.14,
        z: Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.18 + Math.cos(u * 4) * 0.05,
      };
    case 'south':
      return {
        x: -Math.sin(u * Math.PI) * 0.05,
        y: -Math.sin(v * Math.PI) * 0.16,
        z: -Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.20 - Math.sin(v * 3) * 0.06,
      };
    case 'east':
      return {
        x: Math.sin(u * Math.PI) * 0.14,
        y: Math.sin(v * Math.PI * 2) * 0.06,
        z: Math.cos(u * Math.PI * 2.5) * 0.14 + Math.sin(v * Math.PI) * 0.07,
      };
    case 'west':
      return {
        x: -Math.sin(u * Math.PI) * 0.14,
        y: -Math.cos(v * Math.PI * 2) * 0.07,
        z: -Math.cos(u * Math.PI * 2.2) * 0.14 - Math.sin(v * Math.PI) * 0.06,
      };
  }
}

/**
 * Generates an SVG string of faceted polygons sampled from the exact same 3D formula,
 * projected from the identical camera angle with directional normal-based lighting.
 */
export function generateFacetedSvgPoster(): string {
  const cfg = clothConfig;
  const NX = 40;
  const NY = 32;

  // Camera transformation matching Three.js scene
  const camE = cfg.cameraPos;
  const camT = cfg.cameraTarget;

  // Forward unit vector: F = normalize(T - E) pointing forward towards target
  let fx = camT[0] - camE[0];
  let fy = camT[1] - camE[1];
  let fz = camT[2] - camE[2];
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
  fx /= fLen; fy /= fLen; fz /= fLen;

  // Right unit vector: R = normalize(cross(F, [0, 1, 0]))
  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rLen = Math.sqrt(rx * rx + rz * rz);
  rx /= rLen; rz /= rLen;

  // Up unit vector: U = cross(R, F)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  // Exactly matching vertical FOV 34 degrees and viewBox half-height 200
  const fovScale = 200 / Math.tan((34 * Math.PI / 180) / 2);

  // Project 3D point to 2D SVG space (viewBox 0 0 680 400)
  function project(p: VertexPos): { sx: number; sy: number; zCam: number } {
    const dx = p.x - camE[0];
    const dy = p.y - camE[1];
    const dz = p.z - camE[2];

    // zCam is dot(P - E, F), which is positive in front of the camera
    const zCam = dx * fx + dy * fy + dz * fz;
    const xCam = dx * rx + dy * ry + dz * rz;
    const yCam = dx * ux + dy * uy + dz * uz;

    const sx = 340 + (xCam / Math.max(0.5, zCam)) * fovScale;
    const sy = 200 - (yCam / Math.max(0.5, zCam)) * fovScale;
    return { sx, sy, zCam };
  }

  // Sample 3D grid
  const grid: { pos: VertexPos; screen: { sx: number; sy: number; zCam: number } }[][] = [];
  for (let j = 0; j <= NY; j++) {
    const row = [];
    const v = j / NY;
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const pos = getRestVertex(u, v, cfg);
      const screen = project(pos);
      row.push({ pos, screen });
    }
    grid.push(row);
  }

  // Directional key light matching Three.js key light (4.5, 5.0, 4.0)
  const lx = 0.58;
  const ly = 0.65;
  const lz = 0.50;

  let svgElements = '';

  // Render shaded quads with matching stroke to eliminate dark wireframe lines
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const p00 = grid[j][i];
      const p10 = grid[j][i + 1];
      const p11 = grid[j + 1][i + 1];
      const p01 = grid[j + 1][i];

      // Calculate facet normal from 3D points
      const v1x = p10.pos.x - p00.pos.x;
      const v1y = p10.pos.y - p00.pos.y;
      const v1z = p10.pos.z - p00.pos.z;

      const v2x = p01.pos.x - p00.pos.x;
      const v2y = p01.pos.y - p00.pos.y;
      const v2z = p01.pos.z - p00.pos.z;

      let nx = v1y * v2z - v1z * v2y;
      let ny = v1z * v2x - v1x * v2z;
      let nz = v1x * v2y - v1y * v2x;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nLen; ny /= nLen; nz /= nLen;

      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }

      const dot = Math.max(0, nx * lx + ny * ly + nz * lz);
      // High contrast directional lighting: ambient 0.22, diffuse 0.78
      const intensity = 0.22 + 0.78 * dot;

      // Clean cool ivory tone
      const r = Math.round(195 + (255 - 195) * intensity);
      const g = Math.round(200 + (255 - 200) * intensity);
      const b = Math.round(214 + (250 - 214) * intensity);
      const fill = `rgb(${r},${g},${b})`;

      const pts = `${p00.screen.sx.toFixed(1)},${p00.screen.sy.toFixed(1)} ${p10.screen.sx.toFixed(1)},${p10.screen.sy.toFixed(1)} ${p11.screen.sx.toFixed(1)},${p11.screen.sy.toFixed(1)} ${p01.screen.sx.toFixed(1)},${p01.screen.sy.toFixed(1)}`;
      // Use identical fill for stroke to eliminate dark mesh seams
      svgElements += `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="0.6" stroke-linejoin="round" />`;
    }
  }

  return svgElements;
}
