// ==== 配置：替换为你自己的 Worker 地址（如果有） ====
const API_BASE_URL = 'https://api.782385.xyz';

// ========== 本地默认食物（与后端 defaultFoods 保持一致） ==========
const CLIENT_DEFAULT_FOODS = [
  { id: 1, name: "老友粉", emoji: "🍜", description: "酸辣鲜香，一口入魂！" },
  { id: 2, name: "螺蛳粉", emoji: "🥘", description: "闻着臭吃着香，越吃越上头！" },
  { id: 3, name: "桂林米粉", emoji: "🍝", description: "滑嫩爽口，回味无穷！" },
  { id: 4, name: "生榨米粉", emoji: "🍲", description: "鲜香浓郁，口感独特！" },
  { id: 5, name: "麻辣烫", emoji: "🥵", description: "麻辣鲜香，过瘾！" },
  { id: 6, name: "火锅", emoji: "🍲", description: "围炉而坐，暖心暖胃！" },
  { id: 7, name: "烧烤", emoji: "🍢", description: "炭火香气，夜宵首选！" },
  { id: 8, name: "炸鸡", emoji: "🍗", description: "外酥里嫩，快乐源泉！" },
  { id: 9, name: "披萨", emoji: "🍕", description: "拉丝芝士，幸福满满！" },
  { id: 10, name: "寿司", emoji: "🍣", description: "精致美味，日式风情！" },
  { id: 11, name: "烤羊肉串", emoji: "🍖", description: "炭火烤制，香气四溢！" },
  { id: 12, name: "烤羊排", emoji: "🥩", description: "外焦里嫩，肉质鲜美！" },
];

// ====== 前端状态：clientUserFoods 表示已经被后端持久化的自定义项（本地保存） ======
let clientUserFoods = [];

// LocalStorage key
const LOCAL_KEY = 'clientUserFoods_v1';

// 元素引用
const decideBtn = document.getElementById('decideFood');
const foodButtonText = document.getElementById('foodButtonText');
const foodLoading = document.getElementById('foodLoading');
const foodResult = document.getElementById('foodResult');
const foodImage = document.getElementById('foodImage');
const addFoodBtn = document.getElementById('addFood');
const newFoodInput = document.getElementById('newFood');
const userFoodsList = document.getElementById('userFoodsList');

// ---------- audio 管理（保持你原有逻辑） ----------
const audioManager = {
    currentAudio: null,
    playSound: function(src, volume = 0.9) {
        this.stopSound();
        try {
            this.currentAudio = new Audio(src);
            this.currentAudio.volume = volume;
            this.currentAudio.preload = 'auto';
            this.currentAudio.play().catch(err => {
                console.warn('播放猫叫失败（可能需要用户交互以允许播放）:', err);
                showSoundPlayHint();
            });
            this.currentAudio.onended = () => { this.currentAudio = null; };
        } catch (e) { console.error('创建 Audio 出错:', e); this.currentAudio = null; }
    },
    stopSound: function() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
};

