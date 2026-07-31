/* ===== App Main Entry ===== */
(function(){
'use strict';

/* ---------- 全局状态 ---------- */
const State = {
  subjects: [],
  files: [],
  posts: [],
  currentSort: 'date',
  currentFilter: 'all',
  searchQuery: '',
  currentForumBoard: 'qa',
  currentRankingType: 'downloads',
  user: null,
};

/* ---------- 工具函数 ---------- */
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getFileExt = path => { const m = String(path).match(/\.([^.?#]+)(?:[?#]|$)/); return m ? m[1].toLowerCase() : ''; };
const formatDate = d => d || '';

function toast(msg, type='info', ms=2600){
  const c = $('#toastContainer'); if(!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(()=>{ el.classList.add('fade-out'); setTimeout(()=>el.remove(),300); }, ms);
}

/* ---------- 数据加载 ---------- */
async function loadSubjects(){
  try{
    const res = await fetch('data/subjects.json');
    const data = await res.json();
    State.subjects = data.subjects || [];
  }catch(e){ console.error('加载科目失败',e); }
}

async function loadFiles(){
  try{
    const res = await fetch('data/files.json');
    const data = await res.json();
    State.files = data.files || [];
  }catch(e){ console.error('加载文件失败',e); }
}

function loadPosts(){
  try{ State.posts = JSON.parse(localStorage.getItem('lsc_posts')||'[]'); }
  catch(e){ State.posts = []; }
}
function savePosts(){ localStorage.setItem('lsc_posts', JSON.stringify(State.posts)); }

function loadUser(){
  try{ State.user = JSON.parse(localStorage.getItem('lsc_user')||'null'); }
  catch(e){ State.user = null; }
}
function saveUser(u){ State.user = u; localStorage.setItem('lsc_user', JSON.stringify(u)); }

/* ---------- 导航栏 ---------- */
function initNavbar(){
  const nav = $('#navbar');
  const toggle = $('#navToggle');
  const menu = $('#navMenu');
  const links = $$('.nav-link');

  // 滚动磨砂玻璃
  const onScroll = () => {
    if(window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // 移动端菜单
  toggle.addEventListener('click', ()=>{
    toggle.classList.toggle('active');
    menu.classList.toggle('open');
  });

  // 页面切换
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      switchPage(page);
      toggle.classList.remove('active');
      menu.classList.remove('open');
    });
  });
}

function switchPage(page){
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  $$('.page-section').forEach(s => s.style.display = (s.id === page) ? '' : 'none');
  window.scrollTo({top:0, behavior:'smooth'});
  if(page === 'resources') renderResources();
  if(page === 'forum') renderForum();
  if(page === 'ranking') renderRanking();
  if(page === 'upload') initUploadSelect();
}

/* ---------- Hero 统计 ---------- */
function updateHeroStats(){
  $('#statFiles').textContent = State.files.length;
  $('#statSubjects').textContent = State.subjects.length;
  const users = new Set(State.posts.map(p=>p.author).filter(Boolean)).size;
  $('#statUsers').textContent = users || '—';
}

/* ---------- 资源中心 ---------- */
function initFilterBar(){
  const bar = $('#filterBar');
  bar.innerHTML = '';
  const allTag = document.createElement('button');
  allTag.className = 'filter-tag active';
  allTag.textContent = '全部';
  allTag.dataset.subject = 'all';
  allTag.addEventListener('click', ()=>{ State.currentFilter='all'; updateFilterUI(); renderResources(); });
  bar.appendChild(allTag);

  State.subjects.forEach(sub => {
    const tag = document.createElement('button');
    tag.className = 'filter-tag';
    tag.textContent = sub.name;
    tag.dataset.subject = sub.id;
    tag.style.setProperty('--card-color', sub.color);
    tag.addEventListener('click', ()=>{ State.currentFilter=sub.id; updateFilterUI(); renderResources(); });
    bar.appendChild(tag);
  });
}

function updateFilterUI(){
  $$('.filter-tag').forEach(t => t.classList.toggle('active', t.dataset.subject === State.currentFilter));
}

function initSortBar(){
  $$('.sort-btn').forEach(btn => {
    btn.addEventListener('click', ()=>{
      State.currentSort = btn.dataset.sort;
      $$('.sort-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderResources();
    });
  });
}

function initSearch(){
  const input = $('#searchInput');
  let timer;
  input.addEventListener('input', ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      State.searchQuery = input.value.trim().toLowerCase();
      renderResources();
    }, 200);
  });
}

function getFilteredFiles(){
  let list = [...State.files];
  if(State.currentFilter !== 'all') list = list.filter(f => f.subject === State.currentFilter);
  if(State.searchQuery) list = list.filter(f => f.name.toLowerCase().includes(State.searchQuery));
  if(State.currentSort === 'date') list.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if(State.currentSort === 'downloads') list.sort((a,b)=> (b.downloads||0)-(a.downloads||0));
  if(State.currentSort === 'rating') list.sort((a,b)=> (b.rating||0)-(a.rating||0));
  return list;
}

function renderResources(){
  const grid = $('#resourceGrid');
  const empty = $('#emptyState');
  const list = getFilteredFiles();
  if(!list.length){ grid.innerHTML=''; empty.style.display=''; return; }
  empty.style.display='none';

  grid.innerHTML = list.map((f, i) => {
    const sub = State.subjects.find(s=>s.id===f.subject) || {name:'其他',color:'#95a5a6'};
    const ext = getFileExt(f.path);
    const downloads = f.downloads || 0;
    const rating = f.rating || 0;
    const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5-Math.round(rating));
    const previewable = ['pdf','png','jpg','jpeg','gif','webp','txt','docx','doc'].includes(ext);
    const delay = Math.min(i*60, 400);
    return `<div class="file-card" style="--card-color:${sub.color};--delay:${delay}ms;animation-delay:${delay}ms">
      <div class="file-info" data-idx="${i}">
        <div class="file-name">${escHtml(f.name)}</div>
        <div class="file-meta">
          <span class="file-tag" style="background:${sub.color}">${escHtml(sub.name)}</span>
          <span class="file-date">${formatDate(f.date)}</span>
          ${f.uploader ? `<span class="file-uploader">👤 ${escHtml(f.uploader)}</span>` : ''}
        </div>
        <div class="file-stats">
          <span>⬇ ${downloads}</span>
          ${rating > 0 ? `<span class="file-rating">${stars}</span>` : ''}
        </div>
        ${State.user ? `<div class="file-rate" data-path="${escHtml(f.path)}">
          <span class="rate-label">我的评分：</span>
          ${[1,2,3,4,5].map(n => `<span class="rate-star" data-val="${n}" onclick="rateFile('${escHtml(f.path)}',${n})">★</span>`).join('')}
        </div>` : `<div class="file-rate-hint" onclick="openAuthModal('login')">登录后可评分</div>`}
      </div>
      <div class="file-actions">
        ${previewable ? `<button class="file-icon-btn" onclick="previewFile('${escHtml(f.path)}','${escHtml(f.name)}')" title="预览">👁</button>` : ''}
        <button class="file-download-btn" onclick="downloadFile('${escHtml(f.path)}','${escHtml(f.name)}',this)">⬇ 下载</button>
      </div>
    </div>`;
  }).join('');
}

/* ---------- 评分系统 ---------- */
window.rateFile = async function(path, val){
  if(!State.user){ toast('请先登录','warning'); openAuthModal('login'); return; }
  
  // 读取已有评分
  const ratings = JSON.parse(localStorage.getItem('lsc_ratings')||'{}');
  const userKey = State.user.phone;
  if(!ratings[path]) ratings[path] = {};
  
  // 已评过则修改
  const oldVal = ratings[path][userKey];
  ratings[path][userKey] = val;
  localStorage.setItem('lsc_ratings', JSON.stringify(ratings));
  
  // 计算平均分
  const allRatings = Object.values(ratings[path]);
  const avg = allRatings.reduce((a,b)=>a+b,0) / allRatings.length;
  
  // 更新文件对象
  const file = State.files.find(f => f.path === path);
  if(file){
    file.rating = Math.round(avg * 10) / 10;
    file.ratingCount = allRatings.length;
    saveFileRatings();
  }
  
  toast(oldVal ? '评分已修改为 ' + val + ' 星' : '评分成功：' + val + ' 星', 'success');
  renderResources();
};

function saveFileRatings(){
  try{
    const stats = State.files.map(f => ({path:f.path, rating:f.rating||0, ratingCount:f.ratingCount||0, downloads:f.downloads||0}));
    localStorage.setItem('lsc_file_stats', JSON.stringify(stats));
  }catch(e){}
}

function loadFileStats(){
  try{
    const stats = JSON.parse(localStorage.getItem('lsc_file_stats')||'[]');
    stats.forEach(s => {
      const f = State.files.find(x=>x.path===s.path);
      if(f){
        f.downloads = s.downloads;
        f.rating = s.rating;
        f.ratingCount = s.ratingCount;
      }
    });
  }catch(e){}
}

/* ---------- 下载 & 预览 ---------- */
window.downloadFile = function(path, name, btn){
  // 下载计数
  const file = State.files.find(f => f.path === path);
  if(file){
    file.downloads = (file.downloads||0) + 1;
    saveFilesToStorage();
  }
  const a = document.createElement('a');
  a.href = path;
  a.download = name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('开始下载：' + name, 'success');
  if(btn) btn.textContent = '✓ 已下载';
  setTimeout(()=>{ if(btn) btn.textContent = '⬇ 下载'; }, 2000);
};

window.previewFile = function(path, name){
  const modal = $('#previewModal');
  const body = $('#previewBody');
  const ext = getFileExt(path);
  if(ext === 'pdf'){
    body.innerHTML = `<iframe src="${path}"></iframe>`;
  } else if(['png','jpg','jpeg','gif','webp'].includes(ext)){
    body.innerHTML = `<img src="${path}" alt="${escHtml(name)}">`;
  } else if(['docx','doc'].includes(ext)){
    body.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(path)}&embedded=true"></iframe>`;
  } else if(ext === 'txt'){
    fetch(path).then(r=>r.text()).then(t=>{
      body.innerHTML = `<div class="preview-text">${escHtml(t)}</div>`;
    }).catch(()=>{ body.innerHTML = `<p>无法预览此文件</p>`; });
  } else {
    body.innerHTML = `<p>不支持预览此格式，请下载后查看</p>`;
  }
  modal.style.display = 'flex';
};

/* ---------- 预览弹窗关闭 ---------- */
function initModal(){
  $('#previewClose').addEventListener('click', ()=>{ $('#previewModal').style.display='none'; });
  $('#previewModal').addEventListener('click', e => { if(e.target.id==='previewModal') e.currentTarget.style.display='none'; });
}

/* ---------- 论坛 ---------- */
function initForumTabs(){
  $$('.forum-tab').forEach(tab => {
    tab.addEventListener('click', ()=>{
      State.currentForumBoard = tab.dataset.board;
      $$('.forum-tab').forEach(t => t.classList.toggle('active', t === tab));
      renderForum();
    });
  });
  $('#newPostBtn').addEventListener('click', ()=>{
    if(!State.user){ toast('请先登录后再发帖','warning'); openAuthModal('login'); return; }
    showPostForm();
  });
}

function renderForum(){
  const list = $('#postList');
  const empty = $('#forumEmpty');
  const posts = State.posts.filter(p => p.board === State.currentForumBoard);
  if(!posts.length){ list.innerHTML=''; empty.style.display=''; return; }
  empty.style.display='none';

  list.innerHTML = posts.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0)).map(p => {
    const time = p.createdAt ? new Date(p.createdAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    const imgHtml = p.image ? `<img class="post-image" src="${escHtml(p.image)}" alt="图片">` : '';
    const repliesHtml = (p.replies||[]).map(r => `<div class="reply-item"><strong>${escHtml(r.author||'匿名')}</strong>：${escHtml(r.content)}</div>`).join('');
    return `<div class="post-card">
      <div class="post-title">${escHtml(p.title)}</div>
      <div class="post-meta"><span>👤 ${escHtml(p.author||'匿名同学')}</span><span>📅 ${time}</span></div>
      <div class="post-content">${escHtml(p.content)}</div>
      ${imgHtml}
      <div class="post-actions" style="margin-top:10px;display:flex;gap:8px">
        <button class="file-icon-btn" onclick="toggleReply(${p.id})" title="回复">💬</button>
        ${State.user && p.author === State.user.name ? `<button class="file-icon-btn" onclick="deletePost(${p.id})" title="删除" style="color:#ef4444">🗑</button>` : ''}
      </div>
      ${repliesHtml ? `<div class="post-replies">${repliesHtml}</div>` : ''}
      <div id="replyBox-${p.id}" style="display:none;margin-top:10px">
        <textarea id="replyText-${p.id}" rows="2" placeholder="写回复…" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;resize:vertical"></textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="submitReply(${p.id})">发送</button>
      </div>
    </div>`;
  }).join('');
}

