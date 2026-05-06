# 通信文件 - Round 1

## 项目信息
- **项目名称**: 小肥画展 - 莫奈花园
- **当前轮次**: 1 / 1
- **状态**: 待测试
- **策划师**: planner-1
- **目标开发者**: developer-1

## 需求概述
为现有摄影展画廊网站进行全面"莫奈花园印象派风格"改造，包括：
1. 全面中文本土化（标题统一为"小肥画展"）
2. 印象派水彩质感配色与纹理
3. Three.js 场景大幅强化（花瓣种类、水波、光粒子）
4. 滚动触发动画、Hover 油画效果、加载动画
5. 优雅中文书法字体
6. 保持所有现有功能正常

## 计划详情

### 1. 任务分解（8个子任务）

#### T1: HTML 标题与文案中文化
- **文件**: `index.html`, `admin.html`
- **变更点**:
  - `index.html`:
    - Logo: `<span class="logo-mark">PHOTO</span><span class="logo-light">GRAPHY</span>` → 改为中文风格 Logo，如"小肥画展"或"小肥"
    - Nav: `Gallery` → `画廊`, `Admin` → `管理`
    - `hero-eyebrow`: "A Curated Exhibition" → "一场印象派的视觉之旅" 或 "精选作品展览"
    - `hero-subtitle`: "Captured moments, preserved in light" → "用光影定格每一个瞬间"
    - `hero-scroll-hint`: "Scroll to explore" → `向下滑动，探索花园`
    - Filter pills: `All Works` → `全部作品`, `Portrait` → `人像`, `Flora` → `花草`, `Urban` → `城市风景`, `Other` → `其他`
    - Empty state: "No works yet" / "Photographs will appear..." → `暂无作品` / `通过管理面板添加照片后，作品将显示在这里`
    - Footer: `&copy; Photography Exhibition` → `&copy; 小肥画展`
    - Google Fonts 链接: 添加中文字体（思源宋体 Noto Serif SC + 站酷小薇体 ZCOOL XiaoWei）
  - `admin.html`:
    - `<title>`: "Admin - Photography Exhibition" → `管理后台 - 小肥画展`
    - `login-box` h2: "Admin Access" → `管理登录`
    - `login-box` p: "Enter password to manage photos" → `请输入密码管理作品`
    - `login-error`: "Incorrect password" → `密码错误`
    - `loginPassword` placeholder: "Password" → `密码`
    - `loginBtn`: "Enter" → `进入`
    - `admin-header` h1: "Photo Manager" → `作品管理`
    - 按钮: "View Gallery" → `查看画廊`, "Export JSON" → `导出 JSON`, "Import JSON" → `导入 JSON`, "Logout" → `退出登录`
    - `Gallery Settings` → `画廊设置`
    - 标签: "Gallery Title" → `画廊标题`, "Subtitle" → `副标题`, "Save Settings" → `保存设置`
    - Upload zone: "Drop image here or click to upload" → `拖拽图片到此处或点击上传`, "Supports JPG..." → `支持 JPG、PNG、WebP 格式 — 自动压缩至 5MB 以下`
    - Form labels: "Title" → `标题`, "Description" → `描述`, "Tags (comma separated)" → `标签（用逗号分隔）`
    - "Upload & Save" → `上传并保存`, "Cancel" → `取消`
    - "Gallery Photos" → `画廊作品`, photo count: "0 photos" → `0 张作品`
    - Edit Modal: "Edit Photo" → `编辑作品`
    - Delete Modal: "Delete Photo" → `删除作品`, body text 中文, "Delete" → `删除`
    - `progressText`: "Uploading..." → `正在上传...`
    - Google Fonts 链接同步更新