// 显示音频播放提示（部分浏览器需要用户交互）
function showSoundPlayHint() {
    const hint = document.createElement('div');
    hint.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 10000;
        text-align: center;
        max-width: 300px;
    `;
    hint.innerHTML = `<p>🔊 请点击任意位置启用音频播放</p><p style="font-size:12px;margin-top:8px">部分浏览器需要用户交互</p>`;
    document.body.appendChild(hint);
    const removeHint = () => {
        if (document.body.contains(hint)) document.body.removeChild(hint);
        document.removeEventListener('click', removeHint);
    };
    document.addEventListener('click', removeHint);
    setTimeout(removeHint, 5000);
}

// 播放真实猫叫（本地 assets）
function playRealCatSound(soundType) {
    const sounds = {
        short: 'assets/sounds/meow_short.mp3',
        long:  'assets/sounds/meow_long.wav',
        purr:  'assets/sounds/meow_purr.mp3',
        angry: 'assets/sounds/meow_angry.mp3',
        default: 'assets/sounds/meow_short.mp3'
    };
    const src = sounds[soundType] || sounds.default;
    audioManager.playSound(src, 0.9);
}

// ========= 本地 storage 操作 =========
function saveClientFoodsToLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(clientUserFoods)); } catch (e) { console.warn('保存 localStorage 失败', e); }
}
function loadClientFoodsFromLocal() {
  try {
    const s = localStorage.getItem(LOCAL_KEY);
    if (s) clientUserFoods = JSON.parse(s) || [];
  } catch (e) { clientUserFoods = []; }
}

// 安全转义（展示文本用）
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, v => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v])); }

// 渲染自定义食物列表
function renderUserFoods() {
  if (!userFoodsList) return;
  if (!clientUserFoods || clientUserFoods.length === 0) {
    userFoodsList.innerHTML = '<li style="color:#888;padding:6px 8px;border-radius:8px;background:#fafafa">你还没有添加自定义食物</li>';
    return;
  }
  userFoodsList.innerHTML = clientUserFoods.map(f => `
    <li data-id="${f.id}">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:20px">${escapeHtml(f.emoji || '🍽️')}</div>
        <div style="font-weight:600">${escapeHtml(f.name)}</div>
      </div>
      <div>
        <button class="deleteFoodBtn" data-id="${f.id}" style="background:#ff6b6b;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer">删除</button>
      </div>
    </li>
  `).join('');
}

// 初始化：加载 localStorage，然后尝试同步后端（如果后端有 userFoods 则以服务器优先）
async function initUserFoods() {
  loadClientFoodsFromLocal();
  renderUserFoods();

  try {
    const res = await fetch(`${API_BASE_URL}/api/food`);
    if (res.ok) {
      const serverAll = await res.json();
      // serverUser = serverAll - CLIENT_DEFAULT_FOODS
      const serverUser = serverAll.filter(s => !CLIENT_DEFAULT_FOODS.some(d => d.name === s.name && d.emoji === s.emoji));
      if (serverUser.length > 0) {
        clientUserFoods = serverUser;
        saveClientFoodsToLocal();
        renderUserFoods();
      }
    }
  } catch (e) {
    console.warn('无法同步后端 food 列表', e);
  }
}

// 显示食物结果
function showFoodResult(data) {
  foodResult.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:20px">${escapeHtml(data.emoji || '')} ${escapeHtml(data.name)} ${escapeHtml(data.emoji || '')}</div>
      <div style="margin-top:8px;font-size:14px;color:#555">${escapeHtml(data.description || '')}</div>
    </div>
  `;
  foodImage.innerHTML = `<div style="font-size:48px">${escapeHtml(data.emoji || '🍽️')}</div>`;
}

// 决策器：本地或后端
decideBtn.addEventListener('click', async function(){
  decideBtn.disabled = true;
  foodButtonText.textContent = '思考中...';
  foodLoading.style.display = 'inline-block';

  try {
    if (!clientUserFoods || clientUserFoods.length === 0) {
      // 前端本地选择
      const allLocal = CLIENT_DEFAULT_FOODS;
      const idx = Math.floor(Math.random() * allLocal.length);
      const data = allLocal[idx];
      showFoodResult(data);
    } else {
      // 请求后端
      const resp = await fetch(`${API_BASE_URL}/api/food/random`);
      if (!resp.ok) throw new Error('后端返回错误: ' + resp.status);
      const data = await resp.json();
      showFoodResult(data);
    }
  } catch (err) {
    console.error('决策器错误', err);
    foodResult.innerHTML = `<div style="text-align:center;color:var(--primary-color)">获取失败：${escapeHtml(err.message)}</div>`;
    foodImage.innerHTML = '';
  } finally {
    decideBtn.disabled = false;
    foodButtonText.textContent = '帮我决定！';
    foodLoading.style.display = 'none';
  }
});

// hover 预取（仅当使用后端时）
decideBtn.addEventListener('mouseenter', function(){
  if (clientUserFoods && clientUserFoods.length > 0) {
    // fire-and-forget
    fetch(`${API_BASE_URL}/api/food/random`).catch(()=>{});
  }
});

