import type * as Three from 'three';
import type { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { suspension, type BadgeMotion } from './motion';

type ThreeModule = typeof Three;
export type BadgeContent = { name: string; role: string };

function roundedShape(T: ThreeModule, width: number, height: number, radius: number) {
  const x = -width / 2, y = -height / 2, s = new T.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function roundedPlane(T: ThreeModule, width: number, height: number, radius: number) {
  const geometry = new T.ShapeGeometry(roundedShape(T, width, height, radius), 12);
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, positions.getX(i) / width + 0.5, positions.getY(i) / height + 0.5);
  }
  return geometry;
}

function canvasTexture(T: ThreeModule, canvas: HTMLCanvasElement) {
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function frontTexture(T: ThreeModule, portrait: HTMLImageElement, content: BadgeContent) {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1350;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fafbf9'; ctx.fillRect(0, 0, 900, 1350);
  const tint = ctx.createLinearGradient(0, 0, 900, 1350);
  tint.addColorStop(0, '#e9eefb'); tint.addColorStop(0.38, '#fafbf9'); tint.addColorStop(1, '#f0ebf6');
  ctx.fillStyle = tint; ctx.fillRect(0, 0, 900, 1350);
  ctx.fillStyle = '#394358'; ctx.font = '600 29px sans-serif';
  ctx.fillText('DIGITAL ATELIER', 80, 87);
  ctx.font = '23px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#687288';
  ctx.fillText('PERSONAL / 01', 820, 87); ctx.textAlign = 'left';
  const spectrum = ctx.createLinearGradient(80, 0, 820, 0);
  spectrum.addColorStop(0, '#8aade4'); spectrum.addColorStop(0.5, '#b6a4d6'); spectrum.addColorStop(1, '#d0b0bf');
  ctx.fillStyle = spectrum; ctx.fillRect(80, 126, 740, 3);

  // The supplied photograph stays intact; the pass is composed around it.
  const photo = { x: 105, y: 171, w: 690, h: 920 };
  ctx.save(); ctx.beginPath(); ctx.roundRect(photo.x, photo.y, photo.w, photo.h, 18); ctx.clip();
  ctx.drawImage(portrait, photo.x, photo.y, photo.w, photo.h);
  ctx.restore();
  ctx.strokeStyle = '#23364f16'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(photo.x, photo.y, photo.w, photo.h, 18); ctx.stroke();
  ctx.fillStyle = '#252d3c'; ctx.font = '600 73px sans-serif'; ctx.fillText(content.name, 99, 1191);
  ctx.fillStyle = '#677189'; ctx.font = '27px monospace'; ctx.fillText(content.role, 102, 1242);
  ctx.fillStyle = '#74899a'; ctx.beginPath(); ctx.arc(114, 1300, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#798291'; ctx.font = '21px monospace'; ctx.fillText('IDEAS INTO REALITY', 136, 1308);
  ctx.textAlign = 'right'; ctx.font = '22px monospace'; ctx.fillText('01', 795, 1308);
  return canvasTexture(T, canvas);
}

function backTexture(T: ThreeModule, content: BadgeContent) {
  const canvas = document.createElement('canvas'); canvas.width = 450; canvas.height = 675;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8edf4'; ctx.fillRect(0, 0, 450, 675);
  ctx.fillStyle = '#65728b'; ctx.textAlign = 'center'; ctx.font = '120px sans-serif'; ctx.fillText('✳', 225, 290);
  ctx.fillStyle = '#3c485b'; ctx.font = '500 36px sans-serif'; ctx.fillText(content.name, 225, 380);
  ctx.fillStyle = '#7c8797'; ctx.font = '14px monospace'; ctx.fillText(content.role, 225, 422);
  ctx.font = '12px monospace'; ctx.fillText('DIGITAL ATELIER / PERSONAL PASS', 225, 600);
  return canvasTexture(T, canvas);
}

function strapTexture(T: ThreeModule, name: string) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#303b50'; ctx.fillRect(0, 0, 128, 1024);
  for (let y = 0; y < 1024; y += 4) {
    ctx.fillStyle = y % 8 ? '#ffffff12' : '#0a132522'; ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 5) { ctx.fillStyle = '#ffffff0c'; ctx.fillRect(x, 0, 1, 1024); }
  ctx.fillStyle = '#c6c9e161'; ctx.fillRect(9, 0, 2, 1024); ctx.fillRect(117, 0, 2, 1024);
  ctx.fillStyle = '#e1e5f0'; ctx.font = '500 25px sans-serif'; ctx.textAlign = 'center';
  for (const y of [250, 760]) {
    ctx.save(); ctx.translate(64, y); ctx.rotate(Math.PI / 2); ctx.fillText(name.toUpperCase() + '  /  ✳', 0, 8); ctx.restore();
  }
  const texture = canvasTexture(T, canvas);
  texture.wrapT = T.RepeatWrapping;
  return texture;
}

function coatingNormal(T: ThreeModule) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (y * size + x) * 4;
    data[at] = 128 + Math.round(Math.sin(x * 1.8 + y * 0.7) * 11);
    data[at + 1] = 128 + Math.round(Math.cos(y * 2.3 - x * 0.8) * 11);
    data[at + 2] = 255; data[at + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(8, 12);
  texture.generateMipmaps = true; texture.minFilter = T.LinearMipmapLinearFilter; texture.needsUpdate = true;
  return texture;
}

function makeRibbon(T: ThreeModule, side: number, material: Three.MeshPhysicalMaterial) {
  const count = 40, positions = new Float32Array((count + 1) * 6), uv = new Float32Array((count + 1) * 4);
  const indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    uv.set([0, i / count * 1.25, 1, i / count * 1.25], i * 4);
    if (i < count) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false;
  const curve = new T.CubicBezierCurve3(new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3());
  const point = new T.Vector3(), tangent = new T.Vector3(), across = new T.Vector3();
  const update = (end: Three.Vector3, angle: number) => {
    curve.v0.set(side * 0.84, 4.65, -0.2);
    curve.v1.set(side * 0.76 + end.x * 0.15, 3.4, -0.24);
    curve.v2.set(end.x + side * 0.2 - angle * 0.2, end.y + 0.63, 0.08 + side * angle * 0.32);
    curve.v3.copy(end); curve.v3.x += side * 0.025;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      curve.getPoint(t, point); curve.getTangent(t, tangent);
      across.set(-tangent.y, tangent.x, Math.sin(t * Math.PI) * side * 0.16).normalize().multiplyScalar(0.115);
      positions.set([point.x - across.x, point.y - across.y, point.z - across.z, point.x + across.x, point.y + across.y, point.z + across.z], i * 6);
    }
    geometry.getAttribute('position').needsUpdate = true; geometry.computeVertexNormals();
  };
  return { mesh, update };
}

