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
  let revealObserver = null;
  let isTransitioning = false;

  const ANIMATIONS = ['fadeUp', 'slideFromLeft', 'slideFromRight', 'scaleIn', 'rotateIn', 'floatIn'];
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

  function randomDelay() {
    return (Math.random() * 0.4).toFixed(2);
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

  // 任务3.1：骨架屏 — 在数据加载前显示 shimmer 占位
  function renderSkeleton(count) {
    emptyState.style.display = 'none';
    masonry.style.position = 'relative';
    masonry.innerHTML = '';
    const cols = getColumnCount();
    const gap = 20;
    const containerW = masonry.offsetWidth;
    const colW = (containerW - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);
    for (let i = 0; i < count; i++) {
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      const item = document.createElement('div');
      item.className = 'photo-item loading';
      item.style.position = 'absolute';
      item.style.left = minCol * (colW + gap) + 'px';
      item.style.top = colHeights[minCol] + 'px';
      item.style.width = colW + 'px';
      item.style.opacity = '1';
      const h = 200 + Math.random() * 160;
      item.style.height = h + 'px';
      colHeights[minCol] += h + gap;
      masonry.appendChild(item);
    }
    masonry.style.height = Math.max(...colHeights) + 'px';
  }

  // 任务3.3：错误占位 HTML 模板（onerror 和 retryLoad 共用）
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
    // 先显示骨架屏
    renderSkeleton(6);
    // 等待浏览器绘制骨架屏帧，否则骨架屏会被 renderGallery() 立刻覆盖
    await new Promise(r => requestAnimationFrame(r));
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
        item.style.left = '0px';
        item.style.top = y + 'px';
        item.style.width = '100%';
        y += (item.offsetHeight || 320) + gap;
      });
      masonry.style.height = y + 'px';
      return;
    }

    const colW = (containerW - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);

    items.forEach(item => {
      const minCol = colHeights.indexOf(Math.min(...colHeights));
      item.style.left = (minCol * (colW + gap)) + 'px';
      item.style.top = colHeights[minCol] + 'px';
      item.style.width = colW + 'px';
      colHeights[minCol] += (item.offsetHeight || 320) + gap;
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

    // Create all items (hidden)
    masonry.innerHTML = filteredPhotos.map((photo, i) => {
      const sizeClass = pickSizeClass();
      const classes = ['photo-item', 'loading', 'reveal', sizeClass].filter(Boolean).join(' ');
      return `
      <div class="${classes}" data-index="${i}" data-id="${photo.id}">
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
    // 任务3.2：初始化动态计数
    galleryCount.textContent = `已加载 0/${totalCount} 张作品`;

    // Load images one by one, each appears as it loads
    const items = masonry.querySelectorAll('.photo-item');
    const DELAY_FAST = 200;   // 任务2.2：首屏前6张快速加载
    const DELAY_NORMAL = 500; // 任务2.2：后续图片较长间隔
    const FIRST_SCREEN_COUNT = 6;
    let nextIdx = 0;
    let loadedCount = 0;

    // 任务3.2：更新加载进度和计数（onload 和 onerror 共用）
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
      }
    }

    const colHeights = [];
    const colCount = getColumnCount();
    for (let i = 0; i < colCount; i++) colHeights.push(0);

    // Prepare masonry for absolute positioning
    masonry.style.position = 'relative';

    function loadNext() {
      if (nextIdx >= items.length) return;
      const idx = nextIdx++;
      const item = items[idx];
      const img = item.querySelector('img');
      if (!img.dataset.src) { loadNext(); return; }

      // Set up for measurement
      item.classList.remove('loading');
      item.style.position = 'absolute';
      item.style.visibility = 'hidden';
      item.style.opacity = '1';

      const src = img.dataset.src;
      img.removeAttribute('data-src');

      const onReady = () => {
        // Calculate column width
        const containerW = masonry.offsetWidth;
        const gap = 20;
        const cols = getColumnCount();
        const colW = (containerW - gap * (cols - 1)) / cols;

        // Ensure colHeights array matches current column count
        while (colHeights.length < cols) colHeights.push(0);

        // Find shortest column
        const minCol = colHeights.indexOf(Math.min(...colHeights));
        const x = minCol * (colW + gap);

        // Position item
        item.style.left = x + 'px';
        item.style.top = colHeights[minCol] + 'px';
        item.style.width = colW + 'px';
        item.style.visibility = '';

        // Update column height
        colHeights[minCol] += (item.offsetHeight || 300) + gap;
        masonry.style.height = Math.max(...colHeights) + 'px';

        // Animate entrance
        const animName = pickAnimation();
        const keyframes = {
          fadeUp: [{ opacity: 0, transform: 'translateY(25px)' }, { opacity: 1, transform: 'translateY(0)' }],
          slideFromLeft: [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'translateX(0)' }],
          slideFromRight: [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'translateX(0)' }],
          scaleIn: [{ opacity: 0, transform: 'scale(0.93)' }, { opacity: 1, transform: 'scale(1)' }],
          rotateIn: [{ opacity: 0, transform: 'rotate(-1deg) scale(0.95)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }],
          floatIn: [
            { opacity: 0, transform: 'translateY(-15px) translateX(6px)' },
            { opacity: 0.8, transform: 'translateY(2px) translateX(-1px)', offset: 0.6 },
            { opacity: 1, transform: 'translateY(0) translateX(0)' },
          ],
        };
        const kf = keyframes[animName] || keyframes.fadeUp;
        item.animate(kf, { duration: 600, delay: Math.min(idx, 6) * 80, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
        setTimeout(() => { item.classList.add('visible'); }, 650 + Math.min(idx, 6) * 80);

        // 任务3.2：更新进度和计数
        updateLoadProgress();

        // 任务2.2：根据索引选择不同延迟
        const delay = idx < FIRST_SCREEN_COUNT ? DELAY_FAST : DELAY_NORMAL;
        setTimeout(loadNext, delay);
      };

      img.onload = onReady;
      // 任务3.3：加载失败优雅降级 + 点击重试
      img.onerror = () => {
        item.classList.remove('loading');
        showErrorPlaceholder(item, src);
        item.style.position = 'absolute';
        item.style.visibility = 'hidden';
        item.style.opacity = '1';
        item.style.cursor = 'pointer';

        // 定位占位元素
        const containerW = masonry.offsetWidth;
        const gap = 20;
        const cols = getColumnCount();
        const colW = (containerW - gap * (cols - 1)) / cols;
        while (colHeights.length < cols) colHeights.push(0);
        const minCol = colHeights.indexOf(Math.min(...colHeights));
        item.style.left = minCol * (colW + gap) + 'px';
        item.style.top = colHeights[minCol] + 'px';
        item.style.width = colW + 'px';
        item.style.visibility = '';
        colHeights[minCol] += (item.offsetHeight || 200) + gap;
        masonry.style.height = Math.max(...colHeights) + 'px';
        item.animate(
          [{ opacity: 0, transform: 'translateY(15px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
        item.classList.add('visible');

        updateLoadProgress();

        const delay = idx < FIRST_SCREEN_COUNT ? DELAY_FAST : DELAY_NORMAL;
        setTimeout(loadNext, delay);
      };
      img.src = src;
    }

    loadNext();
    observeRevealElements();
  }

  // Scroll reveal animation via IntersectionObserver (singleton)
  function initRevealObserver() {
    if (revealObserver) return;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
  }

  function observeRevealElements() {
    initRevealObserver();
    document.querySelectorAll('.reveal').forEach(el => {
      revealObserver.observe(el);
    });
  }

  // Re-layout on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutMasonry, 150);
  });

  // 任务3.3：失败图片重试加载
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
      item.animate(
        [{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      );
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
        { duration: 300, delay: i * 30, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
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