// 添加自定义食物：校验、去重、POST 到后端、成功则写 localStorage 并 render
addFoodBtn.addEventListener('click', async function(){
  const raw = newFoodInput.value.trim();
  if (!raw) { alert('请输入食物名称！'); return; }
  if (raw.length > 60) { alert('名字太长（最多60字符）'); return; }

  // 简单清洗
  const name = raw.replace(/[\\u0000-\\u001F<>]/g, '').trim();
  if (!name) { alert('名称含非法字符'); return; }

  const lower = name.toLowerCase();
  if (CLIENT_DEFAULT_FOODS.some(d => d.name.toLowerCase() === lower) || clientUserFoods.some(u => u.name.toLowerCase() === lower)) {
    alert('该选项已存在');
    return;
  }

  addFoodBtn.disabled = true;
  const prevTxt = addFoodBtn.textContent;
  addFoodBtn.textContent = '添加中...';

  try {
    const payload = { name, emoji: '🍽️', description: `看起来不错的${name}！` };
    const resp = await fetch(`${API_BASE_URL}/api/food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const json = await resp.json();
      const added = (json && json.success && json.food) ? json.food : (json.food ? json.food : { id: Date.now(), ...payload });
      clientUserFoods.push(added);
      saveClientFoodsToLocal();
      renderUserFoods();
      newFoodInput.value = '';
      alert(`已添加 "${added.name}"，后续决策将通过后端（包含你添加的项）。`);
    } else {
      const txt = await resp.text();
      throw new Error('添加失败: ' + resp.status + ' ' + txt);
    }
  } catch (err) {
    console.error('添加失败', err);
    alert('添加失败：' + err.message);
  } finally {
    addFoodBtn.disabled = false;
    addFoodBtn.textContent = prevTxt || '添加';
  }
});

// 删除自定义（事件委托）
userFoodsList.addEventListener('click', async function(e){
  const btn = e.target.closest('.deleteFoodBtn');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (!confirm('确认删除这条自定义食物？')) return;

  btn.disabled = true;
  btn.textContent = '删除中...';
  try {
    const resp = await fetch(`${API_BASE_URL}/api/food/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('删除失败: ' + resp.status);
    clientUserFoods = clientUserFoods.filter(f => String(f.id) !== String(id));
    saveClientFoodsToLocal();
    renderUserFoods();
  } catch (err) {
    console.error('删除失败', err);
    alert('删除失败：' + err.message);
    btn.disabled = false;
    btn.textContent = '删除';
  }
});

// ========== 猫叫分析上传（XHR 上传以显示进度） ==========
const analyzeBtn = document.getElementById('analyzeSound');
const analyzeInput = document.getElementById('catSoundUpload');
const analyzeProgress = document.getElementById('analyzeProgress');
const analyzePercent = document.getElementById('analyzePercent');
const analyzeButtonText = document.getElementById('analyzeButtonText');

analyzeBtn.addEventListener('click', function(){
  const file = analyzeInput.files && analyzeInput.files[0];
  if (!file) { alert('请选择音频文件'); return; }
  if (!file.type.startsWith('audio/')) { alert('请上传音频文件'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('文件过大（最大 5MB）'); return; }

  analyzeBtn.disabled = true;
  analyzeButtonText.textContent = '分析中...';
  analyzeProgress.style.display = 'block';
  analyzePercent.textContent = '0%';

  // 播放一段供用户听（可选）
  const audioURL = URL.createObjectURL(file);
  audioManager.playSound(audioURL, 0.8);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE_URL}/api/cat/analyze`);
  xhr.onload = function(){
    analyzeBtn.disabled = false;
    analyzeButtonText.textContent = '分析声音';
    analyzeProgress.style.display = 'none';
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const res = JSON.parse(xhr.responseText || '{}');
        document.getElementById('catTranslation').innerHTML = `<div style="text-align:center"><div style="font-size:16px">${escapeHtml(res.text)}</div><div style="color:#666;font-size:12px;margin-top:6px">置信度: ${res.confidence || 0}%</div></div>`;
        document.getElementById('catEmoji').textContent = res.emoji || '🐱';
      } catch (e) { console.error('解析返回失败', e); alert('分析失败：返回数据解析错误'); }
    } else {
      alert('分析失败: ' + xhr.status);
    }
  };
  xhr.onerror = function(){
    analyzeBtn.disabled = false;
    analyzeButtonText.textContent = '分析声音';
    analyzeProgress.style.display = 'none';
    alert('上传失败（网络或服务器问题）');
  };
  xhr.upload.onprogress = function(ev){
    if (ev.lengthComputable) {
      const pct = Math.round(ev.loaded / ev.total * 100);
      analyzePercent.textContent = pct + '%';
    }
  };
  const fd = new FormData();
  fd.append('audio', file);
  xhr.send(fd);
});

// ========== 猫叫快捷按钮（调用后端翻译并播放本地音） ==========
document.querySelectorAll('.cat-sound-btn').forEach(button => {
    button.addEventListener('click', async function() {
        const soundType = this.getAttribute('data-sound');
        playRealCatSound(soundType);

        try {
            const response = await fetch(`${API_BASE_URL}/api/cat/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ soundType })
            });
            if (!response.ok) throw new Error('后端错误: ' + response.status);
            const translation = await response.json();
            const translationElement = document.getElementById('catTranslation');
            translationElement.innerHTML = `<div style="text-align:center"><div style="font-size:20px">${escapeHtml(translation.text)}</div></div>`;
            const catEmojiElement = document.getElementById('catEmoji');
            catEmojiElement.textContent = translation.emoji || '🐱';
            translationElement.style.animation = 'none';
            catEmojiElement.style.animation = 'none';
            setTimeout(() => { translationElement.style.animation = 'pulse 0.5s'; catEmojiElement.style.animation = 'wiggle 0.5s'; }, 10);
        } catch (error) {
            console.error('翻译猫语失败:', error);
            document.getElementById('catTranslation').innerHTML = `<div style="text-align:center;color:var(--primary-color)">翻译失败：${escapeHtml(error.message)}</div>`;
        }
    });
});

