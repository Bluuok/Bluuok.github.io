/** Raw pointer path drives forces; inertia belongs to particles, not the input. */
export const pointerConfig = {
  mode: 'attract' as 'attract' | 'shape', radius: 200,
  attraction: .28, swirl: .36, impulse: .075, maxImpulse: 7,
};
export interface PointerSample { x: number; y: number }
export function pointerInfluence(px: number, py: number, x: number, y: number, previous: PointerSample = {x,y}) {
  const sx=x-previous.x, sy=y-previous.y, length2=sx*sx+sy*sy;
  const t=length2 ? Math.max(0,Math.min(1,((px-previous.x)*sx+(py-previous.y)*sy)/length2)) : 1;
  const dx=px-(previous.x+t*sx), dy=py-(previous.y+t*sy);
  const distance=Math.hypot(dx,dy);
  const falloff=Math.max(0,1-distance/pointerConfig.radius);
  const weight=falloff*falloff*(3-2*falloff);
  const speed=Math.hypot(sx,sy), impulse=Math.min(pointerConfig.maxImpulse,speed*pointerConfig.impulse)*weight;
  return { pull:weight*pointerConfig.attraction,
    swirlX:-dy/Math.max(1,distance)*weight*pointerConfig.swirl,
    swirlY:dx/Math.max(1,distance)*weight*pointerConfig.swirl,
    impulseX:sx/Math.max(1,speed)*impulse, impulseY:sy/Math.max(1,speed)*impulse };
}
