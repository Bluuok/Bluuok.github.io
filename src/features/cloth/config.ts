export interface ClothConfig {
  width: number;
  height: number;
  segmentsX: number;
  segmentsY: number;
  maxPresetWeight: number;
  maxDepression: number;
  pointerRadius: number;
  idleBreathing: number;
  damping: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  preloadMargin: string;
}

// A bounded interaction study, not a self-colliding physical cloth simulation.
export const clothConfig: ClothConfig = {
  width: 4.1,
  height: 2.85,
  segmentsX: 52,
  segmentsY: 46,
  maxPresetWeight: .65,
  maxDepression: .18,
  pointerRadius: .55,
  idleBreathing: .018,
  damping: .88,
  cameraPos: [.65, .8, 5.9],
  cameraTarget: [0, 0, 0],
  preloadMargin: '200px',
};
