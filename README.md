# Bluuok · Digital Atelier

冷白底的四页个人作品集，使用 Astro、TypeScript、Canvas 2D、GSAP 和按需加载的 Three.js，输出纯静态文件。

| 页面 | 内容 |
| --- | --- |
| `/` | 细粒光尘、可交互三维布料、精选项目与个人介绍 |
| `/projects/clawtide/` | 陶瓷刻槽装置、任务入口与工程取舍 |
| `/projects/threadcove/` | 纸面研究台、研究任务与后端接口 |
| `/playground/` | 小作品与实验；点击后进入 First Spark 双手滚动体验 |

First Spark 使用 `/playground/#first-spark`，不增加第五个路由。默认页面不加载手部图像或 GSAP 时间轴。

## 本地运行

使用 Node.js 24。Windows 可以使用仓库内的 `start-local.cmd`，它优先选择本机已有的 Node 24；`stop-local.cmd` 停止本站服务。

```sh
npm install
npm run dev
```

默认打开 `http://127.0.0.1:4321`。页面不依赖远程字体、数据库、账户或运行时 API。

```sh
npm run check
npm run build
npm run preview
```

## 常用修改入口

| 修改内容 | 文件或目录 |
| --- | --- |
| 作者信息、首页文案与联系方式 | `src/data/site.ts` |
| 项目事实、媒体类型与源码证据 | `src/data/projects.ts` |
| 实验目录 | `src/data/experiments.ts` |
| 独立功能开关、首页区块顺序 | `src/config/features.ts` |
| 色彩、字体、留白 | `src/styles/tokens.css` |
| 粒子外观与鼠标作用范围 | `src/features/particles/config.ts`、`interaction.ts` |
| 布料网格、四向形变、材质与相机 | `src/features/cloth/` |
| 两个项目页的构图 | `src/features/cases/` |
| 实验加载、关闭、重播与历史 | `src/features/first-spark/` |
| 原双手素材、指尖锚点与滚动分镜 | `src/features/intro/` |

各项目页以数据描述真实能力；概念图不标成产品截图。未提供的媒体和演示地址不补造。关闭粒子不会删除首页介绍；关闭布料不影响正文；关闭 First Spark 不影响其他页面。`features.intro` 是旧配置兼容字段，不再控制首页。

详见 [四页修改与验收说明](docs/FOUR-PAGE-IMPLEMENTATION.md) 和 [原始设计执行方案](docs/FOUR-PAGE-DESIGN-EXECUTION.md)。旧纸手与粒子的细节说明保留在 [CUSTOMIZATION.md](docs/CUSTOMIZATION.md)。

## 构建与部署

构建结果位于 `dist/`。部署到子目录时配置 `astro.config.mjs` 的 `base`，站内 URL 使用统一 helper。合并或部署前请检查当前 PR 的截图和验证记录；本地浏览器结果不等同于真实移动设备或现场 CWV。
