/**
 * Photography Exhibition - Admin Panel (KV-backed)
 */
(() => {
  const IMAGE_HOST = 'https://image.20041126.xyz';
  const UPLOAD_URL = '/api/relay';
  const API_PHOTOS = '/api/photos';
  const API_AUTH = '/api/auth';
  const API_RELAY = '/api/relay';
  const API_CONFIG = '/api/config';

  let photos = [];
  let pendingFile = null;
  let pendingCompressed = null;
  let editingId = null;
  let deletingId = null;
  let currentHash = '';

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
      if (!res.ok) throw new Error('Failed to load');
      photos = await res.json();
    } catch (e) {
      console.warn('Failed to load from API, trying fallback:', e);
      try {
        const stored = localStorage.getItem('gallery_photos');
        photos = stored ? JSON.parse(stored) : [];
      } catch { photos = []; }
    }
    renderPhotoGrid();
  }

  async function addPhoto(photo) {
    try {
      const res = await fetch(API_PHOTOS, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(photo),
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      photos.unshift(saved);
      renderPhotoGrid();
      return saved;
    } catch (e) {
      // Fallback to localStorage
      photo.id = photo.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      photo.date = photo.date || new Date().toISOString().split('T')[0];
      photos.unshift(photo);
      localStorage.setItem('gallery_photos', JSON.stringify(photos));
      renderPhotoGrid();
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
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      const idx = photos.findIndex(p => p.id === updated.id);
      if (idx !== -1) photos[idx] = updated;
      renderPhotoGrid();
    } catch (e) {
      const idx = photos.findIndex(p => p.id === photo.id);
      if (idx !== -1) photos[idx] = { ...photos[idx], ...photo };
      localStorage.setItem('gallery_photos', JSON.stringify(photos));
      renderPhotoGrid();
    }
  }

  async function deletePhoto(id) {
    try {
      const res = await fetch(API_PHOTOS, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
    } catch { /* proceed with local removal */ }
    photos = photos.filter(p => p.id !== id);
    localStorage.setItem('gallery_photos', JSON.stringify(photos));
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
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }

    compressInfo.classList.add('show');
    document.getElementById('compressOriginal').textContent = 'Original: ' + ImageCompressor.formatSize(file.size);

    try {
      const result = await ImageCompressor.compress(file);
      pendingFile = file;
      pendingCompressed = result.file;

      document.getElementById('compressResult').textContent = 'Compressed: ' + ImageCompressor.formatSize(result.compressedSize);
      if (result.skipped) {
        document.getElementById('compressSaving').textContent = '(no compression needed)';
      } else {
        const saving = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        document.getElementById('compressSaving').textContent = `(-${saving}%)`;
      }

      previewImg.src = URL.createObjectURL(result.file);
      uploadPreview.classList.add('show');
      photoTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      photoDesc.value = '';
      photoTags.value = '';
    } catch (e) {
      showToast('Failed to process image: ' + e.message, 'error');
    }
  }

  cancelUpload.addEventListener('click', resetUpload);

  function resetUpload() {
    pendingFile = null;
    pendingCompressed = null;
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
    if (!title) { showToast('Please enter a title', 'error'); return; }

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    uploadProgress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Uploading to image host...';

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pendingCompressed);
      });

      progressBar.style.width = '30%';
      progressText.textContent = 'Uploading to image host...';

      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          filename: pendingCompressed.name,
          mimeType: pendingCompressed.type || 'image/jpeg',
        }),
      });

      progressBar.style.width = '80%';

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed: ${res.status}`);
      }

      const uploadResult = await res.json();

      let imageUrl = '';
      if (Array.isArray(uploadResult) && uploadResult[0]?.src) {
        imageUrl = IMAGE_HOST + uploadResult[0].src;
      } else if (uploadResult?.src) {
        imageUrl = IMAGE_HOST + uploadResult.src;
      } else { throw new Error('Unexpected response format'); }

      progressBar.style.width = '90%';
      progressText.textContent = 'Saving to gallery...';

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
      showToast('Photo uploaded and saved!', 'success');
    } catch (e) {
      showToast('Upload failed: ' + e.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Save';
      uploadProgress.style.display = 'none';
    }
  });

  // ======== Photo Grid ========
  function renderPhotoGrid() {
    photoCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;
    if (photos.length === 0) {
      photoGrid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No photos yet.</p>';
      return;
    }
    photoGrid.innerHTML = photos.map(p => `
      <div class="photo-card" data-id="${p.id}">
        <img class="photo-card-img" src="${escapeAttr(p.url)}" alt="${escapeAttr(p.title)}" loading="lazy">
        <div class="photo-card-body">
          <h4>${escapeHtml(p.title)}</h4>
          <p>${escapeHtml(p.description || '')}</p>
          <div class="photo-card-tags">${(p.tags || []).map(t => `<span class="photo-card-tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="photo-card-actions">
            <button class="btn btn-sm edit-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${p.id}">Delete</button>
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
    showToast('Photo updated', 'success');
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
    showToast('Photo removed', 'success');
  });

  deleteCancel.addEventListener('click', () => { deleteModal.classList.remove('active'); deletingId = null; });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteCancel.click(); });

  // ======== Export / Import (backup) ========
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ photos }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'photos.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported photos.json', 'success');
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
          showToast(`Imported ${data.photos.length} photos`, 'success');
        } else { throw new Error('Invalid format'); }
      } catch { showToast('Failed to import: invalid JSON', 'error'); }
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
          galleryTitle: cfgTitle.value.trim() || 'Photography Exhibition',
          gallerySubtitle: cfgSubtitle.value.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      showToast('Settings saved', 'success');
    } catch (e) {
      showToast('Failed to save settings: ' + e.message, 'error');
    }
  });

  // ======== Init ========
  checkLogin();
})();
