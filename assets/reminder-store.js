/* ============================================================
 * 提醒数据源（跨页共享）—— 右上角小铃铛 / 事件管控中心「我的提醒事项」
 * ------------------------------------------------------------
 * localStorage: cnas_reminders_v1；变更派发 reminderchange。
 * ============================================================ */
window.REMINDER_STORE = (function () {
  'use strict';

  var K = 'cnas_reminders_v1';

  var SEED = [
    { id: 'RM001', title: '设备校准到期预警', type: '设备', owner: '设备负责人', time: '2024-12-20 08:00', level: 'warning',  read: false, desc: '离心机、-80℃冰箱等 5 台设备校准将在 30 天内到期，请安排送检' },
    { id: 'RM002', title: '液氮液位低告警',   type: '设备', owner: '样本管理员', time: '2024-12-01 02:14', level: 'critical', read: false, desc: '液氮罐液位低于 30%，请尽快补液' },
    { id: 'RM003', title: '样本储存温度异常', type: '质控', owner: '储存管理员', time: '2024-12-01 02:14', level: 'critical', read: false, desc: '储存温度超出 -80℃±2℃ 阈值' },
    { id: 'RM004', title: '评审日程临近',     type: '评审', owner: '质量管理员', time: '2024-11-25 09:00', level: 'info',     read: false, desc: 'CNAS 现场评审将于 12-20 进行，距评审 25 天' },
    { id: 'RM005', title: '任务截止提醒',     type: '任务', owner: '张三',       time: '2024-11-20 08:00', level: 'warning',  read: false, desc: '条款 5.2 生物样本库结构 自评任务将于 12-15 截止' },
    { id: 'RM006', title: '条款自评截止',     type: '任务', owner: '李四',       time: '2024-11-18 08:00', level: 'warning',  read: true,  desc: '6.1 总则（资源）自评 11-30 截止' },
    { id: 'RM007', title: '报告待签发',       type: '报告', owner: '质量主管',   time: '2024-11-16 15:30', level: 'info',     read: true,  desc: '2024 年度内部审核报告等待签发' },
    { id: 'RM008', title: '材料待归档',       type: '材料', owner: '文件管理员', time: '2024-11-15 10:00', level: 'info',     read: true,  desc: '3 份校准记录待归档到对应条款' },
    { id: 'RM009', title: '权限变更待签发',   type: '权限', owner: '样本库主任', time: '2024-11-12 14:20', level: 'warning',  read: true,  desc: '角色权限变更申请等待主任签发' },
    { id: 'RM010', title: '数据质控异常',     type: '质控', owner: '王明',       time: '2024-11-30 12:20', level: 'warning',  read: false, desc: '样本 S031 数据血缘异常环节待处理' },
    { id: 'RM011', title: '库存容量预警',     type: '质控', owner: '样本库主管', time: '2024-11-29 09:00', level: 'warning',  read: false, desc: '库存使用率超过 85%，请评估扩容' },
    { id: 'RM012', title: '知情同意书缺失',   type: '质控', owner: '文件管理员', time: '2024-11-29 09:00', level: 'warning',  read: false, desc: '部分样本知情同意书编号为空' },
    { id: 'RM013', title: '校准证书到期',     type: '设备', owner: '设备负责人', time: '2024-11-26 08:00', level: 'info',     read: true,  desc: '6.4 设备条款下 2 台设备校准证书已到期' },
    { id: 'RM014', title: '版本待审核',       type: '版本', owner: '质量管理员', time: '2024-11-24 11:00', level: 'info',     read: true,  desc: '质量手册 V3.3 待审核发布' }
  ];

  function read() { try { var r = localStorage.getItem(K); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function write(a) { try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) { } }
  function emit() { try { window.dispatchEvent(new CustomEvent('reminderchange')); } catch (e) { } }
  function byTime(a, b) { return a.time < b.time ? 1 : (a.time > b.time ? -1 : 0); }

  function ensure() {
    var a = read();
    if (!a || !a.length) { a = JSON.parse(JSON.stringify(SEED)); write(a); }
    a.forEach(function (r) { if (r.read === undefined) r.read = false; });
    return a.slice().sort(byTime);
  }

  var api = {
    all: function () { return ensure(); },
    latest: function (n) { return ensure().slice(0, n || 10); },
    unread: function () { return ensure().filter(function (r) { return !r.read; }).length; },
    markRead: function (id) { var a = ensure(); a.forEach(function (r) { if (r.id === id) r.read = true; }); write(a); emit(); },
    markAllRead: function () { var a = ensure(); a.forEach(function (r) { r.read = true; }); write(a); emit(); },
    add: function (r) { var a = ensure(); a.push(r); write(a); emit(); },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } emit(); }
  };
  return api;
})();
