/* ===== App Main Entry ===== */
(function(){
'use strict';

/* 震动反馈：按压触感（配合毛玻璃交互优化）。仅在支持 Vibration API、未开启系统“减弱动态”时生效，异常静默降级 */
function haptic(ms){
  var v = navigator.vibrate || navigator.webkitVibrate;
  if(!v) return;
  try{
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.call(navigator, ms || 8);
  }catch(e){}
}
/* 上传中震动：闹钟式“间隔不断缩短”的短阵，有节奏、不持续强震 */
var uploadVibe={timer:null,stop:false};
function startUploadVibe(){
  var v=navigator.vibrate||navigator.webkitVibrate;
  if(!v) return;
  stopUploadVibe();
  var gap=520;
  uploadVibe.stop=false;
  (function tick(){
    if(uploadVibe.stop) return;
    haptic(35);
    gap=Math.max(150,gap-45);
    uploadVibe.timer=setTimeout(tick,gap);
  })();
}
function stopUploadVibe(){
  uploadVibe.stop=true;
  if(uploadVibe.timer){clearTimeout(uploadVibe.timer);uploadVibe.timer=null;}
  try{ if(navigator.vibrate) navigator.vibrate(0); }catch(e){}
}
/* 上传进度条（视觉模拟、磨砂玻璃、带流光，非真实进度） */
var upProg={timer:null,pct:0};
function ensureUpProg(){
  var el=document.getElementById('uploadProgress');
  if(el) return el;
  el=document.createElement('div');el.id='uploadProgress';el.className='upload-progress';el.style.display='none';
  el.innerHTML='<div class="upload-progress-bar"><div class="upload-progress-fill" id="upProgFill"></div></div>'+
    '<div class="upload-progress-label"><span id="upProgText">正在上传文件…</span><span class="upload-progress-pct" id="upProgPct">0%</span></div>';
  var btn=document.getElementById('uploadSubmitBtn');
  (btn&&btn.parentNode?btn.parentNode:document.body).appendChild(el);
  return el;
}
function renderUpProg(){
  var f=document.getElementById('upProgFill'),p=document.getElementById('upProgPct');
  if(f) f.style.width=upProg.pct+'%';
  if(p) p.textContent=upProg.pct+'%';
}
function startUploadProgress(){
  stopUploadProgress();
  var el=ensureUpProg(); el.style.display='block';
  upProg.pct=Math.floor(Math.random()*6)+3;
  renderUpProg();
  upProg.timer=setInterval(function(){
    if(upProg.pct>=95){ clearInterval(upProg.timer); upProg.timer=null; return; }
    var left=95-upProg.pct;
    var inc=Math.max(1,Math.round(left/14)+(Math.random()*3|0));
    upProg.pct=Math.min(95,upProg.pct+inc);
    renderUpProg();
  },180);
}
function completeUploadProgress(){
  if(upProg.timer){clearInterval(upProg.timer);upProg.timer=null;}
  upProg.pct=100;renderUpProg();
  setTimeout(function(){var el=document.getElementById('uploadProgress');if(el)el.style.display='none';},900);
}
function stopUploadProgress(){
  if(upProg.timer){clearInterval(upProg.timer);upProg.timer=null;}
  var el=document.getElementById('uploadProgress');if(el)el.style.display='none';
}
/* 事件委托：对可点元素震动。pointerdown 提供按压即时感，click 兜底保证首次点击也震（个别内核首次 pointerdown 尚无 user activation） */
var HAPTIC_SEL='button, a[href], .hero-upload-btn, .nav-link, .post-card, .file-card, .file-info, .theme-btn, .forum-tab, .ranking-tab, .chart-bar-wrapper, .filter-tag, .sort-btn, .rank-item, .filter-toggle-btn, .btn-back-home, .admin-entry, .refresh-btn';
var lastVibe={el:null,t:0};
function hapticEl(t){ if(!t) return; haptic(t.closest('.hero-upload-btn') ? 80 : 45); }
function vibeDedup(t){
  var now=Date.now();
  if(lastVibe.el===t && now-lastVibe.t<600) return;
  lastVibe={el:t,t:now};
  hapticEl(t);
}
document.addEventListener('pointerdown', function(e){ var t=e.target&&e.target.closest?e.target.closest(HAPTIC_SEL):null; if(t) vibeDedup(t); }, {passive:true});
document.addEventListener('click', function(e){ var t=e.target&&e.target.closest?e.target.closest(HAPTIC_SEL):null; if(t) vibeDedup(t); }, false);

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
  }catch(e){ console.error('loadAdminData error', e); }
};

