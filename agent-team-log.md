# Agent Team 通信日志

> **项目**：testweb (摄影展览画廊)
> **创建时间**：2026-05-07
> **当前轮次**：第 3 轮

---

## 📝 经验教训

> **来源**：第 1-2 轮（2026-05-07）
> **压缩人**：PM

### 第 1 轮关键经验
- 标题 Bug：`config.js` DEFAULT_CONFIG 写死英文 + `main.js` 无条件覆盖 → 服务端改中文 + 客户端白名单防御
- 骨架屏不生效：需 `await requestAnimationFrame` 让浏览器绘制一帧
- 重复代码提取：`showErrorPlaceholder()` 辅助函数消除 onerror/retryLoad 重复

### 第 2 轮关键经验
- 进度条真实化：移除 CSS progressPulse 动画，JS 按 loadedCount/totalCount 设置 width
- isTransitioning 异常安全：try-finally 包裹 applyFilters()，确保状态重置
- scroll 监听器合并：两个独立监听器合为一个，减少回调开销
- 审查员 3 个 🟡 建议放行（不阻塞核心功能）

### 审查/测试经验
- 审查员用 `git diff` 验证代码变更，确保修复真实落地
- 测试员区分"本地代码状态"和"线上部署状态"
- 进度条纯装饰动画会误导用户，真实进度填充更可靠

---

## 📋 第3轮计划

> **策划时间**：2026-05-07
> **需求来源**：用户 5 项需求（2 项布局 + 1 项时序 + 1 项动效 + 1 项自由优化）

### 一、需求分析总览

| # | 需求 | 一句话总结 | 涉及模块 |
|---|------|-----------|---------|
| R1 | 未加载图片不占位 | 移除骨架屏，未加载图片不占用 masonry 空间 | main.js, style.css |
| R2 | 图片按顺序排列不插队 | 预计算列分配，按序填充最短列，图片按加载顺序就位 | main.js |
| R3 | 加载间隔统一 300ms | DELAY_FAST/DELAY_NORMAL 合并为单一 300ms | main.js |
| R4 | 莫奈花园主题动效优化 | 重新设计 6 种入场动画为更精致的印象派风格 | main.js, animations.css, style.css |
| R5 | Planner 自由优化 | 合并冗余逻辑、统一动效系统、性能优化 | main.js, style.css |

---

### 二、问题根因分析

#### R1 — 未加载图片占位问题

**当前实现**（main.js L74-98 `renderSkeleton()` + L228-395 `renderGallery()`）：

1. `loadPhotos()` 先调用 `renderSkeleton(6)` 创建 6 个带 `.loading` class 的 div，按最短列定位，占用真实空间
2. 然后 `renderGallery()` 执行 `masonry.innerHTML = ...` 直接替换骨架屏，创建全部 `.photo-item`
3. 新创建的 `.photo-item` 带 `.loading` class，CSS 中 `.photo-item.loading { min-height: 240px }` 使其在文档流中占据空间
4. `loadNext()` 逐个处理时才设为 `position: absolute` 并定位

**根因**：骨架屏和带 `.loading` class 的未加载 div 都在文档流中占空间。`.loading` 的 `min-height: 240px` 导致未加载项撑开容器。

**修复方案**：
- 删除 `renderSkeleton()` 函数调用（骨架屏与进度条功能重复）
- `renderGallery()` 创建的 `.photo-item` 初始设为 `position: absolute; visibility: hidden; height: 0; overflow: hidden`
- `loadNext()` 处理时才恢复 `visibility` 和设置实际尺寸
- `.photo-item.loading` 的 `min-height` 样式移除，仅保留 shimmer 用于已定位但图片未加载完的过渡

#### R2 — 图片顺序混乱问题

**当前实现**（main.js L290-393 `loadNext()`）：

```javascript
// 每次加载完成后，找到最短列并放入
const minCol = colHeights.indexOf(Math.min(...colHeights));
```

图片按加载完成时间（网络请求顺序）定位，先完成的先定位到最短列，导致视觉顺序与原始数据顺序不一致。

**根因**：每张图片完成加载后独立定位到当时最短的列，没有预分配位置。

**修复方案**：**预计算列分配 + 顺序填充**

```
阶段 1：预计算所有图片的列分配（不等图片加载）
  - 使用 320px 作为未加载图片的估算高度
  - 按索引顺序，每张图片分配到当前最短列
  - 记录每张图片的目标 (column, estimatedTop)

阶段 2：加载图片并定位
  - loadNext() 按索引顺序加载
  - 每张图片加载完成后，直接使用预计算的 column 和 estimatedTop 定位
  - 所有图片加载完后，用实际高度重新执行一次 layoutMasonry() 精修
```

