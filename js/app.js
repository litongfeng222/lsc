/* ===== LSCgroup 主程序 ===== */
let subjects = [];
let allFiles = [];
let currentSubject = 'all';
// 标签颜色配置（从 subjects.json 或 localStorage 加载）
let tagConfigs = {};

// 暴露全局供admin.js使用
window.subjects = subjects;
window.allFiles = allFiles;

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderDock();        // 渲染底部dock栏
  renderSubjects();
  renderFiles();
  updateStats();
  loadTagConfigs();     // 加载标签颜色配置
  applyBgFromConfig();  // 加载背景图
});

// 加载数据
async function loadData() {
  subjects = await DataLoader.getSubjects();
  allFiles = await DataLoader.getFiles();
  window.subjects = subjects;
  window.allFiles = allFiles;
}

// ===== 渲染底部dock栏（鸿蒙液态玻璃风格） =====
function renderDock() {
  const container = document.getElementById('dockContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="bottom-dock">
      <a href="./upload.html" class="dock-btn dock-btn-primary" ontouchstart="">
        <span>📤</span>
        <span>分享资料</span>
      </a>
      <div class="dock-divider"></div>
      <button class="dock-btn-circle" onclick="showRanking()" ontouchstart="" title="排行榜">
        🏆
      </button>
    </div>
  `;

  document.body.classList.add('has-dock');
}

// ===== 标签颜色配置 =====
function loadTagConfigs() {
  // 先从 localStorage 加载（本地缓存）
  const cached = localStorage.getItem('lsc_tag_configs');
  if (cached) {
    try { tagConfigs = JSON.parse(cached); } catch(e) {}
  }

  // 再从 subjects.json 的默认标签读取
  (subjects || []).forEach(s => {
    if (!tagConfigs[s.id]) {
      tagConfigs[s.id] = { name: s.name, emoji: s.emoji, color: s.color || '#636e72' };
    }
  });

  // 标记已加载，供 admin.js 使用
  window._tagConfigs = tagConfigs;
}

// 获取标签颜色（优先 tags，否则使用学科色）
function getTagStyle(tag, subjectId) {
  // 自定义标签配置中查
  for (const [id, cfg] of Object.entries(tagConfigs)) {
    if (cfg.name === tag) {
      return { bg: cfg.color + '20', color: cfg.color, labelBg: cfg.color };
    }
  }
  // 学科默认色
  const sub = subjects.find(s => s.id === subjectId);
  const c = sub ? sub.color : '#636e72';
  return { bg: c + '20', color: c, labelBg: c };
}

// ===== 背景图支持 =====
async function applyBgFromConfig() {
  // 优先从 localStorage 读取（管理员手动设置的）
  let bgUrl = localStorage.getItem('lsc_bg_image');

  // 没有本地缓存则从 subjects.json 加载
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
    // 预览
    const preview = document.getElementById('bgPreview');
    if (preview) preview.style.backgroundImage = `url(${bgUrl})`;
  }
}

// 供 admin.js 调用的全局方法
window.applyBgFromConfig = applyBgFromConfig;

// ===== 渲染分类标签 =====
function renderSubjects() {
  const nav = document.getElementById('subjectsNav');
  
  // "全部" 标签
  const allTab = document.createElement('div');
  allTab.className = 'subject-tab active';
  allTab.textContent = '📂 全部';
  allTab.dataset.subject = 'all';
  allTab.onclick = () => filterSubject('all', allTab);
  nav.appendChild(allTab);

  // 各科目标签
  subjects.forEach(sub => {
    const tab = document.createElement('div');
    tab.className = 'subject-tab';
    tab.textContent = `${sub.emoji} ${sub.name}`;
    tab.dataset.subject = sub.id;
    tab.onclick = () => filterSubject(sub.id, tab);
    nav.appendChild(tab);
  });
}

// 筛选科目
function filterSubject(subjectId, tabElement) {
  currentSubject = subjectId;
  
  // 更新标签高亮
  document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
  tabElement.classList.add('active');

  // 滚动到标签位置
  tabElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  renderFiles();
}

// 渲染文件列表
function renderFiles() {
  const container = document.getElementById('fileList');
  
  // 筛选
  const filtered = currentSubject === 'all'
    ? allFiles
    : allFiles.filter(f => f.subject === currentSubject);

  // 按时间排序（最新的在前面）
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📭</div>
        <h3>这里还没有资料</h3>
        <p>资料正在路上，稍后再来看看吧～</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(file => {
    const subject = subjects.find(s => s.id === file.subject);
    const emoji = subject ? subject.emoji : '📄';
    const color = subject ? subject.color : '#636e72';

    // 获取标签样式（优先标签配置）
    const tag = file.tag || subject?.name || '资料';
    const tagStyle = getTagStyle(tag, file.subject);

    return `
      <div class="file-card" onclick="downloadFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')">
        <div class="file-icon" style="background: ${tagStyle.bg}; color: ${tagStyle.color}">
          ${emoji}
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            <span>${file.date}</span>
            <span>${file.size}</span>
            <span class="file-badge" style="background: ${tagStyle.labelBg}">${tag}</span>
            ${file.uploader ? `<span style="font-size:11px;color:#999">👤 ${file.uploader}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="file-icon-btn file-preview-btn" onclick="event.stopPropagation(); if(window.previewFile)previewFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')" style="padding:4px 10px;border-radius:8px;background:var(--bg);border:none;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-light);font-weight:500">预览</button>
          <button class="file-download" onclick="event.stopPropagation(); downloadFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')">⬇</button>
        </div>
      </div>
    `;
  }).join('');
}

// 下载文件 + 计数
async function downloadFile(path, name) {
  // 先触发下载
  const a = document.createElement('a');
  a.href = path;
  a.download = name;
  a.target = '_blank';
  a.click();

  // 异步增加下载计数（如果用户存了Token）
  const token = localStorage.getItem('lsc_gh_token');
  if (!token) return;

  try {
    // 找到文件名在 allFiles 中的索引
    const idx = allFiles.findIndex(f => f.path === path || f.name === name);
    if (idx === -1) return;

    // 从 GitHub 获取最新的 files.json
    const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.content) return;
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(decoded);
    const ghFiles = parsed.files;

    // 找到对应文件，累加下载次数
    const ghIdx = ghFiles.findIndex(f => f.path === path);
    if (ghIdx === -1) return;
    ghFiles[ghIdx].downloads = (ghFiles[ghIdx].downloads || 0) + 1;

    // 写回 GitHub
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

    // 同步更新内存数据
    allFiles[idx].downloads = (allFiles[idx].downloads || 0) + 1;
  } catch(e) {
    // 静默失败，不影响下载体验
    console.warn('下载计数失败（不影响下载）:', e);
  }
}

// 更新统计
function updateStats() {
  document.getElementById('fileCount').textContent = allFiles.length;
  document.getElementById('subjectCount').textContent = subjects.length;
  // 资料大小后续可计算
}

// ===== 🧩 模块扩展预留 =====
// 后续添加模块时，在这里注册
// const MODULES = {};
