export interface ProjectMedia {
  kind:'concept'|'screenshot'|'recording'; src:string; alt:string; caption:string;
  commit:string; width:number; height:number; dataMode:'fixture'|'live'|'artwork';
}
export interface Project {
  id:string;name:string;index:string;cover:'orbit'|'ribbon';category:string;
  summary:string;description:string;tags:string[];sourceUrl:string;demoUrl?:string;
  image?:string;imageAlt?:string;caseKind:'clawtide'|'threadcove';verifiedCommit:string;verifiedDate:string;
  media:ProjectMedia[];
  mechanisms:{step:string;title:string;desc:string;tag:string}[];
  tradeoffs:{title:string;summary:string;detail:string;sourceRef:string;sourceUrl:string}[];
}
const clawCommit='e2f091b83df806e7b19e3de69edca0baf0b3a6d8';
const threadCommit='cd9462a9b52dad708b6f3a03edbdef57c2952553';
const reference=(repo:string,commit:string)=>`https://github.com/Bluuok/${repo}/blob/${commit}/README.md`;
export const projects:Project[]=[{
  id:'clawtide',name:'Clawtide',index:'01',cover:'orbit',category:'SELECTED WORK / 01',caseKind:'clawtide',
  summary:'让数字员工，在自己的工作区里持续工作。',
  description:'一个自托管、多用户的 AI 数字员工平台。Web、即时消息与定时任务连接同一运行时，身份与工作区边界分别管理。',
  tags:['自托管','工作区与权限','主动 / 被动触发'],sourceUrl:'https://github.com/Bluuok/Clawtide',verifiedCommit:clawCommit,verifiedDate:'2026-09-16',
  media:[
    {kind:'screenshot',src:'images/cases/clawtide-chat.jpg',alt:'Clawtide 真实会话界面，使用本地固定测试数据',caption:'会话与工作区。界面来自固定版本原应用；示例消息为浏览器测试数据，不代表真实模型执行。',commit:clawCommit,width:1440,height:960,dataMode:'fixture'},
    {kind:'screenshot',src:'images/cases/clawtide-tasks.jpg',alt:'Clawtide 真实任务界面，使用本地固定测试数据',caption:'定时任务配置与列表。测试任务只在截图用的浏览器内构造，没有创建线上任务。',commit:clawCommit,width:1440,height:960,dataMode:'fixture'}],
  mechanisms:[
    {step:'01',tag:'ENTRY',title:'从不同入口开始',desc:'Web 操作、Telegram / 飞书消息或定时发生项发起工作。'},
    {step:'02',tag:'BOUNDARY',title:'先确定边界',desc:'Web 使用 Cookie 与 RBAC；IM 使用 Owner Gate；调度器领取发生项租约。这些不是同一种鉴权。'},
    {step:'03',tag:'RUNTIME',title:'进入对应上下文',desc:'入口完成归属与路由决策后，把消息交给统一 AgentRuntime 执行路径。'},
    {step:'04',tag:'FEEDBACK',title:'留下状态与结果',desc:'记录任务状态，向对应入口反馈。通知重试不应重新执行已经完成的任务。'}],
  tradeoffs:[
    {title:'统一执行，不抹平入口差异',summary:'把共用逻辑留在运行时，把不同的身份与路由规则留在入口。',detail:'调度租约负责领取与续约，不是用户鉴权，也不据此宣称跨机器分布式锁。',sourceRef:'入口与调度器说明',sourceUrl:reference('Clawtide',clawCommit)},
    {title:'发生项与通知，分开处理',summary:'任务执行状态与通知重试状态分开。',detail:'SQLite 单写者基础上的条件更新决定发生项领取；过期租约区分未开始与已开始的运行。',sourceRef:'R14 任务生命周期',sourceUrl:reference('Clawtide',clawCommit)},
    {title:'能力边界写在明处',summary:'Telegram、飞书与其他骨架适配器明确区分。',detail:'模型执行仍需要部署者提供有效配置。测试替身、连接测试和真实模型执行不作为同一种证据。',sourceRef:'渠道状态与运行要求',sourceUrl:reference('Clawtide',clawCommit)}]
},{
  id:'threadcove',name:'ThreadCove',index:'02',cover:'ribbon',category:'SELECTED WORK / 02',caseKind:'threadcove',
  summary:'把零散的线索，整理成可以继续的研究。',description:'面向个人深度研究的信息分析工作台。独立任务、Agent 后端与统一事件流，在 Electron 与 Web 之间延续同一套工作方式。',
  tags:['个人研究','任务隔离','统一事件流'],sourceUrl:'https://github.com/Bluuok/ThreadCove',verifiedCommit:threadCommit,verifiedDate:'2026-09-16',
  media:[
    {kind:'screenshot',src:'images/cases/threadcove-empty.jpg',alt:'ThreadCove 真实 FIELDNOTES 工作台初始状态',caption:'原应用的 FIELDNOTES 工作台。截图使用临时工作区，没有载入个人研究材料。',commit:threadCommit,width:1440,height:1000,dataMode:'fixture'},
    {kind:'screenshot',src:'images/cases/threadcove-conversation.jpg',alt:'ThreadCove 真实任务与对话界面，本地 SSE 测试回复',caption:'真实应用经过本地协议和后端处理测试回复。回复来自本地 SSE 替身，不是在线模型，不作为研究质量证据。',commit:threadCommit,width:1440,height:1000,dataMode:'fixture'}],
  mechanisms:[
    {step:'01',tag:'QUESTION',title:'先把问题留下',desc:'新建研究任务，为它分配独立的 Session 和工作目录。'},
    {step:'02',tag:'PROCESS',title:'过程可以被看见',desc:'选择已配置的后端，查看文本、工具和状态事件；必要时停止或继续。'},
    {step:'03',tag:'MATERIAL',title:'材料回到各自任务',desc:'来源、文件和会话内容围绕当前任务组织，不把不同任务的工作目录混在一起。'},
    {step:'04',tag:'CONTINUE',title:'留出继续研究的入口',desc:'重新打开已有任务，阅读会话和已有产物。结论仍需要使用者判断与核验。'}],
  tradeoffs:[
    {title:'每个任务，有自己的上下文',summary:'Session 与独立目录是任务隔离的基础。',detail:'这是一种工程边界，不保证模型生成的结论天然可靠。',sourceRef:'Session / Workspace',sourceUrl:reference('ThreadCove',threadCommit)},
    {title:'统一词表，而非统一能力',summary:'AgentEvent 让客户端读取同一种事件结构。',detail:'后端支持的能力依旧可能不同；事件适配不能把这些差异隐藏成能力相同。',sourceRef:'AgentBackend / EventQueue',sourceUrl:reference('ThreadCove',threadCommit)},
    {title:'共享传输，保留本地边界',summary:'Electron 与 Web 复用协议，同时分类 LOCAL_ONLY 与 REMOTE_ELIGIBLE。',detail:'个人研究工具，不宣称企业级多用户治理、监控或容灾。',sourceRef:'通道分类与项目范围',sourceUrl:reference('ThreadCove',threadCommit)}]
}];
