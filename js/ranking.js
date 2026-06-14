/* ===== 🏆 LSCgroup 下载排行榜 ===== */

// 全局数据（从 app.js 获取）
let rankingData = [];

// 显示排行榜
async function showRanking() {
  const modal = document.getElementById('rankingModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const list = document.getElementById('rankingList');
  list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999">⏳ 加载中...</div>';

  try {
    // 从 GitHub API 获取最新 files.json（含下载量）
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

    // fallback: 从本地加载（如果有内存数据）
    if (!files || files.length === 0) {
      files = window.allFiles || [];
    }

    // 按下载量排序
    const ranked = [...files].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

    if (ranked.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999">📭 暂无数据</div>';
      return;
    }

    // 科目 emoji 映射
    const subjects = window.subjects || [];
    function getSubInfo(subId) {
      const s = subjects.find(x => x.id === subId);
      return s ? { emoji: s.emoji, color: s.color, name: s.name } : { emoji: '📄', color: '#636e72', name: subId };
    }

    // 取前20名
    const top = ranked.slice(0, 20);

    const medalEmoji = ['🥇', '🥈', '🥉'];

    list.innerHTML = top.map((file, i) => {
      const sub = getSubInfo(file.subject);
      const rankStyle = i < 3 ? `background:${['#fff2c2','#f0f0f0','#ffe0cc'][i]};border-radius:10px;padding:6px 0` : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;${rankStyle}">
        <div style="width:30px;text-align:center;flex-shrink:0;font-weight:700;font-size:${i<3?'20':'16'}px">
          ${i < 3 ? medalEmoji[i] : `#${i+1}`}
        </div>
        <div style="font-size:20px;flex-shrink:0">${sub.emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
          <div style="font-size:11px;color:#999">${sub.name} · ${file.uploader ? '👤'+file.uploader : ''}</div>
        </div>
        <div style="flex-shrink:0;text-align:center;background:#6c5ce7;color:white;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">
          ⬇ ${file.downloads || 0}
        </div>
      </div>`;
    }).join('');

    if (ranked.length > 20) {
      list.innerHTML += `<div style="text-align:center;padding:10px;color:#999;font-size:13px">... 共 ${ranked.length} 份资料</div>`;
    }

  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#e74c3c">❌ 加载失败</div>';
    console.error('排行加载失败:', e);
  }
}

// 关闭排行榜
function closeRanking() {
  const modal = document.getElementById('rankingModal');
  if (modal) modal.classList.add('hidden');
}