window.deletePost = function(id){
  if(!confirm('确认删除这条帖子吗？')) return;
  State.posts = State.posts.filter(p => p.id !== id);
  savePosts();
  renderForum();
  updateHeroStats();
  toast('帖子已删除','success');
};

window.toggleReply = function(id){
  const box = $('#replyBox-'+id);
  box.style.display = box.style.display === 'none' ? '' : 'none';
};

window.submitReply = function(id){
  if(!State.user){ toast('请先登录后再回复','warning'); openAuthModal('login'); return; }
  const text = $('#replyText-'+id).value.trim();
  if(!text){ toast('请输入回复内容','warning'); return; }
  const post = State.posts.find(p=>p.id===id);
  if(!post) return;
  if(!post.replies) post.replies = [];
  post.replies.push({ author: State.user?.name || '', content: text });
  savePosts();
  renderForum();
  toast('回复成功','success');
};

function showPostForm(){
  if(!State.user){
    toast('请先登录后再发帖','warning');
    openAuthModal('login');
    return;
  }
  const boardNames = {qa:'学科答疑',homework:'班级作业',other:'其他信息'};
  const title = prompt('帖子标题：');
  if(!title) return;
  const content = prompt('帖子内容：');
  if(!content) return;
  const post = {
    id: Date.now(),
    board: State.currentForumBoard,
    title, content,
    author: State.user.name,
    createdAt: Date.now(),
    replies: [],
  };
  State.posts.push(post);
  savePosts();
  renderForum();
  updateHeroStats();
  toast('发帖成功！','success');
}

