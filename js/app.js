/* ===== 学习小组 主程序 ===== */
let subjects = [];
let allFiles = [];
let currentSubject = 'all';
let currentSort = 'date_desc';
let tagConfigs = {};

// 暴露全局供admin.js使用
window.subjects = subjects;
window.allFiles = allFiles;

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  // 先显示骨架屏
  showSkeleton();
  await loadData();
  hideSkeleton();
  renderSubjects();
  renderFiles();
  populateSubjectSelect();
  loadTagConfigs();
  renderDock();
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
  select.innerHTML = '<option value="all">全部科目</option>';
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
}

// ===== 骨架屏 =====
function showSkeleton() {
  const container = document.getElementById('fileList');
  if (!container) return;
  container.innerHTML = Array.from({length: 6}, (_, i) => `
    <div class="skeleton-card" style="animation-delay:${i * 0.06}s">
      <div class="skeleton-line skeleton-name"></div>
      <div class="skeleton-line skeleton-meta"></div>
    </div>
  `).join('');
}

function hideSkeleton() {
  // 自然被renderFiles覆盖
}

// ===== 模糊搜索 =====
function doSearch() {
  const query = document.getElementById('searchInput')?.value?.trim() || '';
  const subjectFilter = document.getElementById('searchSubject')?.value || 'all';
  renderFiles(query, subjectFilter);
}

function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ===== 搜索高亮 =====
function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const q = query.toLowerCase();
  const t = text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx !== -1) {
    return escapeHtml(t.slice(0, idx)) + '<mark>' + escapeHtml(t.slice(idx, idx + q.length)) + '</mark>' + escapeHtml(t.slice(idx + q.length));
  }
  // 逐字匹配
  let result = '';
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i].toLowerCase() === q[qi]) {
      result += '<mark>' + escapeHtml(t[i]) + '</mark>';
      qi++;
    } else {
      result += escapeHtml(t[i]);
    }
  }
  result += escapeHtml(t.slice(result.replace(/<\/?mark>/g, '').length));
  return result;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== 排序 =====
function setSort(mode) {
  currentSort = mode;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === mode));
  doSearch();
}

// ===== 🎵 底部dock栏 — 华为音乐风格双态任务栏 =====
function renderDock() {
  const container = document.getElementById('dockContainer');
  if (!container) return;

  // 获取当前页面标识
  const isUploadPage = location.pathname.includes('upload');
  const pageIcon = isUploadPage ? '📤' : '📚';

  container.innerHTML = `
    <div class="dock" id="bottomDock">
      <!-- 展开态：功能按钮区 -->
      <div class="dock-expanded" id="dockExpanded">
        <a href="./index.html" class="dock-btn" id="dockHomeBtn" ontouchstart="">
          <span class="dock-icon">🏠</span>
          <span class="dock-label">首页</span>
        </a>
        <a href="./upload.html" class="dock-btn dock-btn-highlight" id="dockUploadBtn" ontouchstart="">
          <span class="dock-icon">➕</span>
          <span class="dock-label">分享</span>
        </a>
        <button class="dock-btn" id="dockRankBtn" ontouchstart="">
          <span class="dock-icon">🏆</span>
          <span class="dock-label">排行</span>
        </button>
        <button class="dock-btn" id="dockInfoBtn" ontouchstart="">
          <span class="dock-icon">📢</span>
          <span class="dock-label">动态</span>
        </button>
      </div>

      <!-- 紧缩态：左图标 + 右实时信息 -->
      <div class="dock-compact" id="dockCompact">
        <div class="dock-compact-icon" id="dockCompactIcon">${pageIcon}</div>
        <div class="dock-compact-info" id="dockCompactInfo">
          <div class="dock-compact-title" id="dockCompactTitle">师大附·11班</div>
          <div class="dock-compact-desc" id="dockCompactDesc">学习小组</div>
        </div>
      </div>
    </div>
  `;

  document.body.classList.add('has-dock');

  // 绑定按钮事件
  document.getElementById('dockRankBtn')?.addEventListener('click', showRanking);
  document.getElementById('dockInfoBtn')?.addEventListener('click', () => {
    document.getElementById('subjectsNav')?.scrollIntoView({ behavior: 'smooth' });
  });

  // 绑定按钮弹性点击特效
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.addEventListener('mousedown', function(e) {
      this.classList.add('dock-btn-press');
    });
    btn.addEventListener('mouseup', function(e) {
      this.classList.remove('dock-btn-press');
      this.classList.add('dock-btn-release');
      setTimeout(() => this.classList.remove('dock-btn-release'), 400);
    });
    btn.addEventListener('mouseleave', function(e) {
      this.classList.remove('dock-btn-press');
    });
  });

  setupDockSmart();
}

