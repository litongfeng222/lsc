// ===== 🔐 LSCgroup 管理后台（GitHub API 真保存版） =====
const ADMIN_PASSWORD = 'LSC2026';
const REPO_OWNER = 'litongfeng222';
const REPO_NAME = 'lsc';
const FILES_PATH = 'data/files.json';

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
  return r.json();
}

async function ghPut(path, content, sha, message) {
  const token = getToken();
  if (!token) throw new Error('需要 Token 才能操作');
  const r = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || '更新资料列表',
      content: btoa(unescape(encodeURIComponent(content))),
      sha: sha
    })
  });
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
  
  // 立即用本地数据渲染（秒开！）
  _adminFiles = window.allFiles || [];
  renderAdminFilesUI();
  
  // 后台悄悄从GitHub同步最新数据
  setTimeout(syncFromGitHub, 100);
  
  setupUpload();
}

// 后台同步GitHub数据（不阻塞界面）
async function syncFromGitHub() {
  try {
    const fresh = await loadGhFiles();
    if (fresh.length > 0) {
      _adminFiles = fresh;
      renderAdminFilesUI();
      // 同步到主站
      window.allFiles = [...fresh];
      if (window.DataLoader) {
        window.DataLoader.clearCache();
        window.DataLoader._files = [...fresh];
      }
      if (window.renderFiles) window.renderFiles();
      if (window.updateStats) window.updateStats();
      document.getElementById('adminSyncStatus').textContent = '✅ 已同步最新';
      setTimeout(() => { document.getElementById('adminSyncStatus').textContent = ''; }, 3000);
    }
  } catch(e) {
    // 静默失败，本地数据已经显示
  }
}

function loadSubjectOptions() {
  const opts = _subjects.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
  document.querySelectorAll('.subject-select').forEach(el => { el.innerHTML = opts; });
}

// ===== 渲染文件管理列表 =====
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
    return `<div class="admin-file-card">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <span style="font-size:22px;flex-shrink:0">${sub.emoji}</span>
        <div style="flex:1;min-width:0">
          <input class="admin-name-input" value="${file.name}" data-idx="${idx}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:3px" />
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <select class="admin-subject-select subject-select" data-idx="${idx}" style="flex:1;min-width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px"></select>
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

// ===== 真·保存到 GitHub =====
async function adminSave(idx) {
  const nameInput = document.querySelector(`.admin-name-input[data-idx="${idx}"]`);
  const subSelect = document.querySelector(`.admin-subject-select[data-idx="${idx}"]`);
  if (!nameInput || !subSelect) return;

  const oldName = _adminFiles[idx]?.name;
  const newName = nameInput.value.trim() || oldName;
  const newSubject = subSelect.value;

  _adminFiles[idx].name = newName;
  _adminFiles[idx].subject = newSubject;

  const btn = nameInput.closest('.admin-file-card')?.querySelector('button');
  const origText = btn?.textContent || '';
  if (btn) btn.textContent = '⏳';

  try {
    await saveGhFiles(_adminFiles);
    // 刷新所有缓存，让主站重新加载
    window.allFiles = [..._adminFiles];
    if (window.DataLoader) {
      window.DataLoader.clearCache();
      window.DataLoader._files = [..._adminFiles];
    }
    // 重新渲染主站
    if (window.renderFiles) window.renderFiles();
    if (window.updateStats) window.updateStats();

    if (btn) btn.textContent = '✅';
    setTimeout(() => { if (btn) btn.textContent = origText; }, 1500);
  } catch(e) {
    alert('❌ 保存失败：' + e.message);
    if (btn) btn.textContent = origText;
  }
}

// ===== 真·删除 =====
async function adminDelete(idx) {
  if (!confirm(`确定删除「${_adminFiles[idx]?.name}」吗？`)) return;

  _adminFiles.splice(idx, 1);

  try {
    await saveGhFiles(_adminFiles);
    // 刷新所有缓存
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

// ===== 上传功能（本地预览 + 通知姐） =====
function setupUpload() {
  const form = document.getElementById('uploadForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const file = fileInput?.files?.[0];
    if (!file) return alert('⚠️ 请选择一个文件');

    const name = document.getElementById('uploadName')?.value?.trim() || file.name;
    const subject = document.getElementById('uploadSubject')?.value || 'other';
    const status = document.getElementById('uploadStatus');

    status.textContent = '⏳ 准备上传...';

    try {
      // 存到localStorage暂存
      const previews = JSON.parse(localStorage.getItem('lsc_uploads') || '[]');
      const reader = new FileReader();
      reader.onload = function(evt) {
        previews.push({
          name, subject,
          tag: '新上传',
          date: new Date().toISOString().split('T')[0],
          size: file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1)+' MB' : Math.ceil(file.size/1024)+' KB',
          data: evt.target.result
        });
        localStorage.setItem('lsc_uploads', JSON.stringify(previews));

        // 新上传后自动加到文件列表（用图标代替真实文件）
        _adminFiles.push({
          name, subject, tag: '新上传',
          date: new Date().toISOString().split('T')[0],
          size: file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1)+' MB' : Math.ceil(file.size/1024)+' KB',
          path: '#pending'
        });
        saveGhFiles(_adminFiles).then(() => {
          status.textContent = '✅ 已添加到列表！文件本体请联系姐上传到云存储～';
        }).catch(() => {
          status.textContent = '✅ 已保存到本地，明天姐帮你上传完整版';
        });

        fileInput.value = '';
        document.getElementById('uploadName').value = '';
        renderAdminFilesUI();
      };
      reader.readAsDataURL(file);
    } catch(err) {
      status.textContent = '❌ 上传失败：' + err.message;
    }
  });
}

// ===== 🔍 预览功能 =====
function previewFile(path, name) {
  // PDF：浏览器自带预览，直接新标签打开
  const cleanPath = path.split('?')[0];
  if (cleanPath.endsWith('.pdf')) {
    window.open(path, '_blank');
    return;
  }
  // docx及其他：弹窗提示下载
  const modal = document.getElementById('previewModal');
  const frame = document.getElementById('previewFrame');
  const title = document.getElementById('previewTitle');
  if (!modal || !frame) return;

  title.textContent = name;
  modal.classList.remove('hidden');

  frame.innerHTML = `<div style="text-align:center;padding:60px 20px">
    <div style="font-size:56px;margin-bottom:16px">📄</div>
    <h3 style="margin-bottom:8px;color:#333">${name}</h3>
    <p style="color:#999;margin-bottom:20px">此格式暂不支持在线预览，请下载后用对应软件打开</p>
    <a href="${path}" target="_blank" style="display:inline-block;padding:12px 28px;background:#6c5ce7;color:white;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">⬇ 下载文件</a>
  </div>`;
}

function closePreview() {
  const modal = document.getElementById('previewModal');
  modal.classList.add('hidden');
  document.getElementById('previewFrame').innerHTML = '';
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', checkLogin);