/* ---------- 上传 ---------- */
function initUploadSelect(){
  const sel = $('#uploadSubject');
  if(sel.children.length > 1) return;
  State.subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    sel.appendChild(opt);
  });
  // 检查登录状态
  const formWrap = $('.upload-form-wrap');
  if(!State.user){
    formWrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><p>请先登录后再上传资料</p><button class="btn btn-primary" style="margin-top:12px" onclick="openAuthModal(\'login\')">去登录</button></div>';
  } else {
    // 如果之前被替换过，恢复表单
    if(!$('#uploadForm')){
      formWrap.innerHTML = `<form id="uploadForm" class="upload-form">
        <div class="form-group"><label for="uploadName">资料名称 <span class="required">*</span></label><input type="text" id="uploadName" placeholder="例如：高一数学月考卷" required></div>
        <div class="form-group"><label for="uploadSubject">所属科目 <span class="required">*</span></label><select id="uploadSubject" required><option value="">请选择科目</option></select></div>
        <div class="form-group"><label for="uploadDesc">简介（选填）</label><textarea id="uploadDesc" rows="2" placeholder="一句话描述这份资料"></textarea></div>
        <div class="form-group"><label for="uploadFile">选择文件 <span class="required">*</span></label><input type="file" id="uploadFile" required><p class="form-hint">支持 PDF、DOCX、PPTX、XLSX、图片等格式</p></div>
        <div class="form-group"><label for="uploaderName">你的昵称（选填）</label><input type="text" id="uploaderName" placeholder="留空则显示匿名同学"></div>
        <button type="submit" class="btn btn-primary btn-block">上传资料</button>
      </form>`;
      initUploadSelect();
      initUploadForm();
    }
  }
}

