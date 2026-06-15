// ===== 🔐 LSCgroup 管理后台（GitHub API 真保存版） =====
const ADMIN_PASSWORD = 'LSC2026';
const REPO_OWNER = 'litongfeng222';
const REPO_NAME = 'lsc';
const FILES_PATH = 'data/files.json';
const ASSETS_PATH = 'assets/files/';
const RAW_BASE = 'https://raw.githubusercontent.com/litongfeng222/lsc/main/';

// ===== Token 管理（存浏览器，安全） =====
function getToken() {
  let t = localStorage.getItem('lsc_gh_token');
  if (!t) {
    t = prompt('🔑 请输入你的 GitHub Token（设置一次以后不用再输）：\nhttps://github.com/settings/tokens');
    if (t) localStorage.setItem('lsc_gh_token', t);
  }
  return t;
}

function clearToken() {
  localStorage.removeItem('lsc_gh_token');
  alert('✅ Token 已清除');
}

let ADMIN_LOGGED_IN = false;

// ===== 登录/登出 =====
function checkLogin() {
  if (localStorage.getItem('lsc_admin') === 'yes') {
    ADMIN_LOGGED_IN = true;
    const box = document.getElementById('loginBox');
    if (box) box.classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    initAdmin();
  }
}

function showLogin() { document.getElementById('loginBox').classList.remove('hidden'); }
function hideLogin() { document.getElementById('loginBox').classList.add('hidden'); }

function doLogin() {
  const pwd = document.getElementById('pwdInput');
  if (pwd && pwd.value === ADMIN_PASSWORD) {
    ADMIN_LOGGED_IN = true;
    localStorage.setItem('lsc_admin', 'yes');
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    initAdmin();
  } else {
    document.getElementById('loginError').textContent = '❌ 密码错误';
  }
}

function doLogout() {
  ADMIN_LOGGED_IN = false;
  localStorage.removeItem('lsc_admin');
  location.reload();
}

// ===== GitHub API 工具 =====
async function ghGet(path) {
  const token = getToken();
  if (!token) throw new Error('需要 Token 才能操作');
  const r = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.message || '获取失败');
  }
  return r.json();
}

async function ghPut(path, content, sha, message) {
  const token = getToken();
  if (!token) throw new Error('需要 Token 才能操作');
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const r = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message || '更新资料列表',
      content: encoded,
      sha: sha || undefined
    })
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.message || '保存失败');
  }
  return r.json();
}

// ===== 加载文件列表 =====
async function loadGhFiles() {
  const data = await ghGet(FILES_PATH);
  if (data.content) {
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(decoded);
    window._ghSha = data.sha;
    return parsed.files || [];
  }
  return [];
}

async function saveGhFiles(files) {
  const json = JSON.stringify({ files }, null, 2);
  const result = await ghPut(FILES_PATH, json, window._ghSha, '📝 管理员更新资料');
  if (result.content) {
    window._ghSha = result.content.sha;
    return true;
  }
  throw new Error(result.message || '保存失败');
}

// ===== 初始化管理面板 =====
let _subjects = [];

async function initAdmin() {
  _subjects = window.subjects || [];
  if (_subjects.length === 0) {
    try {
      const d = await fetch('./data/subjects.json').then(r => r.json());
      _subjects = d.subjects || [];
    } catch(e) {}
  }
  loadSubjectOptions();

  _adminFiles = window.allFiles || [];
  renderAdminFilesUI();

  // 加载标签配置面板
  renderTagConfigUI();
  loadBgUI();

  setTimeout(syncFromGitHub, 100);

  setupUpload();
}

async function syncFromGitHub() {
  try {
    const token = localStorage.getItem('lsc_gh_token');
    if (!token) return;
    const fresh = await loadGhFiles();
    if (fresh.length > 0) {
      _adminFiles = fresh;
      renderAdminFilesUI();
      window.allFiles = [...fresh];
      if (window.DataLoader) {
        window.DataLoader.clearCache();
        window.DataLoader._files = [...fresh];
      }
      if (window.renderFiles) window.renderFiles();
      if (window.updateStats) window.updateStats();
      const s = document.getElementById('adminSyncStatus');
      if (s) { s.textContent = '✅ 已同步最新'; setTimeout(() => { s.textContent = ''; }, 3000); }
    }
  } catch(e) {}
}

