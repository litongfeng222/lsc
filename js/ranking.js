/* ===== 🏆 师大附·11班·学习小组 下载排行榜 ===== */

let rankingData = [];

async function showRanking() {
  const modal = document.getElementById('rankingModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const list = document.getElementById('rankingList');
  list.innerHTML = '<div style="text-align:center;padding:40px 0;opacity:0.6">⏳ 加载中...</div>';

  try {
    let files;
    const token = localStorage.getItem('lsc_gh_token');
    if (token) {
      const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      const data = await res.json();
      if (data.content) {
        const decoded = decodeURIComponent(escape(atob(data.content)));
        const parsed = JSON.parse(decoded);
        files = parsed.files || [];
      }
    }

    if (!files || files.length === 0) {
      files = window.allFiles || [];
    }

    const ranked = [...files].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

    if (ranked.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px 0;opacity:0.5">📭 暂无数据</div>';
      return;
    }

    const top = ranked.slice(0, 20);
    const medalEmoji = ['🥇', '🥈', '🥉'];

    list.innerHTML = top.map((file, i) => {
      const sub = (window.subjects || []).find(s => s.id === file.subject);
      const subName = sub ? sub.name : (file.subject || '资料');
      const bgLight = i < 3 ? `background:rgba(255,255,255,0.12);border-radius:10px;` : '';

      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;${bgLight}color:white">
        <div style="width:30px;text-align:center;flex-shrink:0;font-weight:700;font-size:${i<3?'20':'16'}px">
          ${i < 3 ? medalEmoji[i] : `<span style="opacity:0.5">#${i+1}</span>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
          <div style="font-size:11px;opacity:0.6">${subName}${file.uploader ? ' · 👤' + file.uploader : ''}</div>
        </div>
        <div style="flex-shrink:0;text-align:center;background:rgba(108,92,231,0.85);color:white;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">
          ⬇ ${file.downloads || 0}
        </div>
      </div>`;
    }).join('');

    if (ranked.length > 20) {
      list.innerHTML += `<div style="text-align:center;padding:10px;opacity:0.5;font-size:13px">... 共 ${ranked.length} 份资料</div>`;
    }

  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.7)">❌ 加载失败</div>';
    console.error('排行加载失败:', e);
  }
}

function closeRanking() {
  const modal = document.getElementById('rankingModal');
  if (modal) modal.classList.add('hidden');
}

// ===== ℹ️ 关于本站 =====
function showAbout() {
  const modal = document.getElementById('rankingModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const list = document.getElementById('rankingList');
  list.innerHTML = `
    <div style="text-align:center;padding:20px 8px;color:white">
      <div style="font-size:24px;margin-bottom:12px;font-weight:700">师大附·11班·学习小组</div>
      <div style="font-size:14px;opacity:0.7;margin-bottom:16px;line-height:1.6">
        由11班同学共建的学习资料共享平台<br>
        所有资料永久存储，人人可上传，人人可下载
      </div>
      <div style="font-size:12px;opacity:0.5;line-height:1.8">
        技术支持：GitHub Pages + 小艺Claw<br>
        维护：李同丰
      </div>
    </div>
  `;
}

function closeAbout() { closeRanking(); }
