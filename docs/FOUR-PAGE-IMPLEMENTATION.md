# 四页工作室：修改与验收说明

四个入口为 `/`、`/projects/clawtide/`、`/projects/threadcove/`、`/playground/`。First Spark 是 `/playground/#first-spark` 的页内体验，不增加独立路由。项目使用 Astro 静态输出；没有新增服务端、账户系统或外部页面运行时 API。

## 修改入口

| 想改什么 | 修改位置 |
| --- | --- |
| 首页署名、介绍、联系方式 | `src/data/site.ts` |
| 两个项目的事实、标签、章节、源码证据 | `src/data/projects.ts` |
| 实验名称、状态与说明 | `src/data/experiments.ts` |
| 粒子、布料、First Spark 开关；首页区块顺序 | `src/config/features.ts` |
| 全站颜色、字形、间距变量 | `src/styles/tokens.css` |
| 全站动效偏好 | `src/lib/motion.ts` |
| 细粒尺寸、颜色、密度 | `src/features/particles/config.ts` |
| 鼠标附近的粒子汇聚 | `src/features/particles/interaction.ts` |
| 布料大小、材质、相机、作用力 | `src/features/cloth/config.ts` |
| 布料静止轮廓、四向形变与静态海报 | `src/features/cloth/geometry.ts` |
| 布料加载、拾取、暂停和资源释放 | `src/features/cloth/controller.ts` |
| 两页案例构图与局部样式 | `src/features/cases/` |
| First Spark 加载、结束、历史与焦点 | `src/features/first-spark/player.ts` |
| 原纸手素材、指尖锚点与分镜时序 | `src/features/intro/Hand.astro`、`config.ts`、`animation.ts` |

`features.intro` 仅保留旧配置兼容，不再控制首页。首页介绍始终存在；关闭粒子只移除粒子层。关闭布料不影响项目入口。关闭 First Spark 同时移除卡片和运行时模板。删除项目数据后，不再生成对应详情页，页脚和下一项目链接跟随数据变化。

## 项目内容与媒体

Clawtide 的事实快照为 `e2f091b83df806e7b19e3de69edca0baf0b3a6d8`；ThreadCove 为 `cd9462a9b52dad708b6f3a03edbdef57c2952553`，核验日期 2026-09-16。案例中的装置和纸页是机制概念示意，不是产品截图。

本次没有采集包含真实账户、消息或研究材料的产品工作区，也没有补造 UI 截图。后续媒体应在数据中明确 `kind`、`src`、`alt`、`caption` 和取材版本。未提供公开演示地址时，不显示在线体验入口。更新产品能力文案时，应同步更新证据链接与核验日期。

## 三维布料资产

源资产就是 `geometry.ts` 的确定性程序式曲面。默认 52×46 细分，2,491 顶点，稳定 UV；同一拓扑上预计算四向形变偏移，按非负权重混合并加入射线命中点附近的有限凹陷。修改位置后重新计算法线。

材质使用 Three.js 双面 MeshPhysicalMaterial 与有限灯光。静态 SVG 由同一曲面与相机投影生成。没有外部布料模型、纤维贴图或额外图像许可依赖；这不是 Blender 工程，也不宣称自碰撞、撕裂或完整布料物理模拟。

Three.js 仅在布料可见且动效开启时加载。无 JS、系统/用户减少动效、初始化失败或运行中 WebGL context 丢失时保留静态构图。离屏和后台停帧；销毁时移除监听器、观察器、材质、几何与 WebGL 上下文。

## First Spark

默认只显示轻量 SVG 海报与说明。点击开始才克隆手部模板并动态加载 GSAP、时间轴和粒子模块。关闭恢复入口焦点、清除本实例 pin/timeline/particle 和事件；重播复用当前舞台。直接访问 hash 提供开始按钮，浏览器后退离开 hash 时关闭体验。

动效偏好遵循 `systemReduced || userReduced`，存储被禁止时仍可在当前页面切换。减少动效使用固定静态姿态，不使用曝光和钉定缩放。

## 验证范围与限制

本机 Windows / Node 24.19.0 / Microsoft Edge 153，Playwright 真实浏览器，桌面 1440×1000、短屏 1280×720、手机视口 390×844。构建和类型检查之外，覆盖四页路由、无 JS、键盘选项卡、链接、配置关闭、子路径、粒子与布料暂停、WebGL context 丢失/恢复，以及 First Spark 反向滚动、重播、十次开关、延迟加载取消、历史与焦点。

BFCache 的生命周期回调用事件模拟覆盖，不等同于所有浏览器真实缓存命中；移动端为桌面 Edge 视口模拟，没有宣称真实 iOS/Android 设备验收或现场 CWV 达标。帧间隔采样仅代表这台机器的本地测试。

## 设计与代码来源

设计参考使用 OpenDesign 的本地 Antigravity 四页草案。该运行曾生成草案文件，但最终因认证配置 TLS 请求失败终止，不能写成完整成功（草案已用于设计参考）。工程实现、前端审查与完整自动化及视觉测试由反重力账户的 Gemini 3.8 Flash High（高推理档位）完成；Codex 只做最终结果验收。全流程严格限定在当前本地仓库与已授权工件目录，未调用外部非授权模型、云端 OpenDesign 或外部 API Key 提供方。