/* ---------- 全局状态 ---------- */
const State = {
  subjects: [],
  files: [],
  registeredUsers: [],
  currentSort: 'downloads',
  currentFilter: 'all',
  searchQuery: '',
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
      toggle.classList.remove('active');
      menu.classList.remove('open');
      // “设置”菜单项复用右下角设置按钮的功能(管理员面板/个人设置智能路由)
      if(link.id === 'navSettingsItem'){
        var ae = document.getElementById('adminEntry');
        if(ae) ae.click();
        return;
      }
      const page = link.dataset.page;
      switchPage(page);
    });
  });
}

function switchPage(page){
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  $$('.page-section').forEach(s => s.style.display = (s.id === page) ? '' : 'none');
  if(page === 'resources') renderResources();
  if(page === 'ranking') renderRanking();
  if(page === 'upload'){
    initUploadSelect();
    // 自动上滚：让 hero 蓝块滚出屏幕，dock栏(导航栏)下沿对齐 hero 下沿，省去手动滑动一步
    requestAnimationFrame(()=>{
      const hero = document.getElementById('home');
      if(!hero) return;
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
      const navH = parseFloat(raw) || 60;
      const target = Math.max(0, (hero.getBoundingClientRect().bottom + window.pageYOffset) - navH);
      window.scrollTo({top:target, behavior:'smooth'});
    });
  } else {
    window.scrollTo({top:0, behavior:'smooth'});
  }
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
  // 筛选弹窗中的科目标签
  const popupTags = $('#filterPopupTags');
  if(!popupTags) return;
  popupTags.innerHTML = '';
  
  const allTag = document.createElement('button');
  allTag.className = 'filter-tag active';
  allTag.textContent = '全部';
  allTag.dataset.subject = 'all';
  allTag.addEventListener('click', ()=>{ State.currentFilter='all'; updateFilterUI(); renderResources(); });
  popupTags.appendChild(allTag);

  State.subjects.forEach(sub => {
    const tag = document.createElement('button');
    tag.className = 'filter-tag';
    tag.textContent = sub.name;
    tag.dataset.subject = sub.id;
    tag.style.setProperty('--card-color', sub.color);
    tag.addEventListener('click', ()=>{ State.currentFilter=sub.id; updateFilterUI(); renderResources(); });
    popupTags.appendChild(tag);
  });

  // 筛选按钮点击切换弹窗
  const toggleBtn = $('#filterToggleBtn');
  const popup = $('#filterPopup');
  if(toggleBtn && popup){
    toggleBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      var isOpen = popup.style.display !== 'none';
      popup.style.display = isOpen ? 'none' : '';
      toggleBtn.classList.toggle('active', !isOpen);
    });
    // 点击外部关闭弹窗
    document.addEventListener('click', (e)=>{
      if(!popup.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)){
        popup.style.display = 'none';
        toggleBtn.classList.remove('active');
      }
    });
  }

  // 排序按钮（在弹窗内）
  var sortBtns = $$('#filterPopupSort .sort-btn');
  sortBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      State.currentSort = this.dataset.sort;
      sortBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
      renderResources();
    });
  });
}

function updateFilterUI(){
  $$('#filterPopupTags .filter-tag').forEach(t => t.classList.toggle('active', t.dataset.subject === State.currentFilter));
  // 更新筛选按钮文字
  var btn = $('#filterToggleBtn');
  if(btn){
    var sub = State.subjects.find(function(s){ return s.id === State.currentFilter; });
    if(State.currentFilter === 'all'){
      btn.querySelector('span:last-child').textContent = '筛选';
    } else if(sub){
      btn.querySelector('span:last-child').textContent = sub.name;
    }
  }
}

function initSortBar(){
  // 初始设置弹窗中的排序按钮状态
  var sortBtns = $$('#filterPopupSort .sort-btn');
  sortBtns.forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.sort === State.currentSort);
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
    '<div class="form-group"><label class="expire-label"><span class="expire-label-text">保留时间 <span class="required">*</span></span><span class="info-icon" id="expireInfoBtn" onclick="showExpireInfo()" title="了解详情">？</span></label><input type="datetime-local" id="uploadExpire" required></div>'+
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
  startUploadVibe();
  startUploadProgress();
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
    stopUploadVibe();
    completeUploadProgress();
    toast('上传成功！资料已共享给同学们 ✅','success',3000);
    document.getElementById('uploadForm').reset();
    document.getElementById('uploadFileHint').textContent='支持 PDF/DOCX/PPTX/XLSX/图片等，不超过25MB';
    document.getElementById('uploaderName').value=State.user.name;
    updateHeroStats();renderResources();
  }catch(err){ stopUploadVibe(); stopUploadProgress(); toast('上传失败：'+err.message,'error',5000); }
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

