export interface ProjectMedia {
  kind:'concept'|'screenshot'|'recording'; src:string; alt:string; caption:string; label?:string;
  commit?:string; width:number; height:number; dataMode:'fixture'|'live'|'artwork';
}
export interface CoreProject {
  kind: 'case'; featured: boolean;
  id:string;name:string;index:string;cover:'orbit'|'ribbon';category:string;
  summary:string;description:string;tags:string[];sourceUrl:string;demoUrl?:string;
  image?:string;imageAlt?:string;caseKind:'clawtide'|'threadcove';verifiedCommit:string;verifiedDate:string;
  media:ProjectMedia[]; mediaNote?:string; mediaHeading?:string; workflow?:string[];
  mechanisms:{step:string;title:string;desc:string;tag:string}[];
  tradeoffs:{title:string;summary:string;detail:string;sourceRef:string;sourceUrl:string}[];
}
const clawCommit='7ff39bab5d8b3e5695cd49bb05070285a480cce6';
const threadCommit='c21b9e28cd38e77e05c60d4f41a7ec9b90f4dddd';
const reference=(repo:string,commit:string)=>`https://github.com/Bluuok/${repo}/blob/${commit}/README.md`;
export const coreProjects:CoreProject[]=[{
  kind:'case',featured:true,id:'clawtide',name:'Clawtide',index:'01',cover:'orbit',category:'SELECTED WORK / 01',caseKind:'clawtide',
  summary:'让灵感有回响，让工作有着落。',
  description:'Clawtide 是一个支持自托管的 AI 数字员工平台，将角色设定、日常对话与计划任务汇聚在统一的工作空间中。从定义一位数字员工，到交付任务、查看结果，再到调整下一次协作，让 AI 自然融入持续的工作流程。深绿与暖白构成安静的底色，海岸意象与雕塑细节，为工具界面增添一份从容。',
  tags:['自托管','数字员工','工作区与计划任务'],sourceUrl:'https://github.com/Bluuok/Clawtide',verifiedCommit:clawCommit,verifiedDate:'2026-09-22',
  mediaHeading:'从品牌，走进工作台。',
  mediaNote:'品牌主视觉与本地实际页面。界面中的 integration_admin、Profile A/B 为测试展示名称。',
  workflow:['建立工作区','设定数字员工','对话交办或安排任务','查看结果与执行记录','调整并继续协作'],
  media:[
    {kind:'concept',label:'品牌主视觉',src:'images/cases/clawtide/01-brand.gif',alt:'Clawtide 深绿与暖白的海岸雕塑品牌动图',caption:'为重要的事，留一点空间。品牌视觉动图。',width:1200,height:560,dataMode:'artwork'},
    {kind:'screenshot',label:'工作区',src:'images/cases/clawtide/02-workspaces.png',alt:'Clawtide 工作区实际页面，居中的海岸封面卡片用于组织会话与任务',caption:'让每项工作各得其所。',width:1440,height:900,dataMode:'fixture'},
    {kind:'screenshot',label:'数字员工',src:'images/cases/clawtide/03-profiles.png',alt:'Clawtide 数字员工实际页面，展示身份、价值观、工作规则与工具四项设定',caption:'赋予每一次协作鲜明的个性。',width:1440,height:900,dataMode:'fixture'}],
  mechanisms:[
    {step:'01',tag:'WORKSPACE',title:'工作各归其位',desc:'通过工作区组织不同主题的会话与任务。'},
    {step:'02',tag:'PERSONALITY',title:'协作各有性格',desc:'为数字员工设定身份、工作方式与工具规则。'},
    {step:'03',tag:'FOLLOW THROUGH',title:'任务形成闭环',desc:'从即时交办到定时执行，结果与记录都有迹可循。'}],
  tradeoffs:[
    {title:'统一执行，不抹平入口差异',summary:'把共用逻辑留在运行时，把不同的身份与路由规则留在入口。',detail:'调度租约负责领取与续约，不是用户鉴权，也不据此宣称跨机器分布式锁。',sourceRef:'入口与调度器说明',sourceUrl:reference('Clawtide',clawCommit)},
    {title:'发生项与通知，分开处理',summary:'任务执行状态与通知重试状态分开。',detail:'SQLite 单写者基础上的条件更新决定发生项领取；过期租约区分未开始与已开始的运行。',sourceRef:'R14 任务生命周期',sourceUrl:reference('Clawtide',clawCommit)},
    {title:'能力边界写在明处',summary:'Telegram、飞书与其他骨架适配器明确区分。',detail:'模型执行仍需要部署者提供有效配置。测试替身、连接测试和真实模型执行不作为同一种证据。',sourceRef:'渠道状态与运行要求',sourceUrl:reference('Clawtide',clawCommit)}]
},{
  kind:'case',featured:true,id:'threadcove',name:'ThreadCove',index:'02',cover:'ribbon',category:'SELECTED WORK / 02',caseKind:'threadcove',
  summary:'让零散线索，长成自己的洞见。',description:'ThreadCove 是一个以对话为起点的 AI 研究工作台。将提问、资料探索、持续追问与成果整理连接在一起，让灵感逐渐成为清晰的结论，也让每一次探索留下可以继续的线索。',
  tags:['对话研究','线索探索','研究档案'],sourceUrl:'https://github.com/Bluuok/ThreadCove',verifiedCommit:threadCommit,verifiedDate:'2026-09-22',
  mediaNote:'原应用界面 · 人工准备的演示主题与本地演示服务，非在线模型研究记录。',
  workflow:['提出问题','探索资料','追问整理','沉淀结论','保存归档','继续研究'],
  media:[
    {kind:'screenshot',label:'提出问题',src:'images/cases/threadcove/01-research-home.png',alt:'ThreadCove 雾蓝色研究工作台首页，包含研究流程与提问入口',caption:'从一个好问题开始。',commit:threadCommit,width:1440,height:1000,dataMode:'fixture'},
    {kind:'screenshot',label:'沿线索深入',src:'images/cases/threadcove/02-research-conversation.png',alt:'ThreadCove 对话研究界面，展示个人知识库主题的演示问答',caption:'沿着线索，让思考逐渐清晰。',commit:threadCommit,width:1440,height:1000,dataMode:'fixture'},
    {kind:'screenshot',label:'留下研究档案',src:'images/cases/threadcove/03-research-notes.png',alt:'ThreadCove 对话旁打开资料与执行侧栏，查看研究笔记文件',caption:'将探索留下，成为下一次研究的起点。',commit:threadCommit,width:1440,height:1000,dataMode:'fixture'}],
  mechanisms:[
    {step:'01',tag:'QUESTION',title:'从问题出发',desc:'把一个模糊的想法，展开成值得探索的研究。'},
    {step:'02',tag:'EXPLORE',title:'沿线索深入',desc:'在对话中追问，结合网页搜索与工具协作整理思路。'},
    {step:'03',tag:'ARCHIVE',title:'留下研究档案',desc:'保存对话与任务文件，随时回到上下文继续探索。'}],
  tradeoffs:[
    {title:'每个任务，有自己的上下文',summary:'Session 与独立目录是任务隔离的基础。',detail:'这是一种工程边界，不保证模型生成的结论天然可靠。',sourceRef:'Session / Workspace',sourceUrl:reference('ThreadCove',threadCommit)},
    {title:'统一词表，而非统一能力',summary:'AgentEvent 让客户端读取同一种事件结构。',detail:'后端支持的能力依旧可能不同；事件适配不能把这些差异隐藏成能力相同。',sourceRef:'AgentBackend / EventQueue',sourceUrl:reference('ThreadCove',threadCommit)},
    {title:'共享传输，保留本地边界',summary:'Electron 与 Web 复用协议，同时分类 LOCAL_ONLY 与 REMOTE_ELIGIBLE。',detail:'个人研究工具，不宣称企业级多用户治理、监控或容灾。',sourceRef:'通道分类与项目范围',sourceUrl:reference('ThreadCove',threadCommit)}]
}];

/** Only explicitly selected core cases appear on the home page. */
export const selectedProjects=coreProjects.filter(project=>project.featured);