#### T2: CSS 配色全面改造 — 莫奈花园印象派调色板
- **文件**: `css/style.css`
- **变更点**:
  - `:root` 变量重定义（详见"配色方案"）
  - 背景从深紫黑 `#0c0914` 改为更明亮的莫奈暗调 `#0a0e17`（深蓝黑底色，模拟夜空下的花园）
  - 提升卡片/表面层亮度，增加水彩透明感
  - 新增颜色变量:
    - `--monet-lavender: #b8a1d9`
    - `--monet-rose: #e8b4d0`
    - `--monet-water: #7eb5d6`
    - `--monet-gold: #e8d5a3`
    - `--monet-leaf: #a8c9a0`
    - `--monet-mist: rgba(200, 190, 220, 0.15)`
  - 修改 `grain-overlay`：降低噪点强度，增加水彩晕染感，或替换为 canvas 绘制的水彩纹理
  - 修改 `.site-header.scrolled` 背景：增加毛玻璃效果 + 淡紫渐变
  - Hero 区域：添加 subtle 的径向渐变背景层，模拟晨光透过树叶的光斑
  - 按钮/Filter pills：改为水彩笔刷形状（border-radius 不规则）或增加 hover 时的光晕扩散
  - Lightbox 背景：加深并增加朦胧感
  - Footer：增加睡莲/水波装饰线
  - 所有 transition 增加更流畅的 ease 曲线
  - 新增 `.watercolor-bg` 辅助类用于水彩背景装饰

#### T3: CSS 动画与交互效果强化
- **文件**: `css/style.css`（动画部分）, 可能新增 `css/animations.css`
- **变更点**:
  - **页面加载动画**: body 初始 opacity:0，加载完成后淡入（1.2s ease-out）
  - **滚动触发动画**: 使用 IntersectionObserver，元素进入视口时触发:
    - `fadeUp`: opacity 0→1, translateY(40px→0), duration 0.9s
    - `slideFromLeft`: translateX(-60px→0)
    - `slideFromRight`: translateX(60px→0)
    - `scaleIn`: scale(0.85→1)
    - `floatIn`: translateY(30px→0) + 轻微旋转
  - **图片 Hover 效果**:
    - 放大: scale(1→1.06)，增加 `filter: brightness(1.05) saturate(1.1)` 模拟油画提亮
    - 增加光晕: `box-shadow: 0 20px 60px var(--monet-mist)`
    - 可选: 叠加一层 subtle 的 canvas 水彩滤镜（用 CSS `mix-blend-mode: overlay` + 伪元素 radial-gradient）
  - **Filter pill Hover/Active**: 背景色渐变过渡，增加微光脉冲动画
  - **Hero 标题入场**: 字间距从宽到正常 + 淡入，持续 1.5s
  - **Scroll hint**: 上下浮动动画优化，增加水波涟漪感

#### T4: Three.js 场景大幅强化
- **文件**: `js/three-bg.js`
- **变更点**:
  - **增加花瓣种类与纹理**:
    - 当前只有圆形点粒子，改为使用自定义形状（玫瑰花瓣、睡莲瓣、鸢尾花瓣）
    - 在 fragment shader 中增加花瓣形状函数（玫瑰用 5 瓣心形，睡莲用椭圆，鸢尾用 3 瓣不对称）
    - 增加花瓣旋转（不只是飘移，而是 3D 旋转 tumble）
  - **增加水波/水面效果**:
    - 在场景底部（y ≈ -20）添加一个半透明平面，使用 wave shader 模拟水面波纹
    - 水色: `#7eb5d6` 半透明，带阳光反射高光
  - **光粒子强化**:
    - 增加"晨光金"色粒子（`#e8d5a3`），模拟透过树叶的斑驳阳光
    - 粒子增加闪烁动画（sin 函数控制透明度）
  - **背景渐变氛围**:
    - scene background 或 renderer 后处理增加 subtle 的 radial gradient（中心亮紫，边缘深蓝）
  - **性能优化**: 保持粒子总数不超过 150，确保移动端流畅
  - **Mouse interaction 增强**: 鼠标移动时产生"扰动"效果，粒子被轻微推开（类似水面涟漪）

