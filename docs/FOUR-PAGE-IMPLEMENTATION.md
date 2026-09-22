# Four-page studio — completion review

本轮基于 `codex/four-page-studio` 的 `adee62e`，不是从旧单页重新开发。
补充分支：`codex/studio-completion-review`。建议以原雏形分支为 PR base，先审查增量，再决定是否合入原 PR #1。未自动合并、删除旧分支或修改两个产品仓库。

## 与方案的差距及实际改动

| 区域 | 雏形问题 | 本轮实现 |
| --- | --- | --- |
| 首页 | 有粒子和布料区，但艺术构图、项目媒体与实验入口仍偏骨架 | 原粒子代码保留，居中虹彩标题，独立织物段落，真实产品界面卡片与纸手海报入口 |
| 布料 | 光滑薄片，缺纤维细节；指针命中与形变质感需要校准 | 程序化褶皱网格、四向形变、raycast→UV 局部受力、指数复位、动态法线、周期性纤维法线贴图和受控 sheen；无框透明舞台 |
| Clawtide | SVG 矩形面板与三条曲线，不是三维陶瓷；个别措辞过度 | 真正带厚度和倒角的三维陶瓷构件；光路采用构件上沿相同 Bezier；有限指针转角、选入口单次光点；修正租约与权限边界描述 |
| ThreadCove | 通用说明卡片，没有独立研究台构图 | 编辑式页头、倾斜纸页、SVG 关系线、局部指针响应、可键盘选择的阶段；不使用全屏 WebGL |
| 产品证据 | 没有真实 UI 截图 | 固定源码版本的 4 张真实应用界面截图，保留产品原配色，标注 fixture / 非在线模型 |
| 小作品 | 基础条目与进入按钮 | 原纸手海报、画廊式展示、页内 First Spark、按需加载、重播/退出/焦点与历史回退；仍为四个路由 |
| 验证 | 原雏形验证不能代替修改后的验证 | 可复现 Node 24 构建、真实 Chromium/Swiftshader 浏览器脚本、逐状态截图、媒体与键盘检查 |

## 视觉结构

- `/`：粒子首屏 → 风与织物 → 两个核心项目 → 小作品入口 → 关于与联系。
- `/projects/clawtide/`：左右分栏与刚性陶瓷 → 真实界面 → 不同入口的运行路径 → 工程取舍与边界。
- `/projects/threadcove/`：研究型编辑页头 → 横向纸页台 → 真实界面 → 研究过程 → 工程取舍与边界。
- `/playground/`：实际作品目录；First Spark 只在 `/playground/#first-spark` 内展开，不建立第五页。

冷白/深灰/局部蓝紫粉保持统一。Clawtide 的暖象牙与森林绿、ThreadCove 的灰蓝只存在于各产品的真实截图中，不通过重绘截图来统一配色。

## 素材与证据来源

媒体目录：`public/images/cases/`，来源清单：`manifest.json`。

- Clawtide：`e2f091b83df806e7b19e3de69edca0baf0b3a6d8`。
- ThreadCove：`cd9462a9b52dad708b6f3a03edbdef57c2952553`。
- Clawtide 截图使用原产品前端及其浏览器 fixture，账号、消息和任务记录为合成测试数据，没有操作线上账号或真实任务。
- ThreadCove 截图通过实际本地后端、协议及 UI，模型回复来自本地 SSE 替身，不是在线大模型，也不证明研究质量。
- First Spark 海报是已有纸手 WebP 图层的轻量静态合成，非新人物素材。
- 两个产品源码只在临时目录构建；未向产品仓库写入改动。截图不包含真实密钥或个人研究文件。

`Capture product evidence` 已改为手动工作流，只生成 artifact，**不会自动提交代码**。有意更新产品媒体时，先改固定源码版本、检查输出内容与 provenance，再由维护者提交选择的文件。

## 可复现验证