这样保证：第 0 张在第 0 个位置，第 1 张紧随其后，视觉顺序与数据顺序一致。预计算用估算高度导致的微小间隙在最终 layoutMasonry() 中修正。

#### R3 — 加载间隔统一 300ms

**当前**（main.js L262-264）：`DELAY_FAST = 200`（前 6 张）、`DELAY_NORMAL = 500`（后续）

**修改**：删除两个常量，统一使用 `const LOAD_DELAY = 300`。所有 `setTimeout(loadNext, delay)` 统一传 300。

#### R4 — 莫奈花园主题动效优化

**当前动画**（main.js L331-345 Web Animations API）：

| 名称 | 效果 | 评价 |
|------|------|------|
| fadeUp | opacity 0→1, translateY 25px→0 | 过于普通 |
| slideFromLeft | opacity 0→1, translateX -30px→0 | 方向性太强，不够柔和 |
| slideFromRight | opacity 0→1, translateX 30px→0 | 同上 |
| scaleIn | opacity 0→1, scale 0.93→1 | 缺乏诗意 |
| rotateIn | opacity 0→1, rotate -1deg + scale 0.95→1 | 略好，但幅度太小 |
| floatIn | 多段 keyframe，translateY/X 波动 | 最有潜力，但节奏生硬 |

**问题**：全部 6 种动画都以"位移+透明度"为核心，缺乏莫奈花园的"光影流动"质感。

**新设计方案**——印象派光影入场：

| 新名称 | 效果描述 | 设计理念 |
|--------|---------|---------|
| `watercolorReveal` | opacity 0→0.4→1 + scale(0.96)→1 + filter: blur(6px)→blur(0) | 水彩画逐渐显影，边缘先模糊后清晰 |
| `sunlightFade` | opacity 0→1 + filter: brightness(1.4) saturate(0.5)→brightness(1) saturate(1) + translateY(12px)→0 | 阳光穿透画面，先过曝后正常 |
| `petalDrift` | 多段：opacity 波动 + translate 微摆动（正弦曲线轨迹）+ scale 微缩放 | 花瓣飘落的轻盈感 |
| `dewDrop` | scale(0.85)→scale(1.02)→scale(1) + opacity 0→1 + filter: brightness(1.2)→1 | 露珠凝聚效果，先膨胀后稳定 |
| `canvasReveal` | clip-path: inset(100% 0 0 0)→inset(0) + opacity 0→1 | 画布从底部展开，如同画卷 |
| `mistDissolve` | opacity 0→0.5→1 + filter: blur(10px)→blur(2px)→blur(0) + scale(1.03)→1 | 晨雾消散，画面从朦胧中浮现 |

**共同特征**：
- 使用 `filter: blur()` 模拟水彩/光影质感
- 缓动曲线统一为 `cubic-bezier(0.25, 0.46, 0.45, 0.94)`（柔和 ease-out）
- 动画时长从 600ms 提升至 800ms，更从容
- 每张图片的 delay 仍按索引递增，但基础 delay 降低（80ms → 60ms），营造连贯的"画卷展开"感

#### R5 — Planner 自由优化

**5a. 统一动画系统**：当前存在两套动画——CSS `animations.css` 的 `.reveal` 过渡 + JS `main.js` 的 Web Animations API。filter 切换时用 JS 动画，初始加载也用 JS 动画，但 `.reveal.visible` 的 CSS 过渡从未被使用（因为 `observeRevealElements()` 观察的 `.reveal` 元素在 `loadNext()` 中被 JS 动画取代）。建议删除未使用的 CSS reveal 类，保持 JS 动画为唯一入口。

**5b. 骨架屏删除后的容器管理**：移除 `renderSkeleton()` 后，`masonry.style.height` 在无图片时应为 0 或 auto。进度指示器已有加载状态展示，无需额外骨架屏。

**5c. resize 重排优化**：当前 `layoutMasonry()` 被 resize 事件调用，但只在 `loadNext()` 完成后有效。需确保 resize 时只重排已加载的 `.visible` 项，不影响未加载项的预分配位置。

**5d. 动画性能**：当前 `.photo-item` 已有 `will-change: transform, opacity`。新动画引入 `filter: blur()`，需确保 GPU 加速。建议在动画启动时添加 `will-change: transform, opacity, filter`，动画结束后移除以释放合成层。

**5e. 错误重试动画同步**：`retryLoad()` 中的重试动画应与新设计的莫奈主题一致，当前使用简单的 `scale(0.95)→scale(1)`。