function initUploadForm(){
  const form = $('#uploadForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(!State.user){ toast('请先登录后再上传资料','warning'); openAuthModal('login'); return; }
    const name = $('#uploadName').value.trim();
    const subject = $('#uploadSubject').value;
    const desc = $('#uploadDesc').value.trim();
    const fileInput = $('#uploadFile');
    const file = fileInput.files[0];
    const uploader = $('#uploaderName').value.trim() || '';

    if(!name || !subject || !file){ toast('请填写必填项','warning'); return; }

    // 通过 GitHub API 上传
    const token = localStorage.getItem('lsc_gh_token');
    if(!token){
      toast('需要先设置 GitHub Token（管理员入口中设置）','warning');
      return;
    }

    toast('正在上传…','info', 5000);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const fileName = `${subject}_${name}.${file.name.split('.').pop()}`;
      const encodedName = encodeURIComponent(fileName);
      const path = `assets/files/${encodedName}`;

      try{
        // 检查文件是否已存在
        let sha;
        try{
          const checkRes = await fetch(`https://api.github.com/repos/litongfeng222/lsc/contents/${path}`, {
            headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json' }
          });
          if(checkRes.ok){ const d = await checkRes.json(); sha = d.sha; }
        }catch(e){}

        // 上传文件
        const upRes = await fetch(`https://api.github.com/repos/litongfeng222/lsc/contents/${path}`, {
          method: 'PUT',
          headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
          body: JSON.stringify({ message:`上传: ${name}`, content: base64, sha })
        });
        if(!upRes.ok) throw new Error('上传失败');
        const upData = await upRes.json();

        // 更新 files.json
        const rawUrl = `https://raw.githubusercontent.com/litongfeng222/lsc/main/assets/files/${encodedName}`;
        const newFile = {
          name, subject, path: rawUrl,
          uploader: uploader || '',
          date: new Date().toISOString().slice(0,10),
          downloads: 0,
        };
        State.files.push(newFile);

        // 推送 files.json
        const fRes = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
          headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json' }
        });
        const fData = await fRes.json();
        const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({files:State.files}, null, 2))));
        await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
          method: 'PUT',
          headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
          body: JSON.stringify({ message:'更新文件列表', content: newContent, sha: fData.sha })
        });

        toast('上传成功！','success');
        form.reset();
        updateHeroStats();
        renderResources();
      }catch(err){
        toast('上传失败：'+err.message, 'error', 4000);
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- 排行榜 ---------- */
function initRankingTabs(){
  $$('.ranking-tab').forEach(tab => {
    tab.addEventListener('click', ()=>{
      State.currentRankingType = tab.dataset.type;
      $$('.ranking-tab').forEach(t => t.classList.toggle('active', t === tab));
      renderRanking();
    });
  });
}

function renderRanking(){
  const list = $('#rankingList');
  const empty = $('#rankingEmpty');
  if(!State.files.length){ list.innerHTML=''; empty.style.display=''; return; }
  empty.style.display='none';

  const sorted = [...State.files].sort((a,b)=>{
    if(State.currentRankingType === 'downloads') return (b.downloads||0)-(a.downloads||0);
    if(State.currentRankingType === 'rating') return (b.rating||0)-(a.rating||0);
    return 0;
  }).slice(0, 10);

  list.innerHTML = sorted.map((f, i) => {
    const sub = State.subjects.find(s=>s.id===f.subject) || {name:'其他'};
    const value = State.currentRankingType === 'downloads' ? `⬇ ${f.downloads||0}` : `★ ${(f.rating||0).toFixed(1)}`;
    return `<div class="rank-item">
      <div class="rank-num">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${escHtml(f.name)}</div>
        <div class="rank-sub">${escHtml(sub.name)}</div>
      </div>
      <div class="rank-value">${value}</div>
    </div>`;
  }).join('');
}

/* ---------- 用户身份系统（真实登录/注册） ---------- */

// SHA-256 加密
async function sha256(text){
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// 加载用户数据
async function loadUsers(){
  try{
    const res = await fetch('data/users.json?t=' + Date.now());
    const data = await res.json();
    return data.users || [];
  }catch(e){ return []; }
}

// 保存用户数据到 GitHub
async function saveUsersToGitHub(users){
  const token = localStorage.getItem('lsc_gh_token');
  if(!token) throw new Error('未设置 GitHub Token');
  
  // 获取当前 files.json 的 sha
  let sha;
  try{
    const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/users.json', {
      headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json' }
    });
    if(res.ok){ const d = await res.json(); sha = d.sha; }
  }catch(e){}
  
  const content = btoa(unescape(encodeURIComponent(JSON.stringify({users}, null, 2))));
  const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/users.json', {
    method: 'PUT',
    headers: { 'Authorization':`token ${token}`, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
    body: JSON.stringify({ message:'用户数据更新', content, sha })
  });
  if(!res.ok) throw new Error('保存失败: ' + res.status);
}

