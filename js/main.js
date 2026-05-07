/**
 * Photography Exhibition — Gallery Page
 */
(() => {
  const API_GALLERY = '/api/gallery';
  const API_CONFIG = '/api/config';

  let photos = [];
  let filteredPhotos = [];
  let currentTag = 'all';
  let currentCategory = 'all';
  let lightboxIndex = -1;
  let isTransitioning = false;

  const ANIMATIONS = ['watercolorReveal', 'sunlightFade', 'petalDrift', 'dewDrop', 'canvasReveal', 'mistDissolve'];
  const LOAD_DELAY = 300;
  const ESTIMATED_HEIGHT = 320;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SIZE_CLASSES = ['tall', 'wide', 'featured'];

  // 霜冻效果相关变量
  let currentFocusedItem = null;
  let frostTimers = [];

  function pickAnimation() {
    return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  }

  function pickSizeClass() {
    const r = Math.random();
    if (r < 0.12) return 'tall';
    if (r < 0.22) return 'wide';
    if (r < 0.30) return 'featured';
    return '';
  }

  // DOM refs
  const header = document.getElementById('header');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const tagFilter = document.getElementById('tagFilter');
  const masonry = document.getElementById('masonry');
  const emptyState = document.getElementById('emptyState');
  const galleryCount = document.getElementById('galleryCount');
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbTitle = document.getElementById('lbTitle');
  const lbDesc = document.getElementById('lbDesc');
  const lbCounter = document.getElementById('lbCounter');
  const loadProgress = document.getElementById('loadProgress');
  const loadProgressText = document.getElementById('loadProgressText');
  const scrollTopBtn = document.getElementById('scrollTopBtn');

  // Load config
  async function loadConfig() {
    try {
      const res = await fetch(API_CONFIG);
      if (!res.ok) return;
      const config = await res.json();
      // 任务1.2 防御逻辑：如果 API 返回英文默认值，忽略，保留 HTML 硬编码的中文值
      // ⚠️ 此数组必须与 functions/api/config.js 中的 DEFAULT_CONFIG 保持同步
      const ENGLISH_DEFAULTS = ['Photography Exhibition', 'A curated collection of captured moments'];
      if (config.galleryTitle && !ENGLISH_DEFAULTS.includes(config.galleryTitle)) {
        heroTitle.innerHTML = config.galleryTitle.replace(/\s/g, '<br>');
        document.title = config.galleryTitle;
      }
      if (config.gallerySubtitle && !ENGLISH_DEFAULTS.includes(config.gallerySubtitle)) {
        heroSubtitle.textContent = config.gallerySubtitle;
      }
    } catch {
      /* use HTML defaults */
    }
  }

  // 任务3.1：预计算列分配 — 保证图片按索引顺序排列
  function precomputeLayout(photos, colCount) {
    const positions = [];
    const colHeights = new Array(colCount).fill(0);
    const gap = 20;
    const containerW = masonry.offsetWidth;
    const colW = (containerW - gap * (colCount - 1)) / colCount;
    for (let i = 0; i < photos.length; i++) {
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      positions.push({ col: minCol, top: colHeights[minCol], left: minCol * (colW + gap), width: colW });
      colHeights[minCol] += ESTIMATED_HEIGHT + gap;
    }
    return positions;
  }

  // 错误占位 HTML 模板（onerror 和 retryLoad 共用）
  function showErrorPlaceholder(item, src) {
    item.classList.add('load-error');
    item.innerHTML = `
      <div class="photo-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <p>加载失败，点击重试</p>
      </div>`;
    item.dataset.src = src;
  }

  // Load photos
  async function loadPhotos() {
    try {
      const res = await fetch(API_GALLERY);
      if (!res.ok) throw new Error('API failed');
      photos = await res.json();
    } catch (e) {
      console.warn('API unavailable, trying photos.json fallback:', e);
      try {
        const res = await fetch('photos.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          photos = data.photos || [];
        }
      } catch { photos = []; }
    }
    filteredPhotos = [...photos];
    updateCategoryCounts();
    renderTags();
    initGallery();
  }

  function updateCategoryCounts() {
    const counts = { '人像': 0, '花草': 0, '城市风景': 0, '其他': 0 };
    photos.forEach(p => {
      (p.tags || []).forEach(t => { if (counts[t] !== undefined) counts[t]++; });
    });
    document.querySelectorAll('[data-count-cat]').forEach(el => {
      const cat = el.dataset.countCat;
      el.textContent = counts[cat] || 0;
    });
  }

  function getAllTags() {
    const tagSet = new Set();
    const source = currentCategory !== 'all'
      ? photos.filter(p => (p.tags || []).includes(currentCategory))
      : photos;
    source.forEach(p => {
      (p.tags || []).forEach(t => {
        if (t !== currentCategory) { tagSet.add(t); }
      });
    });
    return [...tagSet].sort();
  }

  function renderTags() {
    const tags = getAllTags();
    if (tags.length === 0) { tagFilter.style.display = 'none'; return; }
    tagFilter.style.display = 'flex';
    tagFilter.innerHTML = `<button class="tag-btn active" data-tag="all">全部</button>` +
      tags.map(t => `<button class="tag-btn" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('');
  }

  function applyFilters() {
    filteredPhotos = [...photos];
    if (currentCategory !== 'all') {
      filteredPhotos = filteredPhotos.filter(p => (p.tags || []).includes(currentCategory));
    }
    if (currentTag !== 'all') {
      filteredPhotos = filteredPhotos.filter(p => (p.tags || []).includes(currentTag));
    }
    galleryCount.textContent = `${filteredPhotos.length} 张作品`;

    // DOM 复用：遍历已有节点，根据 data-tags 标记 filtered-out 类
    const allItems = masonry.querySelectorAll('.photo-item');
    allItems.forEach(item => {
      const itemTags = (item.dataset.tags || '').split(',').filter(Boolean);
      const matchesCategory = currentCategory === 'all' || itemTags.includes(currentCategory);
      const matchesTag = currentTag === 'all' || itemTags.includes(currentTag);
      if (matchesCategory && matchesTag) {
        item.classList.remove('filtered-out');
      } else {
        item.classList.add('filtered-out');
      }
    });

    // 更新空状态
    emptyState.style.display = filteredPhotos.length === 0 ? 'block' : 'none';

    // 执行布局动画
    animateLayout();
  }

  // 结霜效果函数
  function initFrostEffect(focusedItem) {
    // 清除之前的计时器
    clearFrostTimers();

    const masonryRect = masonry.getBoundingClientRect();
    const focusedRect = focusedItem.getBoundingClientRect();

    // 计算选中图片的中心位置
    const focusedCenterX = focusedRect.left + focusedRect.width / 2 - masonryRect.left;
    const focusedCenterY = focusedRect.top + focusedRect.height / 2 - masonryRect.top;

    // 获取所有其他图片
    const allItems = masonry.querySelectorAll('.photo-item:not(.focused)');

    // 计算最大距离用于归一化
    let maxDistance = 0;
    const distances = [];

    allItems.forEach(item => {
      const itemRect = item.getBoundingClientRect();
      const itemCenterX = itemRect.left + itemRect.width / 2 - masonryRect.left;
      const itemCenterY = itemRect.top + itemRect.height / 2 - masonryRect.top;

      const distance = Math.sqrt(
        Math.pow(itemCenterX - focusedCenterX, 2) +
        Math.pow(itemCenterY - focusedCenterY, 2)
      );

      distances.push({ item, distance });
      maxDistance = Math.max(maxDistance, distance);
    });

    // 为每张图片设置延迟和持续时间
    distances.forEach(({ item, distance }, index) => {
      // 归一化距离 (0-1)
      const normalizedDistance = maxDistance > 0 ? distance / maxDistance : 0;

      // 距离越远，延迟越短（从外向内包裹：远处瞬间开始模糊）
      const delay = (1 - normalizedDistance) * 1.5; // 远处~0秒，近处~1.5秒

      // 持续时间 (2-2.8秒)：远处快，近处慢
      const duration = 2.0 + (1 - normalizedDistance) * 0.8;

      // 设置 CSS 变量
      item.style.setProperty('--frost-delay', delay + 's');
      item.style.setProperty('--frost-duration', duration + 's');
      item.style.setProperty('--frost-blur', (normalizedDistance * 5 + 1) + 'px'); // 远处~6px，近处~1px
      item.style.setProperty('--frost-opacity', (1 - normalizedDistance * 0.25)); // 远处~0.75，近处~1.0

      // 添加 frost 类触发动画
      item.classList.add('frost');
    });
  }

  function removeFrostEffect() {
    clearFrostTimers();

    const allItems = masonry.querySelectorAll('.photo-item');

    // 移除 .frost 类 — CSS transition 会从当前 blur 值平滑过渡到 0
    allItems.forEach(item => {
      item.classList.remove('frost');
    });

    // 延迟移除 CSS 变量和 .has-focus
    // 等 transition 完成后再清理（最长 duration~3s + delay~1.2s ≈ 4.2s，留余量用 5s）
    setTimeout(() => {
      allItems.forEach(item => {
        item.style.removeProperty('--frost-delay');
        item.style.removeProperty('--frost-duration');
        item.style.removeProperty('--frost-blur');
        item.style.removeProperty('--frost-opacity');
      });
      masonry.classList.remove('has-focus');
    }, 5000);
  }

  function clearFrostTimers() {
    frostTimers.forEach(timer => clearTimeout(timer));
    frostTimers = [];
  }

  // 事件委托：在 masonry 上统一处理 hover 事件（DOM 不再重建，无需重复绑定）
  // 使用 mouseover/mouseout 因为 mouseenter/mouseleave 不冒泡
  let hoverTimer = null;
  let currentHoverItem = null;
  function initHoverEffects() {
    masonry.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.photo-item');
      if (!item || item.classList.contains('filtered-out')) return;
      if (item === currentHoverItem) return; // 已经在 hover 同一个 item

      // 离开上一个 item
      if (currentHoverItem) {
        clearTimeout(hoverTimer);
        currentHoverItem.classList.remove('focused');
        currentHoverItem = null;
        removeFrostEffect();
      }

      currentHoverItem = item;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        item.classList.add('focused');
        masonry.classList.add('has-focus');
        currentFocusedItem = item;
        if (!prefersReducedMotion) {
          initFrostEffect(item);
        }
      }, 3000);
      frostTimers.push(hoverTimer);
    });

    masonry.addEventListener('mouseout', (e) => {
      const item = e.target.closest('.photo-item');
      if (!item) return;

      // 检查 relatedTarget 是否仍在该 item 内（避免子元素间移动触发）
      const related = e.relatedTarget;
      if (related && item.contains(related)) return;

      clearTimeout(hoverTimer);
      item.classList.remove('focused');
      if (currentHoverItem === item) currentHoverItem = null;
      currentFocusedItem = null;
      removeFrostEffect();
    });
  }

  // ==================== MASONRY LAYOUT ====================

  function getColumnCount() {
    const w = window.innerWidth;
    if (w <= 600) return 1;
    if (w <= 1024) return 2;
    return 3;
  }

  function layoutMasonry() {
    const cols = getColumnCount();
    // 只布局非 filtered-out 的节点
    const items = masonry.querySelectorAll('.photo-item:not(.filtered-out)');
    if (items.length === 0) return;

    const gap = 20;
    const containerW = masonry.offsetWidth;

    if (cols === 1) {
      let y = 0;
      items.forEach(item => {
        if (item.offsetHeight === 0 || item.style.visibility === 'hidden') return;
        item.style.left = '0px';
        item.style.top = y + 'px';
        item.style.width = '100%';
        y += item.offsetHeight + gap;
      });
      masonry.style.height = y + 'px';
      return;
    }

    const colW = (containerW - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);

    items.forEach(item => {
      if (item.offsetHeight === 0 || item.style.visibility === 'hidden') return;
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      item.style.left = (minCol * (colW + gap)) + 'px';
      item.style.top = colHeights[minCol] + 'px';
      item.style.width = colW + 'px';
      colHeights[minCol] += item.offsetHeight + gap;
    });

    masonry.style.height = Math.max(...colHeights) + 'px';
  }

  // animateLayout: 仅对非 filtered-out 节点执行平滑位移动画
  function animateLayout() {
    const cols = getColumnCount();
    const gap = 20;
    const containerW = masonry.offsetWidth;
    const colW = cols === 1 ? containerW : (containerW - gap * (cols - 1)) / cols;

    // 收集可见节点（非 filtered-out）
    const visibleItems = masonry.querySelectorAll('.photo-item:not(.filtered-out)');
    if (visibleItems.length === 0) return;

    // 为每个可见节点计算目标位置
    const colHeights = new Array(cols).fill(0);
    visibleItems.forEach(item => {
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      const targetLeft = minCol * (colW + gap);
      const targetTop = colHeights[minCol];
      const targetWidth = colW;

      // 确保元素可见（filtered-out → 可见的过渡需要先设置 visibility 和 opacity）
      if (item.style.visibility === 'hidden') {
        item.style.visibility = 'visible';
        if (!prefersReducedMotion) {
          item.style.opacity = '0';
        }
      }

      // 记录当前 transform 偏移量（如果有的话）
      const currentTransform = item.style.transform;
      let currentOffsetX = 0, currentOffsetY = 0;
      if (currentTransform && currentTransform.includes('translate')) {
        const match = currentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        if (match) {
          currentOffsetX = parseFloat(match[1]);
          currentOffsetY = parseFloat(match[2]);
        }
      }

      // 当前实际位置 = top/left + transform 偏移
      const currentLeft = parseFloat(item.style.left) || 0;
      const currentTop = parseFloat(item.style.top) || 0;
      const actualCurrentLeft = currentLeft + currentOffsetX;
      const actualCurrentTop = currentTop + currentOffsetY;

      // 计算需要的偏移量（从当前位置到目标位置）
      const dx = targetLeft - actualCurrentLeft;
      const dy = targetTop - actualCurrentTop;

      // 更新目标 top/left
      item.style.left = targetLeft + 'px';
      item.style.top = targetTop + 'px';
      item.style.width = targetWidth + 'px';

      // 使用 transform 做补间动画
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        if (!prefersReducedMotion) {
          item.style.transition = 'none';
          item.style.transform = `translate(${dx}px, ${dy}px)`;
          // 强制回流后启用 transition
          item.offsetHeight;
          item.style.transition = '';
          item.style.transform = '';
        } else {
          item.style.transform = '';
        }
      } else {
        item.style.transform = '';
      }

      colHeights[minCol] += item.offsetHeight + gap;
    });

    // 更新容器高度
    masonry.style.height = Math.max(...colHeights) + 'px';
  }

  // initGallery: 页面加载时一次性创建所有 DOM 节点
  function initGallery() {
    if (photos.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    // 一次性创建所有 photo-item DOM 节点
    masonry.innerHTML = photos.map((photo, i) => {
      const sizeClass = pickSizeClass();
      const classes = ['photo-item', 'loading', sizeClass].filter(Boolean).join(' ');
      const tags = (photo.tags || []).join(',');
      return `
      <div class="${classes}" data-index="${i}" data-id="${photo.id}" data-tags="${escapeAttr(tags)}" style="position:absolute;visibility:hidden;height:0;overflow:hidden">
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>`;
    }).join('');

    // 显示加载进度
    const totalCount = photos.length;
    if (loadProgress) {
      loadProgress.style.display = 'block';
      loadProgressText.textContent = `加载中 0/${totalCount}...`;
    }
    galleryCount.textContent = `已加载 0/${totalCount} 张作品`;

    // 逐个加载图片
    const items = masonry.querySelectorAll('.photo-item');
    let nextIdx = 0;
    let loadedCount = 0;

    function updateLoadProgress() {
      loadedCount++;
      if (loadProgress) {
        loadProgressText.textContent = `加载中 ${loadedCount}/${totalCount}...`;
        const fill = loadProgress.querySelector('.load-progress-fill');
        if (fill) fill.style.width = (loadedCount / totalCount * 100) + '%';
      }
      galleryCount.textContent = `已加载 ${loadedCount}/${totalCount} 张作品`;
      if (loadedCount >= totalCount && loadProgress) {
        loadProgress.style.display = 'none';
        galleryCount.textContent = `${totalCount} 张作品`;
        layoutMasonry();
      }
    }

    const colCount = getColumnCount();
    const layoutPositions = precomputeLayout(photos, colCount);

    masonry.style.position = 'relative';

    function loadNext() {
      if (nextIdx >= items.length) return;
      const idx = nextIdx++;
      const item = items[idx];
      const img = item.querySelector('img');
      if (!img.dataset.src) { loadNext(); return; }

      const pos = layoutPositions[idx];
      item.classList.remove('loading');
      item.style.position = 'absolute';
      item.style.left = pos.left + 'px';
      item.style.width = pos.width + 'px';
      item.style.top = pos.top + 'px';
      item.style.visibility = 'hidden';
      item.style.opacity = '0';

      const src = img.dataset.src;
      img.removeAttribute('data-src');

      const onReady = () => {
        const aspectRatio = img.naturalHeight / img.naturalWidth;
        const actualH = img.naturalWidth > 0 ? Math.round(pos.width * aspectRatio) : ESTIMATED_HEIGHT;
        item.style.height = actualH + 'px';
        item.style.overflow = '';
        item.classList.add('visible');
        if (prefersReducedMotion) {
          item.style.visibility = '';
          item.style.opacity = '1';
        } else {
          item.style.visibility = '';
          item.style.opacity = '0';
        }

        if (!prefersReducedMotion) {
          const animName = pickAnimation();
          const keyframes = {
            watercolorReveal: [
              { opacity: 0, transform: 'scale(0.96)', filter: 'blur(6px)' },
              { opacity: 0.4, transform: 'scale(0.98)', filter: 'blur(3px)', offset: 0.5 },
              { opacity: 1, transform: 'scale(1)', filter: 'none' },
            ],
            sunlightFade: [
              { opacity: 0, filter: 'brightness(1.4) saturate(0.5)', transform: 'translateY(12px)' },
              { opacity: 0.7, filter: 'brightness(1.15) saturate(0.8)', offset: 0.6 },
              { opacity: 1, filter: 'none', transform: 'translateY(0)' },
            ],
            petalDrift: [
              { opacity: 0, transform: 'translateY(-10px) translateX(4px) scale(0.97)' },
              { opacity: 0.5, transform: 'translateY(2px) translateX(-2px) scale(0.99)', offset: 0.4 },
              { opacity: 0.8, transform: 'translateY(-3px) translateX(1px) scale(1.01)', offset: 0.7 },
              { opacity: 1, transform: 'translateY(0) translateX(0) scale(1)' },
            ],
            dewDrop: [
              { opacity: 0, transform: 'scale(0.85)', filter: 'brightness(1.2)' },
              { opacity: 0.8, transform: 'scale(1.02)', filter: 'brightness(1.1)', offset: 0.6 },
              { opacity: 1, transform: 'scale(1)', filter: 'none' },
            ],
            canvasReveal: [
              { opacity: 0, clipPath: 'inset(100% 0 0 0)' },
              { opacity: 0.5, clipPath: 'inset(40% 0 0 0)', offset: 0.5 },
              { opacity: 1, clipPath: 'inset(0 0 0 0)' },
            ],
            mistDissolve: [
              { opacity: 0, filter: 'blur(10px)', transform: 'scale(1.03)' },
              { opacity: 0.5, filter: 'blur(2px)', transform: 'scale(1.01)', offset: 0.6 },
              { opacity: 1, filter: 'none', transform: 'scale(1)' },
            ],
          };
          const kf = keyframes[animName] || keyframes.watercolorReveal;
          item.style.willChange = 'transform, opacity, filter';
          const anim = item.animate(kf, {
            duration: 800,
            delay: idx * 60,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          });
          anim.onfinish = () => {
            item.style.willChange = '';
            item.style.removeProperty('opacity');
            item.style.removeProperty('filter');
            item.style.transform = '';
          };
        }

        updateLoadProgress();
        layoutMasonry();
        setTimeout(loadNext, LOAD_DELAY);
      };

      img.onload = onReady;
      img.onerror = () => {
        item.classList.remove('loading');
        showErrorPlaceholder(item, src);
        item.style.position = 'absolute';
        item.style.left = pos.left + 'px';
        item.style.width = pos.width + 'px';
        item.style.top = pos.top + 'px';
        item.style.height = '';
        item.style.overflow = '';
        item.style.visibility = '';
        item.style.opacity = '1';
        item.style.cursor = 'pointer';

        if (!prefersReducedMotion) {
          item.animate(
            [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 400, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
          );
        }
        item.classList.add('visible');
        updateLoadProgress();
        layoutMasonry();
        setTimeout(loadNext, LOAD_DELAY);
      };
      img.src = src;
    }

    loadNext();

    // 事件委托：在 masonry 上统一处理 hover 事件
    initHoverEffects();
  }

  // Re-layout on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutMasonry, 150);
  });

  // 失败图片重试加载（莫奈主题动画）
  function retryLoad(item) {
    const src = item.dataset.src;
    if (!src) return;
    item.classList.remove('load-error');
    item.style.cursor = 'pointer';
    const img = document.createElement('img');
    img.src = src;
    item.innerHTML = '';
    item.appendChild(img);
    // 同时恢复 overlay（data-index 基于 photos 数组）
    const idx = parseInt(item.dataset.index, 10);
    const photo = photos[idx];
    if (photo) {
      const overlay = document.createElement('div');
      overlay.className = 'photo-overlay';
      overlay.innerHTML = `<h3>${escapeHtml(photo.title || '')}</h3><p>${escapeHtml(photo.description || '')}</p>`;
      item.appendChild(overlay);
    }
    img.onload = () => {
      item.style.opacity = '0';
      item.classList.add('visible');
      if (!prefersReducedMotion) {
        item.style.willChange = 'transform, opacity, filter';
        const anim = item.animate(
          [
            { opacity: 0, transform: 'scale(0.96)', filter: 'blur(4px)' },
            { opacity: 1, transform: 'scale(1)', filter: 'none' },
          ],
          { duration: 800, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
        );
        anim.onfinish = () => {
          item.style.willChange = '';
          item.style.removeProperty('opacity');
          item.style.removeProperty('filter');
          item.style.transform = '';
        };
      } else {
        item.style.opacity = '1';
      }
    };
    img.onerror = () => {
      showErrorPlaceholder(item, src);
    };
  }

  // 任务3.4：Filter 切换淡出/淡入动画
  function filterByCategory(cat) {
    if (isTransitioning) return;
    currentCategory = cat;
    currentTag = 'all';
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    renderTags();
    tagFilter.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === 'all');
    });
    transitionGallery();
  }

  function filterByTag(tag) {
    if (isTransitioning) return;
    currentTag = tag;
    tagFilter.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === tag);
    });
    transitionGallery();
  }

  function transitionGallery() {
    isTransitioning = true;
    // 不再销毁重建 DOM，直接调用 applyFilters + animateLayout
    applyFilters();
    // 动画完成后释放锁
    setTimeout(() => { isTransitioning = false; }, 700);
  }

  // 合并 scroll 监听器：scroll-to-top 按钮 + header 背景
  window.addEventListener('scroll', () => {
    // Scroll-to-top 按钮
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('visible', window.scrollY > window.innerHeight * 0.8);
    }
    // Header 背景
    header.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Lightbox
  function openLightbox(index) {
    lightboxIndex = index;
    const photo = filteredPhotos[index];
    if (!photo) return;
    lbImg.src = photo.url;
    lbTitle.textContent = photo.title || '';
    lbDesc.textContent = photo.description || '';
    lbCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(filteredPhotos.length).padStart(2, '0')}`;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lightbox.classList.add('open'));
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    setTimeout(() => {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxIndex = -1;
    }, 400);
  }

  function navigateLightbox(dir) {
    if (filteredPhotos.length === 0) return;
    lightboxIndex = (lightboxIndex + dir + filteredPhotos.length) % filteredPhotos.length;
    const photo = filteredPhotos[lightboxIndex];
    lbImg.src = photo.url;
    lbTitle.textContent = photo.title || '';
    lbDesc.textContent = photo.description || '';
    lbCounter.textContent = `${String(lightboxIndex + 1).padStart(2, '0')} / ${String(filteredPhotos.length).padStart(2, '0')}`;
  }

  // Events
  document.getElementById('categoryFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (btn) filterByCategory(btn.dataset.cat);
  });
  tagFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-btn');
    if (btn) filterByTag(btn.dataset.tag);
  });
  masonry.addEventListener('click', (e) => {
    // 任务3.3：点击加载失败占位图重试
    const errorItem = e.target.closest('.photo-item.load-error');
    if (errorItem && errorItem.dataset.src) {
      retryLoad(errorItem);
      return;
    }
    const item = e.target.closest('.photo-item');
    if (item && !item.classList.contains('filtered-out')) {
      // data-index 是 photos 数组索引，需要找到在 filteredPhotos 中的位置
      const photoId = item.dataset.id;
      const filteredIdx = filteredPhotos.findIndex(p => String(p.id) === String(photoId));
      if (filteredIdx >= 0) openLightbox(filteredIdx);
    }
  });
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lbNext').addEventListener('click', () => navigateLightbox(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('lightbox-backdrop')) closeLightbox(); });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navigateLightbox(diff > 0 ? 1 : -1);
  }, { passive: true });

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // Init
  loadConfig();
  loadPhotos();
})();