---

### 三、分步任务清单

#### 任务 3.1：移除骨架屏，未加载图片不占位
- **产出**：`renderSkeleton()` 函数被删除；`renderGallery()` 中创建的 `.photo-item` 初始不占空间
- **具体改动**：
  1. 删除 `renderSkeleton(count)` 函数（main.js L74-98）
  2. 删除 `loadPhotos()` 中 `renderSkeleton(6)` 调用和 `await requestAnimationFrame`（main.js L118-119）
  3. `renderGallery()` 创建的 HTML 模板中，`.photo-item` 初始样式改为 `position:absolute; visibility:hidden; height:0; overflow:hidden`
  4. `loadNext()` 中 `item.classList.remove('loading')` 后，先设 `height` 为图片实际高度再设 `visibility: ''`
  5. CSS 中 `.photo-item.loading` 的 `min-height: 240px` 删除
- **验收标准**：
  - 页面加载后，masonry 容器高度为 0（无骨架屏占位）
  - 图片逐张出现时，容器高度动态增长
  - 进度条正常显示加载进度

#### 任务 3.2：预计算列分配，保证图片顺序
- **产出**：新增 `precomputeLayout()` 函数，`loadNext()` 使用预计算位置
- **具体改动**：
  1. 新增 `precomputeLayout(filteredPhotos, colCount)` 函数：
     - 用 `ESTIMATED_HEIGHT = 320` 作为未加载图片估算高度
     - 按索引顺序遍历，每次将图片分配到当前最短列
     - 返回 `Array<{ col, top }>` 预计算位置数组
  2. `renderGallery()` 调用 `precomputeLayout()` 获取预计算位置
  3. `loadNext()` 中删除"找最短列"逻辑，直接使用预计算的 `col` 和 `top` 定位
  4. 所有图片加载完后（`loadedCount >= totalCount`），调用 `layoutMasonry()` 用实际高度精修布局
  5. 失败图片的 `onerror` 处理中也使用预计算位置
- **验收标准**：
  - 图片按数据数组的索引顺序从左到右、从上到下出现
  - 不会出现"后面的图片先出现并占据前面位置"的情况
  - 最终布局无明显间隙（layoutMasonry 精修后）

#### 任务 3.3：加载间隔统一 300ms
- **产出**：所有图片加载间隔为 300ms
- **具体改动**：
  1. 删除 `DELAY_FAST` 和 `DELAY_NORMAL` 常量
  2. 新增 `const LOAD_DELAY = 300`
  3. `onReady` 和 `onerror` 中的 `setTimeout(loadNext, delay)` 统一改为 `setTimeout(loadNext, LOAD_DELAY)`
- **验收标准**：所有图片以均匀 300ms 间隔加载，无快慢区分

