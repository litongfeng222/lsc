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



// ===== 🎵 底部dock双栏 — JS直接控制宽度（v3 初始不动画） =====
function renderDock() {
  var container = document.getElementById('dockContainer');
  if (!container) return;

  container.innerHTML =
    '<div id="dockBars" class="dock-bars">' +
      '<div id="dockLeft" class="dock-bar dock-bar-left">' +
        '<div class="dl-inner" id="dlInner">' +
          '<a href="./index.html" class="dl-btn" ontouchstart="">🏠 首页</a>' +
          '<a href="./upload.html" class="dl-btn dl-btn-sp" ontouchstart="">➕ 分享</a>' +
          '<button class="dl-btn" id="dlRankBtn" ontouchstart="">🏆 排行</button>' +
          '<button class="dl-btn" id="dlInfoBtn" ontouchstart="">📢 动态</button>' +
        '</div>' +
      '</div>' +
      '<div id="dockRight" class="dock-bar dock-bar-right">' +
        '<div class="dr-inner" id="drInner">' +
          '<div class="dr-icon">📚</div>' +
          '<div class="dr-text">' +
            '<div class="dr-title">学习小组</div>' +
            '<div class="dr-desc">师大附·11班</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.classList.add('has-dock');

  document.getElementById('dlRankBtn')?.addEventListener('click', showRanking);
  document.getElementById('dlInfoBtn')?.addEventListener('click', function() {
    var nav = document.getElementById('subjectsNav');
    if (nav) nav.scrollIntoView({ behavior: 'smooth' });
  });

  // 按钮弹性触感
  document.querySelectorAll('.dl-btn').forEach(function(btn) {
    btn.addEventListener('mousedown', function() { this.style.transform = 'scale(0.88)'; });
    btn.addEventListener('mouseup', function() {
      var self = this;
      self.style.transform = 'scale(1.15)';
      setTimeout(function() { self.style.transform = 'scale(1)'; }, 150);
    });
    btn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
  });

  initDockBars();
}

function initDockBars() {
  var left = document.getElementById('dockLeft');
  var right = document.getElementById('dockRight');
  if (!left || !right) return;

  var THRESHOLD = 16;
  var isCollapsed = false;
  var ticking = false;
  var animId = null;

  // 只测一次初始宽度
  var leftFullW = Math.round(left.getBoundingClientRect().width);
  var rightFullW = Math.round(right.getBoundingClientRect().width);

  // 直接设固定宽度，不动画
  left.style.width = leftFullW + 'px';
  right.style.width = rightFullW + 'px';

  // easeOutBack
  function easeOutBack(t) {
    var c = 1.70158;
    return 1 + c * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  // easeInOutQuad
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function expandBar(el, targetW, duration, callback) {
    if (animId) cancelAnimationFrame(animId);
    el.classList.remove('db-hidden');
    var startTime = performance.now();

    function step(now) {
      var elapsed = now - startTime;
      var t = Math.min(elapsed / duration, 1);
      var p = easeOutBack(t);
      el.style.width = Math.round(targetW * p) + 'px';
      if (t < 1) {
        animId = requestAnimationFrame(step);
      } else {
        el.style.width = targetW + 'px';
        if (callback) callback();
      }
    }
    animId = requestAnimationFrame(step);
  }

  function collapseBars(callback) {
    if (animId) cancelAnimationFrame(animId);
    var startTime = performance.now();
    var duration = 300;
    var lStart = leftFullW;
    var rStart = rightFullW;

    function step(now) {
      var elapsed = now - startTime;
      var t = Math.min(elapsed / duration, 1);
      var p = easeInOutQuad(t);
      left.style.width = Math.round(lStart * (1 - p)) + 'px';
      right.style.width = Math.round(rStart * (1 - p)) + 'px';
      if (t < 1) {
        animId = requestAnimationFrame(step);
      } else {
        left.classList.add('db-hidden');
        right.classList.add('db-hidden');
        if (callback) callback();
      }
    }
    animId = requestAnimationFrame(step);
  }

  function goCollapsed(c) {
    if (isCollapsed === c) return;
    isCollapsed = c;

    if (c) {
      // 展开→收起
      left.classList.remove('db-hidden');
      right.classList.remove('db-hidden');
      // 恢复完整宽度再收缩
      left.style.width = leftFullW + 'px';
      right.style.width = rightFullW + 'px';
      requestAnimationFrame(function() {
        collapseBars();
      });
    } else {
      // 收起→展开
      left.classList.remove('db-hidden');
      right.classList.remove('db-hidden');
      // 从0开始
      left.style.width = '0px';
      right.style.width = '0px';
      requestAnimationFrame(function() {
        // 右栏先弹
        expandBar(right, rightFullW, 350, function() {
          // 左栏跟随
          expandBar(left, leftFullW, 350);
        });
      });
    }
  }

  function onScroll() {
    var scrollY = window.scrollY || window.pageYOffset;
    if (scrollY > THRESHOLD) {
      if (!isCollapsed) goCollapsed(true);
    } else {
      if (isCollapsed) goCollapsed(false);
    }
  }

  // 初始状态：根据当前scrollY决定是否折叠，但不产生动画
  var initialScrollY = window.scrollY || window.pageYOffset;
  if (initialScrollY > THRESHOLD) {
    isCollapsed = true;
    left.classList.add('db-hidden');
    right.classList.add('db-hidden');
    left.style.width = '0px';
    right.style.width = '0px';
  } else {
    isCollapsed = false;
    left.style.width = leftFullW + 'px';
    right.style.width = rightFullW + 'px';
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });

  // 窗口尺寸变化时重新测量
  var resizeTimer = null;
  var resizeTicking = false;
  window.addEventListener('resize', function() {
    if (!resizeTicking) {
      resizeTicking = true;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        resizeTicking = false;
        left.style.width = '';
        right.style.width = '';
        left.classList.remove('db-hidden');
        right.classList.remove('db-hidden');
        leftFullW = Math.round(left.getBoundingClientRect().width);
        rightFullW = Math.round(right.getBoundingClientRect().width);
        var sy = window.scrollY || window.pageYOffset;
        if (sy > THRESHOLD) {
          isCollapsed = true;
          left.classList.add('db-hidden');
          right.classList.add('db-hidden');
          left.style.width = '0px';
          right.style.width = '0px';
        } else {
          isCollapsed = false;
          left.style.width = leftFullW + 'px';
          right.style.width = rightFullW + 'px';
        }
      }, 150);
    }
  });

  // 紧缩态点击空白回到顶部
  document.getElementById('dockBars')?.addEventListener('click', function(e) {
    if (isCollapsed && !e.target.closest('.dl-btn')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

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
