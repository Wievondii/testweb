/**
 * Photography Exhibition - Gallery Page
 */
(() => {
  const IMAGE_HOST = 'https://image.20041126.xyz';
  let photos = [];
  let filteredPhotos = [];
  let currentTag = 'all';
  let lightboxIndex = -1;

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

  // Load photos.json
  async function loadPhotos() {
    try {
      const res = await fetch('photos.json?t=' + Date.now());
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      photos = data.photos || [];
      if (data.config) {
        if (data.config.galleryTitle) heroTitle.textContent = data.config.galleryTitle;
        if (data.config.gallerySubtitle) heroSubtitle.textContent = data.config.gallerySubtitle;
        document.title = data.config.galleryTitle || 'Photography Exhibition';
      }
    } catch (e) {
      console.warn('Could not load photos.json:', e);
      photos = [];
    }
    filteredPhotos = [...photos];
    renderTags();
    renderGallery();
  }

  // Extract all unique tags
  function getAllTags() {
    const tagSet = new Set();
    photos.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  }

  // Render tag filter buttons
  function renderTags() {
    const tags = getAllTags();
    if (tags.length === 0) {
      tagFilter.style.display = 'none';
      return;
    }
    tagFilter.style.display = 'flex';
    tagFilter.innerHTML = `<button class="tag-btn active" data-tag="all">All</button>` +
      tags.map(t => `<button class="tag-btn" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('');
  }

  // Filter photos by tag
  function filterByTag(tag) {
    currentTag = tag;
    filteredPhotos = tag === 'all' ? [...photos] : photos.filter(p => (p.tags || []).includes(tag));
    renderGallery();
    // Update active button
    tagFilter.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === tag);
    });
  }

  // Render masonry gallery
  function renderGallery() {
    if (filteredPhotos.length === 0) {
      masonry.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    masonry.innerHTML = filteredPhotos.map((photo, i) => `
      <div class="photo-item loading" data-index="${i}" data-id="${photo.id}">
        <img data-src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.title || '')}" loading="lazy">
        <div class="photo-overlay">
          <h3>${escapeHtml(photo.title || '')}</h3>
          <p>${escapeHtml(photo.description || '')}</p>
        </div>
      </div>
    `).join('');

    // Lazy load with IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const item = entry.target;
          const img = item.querySelector('img');
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.onload = () => {
              item.classList.remove('loading');
              item.classList.add('visible');
            };
            img.onerror = () => {
              item.classList.remove('loading');
              item.classList.add('visible');
              img.style.display = 'none';
            };
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

  // Event listeners
  // Tag filter delegation
  tagFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-btn');
    if (btn) filterByTag(btn.dataset.tag);
  });

  // Gallery click delegation
  masonry.addEventListener('click', (e) => {
    const item = e.target.closest('.photo-item');
    if (item) openLightbox(parseInt(item.dataset.index, 10));
  });

  // Lightbox controls
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lbNext').addEventListener('click', () => navigateLightbox(1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navigateLightbox(diff > 0 ? 1 : -1);
  }, { passive: true });

  // Header scroll effect
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 100);
  }, { passive: true });

  // Helpers
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Init
  loadPhotos();
})();