/** Local geometry and the user's original portrait; no remote models or textures. */
export function createBadgeObjects(T: ThreeModule, RoundedBox: typeof RoundedBoxGeometry, portrait: HTMLImageElement, content: BadgeContent) {
  const root = new T.Group(), badge = new T.Group(); root.add(badge);
  const normal = coatingNormal(T);
  const shellMaterial = new T.MeshPhysicalMaterial({
    color: '#e2e9f3', metalness: 0.13, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.09,
    iridescence: 0.3, iridescenceIOR: 1.32, iridescenceThicknessRange: [180, 420], envMapIntensity: 0.8,
  });
  const shell = new T.Mesh(new RoundedBox(2.53, 3.75, 0.13, 4, 0.12), shellMaterial);
  shell.position.set(0, -2.25, 0); badge.add(shell);
  // Print and laminate are separate surfaces, so reflections do not bleach the portrait.
  const front = new T.Mesh(roundedPlane(T, 2.31, 3.49, 0.08), new T.MeshBasicMaterial({
    map: frontTexture(T, portrait, content), toneMapped: false,
  }));
  front.position.set(0, -2.25, 0.071); badge.add(front);
  const laminate = new T.Mesh(front.geometry, new T.MeshPhysicalMaterial({
    color: '#f5f8ff', transparent: true, opacity: 0.105, depthWrite: false,
    metalness: 0.25, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
    normalMap: normal, normalScale: new T.Vector2(0.04, 0.04),
    iridescence: 0.38, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 380], envMapIntensity: 0.65,
  }));
  laminate.position.set(0, -2.25, 0.078); badge.add(laminate);
  const back = new T.Mesh(roundedPlane(T, 2.31, 3.49, 0.08), new T.MeshPhysicalMaterial({ map: backTexture(T, content), roughness: 0.5, clearcoat: 0.8 }));
  back.position.set(0, -2.25, -0.071); back.rotation.y = Math.PI; badge.add(back);

  const metal = new T.MeshPhysicalMaterial({ color: '#dce3ef', metalness: 0.95, roughness: 0.2, clearcoat: 0.7 });
  const darkMetal = new T.MeshStandardMaterial({ color: '#535f73', metalness: 0.88, roughness: 0.27 });
  const lug = new T.Mesh(new RoundedBox(0.46, 0.36, 0.105, 3, 0.06), shellMaterial);
  lug.position.set(0, -0.39, 0); badge.add(lug);
  const slot = new T.Mesh(new RoundedBox(0.27, 0.065, 0.025, 3, 0.025), darkMetal);
  slot.position.set(0, -0.36, 0.061); badge.add(slot);
  const ring = new T.Mesh(new T.TorusGeometry(0.14, 0.033, 10, 28), metal);
  ring.scale.set(0.88, 1.18, 1); ring.position.set(0, 0.03, 0); badge.add(ring);
  const clip = new T.Mesh(new RoundedBox(0.16, 0.38, 0.09, 3, 0.038), metal);
  clip.position.set(0, -0.2, 0.035); badge.add(clip);
  const clasp = new T.Mesh(new RoundedBox(0.28, 0.125, 0.08, 3, 0.035), metal);
  clasp.position.set(0, -0.365, 0.09); badge.add(clasp);
  const seam = new T.Mesh(new T.BoxGeometry(0.018, 0.19, 0.005), darkMetal);
  seam.position.set(0.045, -0.21, 0.084); badge.add(seam);

  const strapMaterial = new T.MeshPhysicalMaterial({
    map: strapTexture(T, content.name), color: '#f3f5ff', roughness: 0.72, metalness: 0,
    sheen: 0.16, sheenColor: new T.Color('#9aa7c7'), sheenRoughness: 0.75, envMapIntensity: 0.3,
    normalMap: normal, normalScale: new T.Vector2(0.5, 0.5), side: T.DoubleSide,
  });
  const ribbons = [makeRibbon(T, -1, strapMaterial), makeRibbon(T, 1, strapMaterial)];
  ribbons.forEach(r => root.add(r.mesh));

  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = 128; shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d')!;
  ctx.scale(1, 0.5); const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#485c7b28'); gradient.addColorStop(0.5, '#485c7b10'); gradient.addColorStop(1, '#485c7b00');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const shadow = new T.Mesh(new T.PlaneGeometry(4.6, 0.92), new T.MeshBasicMaterial({ map: canvasTexture(T, shadowCanvas), transparent: true, depthWrite: false }));
  shadow.position.set(0, -3.04, -0.2); root.add(shadow);
  const tetherEnd = new T.Vector3();
  const update = (motion: BadgeMotion) => {
    badge.position.set(motion.x, motion.y, 0);
    badge.rotation.set(0.04 + Math.sin(motion.time * 0.75) * 0.018, motion.yaw, motion.tilt);
    badge.updateMatrixWorld(true);
    tetherEnd.set(0, 0.19, -0.012).applyMatrix4(badge.matrixWorld);
    ribbons.forEach(r => r.update(tetherEnd, motion.angle));
    shadow.position.x = motion.x * 0.5;
    shadow.scale.x = 1 - Math.abs(motion.angle) * 0.22;
  };
  return { root, badge, hitMesh: shell, update, anchorY: suspension.anchorY };
}
