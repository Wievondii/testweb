/**
 * Photography Exhibition - Gallery Page (KV-backed)
 */
(() => {
  const API_GALLERY = '/api/gallery';
  const API_CONFIG = '/api/config';

  let photos = [];
  let filteredPhotos = [];
  let currentTag = 'all';
  let currentCategory = 'all';
  let lightboxIndex = -1;

  // Artistic animation pool
  const ANIMATIONS = ['fadeUp', 'slideFromLeft', 'slideFromRight', 'scaleIn', 'rotateIn', 'floatIn'];
  const SIZE_CLASSES = ['tall', 'wide', 'featured'];

  function pickAnimation() {
    return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  }

  function pickSizeClass(index) {
    // Create visual rhythm: not every photo gets a special size
    const r = Math.random();
    if (r < 0.15) return 'tall';
    if (r < 0.25) return 'wide';
    if (r < 0.32) return 'featured';
    return '';
  }

  function randomDelay() {
    return (Math.random() * 0.6).toFixed(2);
  }

  // DOM refs
  const header = document.getElementById('header');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const tagFilter = document.getElementById('tagFilter');
  const masonry = document.getElementById('masonry');
  const emptyState = document.getElementById('emptyState');
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
        heroTitle.textContent = config.galleryTitle;
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
    renderTags();
    renderGallery();
  }

  function getAllTags() {
    const tagSet = new Set();
    photos.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
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
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    // Re-render tags for the filtered category
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
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}" loading="lazy">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>`;
    }).join('');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const item = entry.target;
          const img = item.querySelector('img');
          const animName = item.style.getPropertyValue('--anim-name');
          const animDelay = parseFloat(item.style.getPropertyValue('--anim-delay')) || 0;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            const onReady = () => {
              item.classList.remove('loading');
              // Use Web Animations API — no class swap, no flicker
              const keyframes = {
                fadeUp: [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }],
                slideFromLeft: [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'translateX(0)' }],
                slideFromRight: [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'translateX(0)' }],
                scaleIn: [{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'scale(1)' }],
                rotateIn: [{ opacity: 0, transform: 'rotate(-3deg) scale(0.9)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }],
                floatIn: [
                  { opacity: 0, transform: 'translateY(-40px) translateX(15px)' },
                  { opacity: 0.8, transform: 'translateY(5px) translateX(-3px)', offset: 0.6 },
                  { opacity: 1, transform: 'translateY(0) translateX(0)' },
                ],
              };
              const kf = keyframes[animName] || keyframes.fadeUp;
              const anim = item.animate(kf, {
                duration: 800,
                delay: animDelay * 1000,
                easing: 'ease',
                fill: 'forwards',
              });
              // After animation, transfer state to inline styles and cancel animation
              // so CSS :hover transforms are not blocked by animation fill
              setTimeout(() => {
                anim.cancel();
                item.style.opacity = '1';
                item.style.transform = 'none';
                item.classList.add('visible');
              }, (animDelay + 0.8) * 1000);
            };
            img.onload = onReady;
            img.onerror = () => { onReady(); img.style.display = 'none'; };
          }
          observer.unobserve(item);
        }
      });
    }, { rootMargin: '200px' });

    masonry.querySelectorAll('.photo-item').forEach(el => observer.observe(el));
  }

  // Lightbox
  function openLightbox(index) {
    lightboxIndex = index;
    const photo = filteredPhotos[index];
    if (!photo) return;
    lbImg.src = photo.url;
    lbTitle.textContent = photo.title || '';
    lbDesc.textContent = photo.description || '';
    lbCounter.textContent = `${index + 1} / ${filteredPhotos.length}`;
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
    lbCounter.textContent = `${lightboxIndex + 1} / ${filteredPhotos.length}`;
  }

  // Events
  document.getElementById('categoryFilter').addEventListener('click', (e) => { const btn = e.target.closest('.cat-btn'); if (btn) filterByCategory(btn.dataset.cat); });
  tagFilter.addEventListener('click', (e) => { const btn = e.target.closest('.tag-btn'); if (btn) filterByTag(btn.dataset.tag); });
  masonry.addEventListener('click', (e) => { const item = e.target.closest('.photo-item'); if (item) openLightbox(parseInt(item.dataset.index, 10)); });
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lbNext').addEventListener('click', () => navigateLightbox(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => { const diff = touchStartX - e.changedTouches[0].clientX; if (Math.abs(diff) > 50) navigateLightbox(diff > 0 ? 1 : -1); }, { passive: true });

  window.addEventListener('scroll', () => { header.classList.toggle('scrolled', window.scrollY > 100); }, { passive: true });

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // Init
  loadConfig();
  loadPhotos();
  initHeroParticles();

  function initHeroParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    const count = 15;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'hero-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (6 + Math.random() * 8) + 's';
      p.style.animationDelay = (Math.random() * 10) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      p.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
      container.appendChild(p);
    }
  }
})();
