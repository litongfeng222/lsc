/* ===== LSCgroup 主程序 ===== */
let subjects = [];
let allFiles = [];
let currentSubject = 'all';

// 暴露全局供admin.js使用
window.subjects = subjects;
window.allFiles = allFiles;

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderSubjects();
  renderFiles();
  updateStats();
});

// 加载数据
async function loadData() {
  subjects = await DataLoader.getSubjects();
  allFiles = await DataLoader.getFiles();
  window.subjects = subjects;
  window.allFiles = allFiles;
}

// 渲染分类标签
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

    return `
      <div class="file-card" onclick="downloadFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')">
        <div class="file-icon" style="background: ${color}20; color: ${color}">
          ${emoji}
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            <span>${file.date}</span>
            <span>${file.size}</span>
            <span class="file-badge" style="background: ${color}">${file.tag || subject?.name || '资料'}</span>
            ${file.uploader ? `<span style="font-size:11px;color:#999">👤 ${file.uploader}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="file-icon-btn file-preview-btn" onclick="event.stopPropagation(); if(window.previewFile)previewFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')" style="width:34px;height:34px;border-radius:50%;background:var(--bg);border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-light)">👁</button>
          <button class="file-download" onclick="event.stopPropagation(); downloadFile('${file.path}', '${file.name.replace(/'/g, "\\'")}')">⬇</button>
        </div>
      </div>
    `;
  }).join('');
}

// 下载文件
function downloadFile(path, name) {
  const a = document.createElement('a');
  a.href = path;
  a.download = name;
  a.target = '_blank';
  a.click();
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