// 初始化认证弹窗
function initAuthModal(){
  const modal = $('#authModal');
  const closeBtn = $('#authClose');
  const tabLogin = $('#tabLogin');
  const tabRegister = $('#tabRegister');
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  // 关闭
  closeBtn.addEventListener('click', ()=>{ modal.style.display='none'; });
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });

  // Tab 切换
  tabLogin.addEventListener('click', ()=>{
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.style.display=''; registerForm.style.display='none';
  });
  tabRegister.addEventListener('click', ()=>{
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.style.display=''; loginForm.style.display='none';
  });

  // 登录提交
  loginForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const phone = $('#loginPhone').value.trim();
    const pwd = $('#loginPassword').value;
    if(!/^1\d{10}$/.test(phone)){ toast('请输入正确的手机号','warning'); return; }
    if(!pwd){ toast('请输入密码','warning'); return; }

    const btn = loginForm.querySelector('button[type=submit]');
    btn.textContent = '登录中…'; btn.disabled = true;

    try{
      const users = await loadUsers();
      const hash = await sha256(pwd + phone.slice(-4));
      const user = users.find(u => u.phone === phone && u.password === hash);
      if(!user){ toast('手机号或密码错误','error'); return; }
      
      saveUser({ name:user.name, phone:user.phone, registeredAt:user.registeredAt });
      updateUserUI();
      updateHeroStats();
      modal.style.display='none';
      loginForm.reset();
      toast('欢迎回来，' + user.name + '！','success');
    }catch(err){
      toast('登录失败：' + err.message,'error');
    }finally{
      btn.textContent = '登录'; btn.disabled = false;
    }
  });

  // 注册提交
  registerForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const name = $('#regName').value.trim();
    const phone = $('#regPhone').value.trim();
    const pwd = $('#regPassword').value;
    const pwd2 = $('#regPassword2').value;
    
    if(!name){ toast('请输入昵称','warning'); return; }
    if(!/^1\d{10}$/.test(phone)){ toast('请输入正确的11位手机号','warning'); return; }
    if(pwd.length < 6){ toast('密码至少6位','warning'); return; }
    if(pwd !== pwd2){ toast('两次密码不一致','warning'); return; }

    const btn = registerForm.querySelector('button[type=submit]');
    btn.textContent = '注册中…'; btn.disabled = true;

    try{
      const users = await loadUsers();
      if(users.find(u => u.phone === phone)){ toast('该手机号已注册','warning'); return; }
      
      const hash = await sha256(pwd + phone.slice(-4));
      const newUser = {
        name, phone,
        password: hash,
        registeredAt: Date.now()
      };
      users.push(newUser);
      await saveUsersToGitHub(users);
      
      saveUser({ name, phone, registeredAt: newUser.registeredAt });
      updateUserUI();
      updateHeroStats();
      modal.style.display='none';
      registerForm.reset();
      toast('注册成功，欢迎 ' + name + '！','success');
    }catch(err){
      toast('注册失败：' + err.message + '（可能需要管理员设置 Token）','error', 4000);
    }finally{
      btn.textContent = '注册'; btn.disabled = false;
    }
  });
}

