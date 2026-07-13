/* ===== 学习小组 主程序 ===== */
let subjects = [];
let allFiles = [];
let currentSubject = 'all';
let tagConfigs = {};

// 暴露全局供admin.js使用
window.subjects = subjects;
window.allFiles = allFiles;

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  document.getElementById('loadingIndicator')?.classList.add('hidden');
  renderSubjects();
  renderFiles();
  populateSubjectSelect();
  loadTagConfigs();
});

// 加载数据
async function loadData() {
  subjects = await DataLoader.getSubjects();
  allFiles = await DataLoader.getFiles();
  window.subjects = subjects;
  window.allFiles = allFiles;
}

// 填充搜索框的科目下拉
function populateSubjectSelect() {
  const select = document.getElementById('searchSubject');
  if (!select) return;
  // 保留"全部科目"选项
  select.innerHTML = '<option value="all">全部科目</option>';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
}

// ===== 模糊搜索 =====
function doSearch() {
  const query = document.getElementById('searchInput')?.value?.trim() || '';
  const subjectFilter = document.getElementById('searchSubject')?.value || 'all';
  renderFiles(query, subjectFilter);
}

// 简单中文模糊匹配
function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  // 1. 子串匹配（"期末" 能匹配 "期末考试"）
  if (t.includes(q)) return true;
  // 2. 逐字匹配（"学期末考试" 能匹配 "期末考试"）
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ===== 标签颜色配置 =====
function loadTagConfigs() {
  const cached = localStorage.getItem('lsc_tag_configs');
  if (cached) {
    try { tagConfigs = JSON.parse(cached); } catch(e) {}
  }
  (subjects || []).forEach(s => {
    if (!tagConfigs[s.id]) {
      tagConfigs[s.id] = { name: s.name, emoji: s.emoji, color: s.color || '#636e72' };
    }
  });
  window._tagConfigs = tagConfigs;
}

function getTagStyle(tag, subjectId) {
  for (const [id, cfg] of Object.entries(tagConfigs)) {
    if (cfg.name === tag) {
      return { bg: cfg.color + '20', color: cfg.color, labelBg: cfg.color };
    }
  }
  const sub = subjects.find(s => s.id === subjectId);
  const c = sub ? sub.color : '#636e72';
  return { bg: c + '20', color: c, labelBg: c };
}

// ===== 背景图支持 =====
async function applyBgFromConfig() {
  let bgUrl = localStorage.getItem('lsc_bg_image');
  if (!bgUrl) {
    try {
      const r = await fetch('./data/subjects.json?' + Date.now());
      const d = await r.json();
      if (d.bgImage) {
        bgUrl = d.bgImage;
        localStorage.setItem('lsc_bg_image', bgUrl);
      }
    } catch(e) {}
  }
  if (bgUrl) {
    document.body.style.backgroundImage = `url(${bgUrl})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundPosition = 'center';
    document.body.classList.add('has-bg');
    const preview = document.getElementById('bgPreview');
    if (preview) preview.style.backgroundImage = `url(${bgUrl})`;
  }
}
window.applyBgFromConfig = applyBgFromConfig;

// ===== 渲染科目导航 =====
function renderSubjects() {
  const nav = document.getElementById('subjectsNav');
  if (!nav) return;

  const allTab = document.createElement('div');
  allTab.className = 'subject-tab active';
  allTab.textContent = '全部';
  allTab.dataset.subject = 'all';
  allTab.onclick = () => filterSubject('all', allTab);
  nav.appendChild(allTab);

  subjects.forEach(sub => {
    const tab = document.createElement('div');
    tab.className = 'subject-tab';
    tab.textContent = sub.name;
    tab.dataset.subject = sub.id;
    tab.onclick = () => filterSubject(sub.id, tab);
    nav.appendChild(tab);
  });
}

function filterSubject(subjectId, tabElement) {
  currentSubject = subjectId;
  document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
  tabElement.classList.add('active');
  tabElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  doSearch();
}

function getFileExt(path) {
  return path.split('?')[0].split('.').pop().toLowerCase();
}

// ===== 渲染文件列表（支持搜索和筛选） =====
function renderFiles(query, subjectFilter) {
  const container = document.getElementById('fileList');
  if (!container) return;

  const q = (query || '').trim().toLowerCase();
  const subFilter = subjectFilter || currentSubject;

  let filtered = allFiles.filter(f => {
    // 科目筛选
    if (subFilter !== 'all' && f.subject !== subFilter) return false;
    // 模糊搜索
    if (q && !fuzzyMatch(f.name, q)) return false;
    return true;
  });

  // 按时间排序（最新的在前面）
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📭</div>
        <h3>没有找到资料</h3>
        <p>换个关键词试试吧</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((file, idx) => {
    const subject = subjects.find(s => s.id === file.subject);
    const color = subject ? subject.color : '#636e72';
    const tag = file.tag || subject?.name || '资料';
    const tagStyle = getTagStyle(tag, file.subject);
    const ext = getFileExt(file.path);
    const previewable = ['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png','gif','webp','svg','txt'].includes(ext);
    const delay = Math.min(idx * 40, 480);

    return `
      <div class="file-card" style="--delay:${delay}ms">
        <div class="file-info" onclick="downloadFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')">
          <div class="file-name">${file.name} <span class="file-type-badge">${ext}</span></div>
          <div class="file-meta">
            <span>${file.date}</span>
            <span>${file.size}</span>
            <span class="file-badge" style="background: ${tagStyle.labelBg}">${tag}</span>
            ${file.uploader ? `<span>👤 ${file.uploader}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
          ${previewable ? `<button class="file-icon-btn file-preview-btn" onclick="event.stopPropagation(); if(window.previewFile)previewFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')">👁</button>` : ''}
          <button class="file-download" onclick="event.stopPropagation(); downloadFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')">⬇</button>
        </div>
      </div>
    `;
  }).join('');

  void container.offsetWidth;
}

// 下载文件 + 计数
async function downloadFile(path, name) {
  const a = document.createElement('a');
  a.href = path;
  a.download = name;
  a.target = '_blank';
  a.click();

  const token = localStorage.getItem('lsc_gh_token');
  if (!token) return;

  try {
    const idx = allFiles.findIndex(f => f.path === path || f.name === name);
    if (idx === -1) return;

    const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.content) return;
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(decoded);
    const ghFiles = parsed.files;

    const ghIdx = ghFiles.findIndex(f => f.path === path);
    if (ghIdx === -1) return;
    ghFiles[ghIdx].downloads = (ghFiles[ghIdx].downloads || 0) + 1;

    const updated = JSON.stringify(parsed, null, 2);
    const encoded = btoa(unescape(encodeURIComponent(updated)));
    await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: '⬇️ 下载计数',
        content: encoded,
        sha: data.sha
      })
    });

    allFiles[idx].downloads = (allFiles[idx].downloads || 0) + 1;
  } catch(e) {
    console.warn('下载计数失败（不影响下载）:', e);
  }
}
