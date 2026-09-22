import type {ProjectMedia} from './projects';
export interface SmallProject {
 kind:'small'; id:string; title:string; summary:string; description:string;
 tags:string[]; sourceUrl:string; demoUrl?:string; status:string; date?:string;
 cover?:{src:string;alt:string;width:number;height:number};
 media?:ProjectMedia[];
 /** First Spark owns an inline stage; all other entries use the generic card. */
 stage?:'first-spark';
}
export const smallProjects:SmallProject[]=[{
 kind:'small',id:'first-spark',title:'创造亚当 / First Spark',stage:'first-spark',
 summary:'双手指尖逼近、接触瞬间的微光爆发与光尘汇聚。',
 description:'基于 Canvas2D 粒子微光与纸手图层分镜，支持正反向连续滚动叙事与指尖精确锚点对齐。',
 tags:['视觉实验','粒子','滚动叙事'],status:'交互体验就绪',
 sourceUrl:'https://github.com/Bluuok/Bluuok.github.io',
 cover:{src:'images/cases/first-spark-cover.jpg',alt:'原版纸手素材的静态构图预览',width:1000,height:600}
}];
