# Bluuok 个人网页

以桌面网页体验为重点的个人作品集框架。Astro + TypeScript + GSAP，输出静态文件，无数据库，无登录，无服务器 API。当前域名未配置，本地直接预览。

## 启动

推荐 Node.js 22.12+ 或 24 LTS。本机 PATH 中的旧 Node 20.18 可能不满足依赖要求；可直接双击 `start-local.cmd`，该脚本会优先选择当前机器已有的 Codex Node 24，再回退到 PATH 中的 Node。

```powershell
cd E:\zzzz\personal-site
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:4321 。新版 Astro 使用后台开发服务；双击 `stop-local.cmd` 停止本站服务。安装依赖只在首次需要联网；网页使用本地代码与素材，无远程字体或页面运行时 API。

```powershell
npm run check
npm run build
npm run preview
```

## 最常改的地方

| 修改 | 文件 |
| --- | --- |
| 署名、首页文案、GitHub、邮箱 | `src/data/site.ts` |
| 项目名称、简介、标签、图片、源码和演示链接 | `src/data/projects.ts` |
| 开场开关、区块顺序与移除 | `src/config/features.ts` |
| 色彩、字体、留白变量 | `src/styles/tokens.css` |
| 通用布局、卡片、响应式 | `src/styles/global.css` |
| 开场布局与构图 | `src/features/intro/Intro.astro`、`intro.css` |
| 手部位置、角度、大小、接触点、动画时序 | `src/features/intro/config.ts` |
| 光尘密度、亮度、字符/图案、位置与两段切换 | `src/features/particles/config.ts` |
| 双手、缩放与柔光时间轴 | `src/features/intro/animation.ts` |
| 手部图层结构 | `src/features/intro/Hand.astro` |
| 项目详情模板 | `src/pages/projects/[id].astro` |

`projects.ts` 增加一个对象即可增加卡片与详情页；删除对象则同时删除两处。未填源码/演示地址时不显示对应按钮。为 image 填入 `/images/文件名.webp`（部署子路径时加上 base 前缀），图像放入 public/images。公共项目资料现为待填框架，无伪造截图或成果。

设置 `features.intro = false` 可切换为普通静态首屏；完整移除开场时，再删 index.astro 中 Intro 的 import 与调用、删除 `src/features/intro/`，并卸载 gsap。各正文区块不依赖开场。修改 sections 数组可重排/删除区块，顶部导航跟随；开场链接指向第一个可用区块。

## 目录

```text
src/
  config/       开关与区块注册
  data/         个人与项目内容
  components/   导航、页脚、项目卡片与概念封面
  features/intro/  独立开场模块
  features/particles/  光尘、图案采样与渲染模块
  sections/     独立正文区块
  layouts/      页面外壳与元信息
  pages/        静态路由
  styles/       视觉变量与通用样式
public/         本地静态资源
```

`DESIGN.md` 记录视觉规则与六个分镜。`docs/CUSTOMIZATION.md` 详细说明手部位置和鼠标粒子的修改方法；生图与图层提取提示词保存在 `docs/artwork/PROMPTS.md`。`VERIFICATION.md` 记录实际验证。

## 后续部署

构建产物在 `dist/`，可托管到支持静态文件的服务。购买域名后只需配置 astro.config.mjs 的 `site`；GitHub Pages 仓库子路径需同时配置 `base`。本轮不发布、不修改任何已有项目或 GitHub 仓库。
