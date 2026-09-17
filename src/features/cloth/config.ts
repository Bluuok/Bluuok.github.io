export interface ClothConfig {
  segmentsX: number;
  segmentsY: number;
  width: number;
  height: number;
  color: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  sheen: number;
  sheenRoughness: number;
  sheenColor: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  pointerRadius: number;
  maxDepression: number;
  maxPresetWeight: number;
  returnDamping: number;
  maxDelta: number;
}

export const clothConfig: ClothConfig = {
  segmentsX: 52,
  segmentsY: 46,
  width: 4.8,
  height: 3.3,
  color: 0xfcfbfa, // Crisp matte ivory white
  roughness: 0.68, // Crisp directional grazing highlights on crests
  metalness: 0.01,
  clearcoat: 0.1,
  sheen: 0.48,
  sheenRoughness: 0.55,
  sheenColor: 0xdfd9f2,
  cameraPos: [1.1, 1.3, 7.8], // Increased distance & pronounced oblique perspective
  cameraTarget: [-0.2, -0.15, 0],
  pointerRadius: 0.9,
  maxDepression: 0.25,
  maxPresetWeight: 0.4,
  returnDamping: 0.08,
  maxDelta: 2.0,
};