#### 任务 3.4：莫奈花园主题入场动画重设计
- **产出**：6 种新入场动画替换旧动画
- **具体改动**：
  1. `main.js` 中 `ANIMATIONS` 数组改为新的 6 种名称
  2. `onReady` 中的 `keyframes` 对象替换为新动画的 keyframe 数据
  3. 动画时长从 600ms 提升至 800ms
  4. 每张图片的 delay 从 `Math.min(idx, 6) * 80` 改为 `idx * 60`（更均匀的级联）
  5. 缓动曲线统一为 `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
  6. `retryLoad()` 中的重试动画同步更新为新主题风格
- **验收标准**：
  - 6 种动画均能正常播放，无卡顿
  - 动画带有"水彩/光影/花瓣"的莫奈质感
  - `prefers-reduced-motion: reduce` 下动画仍被禁用

#### 任务 3.5：清理冗余代码和性能优化
- **产出**：代码精简，性能优化
- **具体改动**：
  1. 删除 `animations.css` 中未使用的 `.reveal` / `.reveal-left` / `.reveal-right` / `.reveal-scale` 类（main.js 中从未通过 CSS class 触发这些）
  2. `loadNext()` 中动画启动时动态添加 `will-change: filter`，`setTimeout` 回调中移除
  3. 删除 `randomDelay()` 函数（从未被调用）
  4. 确保 `layoutMasonry()` 仅重排 `.visible` 项，跳过 `height:0` 的未加载项
- **验收标准**：
  - 页面功能无回归
  - Chrome DevTools Performance 面板中，图片加载期间合成层开销合理

---

### 四、影响文件清单

| 文件 | 改动类型 | 改动量估算 |
|------|---------|-----------|
| `js/main.js` | 核心改动 | 大（~100 行改动） |
| `css/style.css` | 样式调整 | 小（删除 `.photo-item.loading min-height`，添加新状态样式） |
| `css/animations.css` | 动画清理 | 小（删除未使用的 reveal 类） |

---

### 五、风险提示

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|---------|
| 预计算高度不准导致间隙 | 中 | 估算高度 320px 与实际图片高度差异可能导致布局间隙 | 任务完成后调用 `layoutMasonry()` 精修；使用 `object-fit: cover` + CSS `min-height` 保证最小高度 |
| `filter: blur()` 性能 | 低 | blur 在低端设备可能导致掉帧 | blur 值控制在 10px 以内；动画结束立即清除 filter |
| `prefers-reduced-motion` 兼容 | 低 | 新动画需确保 reduced-motion 下被禁用 | 新动画使用 Web Animations API，CSS `@media (prefers-reduced-motion)` 对 JS 动画无效，需在 JS 中检查 `matchMedia` 并跳过动画 |
| `retryLoad` 位置同步 | 低 | 重试时需使用正确的预计算位置 | `retryLoad()` 读取预计算位置数组中对应索引的值 |
| 删除骨架屏后的视觉空白 | 低 | 骨架屏移除后，加载期间页面可能出现短暂空白 | 进度条已提供加载反馈，可接受 |

---

### 六、任务优先级排序

1. **P0 — 任务 3.1**（移除骨架屏/不占位）：基础性改动，其他任务依赖此改动
2. **P0 — 任务 3.2**（预计算列分配/顺序）：核心布局逻辑重写
3. **P1 — 任务 3.3**（统一 300ms 间隔）：简单改动，与 3.2 同步实施
4. **P1 — 任务 3.4**（莫奈动效重设计）：独立于布局逻辑，可并行
5. **P2 — 任务 3.5**（代码清理/性能）：最后实施，确保主功能稳定后再优化

**建议执行顺序**：3.1 → 3.2（含 3.3） → 3.4 → 3.5

---

## 🔧 第3轮开发
<!-- 开发者写入 -->

> **执行时间**：2026-05-07
> **开发者**：Developer

### 任务 3.1：移除骨架屏，未加载图片不占位
- 删除 `renderSkeleton()` 函数和 `loadPhotos()` 中的调用
- `.photo-item` 初始设为 `position:absolute; visibility:hidden; height:0; overflow:hidden`
- `loadNext()` 中先设置实际高度再恢复 `visibility`
- CSS `.photo-item.loading` 的 `min-height: 240px` 已删除

### 任务 3.2：预计算列分配，保证图片顺序
- 新增 `precomputeLayout(filteredPhotos, colCount)` 函数，使用 `ESTIMATED_HEIGHT=320` 估算
- 返回 `Array<{ col, top, left, width }>` 预计算位置数组
- `loadNext()` 和 `onerror` 均使用预计算位置，不再动态"找最短列"
- 全部加载完后调用 `layoutMasonry()` 精修布局

### 任务 3.3：加载间隔统一 300ms
- 删除 `DELAY_FAST`、`DELAY_NORMAL`、`FIRST_SCREEN_COUNT`
- 统一使用 `const LOAD_DELAY = 300`

### 任务 3.4：莫奈花园主题入场动画重设计
- 6 种新动画：`watercolorReveal`、`sunlightFade`、`petalDrift`、`dewDrop`、`canvasReveal`、`mistDissolve`
- 动画时长 800ms，delay `idx * 60`
- 缓动曲线 `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `retryLoad()` 同步更新为莫奈主题风格
- 添加 `prefers-reduced-motion` 检查，禁用 JS 动画

### 任务 3.5：清理冗余代码和性能优化
- 删除 `animations.css` 中 `.reveal`、`.reveal-left`、`.reveal-right`、`.reveal-scale` 类
- 删除 `randomDelay()` 函数
- 删除 `revealObserver` 及 `initRevealObserver()`/`observeRevealElements()` 死代码
- 动画启动时添加 `will-change: filter`，`anim.onfinish` 回调中移除
- `layoutMasonry()` 跳过 `height:0` 或 `visibility:hidden` 的未加载项

### 影响文件
| 文件 | 改动 |
|------|------|
| `js/main.js` | 核心重写：骨架屏移除、预计算布局、新动画、清理死代码 |
| `css/style.css` | 移除 `.photo-item.loading` 的 `min-height: 240px` |
| `css/animations.css` | 移除未使用的 `.reveal` 系列类 |

---

## 🔍 第3轮审查
<!-- 审查员写入 -->

---

## 🧪 第3轮测试
<!-- 测试员写入 -->

---

## 💬 直接对话区
<!-- 开发者 / 审查员 / 测试员 直接交流 -->