/* ---------- 主题色系统（整站换肤） ---------- */
function hexToRgb(hex){
  var v = String(hex||'').replace('#','');
  if(v.length!==6) return '110,143,224';
  return parseInt(v.substr(0,2),16)+','+parseInt(v.substr(2,2),16)+','+parseInt(v.substr(4,2),16);
}
/* 每个主题 = {主色系 + 背景/卡片/文字/边框 + 深色模式全套} */
const THEMES = [
  {
    name:'马卡龙粉彩', primary:'#6E8FE0', primaryDark:'#5A6FC8', primaryLight:'#AEC3F2',
    bg:'#FBF6F2', bgCard:'#FFFFFF', text:'#3A3440', textSecondary:'#7B7486', textLight:'#B3ACBC', border:'#F1E4E6',
    darkPrimary:'#98B7F0', darkPrimaryDark:'#6E8FD8', darkPrimaryLight:'#C3D4F6',
    darkBg:'#1E1C24', darkBgCard:'#2B2833', darkText:'#F2EFF4', darkTextSecondary:'#B7B0C2', darkTextLight:'#7E788A', darkBorder:'#3E3A48'
  },
  {
    name:'樱花粉', primary:'#E08FB0', primaryDark:'#C76E8F', primaryLight:'#F2BAD0',
    bg:'#FFF7F9', bgCard:'#FFFFFF', text:'#4A3540', textSecondary:'#8A7480', textLight:'#BCA9B2', border:'#F8E3E8',
    darkPrimary:'#F0A8C2', darkPrimaryDark:'#D983A0', darkPrimaryLight:'#F6C6DA',
    darkBg:'#251C21', darkBgCard:'#332830', darkText:'#F6EEF2', darkTextSecondary:'#C0AEB8', darkTextLight:'#8A7A85', darkBorder:'#4A3A44'
  },
  {
    name:'薄荷绿', primary:'#5FBF9C', primaryDark:'#3FA182', primaryLight:'#9AD9C2',
    bg:'#F2FBF7', bgCard:'#FFFFFF', text:'#2F4038', textSecondary:'#6E847A', textLight:'#A3B8AF', border:'#E1F1EA',
    darkPrimary:'#6FD4AE', darkPrimaryDark:'#4AAE8C', darkPrimaryLight:'#A5E2C8',
    darkBg:'#16211C', darkBgCard:'#22302A', darkText:'#EAF4EF', darkTextSecondary:'#AEC8BC', darkTextLight:'#71897E', darkBorder:'#38493F'
  },
  {
    name:'暖阳橙', primary:'#F0A55E', primaryDark:'#D98A3E', primaryLight:'#F7C490',
    bg:'#FFF9F0', bgCard:'#FFFFFF', text:'#46382B', textSecondary:'#8A7A6A', textLight:'#BCAE9E', border:'#F8EBDA',
    darkPrimary:'#F5B478', darkPrimaryDark:'#E0914B', darkPrimaryLight:'#F8D0A8',
    darkBg:'#251D15', darkBgCard:'#342B1F', darkText:'#F6F0E8', darkTextSecondary:'#C2B49C', darkTextLight:'#8A7E6E', darkBorder:'#4B4033'
  },
  {
    name:'梦幻紫', primary:'#A58FE0', primaryDark:'#896EDD', primaryLight:'#C9BCF2',
    bg:'#FAF7FE', bgCard:'#FFFFFF', text:'#3A3250', textSecondary:'#7B7396', textLight:'#B3ACC9', border:'#EDE6F8',
    darkPrimary:'#B8A6F0', darkPrimaryDark:'#9A7DE0', darkPrimaryLight:'#D3C6F6',
    darkBg:'#201C28', darkBgCard:'#2E2936', darkText:'#F2EFF8', darkTextSecondary:'#BAB2D0', darkTextLight:'#7F769A', darkBorder:'#423B52'
  },
  {
    name:'石墨黑', primary:'#6B7280', primaryDark:'#4B5563', primaryLight:'#9CA3AF',
    bg:'#F5F5F6', bgCard:'#FFFFFF', text:'#1F2937', textSecondary:'#6B7280', textLight:'#9CA3AF', border:'#E5E7EB',
    darkPrimary:'#9CA3AF', darkPrimaryDark:'#6B7280', darkPrimaryLight:'#B6BCC6',
    darkBg:'#111318', darkBgCard:'#1C1F27', darkText:'#F3F4F6', darkTextSecondary:'#9CA3AF', darkTextLight:'#6B7280', darkBorder:'#2E323B'
  }
];

