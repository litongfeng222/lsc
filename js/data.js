/* ===== 🧩 数据加载层 ===== */
// 后续升级为API接口时，只需改这里，其他代码不动

const DataLoader = {
  // 缓存
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

  // 获取文件列表
  async getFiles() {
    if (this._files) return this._files;
    const res = await fetch('./data/files.json');
    const data = await res.json();
    this._files = data.files;
    return this._files;
  },

  // 🚀 未来扩展：从后端API获取
  // async getFiles() {
  //   const res = await fetch('/api/files');
  //   return res.json();
  // }
};
