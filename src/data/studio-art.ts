/** Shared by the visible artwork, keyboard controls and descriptions. */
export const coveStages = [
 {id:'question',label:'问题',en:'THE QUESTION',text:'从一个值得追问的问题开始。',color:'#A9C4EA'},
 {id:'process',label:'过程',en:'THE PROCESS',text:'看见任务、工具与事件的过程。',color:'#C1B0DE'},
 {id:'material',label:'材料',en:'THE MATERIAL',text:'把文件和线索放回各自任务。',color:'#A9CDC3'},
 {id:'continue',label:'继续',en:'THE NEXT QUESTION',text:'已有产物，成为下一次研究的起点。',color:'#E3B8C7'},
] as const;
export const tidalEntries = [
 {label:'Web',color:'#829fb9',accent:'#406987',purpose:'主动发起一项工作',detail:'当前用户、工作区与操作权限：Cookie 与 RBAC 决定访问边界。'},
 {label:'IM',color:'#8db9ad',accent:'#347765',purpose:'从消息中接住工作',detail:'消息归属、渠道路由与上下文：Owner Gate 处理渠道消息的归属。'},
 {label:'定时任务',color:'#b3a3c7',accent:'#7a589b',purpose:'让例行工作按时发生',detail:'发生项领取、执行协调与记录：租约不是用户鉴权，也不代表跨机器分布式锁。'},
] as const;