#### T5: 字体系统改造
- **文件**: `index.html`, `admin.html`, `css/style.css`
- **变更点**:
  - Google Fonts 引入:
    - `Noto Serif SC` (思源宋体) — 用于标题、正文，权重 300, 400, 600
    - `ZCOOL XiaoWei` (站酷小薇体) — 用于 Hero 大标题，增加书法感
    - 保留 `Cormorant Garamond` 作为英文搭配字体
  - CSS 变量更新:
    - `--font-display: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;`
    - `--font-body: 'Noto Serif SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;`
    - 英文辅助: `--font-en: 'Cormorant Garamond', serif;`
  - Hero 标题 `小肥画展`: 使用 ZCOOL XiaoWei，字重 400，增加 text-shadow 模拟水墨晕染
  - 正文: 使用 Noto Serif SC，字重 300-400，行高 1.8（中文阅读舒适）
  - 按钮/标签: 使用 Noto Serif SC，字间距适度增加

#### T6: JS 功能保持与增强
- **文件**: `js/main.js`, `js/admin.js`
- **变更点**:
  - `main.js`:
    - 确保滚动触发动画的 IntersectionObserver 正确初始化
    - 为 masonry 元素增加 `.reveal` 类，滚动进入时添加动画 class
    - 空状态文案更新（已在 T1 中处理 HTML，JS 中如有动态生成需同步）
    - lightbox 打开/关闭增加淡入淡出过渡（0.4s）
    - 筛选切换时，画廊重新渲染增加 stagger 动画（每张卡片延迟 50ms 入场）
  - `admin.js`:
    - 所有动态生成的文案（toast、error message、confirm text）全部改为中文
    - 上传进度、成功/失败提示中文化
    - photo count 显示: "{n} photos" → `{n} 张作品`
    - 保持 compressor.js 调用不变

#### T7: Footer 与细节优化
- **文件**: `index.html`, `css/style.css`
- **变更点**:
  - Footer:
    - 文字: "小肥画展 · 用光影书写诗意"
    - 增加装饰性 SVG 水波纹/睡莲图案
    - 增加回到顶部按钮（浮动，莫奈风格圆形，含向上箭头）
  - Favicon / Meta: 如有条件更新 favicon 为睡莲/花瓣图标（否则保持）
  - 页面背景增加 subtle 的 canvas 水彩晕染动画（低优先级，可选）

#### T8: 测试与部署
- **步骤**:
  1. 本地用 Live Server 打开，验证所有页面渲染正常
  2. 检查中文字体加载情况（网络慢时的 fallback）
  3. 验证 Three.js 场景无报错，粒子流畅
  4. 验证 masonry 布局、lightbox、筛选功能正常
  5. 验证 admin 登录、上传、编辑、删除功能正常
  6. 推送到 GitHub，触发 Cloudflare Pages 自动部署
  7. 线上验证 `web.265878.xyz`

---

### 2. 技术方案

#### 配色方案（莫奈花园印象派）
| 角色 | 颜色值 | 说明 |
|------|--------|------|
| 主背景 | `#0a0e17` | 深蓝黑，夜空/深水底色 |
|  elevated 背景 | `#0f1420` | 稍亮，用于卡片底层 |
| 卡片背景 | `#151b2e` | 带蓝紫调的暗色 |
| 表面层 | `#1c233a` | hover/active 状态 |
| 主文字 | `#f0e8f8` | 柔和亮紫白 |
| 次要文字 | `#a89bc4` | 薰衣草灰 |
| 弱文字 | `#6b5d8a` | 深薰衣草 |
| 强调色（薰衣草）| `#c4a8d8` | 核心紫，用于高亮 |
| 睡莲粉 | `#e8b4d0` | 玫瑰/睡莲粉，用于装饰和 hover |
| 湖水蓝 | `#7eb5d6` | 水波、链接 hover |
| 晨光金 | `#e8d5a3` | 阳光、粒子、特殊高亮 |
| 嫩叶绿 | `#a8c9a0` | 叶子、自然标签 |
| 边框 | `rgba(196,168,216,0.10)` | 极淡紫边 |
| 光晕 | `rgba(200,190,220,0.20)` | 卡片/图片 hover 光晕 |

