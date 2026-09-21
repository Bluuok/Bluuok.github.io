import type { ClothPhysics } from './solver';
export interface ClothConfig extends ClothPhysics {
  cameraPos:[number,number,number]; cameraTarget:[number,number,number]; paper?:boolean;
}
export const clothConfig:ClothConfig={width:4.1,height:2.85,segmentsX:28,segmentsY:22,
  bendCompliance:.0003,wind:1.25,gravity:-4,damping:1.5,
  cameraPos:[.4,.15,7.4],cameraTarget:[0,-.3,0]};
export const paperConfig:ClothConfig={width:1.65,height:2.5,segmentsX:16,segmentsY:24,
  bendCompliance:.000002,wind:.65,gravity:-5,damping:2.1,paper:true,
  cameraPos:[.6,.2,9.2],cameraTarget:[0,-.25,0]};
