# 开发者私有日志

> **项目**：testweb (摄影展览画廊)
> **创建时间**：2026-05-07
> **权限**：仅供开发者实例读取，其他角色禁止读取

---

<!-- 开发者在此记录详细的设计决策、实现细节、修复记录 -->
<!-- 这些内容仅供同角色的后续实例参考，不会被其他角色读取 -->

## 第3轮开发记录（2026-05-07）

### 设计决策

#### 3.1 骨架屏移除
- **决策**：完全删除 `renderSkeleton()`，不再创建 shimmer 占位元素
- **理由**：骨架屏与进度条功能重复，且占用 masonry 空间导致布局跳动
- **实现**：`.photo-item` 初始 inline style 设为 `position:absolute;visibility:hidden;height:0;overflow:hidden`，完全不占空间
- **`loadNext()` 中先设 height 再设 visibility**：确保浏览器先计算出正确高度，再一次性显示

#### 3.2 预计算列分配
- **决策**：在 `renderGallery()` 中一次性预计算所有图片的列分配位置
- **理由**：原实现中图片按网络加载完成时间定位，导致"后面的图片先出现并占据前面位置"
- **`precomputeLayout()` 实现**：用 `ESTIMATED_HEIGHT=320` 作为未加载图片的估算高度，按索引顺序分配到当前最短列
- **精修机制**：`loadedCount >= totalCount` 时调用 `layoutMasonry()`，用实际高度重新排列
- **`layoutMasonry()` 更新**：跳过 `height:0` 或 `visibility:hidden` 的未加载项，避免干扰已加载项的布局

#### 3.3 加载间隔统一
- **决策**：删除 `DELAY_FAST(200)` / `DELAY_NORMAL(500)` / `FIRST_SCREEN_COUNT(6)`，统一使用 `LOAD_DELAY=300`
- **理由**：首屏快速加载的优化在预计算布局下已无必要，统一间隔更简洁

#### 3.4 莫奈花园动画
- **6 种新动画设计理念**：
  - `watercolorReveal`：水彩画逐渐显影，边缘先模糊后清晰（`filter:blur`）
  - `sunlightFade`：阳光穿透画面，先过曝后正常（`filter:brightness/saturate`）
  - `petalDrift`：花瓣飘落轻盈感（多段 translate 正弦曲线）
  - `dewDrop`：露珠凝聚，先膨胀后稳定（`scale` 弹性 + `brightness`）
  - `canvasReveal`：画卷从底部展开（`clip-path: inset`）
  - `mistDissolve`：晨雾消散（`blur` 多段 + `scale`）
- **动画参数**：duration=800ms, delay=`idx*60`, easing=`cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- **`prefers-reduced-motion`**：在 JS 层面用 `window.matchMedia` 检查，禁用时跳过动画直接显示

#### 3.5 代码清理
- **删除的死代码**：`renderSkeleton()`、`randomDelay()`、`revealObserver`/`initRevealObserver()`/`observeRevealElements()`
- **原因**：`.reveal` class 从未在 JS 动画中使用（Web Animations API 取代了 CSS reveal），IntersectionObserver 观察的 `.reveal` 元素不再存在于模板中
- **性能优化**：动画启动时动态设置 `will-change: transform, opacity, filter`，`anim.onfinish` 回调中清除

### 未解决的潜在问题
- `precomputeLayout()` 在 `renderGallery()` 被调用时执行，此时 `masonry.offsetWidth` 可能为 0（如果容器尚未渲染）。但实际测试中 masonry 容器始终有宽度（由 CSS `max-width: 1600px` 保证），暂不处理
- 预计算的 320px 估算高度与实际图片高度可能有差异，导致初始布局有微小间隙，由最终 `layoutMasonry()` 精修消除
