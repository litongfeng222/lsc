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
  await renderAdminFiles();
  setupUpload();
}

function loadSubjectOptions() {
  const opts = _subjects.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
  document.querySelectorAll('.subject-select').forEach(el => { el.innerHTML = opts; });
}

// ===== 渲染文件管理列表 =====
let _adminFiles = [];

async function renderAdminFiles() {
  const list = document.getElementById('adminFileList');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:#999">⏳ 加载中...</div>';

  try {
    _adminFiles = await loadGhFiles();
  } catch(e) {
    _adminFiles = window.allFiles || [];
  }

  if (_adminFiles.length === 0) {
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
    // 刷新主页面数据
    if (window.allFiles) {
      window.allFiles.length = 0;
      window.allFiles.push(..._adminFiles);
    }
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
    if (window.allFiles) {
      window.allFiles.length = 0;
      window.allFiles.push(..._adminFiles);
    }
    await renderAdminFiles();
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
        renderAdminFiles();
      };
      reader.readAsDataURL(file);
    } catch(err) {
      status.textContent = '❌ 上传失败：' + err.message;
    }
  });
}

// ===== 🔍 预览功能 =====
function previewFile(path, name) {
  const modal = document.getElementById('previewModal');
  const frame = document.getElementById('previewFrame');
  const title = document.getElementById('previewTitle');
  if (!modal || !frame) return;

  title.textContent = name;
  modal.classList.remove('hidden');

  // PDF直接预览
  if (path.endsWith('.pdf')) {
    frame.innerHTML = `<iframe src="${path}" style="width:100%;height:100%;border:none" allowfullscreen></iframe>`;
  }
  // docx/dox用Google Docs Viewer
  else if (path.endsWith('.docx') || path.endsWith('.doc')) {
    frame.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(path)}&embedded=true" style="width:100%;height:100%;border:none" allowfullscreen></iframe>`;
  }
  // 其他格式直接链接
  else {
    frame.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#999">
      <div style="font-size:48px;margin-bottom:16px">📄</div>
      <p>此格式暂不支持在线预览</p>
      <a href="${path}" target="_blank" style="display:inline-block;margin-top:12px;padding:10px 24px;background:#6c5ce7;color:white;border-radius:10px;text-decoration:none">⬇ 下载查看</a>
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
