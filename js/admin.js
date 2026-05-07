/**
 * Photography Exhibition - Admin Panel (KV-backed)
 */
(() => {
  const IMAGE_HOST = 'https://image.20041126.xyz';
  const UPLOAD_URL = IMAGE_HOST + '/api/enableauthapi/tgchannel';
  const API_PHOTOS = '/api/photos';
  const API_AUTH = '/api/auth';
  const API_CONFIG = '/api/config';

  let photos = [];
  let pendingFile = null;
  let pendingCompressed = null;
  let editingId = null;
  let deletingId = null;
  let currentHash = '';
  let uploadPrefillCategory = null;
  let currentCategoryFilter = 'all';

  // DOM refs
  const loginGate = document.getElementById('loginGate');
  const adminPanel = document.getElementById('adminPanel');
  const loginPassword = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const fileInput = document.getElementById('fileInput');
  const compressInfo = document.getElementById('compressInfo');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('previewImg');
  const photoTitle = document.getElementById('photoTitle');
  const photoDesc = document.getElementById('photoDesc');
  const photoTags = document.getElementById('photoTags');
  const uploadBtn = document.getElementById('uploadBtn');
  const cancelUpload = document.getElementById('cancelUpload');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const photoGrid = document.getElementById('photoGrid');
  const photoCount = document.getElementById('photoCount');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const editModal = document.getElementById('editModal');
  const editTitle = document.getElementById('editTitle');
  const editDesc = document.getElementById('editDesc');
  const editTags = document.getElementById('editTags');
  const editSave = document.getElementById('editSave');
  const editCancel = document.getElementById('editCancel');
  const deleteModal = document.getElementById('deleteModal');
  const deleteConfirm = document.getElementById('deleteConfirm');
  const deleteCancel = document.getElementById('deleteCancel');
  const toast = document.getElementById('toast');
  const adminCategoryBar = document.getElementById('adminCategoryBar');

  // ======== Auth ========
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function checkLogin() {
    const stored = sessionStorage.getItem('gallery_admin_hash');
    if (stored) {
      currentHash = stored;
      if (await tryAuth()) {
        showAdmin();
        return;
      }
    }
    loginGate.style.display = 'flex';
    adminPanel.style.display = 'none';
  }

  async function tryAuth() {
    try {
      const res = await fetch(API_AUTH, {
        headers: { 'Authorization': 'Bearer ' + currentHash },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.valid === true;
    } catch {
      return false;
    }
  }

  function showAdmin() {
    loginGate.style.display = 'none';
    adminPanel.style.display = 'block';
    loadPhotos();
  }

  loginBtn.addEventListener('click', async () => {
    const pass = loginPassword.value;
    if (!pass) return;
    const hash = await sha256(pass);
    currentHash = hash;
    if (await tryAuth()) {
      sessionStorage.setItem('gallery_admin_hash', hash);
      loginError.style.display = 'none';
      showAdmin();
    } else {
      loginError.style.display = 'block';
      loginPassword.value = '';
    }
  });

  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('gallery_admin_hash');
    currentHash = '';
    loginGate.style.display = 'flex';
    adminPanel.style.display = 'none';
    loginPassword.value = '';
  });

  // ======== API Helpers ========
  function authHeaders(extra = {}) {
    return {
      'Authorization': 'Bearer ' + currentHash,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async function loadPhotos() {
    try {
      const res = await fetch(API_PHOTOS, { headers: authHeaders() });
      if (!res.ok) throw new Error('加载失败');
      photos = await res.json();
    } catch (e) {
      console.warn('Failed to load from API, trying fallback:', e);
      try {
        const stored = localStorage.getItem('gallery_photos');
        photos = stored ? JSON.parse(stored) : [];
      } catch { photos = []; }
    }
    renderPhotoGrid();
    renderCategoryBar();
  }

  async function addPhoto(photo) {
    try {
      const res = await fetch(API_PHOTOS, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(photo),
      });
      if (!res.ok) throw new Error('保存失败');
      const saved = await res.json();
      photos.unshift(saved);
      renderPhotoGrid();
      renderCategoryBar();
      return saved;
    } catch (e) {
      // Fallback to localStorage
      photo.id = photo.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      photo.date = photo.date || new Date().toISOString().split('T')[0];
      photos.unshift(photo);
      localStorage.setItem('gallery_photos', JSON.stringify(photos));
      renderPhotoGrid();
      renderCategoryBar();
      return photo;
    }
  }

  async function updatePhoto(photo) {
    try {
      const res = await fetch(API_PHOTOS, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(photo),
      });
      if (!res.ok) throw new Error('更新失败');
      const updated = await res.json();
      const idx = photos.findIndex(p => p.id === updated.id);
      if (idx !== -1) photos[idx] = updated;
      renderPhotoGrid();
      renderCategoryBar();
    } catch (e) {
      const idx = photos.findIndex(p => p.id === photo.id);
      if (idx !== -1) photos[idx] = { ...photos[idx], ...photo };
      localStorage.setItem('gallery_photos', JSON.stringify(photos));
      renderPhotoGrid();
      renderCategoryBar();
    }
  }

  async function deletePhoto(id) {
    try {
      const res = await fetch(API_PHOTOS, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('删除失败');
    } catch { /* proceed with local removal */ }
    photos = photos.filter(p => p.id !== id);
    localStorage.setItem('gallery_photos', JSON.stringify(photos));
    renderPhotoGrid();
    renderCategoryBar();
  }

  // ======== Category Bar ========
  function renderCategoryBar() {
    const categories = ['人像', '花草', '城市风景', '其他'];
    const counts = {};
    counts.all = photos.length;
    categories.forEach(c => counts[c] = 0);
    photos.forEach(p => {
      (p.tags || []).forEach(t => {
        if (counts.hasOwnProperty(t)) counts[t]++;
      });
    });
    ['all', ...categories].forEach(c => {
      const el = adminCategoryBar.querySelector(`[data-count-cat="${c}"]`);
      if (el) el.textContent = counts[c];
    });
  }

  function getVisiblePhotos() {
    if (currentCategoryFilter === 'all') return photos;
    return photos.filter(p => (p.tags || []).includes(currentCategoryFilter));
  }

  function setCategoryFilter(cat) {
    currentCategoryFilter = cat;
    uploadPrefillCategory = cat === 'all' ? null : cat;
    adminCategoryBar.querySelectorAll('.admin-cat-tag').forEach(t => {
      t.classList.toggle('active', t.dataset.cat === cat);
    });
    renderPhotoGrid();
  }

  // ======== Upload Zone ========
  const uploadZone = document.getElementById('uploadZone');
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
  });

  async function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) { showToast('请先选择图片', 'error'); return; }

    compressInfo.classList.add('show');
    document.getElementById('compressOriginal').textContent = '原图: ' + ImageCompressor.formatSize(file.size);

    try {
      const result = await ImageCompressor.compress(file);
      pendingFile = file;
      pendingCompressed = result.file;

      document.getElementById('compressResult').textContent = '压缩后: ' + ImageCompressor.formatSize(result.compressedSize);
      if (result.skipped) {
        document.getElementById('compressSaving').textContent = '（无需压缩）';
      } else {
        const saving = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        document.getElementById('compressSaving').textContent = `(-${saving}%)`;
      }

      previewImg.src = URL.createObjectURL(result.file);
      uploadPreview.classList.add('show');
      photoTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      photoDesc.value = '';
      photoTags.value = uploadPrefillCategory || '';
    } catch (e) {
      showToast('压缩失败: ' + e.message, 'error');
    }
  }

  cancelUpload.addEventListener('click', resetUpload);

  function resetUpload() {
    pendingFile = null;
    pendingCompressed = null;
    uploadPrefillCategory = currentCategoryFilter === 'all' ? null : currentCategoryFilter;
    compressInfo.classList.remove('show');
    uploadPreview.classList.remove('show');
    uploadProgress.style.display = 'none';
    fileInput.value = '';
    photoTitle.value = '';
    photoDesc.value = '';
    photoTags.value = '';
  }

  // ======== Upload to Image Host + Save ========
  uploadBtn.addEventListener('click', async () => {
    if (!pendingCompressed) return;
    const title = photoTitle.value.trim();
    if (!title) { showToast('请输入作品标题', 'error'); return; }

    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中...';
    uploadProgress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '正在上传到图床...';

    try {
      progressBar.style.width = '10%';
      progressText.textContent = '准备上传...';

      // Upload via proxy - use fetch with Blob (no custom headers = no preflight)
      const fname = encodeURIComponent(pendingCompressed.name);
      const mime = encodeURIComponent(pendingCompressed.type || 'image/jpeg');
      const blob = new Blob([await pendingCompressed.arrayBuffer()], { type: 'text/plain' });

      progressBar.style.width = '20%';
      progressText.textContent = '正在上传到图床...';

      const res = await fetch(`/api/data?n=${fname}&t=${mime}`, {
        method: 'POST',
        body: blob,
      });

      progressBar.style.width = '80%';

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `上传失败: ${res.status}`);
      }

      const uploadResult = await res.json();

      progressBar.style.width = '90%';

      // Image host returns { url: "..." } or { status, url, ... }
      let imageUrl = '';
      if (uploadResult?.url) {
        imageUrl = uploadResult.url;
        // If URL is relative, prepend host
        if (imageUrl.startsWith('/')) imageUrl = IMAGE_HOST + imageUrl;
      } else if (Array.isArray(uploadResult) && uploadResult[0]?.src) {
        imageUrl = IMAGE_HOST + uploadResult[0].src;
      } else if (uploadResult?.src) {
        imageUrl = IMAGE_HOST + uploadResult.src;
      } else { throw new Error('服务器返回异常: ' + JSON.stringify(uploadResult)); }

      progressText.textContent = '保存到画廊...';

      const tags = photoTags.value.split(',').map(t => t.trim()).filter(Boolean);
      const photo = {
        url: imageUrl,
        title,
        description: photoDesc.value.trim(),
        tags,
      };

      await addPhoto(photo);
      progressBar.style.width = '100%';
      resetUpload();
      showToast('作品上传成功', 'success');
    } catch (e) {
      showToast('上传失败: ' + e.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '上传并保存';
      uploadProgress.style.display = 'none';
    }
  });

  // ======== Photo Grid ========
  function renderPhotoGrid() {
    const visiblePhotos = getVisiblePhotos();
    if (currentCategoryFilter === 'all') {
      photoCount.textContent = `${photos.length} 张作品`;
      photoCount.setAttribute('aria-label', `当前显示全部，共 ${photos.length} 张作品`);
    } else {
      photoCount.textContent = `${visiblePhotos.length}/${photos.length} - 分类: ${currentCategoryFilter}`;
      photoCount.setAttribute('aria-label', `当前分类 ${currentCategoryFilter}，显示 ${visiblePhotos.length} 张，共 ${photos.length} 张作品`);
    }
    if (visiblePhotos.length === 0) {
      photoGrid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">暂无作品</p>';
      return;
    }
    photoGrid.innerHTML = visiblePhotos.map(p => `
      <div class="photo-card" data-id="${escapeAttr(p.id)}" draggable="true">
        <img class="photo-card-img" src="${escapeAttr(p.url)}" alt="${escapeAttr(p.title)}" loading="lazy">
        <div class="photo-card-body">
          <h4>${escapeHtml(p.title)}</h4>
          <p>${escapeHtml(p.description || '')}</p>
          <div class="photo-card-tags">${(p.tags || []).map(t => `<span class="photo-card-tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="photo-card-actions">
            <button class="btn btn-sm edit-btn" data-id="${escapeAttr(p.id)}">编辑</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${escapeAttr(p.id)}">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  photoGrid.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');
    if (editBtn) openEditModal(editBtn.dataset.id);
    if (deleteBtn) openDeleteModal(deleteBtn.dataset.id);
  });

  // ======== Category Bar: Click to Filter ========
  adminCategoryBar.addEventListener('click', (e) => {
    const tag = e.target.closest('.admin-cat-tag');
    if (!tag) return;
    setCategoryFilter(tag.dataset.cat);
  });

  // ======== Category Bar: Drag to Classify ========
  adminCategoryBar.addEventListener('dragover', (e) => {
    const tag = e.target.closest('.admin-cat-tag');
    if (!tag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    tag.classList.add('drag-over');
  });

  adminCategoryBar.addEventListener('dragenter', (e) => {
    const tag = e.target.closest('.admin-cat-tag');
    if (tag) { e.preventDefault(); tag.classList.add('drag-over'); }
  });

  adminCategoryBar.addEventListener('dragleave', (e) => {
    const tag = e.target.closest('.admin-cat-tag');
    if (tag) tag.classList.remove('drag-over');
  });

  adminCategoryBar.addEventListener('drop', (e) => {
    e.preventDefault();
    const tag = e.target.closest('.admin-cat-tag');
    if (!tag) return;
    tag.classList.remove('drag-over');
    const photoId = e.dataTransfer.getData('text/plain');
    if (!photoId) return;
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;
    if (!photo.tags) photo.tags = [];
    const cat = tag.dataset.cat;
    if (cat === 'all') return;
    if (!photo.tags.includes(cat)) {
      photo.tags.push(cat);
      updatePhoto(photo);
    }
  });

  // ======== Photo Card Drag ========
  photoGrid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.photo-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'copy';
    card.classList.add('dragging');
  });

  photoGrid.addEventListener('dragend', (e) => {
    const card = e.target.closest('.photo-card');
    if (card) card.classList.remove('dragging');
  });

  // ======== Edit Modal ========
  function openEditModal(id) {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    editingId = id;
    editTitle.value = photo.title || '';
    editDesc.value = photo.description || '';
    editTags.value = (photo.tags || []).join(', ');
    editModal.classList.add('active');
  }

  editSave.addEventListener('click', async () => {
    if (!editingId) return;
    await updatePhoto({
      id: editingId,
      title: editTitle.value.trim(),
      description: editDesc.value.trim(),
      tags: editTags.value.split(',').map(t => t.trim()).filter(Boolean),
    });
    editModal.classList.remove('active');
    editingId = null;
    showToast('作品已更新', 'success');
  });

  editCancel.addEventListener('click', () => { editModal.classList.remove('active'); editingId = null; });
  editModal.addEventListener('click', (e) => { if (e.target === editModal) editCancel.click(); });

  // ======== Delete Modal ========
  function openDeleteModal(id) { deletingId = id; deleteModal.classList.add('active'); }

  deleteConfirm.addEventListener('click', async () => {
    if (!deletingId) return;
    await deletePhoto(deletingId);
    deleteModal.classList.remove('active');
    deletingId = null;
    showToast('作品已删除', 'success');
  });

  deleteCancel.addEventListener('click', () => { deleteModal.classList.remove('active'); deletingId = null; });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteCancel.click(); });

  // ======== Export / Import (backup) ========
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ photos }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'xiaofei-gallery-backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('已导出备份文件', 'success');
  });

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.photos && Array.isArray(data.photos)) {
          for (const photo of data.photos) {
            await addPhoto(photo);
          }
          showToast(`成功导入 ${data.photos.length} 张作品`, 'success');
        } else { throw new Error('格式无效'); }
      } catch { showToast('导入失败：JSON 格式无效', 'error'); }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  // ======== Toast ========
  function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3000);
  }

  // ======== Helpers ========
  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
  function escapeAttr(str) { return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // ======== Gallery Config ========
  const cfgTitle = document.getElementById('cfgTitle');
  const cfgSubtitle = document.getElementById('cfgSubtitle');
  const cfgSave = document.getElementById('cfgSave');

  async function loadConfig() {
    try {
      const res = await fetch(API_CONFIG);
      if (!res.ok) return;
      const config = await res.json();
      if (config.galleryTitle) cfgTitle.value = config.galleryTitle;
      if (config.gallerySubtitle) cfgSubtitle.value = config.gallerySubtitle;
    } catch { /* use defaults */ }
  }

  cfgSave.addEventListener('click', async () => {
    try {
      const res = await fetch(API_CONFIG, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          galleryTitle: cfgTitle.value.trim() || '小肥画展',
          gallerySubtitle: cfgSubtitle.value.trim(),
        }),
      });
      if (!res.ok) throw new Error('保存失败');
      showToast('设置已保存', 'success');
    } catch (e) {
      showToast('保存设置失败: ' + e.message, 'error');
    }
  });

  // ======== Init ========
  checkLogin();
})();
