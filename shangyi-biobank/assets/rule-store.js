/* ============================================================
 * 规则库 单一数据源 —— 规则列表 / 版本 / 模板（演示用）
 * ------------------------------------------------------------
 * 规则库页与「新建 / 编辑规则」页共用这里的数据：
 *   - 规则库页首屏渲染「规则列表」（SEED + 本机新增）；
 *   - 新建 / 编辑规则页保存后写入 localStorage，规则库页即时可见。
 * 与 roles.js 分工：roles.js 管「谁能做」，本文件管「有什么规则」。
 * 加载顺序：在 assets/app.js 之前或之后均可，但必须在页面脚本之前。
 * ============================================================ */
window.RULE_STORE = (function () {
  'use strict';

  const K = 'cnas_rules_v1';

  /* ---------- 种子规则（内置，不随清除 localStorage 消失） ---------- */
  const SEED = [
    {
      id: 'calib', name: '设备校准到期预警', ver: 'v2.1', on: true,
      trigger: '定时触发（每日 08:00）', freq: '365 次', last: '12-01 08:00',
      conds: [{ field: '校准到期日', op: '≤', val: '30天', join: 'AND' }],
      acts: [{ act: '发送通知', who: '设备负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 设备校准到期日 ≤ 30天 → 发送系统通知设备负责人 + 生成预警事件'
    },
    {
      id: 'ncr', name: '不符合项超期告警', ver: 'v1.3', on: true,
      trigger: '定时触发（每日 09:00）', freq: '48 次', last: '12-01 09:00',
      conds: [{ field: '整改截止日', op: '≤', val: '今天', join: 'AND' },
              { field: '事件状态', op: '≠', val: '已关闭', join: 'AND' }],
      acts: [{ act: '发送通知', who: '质量负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '升级' }],
      expr: 'IF NCR 整改截止日期已过期且状态未关闭 → 发送告警至质量负责人 + 升级处理级别'
    },
    {
      id: 'intake', name: '样本入库质量检查', ver: 'v3.0', on: true,
      trigger: '样本接收事件触发', freq: '1240 次', last: '12-01 11:32',
      conds: [{ field: '储存温度', op: '≤', val: '-60℃', join: 'OR' },
              { field: '样本编号', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '入库流程', how: '拒绝入库' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 样本温度超出可接受范围 OR 标识信息不完整 → 拒绝入库 + 生成质量异常记录 + 通知采集方'
    },
    {
      id: 'archive', name: '文件版本自动归档', ver: 'v1.1', on: true,
      trigger: '文件更新事件触发', freq: '89 次', last: '11-28 16:15',
      conds: [{ field: '文件状态', op: '=', val: '已审批', join: 'AND' }],
      acts: [{ act: '写入日志', who: '操作日志', how: '触发日志' },
             { act: '发送通知', who: '文件持有人', how: '系统通知' }],
      expr: 'IF 文件状态变更为「已审批」 → 旧版本标记为「已废止」 + 发送变更通知给相关人员'
    },
    {
      id: 'ln2', name: '液氮液位低告警', ver: 'v1.0', on: false,
      trigger: '传感器数据触发', freq: '12 次', last: '09-20 03:14',
      conds: [{ field: '液氮液位', op: '≤', val: '30%', join: 'AND' }],
      acts: [{ act: '发送通知', who: '样本管理员', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 液氮液位 < 30% → 立即发送系统通知至储存管理员 + 触发补液流程'
    }
  ];

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }

  const api = {
    SEED: SEED,

    /** 全部规则：本机新增的排在前面，其次内置种子（含启停覆盖） */
    all: function () {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      const extra = Array.isArray(patch.extra) ? patch.extra : [];
      const off = Array.isArray(patch.off) ? patch.off : [];
      const on = Array.isArray(patch.on) ? patch.on : [];
      const seed = SEED.map(function (r) {
        const copy = JSON.parse(JSON.stringify(r));
        if (off.indexOf(r.id) >= 0) copy.on = false;
        if (on.indexOf(r.id) >= 0) copy.on = true;
        return copy;
      });
      return extra.concat(seed);
    },
    byId: function (id) {
      return api.all().filter(function (r) { return r.id === id; })[0] || null;
    },
    /** 新增（新建 / 套用模板 / 由编排页保存） */
    add: function (rule) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = patch.extra || [];
      patch.extra.unshift(rule);
      write(K, patch);
      return rule;
    },
    /** 更新已有规则的编排内容（编辑页保存） */
    update: function (id, next) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = patch.extra || [];
      const i = patch.extra.map(function (r) { return r.id; }).indexOf(id);
      if (i >= 0) { patch.extra[i] = Object.assign({}, patch.extra[i], next); write(K, patch); return; }
      const seed = SEED.filter(function (r) { return r.id === id; })[0];
      if (seed) { patch.extra.unshift(Object.assign({}, seed, next, { id: id })); write(K, patch); }
    },
    /** 启停切换（内置与新增都记录覆盖） */
    toggle: function (id) {
      const cur = api.byId(id);
      if (!cur) return null;
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.off = patch.off || []; patch.on = patch.on || [];
      const next = !cur.on;
      ['off', 'on'].forEach(function (k) { const i = patch[k].indexOf(id); if (i >= 0) patch[k].splice(i, 1); });
      patch[k_helper(next)].push(id);
      // 新增规则直接改自身 on
      patch.extra = (patch.extra || []).map(function (r) { return r.id === id ? Object.assign({}, r, { on: next }) : r; });
      write(K, patch);
      return next;
    },
    remove: function (id) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = (patch.extra || []).filter(function (r) { return r.id !== id; });
      patch.off = (patch.off || []).filter(function (x) { return x !== id; });
      patch.on = (patch.on || []).filter(function (x) { return x !== id; });
      write(K, patch);
    },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } }
  };

  function k_helper(next) { return next ? 'on' : 'off'; }

  return api;
})();
