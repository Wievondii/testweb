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

  // Load config
  async function loadConfig() {
    try {
      const res = await fetch(API_CONFIG);
      if (!res.ok) return;
      const config = await res.json();
      if (config.galleryTitle) {
        heroTitle.innerHTML = config.galleryTitle.replace(/\s/g, '<br>');
        document.title = config.galleryTitle;
      }
      if (config.gallerySubtitle) heroSubtitle.textContent = config.gallerySubtitle;
    } catch { /* use defaults */ }
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
    const counts = { '人像': 0, '花草': 0, '城市风景': 0 };
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
    source.forEach(p => (p.tags || []).forEach(t => {
      if (t !== currentCategory) tagSet.add(t);
    }));
    return [...tagSet].sort();
  }

  function renderTags() {
    const tags = getAllTags();
    if (tags.length === 0) { tagFilter.style.display = 'none'; return; }
    tagFilter.style.display = 'flex';
    tagFilter.innerHTML = `<button class="tag-btn active" data-tag="all">All</button>` +
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
    galleryCount.textContent = `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'work' : 'works'}`;
    renderGallery();
  }

  function filterByTag(tag) {
    currentTag = tag;
    applyFilters();
    tagFilter.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === tag);
    });
  }

  function filterByCategory(cat) {
    currentCategory = cat;
    currentTag = 'all';
    applyFilters();
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    renderTags();
    tagFilter.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === 'all');
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
      const classes = ['photo-item', 'loading', sizeClass].filter(Boolean).join(' ');
      return `
      <div class="${classes}" data-index="${i}" data-id="${photo.id}">
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>`;
    }).join('');

    // Load images one by one, each appears as it loads
    const items = masonry.querySelectorAll('.photo-item');
    const DELAY = 300; // ms between each image load
    let nextIdx = 0;
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
        item.animate(kf, { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
        setTimeout(() => { item.classList.add('visible'); }, 650);

        // Load next after delay
        setTimeout(loadNext, DELAY);
      };

      img.onload = onReady;
      img.onerror = () => {
        item.style.display = 'none';
        setTimeout(loadNext, DELAY);
      };
      img.src = src;
    }

    loadNext();
  }

  function staggerReveal(items) {
    const cols = getColumnCount();
    // Group items by column position (top-to-bottom within each column)
    // Since layout is absolute-positioned by column, items are already in column order in DOM
    // We want to reveal them in visual order: col0-row0, col1-row0, col2-row0, col0-row1, ...

    // For staggered reveal, just reveal in DOM order with a small cascade delay
    items.forEach((item, i) => {
      const animName = pickAnimation();
      const baseDelay = (i % cols) * 80; // cascade across columns
      const totalDelay = baseDelay;

      setTimeout(() => {
        const keyframes = {
          fadeUp: [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'translateY(0)' }],
          slideFromLeft: [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'translateX(0)' }],
          slideFromRight: [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }],
          scaleIn: [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }],
          rotateIn: [{ opacity: 0, transform: 'rotate(-1.5deg) scale(0.94)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }],
          floatIn: [
            { opacity: 0, transform: 'translateY(-20px) translateX(8px)' },
            { opacity: 0.8, transform: 'translateY(3px) translateX(-2px)', offset: 0.6 },
            { opacity: 1, transform: 'translateY(0) translateX(0)' },
          ],
        };
        const kf = keyframes[animName] || keyframes.fadeUp;
        const anim = item.animate(kf, {
          duration: 700,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        });
        item.classList.remove('loading');
        setTimeout(() => {
          anim.cancel();
          item.style.opacity = '1';
          item.style.transform = 'none';
          item.classList.add('visible');
        }, 750);
      }, totalDelay);
    });
  }

  // Re-layout on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutMasonry, 150);
  });

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
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightboxIndex = -1;
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

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // Init
  loadConfig();
  loadPhotos();
})();
