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
},{
 kind:'small',id:'tracedigest',title:'花笺 / TraceDigest',
 summary:'把群聊里值得记住的讨论，轻轻收好。',
 description:'花笺是一款围绕群聊内容展开的话题整理工具。按群聊、关键词和时间范围找回讨论，将摘要、关键证据与原始消息连接起来，方便逐条核对并回到聊天继续阅读。截图来自本地 Electron 实际页面，内容为合成测试群聊。',
 tags:['话题整理','证据追溯','群聊'],status:'产品界面 · 演示内容',
 sourceUrl:'https://github.com/Bluuok/Hanajian',
 cover:{src:'images/small-projects/tracedigest/01-topic-home.png',alt:'花笺话题整理界面，使用合成测试群聊展示摘要、证据与原始消息',width:1440,height:900},
 media:[
  {kind:'screenshot',src:'images/small-projects/tracedigest/01-topic-home.png',alt:'花笺在火锅话题下展示摘要、两条关键证据和原始消息',caption:'在实际页面里，从“火锅”话题走到摘要、证据与原始消息。',width:1440,height:900,dataMode:'fixture'},
  {kind:'screenshot',src:'images/small-projects/tracedigest/02-source-chat.png',alt:'花笺从关键证据返回群聊原始消息，查看上下文',caption:'点开证据，回到那条聊天，继续沿着上下文阅读。',width:1440,height:900,dataMode:'fixture'}
 ]
}];
