/* ============================================================
 * 评审数据源（跨页共享）—— 评审列表 / 当前激活评审
 * ------------------------------------------------------------
 * · 同一时间只允许一个「激活」评审；全站顶部「当前评审」条与
 *   「评审列表」页均以此为准。
 * · localStorage: cnas_reviews_v1；变更派发 reviewchange。
 * ============================================================ */
window.REVIEW_STORE = (function () {
  'use strict';

  var K = 'cnas_reviews_v1';

  var SEED = [
    { id: 'CNAS-UNIQ-8078', name: '唯一编号评审 A', type: 'CNAS 初评', std: 'CL10:2020',
      period: '2024-08-15 ~ 2024-12-20', team: '陈主管', status: '进行中', progress: 0.54, done: 1, total: 185, active: true, created: '2024-08-15' },
    { id: 'CNAS-2026-0192', name: '日志历史档案', type: 'CNAS 初评', std: 'GB/T 37864', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2026-01-10' },
    { id: 'CNAS-2026-0183', name: '日志历史档案', type: 'CNAS 初评', std: 'GB/T 37864', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2026-01-08' },
    { id: 'CNAS-2026-0169', name: '日志历史档案', type: 'CNAS 初评', std: 'GB/T 37864', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2026-01-05' },
    { id: 'CNAS-2026-0152', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-12-28' },
    { id: 'CNAS-2026-0137', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-12-20' },
    { id: 'CNAS-2026-0127', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-12-12' },
    { id: 'CNAS-2026-0119', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-12-05' },
    { id: 'CNAS-2026-0113', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-11-30' },
    { id: 'CNAS-2026-0105', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-11-22' },
    { id: 'CNAS-2026-0098', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-11-15' },
    { id: 'CNAS-2026-0091', name: '日志历史档案', type: 'CNAS 初评', std: 'CL10:2020', period: '—', team: '—', status: '已归档', progress: 0, done: 0, total: 185, active: false, created: '2025-11-08' }
  ];

  function read() { try { var r = localStorage.getItem(K); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function write(a) { try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) { } }
  function emit() { try { window.dispatchEvent(new CustomEvent('reviewchange')); } catch (e) { } }

  function ensure() {
    var a = read();
    if (!a || !a.length) { a = JSON.parse(JSON.stringify(SEED)); write(a); }
    a.forEach(function (r) {
      if (!r.source) r.source = (r.id === 'CNAS-UNIQ-8078' ? '系统创建' : '历史上传');
      /* 历史上传档案只读：不可激活，状态固定「已归档」 */
      if (r.source === '历史上传') { r.active = false; r.status = '已归档'; }
    });
    return a;
  }

  var api = {
    all: function () { return ensure(); },
    active: function () { return ensure().filter(function (r) { return r.active; })[0] || null; },
    byId: function (id) { return ensure().filter(function (r) { return r.id === id; })[0] || null; },
    /* 设为激活：同一时间只保留一个；传 null 取消激活 */
    setActive: function (id) {
      var list = ensure().map(function (r) {
        r.active = (id != null && r.id === id);
        if (r.active) r.status = '进行中';
        return r;
      });
      write(list); emit();
      return api.active();
    },
    stats: function () {
      var all = ensure();
      return {
        total: all.length,
        active: api.active(),
        running: all.filter(function (r) { return r.status === '进行中'; }).length,
        archived: all.filter(function (r) { return r.status === '已归档'; }).length
      };
    },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } emit(); }
  };
  return api;
})();
