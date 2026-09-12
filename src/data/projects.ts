export interface Project {
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
}

// Content slots only: no unverified feature or deployment claims.
export const projects: Project[] = [
  {
    id: 'clawtide', name: 'Clawtide', index: '01', cover: 'orbit',
    category: 'SELECTED PROJECT / 01',
    summary: '一个正在展开的作品。',
    description: '这里将补充 Clawtide 的项目介绍、真实界面与开发故事。先为作品留出空间。',
    tags: ['内容待补充'],
  },
  {
    id: 'threadcove', name: 'ThreadCove', index: '02', cover: 'ribbon',
    category: 'SELECTED PROJECT / 02',
    summary: '把好奇，留给下一种可能。',
    description: '这里将补充 ThreadCove 的项目介绍、真实界面与开发故事。更多细节，随后展开。',
    tags: ['内容待补充'],
  },
];