源码实现快照：`3c78679b94f7e600bfe630efaab1109f7f834681`。

本轮实际结果：

- Node 24 `npm ci`、`npm run check`、`npm run build` 成功。
- Chromium **140.0.7339.16**，Linux + Swiftshader 软件 GPU。
- `scripts/studio-browser.mjs`：**126/126 检查通过**，无失败项。
- 四页分别覆盖 1440×1000 与 390×844；另有四页禁用 JavaScript 检查。
- 主站粒子存在、首页不请求原纸手图层、布料实际 WebGL 运行与纤维材质、raycast 命中、pointercancel、移出释放、系统减少动态效果与恢复。
- 陶瓷实际 WebGL 渲染、入口标签；研究纸页响应；选项卡点击与 Home 键；真实截图解码和原始分辨率。
- First Spark 主动进入、按需请求手图、滚动、重播、关闭清理 pin spacer、焦点还原、模拟历史状态退出。
- 所有四页媒体解码成功，无失败 HTTP 资源、运行时页面异常或横向溢出。

构建与浏览器运行：
https://github.com/Bluuok/Bluuok.github.io/actions/runs/35438253676

真实产品界面采集：
https://github.com/Bluuok/Bluuok.github.io/actions/runs/35437935913

构建 artifact 含 `browser-results.json`、32 张逐页/逐状态截图、源码快照和静态预览。Actions artifact 保留 7 天；过期后可通过同一脚本重建，不把临时下载地址写进站点运行时代码。

本地等价命令（Node 24，已安装 Python 3）：

```sh
npm ci
npm run check
npm run build
npm install --no-save --package-lock=false playwright@1.55.0
npx playwright install chromium
node scripts/studio-browser.mjs
```

Linux CI 首次安装 Chromium 还需要 `npx playwright install --with-deps chromium`。如本机命令为 `python` 而非 `python3`，调整浏览器脚本中的静态服务命令。浏览器脚本不读取产品或个人凭据。

## 验证发现并已修复

1. Astro 的 `aria-selected` 属性使用布尔值，避免普通字符串触发类型错误。
2. 陶瓷光路不再使用另一条近似曲线悬浮于构件外，改为采样与表面一致的路径。
3. 系统动效切换用实际状态等待验收，而不是固定 200ms 睡眠；状态不发生仍会超时失败。
4. 产品截图服务采用独立静态服务器，不让开发代理把页面导航转发至不存在的产品后台。
5. 截图采集验证真实 UI 挂载，保留失败诊断；修复 Clawtide 大小写品牌判断和 Bun 锁文件版本兼容。
6. 截图采集写回仅用于本次初始化，最终工作流已取消自动写分支权限。

## 边界与后续维护

- 本轮是可运行、可审查的四页视觉与交互补全，不宣称等同 Lusion 的商业美术完成度。最终是否喜欢布料褶皱和陶瓷构图，以浏览器实际画面评审为准。
- 布料是程序化网格 + 受控形变，不是自碰撞/撕裂/任意抓取的完整物理求解器，也没有假称 Blender 原工程或真实体积折射。
- 禁用 JavaScript / WebGL 异常时展示静态构图；静态海报不保证与实时着色器逐像素一致。
- 390px 是视口模拟，未覆盖真实手机 GPU、Safari/WebKit、Firefox、全设备 60fps 或线上 CWV。不要把软件 GPU 测试写成性能承诺。
- 图片为真实 UI + 测试数据，不作为产品在线模型和全部渠道已经验证的证据。
- 当前提供的实验目录只有 First Spark，没有以虚构项目填满画廊。新增其他小项目需要提供真实条目及媒体，并增加对应展示/体验模块。
- 本轮未重新执行原雏形全部配置变体组合；不把其旧验证记录当成本轮新增代码的验证结果。

原始方案保留在 `FOUR-PAGE-DESIGN-EXECUTION.md`；本文件描述当前已实现与已验证的部分。
