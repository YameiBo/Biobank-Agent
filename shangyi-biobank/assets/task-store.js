/* ============================================================
 * 任务分配 · 单一数据源（迎检筹备 ↔ 事件管控中心 打通）
 * ------------------------------------------------------------
 * 「任务分配」页与「事件管控中心」共用这里的数据：
 *   - 任务分配页首屏渲染条款任务台账（未开始 / 进行中 / 已完成）；
 *   - 事件管控中心以「事项 / 人」两个维度聚合本数据源 + 事件流；
 *   - 任一页更新任务阶段，另一页监听 taskchange 即时刷新。
 * 与 roles.js / rule-store.js 分工：roles.js 管「谁能做」，
 * rule-store.js 管「有什么规则」，本文件管「有哪些迎检事项及其状态」。
 * 加载顺序：在页面脚本之前即可（建议紧跟 roles.js）。
 * ============================================================ */
window.TASK_STORE = (function () {
  'use strict';

  const K = 'cnas_tasks_v1';
  const STAGES = ['未开始', '进行中', '已完成'];

  /* ---------- 种子任务（内置，不随清除 localStorage 消失） ---------- */
  const SEED = [
    { code: '4.1', name: '公正性',           cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-01', due: '2026-11-30', stage: '已完成', progress: 100, clause: '4.1' },
    { code: '4.2', name: '保密性',           cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-01', due: '2026-11-30', stage: '进行中', progress: 60,  clause: '4.2' },
    { code: '6.4', name: '设备',             cat: '技术', dept: '设备设施部', owner: '孙七',   assessor: '未分配', reviewer: '陈主管', start: '2026-11-01', due: '2026-12-25', stage: '进行中', progress: 35,  clause: '6.4' },
    { code: '6.5', name: '计量溯源性',       cat: '技术', dept: '设备设施部', owner: '未分配', assessor: '未分配', reviewer: '陈主管', start: '2026-11-01', due: '2026-12-30', stage: '未开始', progress: 0,   clause: '6.5' },
    { code: '7.2', name: '抽样',             cat: '技术', dept: '检测技术部', owner: '未分配', assessor: '未分配', reviewer: '陈主管', start: '2026-11-01', due: '2027-01-05', stage: '未开始', progress: 0,   clause: '7.2' },

    { code: '4.3', name: '文件控制',                 cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-05', due: '2026-11-15', stage: '已完成', progress: 100, clause: '4.3' },
    { code: '4.4', name: '记录控制',                 cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-05', due: '2026-11-18', stage: '进行中', progress: 70,  clause: '4.4' },
    { code: '4.5', name: '风险与机遇',               cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-06', due: '2026-11-20', stage: '进行中', progress: 45,  clause: '4.5' },
    { code: '4.6', name: '改进',                     cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-06', due: '2026-11-22', stage: '未开始', progress: 0,   clause: '4.6' },
    { code: '5.1', name: '人员',                     cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-08', due: '2026-11-25', stage: '已完成', progress: 100, clause: '5.1' },
    { code: '5.2', name: '设施与环境',               cat: '技术', dept: '设备设施部', owner: '孙七',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-08', due: '2026-11-28', stage: '进行中', progress: 50,  clause: '5.2' },
    { code: '5.3', name: '设备',                     cat: '技术', dept: '设备设施部', owner: '孙七',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-10', due: '2026-11-30', stage: '进行中', progress: 80,  clause: '5.3' },
    { code: '5.4', name: '计量溯源性',               cat: '技术', dept: '设备设施部', owner: '孙七',   assessor: '未分配', reviewer: '陈主管', start: '2026-10-10', due: '2026-12-02', stage: '未开始', progress: 0,   clause: '5.4' },
    { code: '5.5', name: '外部提供的产品和服务',     cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-12', due: '2026-12-05', stage: '进行中', progress: 40,  clause: '5.5' },
    { code: '6.1', name: '总则',                     cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-12', due: '2026-12-06', stage: '未开始', progress: 0,   clause: '6.1' },
    { code: '6.2', name: '人员',                     cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-15', due: '2026-12-08', stage: '进行中', progress: 25,  clause: '6.2' },
    { code: '6.3', name: '设施和环境条件',           cat: '技术', dept: '设备设施部', owner: '孙七',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-15', due: '2026-12-10', stage: '已完成', progress: 100, clause: '6.3' },
    { code: '6.6', name: '合同评审',                 cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-18', due: '2026-12-12', stage: '未开始', progress: 0,   clause: '6.6' },
    { code: '6.7', name: '采购',                     cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-18', due: '2026-12-15', stage: '未开始', progress: 0,   clause: '6.7' },
    { code: '7.1', name: '要求标书合同评审',         cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-20', due: '2026-12-16', stage: '进行中', progress: 55,  clause: '7.1' },
    { code: '7.3', name: '样品处置',                 cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-20', due: '2026-12-18', stage: '进行中', progress: 65,  clause: '7.3' },
    { code: '7.4', name: '技术记录',                 cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-22', due: '2026-12-20', stage: '已完成', progress: 100, clause: '7.4' },
    { code: '7.5', name: '测量不确定度',             cat: '技术', dept: '检测技术部', owner: '未分配', assessor: '未分配', reviewer: '陈主管', start: '2026-10-22', due: '2026-12-22', stage: '未开始', progress: 0,   clause: '7.5' },
    { code: '7.6', name: '结果有效性',               cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-25', due: '2026-12-24', stage: '进行中', progress: 30,  clause: '7.6' },
    { code: '7.7', name: '报告结果',                 cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-25', due: '2026-12-26', stage: '未开始', progress: 0,   clause: '7.7' },
    { code: '7.8', name: '结果报告',                 cat: '技术', dept: '检测技术部', owner: '周八',   assessor: '郑十',   reviewer: '陈主管', start: '2026-10-28', due: '2026-12-28', stage: '已完成', progress: 100, clause: '7.8' },
    { code: '8.1', name: '选项',                     cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-28', due: '2026-12-29', stage: '未开始', progress: 0,   clause: '8.1' },
    { code: '8.2', name: '管理体系文件',             cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '王五',   reviewer: '陈主管', start: '2026-10-30', due: '2026-12-30', stage: '进行中', progress: 20,  clause: '8.2' },
    { code: '8.3', name: '管理体系更改',             cat: '管理', dept: '质量管理部', owner: '张三',   assessor: '李四',   reviewer: '陈主管', start: '2026-10-30', due: '2027-01-02', stage: '未开始', progress: 0,   clause: '8.3' },
    { code: '8.4', name: '记录控制',                 cat: '管理', dept: '质量管理部', owner: '赵六',   assessor: '王五',   reviewer: '陈主管', start: '2026-11-01', due: '2027-01-05', stage: '未开始', progress: 0,   clause: '8.4' }
  ];

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }
  function blank() { return { ov: {}, extra: [] }; }
  function emit(code) {
    try { window.dispatchEvent(new CustomEvent('taskchange', { detail: { code: code } })); } catch (e) { }
  }

  function applyOv(t, ov) {
    const o = ov[t.code];
    if (!o) return t;
    return Object.assign({}, t, o, { code: t.code });
  }

  const api = {
    SEED: SEED,
    STAGES: STAGES,

    /** 全部任务：本机新增在前，其次内置种子（含阶段 / 进度覆盖） */
    all: function () {
      const patch = read(K, blank()) || blank();
      const ov = patch.ov || {};
      const extra = Array.isArray(patch.extra) ? patch.extra : [];
      return extra.concat(SEED.map(function (t) { return applyOv(t, ov); }));
    },
    byCode: function (code) {
      return api.all().filter(function (t) { return t.code === code; })[0] || null;
    },
    /** 阶段推进：同步进度（未开始 0 / 已完成 100 / 进行中保留原进度或 50） */
    setStage: function (code, stage, note) {
      if (STAGES.indexOf(stage) < 0) return null;
      const cur = api.byCode(code);
      if (!cur) return null;
      let progress = cur.progress;
      if (stage === '未开始') progress = 0;
      else if (stage === '已完成') progress = 100;
      else if (!progress || progress >= 100) progress = 50;
      const patch = read(K, blank()) || blank();
      patch.ov = patch.ov || {};
      const prev = patch.ov[code] || {};
      const log = (prev.log || []).concat([{ t: '阶段变更', who: '当前用户', time: nowStr(), note: (note || (cur.stage + ' → ' + stage)) }]);
      patch.ov[code] = Object.assign({}, prev, { stage: stage, progress: progress, log: log });
      patch.extra = (patch.extra || []).map(function (t) { return t.code === code ? Object.assign({}, t, { stage: stage, progress: progress }) : t; });
      write(K, patch);
      emit(code);
      return stage;
    },
    update: function (code, next) {
      const patch = read(K, blank()) || blank();
      patch.ov = patch.ov || {};
      patch.ov[code] = Object.assign({}, patch.ov[code] || {}, next);
      patch.extra = (patch.extra || []).map(function (t) { return t.code === code ? Object.assign({}, t, next) : t; });
      write(K, patch);
      emit(code);
    },
    add: function (task) {
      const patch = read(K, blank()) || blank();
      patch.extra = patch.extra || [];
      patch.extra.unshift(task);
      write(K, patch);
      emit(task.code);
      return task;
    },
    /** 统计：阶段分布 + 按人 / 按部门聚合 */
    stats: function () {
      const all = api.all();
      const st = { total: all.length, '未开始': 0, '进行中': 0, '已完成': 0 };
      const byOwner = {}, byDept = {};
      all.forEach(function (t) {
        st[t.stage] = (st[t.stage] || 0) + 1;
        const o = (t.owner && t.owner !== '未分配') ? t.owner : '未分配';
        byOwner[o] = byOwner[o] || { name: o, total: 0, '未开始': 0, '进行中': 0, '已完成': 0 };
        byOwner[o].total++; byOwner[o][t.stage]++;
        byDept[t.dept] = byDept[t.dept] || { name: t.dept, total: 0, '未开始': 0, '进行中': 0, '已完成': 0 };
        byDept[t.dept].total++; byDept[t.dept][t.stage]++;
      });
      return { stage: st, byOwner: byOwner, byDept: byDept };
    },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } }
  };

  function nowStr() {
    const d = new Date();
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  return api;
})();