#### 字体方案
- **Hero 大标题**: ZCOOL XiaoWei（站酷小薇体）— 手写书法感，轻量优雅
- **正文/标题**: Noto Serif SC（思源宋体）— 专业、可读性强、中英文混排优秀
- **英文装饰**: Cormorant Garamond — 保留，用于英文单词的优雅展示
- **Fallback**: 'PingFang SC', 'Microsoft YaHei', sans-serif

#### 动画技术选型
- **滚动触发**: 原生 IntersectionObserver API，无需额外库
- **Three.js 场景**: r128 版本已引入，继续用 ShaderMaterial 自定义
- **CSS 动画**: 全部用 CSS @keyframes + transition，GPU 加速（transform, opacity）
- **图片滤镜**: CSS `filter` + 伪元素 `mix-blend-mode`，不用 canvas 逐帧处理（性能考虑）

### 3. 文件结构规划
```
testweb/
├── index.html              # T1, T5 修改
├── admin.html              # T1, T5 修改
├── css/
│   ├── style.css           # T2, T3, T5, T7 大幅修改
│   └── animations.css      # 【新增】T3 滚动动画、hover 动画 keyframes
├── js/
│   ├── three-bg.js         # T4 大幅强化
│   ├── main.js             # T6 增强动画触发
│   ├── admin.js            # T6 文案中文化
│   └── compressor.js       # 不变
├── assets/
│   └── sounds/             # 不变
└── functions/api/          # 不变
```

### 4. 实施顺序（考虑依赖）
1. **Step 1**: T2（CSS 配色基础）+ T5（字体变量） → 先打好视觉基础
2. **Step 2**: T1（HTML 文案） → 在正确样式下调整文字
3. **Step 3**: T3（CSS 动画） + 新增 `animations.css` → 增加交互效果
4. **Step 4**: T4（Three.js 强化） → 替换/增强背景特效
5. **Step 5**: T6（JS 功能） → 确保逻辑和文案正确
6. **Step 6**: T7（Footer + 细节） → 收尾优化
7. **Step 7**: T8（测试部署）

### 5. 验收标准
- [ ] 打开首页，Hero 区域显示"小肥画展"书法字体，Three.js 场景有花瓣+水波+光粒子
- [ ] 页面上所有文字为中文（或中英双语），无残留英文摄影展文案
- [ ] 配色呈现柔和薰衣草紫、睡莲粉、湖水蓝、晨光金的印象派水彩感
- [ ] 滚动页面，画廊卡片有 stagger 淡入动画
- [ ] 鼠标悬停图片，有光晕扩散 + 轻微提亮效果
- [ ] 筛选按钮为中文，点击筛选功能正常
- [ ] Lightbox 打开/关闭有平滑过渡
- [ ] admin 页面标题为"管理后台 - 小肥画展"，登录后所有文案为中文
- [ ] admin 上传、编辑、删除作品功能正常
- [ ] 移动端浏览布局正常，字体可读
- [ ] 部署到线上后验证通过

### 6. 风险提示
| 风险 | 影响 | 应对 |
|------|------|------|
| Google Fonts 中文字体加载慢（体积大） | 首屏文字闪烁或延迟 | 使用 `font-display: swap`，设置合理的 fallback 字体栈；或考虑使用轻量级替代方案（如仅加载 ZCOOL XiaoWei 用于标题，Noto Serif SC 用系统字体替代） |
| Three.js 水波 shader 过于复杂导致低端设备卡顿 | 性能下降 | 提供 `prefers-reduced-motion` 降级方案；水波效果用简单 sin wave，避免多pass |
| CSS 大幅修改后 masonry 布局错位 | 画廊显示异常 | 每次改完 CSS 立即验证 masonry 计算逻辑；保持图片容器的 `position: absolute` 和尺寸计算不变 |
| 中文字体导致行高/间距变化，破坏现有布局 | 元素重叠或留白不均 | 调整 CSS 时同步检查 line-height、padding、margin，中文建议 line-height 1.6-1.8 |
| admin.js 文案分散在多处，漏改 | 部分英文残留 | 全局搜索 `"` / `'` 包裹的英文文案，逐一核对 |

