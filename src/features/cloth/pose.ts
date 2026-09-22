import type {ClothPhysics} from './solver';
export const solverVersion=2;
export function poseKey(c:ClothPhysics){const input=JSON.stringify([solverVersion,c.width,c.height,c.segmentsX,c.segmentsY,c.bendCompliance,c.wind,c.gravity,c.damping]);let hash=2166136261;for(let i=0;i<input.length;i++)hash=Math.imul(hash^input.charCodeAt(i),16777619);return (hash>>>0).toString(16);}
export function validPose(c:ClothPhysics,entry?:{version:number;positions:number[]}){return entry?.version===solverVersion&&Array.isArray(entry.positions)&&entry.positions.length===(c.segmentsX+1)*(c.segmentsY+1)*3&&entry.positions.every(Number.isFinite)?entry.positions:undefined;}