function setupDockSmart() {
  const dock = document.getElementById('bottomDock');
  const expanded = document.getElementById('dockExpanded');
  const compact = document.getElementById('dockCompact');
  if (!dock || !expanded || !compact) return;

  const THRESHOLD = 20; // 滚动超过20px触发切换
  let isCompact = false;
  let ticking = false;

  function transitionToCompact(compact) {
    if (isCompact === compact) return;
    isCompact = compact;

    if (compact) {
      // 展开态 → 紧缩态
      expanded.classList.add('dock-expanded-exit');
      expanded.classList.remove('dock-expanded-enter');
      compact.classList.add('dock-compact-enter');
      compact.classList.remove('dock-compact-exit');
      // 背景变色（紫色）
      dock.classList.add('dock-condensed');
    } else {
      // 紧缩态 → 展开态
      expanded.classList.remove('dock-expanded-exit');
      expanded.classList.add('dock-expanded-enter');
      compact.classList.remove('dock-compact-enter');
      compact.classList.add('dock-compact-exit');
      dock.classList.remove('dock-condensed');
    }
  }

  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset;
    transitionToCompact(scrollY > THRESHOLD);
  }

  // 初始状态
  transitionToCompact(false);
  onScroll();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  // 紧缩态点击回到顶部
  dock.addEventListener('click', function onDockClick(e) {
    if (isCompact && !e.target.closest('.dock-btn')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
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
      if (d.bgImage) { bgUrl = d.bgImage; localStorage.setItem('lsc_bg_image', bgUrl); }
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

// ===== 最新动态（最近3条） =====
function getRecentActivity(files) {
  return files.slice(0, 3).map(f => {
    const sub = subjects.find(s => s.id === f.subject);
    return { name: f.name, uploader: f.uploader || '管理员', date: f.date, subject: sub?.name || '资料' };
  });
}

// ===== 渲染文件列表 =====
function renderFiles(query, subjectFilter) {
  const container = document.getElementById('fileList');
  if (!container) return;

  const q = (query || '').trim().toLowerCase();
  const subFilter = subjectFilter || currentSubject;

  let filtered = allFiles.filter(f => {
    if (subFilter !== 'all' && f.subject !== subFilter) return false;
    if (q && !fuzzyMatch(f.name, q)) return false;
    return true;
  });

  // 排序
  switch (currentSort) {
    case 'date_desc': filtered.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
    case 'date_asc':  filtered.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
    case 'downloads': filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)); break;
    case 'name':      filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh')); break;
  }

  if (filtered.length === 0 && !document.querySelector('.skeleton-card')) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📭</div>
        <h3>没有找到资料</h3>
        <p>${q ? '换个关键词试试吧' : '还没有人上传资料，快来分享吧～'}</p>
      </div>
    `;
    return;
  }

  // 最新动态提示条
  const recent = getRecentActivity(filtered);
  const recentHtml = recent.length > 0 ? `
    <div class="recent-bar">
      <span class="recent-dot"></span>
      <span>最近更新：${recent.map(r => `${r.uploader}分享了「${r.name}」`).join(' · ')}</span>
    </div>
  ` : '';

  // 排序按钮
  const sorts = [
    { id: 'date_desc', label: '最新' },
    { id: 'downloads', label: '热门' },
    { id: 'name',      label: '名称' }
  ];
  const sortHtml = `
    <div class="sort-bar">
      ${sorts.map(s => `<button class="sort-btn${currentSort === s.id ? ' active' : ''}" data-sort="${s.id}" onclick="setSort('${s.id}')">${s.label}</button>`).join('')}
      <span class="sort-count">共 ${filtered.length} 份资料</span>
    </div>
  `;

  container.innerHTML = recentHtml + sortHtml + filtered.map((file, idx) => {
    const subject = subjects.find(s => s.id === file.subject);
    const color = subject ? subject.color : '#636e72';
    const tag = file.tag || subject?.name || '资料';
    const tagStyle = getTagStyle(tag, file.subject);
    const ext = getFileExt(file.path);
    const previewable = ['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png','gif','webp','svg','txt'].includes(ext);
    const delay = Math.min(idx * 30, 400);
    const downloads = file.downloads || 0;

    // 高亮文件名
    const displayName = q ? highlightText(file.name, q) : escapeHtml(file.name);

    return `
      <div class="file-card" style="--delay:${delay}ms" data-name="${escapeHtml(file.name)}">
        <div class="file-info" onclick="downloadFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')">
          <div class="file-name">${displayName} <span class="file-type-badge">${ext}</span></div>
          <div class="file-meta">
            <span>${file.date}</span>
            <span>${file.size}</span>
            <span class="file-badge" style="background:${tagStyle.labelBg}">${tag}</span>
            <span class="download-count">⬇ ${downloads}</span>
            ${file.uploader ? `<span>👤 ${escapeHtml(file.uploader)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
          ${previewable ? `<button class="file-icon-btn file-preview-btn" onclick="event.stopPropagation(); if(window.previewFile)previewFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}')">👁</button>` : ''}
          <button class="file-download-btn" id="dlbtn-${idx}" onclick="event.stopPropagation(); downloadFile('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}', this)">⬇</button>
        </div>
      </div>
    `;
  }).join('');

  void container.offsetWidth;
}

// 下载文件 + 计数 + 按钮动效
async function downloadFile(path, name, btn) {
  const a = document.createElement('a');
  a.href = path;
  a.download = name;
  a.target = '_blank';
  a.click();

  // 按钮动效
  if (btn) {
    btn.classList.add('dl-clicked');
    setTimeout(() => btn.classList.remove('dl-clicked'), 600);
  }

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
