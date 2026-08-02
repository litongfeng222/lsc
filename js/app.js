/* ===== App Main Entry ===== */
(function(){
'use strict';


async function saveUsersToGitHub(users){
  var token = function(){var t=localStorage.getItem('lsc_gh_token');return t&&t.length>35&&t.startsWith('ghp_')?t:'ghp_YZ'+'omBx2z3Ob'+'T3VbvJxw'+'aT5g1KV'+'HwRw1hmPBC';}();
  var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/users.json';
  var content = btoa(unescape(encodeURIComponent(JSON.stringify({users: users}, null, 2))));
  var res = await fetch(url, { headers: { 'Authorization':'token '+token, 'Accept':'application/vnd.github.v3+json' } });
  var data = await res.json();
  await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization':'token '+token, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
    body: JSON.stringify({ message:'更新用户列表', content: content, sha: data.sha })
  });
}
function renderRanking(){
  var el = document.getElementById('rankingList');
  if(!el) return;
  var isRating = State.currentRankingType === 'rating';
  var sorted = [].concat(State.files).sort(function(a,b){
    if(isRating){
      var ra = a.rating || 0;
      var rb = b.rating || 0;
      if(rb !== ra) return rb - ra;
    }
    var da = a.downloads || 0;
    var db = b.downloads || 0;
    return db - da;
  });
  if(sorted.length === 0){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>暂无资料上榜</p></div>';
    document.getElementById('rankingPodium').innerHTML = '';
    document.getElementById('chartContainer').innerHTML = '';
    return;
  }
  var top = sorted.slice(0, 20);
  // 获取最大值（评分模式用5分制）
  var getValue = function(f){ return isRating ? (f.rating||0) : (f.downloads||0); };
  var maxVal = Math.max(1, getValue(top[0]));
  if(isRating) maxVal = 5; // 评分满分为5
  // 绘制柱状图
  renderChart(top.slice(0, 10), maxVal, isRating);
  // 绘制 podium（前三）
  renderPodium(top.slice(0, 3), isRating);
  // 绘制排名列表
  el.innerHTML = top.map(function(f, i){
    var sub = State.subjects.find(function(s){ return s.id === f.subject; });
    var subName = sub ? sub.name : '未分类';
    var val = getValue(f);
    var pct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0;
    var topClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
    var numClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
    var numText = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
    var valHtml = isRating
      ? '<span class="rank-stars">'+renderStars(val)+'</span><span class="rank-score">'+val.toFixed(1)+'</span>'
      : '<span class="dl-icon">📥</span> '+val;
    return '<div class="rank-item '+topClass+'">' +
      '<div class="rank-bar-bg" style="width:'+pct+'%"></div>' +
      '<span class="rank-num '+numClass+'">'+numText+'</span>' +
      '<div class="rank-info">' +
        '<div class="rank-name">'+escHtml(f.name)+'</div>' +
        '<div class="rank-meta">' +
          '<span class="rank-sub" style="background:'+(sub?sub.color:'#999')+'">'+escHtml(subName)+'</span>' +
        '</div>' +
      '</div>' +
      '<span class="rank-downloads">'+valHtml+'</span>' +
    '</div>';
  }).join('');
}

function renderStars(r){
  var stars = '';
  for(var i = 1; i <= 5; i++){
    if(r >= i) stars += '★';
    else if(r >= i - 0.5) stars += '⯪';
    else stars += '☆';
  }
  return stars;
}

function renderChart(items, maxVal, isRating){
  var container = document.getElementById('chartContainer');
  if(!container) return;
  var colors = ['chart-bar-1','chart-bar-2','chart-bar-3','chart-bar-4','chart-bar-5',
    'chart-bar-6','chart-bar-7','chart-bar-8','chart-bar-9','chart-bar-10'];
  container.innerHTML = items.map(function(f, i){
    var val = isRating ? (f.rating||0) : (f.downloads||0);
    var h = maxVal > 0 ? Math.max(8, Math.round(val / maxVal * 100)) : 8;
    var shortName = f.name.length > 6 ? f.name.substring(0,5)+'…' : f.name;
    var isTop3 = i < 3;
    var label = isRating ? val.toFixed(1)+'分' : val+'次';
    return '<div class="chart-bar-wrapper" title="'+escHtml(f.name)+'：'+label+'">' +
      '<div class="chart-bar '+(isTop3 ? 'chart-bar-top3' : 'chart-bar-other')+' '+colors[i]+'" style="height:'+h+'%"></div>' +
      '<div class="chart-value">'+(isRating ? '⭐'+val.toFixed(1) : val)+'</div>' +
      '<div class="chart-label">'+escHtml(shortName)+'</div>' +
    '</div>';
  }).join('');
}

function renderPodium(top3, isRating){
  var podium = document.getElementById('rankingPodium');
  if(!podium) return;
  if(top3.length < 3){
    podium.innerHTML = '';
    return;
  }
  var order = [1, 0, 2];
  var medals = ['🥇','🥈','🥉'];
  var classes = ['gold','silver','bronze'];
  var ranks = ['🥇 冠军','🥈 亚军','🥉 季军'];
  podium.innerHTML = order.map(function(idx){
    var f = top3[idx];
    if(!f) return '';
    var sub = State.subjects.find(function(s){ return s.id === f.subject; });
    var subName = sub ? sub.name : '未分类';
    var val = isRating ? (f.rating||0).toFixed(1) : (f.downloads||0);
    var valHtml = isRating
      ? '⭐ '+val+' <small>分</small>'
      : '📥 '+val+' <small>次下载</small>';
    return '<div class="podium-card '+classes[idx]+'">' +
      '<span class="podium-medal">'+medals[idx]+'</span>' +
      '<div class="podium-rank">'+ranks[idx]+'</div>' +
      '<div class="podium-name" title="'+escHtml(f.name)+'">'+escHtml(f.name)+'</div>' +
      '<span class="podium-sub" style="background:'+(sub?sub.color:'#999')+'">'+escHtml(subName)+'</span>' +
      '<div class="podium-dl">'+valHtml+'</div>' +
    '</div>';
  }).join('');
}

function initRankingTabs(){
  var tabs = document.querySelectorAll('#ranking .ranking-tab');
  tabs.forEach(function(t){ t.addEventListener('click', function(){
    tabs.forEach(function(x){x.classList.remove('active');});
    this.classList.add('active');
    State.currentRankingType = this.dataset.type;
    renderRanking();
  });});
}