// ========== 表单提交处理（保持原来逻辑，调用后端 contact API） ==========
document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitLoading = document.getElementById('submitLoading');
    const formMessage = document.getElementById('formMessage');

    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        subject: document.getElementById('subject').value.trim(),
        message: document.getElementById('message').value.trim()
    };

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
        showMessage('请填写所有必填字段！', 'error');
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showMessage('请输入有效的邮箱地址！', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtnText.textContent = '发送中...';
    submitLoading.style.display = 'inline-block';
    formMessage.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showMessage(result.message || '消息已成功发射！我会尽快回复你 😄', 'success');
            this.reset();
        } else {
            throw new Error(result.error || '发送失败，服务器返回错误');
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        showMessage('发送失败: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = '发射消息';
        submitLoading.style.display = 'none';
    }
});

function showMessage(message, type) {
    const formMessage = document.getElementById('formMessage');
    formMessage.textContent = message;
    formMessage.style.display = 'block';
    if (type === 'success') formMessage.style.color = '#4ECDC4';
    else if (type === 'error') formMessage.style.color = '#FF6B6B';
    else formMessage.style.color = '#1A535C';
    setTimeout(() => { formMessage.style.display = 'none'; }, 5000);
}

// ========== 页面交互效果（滚动 / 动画 / 按钮） ==========
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        navbar.style.boxShadow = 'none';
    }
});

const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('fade-in');
    });
}, observerOptions);
document.querySelectorAll('.card, .project-card').forEach(el => observer.observe(el));

document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseover', function() { this.style.transform = 'scale(1.05) rotate(2deg)'; });
    btn.addEventListener('mouseout', function() { this.style.transform = 'scale(1) rotate(0deg)'; });
});

// 启动：初始化自定义食物数据
initUserFoods();