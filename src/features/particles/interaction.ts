/** Mouse behaviour is independent of the intro timeline and shape presets. */
export const pointerConfig = {
  mode: 'attract' as 'attract' | 'shape',
  radius: 230,
  attraction: .78,
  follow: .12,
};

export function pointerInfluence(homeX: number, homeY: number, x: number, y: number) {
  const distance = Math.hypot(homeX - x, homeY - y);
  const t = Math.max(0, 1 - distance / pointerConfig.radius);
  return t * t * (3 - 2 * t) * pointerConfig.attraction;
}
