# 调整手部与粒子

正式项目目录：`E:\zzzz\personal-site`。修改后刷新本地网页即可；项目介绍和卡片仍由 `src/data/projects.ts` 管理。

## 手的位置、大小、姿态

编辑 `src/features/intro/config.ts`：

| 参数 | 含义 |
| --- | --- |
| `desktop.contact.x / y` | 接触点在舞台中的横纵位置，0–1，例如 `.5` 为居中 |
| `desktop.gap.x / y` | 初始指尖相对接触点的横纵间距，按舞台比例；左手向左上偏，右手向右下偏 |
| `desktop.handWidth.left / right` | 每只手的宽度与舞台宽度之比；左右可分别调整 |
| `desktop.rotation.left / right` | 绕指尖旋转的角度；正数为顺时针 |
| `desktop.zoom` | 接近时镜头倍率 |
| `desktop.cameraShiftY` | 镜头相对舞台高度的垂直移动量，负值向上 |
| `desktop.scrollScreens` | 完成序章额外滚动的视口数 |
| `mobile` | 同样的参数，仅作用于较窄屏幕 |
| `mobileBreakpoint` | 手机与桌面手部布局、动画共用的断点；文字排版有独立的常规 CSS 断点 |
| `timing` | 接近、缩放、触碰、白化、正文浮现的时间轴进度 |

双手锚点已按原图指尖标定。改 `gap` 或 `rotation` 不需要重新猜接触坐标。换图时修改 `handAssets` 的图片路径、原始尺寸与 `fingertip` 像素坐标，保留真实透明背景。

正式 WebP 素材位于 `public/images/hands/`，两张合计约 370 KiB；PNG 母版与白底边缘检查图同时保留。完整生成与提取提示词见 `docs/artwork/PROMPTS.md`。图片由内置 ImageGen 生成，之后对纯色背景执行透明提取；没有使用 CLI 生图。

## 两段光尘：图案与汇聚

编辑 `src/features/particles/config.ts`：

| 参数 | 含义 |
| --- | --- |
| `count / mobileCount / density / maxParticles` | 桌面基准数量、手机数量、密度倍率、数量上限 |
| `region.x / y / width / height` | 粒子分布区域，按容器比例 0–1 |
| `shape.type` | `spark` 为星芒图案，`text` 为字符 |
| `shape.text` | `type: 'text'` 时显示的字符，例如 `B`；建议一个字母或短符号 |
| `shape.center.x / y` | 图案中心相对容器的位置，默认 `.5 / .7` |
| `shape.size` | 图案尺寸，单位 CSS 像素 |
| `shape.triggerRadius` | 鼠标靠近图案时的触发半径 |
| `shape.particleRatio` | 参与组成图案的光尘比例 |
| `phases.shapeEnd / gatherEnd / coreEnd / fadeEnd` | 图案、汇聚、光核、淡出的结束进度；默认 `.28 / .70 / .76 / .92`，按顺序调整 |
| `shapeForce / gatherForce` | 组成图案、后段汇聚的力度 |
| `gatherRadius` | 最终汇聚光核的范围，单位 CSS 像素；默认 `62` |
| `returnForce` | 回到原分布位置的力度 |
| `friction` | 速度保留比例，越高惯性越明显 |
| `drift` | 无鼠标时漂浮幅度 |
| `minRadius / maxRadius / opacity / colors` | 光尘大小、透明度与光晕配色；白亮芯由渲染器绘制 |
| `bloomScale` | 柔光层分辨率，越小工作量越低 |

第一段鼠标靠近光尘后组成图案，移开后散开。第二段随滚动向双手之间汇聚，再跟随开场曝光淡出。倒滚可恢复前段互动。

在其他区块中复用时，导入 `ParticleField.astro`，放入 `position: relative` 且有高度的容器中，可直接传入上述选项。没有开场时间轴时仍可独立执行图案交互。

```astro
<ParticleField shape={{ type: 'text', text: 'B', center: { x: .5, y: .65 } }} />
```

需要接入别的动画时，调用组件元素的 `setScene({ progress, focus: { x, y } })`；进度和坐标均为 0–1。开场通过这个接口单向提供真实指尖中点，不要求粒子模块了解手部 DOM 或 GSAP。参数与默认值在 `config.ts`，图案采样在 `targets.ts`，光晕绘制在 `renderer.ts`，运动和生命周期在 `field.ts`。

组件跟随容器定位，鼠标事件来自父容器；销毁时会清理帧循环、监听器与观察器。图案中心与汇聚焦点分别控制，移动图案不会改变双手的位置。

## 单独关闭

`src/config/features.ts` 中：

```ts
intro: true,      // false：关闭整个开场，显示普通静态首屏
particles: true,  // false：只关闭粒子，保留纸手与触碰动画
```

系统开启“减少动态效果”时，手部保持静态，粒子不运动；网页离屏或切换到后台时停止粒子帧循环。图片加载失败时取消钉定，正文入口保持可用。
