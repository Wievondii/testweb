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
    renderGallery();
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
    renderGallery();
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
    const items = masonry.querySelectorAll('.photo-item');
    if (items.length === 0) return;

    const gap = 20;
    const containerW = masonry.offsetWidth;

    if (cols === 1) {
      let y = 0;
      items.forEach(item => {
        // 跳过未加载项（height:0 或 visibility:hidden）
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
      // 跳过未加载项（height:0 或 visibility:hidden）
      if (item.offsetHeight === 0 || item.style.visibility === 'hidden') return;
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      item.style.left = (minCol * (colW + gap)) + 'px';
      item.style.top = colHeights[minCol] + 'px';
      item.style.width = colW + 'px';
      colHeights[minCol] += item.offsetHeight + gap;
    });

    masonry.style.height = Math.max(...colHeights) + 'px';
  }

  function renderGallery() {
    if (filteredPhotos.length === 0) {
      masonry.innerHTML = '';
      masonry.style.height = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    // Create all items (hidden, no space occupied)
    masonry.innerHTML = filteredPhotos.map((photo, i) => {
      const sizeClass = pickSizeClass();
      const classes = ['photo-item', 'loading', sizeClass].filter(Boolean).join(' ');
      return `
      <div class="${classes}" data-index="${i}" data-id="${photo.id}" style="position:absolute;visibility:hidden;height:0;overflow:hidden">
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>`;
    }).join('');

    // 任务2.1：显示加载进度指示器
    const totalCount = filteredPhotos.length;
    if (loadProgress) {
      loadProgress.style.display = 'block';
      loadProgressText.textContent = `加载中 0/${totalCount}...`;
    }
    galleryCount.textContent = `已加载 0/${totalCount} 张作品`;

    // Load images one by one, each appears as it loads
    const items = masonry.querySelectorAll('.photo-item');
    let nextIdx = 0;
    let loadedCount = 0;

    // 更新加载进度和计数（onload 和 onerror 共用）
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
        // 所有图片加载完后，用实际高度精修布局
        layoutMasonry();
      }
    }

    // 任务3.2：预计算列分配，保证图片按索引顺序排列
    const colCount = getColumnCount();
    const layoutPositions = precomputeLayout(filteredPhotos, colCount);

    // Prepare masonry for absolute positioning
    masonry.style.position = 'relative';

    function loadNext() {
      if (nextIdx >= items.length) return;
      const idx = nextIdx++;
      const item = items[idx];
      const img = item.querySelector('img');
      if (!img.dataset.src) { loadNext(); return; }

      // 使用预计算位置
      const pos = layoutPositions[idx];
      item.classList.remove('loading');
      item.style.position = 'absolute';
      item.style.left = pos.left + 'px';
      item.style.width = pos.width + 'px';
      item.style.top = pos.top + 'px';
      item.style.visibility = 'hidden';
      item.style.opacity = '1';

      const src = img.dataset.src;
      img.removeAttribute('data-src');

      const onReady = () => {
        // 用图片实际高度设置 height，然后显示
        const actualH = item.offsetHeight || ESTIMATED_HEIGHT;
        item.style.height = actualH + 'px';
        item.style.overflow = '';
        item.style.visibility = '';
        item.classList.add('visible');

        // 入场动画（莫奈花园印象派风格）
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
            item.style.opacity = '1';
            item.style.filter = 'none';
            item.style.transform = '';
          };
        }

        updateLoadProgress();
        setTimeout(loadNext, LOAD_DELAY);
      };

      img.onload = onReady;
      // 加载失败优雅降级 + 点击重试
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
        setTimeout(loadNext, LOAD_DELAY);
      };
      img.src = src;
    }

    loadNext();
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
    // 同时恢复 overlay
    const idx = parseInt(item.dataset.index, 10);
    const photo = filteredPhotos[idx];
    if (photo) {
      const overlay = document.createElement('div');
      overlay.className = 'photo-overlay';
      overlay.innerHTML = `<h3>${escapeHtml(photo.title || '')}</h3><p>${escapeHtml(photo.description || '')}</p>`;
      item.appendChild(overlay);
    }
    img.onload = () => {
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
          item.style.opacity = '1';
          item.style.filter = 'none';
          item.style.transform = '';
        };
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
    const existingItems = masonry.querySelectorAll('.photo-item.visible');
    if (existingItems.length === 0) {
      applyFilters();
      isTransitioning = false;
      return;
    }
    // 淡出现有图片
    existingItems.forEach((item, i) => {
      item.animate(
        [{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px) scale(0.97)' }],
        { duration: 300, delay: i * 30, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
    });
    const maxFadeDelay = Math.min(existingItems.length - 1, 20) * 30 + 300;
    setTimeout(() => {
      try { applyFilters(); }
      finally { isTransitioning = false; }
    }, maxFadeDelay);
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
    if (item) openLightbox(parseInt(item.dataset.index, 10));
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