function loadSubjectOptions() {
  const opts = _subjects.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
  document.querySelectorAll('.subject-select').forEach(el => { el.innerHTML = opts; });
}

// ===== 渲染文件管理列表（含标签编辑） =====
let _adminFiles = [];

function renderAdminFilesUI() {
  const list = document.getElementById('adminFileList');
  if (!list) return;

  if (!_adminFiles || _adminFiles.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>📭 还没有资料</p></div>';
    return;
  }

  list.innerHTML = _adminFiles.map((file, idx) => {
    const sub = _subjects.find(s => s.id === file.subject) || { name: '其他', emoji: '📦', color: '#95a5a6' };

    // 获取可用标签选项（全局标签配置 + 子科目标签）
    const tagVal = file.tag || sub.name || '资料';
    const tagOpts = renderTagOptions(tagVal);

    return `<div class="admin-file-card">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <span style="font-size:22px;flex-shrink:0">${sub.emoji}</span>
        <div style="flex:1;min-width:0">
          <input class="admin-name-input" value="${file.name.replace(/"/g, '&quot;')}" data-idx="${idx}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:3px" />
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <select class="admin-subject-select subject-select" data-idx="${idx}" style="flex:1;min-width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px"></select>
            <select class="admin-tag-select" data-idx="${idx}" style="flex:1;min-width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px">
              ${tagOpts}
            </select>
            <span style="font-size:11px;color:#999;line-height:28px">${file.size || ''}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap">
        <button onclick="adminSave(${idx})" style="padding:5px 10px;background:#6c5ce7;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px">💾</button>
        <button onclick="adminDelete(${idx})" style="padding:5px 10px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px">🗑</button>
      </div>
    </div>`;
  }).join('');

  loadSubjectOptions();
}

// 渲染标签下拉选项
function renderTagOptions(selected) {
  const configs = window._tagConfigs || {};
  let opts = '';
  for (const [id, cfg] of Object.entries(configs)) {
    const sel = cfg.name === selected ? ' selected' : '';
    opts += `<option value="${cfg.name}"${sel}>${cfg.emoji || '🏷'} ${cfg.name}</option>`;
  }
  // 如果当前标签不在配置中，也显示
  if (![...Object.values(configs)].some(c => c.name === selected)) {
    opts += `<option value="${selected}" selected>${selected}</option>`;
  }
  return opts;
}

// ===== 保存/删除（写入GitHub files.json，含tag保存） =====
async function adminSave(idx) {
  const nameInput = document.querySelector(`.admin-name-input[data-idx="${idx}"]`);
  const subSelect = document.querySelector(`.admin-subject-select[data-idx="${idx}"]`);
  const tagSelect = document.querySelector(`.admin-tag-select[data-idx="${idx}"]`);
  if (!nameInput || !subSelect) return;

  const oldName = _adminFiles[idx]?.name;
  const newName = nameInput.value.trim() || oldName;
  const newSubject = subSelect.value;
  const newTag = tagSelect ? tagSelect.value : _adminFiles[idx].tag;

  _adminFiles[idx].name = newName;
  _adminFiles[idx].subject = newSubject;
  if (newTag) _adminFiles[idx].tag = newTag;
  else delete _adminFiles[idx].tag;

  const btn = nameInput.closest('.admin-file-card')?.querySelector('button');
  const origText = btn?.textContent || '';
  if (btn) btn.textContent = '⏳';

  try {
    await saveGhFiles(_adminFiles);
    window.allFiles = [..._adminFiles];
    if (window.DataLoader) {
      window.DataLoader.clearCache();
      window.DataLoader._files = [..._adminFiles];
    }
    if (window.renderFiles) window.renderFiles();
    if (window.updateStats) window.updateStats();
    if (btn) btn.textContent = '✅';
    setTimeout(() => { if (btn) btn.textContent = origText; }, 1500);
  } catch(e) {
    alert('❌ 保存失败：' + e.message);
    if (btn) btn.textContent = origText;
  }
}

