/* ============================================================
 * RBAC 单一数据源 —— 角色 / 权限 / 账号 / 演示身份
 * ------------------------------------------------------------
 * 全站只有这里定义「谁可以做什么」：
 *   1. 系统管理「角色管理」页从这里渲染矩阵；
 *   2. 在这里改的权限保存后，全站按钮/菜单立即生效（role-guard.js 消费）；
 *   3. 演示身份（右上角切换器）也在这里持久化，跨页保持。
 *
 * 加载顺序：必须在 app.js **之前**（app.js 只做 UI，不做权限判定）。
 * ============================================================ */
window.ROLES = (function () {
  'use strict';

  /* ---------- 权限模块（粒度到功能模块） ---------- */
  const MODULES = [
    { id: 'dash',     name: '迎检总览',   desc: '迎检进度看板与关键指标',     pages: ['index.html'] },
    { id: 'prep',     name: '迎检筹备',   desc: '任务分配 · 检查清单',        pages: ['task-config.html', 'checklist.html'] },
    { id: 'clause',   name: '条款管理',   desc: 'CNAS 条款库 · 条款自评',     pages: ['clause-library.html', 'self-assessment.html'] },
    { id: 'evidence', name: '证据材料',   desc: '材料智能归档 · 版本管理',    pages: ['archive.html', 'version.html'] },
    { id: 'review',   name: '评审档案',   desc: '智能报告 · 历史评审记录',    pages: ['report.html', 'history.html'] },
    { id: 'rule',     name: '规则库',     desc: '规则列表 · 模板 · 版本 · 编排', pages: ['rule-library.html', 'rule-editor.html'] },
    { id: 'event',    name: '事件管控',   desc: '偏差 / 不符合项处置闭环',    pages: ['event-control.html'] },
    { id: 'data',     name: '数据质控',   desc: '样本数据质量与整改',        pages: ['data-quality.html'] },
    { id: 'system',   name: '系统管理',   desc: '用户 · 角色权限 · 操作日志',  pages: ['system-users.html', 'system-roles.html', 'system-audit.html'] }
  ];

  /* ---------- 操作类型（每模块 6 类，9×6=54 个权限点） ---------- */
  const OPS = [
    { id: 'view',    name: '查看' },
    { id: 'create',  name: '新增' },
    { id: 'edit',    name: '修改' },
    { id: 'delete',  name: '删除', risk: true },
    { id: 'approve', name: '审批' },
    { id: 'export',  name: '导出' }
  ];

  /* ---------- 角色定义 ---------- */
  /* level：1 决策层 / 2 管理负责人 / 3 执行层 / 4 操作层 / 5 外部受限
     grants：模块 → 具备的操作。未列出的操作即不可见不可用（最小必要原则） */
  const ROLE_DEFS = [
    {
      id: 'executive', name: '院方领导', short: '院', tone: 1, level: '决策层',
      tagline: '只看得懂的结论，不做具体操作',
      duty: '对本单位 CNAS 认可工作负领导责任，掌控整体迎检态势与重大资源投入。',
      scenario: '晨会 / 院周会打开「迎检总览」看进度与红榜问题；对重大整改进度做最终确认。',
      dataScope: '全院汇总数据（仅结论层，不展开过程明细）',
      grants: {
        dash:     ['view', 'export'],
        prep:     ['view'],
        clause:   ['view'],
        evidence: ['view'],
        review:   ['view', 'approve', 'export'],
        rule:     ['view'],
        event:    ['view'],
        data:     ['view'],
        system:   ['view']
      },
      limits: [
        '不参与任何日常业务操作（无新增 / 修改 / 删除）',
        '仅在评审档案中对「重大不符合项整改方案」行使最终确认',
        '不得变更系统角色与权限配置'
      ]
    },
    {
      id: 'director', name: '样本库主任', short: '主', tone: 2, level: '决策层',
      tagline: '全面负责，唯一可签发授权的角色',
      duty: '对本单位认可准备的充分性负总责，签发自评结论、整改方案与授权变更。',
      scenario: '审批各条款自评结论；签发新版质量体系文件；批准权限矩阵变更。',
      dataScope: '全部数据（含人员绩效与成本）',
      grants: {
        dash:     ['view', 'export'],
        prep:     ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        clause:   ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        evidence: ['view', 'create', 'edit', 'approve', 'export'],
        review:   ['view', 'create', 'edit', 'approve', 'export'],
        rule:     ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        event:    ['view', 'create', 'edit', 'approve', 'export'],
        data:     ['view', 'create', 'edit', 'export'],
        system:   ['view', 'create', 'edit', 'delete', 'approve', 'export']
      },
      limits: [
        '证据材料**禁止删除**（delete 未授予）—— 满足 ISO 20387 记录保留要求',
        '授权变更（他人权限）需本角色批准后方可生效',
        '不直接承担逐条自评填写工作'
      ]
    },
    {
      id: 'quality_head', name: '质量负责人', short: '质', tone: 3, level: '管理负责人',
      tagline: '技术把关，判定符合性与整改方案',
      duty: '主持质量管理体系运行，裁定条款符合性、签发不符合项与纠正措施并要求验证有效性。',
      scenario: '复核自评人提交的自评证据链完整性；对不符合条款下发纠正措施；批准新版 SOP 发布。',
      dataScope: '全部质量相关数据（人员姓名做了必要脱敏展示）',
      grants: {
        dash:     ['view', 'export'],
        prep:     ['view', 'create', 'edit', 'approve', 'export'],
        clause:   ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        evidence: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        review:   ['view', 'create', 'edit', 'approve', 'export'],
        rule:     ['view', 'edit', 'export'],
        event:    ['view', 'create', 'edit', 'delete', 'approve', 'export'],
        data:     ['view', 'create', 'edit', 'export'],
        system:   ['view', 'edit', 'export']
      },
      limits: [
        '证据材料**可删除范围仅限未核验 / 待归类**的材料；已核验归档的材料需走作废流程，不得物理删除（ISO 20387 记录保留）',
        '无权停用 / 删除账号、无权批准权限矩阵变更（须主任审批）',
        '不可变更本角色的自身权限'
      ]
    },
    {
      id: 'quality_admin', name: '质量管理员', short: '管', tone: 4, level: '执行层',
      tagline: '体系日常运转的主力，事事做但件件不成定论',
      duty: '维护任务清单与检查清单、归集佐证材料、跟踪不符合项闭环进度。',
      scenario: '按条款拆分任务并指派自评人；催办逾期材料；上传新版本文件并维护规则引擎。',
      dataScope: '全部业务数据，但姓名/联系方式按字段脱敏规则展示',
      grants: {
        dash:     ['view', 'create', 'edit', 'export'],
        prep:     ['view', 'create', 'edit', 'export'],
        clause:   ['view', 'create', 'edit', 'export'],
        evidence: ['view', 'create', 'edit', 'delete', 'export'],
        review:   ['view', 'create', 'edit', 'export'],
        rule:     ['view', 'create', 'edit', 'export'],
        event:    ['view', 'create', 'edit', 'export'],
        data:     ['view', 'create', 'edit', 'export'],
        system:   ['view', 'create', 'edit', 'export']
      },
      limits: [
        '**没有任何审批权** —— 自评结论、版本发布、不符合项闭环均需上级签发',
        '**删除仅限未核验 / 待归类的材料**（误传、重复上传可自行清理）；已核验材料须由质量负责人按作废流程处理',
        '权限矩阵可修改但必须提交主任审批后才生效'
      ]
    },
    {
      id: 'operator', name: '样本库操作员', short: '操', tone: 5, level: '操作层',
      tagline: '只做 executed 范围内的动作：提材料、看自己的任务',
      duty: '按岗位接收/处理样本，提交本人负责的条款自评材料与操作记录。',
      scenario: '查看分配给自己的 3 条任务；把照片、扫描件、导出记录拖进归档区；上报现场偏差。',
      dataScope: '仅本人操作范围内的记录（owner = 本人）',
      grants: {
        dash:     ['view'],
        prep:     ['view'],
        clause:   ['view'],
        evidence: ['view', 'create', 'edit'],
        review:   ['view'],
        rule:     [],
        event:    ['view', 'create'],
        data:     ['view', 'create'],
        system:   []
      },
      limits: [
        '只能查看 / 修改分配给自己的任务与材料，看不到全局汇总 KPI 明细',
        '无导出权（导出=数据外流风险，需管理员代为导出）',
        '不可进行核销、审批、停用等高危操作'
      ]
    },
    {
      id: 'guest', name: '普通用户', short: '普', tone: 6, level: '受限外部',
      tagline: '最小必要：只能查条款目录，看什么都脱敏',
      duty: '项目协作方/科研人员，仅需查阅公开的体系文件与条款目录。',
      scenario: '检索条款内容了解要求；查阅已公开的作业指导书；提交资料查阅申请。',
      dataScope: '脱敏后的公开信息（姓名/联系方式/患者信息全部打码）',
      grants: {
        dash:     ['view'],
        prep:     [],
        clause:   ['view'],
        evidence: ['view'],
        review:   [],
        rule:     [],
        event:    [],
        data:     ['view'],
        system:   []
      },
      limits: [
        '仅条款库 / 数据质控两个模块的只读视图',
        '所有敏感字段默认脱敏展示，无法申请明文（无 export 权限）',
        '任何写操作均被拒绝'
      ]
    }
  ];

  /* ---------- 账号（系统管理「用户管理」页签数据源） ---------- */
  const ACCOUNTS = [
    { name: '陈志远', account: 'chenzy',   role: 'executive',     dept: '院领导办公室', mail: 'chenzy@tcmhosp.cn',    phone: '138****2210', last: '2026-09-22 08:12', status: '正常' },
    { name: '周敏华', account: 'zhoumh',   role: 'executive',     dept: '医务处',       mail: 'zhoumh@tcmhosp.cn',    phone: '139****8821', last: '2026-09-18 16:40', status: '正常' },
    { name: '张建国', account: 'zhangjg',  role: 'director',      dept: '样本库',       mail: 'zhangjg@tcmhosp.cn',   phone: '137****1123', last: '2026-09-23 07:55', status: '正常' },
    { name: '李慧',   account: 'lihui',    role: 'quality_head',  dept: '质量管理部',   mail: 'lihui@tcmhosp.cn',     phone: '136****7789', last: '2026-09-23 09:03', status: '正常' },
    { name: '王明',   account: 'wangming', role: 'quality_admin', dept: '质量管理部',   mail: 'wangming@tcmhosp.cn',  phone: '135****3345', last: '2026-09-23 08:30', status: '正常' },
    { name: '赵倩',   account: 'zhaoqian', role: 'quality_admin', dept: '质量管理部',   mail: 'zhaoqian@tcmhosp.cn',  phone: '138****6678', last: '2026-09-22 18:21', status: '正常' },
    { name: '孙伟',   account: 'sunwei',   role: 'operator',      dept: '样本库',       mail: 'sunwei@tcmhosp.cn',    phone: '139****0092', last: '2026-09-23 11:47', status: '正常' },
    { name: '周涛',   account: 'zhoutao',  role: 'operator',      dept: '样本库',       mail: 'zhoutao@tcmhosp.cn',   phone: '137****4456', last: '2026-09-23 10:09', status: '正常' },
    { name: '吴敏',   account: 'wumin',    role: 'operator',      dept: '分子实验平台', mail: 'wumin@tcmhosp.cn',     phone: '136****9901', last: '2026-09-21 09:33', status: '正常' },
    { name: '郑楠',   account: 'zhengnan', role: 'operator',      dept: '样本接收处',   mail: 'zhengnan@tcmhosp.cn',  phone: '135****2234', last: '2026-09-19 14:02', status: '正常' },
    { name: '何丽',   account: 'heli',     role: 'guest',         dept: '院外·协作单位', mail: 'heli@partner-lab.cn',  phone: '138****5567', last: '2026-09-20 20:15', status: '正常' },
    { name: '刘梅',   account: 'liumei',   role: 'guest',         dept: '规培学员',     mail: 'liumei@tcmhosp.cn',    phone: '139****1180', last: '2026-08-30 15:28', status: '已停用' }
  ];

  /* ---------- 操作 → 权限点映射（全站按钮拦截的核心） ----------
   * data-action / data-pm 的真实语义在这里定义一次，
   * 页面无需逐个加 data-perm —— 见 tools/README 坑 20。 */
  const ACTION_MAP = {
    'version-compare':        ['evidence', 'view',    '版本对比'],
    'version-detail':         ['evidence', 'view',    '查看版本详情'],
    'version-view':           ['evidence', 'view',    '查看指定版本'],
    'version-approve':        ['evidence', 'approve', '版本审批'],
    'version-pending-review': ['evidence', 'approve', '查看待审批版本'],
    'version-revise':         ['evidence', 'edit',    '发起版本修订'],
    'version-renew':          ['evidence', 'edit',    '版本续期'],
    'version-new':            ['evidence', 'create',  '上传新版本'],
    'task-save':              ['prep',     'edit',    '保存任务分配'],
    'task-new':               ['prep',     'create',  '新建任务'],
    'task-adopt':             ['prep',     'edit',    '采纳智能分配建议'],
    'batch-assign':           ['prep',     'edit',    '批量指派'],
    'checklist-new':          ['prep',     'create',  '新建检查清单'],
    'checklist-batch':        ['prep',     'edit',    '清单批量操作'],
    'clause-new':             ['clause',   'create',  '新增条款'],
    'clause-del':             ['clause',   'delete',  '删除条款'],
    'clause-detail':          ['clause',   'view',    '查看条款详情'],
    'clause-lib-detail':      ['clause',   'view',    '查看条款详情'],
    'selfassess-new':         ['clause',   'create',  '发起自评'],
    'evidence-upload':        ['evidence', 'create',  '上传佐证材料'],
    'evidence-detail':        ['evidence', 'view',    '查看材料详情'],
    'evidence-preview':       ['evidence', 'view',    '预览材料'],
    'evidence-classify':      ['evidence', 'edit',    '调整材料归属'],
    'arc-export':             ['evidence', 'export',  '导出材料清单'],
    'arc-bulk-verify':        ['evidence', 'approve', '批量核验材料'],
    'arc-bulk-classify':      ['evidence', 'edit',    '批量归类材料'],
    'arc-bulk-remove':        ['evidence', 'delete',  '批量移除材料'],
    'arc-reset':              ['evidence', 'delete',  '重置示例数据'],
    'report-new':             ['review',   'create',  '新建报告'],
    'report-generate':        ['review',   'create',  '生成智能报告'],
    'report-template':        ['review',   'edit',    '维护报告模板'],
    'report-preview':         ['review',   'view',    '预览报告'],
    'history-detail':         ['review',   'view',    '查看历史评审'],
    'history-trend':          ['review',   'view',    '查看趋势'],
    'history-download':       ['review',   'export',  '下载评审资料'],
    'history-export':         ['review',   'export',  '导出评审记录'],
    'history-upload':         ['review',   'create',  '上传评审资料'],
    'create':                 ['system',   'create',  '新建用户'],
    'edit-user':              ['system',   'edit',    '编辑账号'],
    'reset-pwd':              ['system',   'edit',    '重置密码'],
    'toggle-user':            ['system',   'delete',  '停用 / 启用账号'],
    'export-log':             ['system',   'export',  '导出操作日志'],
    'user-create':            ['system',   'create',  '新建用户'],
    'user-edit':              ['system',   'edit',    '编辑账号'],
    'user-reset':             ['system',   'edit',    '重置密码'],
    'user-toggle':            ['system',   'delete',  '停用 / 启用账号'],
    'user-export':            ['system',   'export',  '导出用户清单'],
    'edit-role':              ['system',   'edit',    '编辑角色权限'],
    'role-new':               ['system',   'create',  '新建角色'],
    'role-export':            ['system',   'export',  '导出角色权限'],
    'audit-verify':           ['system',   'view',    '校验审计链完整性'],
    'audit-export':           ['system',   'export',  '导出操作日志'],
    'rule-view':              ['rule',     'view',    '查看规则'],
    'rule-edit':              ['rule',     'edit',    '修改规则'],
    'rule-toggle':            ['rule',     'edit',    '启停规则'],
    'rule-tpl':               ['rule',     'create',  '套用规则模板'],
    'rule-new':               ['rule',     'create',  '新建规则'],
    'rule-save':              ['rule',     'edit',    '保存规则'],
    'rule-delete':            ['rule',     'delete',  '删除规则'],
    'rule-export':            ['rule',     'export',  '导出规则清单'],
    'rule-version':           ['rule',     'view',    '查看规则版本'],
    'rule-log':               ['rule',     'view',    '查看触发日志']
  };

  /* ---------- 存储 ---------- */
  const K = {
    role:    'cnas_demo_role',        // 当前演示身份
    matrix:  'cnas_rbac_matrix_v1',   // 用户在角色管理页改动过的权限（覆盖默认值）
    pending: 'cnas_rbac_pending_v1',  // 待主任审批的权限变更
    audit:   'cnas_rbac_audit_v1'     // 权限变更审计
  };
  // 迁移：旧版两角色演示开关（manager/staff）已废弃，统一到 6 角色
  const MIGRATE = { manager: 'quality_admin', staff: 'guest' };
  const APPROVER = 'director';   // 唯一可签发权限变更的角色
  const DEFAULT_ROLE = 'quality_admin';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); } catch (e) { }
  }

  /* ---------- 默认权限（深拷贝，防调用方污染） ---------- */
  function defaults() {
    const out = {};
    ROLE_DEFS.forEach(function (r) {
      out[r.id] = {};
      MODULES.forEach(function (m) {
        out[r.id][m.id] = (r.grants[m.id] || []).slice();
      });
    });
    return out;
  }

  /* ---------- 有效权限 = 默认 + 用户覆盖 ---------- */
  const _roles = ROLE_DEFS;
  const _overlay = read(K.matrix, null) || {};

  function effectiveMatrix() {
    const base = defaults();
    Object.keys(_overlay).forEach(function (rid) {
      if (!base[rid]) return;
      Object.keys(_overlay[rid]).forEach(function (mid) {
        if (!base[rid][mid]) return;
        base[rid][mid] = Array.isArray(_overlay[rid][mid]) ? _overlay[rid][mid].slice() : base[rid][mid];
      });
    });
    return base;
  }

  const api = {
    MODULES: MODULES, OPS: OPS, ACCOUNTS: ACCOUNTS, APPROVER: APPROVER, ACTION_MAP: ACTION_MAP,
    list: function () { return _roles; },
    byId: function (id) { return _roles.filter(function (r) { return r.id === id; })[0] || null; },
    module: function (id) { return MODULES.filter(function (m) { return m.id === id; })[0] || null; },
    op: function (id) { return OPS.filter(function (o) { return o.id === id; })[0] || null; },

    /** 某角色在某模块上具备的操作集合（含用户覆盖） */
    grants: function (roleId, moduleId) {
      const m = effectiveMatrix();
      const rid = roleId || api.current();
      return (m[rid] && m[rid][moduleId]) ? m[rid][moduleId] : [];
    },
    /** 核心判定：该角色能否在某模块执行某操作 */
    can: function (roleId, moduleId, op) {
      if (!roleId || !moduleId || !op) return true;   // 未纳入权限模型的动作默认放行
      const m = effectiveMatrix();
      if (!m[roleId]) return false;
      if (!(moduleId in (m[roleId] || {}))) return false;
      return (m[roleId][moduleId] || []).indexOf(op) >= 0;
    },
    /** 当前演示身份能否执行该 data-action / data-pm */
    canAction: function (action, roleId) {
      const map = ACTION_MAP[action];
      if (!map) return true;
      return api.can(roleId || api.current(), map[0], map[1]);
    },
    actionPerm: function (action) {
      const map = ACTION_MAP[action];
      if (!map) return null;
      return { module: map[0], op: map[1], label: map[2], modName: (api.module(map[0]) || {}).name || map[0], opName: (api.op(map[1]) || {}).name || map[1] };
    },

    /** 页面文件 → 所属模块 */
    pageModule: function (href) {
      const file = String(href || '').split('/').pop().split('?')[0].split('#')[0] || '';
      const cur = (location.pathname.split('/').pop() || '');
      if (!file || file === cur || file === '') return null;
      const hit = MODULES.filter(function (m) { return m.pages.indexOf(file) >= 0; })[0];
      return hit ? hit.id : null;
    },
    currentModule: function () {
      const cur = location.pathname.split('/').pop() || 'index.html';
      const hit = MODULES.filter(function (m) { return m.pages.indexOf(cur) >= 0; })[0];
      return hit ? hit.id : null;
    },

    /** 演示身份读写（跨页持久化；兼容旧 manager/staff） */
    current: function () {
      let r = null;
      try { r = localStorage.getItem(K.role); } catch (e) { }
      if (MIGRATE[r]) { r = MIGRATE[r]; write(K.role, r); }
      if (!r || !api.byId(r)) r = DEFAULT_ROLE;
      return r;
    },
    setRole: function (id) {
      if (!api.byId(id)) return;
      write(K.role, id);
      try { document.dispatchEvent(new CustomEvent('rolechange', { detail: { role: id } })); } catch (e) { }
    },

    /** 权限统计（用于角色卡 / 横幅摘要） */
    stats: function (roleId) {
      let pts = 0, del = 0, app = 0;
      MODULES.forEach(function (m) {
        pts += api.grants(roleId, m.id).length;
        if (api.can(roleId, m.id, 'delete')) del++;
        if (api.can(roleId, m.id, 'approve')) app++;
      });
      const visible = MODULES.filter(function (m) { return api.can(roleId, m.id, 'view'); }).length;
      return { points: pts, total: MODULES.length * OPS.length, visible: visible, del: del, app: app };
    },

    /* ---------- 权限矩阵编辑 + 变更审批 ---------- */
    pending: function () { return read(K.pending, null); },
    audit: function (n) {
      const a = read(K.audit, []) || [];
      return n ? a.slice(0, n) : a;
    },
    addAudit: function (item) {
      const a = read(K.audit, []) || [];
      a.unshift(Object.assign({ time: new Date().toLocaleString('zh-CN', { hour12: false }) }, item));
      write(K.audit, a.slice(0, 30));
    },
    /** 与当前生效权限的差异（用于审批弹窗摘要） */
    diff: function (roleId, nextMatrix) {
      const cur = effectiveMatrix()[roleId] || {};
      const out = [];
      MODULES.forEach(function (m) {
        const a = cur[m.id] || [], b = nextMatrix[m.id] || [];
        const add = b.filter(function (o) { return a.indexOf(o) < 0; });
        const rm = a.filter(function (o) { return b.indexOf(o) < 0; });
        if (!add.length && !rm.length) return;
        OPS.forEach(function (o) {
          if (add.indexOf(o.id) >= 0) out.push({ mod: m.name, op: o.name, kind: 'grant' });
          if (rm.indexOf(o.id) >= 0) out.push({ mod: m.name, op: o.name, kind: 'revoke' });
        });
      });
      return out;
    },
    /**
     * 保存矩阵。非主任角色只能提交 → 进入待审批队列；主任本人直接生效。
     * @returns {{applied:boolean, pending:boolean}}
     */
    saveMatrix: function (roleId, nextMatrix, actorId) {
      const actor = actorId || api.current();
      const d = api.diff(roleId, nextMatrix);
      if (!d.length) return { applied: false, pending: false, empty: true };
      if (actor === APPROVER) {
        _overlay[roleId] = JSON.parse(JSON.stringify(nextMatrix));
        write(K.matrix, _overlay);
        api.addAudit({ actor: roleId, kind: '生效', detail: '权限变更经样本库主任签发后生效（' + d.length + ' 项）' });
        return { applied: true, pending: false, changes: d };
      }
      write(K.pending, { roleId: roleId, matrix: nextMatrix, by: actor, time: new Date().toLocaleString('zh-CN', { hour12: false }), changes: d });
      api.addAudit({ actor: roleId, kind: '待审批', detail: (api.byId(actor) || {}).name + ' 提交权限变更申请（' + d.length + ' 项），等待样本库主任审批' });
      return { applied: false, pending: true, changes: d };
    },
    approvePending: function () {
      const p = api.pending();
      if (!p) return null;
      _overlay[p.roleId] = JSON.parse(JSON.stringify(p.matrix));
      write(K.matrix, _overlay);
      try { localStorage.removeItem(K.pending); } catch (e) { }
      api.addAudit({ actor: p.roleId, kind: '已批准', detail: '样本库主任批准了由 ' + (api.byId(p.by) || {}).name + ' 提交的权限变更（' + (p.changes || []).length + ' 项），即时生效' });
      return p;
    },
    rejectPending: function () {
      const p = api.pending();
      if (!p) return null;
      try { localStorage.removeItem(K.pending); } catch (e) { }
      api.addAudit({ actor: p.roleId, kind: '已驳回', detail: '样本库主任驳回了权限变更申请（' + (p.changes || []).length + ' 项），维持原权限' });
      return p;
    },
    /** 恢复出厂权限（演示现场常用） */
    reset: function () {
      try {
        localStorage.removeItem(K.matrix);
        localStorage.removeItem(K.pending);
      } catch (e) { }
      Object.keys(_overlay).forEach(function (k) { delete _overlay[k]; });
    },
    isDirty: function () { return Object.keys(_overlay).length > 0; }
  };

  return api;
})();
