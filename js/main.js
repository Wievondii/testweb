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

  function pickSizeClass(index) {
    const r = Math.random();
    if (r < 0.12) return 'tall';
    if (r < 0.22) return 'wide';
    if (r < 0.30) return 'featured';
    return '';
  }

  function randomDelay() {
    return (Math.random() * 0.5).toFixed(2);
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

  function renderGallery() {
    if (filteredPhotos.length === 0) {
      masonry.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    masonry.innerHTML = filteredPhotos.map((photo, i) => {
      const anim = pickAnimation();
      const delay = randomDelay();
      const sizeClass = pickSizeClass(i);
      const classes = ['photo-item', 'loading', sizeClass].filter(Boolean).join(' ');
      return `
      <div class="${classes}" data-index="${i}" data-id="${photo.id}"
           style="--anim-name:${anim}; --anim-delay:${delay}s;">
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>`;
    }).join('');

    // Sequential loader
    const items = masonry.querySelectorAll('.photo-item');
    let loadIndex = 0;
    const BATCH = 3;

    function loadNext() {
      if (loadIndex >= items.length) return;
      const end = Math.min(loadIndex + BATCH, items.length);
      for (let i = loadIndex; i < end; i++) loadItem(items[i]);
      loadIndex = end;
    }

    function loadItem(item) {
      const img = item.querySelector('img');
      const animName = item.style.getPropertyValue('--anim-name');
      const animDelay = parseFloat(item.style.getPropertyValue('--anim-delay')) || 0;
      if (!img.dataset.src) return;

      img.src = img.dataset.src;
      img.removeAttribute('data-src');

      const onReady = () => {
        item.classList.remove('loading');
        const keyframes = {
          fadeUp: [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }],
          slideFromLeft: [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'translateX(0)' }],
          slideFromRight: [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'translateX(0)' }],
          scaleIn: [{ opacity: 0, transform: 'scale(0.88)' }, { opacity: 1, transform: 'scale(1)' }],
          rotateIn: [{ opacity: 0, transform: 'rotate(-2deg) scale(0.92)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }],
          floatIn: [
            { opacity: 0, transform: 'translateY(-30px) translateX(10px)' },
            { opacity: 0.8, transform: 'translateY(4px) translateX(-2px)', offset: 0.6 },
            { opacity: 1, transform: 'translateY(0) translateX(0)' },
          ],
        };
        const kf = keyframes[animName] || keyframes.fadeUp;
        const anim = item.animate(kf, {
          duration: 900,
          delay: animDelay * 1000,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        });
        setTimeout(() => {
          anim.cancel();
          item.style.opacity = '1';
          item.style.transform = 'none';
          item.classList.add('visible');
        }, (animDelay + 0.9) * 100);
      };
      img.onload = onReady;
      img.onerror = () => { onReady(); img.style.display = 'none'; };
    }

    loadNext();
    const scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) loadNext();
    }, { rootMargin: '400px' });
    scrollObserver.observe(masonry);
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