## 代码变更记录

### 新增文件
- `css/animations.css`：页面加载淡入、滚动揭示动画（reveal/reveal-left/reveal-right/reveal-scale）、Hero标题入场、滚动提示浮动、filter pill微光脉冲、lightbox过渡、筛选stagger动画

### 修改文件
- `index.html`：标题保持"小肥画展"、Logo/导航/文案全面中文化、Google Fonts添加ZCOOL XiaoWei和Noto Serif SC、CSS/JS引用版本号更新至v7
- `admin.html`：标题改为"管理后台 - 小肥画展"、登录/上传/编辑/删除全部文案中文化、Google Fonts同步更新、CSS/JS引用版本号更新
- `css/style.css`：莫奈花园印象派调色板（--bg/#0a0e17等）、新增莫奈色系变量（--monet-lavender等）、字体变量改为中文栈、body行高改为1.75、::selection改为--monet-rose、.site-header.scrolled毛玻璃背景、.hero径向渐变、.photo-item hover效果强化、.lightbox-backdrop模糊加深
- `js/three-bg.js`：花瓣种类纹理（玫瑰/睡莲/普通三种形状fragment shader）、底部水波效果（半透明平面+wave shader）、金色光粒子（30%金色+闪烁sin动画）、背景径向渐变氛围、鼠标移动粒子扰动、粒子总数提升至80+60
- `js/main.js`：loadConfig默认标题"小肥画展"、galleryCount显示改为"N张作品"、renderTags改为"全部"、photo-item添加reveal类、IntersectionObserver滚动揭示、筛选stagger延迟(idx*50ms)、lightbox打开/关闭增加open类过渡
- `js/admin.js`：全部toast/error文案中文化（上传成功/失败、作品更新/删除、设置保存等）、photoCount显示改为"N张作品"、导出文件名改为xiaofei-gallery-backup.json、API错误信息中文化

### 删除文件
- 无

### 关键实现决策
- lightbox过渡同时保留.active和.open类，确保与现有CSS兼容：打开时先加active再用rAF加open，关闭时先移除open再延迟400ms移除active
- 筛选stagger动画通过Web Animations API的delay参数实现，与现有的loadNext逐张加载机制配合
- Three.js水波使用简单sin wave组合，避免多pass以保证性能

### 待确认事项
- Google Fonts中文字体加载速度待线上验证
- Three.js水波shader在低端设备上的流畅度待测试

## 会议纪要

### 2026-05-06 — planner-1 制定计划完成
- **需求确认**: 全面莫奈花园印象派风格改造 + 中文本土化
- **计划状态**: ✅ 已完成，等待 PM 分派给 developer-1
- **预估工作量**: 8 个任务，约需 1-2 个开发周期（视开发者速度）
- **关键决策**:
  - 字体采用 ZCOOL XiaoWei + Noto Serif SC 组合
  - Three.js 在现有基础上强化，不替换核心架构
  - 滚动动画使用原生 IntersectionObserver，不引入新库
- **下一步**: PM 审阅计划后分派 developer-1 执行

### [2026-05-06] — developer-1 开始执行
- **状态**: 开发中
- **当前任务**: T1-T8 全面莫奈花园印象派风格改造
- **备注**: 已读取全部源码，开始按顺序修改

### [2026-05-06] — developer-1 开发完成
- **状态**: 待测试
- **变更文件**: index.html, admin.html, css/style.css, css/animations.css, js/three-bg.js, js/main.js, js/admin.js
- **备注**: 全部前端改造完成，等待 tester-1 测试

---
*本文件由 planner-1 维护，developer-1 执行后在此更新进度*
