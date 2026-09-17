export interface Experiment {
  id: string;
  title: string;
  badge: string;
  status: string;
  summary: string;
  description: string;
  category: string;
  hash: string;
  isStageActive?: boolean;
}

export const experiments: Experiment[] = [
  {
    id: 'first-spark',
    title: '创造亚当 / First Spark',
    badge: 'VISUAL STUDY',
    status: '交互体验就绪',
    summary: '双手指尖逼近、接触瞬间的微光爆发与光尘汇聚。',
    description: '基于 Canvas2D 粒子微光与纸手图层分镜，支持正反向连续滚动叙事与指尖精确锚点对齐。',
    category: '粒子与手部叙事',
    hash: '#first-spark',
    isStageActive: false,
  },
];