function applyTheme(t){
  if(!t) return;
  var r = document.documentElement;
  var set = function(n,v){ if(v) r.style.setProperty(n,v); };
  /* 浅色组 */
  set('--skin-primary', t.primary);
  set('--skin-primary-dark', t.primaryDark);
  set('--skin-primary-light', t.primaryLight);
  r.style.setProperty('--skin-primary-rgb', hexToRgb(t.primary));
  set('--skin-bg', t.bg);
  set('--skin-bg-card', t.bgCard);
  set('--skin-text', t.text);
  set('--skin-text2', t.textSecondary);
  set('--skin-text3', t.textLight);
  set('--skin-border', t.border);
  /* 深色组 */
  set('--skin-primary-d', t.darkPrimary);
  set('--skin-primary-dark-d', t.darkPrimaryDark);
  set('--skin-primary-light-d', t.darkPrimaryLight);
  r.style.setProperty('--skin-primary-rgb-d', hexToRgb(t.darkPrimary));
  set('--skin-bg-d', t.darkBg);
  set('--skin-bg-card-d', t.darkBgCard);
  set('--skin-text-d', t.darkText);
  set('--skin-text2-d', t.darkTextSecondary);
  set('--skin-text3-d', t.darkTextLight);
  set('--skin-border-d', t.darkBorder);
}

function loadTheme(){
  if(!State.user) return;
  var saved = localStorage.getItem('lsc_theme_'+State.user.phone);
  if(saved){
    try{ var t = JSON.parse(saved); applyTheme(t); }catch(e){}
  }
}

function saveTheme(theme){
  if(!State.user) return;
  localStorage.setItem('lsc_theme_'+State.user.phone, JSON.stringify(theme));
  applyTheme(theme);
  toast('🎨 主题已切换','success');
}

/* ---------- 个人设置面板 ---------- */
function openUserSettings(){
  $('#userSettingsModal').style.display='flex';
  renderThemePicker();
  renderMyFiles();
}

function renderThemePicker(){
  var picker = $('#themePicker');
  if(!picker) return;
  var current = JSON.parse(localStorage.getItem('lsc_theme_'+State.user.phone)||'{}');
  var defaultPrimary = current.primary || '#6E8FE0';
  picker.innerHTML = THEMES.map(function(t,idx){
    var active = t.primary === defaultPrimary ? ' active' : '';
    return '<button class="theme-btn'+active+'" onclick="selectTheme('+idx+',this)" style="background:'+t.primary+';color:#fff">'+t.name+'</button>';
  }).join('');
}

window.selectTheme = function(idx, btn){
  var t = THEMES[idx];
  if(!t) return;
  $$('.theme-btn').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  saveTheme(t);
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
      renderAdminFiles(); renderAdminUsers();
      renderAdminThemePicker(); renderAdminMyFiles();
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


/* ---------- 管理员面板个人设置 ---------- */
function renderAdminThemePicker(){
  var picker = $('#adminThemePicker');
  if(!picker) return;
  var current = JSON.parse(localStorage.getItem('lsc_theme_'+State.user.phone)||'{}');
  var defaultPrimary = current.primary || '#6E8FE0';
  picker.innerHTML = THEMES.map(function(t,idx){
    var active = t.primary === defaultPrimary ? ' active' : '';
    return '<button class="theme-btn'+active+'" onclick="selectTheme('+idx+',this)" style="background:'+t.primary+';color:#fff">'+t.name+'</button>';
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



function initUserSettingsModal(){
  var modal = $('#userSettingsModal');
  if(!modal) return;
  $('#userSettingsClose').addEventListener('click', function(){ modal.style.display='none'; });
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.style.display='none'; });
}

function initRefreshBtn(){
  var btn = document.getElementById('refreshBtn');
  var doRefresh = function(){
    toast('正在刷新...','info');
    setTimeout(function(){
      window.location.href = window.location.href.split('?')[0].split('#')[0] + '?t=' + Date.now();
    }, 300);
  };
  if(btn) btn.addEventListener('click', doRefresh);
  // 进入页面时自动刷新一次：仅当 URL 未带 t 参数且本会话还没自动刷过，避免死循环
  if(location.search.indexOf('t=') === -1 && !sessionStorage.getItem('lsc_auto_refreshed')){
    sessionStorage.setItem('lsc_auto_refreshed','1');
    doRefresh();
  }
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


function initPinchColumns(){
  var cols = parseInt(localStorage.getItem('lsc_pinch_cols')||'3');
  
  function applyCols(n){
    cols = Math.max(2, Math.min(5, n));
    var grids = document.querySelectorAll('#resourceGrid');
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
  initRankingTabs();
  initAdminEntry();
  initUserSettingsModal();
  initRefreshBtn();
  initUserButton();
  initAuthModal();
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


  State.registeredUsers = await usersPromise;
  loadFileStats();

  // ===== 第3阶段：数据到达后刷新内容 =====
  updateHeroStats();
  renderResources();
}

document.addEventListener('DOMContentLoaded', init);

})();