// 打开认证弹窗
function openAuthModal(mode='login'){
  const modal = $('#authModal');
  modal.style.display='flex';
  if(mode === 'register'){
    $('#tabRegister').click();
  } else {
    $('#tabLogin').click();
  }
}

function initUserButton(){
  const btn = $('#userBtn');
  const dropdown = $('#userDropdown');
  const loginBtn = $('#dropdownLogin');
  const logoutBtn = $('#dropdownLogout');

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(State.user){
      dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
    } else {
      openAuthModal('login');
    }
  });
  document.addEventListener('click', ()=>{ dropdown.style.display='none'; });
  dropdown.addEventListener('click', e=>e.stopPropagation());

  loginBtn.addEventListener('click', ()=>{
    dropdown.style.display='none';
    openAuthModal('login');
  });

  logoutBtn.addEventListener('click', ()=>{
    saveUser(null);
    State.user = null;
    updateUserUI();
    updateHeroStats();
    toast('已退出登录','info');
    dropdown.style.display='none';
  });

  updateUserUI();
}

function updateUserUI(){
  const nameEl = $('#userName');
  const avatarEl = $('#userAvatar');
  const headerEl = $('#dropdownHeader');
  const loginBtn = $('#dropdownLogin');
  const logoutBtn = $('#dropdownLogout');
  if(!nameEl) return;

  if(State.user){
    nameEl.textContent = State.user.name;
    avatarEl.textContent = State.user.name.charAt(0).toUpperCase();
    avatarEl.style.background = 'var(--primary)';
    headerEl.textContent = '👤 ' + State.user.name;
    loginBtn.style.display='none';
    logoutBtn.style.display='';
  } else {
    nameEl.textContent = '登录';
    avatarEl.textContent = '👤';
    avatarEl.style.background = 'var(--bg)';
    headerEl.textContent = '请登录后使用完整功能';
    loginBtn.style.display='';
    logoutBtn.style.display='none';
  }
}

function showUserSetup(){
  openAuthModal('register');
}

/* ---------- 管理员入口 ---------- */
function initAdminEntry(){
  $('#adminEntry').addEventListener('click', ()=>{
    const pwd = prompt('请输入管理员密码：');
    if(pwd === 'LSC2026'){
      const token = prompt('请输入 GitHub Token（已设置则直接回车跳过）：');
      if(token) localStorage.setItem('lsc_gh_token', token);
      toast('管理员模式已激活', 'success');
    } else if(pwd){
      toast('密码错误', 'error');
    }
  });
}

/* ---------- 初始化 ---------- */
async function init(){
  await loadSubjects();
  await loadFiles();
  loadPosts();
  loadUser();
  loadFileStats();

  initNavbar();
  initFilterBar();
  initSortBar();
  initSearch();
  initModal();
  initForumTabs();
  initUploadForm();
  initRankingTabs();
  initAdminEntry();
  initUserButton();
  initAuthModal();

  updateUserUI();

  updateHeroStats();
  renderResources();

  // 默认显示资源中心
  switchPage('resources');
}

document.addEventListener('DOMContentLoaded', init);

})();