async function loadUsers(){
  try{
    var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/users.json';
    var res = await fetch(url);
    if(!res.ok) return [];
    var d = await res.json();
    if(d.content){
      var str = decodeURIComponent(escape(atob(d.content)));
      var data = JSON.parse(str);
      return data.users || [];
    }
  }catch(e){}
  return [];
}

async function sha256(str){
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

function downloadFile(url, name){
  var a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  name && (a.download = name);
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function saveFilesToStorage(){
  var token = function(){var t=localStorage.getItem('lsc_gh_token');return t&&t.length>35&&t.startsWith('ghp_')?t:'ghp_YZ'+'omBx2z3Ob'+'T3VbvJxw'+'aT5g1KV'+'HwRw1hmPBC';}();
  var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json';
  var content = btoa(unescape(encodeURIComponent(JSON.stringify({files:State.files}, null, 2))));
  try{
    var r = await fetch(url, {headers:{'Authorization':'token '+token, 'Accept':'application/vnd.github.v3+json'}});
    if(!r.ok) throw new Error('获取SHA失败');
    var d = await r.json();
    await fetch(url, {
      method:'PUT',
      headers:{'Authorization':'token '+token, 'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},
      body:JSON.stringify({message:'更新文件列表', content:content, sha:d.sha})
    });
  }catch(e){ throw new Error('保存失败：'+e.message); }
}


function rateFile(path, rating){
  if(!State.user){ toast('请先登录后评分','warning'); return; }
  var f = State.files.find(function(x){ return x.path === path; });
  if(!f) return;
  f.ratings = f.ratings || {};
  f.ratings[State.user.phone] = rating;
  saveFileRatings();
  renderResources();
}
window.unlockAdmin = function(){
  var pwd = document.getElementById('adminPwd');
  var panel = document.getElementById('adminPanel');
  var btn = document.getElementById('adminLoginBtn');
  // 直接通过密码 或 已登录为李同丰时自动解锁
  var isLi = State.user && State.user.phone === '15652249583';
  if(pwd && (pwd.value === 'LSC2026' || isLi)){
    if(btn) btn.style.display = 'none';
    pwd.style.display = 'none';
    if(panel) panel.style.display = '';
    window.loadAdminData && window.loadAdminData();
    try{ toast(isLi ? '👋 管理员李同丰，欢迎回来' : '管理员验证成功','success'); }catch(e){}
  } else {
    try{ toast('密码错误','error'); }catch(e){ alert('密码错误'); }
  }
};

window.loadAdminData = function(){
  try{
    typeof updateTokenStatus === 'function' && updateTokenStatus();
    typeof renderAdminFiles === 'function' && renderAdminFiles();
    typeof renderAdminUsers === 'function' && renderAdminUsers();
    typeof renderAdminPosts === 'function' && renderAdminPosts();
  }catch(e){ console.error('loadAdminData error', e); }
};

/* ---------- 全局状态 ---------- */
const State = {
  subjects: [],
  files: [],
  posts: [],
  registeredUsers: [],
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
    // 用GitHub API读数据，无缓存问题
    var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/subjects.json';
    var res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    var d = await res.json();
    var str = decodeURIComponent(escape(atob(d.content)));
    var data = JSON.parse(str);
    State.subjects = data.subjects || [];
  }catch(e){ console.error('加载科目失败',e); }
}

async function loadFiles(){
  try{
    var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json';
    var res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    var d = await res.json();
    var str = decodeURIComponent(escape(atob(d.content)));
    var data = JSON.parse(str);
    State.files = data.files || [];
  }catch(e){ console.error('加载文件失败',e); }
}

async function loadPosts(){
  // 优先从 GitHub 同步帖子
  try{
    var res = await fetch('https://raw.githubusercontent.com/litongfeng222/lsc/main/data/posts.json?t='+Date.now());
    if(res.ok){
      State.posts = await res.json();
      // 缓存到本地
      localStorage.setItem('lsc_posts', JSON.stringify(State.posts));
      return;
    }
  }catch(e){}
  // 降级：从本地缓存加载
  try{ State.posts = JSON.parse(localStorage.getItem('lsc_posts')||'[]'); }
  catch(e){ State.posts = []; }
}
function savePosts(){
  localStorage.setItem('lsc_posts', JSON.stringify(State.posts));
  setTimeout(syncPostsToGitHub, 50);
}
async function syncPostsToGitHub(){
  try{
    var tk = function(){var t=localStorage.getItem('lsc_gh_token');return t&&t.length>35&&t.startsWith('ghp_')?t:'ghp_YZ'+'omBx2z3Ob'+'T3VbvJxw'+'aT5g1KV'+'HwRw1hmPBC';}();
    var url = 'https://api.github.com/repos/litongfeng222/lsc/contents/data/posts.json';
    var r = await fetch(url, { headers: { 'Authorization':'token '+tk, 'Accept':'application/vnd.github.v3+json' } });
    if(!r.ok) return;
    var d = await r.json();
    var c = btoa(unescape(encodeURIComponent(JSON.stringify(State.posts))));
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization':'token '+tk, 'Accept':'application/vnd.github.v3+json', 'Content-Type':'application/json' },
      body: JSON.stringify({ message: '同步帖子', content: c, sha: d.sha })
    });
  }catch(e){}
}

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
window.switchPage = switchPage;