async function adminDelete(idx) {
  if (!confirm(`确定删除「${_adminFiles[idx]?.name}」吗？`)) return;
  _adminFiles.splice(idx, 1);
  try {
    await saveGhFiles(_adminFiles);
    window.allFiles = [..._adminFiles];
    if (window.DataLoader) {
      window.DataLoader.clearCache();
      window.DataLoader._files = [..._adminFiles];
    }
    if (window.renderFiles) window.renderFiles();
    if (window.updateStats) window.updateStats();
    renderAdminFilesUI();
  } catch(e) {
    alert('❌ 删除失败：' + e.message);
  }
}

// ===== 上传文件到 GitHub + 写入 files.json =====
async function ghUploadFile(file, name) {
  const token = getToken();
  if (!token) throw new Error('需要 Token 才能操作');

  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const cleanName = name.replace(/[<>:"/\\|?*]/g, '_');
  const safeName = `${cleanName}.${ext}`;
  const ghPath = `${ASSETS_PATH}${safeName}`;

  let existingSha = null;
  const existing = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${ghPath}`,
    { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
  );
  if (existing.ok) {
    const data = await existing.json();
    existingSha = data.sha;
  }

  const uploadResult = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${ghPath}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `📤 上传 ${cleanName}.${ext}`,
        content: content,
        sha: existingSha || undefined
      })
    }
  );
  if (!uploadResult.ok) {
    const err = await uploadResult.json();
    throw new Error(err.message || '文件上传失败，请检查Token权限');
  }

  return `${RAW_BASE}${ASSETS_PATH}${encodeURIComponent(safeName)}`;
}

// ===== 上传表单设置 =====
function setupUpload() {
  const form = document.getElementById('uploadForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const file = fileInput?.files?.[0];
    if (!file) return alert('⚠️ 请选择一个文件');

    const name = document.getElementById('uploadName')?.value?.trim() || file.name.replace(/\.[^.]+$/, '');
    const subject = document.getElementById('uploadSubject')?.value || 'other';
    const status = document.getElementById('uploadStatus');
    const btn = document.getElementById('uploadBtn');
    if (!status || !btn) return;

    status.textContent = '⏳ 正在上传文件到 GitHub...';
    btn.disabled = true;

    try {
      const rawUrl = await ghUploadFile(file, name);

      _adminFiles.push({
        name: name,
        subject: subject,
        path: rawUrl,
        size: file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1)+' MB' : Math.ceil(file.size/1024)+' KB',
        date: new Date().toISOString().split('T')[0],
        tag: '新上传',
        downloads: 0
      });

      await saveGhFiles(_adminFiles);

      window.allFiles = [..._adminFiles];
      if (window.DataLoader) {
        window.DataLoader.clearCache();
        window.DataLoader._files = [..._adminFiles];
      }
      if (window.renderFiles) window.renderFiles();
      if (window.updateStats) window.updateStats();
      renderAdminFilesUI();

      status.textContent = '✅ 上传成功！文件已永久存储！';
      fileInput.value = '';
      document.getElementById('uploadName').value = '';
    } catch(err) {
      status.textContent = '❌ 上传失败：' + err.message;
    }
    btn.disabled = false;
  });
}

// ===== 🔖 标签颜色 & 常用标签管理 =====
function renderTagConfigUI() {
  const list = document.getElementById('tagConfigList');
  if (!list) return;

  const configs = window._tagConfigs || {};

  let html = '';
  const entries = Object.entries(configs);
  if (entries.length === 0) {
    html = '<div style="text-align:center;padding:20px 0;color:#999">暂无标签配置，请先添加</div>';
  } else {
    entries.forEach(([id, cfg]) => {
      html += `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #eee;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,0.5)">
          <span style="font-size:18px;flex-shrink:0">${cfg.emoji || '🏷'}</span>
          <input class="tag-name-input" value="${cfg.name}" data-tagid="${id}" style="flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px" />
          <input class="tag-color-input" type="color" value="${cfg.color}" data-tagid="${id}" style="width:30px;height:30px;border:none;border-radius:6px;cursor:pointer;padding:0;flex-shrink:0" />
          <button onclick="removeTag('${id}')" style="background:none;border:none;color:#e74c3c;font-size:16px;cursor:pointer;flex-shrink:0">✕</button>
        </div>
      `;
    });
  }

  list.innerHTML = html;
}

function addNewTag() {
  const nameInput = document.getElementById('newTagName');
  const colorInput = document.getElementById('newTagColor');
  const name = nameInput.value.trim();
  if (!name) return alert('⚠️ 请输入标签名');

  const configs = window._tagConfigs || {};
  const id = 'tag_' + Date.now();

  configs[id] = { name, emoji: '🏷', color: colorInput.value };
  window._tagConfigs = configs;
  localStorage.setItem('lsc_tag_configs', JSON.stringify(configs));

  nameInput.value = '';
  renderTagConfigUI();
  renderAdminFilesUI();
}

function removeTag(id) {
  const configs = window._tagConfigs || {};
  delete configs[id];
  window._tagConfigs = configs;
  localStorage.setItem('lsc_tag_configs', JSON.stringify(configs));
  renderTagConfigUI();
  renderAdminFilesUI();
}

async function saveTagConfigToGh() {
  const status = document.getElementById('tagSaveStatus');
  if (!status) return;
  status.textContent = '⏳ 保存中...';

  // 收集当前标签配置
  const configs = window._tagConfigs || {};
  
  // 从UI更新最新值
  document.querySelectorAll('.tag-name-input').forEach(input => {
    const id = input.dataset.tagid;
    if (configs[id]) configs[id].name = input.value.trim() || configs[id].name;
  });
  document.querySelectorAll('.tag-color-input').forEach(input => {
    const id = input.dataset.tagid;
    if (configs[id]) configs[id].color = input.value;
  });

  window._tagConfigs = configs;
  localStorage.setItem('lsc_tag_configs', JSON.stringify(configs));

  // 保存到GitHub的 subjects.json 作为标签配置
  // 用 subjects.json 的 extraTags 字段存储
  try {
    const subjectsData = await ghGet('data/subjects.json');
    const decoded = decodeURIComponent(escape(atob(subjectsData.content)));
    const parsed = JSON.parse(decoded);
    
    // 将标签配置存入 extraTags
    parsed.extraTags = {};
    for (const [id, cfg] of Object.entries(configs)) {
      parsed.extraTags[id] = cfg;
    }

    await ghPut('data/subjects.json', JSON.stringify(parsed, null, 2), subjectsData.sha, '🎨 更新标签颜色配置');
    
    status.textContent = '✅ 标签配置已保存并同步到 GitHub！';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch(e) {
    // 保存到GitHub失败，但localStorage已有
    status.textContent = '⚠️ 已保存到本地，但同步GitHub失败：' + e.message;
  }
}

// ===== 🖼️ 背景图管理 =====
// ===== 背景图相关 =====
async function applyBgImage() {
  const input = document.getElementById('bgImageInput');
  const status = document.getElementById('bgSaveStatus');
  const url = input.value.trim();
  if (!url) return alert('⚠️ 请输入图片URL');

  // 预览
  const preview = document.getElementById('bgPreview');
  if (preview) preview.style.backgroundImage = `url(${url})`;

  // 本地设置
  localStorage.setItem('lsc_bg_image', url);
  
  // 应用到页面
  document.body.style.backgroundImage = `url(${url})`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundAttachment = 'fixed';
  document.body.style.backgroundPosition = 'center';
  document.body.classList.add('has-bg');

  // 保存到GitHub（让所有人看到）
  try {
    const subjectsData = await ghGet('data/subjects.json');
    const decoded = decodeURIComponent(escape(atob(subjectsData.content)));
    const parsed = JSON.parse(decoded);
    
    parsed.bgImage = url;

    await ghPut('data/subjects.json', JSON.stringify(parsed, null, 2), subjectsData.sha, '🖼️ 更新页面背景图');

    if (status) status.textContent = '✅ 背景图已设置并同步到 GitHub，所有人可见！';
  } catch(e) {
    if (status) status.textContent = '⚠️ 已在本地生效，但GitHub同步失败：' + e.message;
  }
}

function clearBgImage() {
  localStorage.removeItem('lsc_bg_image');
  document.body.style.backgroundImage = '';
  document.body.classList.remove('has-bg');

  const preview = document.getElementById('bgPreview');
  if (preview) preview.style.backgroundImage = '';
  const input = document.getElementById('bgImageInput');
  if (input) input.value = '';

  // 也从GitHub清除
  (async () => {
    try {
      const subjectsData = await ghGet('data/subjects.json');
      const decoded = decodeURIComponent(escape(atob(subjectsData.content)));
      const parsed = JSON.parse(decoded);
      delete parsed.bgImage;
      await ghPut('data/subjects.json', JSON.stringify(parsed, null, 2), subjectsData.sha, '🖼️ 清除背景图');
    } catch(e) {}
  })();

  const status = document.getElementById('bgSaveStatus');
  if (status) status.textContent = '✅ 背景图已清除';
}

function loadBgUI() {
  const bgUrl = localStorage.getItem('lsc_bg_image');
  if (!bgUrl) {
    // 尝试从 subjects.json 加载（新访客）
    (async () => {
      try {
        const r = await fetch('./data/subjects.json');
        const d = await r.json();
        if (d.bgImage) {
          localStorage.setItem('lsc_bg_image', d.bgImage);
          document.body.style.backgroundImage = `url(${d.bgImage})`;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundPosition = 'center';
          document.body.classList.add('has-bg');
          const preview = document.getElementById('bgPreview');
          if (preview) preview.style.backgroundImage = `url(${d.bgImage})`;
          if (window.applyBgFromConfig) window.applyBgFromConfig();
        }
      } catch(e) {}
    })();
    return;
  }

  // 预览
  const preview = document.getElementById('bgPreview');
  if (preview) preview.style.backgroundImage = `url(${bgUrl})`;
}

// ===== 🔍 预览功能（使用 Google Docs Viewer） =====
function previewFile(path, name) {
  if (!path || path === '#pending') {
    alert('⚠️ 此文件尚未完成上传');
    return;
  }
  const cleanPath = path.split('?')[0];
  const ext = cleanPath.split('.').pop().toLowerCase();
  const supported = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

  const modal = document.getElementById('previewModal');
  const frame = document.getElementById('previewFrame');
  const title = document.getElementById('previewTitle');
  if (!modal || !frame) return;

  title.textContent = name;
  modal.classList.remove('hidden');

  if (supported.includes(ext)) {
    // 使用 Google Docs Viewer 在线预览
    const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(cleanPath)}&embedded=true`;
    frame.innerHTML = `<iframe src="${viewerUrl}" style="width:100%;height:100%;border:none" allowfullscreen></iframe>`;
  } else {
    frame.innerHTML = `<div style="text-align:center;padding:60px 20px">
      <div style="font-size:56px;margin-bottom:16px">📄</div>
      <h3 style="margin-bottom:8px;color:#333">${name}</h3>
      <p style="color:#999;margin-bottom:20px">此格式暂不支持在线预览，请下载后用对应软件打开</p>
      <a href="${path}" target="_blank" style="display:inline-block;padding:12px 28px;background:#6c5ce7;color:white;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">⬇ 下载文件</a>
    </div>`;
  }
}

function closePreview() {
  const modal = document.getElementById('previewModal');
  modal.classList.add('hidden');
  document.getElementById('previewFrame').innerHTML = '';
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', checkLogin);
