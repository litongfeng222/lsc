/* ===== 🧩 数据加载层 ===== */
// 首次从本地加载，之后从 GitHub API 同步（确保管理员修改立即生效）

const DataLoader = {
  _subjects: null,
  _files: null,

  // 获取科目列表
  async getSubjects() {
    if (this._subjects) return this._subjects;
    const res = await fetch('./data/subjects.json');
    const data = await res.json();
    this._subjects = data.subjects;
    return this._subjects;
  },

  // 获取文件列表（优先从GitHub加载）
  async getFiles() {
    // 尝试从 GitHub API 获取最新数据
    try {
      const token = localStorage.getItem('lsc_gh_token');
      if (token) {
        const res = await fetch('https://api.github.com/repos/litongfeng222/lsc/contents/data/files.json', {
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        const data = await res.json();
        if (data.content) {
          const decoded = decodeURIComponent(escape(atob(data.content)));
          const parsed = JSON.parse(decoded);
          this._files = parsed.files;
          return this._files;
        }
      }
    } catch(e) {
      // fallback: 从本地加载
    }

    // 没有token或失败时从本地加载
    if (this._files) return this._files;
    const res = await fetch('./data/files.json');
    const data = await res.json();
    this._files = data.files;
    return this._files;
  },

  // 清除缓存（管理员修改后调用）
  clearCache() {
    this._files = null;
  }
};