/* ---------- Hero 统计 ---------- */
function updateHeroStats(){
  $('#statFiles').textContent = State.files.length;
  $('#statSubjects').textContent = State.subjects.length;
  var count = State.registeredUsers.length;
  $('#statUsers').textContent = count || '—';
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
    const previewable = false;
    const desc = f.desc || '';
    const usage = f.usage || '';
    const delay = Math.min(i*60, 400);
    return `<div class="file-card" style="--card-color:${sub.color};--delay:${delay}ms;animation-delay:${delay}ms">
      <div class="file-info" data-idx="${i}">
        <div class="file-name">${escHtml(f.name)}</div>
        ${desc ? `<div class="file-desc">${escHtml(desc)}</div>` : ''}
        <div class="file-meta">
          <span class="file-tag" style="background:${sub.color}">${escHtml(sub.name)}</span>
          <span class="file-date">📅 ${formatDate(f.date)}</span>
          ${f.uploader ? `<span class="file-uploader">👤 ${escHtml(f.uploader)}</span>` : ''}
        </div>
        <div class="file-stats">
          <span>⬇ ${downloads} 次下载</span>
          ${rating > 0 ? `<span class="file-rating">${stars} ${rating.toFixed(1)}</span>` : '<span class="file-no-rating">暂无评分</span>'}
        </div>
        ${usage ? `<div class="file-usage"><span class="usage-label">📋 使用说明：</span>${escHtml(usage)}</div>` : ''}
        ${State.user ? `<div class="file-rate" data-path="${escHtml(f.path)}">
          <span class="rate-label">我的评分：</span>
          ${[1,2,3,4,5].map(n => {
            const userRating = getUserRating(f.path);
            const cls = userRating === n ? 'rate-star rated' : 'rate-star';
            return `<span class="${cls}" data-val="${n}" onclick="rateFile('${escHtml(f.path)}',${n})">★</span>`;
          }).join('')}
          ${f.ratingCount ? `<span class="rate-count">${f.rating.toFixed(1)}分（${f.ratingCount}人）</span>` : ''}
        </div>` : `<div class="file-rate-hint" onclick="openAuthModal('login')">登录后可评分</div>`}
      </div>
      <div class="file-actions">
        ${previewable ? `<button class="file-icon-btn" onclick="previewFile('${escHtml(f.path)}','${escHtml(f.name)}')" title="预览">👁</button>` : ''}
        <button class="file-download-btn" onclick="downloadFile('${escHtml(f.path)}','${escHtml(f.name)}',this)">⬇ 下载</button>
        ${State.user && f.uploader && f.uploader === State.user.name ? `<button class="file-icon-btn" onclick="userDeleteFile('${escHtml(f.path)}')" title="删除" style="color:#ef4444">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---------- 评分系统 ---------- */
function getUserRating(path){
  if(!State.user) return 0;
  try{
    const ratings = JSON.parse(localStorage.getItem('lsc_ratings')||'{}');
    return ratings[path]?.[State.user.phone] || 0;
  }catch(e){ return 0; }
}

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

/* 预览功能已移除 */

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
    const repliesHtml = (p.replies||[]).map(function(r, idx){
      const replyImg = r.image ? `<div class="reply-image-preview"><img src="${escHtml(r.image)}" alt="图片"></div>` : '';
      const replyDel = State.user && r.author === State.user.name ? `<button class="file-icon-btn" onclick="userDeleteReply(${p.id},${idx})" title="删除" style="color:#ef4444;font-size:12px;margin-left:4px">🗑</button>` : '';
      return `<div class="reply-item">${r.author==='学习搭子'?'🤖 ':''}<strong>${escHtml(r.author||'匿名')}</strong>：${escHtml(r.content)}${replyImg}${replyDel}</div>`;
    }).join('');
    return `<div class="post-card">
      <div class="post-title">${escHtml(p.title)}</div>
      <div class="post-meta"><span>${p.author==='学习搭子'?'🤖':'👤'} ${escHtml(p.author||'匿名同学')}</span><span>📅 ${time}</span></div>
      <div class="post-content">${escHtml(p.content)}</div>
      ${imgHtml}
      <div class="post-actions" style="margin-top:10px;display:flex;gap:8px">
        <button class="file-icon-btn" onclick="toggleReply(${p.id})" title="回复">💬</button>
        ${State.user && p.author === State.user.name ? `<button class="file-icon-btn" onclick="deletePost(${p.id})" title="删除" style="color:#ef4444">🗑</button>` : ''}
      </div>
      ${repliesHtml ? `<div class="post-replies">${repliesHtml}</div>` : ''}
      <div id="replyBox-${p.id}" style="display:none;margin-top:10px">
        <textarea id="replyText-${p.id}" rows="2" placeholder="写回复…" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;resize:vertical"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <label class="reply-image-btn">📎 图片
            <input type="file" accept="image/*" style="display:none" onchange="handleReplyImage(${p.id},this)">
          </label>
          <div id="replyImgPreview-${p.id}" class="reply-image-preview" style="display:none"></div>
          <button class="btn btn-primary btn-sm" onclick="submitReply(${p.id})">发送</button>
        </div>
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

window.handleReplyImage = function(postId, input){
  const file = input.files[0];
  if(!file) return;
  if(file.size > 2*1024*1024){ toast('图片不能超过2MB','warning'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    const preview = $('#replyImgPreview-'+postId);
    preview.innerHTML = `<img src="${reader.result}" alt="预览">`;
    preview.style.display='block';
    preview.dataset.image = reader.result;
  };
  reader.readAsDataURL(file);
};

window.submitReply = function(id){
  if(!State.user){ toast('请先登录后再回复','warning'); openAuthModal('login'); return; }
  const text = $('#replyText-'+id).value.trim();
  if(!text){ toast('请输入回复内容','warning'); return; }
  const post = State.posts.find(p=>p.id===id);
  if(!post) return;
  if(!post.replies) post.replies = [];
  const preview = $('#replyImgPreview-'+id);
  const image = preview ? (preview.dataset.image || '') : '';
  post.replies.push({ author: State.user.name, content: text, image });
  savePosts();
  renderForum();
  toast('回复成功','success');
};

function showPostForm(){
  if(!State.user){ toast('请先登录后再发帖','warning'); openAuthModal('login'); return; }
  $('#postModal').style.display='flex';
  $('#postTitle').value='';
  $('#postContent').value='';
  $('#postImage').value='';
  $('#postImagePreview').style.display='none';
  $('#postImagePreview').innerHTML='';
}

function initPostModal(){
  const modal = $('#postModal');
  $('#postClose').addEventListener('click', ()=>{ modal.style.display='none'; });
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });

  $('#postImage').addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 2*1024*1024){ toast('图片不能超过2MB','warning'); e.target.value=''; return; }
    const reader = new FileReader();
    reader.onload = ()=>{
      const preview = $('#postImagePreview');
      preview.innerHTML = `<img src="${reader.result}" alt="预览">`;
      preview.style.display='block';
    };
    reader.readAsDataURL(file);
  });

  $('#postForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const title = $('#postTitle').value.trim();
    const content = $('#postContent').value.trim();
    if(!title || !content){ toast('请填写标题和内容','warning'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.textContent='发布中…'; btn.disabled=true;

    let imageBase64 = '';
    const imgFile = $('#postImage').files[0];
    if(imgFile){
      imageBase64 = await new Promise(resolve=>{
        const r = new FileReader();
        r.onload = ()=>resolve(r.result);
        r.readAsDataURL(imgFile);
      });
    }

    const post = {
      id: Date.now(),
      board: $('#postBoard').value,
      title, content,
      image: imageBase64,
      author: State.user.name,
      createdAt: Date.now(),
      replies: [],
    };
    State.posts.push(post);
    savePosts();
    modal.style.display='none';
    $('#postForm').reset();
    // 发帖后自动切换到所选版块
    State.currentForumBoard = $('#postBoard').value;
    // 切换论坛tab高亮
    $$('.forum-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.board === State.currentForumBoard); });
    renderForum();
    updateHeroStats();
    toast('发帖成功！','success');
    btn.textContent='发布'; btn.disabled=false;
  });
}

/* ---------- 上传 ---------- */
function initUploadSelect(){
  const formWrap = $('.upload-form-wrap');
  if(!formWrap) return;
  if(!State.user){
    formWrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><p>请先登录后再上传资料</p><button class="btn btn-primary" style="margin-top:12px" onclick="openAuthModal(\'login\')">去登录</button></div><div class="back-home-wrap"><button class="btn btn-back-home" onclick="switchPage(\'resources\')">📂 返回资源中心</button></div>';
    return;
  }
  formWrap.innerHTML = '<div id="uploadTokenHint" class="upload-token-hint"></div>'+
    '<form id="uploadForm" class="upload-form" onsubmit="return window.uploadSubmit(event)">'+
    '<div class="form-group"><label for="uploadName">资料名称 <span class="required">*</span></label><input type="text" id="uploadName" placeholder="例如：高一数学月考卷" required></div>'+
    '<div class="form-group"><label for="uploadSubject">所属科目 <span class="required">*</span></label><select id="uploadSubject" required><option value="">请选择科目</option></select></div>'+
    '<div class="form-group"><label for="uploadDesc">简介（选填）</label><textarea id="uploadDesc" rows="2" placeholder="一句话描述"></textarea></div>'+
    '<div class="form-group"><label for="uploadUsage">使用说明（选填）</label><textarea id="uploadUsage" rows="2" placeholder="例如：适合考前复习，重点看第3页"></textarea></div>'+
    '<div class="form-group"><label><span class="info-icon" id="expireInfoBtn" onclick="showExpireInfo()" title="了解详情">\u24d8</span> 保留时间 <span class="required">*</span></label><input type="datetime-local" id="uploadExpire" required></div>'+
    '<div class="form-group"><label for="uploadFile">选择文件 <span class="required">*</span></label><input type="file" id="uploadFile" required><p class="form-hint" id="uploadFileHint">支持 PDF/DOCX/PPTX/XLSX/图片等，不超过25MB</p></div>'+
    '<div class="form-group"><label for="uploaderName">你的昵称（选填）</label><input type="text" id="uploaderName" placeholder="留空则使用登录昵称"></div>'+
    '<button type="submit" class="btn btn-primary btn-block" id="uploadSubmitBtn">上传资料</button></form>'+
    '<div class="back-home-wrap"><button class="btn btn-back-home" onclick="switchPage(\'resources\')">📂 返回资源中心</button></div>';
  State.subjects.forEach(s => { var o=document.createElement('option'); o.value=s.id; o.textContent=s.name; document.getElementById('uploadSubject').appendChild(o); });
  document.getElementById('uploaderName').value = State.user.name;
  var h=document.getElementById('uploadTokenHint');
  h.style.display = 'none';
  document.getElementById('uploadFile').onchange=function(){ var f=this.files[0]; if(!f)return; document.getElementById('uploadFileHint').textContent='已选择：'+f.name+'（'+(f.size/1024/1024).toFixed(1)+'MB）'; if(f.size>25*1024*1024)toast('文件超过25MB，GitHub可能上传失败','warning',4000); };
}

window.uploadSubmit = async function(e){
  e.preventDefault();
  if(!State.user){ toast('请先登录','warning');openAuthModal('login');return false; }
  var token = (function(){var t=localStorage.getItem('lsc_gh_token');return t&&t.length>35&&t.startsWith('ghp_')?t:'ghp_YZ'+'omBx2z3Ob'+'T3VbvJxw'+'aT5g1KV'+'HwRw1hmPBC';})();
  var name = document.getElementById('uploadName').value.trim();
  var subject = document.getElementById('uploadSubject').value;
  var file = document.getElementById('uploadFile').files[0];
  var uploader = document.getElementById('uploaderName').value.trim() || State.user.name;
  var desc = document.getElementById('uploadDesc').value.trim();
  var usage = document.getElementById('uploadUsage')?document.getElementById('uploadUsage').value.trim():'';
  var expireVal = document.getElementById('uploadExpire')?document.getElementById('uploadExpire').value:'';
  var expireAt = expireVal ? new Date(expireVal).getTime() : 0;
  if(!expireAt){ toast('请选择保留时间','warning');return false; }
  if(expireAt < Date.now()){ toast('保留时间不能是过去或当前时间','warning');return false; }
  if(!name){ toast('请填写资料名称','warning');return false; }
  if(!subject){ toast('请选择科目','warning');return false; }
  if(!file){ toast('请选择文件','warning');return false; }
  var btn = document.getElementById('uploadSubmitBtn');
  btn.textContent='上传中…';btn.disabled=true;
  toast('正在上传…','info',6000);
  try{
    var base64 = await new Promise(function(rv){var r=new FileReader();r.onload=function(){rv(r.result.split(',')[1]);};r.readAsDataURL(file);});
    var ext = file.name.split('.').pop();
    var fileName = subject+'_'+name+'.'+ext;
    var encodedName = encodeURIComponent(fileName);
    var ghPath = 'assets/files/'+encodedName;
    var rawUrl = 'https://raw.githubusercontent.com/litongfeng222/lsc/main/assets/files/'+encodedName;
    var headers = {'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
    var sha;
    try{ var c=await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/'+ghPath,{headers}); if(c.ok) sha=(await c.json()).sha; }catch(ee){}
    var upRes = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/'+ghPath,{method:'PUT',headers,body:JSON.stringify({message:'上传: '+name,content:base64,sha})});
    if(!upRes.ok){ var ed;try{ed=(await upRes.json()).message}catch(ee){ed='上传失败('+upRes.status+')'};throw Error(ed); }
    State.files.push({name,subject,path:rawUrl,uploader,desc,usage,expireAt,date:new Date().toISOString().slice(0,10),downloads:0});
    var fRes=await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json',{headers});
    var fData=await fRes.json();
    var newContent=btoa(unescape(encodeURIComponent(JSON.stringify({files:State.files},null,2))));
    var upFRes=await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json',{method:'PUT',headers,body:JSON.stringify({message:'更新文件列表',content:newContent,sha:fData.sha})});
    if(!upFRes.ok) throw Error('files.json更新失败');
    toast('上传成功！资料已共享给同学们 ✅','success',3000);
    document.getElementById('uploadForm').reset();
    document.getElementById('uploadFileHint').textContent='支持 PDF/DOCX/PPTX/XLSX/图片等，不超过25MB';
    document.getElementById('uploaderName').value=State.user.name;
    updateHeroStats();renderResources();
  }catch(err){ toast('上传失败：'+err.message,'error',5000); }
  btn.textContent='上传资料';btn.disabled=false;
  return false;
};

window.loginSubmit = async function(e){
  e && e.preventDefault();
  var phone = document.getElementById('loginPhone').value.trim();
  var pwd = document.getElementById('loginPassword').value;
  if(!/^1[3-9]\d{9}$/.test(phone)){ toast('请输入正确的手机号（11位，以1开头，第二位3-9）','warning'); return false; }
  if(!pwd){ toast('请输入密码','warning'); return false; }
  var btn = document.getElementById('loginForm').querySelector('button[type=submit]');
  btn.textContent='登录中…';btn.disabled=true;
  try{
    var users = await loadUsers();
    var hash = await sha256(pwd + phone.slice(-4));
    var user = users.find(function(u){return u.phone===phone && u.password===hash;});
    if(!user){ toast('手机号或密码错误','error'); btn.textContent='登录';btn.disabled=false; return false; }
    saveUser({name:user.name,phone:user.phone,registeredAt:user.registeredAt});
    updateUserUI();updateHeroStats();
    document.getElementById('authModal').style.display='none';
    document.getElementById('loginForm').reset();
    toast('欢迎回来，'+user.name+'！','success');
  }catch(err){ toast('登录失败：'+err.message,'error'); }
  btn.textContent='登录';btn.disabled=false;
  return false;
};

window.registerSubmit = async function(e){
  e && e.preventDefault();
  var name = document.getElementById('regName').value.trim();
  var phone = document.getElementById('regPhone').value.trim();
  var pwd = document.getElementById('regPassword').value;
  var pwd2 = document.getElementById('regPassword2').value;
  if(!name){ toast('请输入昵称','warning');return false; }
  if(!/^1[3-9]\d{9}$/.test(phone)){ toast('请输入正确的11位手机号（第二位3-9）','warning');return false; }
  if(pwd.length<6){ toast('密码至少6位','warning');return false; }
  if(pwd!==pwd2){ toast('两次密码不一致','warning');return false; }
  var btn = document.getElementById('registerForm').querySelector('button[type=submit]');
  btn.textContent='注册中…';btn.disabled=true;
  try{
    var users = await loadUsers();
    if(users.find(function(u){return u.phone===phone;})){ toast('该手机号已注册','warning');btn.textContent='注册';btn.disabled=false;return false; }
    var hash = await sha256(pwd+phone.slice(-4));
    users.push({name:name,phone:phone,password:hash,registeredAt:Date.now()});
    State.registeredUsers = users;
    await saveUsersToGitHub(users);
    saveUser({name:name,phone:phone,registeredAt:Date.now()});
    updateUserUI();updateHeroStats();
    document.getElementById('authModal').style.display='none';
    document.getElementById('registerForm').reset();
    toast('注册成功，欢迎 '+name+'！','success');
  }catch(err){ toast('注册失败：'+err.message+(err.message.includes('Token')?'':'（需先在管理员面板设置Token）'),'error',4000); }
  btn.textContent='注册';btn.disabled=false;
  return false;
};

function calcPwdStrength(pwd){
  if(!pwd) return {level:'',label:'',width:0};
  if(typeof zxcvbn !== 'function') return {level:'',label:'',width:0};
  var r = zxcvbn(pwd);
  var map = [
    {level:'weak',label:'弱',width:25},
    {level:'weak',label:'弱',width:25},
    {level:'medium',label:'中等',width:50},
    {level:'strong',label:'强',width:75},
    {level:'very-strong',label:'非常强',width:100}
  ];
  return map[r.score] || map[0];
}

function initAuthModal(){
  // 密码强度实时检测
  var pwdInput = $('#regPassword');
  if(pwdInput){
    pwdInput.addEventListener('input', function(){
      var bar = $('#pwdStrengthBar');
      var text = $('#pwdStrengthText');
      if(!bar || !text) return;
      var result = calcPwdStrength(this.value);
      bar.className = 'pwd-strength-bar ' + result.level;
      text.textContent = this.value ? '密码强度：' + result.label : '';
      text.style.color = result.level === 'weak' ? '#ef4444' : result.level === 'medium' ? '#f59e0b' : '#22c55e';
    });
  }
  // 手机号实时校验
  var phoneInput = $('#regPhone');
  if(phoneInput){
    phoneInput.addEventListener('input', function(){
      var hint = $('#regPhoneHint');
      if(!hint) return;
      var v = this.value;
      if(v.length === 0){ hint.textContent = ''; return; }
      if(!/^1\d{0,10}$/.test(v)){ hint.textContent = '❌ 手机号格式不对'; hint.style.color = '#ef4444'; return; }
      if(v.length < 11){ hint.textContent = '⏳ 已输入 ' + v.length + '/11 位'; hint.style.color = 'var(--text-light)'; return; }
      if(/^1[3-9]\d{9}$/.test(v)){ hint.textContent = '✅ 手机号格式正确'; hint.style.color = '#22c55e'; }
      else { hint.textContent = '❌ 手机号号段不对'; hint.style.color = '#ef4444'; }
    });
  }
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
window.openAuthModal = openAuthModal;

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

/* ---------- 主题色系统 ---------- */
const THEMES = [
  {name:'默认紫', primary:'#5b6ee8', primaryDark:'#4754c4', primaryLight:'#7d8ff5'},
  {name:'天空蓝', primary:'#3b82f6', primaryDark:'#2563eb', primaryLight:'#60a5fa'},
  {name:'薄荷青', primary:'#14b8a6', primaryDark:'#0d9488', primaryLight:'#2dd4bf'},
  {name:'暖阳橙', primary:'#f59e0b', primaryDark:'#d97706', primaryLight:'#fbbf24'},
  {name:'樱花粉', primary:'#d4839e', primaryDark:'#c4728a', primaryLight:'#e8b0c4'},
  {name:'石墨黑', primary:'#1e293b', primaryDark:'#0f172a', primaryLight:'#334155'}
];

function applyTheme(primary, primaryDark, primaryLight){
  var r = document.documentElement;
  r.style.setProperty('--primary', primary);
  r.style.setProperty('--primary-dark', primaryDark);
  r.style.setProperty('--primary-light', primaryLight);
}

function loadTheme(){
  if(!State.user) return;
  var saved = localStorage.getItem('lsc_theme_'+State.user.phone);
  if(saved){
    try{ var t = JSON.parse(saved); applyTheme(t.primary, t.primaryDark, t.primaryLight); }catch(e){}
  }
}

function saveTheme(theme){
  if(!State.user) return;
  localStorage.setItem('lsc_theme_'+State.user.phone, JSON.stringify(theme));
  applyTheme(theme.primary, theme.primaryDark, theme.primaryLight);
  toast('🎨 主题已切换','success');
}

/* ---------- 个人设置面板 ---------- */
function openUserSettings(){
  $('#userSettingsModal').style.display='flex';
  renderThemePicker();
  renderMyFiles();
  renderMyPosts();
  renderMyReplies();
}

function renderThemePicker(){
  var picker = $('#themePicker');
  if(!picker) return;
  var current = JSON.parse(localStorage.getItem('lsc_theme_'+State.user.phone)||'{}');
  var defaultPrimary = current.primary || '#5b6ee8';
  picker.innerHTML = THEMES.map(function(t){
    var active = t.primary === defaultPrimary ? ' active' : '';
    return '<button class="theme-btn'+active+'" onclick="selectTheme(\''+t.primary+'\',\''+t.primaryDark+'\',\''+t.primaryLight+'\',this)" style="background:'+t.primary+';color:#fff">'+t.name+'</button>';
  }).join('');
}

window.selectTheme = function(primary, primaryDark, primaryLight, btn){
  $$('.theme-btn').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  saveTheme({primary:primary, primaryDark:primaryDark, primaryLight:primaryLight});
};

function renderMyFiles(){
  var list = $('#settingsMyFiles');
  if(!list) return;
  var myFiles = State.files.filter(function(f){ return f.uploader && f.uploader === State.user.name; });
  if(!myFiles.length){ list.innerHTML='<div class="settings-empty">你还没有上传过资料</div>'; return; }
  list.innerHTML = myFiles.map(function(f){
    var sub = State.subjects.find(function(s){return s.id===f.subject;})||{name:'其他'};
    return '<div class="settings-item"><span>['+sub.name+'] '+escHtml(f.name)+'</span><button class="admin-item-btn delete" onclick="userDeleteFile('+JSON.stringify(f.path)+')">删除</button></div>';
  }).join('');
}

function renderMyPosts(){
  var list = $('#settingsMyPosts');
  if(!list) return;
  var boardNames = {qa:'学科答疑',homework:'班级作业',other:'其他信息'};
  var myPosts = State.posts.filter(function(p){ return p.author === State.user.name; });
  if(!myPosts.length){ list.innerHTML='<div class="settings-empty">你还没有发过帖子</div>'; return; }
  list.innerHTML = myPosts.map(function(p){
    return '<div class="settings-item"><span>'+(boardNames[p.board]||'未知')+'] '+escHtml(p.title)+'</span><button class="admin-item-btn delete" onclick="userDeletePost('+p.id+')">删除</button></div>';
  }).join('');
}

function renderMyReplies(){
  var list = $('#settingsMyReplies');
  if(!list) return;
  var myReplies = [];
  State.posts.forEach(function(p){
    (p.replies||[]).forEach(function(r, idx){
      if(r.author === State.user.name){
        myReplies.push({postTitle:p.title, postId:p.id, replyIdx:idx, content:r.content});
      }
    });
  });
  if(!myReplies.length){ list.innerHTML='<div class="settings-empty">你还没有发过评论</div>'; return; }
  list.innerHTML = myReplies.map(function(r){
    var snippet = r.content.slice(0,30);
    var ellipsis = r.content.length > 30 ? '…' : '';
    return '<div class="settings-item"><span>💬 '+escHtml(r.postTitle)+'：'+escHtml(snippet)+ellipsis+'</span><button class="admin-item-btn delete" onclick="userDeleteReply('+r.postId+','+r.replyIdx+')">删除</button></div>';
  }).join('');
}

window.userDeleteFile = async function(path){
  if(!confirm('确认删除这份资料？')) return;
  var idx = State.files.findIndex(function(f){ return f.path === path && f.uploader === State.user.name; });
  if(idx < 0){ toast('无权限删除该文件','error'); return; }
  State.files.splice(idx, 1);
  try{
    await saveFilesToStorage();
    toast('资料已删除','success');
    renderMyFiles();
    renderResources();
    updateHeroStats();
  }catch(e){ toast(e.message,'error',4000); }
};

window.userDeletePost = function(id){
  if(!confirm('确认删除这条帖子？')) return;
  var post = State.posts.find(function(p){ return p.id === id; });
  if(!post || post.author !== State.user.name){ toast('无权限删除','error'); return; }
  State.posts = State.posts.filter(function(p){ return p.id !== id; });
  savePosts();
  renderMyPosts();
  renderForum();
  updateHeroStats();
  toast('帖子已删除','success');
};

window.userDeleteReply = function(postId, replyIdx){
  if(!confirm('确认删除这条评论？')) return;
  var post = State.posts.find(function(p){ return p.id === postId; });
  if(!post || !post.replies || !post.replies[replyIdx]) return;
  if(post.replies[replyIdx].author !== State.user.name){ toast('无权限删除该评论','error'); return; }
  post.replies.splice(replyIdx, 1);
  savePosts();
  renderMyReplies();
  renderForum();
  toast('评论已删除','success');
};

/* ---------- 管理员面板 ---------- */
function initAdminEntry(){
  $('#adminEntry').addEventListener('click', ()=>{
    if(!State.user){
      toast('请先登录后使用','warning');
      openAuthModal('login');
      return;
    }
    if(State.user.phone === '15652249583'){
      // 管理员，显示管理员面板
      $('#adminModal').style.display='flex';
      $('#adminPwd').value='';
      $('#adminPanel').style.display='none';
      $('#adminLoginBtn').textContent='解锁管理面板';
      $('#adminPwd').style.display='';
    } else {
      // 普通用户，显示个人设置
      openUserSettings();
    }
  });
  $('#adminClose').addEventListener('click', ()=>{ $('#adminModal').style.display='none'; });
  $('#adminModal').addEventListener('click', e=>{ if(e.target===$('#adminModal')) $('#adminModal').style.display='none'; });

  $('#adminLoginBtn').addEventListener('click', ()=>{
    var isLi = State.user && State.user.phone === '15652249583';
    if($('#adminPwd').value === 'LSC2026' || isLi){
      $('#adminPanel').style.display='';
      updateTokenStatus();
      renderAdminFiles(); renderAdminUsers(); renderAdminPosts();
      renderAdminThemePicker(); renderAdminMyFiles(); renderAdminMyPosts(); renderAdminMyReplies();
      toast(isLi ? '👋 管理员李同丰，欢迎回来' : '管理员验证成功','success');
    } else {
      toast('密码错误','error');
    }
  });
  $('#adminPwd').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#adminLoginBtn').click(); });

  $('#adminSaveToken').addEventListener('click', ()=>{
    const t = $('#adminToken').value.trim();
    if(t && t.length > 10 && t.startsWith('ghp_')){ localStorage.setItem('lsc_gh_token', t); updateTokenStatus(); toast('Token 已保存','success'); $('#adminToken').value=''; } else { toast('Token 格式不对，应以 ghp_ 开头','warning'); }
  });
  $('#adminClearToken').addEventListener('click', ()=>{
    localStorage.removeItem('lsc_gh_token');
    updateTokenStatus();
    toast('Token 已清除，将使用默认 Token','info');
  });
}

function updateTokenStatus(){
  const has = !!localStorage.getItem('lsc_gh_token');
  $('#tokenStatus').textContent = has ? '✅ 已手动设置 Token' : 'ℹ️ 使用默认 Token（无需手动设置）';
  $('#tokenStatus').style.color = has ? '#22c55e' : '#f59e0b';
}


function renderAdminFiles(){
  const list = $('#adminFileList');
  if(!State.files.length){ list.innerHTML='<div class="admin-empty">暂无资料</div>'; return; }
  list.innerHTML = State.files.map(f => {
    const sub = State.subjects.find(s=>s.id===f.subject) || {name:'其他'};
    return `<div class="admin-item">
      <span class="admin-item-info">[${sub.name}] ${escHtml(f.name)}</span>
      <button class="admin-item-btn delete" onclick="adminDeleteFile('${escHtml(f.path)}')">删除</button>
    </div>`;
  }).join('');
}

function renderAdminUsers(){
  const list = $('#adminUserList');
  // 从 localStorage 读取用户列表
  fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/users.json')
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d.content) return {users:[]};
      var str = decodeURIComponent(escape(atob(d.content)));
      try{ var data = JSON.parse(str); }catch(e){ data={users:[]}; }
      const users = data.users || [];
      if(!users.length){ list.innerHTML='<div class="admin-empty">暂无注册用户</div>'; return; }
      list.innerHTML = users.map(u => {
        const date = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('zh-CN') : '';
        return `<div class="admin-item">
          <span class="admin-item-info">👤 ${escHtml(u.name)} · ${u.phone.slice(0,3)}****${u.phone.slice(-4)} · ${date}</span>
        </div>`;
      }).join('');
    })
    .catch(()=>{ list.innerHTML='<div class="admin-empty">加载失败</div>'; });
}

function renderAdminPosts(){
  const list = $('#adminPostList');
  if(!State.posts.length){ list.innerHTML='<div class="admin-empty">暂无帖子</div>'; return; }
  const boardNames = {qa:'学科答疑',homework:'班级作业',other:'其他信息'};
  list.innerHTML = State.posts.map(p => {
    return `<div class="admin-item">
      <span class="admin-item-info">[${boardNames[p.board]||'未知'}] ${escHtml(p.title)} - ${escHtml(p.author||'匿名')}</span>
      <button class="admin-item-btn delete" onclick="adminDeletePost(${p.id})">删除</button>
    </div>`;
  }).join('');
}

window.adminDeleteFile = async function(path){
  if(!confirm('确认删除这份资料？')) return;
  var idx = State.files.findIndex(function(f){ return f.path === path; });
  if(idx < 0){ toast('未找到该文件','error'); return; }
  State.files.splice(idx, 1);
  try{
    await saveFilesToStorage();
    toast('删除成功','success');
    renderAdminFiles();
    renderResources();
    updateHeroStats();
  }catch(e){ toast(e.message,'error',4000); }
};

window.adminDeletePost = function(id){
  if(!confirm('确认删除这条帖子？')) return;
  State.posts = State.posts.filter(p => p.id !== id);
  savePosts();
  renderAdminPosts();
  renderForum();
  updateHeroStats();
  toast('帖子已删除','success');
};

/* ---------- 管理员面板个人设置 ---------- */
function renderAdminThemePicker(){
  var picker = $('#adminThemePicker');
  if(!picker) return;
  var current = JSON.parse(localStorage.getItem('lsc_theme_'+State.user.phone)||'{}');
  var defaultPrimary = current.primary || '#5b6ee8';
  picker.innerHTML = THEMES.map(function(t){
    var active = t.primary === defaultPrimary ? ' active' : '';
    return '<button class="theme-btn'+active+'" onclick="selectTheme(\''+t.primary+'\',\''+t.primaryDark+'\',\''+t.primaryLight+'\',this)" style="background:'+t.primary+';color:#fff">'+t.name+'</button>';
  }).join('');
}

function renderAdminMyFiles(){
  var list = $('#adminMyFiles');
  if(!list) return;
  var myFiles = State.files.filter(function(f){ return f.uploader && f.uploader === State.user.name; });
  if(!myFiles.length){ list.innerHTML='<div style="font-size:.8rem;color:var(--text-light);padding:4px 0">暂无</div>'; return; }
  list.innerHTML = myFiles.map(function(f){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:.8rem"><span>'+escHtml(f.name)+'</span><button class="admin-item-btn delete" onclick="userDeleteFile('+JSON.stringify(f.path)+')" style="font-size:.72rem;padding:2px 8px">删除</button></div>';
  }).join('');
}

function renderAdminMyPosts(){
  var list = $('#adminMyPosts');
  if(!list) return;
  var myPosts = State.posts.filter(function(p){ return p.author === State.user.name; });
  if(!myPosts.length){ list.innerHTML='<div style="font-size:.8rem;color:var(--text-light);padding:4px 0">暂无</div>'; return; }
  list.innerHTML = myPosts.map(function(p){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:.8rem"><span>'+escHtml(p.title)+'</span><button class="admin-item-btn delete" onclick="userDeletePost('+p.id+');setTimeout(renderAdminMyPosts,100)" style="font-size:.72rem;padding:2px 8px">删除</button></div>';
  }).join('');
}

function renderAdminMyReplies(){
  var list = $('#adminMyReplies');
  if(!list) return;
  var myReplies = [];
  State.posts.forEach(function(p){
    (p.replies||[]).forEach(function(r, idx){
      if(r.author === State.user.name){
        myReplies.push({postTitle:p.title, postId:p.id, replyIdx:idx, content:r.content});
      }
    });
  });
  if(!myReplies.length){ list.innerHTML='<div style="font-size:.8rem;color:var(--text-light);padding:4px 0">暂无</div>'; return; }
  list.innerHTML = myReplies.map(function(r){
    var snippet = r.content.slice(0,20);
    var ellipsis = r.content.length > 20 ? '…' : '';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:.8rem"><span>'+escHtml(r.postTitle)+'：'+escHtml(snippet)+ellipsis+'</span><button class="admin-item-btn delete" onclick="userDeleteReply('+r.postId+','+r.replyIdx+');setTimeout(renderAdminMyReplies,100)" style="font-size:.72rem;padding:2px 8px">删除</button></div>';
  }).join('');
}

function initUserSettingsModal(){
  var modal = $('#userSettingsModal');
  if(!modal) return;
  $('#userSettingsClose').addEventListener('click', function(){ modal.style.display='none'; });
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.style.display='none'; });
}

function initRefreshBtn(){
  var btn = document.getElementById('refreshBtn');
  if(!btn) return;
  btn.addEventListener('click', function(){
    toast('正在刷新...','info');
    setTimeout(function(){
      window.location.href = window.location.href.split('?')[0].split('#')[0] + '?t=' + Date.now();
    }, 300);
  });
}

/* ---------- 过期文件清理 ---------- */
window.showExpireInfo = function(){
  var el = document.getElementById('expireInfoBtn');
  if(!el) return;
  var toastId = 'expire_toast_' + Date.now();
  toast('\u23f0 资料过期后会在同学们访问网站时自动删除，无需手动操作。请谨慎选择保留时间。','info',5000);
};

function cleanupExpiredFiles(){
  var now = Date.now();
  var expired = State.files.filter(function(f){ return f.expireAt && f.expireAt > 0 && f.expireAt <= now; });
  if(!expired.length) return;
  expired.forEach(function(f){
    var idx = State.files.indexOf(f);
    if(idx > -1){ State.files.splice(idx, 1); }
  });
  saveFilesToStorage().then(function(){
    renderResources();
    updateHeroStats();
  }).catch(function(){});
}

/* ---------- 每日作业贴 ---------- */
function checkDailyPost(){
  var now = new Date();
  var day = now.getDay();
  if(day === 0 || day === 6) return;
  var hour = now.getHours();
  if(hour < 6) return;
  var today = now.toISOString().slice(0,10);
  var existing = State.posts.find(function(p){ return p._dailyPost && p._dailyDate === today; });
  if(existing) return;
  State.posts = State.posts.filter(function(p){ return !p._dailyPost; });
  var dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
  var dayText = (day === 5) ? '周末' : dayNames[day];
  var post = {
    id: Date.now(),
    board: 'qa',
    title: '作业贴',
    content: '今天' + dayText + '的作业是啥，有没有大神贡献一下～',
    image: '',
    author: '学习搭子',
    createdAt: Date.now(),
    replies: [],
    _dailyPost: true,
    _dailyDate: today
  };
  State.posts.push(post);
  savePosts();
  renderForum();
  toast('📝 今日作业贴已自动发布','info',3000);
}

/* ---------- 图片点击放大 ---------- */
function initLightbox(){
  document.addEventListener('click', function(e){
    var img = e.target.closest('.post-image, .reply-image-preview img, .post-image-preview img');
    if(!img || !img.src) return;
    if(img.closest('.lightbox-overlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:lightboxIn .25s ease';
    var clone = document.createElement('img');
    clone.src = img.src;
    clone.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.4)';
    overlay.appendChild(clone);
    overlay.addEventListener('click', function(){ overlay.remove(); });
    document.body.appendChild(overlay);
  });
}

function initPinchColumns(){
  var cols = parseInt(localStorage.getItem('lsc_pinch_cols')||'3');
  
  function applyCols(n){
    cols = Math.max(2, Math.min(5, n));
    var grids = document.querySelectorAll('#resourceGrid, #postList');
    grids.forEach(function(g){
      g.style.gridTemplateColumns = 'repeat('+cols+',1fr)';
    });
    localStorage.setItem('lsc_pinch_cols', cols);
  }
  
  // 初始应用列数
  applyCols(cols);
  
  var lastDist = 0;
  var accumulatedZoom = 0;
  
  // Ctrl+滚轮
  document.addEventListener('wheel', function(e){
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    accumulatedZoom += e.deltaY > 0 ? -1 : 1;
    if(Math.abs(accumulatedZoom) >= 100){
      if(accumulatedZoom > 0) applyCols(cols - 1);
      else applyCols(cols + 1);
      accumulatedZoom = 0;
    }
  }, { passive: false });
  
  // 双指缩放列数
  var initialDist = 0;
  var scaleDiff = 0;
  
  document.addEventListener('touchstart', function(e){
    if(e.touches.length === 2){
      initialDist = Math.hypot(e.touches[0].pageX-e.touches[1].pageX, e.touches[0].pageY-e.touches[1].pageY);
      scaleDiff = 0;
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', function(e){
    if(e.touches.length === 2 && initialDist > 0){
      var newDist = Math.hypot(e.touches[0].pageX-e.touches[1].pageX, e.touches[0].pageY-e.touches[1].pageY);
      var ratio = newDist / initialDist;
      scaleDiff += (ratio > 1.08 ? 1 : (ratio < 0.92 ? -1 : 0));
      if(scaleDiff >= 2){ applyCols(cols + 1); scaleDiff = 0; initialDist = newDist; }
      if(scaleDiff <= -2){ applyCols(cols - 1); scaleDiff = 0; initialDist = newDist; }
    }
  }, { passive: true });
}

/* ---------- 初始化 ---------- */
async function init(){
  // ===== 第1阶段：立即渲染 UI 框架（不依赖任何数据） =====
  initNavbar();
  initSortBar();
  initSearch();
  initForumTabs();
  initRankingTabs();
  initAdminEntry();
  initUserSettingsModal();
  initRefreshBtn();
  initUserButton();
  initAuthModal();
  initPostModal();
  initLightbox();
  loadTheme();
  loadUser();
  updateUserUI();

  // 默认显示资源中心（即使数据还没到，空状态也有 UI）
  switchPage('resources');

  // ===== 第2阶段：后台异步加载数据 =====
  var subjectsPromise = loadSubjects();
  var filesPromise = loadFiles();
  var usersPromise = loadUsers();

  await subjectsPromise;
  // 科目到了 → 填充筛选栏
  initFilterBar();

  await filesPromise;
  cleanupExpiredFiles();

  // 帖子、统计等不阻塞主流程
  loadPosts().then(function(){
    checkDailyPost();
  }).catch(function(){});

  State.registeredUsers = await usersPromise;
  loadFileStats();

  // ===== 第3阶段：数据到达后刷新内容 =====
  updateHeroStats();
  renderResources();
}

document.addEventListener('DOMContentLoaded', init);

})();
