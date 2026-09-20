export type HandSide = 'left' | 'right';

// Full transparent-image coordinates, not the visible bounding box.
export const handAssets = {
  left: { src: 'images/hands/paper-hand-upper-left-v1.webp', width: 1536, height: 1024, fingertip: { x: 1402, y: 834 }, label: '从左上方伸来的漫画褶皱纸手' },
  right: { src: 'images/hands/paper-hand-lower-right-v1.webp', width: 1536, height: 1024, fingertip: { x: 116, y: 99 }, label: '从右下方伸来的漫画褶皱纸手' },
} as const;

export interface SceneLayout {
  contact: { x: number; y: number };
  handWidth: Record<HandSide, number>;
  rotation: Record<HandSide, number>;
  gap: { x: number; y: number };
  zoom: number;
  cameraShiftY: number;
  scrollScreens: number;
}

export const introConfig = {
  mobileBreakpoint: 640,
  scrub: true,
  desktop: {
    contact: { x: .5, y: .63 },
    handWidth: { left: .65, right: .62 },
    rotation: { left: -5, right: 3 },
    gap: { x: .25, y: .15 },
    zoom: 1.14, cameraShiftY: -.09, scrollScreens: 2.2,
  },
  mobile: {
    contact: { x: .5, y: .7 },
    handWidth: { left: 1.1, right: 1.08 },
    rotation: { left: 0, right: 3 },
    gap: { x: .32, y: .13 },
    zoom: 1.08, cameraShiftY: -.1, scrollScreens: 1.65,
  },
  timing: {
    titleOut: .12, titleDuration: .22,
    approach: .12, approachDuration: .46,
    zoom: .35, zoomDuration: .23,
    contact: .58, glowDuration: .08,
    exposure: .78, exposureDuration: .14,
    arrival: .92, arrivalDuration: .08,
  },
} satisfies {
  mobileBreakpoint: number; scrub: boolean | number;
  desktop: SceneLayout; mobile: SceneLayout;
  timing: Record<string, number>;
};
