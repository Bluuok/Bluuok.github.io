/** Mouse behaviour is independent of the intro timeline and shape presets. */
export const pointerConfig = {
  mode: 'attract' as 'attract' | 'shape',
  radius: 200,
  attraction: .28,
  swirl: .36,
  follow: .09,
};

export function pointerInfluence(homeX: number, homeY: number, x: number, y: number) {
  const dx = homeX - x;
  const dy = homeY - y;
  const distance = Math.hypot(dx, dy);
  if (distance > pointerConfig.radius || distance < 1) return { pull: 0, swirlX: 0, swirlY: 0 };
  const t = 1 - distance / pointerConfig.radius;
  // Smooth bell curve: avoids clumping at exact cursor center
  const factor = t * t * (3 - 2 * t) * (distance / pointerConfig.radius * 1.8);
  const pull = factor * pointerConfig.attraction;
  // Gentle perpendicular swirl so particles dance around rather than collapse
  const swirl = factor * pointerConfig.swirl;
  return {
    pull,
    swirlX: (-dy / distance) * swirl * 24,
    swirlY: (dx / distance) * swirl * 24,
  };
}
