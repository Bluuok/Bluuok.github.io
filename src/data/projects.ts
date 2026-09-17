export type MediaKind = 'concept' | 'screenshot' | 'recording';

export interface ProjectMedia {
  kind: MediaKind;
  src?: string;
  alt: string;
  caption: string;
  commit?: string;
}

export interface ProjectChapter {
  id: string;
  title: string;
}

export interface Project {
  // Legacy fields preserved for compatibility
  id: string;
  name: string;
  index: string;
  cover: 'orbit' | 'ribbon';
  category: string;
  summary: string;
  description: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  sourceUrl?: string;
  demoUrl?: string;

  // Extended typed fields
  caseKind: 'clawtide' | 'threadcove';
  verifiedCommit: string;
  verifiedDate: string;
  hasScreenshots: boolean; // false: omit screenshot section & nav links
  media?: ProjectMedia[];
  chapters?: ProjectChapter[];
  mechanisms?: { step: string; title: string; desc: string; tag?: string }[];
  tradeoffs?: { title: string; summary: string; detail: string; sourceRef: string; sourceUrl: string }[];
}

export const projects: Project[] = [
  {
    id: 'clawtide',
    name: 'Clawtide',
    index: '01',
    cover: 'orbit',
    category: 'SELECTED WORK / 01',
    summary: '自托管、多用户的 AI 数字员工平台。',
    description: '提供 Web、IM 与定时任务三类入口，支持工作区、身份与权限管理。',
    tags: ['多用户工作区', '多通道入口', '自托管部署'],
    sourceUrl: 'https://github.com/Bluuok/Clawtide',
    caseKind: 'clawtide',
    verifiedCommit: 'e2f091b83df806e7b19e3de69edca0baf0b3a6d8',
    verifiedDate: '2026-09-16',
    hasScreenshots: false,
    chapters: [
      { id: 'overview', title: '概览' },
      { id: 'mechanism', title: '执行管道' },
      { id: 'tradeoffs', title: '工程取舍' },
    ],
    mechanisms: [
      {
        step: '01',
        title: '多通道触发',
        desc: 'Web 前端、IM 机器人（Telegram/飞书）或定时调度任务发起调用。',
        tag: 'Entry',
      },
      {
        step: '02',
        title: '入口鉴权与路由',
        desc: 'IM 经 Owner Gate 校验，Web 经 Cookie/RBAC 校验，调度器声明租约锁。',
        tag: 'Boundary',
      },
      {
        step: '03',
        title: '运行时消息汇聚',
        desc: '不同入口统一汇入 AgentRuntime.sendMessage 处理上下文与会话调度。',
        tag: 'Runtime',
      },
      {
        step: '04',
        title: '执行审计与反馈',
        desc: '记录任务状态与运行日志，并将结果返回对应触发通道。',
        tag: 'Feedback',
      },
    ],
    tradeoffs: [
      {
        title: '入口统一但鉴权分别管理',
        summary: 'Web Cookie/RBAC、IM Owner Gate 与调度器租约锁分别鉴权，最终汇聚于统一运行时。',
        detail: '不同入口具有截然不同的会话与权限生命周期，在入口处进行归属决策，避免将外部复杂性带入 AgentRuntime。',
        sourceRef: 'README lines 25-32',
        sourceUrl: 'https://github.com/Bluuok/Clawtide/blob/e2f091b83df806e7b19e3de69edca0baf0b3a6d8/README.md',
      },
      {
        title: '真实连接器与骨架适配器分离',
        summary: 'Telegram 与飞书已接入真实连接器，其余适配器保留结构骨架。',
        detail: '项目清晰区分已实现的连接器与骨架实现，不夸大已接通渠道，确保代码库边界可预期。',
        sourceRef: 'README lines 93-104',
        sourceUrl: 'https://github.com/Bluuok/Clawtide/blob/e2f091b83df806e7b19e3de69edca0baf0b3a6d8/README.md',
      },
      {
        title: '自托管配置与运行责任',
        summary: '多用户工作区与凭据由部署者本地治理，任务使用独立的工作目录。',
        detail: '作为自托管系统，由部署者自行维护模型密钥与服务环境，系统核心聚焦于本地工作区组织与通道集成。',
        sourceRef: 'README lines 7-10',
        sourceUrl: 'https://github.com/Bluuok/Clawtide/blob/e2f091b83df806e7b19e3de69edca0baf0b3a6d8/README.md',
      },
    ],
  },
  {
    id: 'threadcove',
    name: 'ThreadCove',
    index: '02',
    cover: 'ribbon',
    category: 'SELECTED WORK / 02',
    summary: '面向个人深度研究的结构化工作台。',
    description: '采用 FIELDNOTES 纸面哲学，组织独立研究任务、多 Agent 后端调度与规范化事件流。',
    tags: ['个人深度研究', '统一事件流', 'Electron/Web 协议'],
    sourceUrl: 'https://github.com/Bluuok/ThreadCove',
    caseKind: 'threadcove',
    verifiedCommit: 'cd9462a9b52dad708b6f3a03edbdef57c2952553',
    verifiedDate: '2026-09-16',
    hasScreenshots: false,
    chapters: [
      { id: 'overview', title: '概览' },
      { id: 'papers', title: '线索纸桌' },
      { id: 'architecture', title: '事件架构' },
      { id: 'tradeoffs', title: '工程取舍' },
    ],
    mechanisms: [
      {
        step: '01',
        title: '命题与任务建立',
        desc: '在 FIELDNOTES 索引中建立独立研究任务，分配专属 Session 与目录。',
        tag: 'Session',
      },
      {
        step: '02',
        title: '多 Agent 后端适配',
        desc: '通过 AgentBackend 抽象层统一对接不同模型驱动。',
        tag: 'Backend',
      },
      {
        step: '03',
        title: '统一 AgentEvent 事件流',
        desc: '将流式输出、工具调用与过程状态规范化为统一事件词汇。',
        tag: 'AgentEvent',
      },
      {
        step: '04',
        title: '研究产物沉淀',
        desc: '任务与产物在独立工作目录中组织于工作区，方便持续归纳。',
        tag: 'Fieldnotes',
      },
    ],
    tradeoffs: [
      {
        title: 'Session 与工作目录独立',
        summary: '每个研究任务分配独立的 Session 和本地工作目录。',
        detail: '针对个人深度研究的上下文纯净度要求，隔离任务工作目录，支持各研究线程独立进行。',
        sourceRef: 'README lines 16-18, 24-27',
        sourceUrl: 'https://github.com/Bluuok/ThreadCove/blob/cd9462a9b52dad708b6f3a03edbdef57c2952553/README.md',
      },
      {
        title: '接口与事件归一不保证能力一致',
        summary: 'AgentBackend 与 AgentEvent 规范化事件词汇，不暗示各后端模型能力完全对齐。',
        detail: '统一客户端接收事件的协议格式，简化前端展现逻辑，同时保留各后端模型自身的实现与能力特点。',
        sourceRef: 'README lines 24-27, 33-36',
        sourceUrl: 'https://github.com/Bluuok/ThreadCove/blob/cd9462a9b52dad708b6f3a03edbdef57c2952553/README.md',
      },
      {
        title: 'Electron 与 Web 传输复用及 LOCAL_ONLY 边界',
        summary: '复用统一传输协议，明确区分 LOCAL_ONLY 与 REMOTE_ELIGIBLE RPC 边界。',
        detail: '桌面端利用本地进程通信，Web 端复用协议实现远程访问，在代码复用的同时保持清晰的访问边界。',
        sourceRef: 'README lines 27-28, 56-59',
        sourceUrl: 'https://github.com/Bluuok/ThreadCove/blob/cd9462a9b52dad708b6f3a03edbdef57c2952553/README.md',
      },
    ],
  },
];
