/* ==========================================================================
   佐证材料 — 统一数据源（材料智能归档页 & 条款自评页共用）
   --------------------------------------------------------------------------
   为什么要有这一层：
     改造前两处是两套互不相干的数据 —— 归档页是一张写死的表格，条款自评页的
     「已上传佐证材料」只是把条款名拼进三行静态文字里，两边的材料对不上，上传
     也落不了地。现在两页共用同一份材料数据，任一处上传 / 核验 / 退回归档，另
     一处立刻一致。

   数据构成（两层，避免种子数据被用户改动污染）：
     · 种子层 seed()   128 条确定性生成的演示材料，每次刷新完全一致
     · 用户层 user     新增 / 修改 / 删除 / 追加日志，落 localStorage
     对外 getAll() = 种子层套用用户层补丁 → 过滤已删除 → 合并新增项

   材料模型：
     { id, name, ext, size, cat, status, matched, uploader, time, version,
       clauses:[{lib,id,name}], keywords:[], note, versions:[], logs:[] }
   ========================================================================== */
(function (global) {
  'use strict';

  var CL = global.CLAUSE_LIB;
  var LS_KEY = 'cnas_evidence_v1';

  /* ----------------------------------------------------------------------
     分类
     ---------------------------------------------------------------------- */
  var CATS = [
    { k: 'mgmt',     label: '管理体系文件', icon: '📋' },
    { k: 'tech',     label: '技术记录',     icon: '🔬' },
    { k: 'people',   label: '人员资质',     icon: '👥' },
    { k: 'facility', label: '设施与环境',   icon: '🏢' },
    { k: 'device',   label: '设备与计量',   icon: '⚙'  },
    { k: 'audit',    label: '评估与审核',   icon: '📊' }
  ];
  var CAT_BY = {};
  CATS.forEach(function (c) { CAT_BY[c.k] = c; });

  /* 各类材料的名称池。
     不用「条款名 + 模板」拼接——那样会生成「公正性设备验收单」这类不自然的组合；
     改为每个要素域一套实名池，条款归属由数据决定，名称只体现要素域。 */
  var NAME_POOL = {
    mgmt: [
      '质量手册（2026 修订版）', '生物样本库管理程序', '文件控制程序', '记录控制程序',
      '风险与机遇应对程序', '管理评审程序', '内部审核程序', '纠正措施控制程序',
      '保密性管理程序', '公正性管理程序', '样本处置管理程序', '样本库信息管理系统管理程序',
      '人员管理程序', '设备管理程序', '试剂与耗材管理程序', '不符合工作控制程序',
      '持续改进管理规定', '外部供方评价管理程序'
    ],
    tech: [
      '样本接收与交接记录', '样本处理过程记录', '分装操作记录表', '冻融次数统计表',
      '储存温度记录', '质量控制结果评价报告', '室间质评比对报告', '样本分发出库记录',
      '运输温度监控记录', '可追溯性演练记录', '不合格样本处置记录', '结果有效性监控记录',
      '检测原始记录汇编', '样本销毁记录', '知情同意与伦理审查记录', '样本标识与编码规则',
      '冷链运输温度核查记录', '样本质量抽检记录'
    ],
    people: [
      '人员资质证书汇总表', '岗位培训计划与实施记录', '人员能力评价表', '岗位授权书',
      '人员技术档案卡', '新员工入职培训签到表', '人员公正性承诺书', '外部与临时人员登记表',
      '培训效果考核记录', '样本库主任任命文件'
    ],
    facility: [
      '实验室温湿度监测记录', '样本库分区平面图', '门禁与监控系统检查记录', '环境消毒与清洁记录',
      'UPS 与应急电源检查记录', '设施安全巡检记录', '洁净区压差监测记录', '消防与应急演练记录',
      '液氮罐液位与补充记录', '冷库温度异常处置记录'
    ],
    device: [
      '超低温冰箱温度监测记录', '液氮罐例行检查记录', '离心机维护保养记录', '生物安全柜年检报告',
      '移液器校准证书', '温湿度记录仪校准证书', '设备台账与唯一性标识清单', '设备故障与停用记录',
      '关键设备期间核查记录', '备用电源切换测试记录', '冰箱温度报警测试记录', '设备采购与验收单',
      '计量溯源链评估记录', '设备操作授权记录'
    ],
    audit: [
      '年度内部审核报告', '内审不符合项清单与整改验证', '管理评审记录与决议跟踪表', '专项自查报告',
      '迎检模拟评审记录', '风险评估报告', '持续改进项跟踪表', '体系运行有效性评估报告'
    ]
  };

  /* 各要素域可归属的二级节：避免「设备故障与停用记录」被挂到「6.2 人员」上。
     用节级而非章级，六类收拢后的并集仍覆盖 ISO 20387 全部 30 条。 */
  var CAT_SCOPE = {
    mgmt:     ['4.1', '4.2', '5.1', '5.2', '8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.9'],
    tech:     ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8', '7.9', '7.10', '7.11', '7.12'],
    people:   ['5.2', '6.1', '6.2'],
    facility: ['6.3', '7.5'],
    device:   ['6.4', '6.5'],
    audit:    ['8.6', '8.7', '8.8', '8.9']
  };

  /* 状态口径：status 是唯一入口，verify 由它派生，避免两处说法不一致 */
  var ST = {
    '已归档': { verify: '已核验', tag: 'tag-success', icon: '✓', desc: '已核验归档，可作迎检证据' },
    '待复核': { verify: '待复核', tag: 'tag-warning', icon: '⏳', desc: '已上传，等待质量主管复核' },
    '待归类': { verify: '未核验', tag: 'tag-warning', icon: '❓', desc: '智能识别未达阈值，需人工确认归属条款' },
    '已退回': { verify: '已退回', tag: 'tag-error',   icon: '⚠', desc: '复核未通过，需补充或换版后重新提交' }
  };
  var STATUSES = ['已归档', '待复核', '待归类', '已退回'];

  var PEOPLE = ['张三', '孙七', '李四', '王五', '赵六', '周八', '吴九', '郑十'];
  var VERIFIER = '陈主管';
  /* 扩展名按要素域给：程序文件不该是 xlsx、证书不该是 docx */
  var EXT_BY_CAT = {
    mgmt:     ['pdf', 'pdf', 'docx', 'docx', 'pdf'],
    tech:     ['xlsx', 'pdf', 'docx', 'xlsx', 'pdf'],
    people:   ['pdf', 'jpg', 'png', 'pdf', 'docx'],
    facility: ['xlsx', 'pdf', 'xlsx', 'pdf'],
    device:   ['xlsx', 'pdf', 'pdf', 'png'],
    audit:    ['pdf', 'pdf', 'docx']
  };
  var WEEK_FROM = '2026-09-15';      /* 演示用「本周」起点，与种子日期口径一致 */

  var ICON_OF = {
    pdf: '📄', docx: '📑', doc: '📑', xlsx: '📊', xls: '📊',
    png: '🖼', jpg: '🖼', jpeg: '🖼', txt: '📃', zip: '🗜'
  };

  /* ----------------------------------------------------------------------
     工具
     ---------------------------------------------------------------------- */
  /* FNV-1a + murmur3 尾混合：纯 FNV-1a 低位对短字符串分布退化，必须做 finalizer */
  function hash(s) {
    var h = 2166136261, i;
    s = String(s);
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }
  function pick(arr, seed) { return arr[seed % arr.length]; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dayOf(offset) {                       /* 2026-06-01 起第 offset 天 */
    var d = new Date(Date.UTC(2026, 5, 1) + offset * 86400000);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  function shiftDay(dateStr, days) {
    var t = new Date(dateStr + 'T00:00:00Z').getTime() + days * 86400000;
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function iconOf(m) { return ICON_OF[String(m && m.ext || '').toLowerCase()] || '📎'; }
  function extOf(name) {
    var m = String(name || '').match(/\.([a-zA-Z0-9]+)$/);
    return m ? m[1].toLowerCase() : 'pdf';
  }
  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
      ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  function clauseLabel(lib, id) {
    var c = CL && CL.find ? CL.find(lib, id) : null;
    return c ? { lib: lib, id: id, name: c.name, label: id + ' ' + c.name } : null;
  }

  /* ----------------------------------------------------------------------
     种子层
     ---------------------------------------------------------------------- */

  /* 分类配额，合计 128（与原归档页展示的总数保持一致） */
  var CAT_PLAN = [['mgmt', 42], ['tech', 35], ['people', 18], ['facility', 12], ['device', 14], ['audit', 7]];

  /* 手工种子：前 6 条对应原归档页的可见行，后 6 条服务于 CNAS-CL10 条款自评演示
     （7.5.4 温度超限报警是自评模块的主演示条款，必须有真实材料可点开） */
  var CURATED = [
    { name: '质量手册（2026 修订版）.pdf', ext: 'pdf', size: 1258291, cat: 'mgmt', lib: 'iso20387', cid: '8.2',
      uploader: '张三', time: '2026-09-01 10:23', version: 'V3.2', matched: 96, status: '已归档' },
    { name: '公正性声明.docx', ext: 'docx', size: 88064, cat: 'mgmt', lib: 'iso20387', cid: '4.1',
      uploader: '张三', time: '2026-09-02 14:08', version: 'V2.0', matched: 94, status: '已归档' },
    { name: '设备清单与校准记录.xlsx', ext: 'xlsx', size: 880640, cat: 'device', lib: 'iso20387', cid: '6.4',
      extraCid: '6.5', uploader: '孙七', time: '2026-09-03 09:15', version: 'V1.3', matched: 92, status: '已归档' },
    { name: '实验室温湿度监测记录.pdf', ext: 'pdf', size: 430080, cat: 'facility', lib: 'iso20387', cid: '6.3',
      uploader: '郑十', time: '2026-09-05 11:42', version: 'V1.1', matched: 89, status: '已归档' },
    { name: '人员资质证书_李四.jpg', ext: 'jpg', size: 327680, cat: 'people', lib: 'iso20387', cid: '6.2',
      uploader: '李四', time: '2026-09-06 16:30', version: 'V1.0', matched: 97, status: '已归档' },
    { name: '抽样方案_v2.1.docx', ext: 'docx', size: 245760, cat: 'tech', lib: '', cid: '',
      uploader: '周八', time: '2026-09-07 09:08', version: 'V2.1', matched: 61, status: '待归类' },

    { name: '温度超限报警管理程序 V2.1.pdf', ext: 'pdf', size: 1163264, cat: 'mgmt', lib: 'cl10', cid: '7.5.4',
      uploader: '郑十', time: '2026-08-28 10:12', version: 'V2.1', matched: 98, status: '已归档',
      note: '规定报警阈值、响应时限、责任人清单与应急处置路径' },
    { name: '温度超限报警处置记录表.xlsx', ext: 'xlsx', size: 153600, cat: 'tech', lib: 'cl10', cid: '7.5.4',
      uploader: '郑十', time: '2026-09-08 15:26', version: 'V1.4', matched: 95, status: '已归档',
      note: '含 2026 年 3 次超限事件的发生时间、时长、影响样本范围与纠正措施' },
    { name: '储存设备监控与报警验证记录.pdf', ext: 'pdf', size: 737280, cat: 'tech', lib: 'cl10', cid: '7.5.4',
      uploader: '孙七', time: '2026-09-10 09:40', version: 'V1.0', matched: 91, status: '已归档',
      note: '声光报警 + 远程推送双通道验证记录，含验证人员与结论' },
    { name: '储存温度记录（2026Q3）.xlsx', ext: 'xlsx', size: 495616, cat: 'tech', lib: 'cl10', cid: '7.5.1',
      uploader: '郑十', time: '2026-09-12 11:05', version: 'V3.0', matched: 93, status: '已归档' },
    /* 注意：以下两条日期必须早于 WEEK_FROM(2026-09-15)，否则「本周新增」会从 23 变成 25 */
    { name: '液氮罐例行检查与补充记录.pdf', ext: 'pdf', size: 368640, cat: 'facility', lib: 'cl10', cid: '7.5.2',
      uploader: '吴九', time: '2026-09-13 08:52', version: 'V1.2', matched: 90, status: '已归档' },
    { name: '公正性风险识别记录表.xlsx', ext: 'xlsx', size: 118784, cat: 'mgmt', lib: 'cl10', cid: '4.1.1',
      uploader: '张三', time: '2026-09-11 13:20', version: 'V2.0', matched: 96, status: '已归档' }
  ];

  var _seed = null;

  function seed() {
    if (_seed) return _seed;

    /* ISO 条款顺序：按库内顺序轮流挂条款，保证 30 条全覆盖 */
    var isoIds = CL ? CL.get('iso20387').map(function (x) { return x.id; }) : [];

    /* 各分类还要补生成多少条 */
    var need = {};
    CAT_PLAN.forEach(function (p) { need[p[0]] = p[1]; });
    CURATED.forEach(function (c) { if (need[c.cat] != null) need[c.cat]--; });

    var out = [];

    /* --- 手工种子 --- */
    CURATED.forEach(function (c, i) {
      var clauses = [];
      if (c.lib && c.cid) { var a = clauseLabel(c.lib, c.cid); if (a) clauses.push(a); }
      if (c.lib && c.extraCid) { var b = clauseLabel(c.lib, c.extraCid); if (b) clauses.push(b); }
      out.push(makeItem({
        name: c.name, ext: c.ext, size: c.size, cat: c.cat, clauses: clauses,
        uploader: c.uploader, time: c.time, version: c.version,
        matched: c.matched, status: c.status, note: c.note || '',
        seq: i + 1
      }));
    });

    /* --- 生成层 --- */
    var offset = out.length;
    var used = {};
    out.forEach(function (m) { used[m.name] = 1; });

    var cursor = {};                            /* 各要素域在名称池里的取用位置 */
    CAT_PLAN.forEach(function (p) { cursor[p[0]] = 0; });

    var flat = [];
    CAT_PLAN.forEach(function (p) {
      for (var i = 0; i < need[p[0]]; i++) flat.push(p[0]);
    });

    /* 日期排布：先按哈希定序，前 23 条落在本周，其余铺在过去 15 周内
       —— 「本周新增 = 23」由数据算出来，而不是写死在页面上 */
    var ranked = flat.map(function (cat, i) {
      return { cat: cat, i: i, h: hash('ev|' + cat + '|' + i) };
    }).sort(function (a, b) { return a.h - b.h; });

    var WEEKS = 15;
    var gi = 0;
    ranked.forEach(function (r, rank) {
      var cat = r.cat;
      var h = hash('ev#' + cat + '#' + r.i);
      var k = cursor[cat]++;
      var pool = NAME_POOL[cat];

      /* 归属条款：在该要素域允许的二级节内轮流分配，保证 ISO 30 条全覆盖 */
      var scope = isoIds.filter(function (id) {
        return CAT_SCOPE[cat].some(function (pre) {
          return id === pre || id.indexOf(pre + '.') === 0;
        });
      });
      if (!scope.length) scope = isoIds;
      var clause = scope.length ? clauseLabel('iso20387', scope[k % scope.length]) : null;

      var date = rank < 23 ? shiftDay(WEEK_FROM, rank % 7) : dayOf((rank * 7) % (WEEKS * 7));
      var ext = pick(EXT_BY_CAT[cat] || EXT_BY_CAT.tech, h >>> 3);
      var size = 60 * 1024 + (h % 4100) * 1024;
      var uploader = pick(PEOPLE, h >>> 5);
      var version = 'V' + (1 + (h % 3)) + '.' + (h % 10);
      var hh = 8 + (h % 10), mm = (h >>> 4) % 60;

      /* 状态：2 条待归类（+ 手工种子 1 条 = 3）、约 1/29 已退回、约 1/13 待复核 */
      var status = '已归档';
      if (r.i === 0 || r.i === 7) status = '待归类';
      else if (h % 29 === 0) status = '已退回';
      else if (h % 13 === 0) status = '待复核';

      gi++;
      out.push(makeItem({
        name: uniqueName(pool[k % pool.length] + '.' + ext, date.slice(0, 7), used),
        ext: ext, size: size, cat: cat,
        clauses: clause ? [clause] : [],
        uploader: uploader, time: date + ' ' + p2(hh) + ':' + p2(mm),
        version: version, matched: 76 + (h % 24), status: status,
        note: '', seq: offset + gi
      }));
    });

    _seed = out;
    return _seed;
  }

  /* 名称池会被循环取用（如 18 个名称要覆盖 38 条“管理体系文件”），
     同名时把日期并进原有括注（「质量手册（2026 修订版）」→「质量手册（2026-09）」），
     无括注则追加月份，仍冲突再追加批次号，保证列表里不出重名行 */
  function uniqueName(full, ym, used) {
    if (!used[full]) { used[full] = 1; return full; }
    var mt = full.match(/\.[a-zA-Z0-9]+$/);
    var ext = mt ? mt[0] : '';
    var base = ext ? full.slice(0, -ext.length) : full;
    var hasParen = /（[^）]*）$/.test(base);

    var cand = hasParen
      ? base.replace(/（[^）]*）$/, '（' + ym + '）') + ext
      : base + '（' + ym + '）' + ext;
    if (!used[cand]) { used[cand] = 1; return cand; }

    for (var n = 2; n < 99; n++) {
      var tail = hasParen
        ? base.replace(/（[^）]*）$/, '（' + ym + ' 第' + n + '批）')
        : base + '（' + ym + ' 第' + n + '批）';
      var c2 = tail + ext;
      if (!used[c2]) { used[c2] = 1; return c2; }
    }
    var c3 = base.replace(/（[^）]*）$/, '（' + ym + ' 副本）') + ext;
    used[c3] = 1;
    return c3;
  }

  function makeItem(o) {
    var st = ST[o.status] || ST['已归档'];
    var m = {
      id: 'EV-2026-' + String(o.seq).padStart(4, '0'),
      name: o.name,
      ext: o.ext,
      size: o.size,
      cat: o.cat,
      status: o.status,
      verify: st.verify,
      matched: o.matched,
      uploader: o.uploader,
      time: o.time,
      version: o.version,
      clauses: o.clauses || [],
      note: o.note || '',
      seeded: true
    };
    m.keywords = keywordsOf(m);
    m.versions = [{
      v: m.version, date: m.time.slice(0, 10), by: m.uploader,
      desc: '初始版本归档'
    }];
    m.logs = seedLogs(m);
    return m;
  }

  function keywordsOf(m) {
    var kw = [];
    var cat = CAT_BY[m.cat];
    if (cat) kw.push(cat.label);
    m.clauses.forEach(function (c) { kw.push(c.name); });
    var base = m.name.replace(/\.[a-zA-Z0-9]+$/, '').replace(/（\d+）$/, '');
    kw.push(base);
    return kw.filter(function (x, i) { return x && kw.indexOf(x) === i; }).slice(0, 6);
  }

  function seedLogs(m) {
    var out = [];
    out.push({ t: m.time, who: m.uploader, act: '上传', note: '上传文件 ' + m.name + '，大小 ' + fmtSize(m.size) });
    out.push({
      t: m.time, who: '系统', act: '智能识别',
      note: '自动识别匹配度 ' + m.matched + '%，' +
        (m.clauses.length ? '建议归入「' + m.clauses[0].label + '」' : '未达归类阈值，转人工确认')
    });
    if (m.status === '已归档') {
      out.push({ t: shiftDay(m.time.slice(0, 10), 1) + ' 09:30', who: VERIFIER, act: '核验通过', note: '证据充分、版本现行，已归档为迎检证据' });
    } else if (m.status === '已退回') {
      out.push({ t: shiftDay(m.time.slice(0, 10), 1) + ' 10:05', who: VERIFIER, act: '退回', note: '版本非现行有效版本，请换版后重新提交' });
    } else if (m.status === '待复核') {
      out.push({ t: shiftDay(m.time.slice(0, 10), 1) + ' 09:30', who: VERIFIER, act: '指派复核', note: '已加入待复核队列' });
    }
    return out.reverse();                       /* 最新在前 */
  }

  /* ----------------------------------------------------------------------
     用户层（localStorage）
     ---------------------------------------------------------------------- */
  var user = { added: [], patches: {}, removed: [], extraLogs: {}, extraVer: {} };

  function loadUser() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (raw && typeof raw === 'object') {
        user.added = Array.isArray(raw.added) ? raw.added : [];
        user.patches = raw.patches || {};
        user.removed = Array.isArray(raw.removed) ? raw.removed : [];
        user.extraLogs = raw.extraLogs || {};
        user.extraVer = raw.extraVer || {};
      }
    } catch (e) { /* 存储不可用时降级为纯内存 */ }
  }
  function saveUser() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
  }
  loadUser();

  /* ----------------------------------------------------------------------
     对外查询
     ---------------------------------------------------------------------- */
  var listeners = [];
  var seq = 0;

  function getAll() {
    var removed = {};
    user.removed.forEach(function (id) { removed[id] = 1; });

    /* 永远返回副本：种子对象是模块级共享的，一旦被调用方改动会污染后续所有渲染 */
    function materialize(m, isNew) {
      var p = user.patches[m.id] || {};
      var merged = Object.assign({}, m, p);
      merged.verify = (ST[merged.status] || ST['已归档']).verify;
      merged.versions = (m.versions || []).concat(user.extraVer[m.id] || []);
      merged.logs = (user.extraLogs[m.id] || []).concat(m.logs || []);
      if ((p.clauses || p.cat || p.name) || !merged.keywords) merged.keywords = keywordsOf(merged);
      merged.seeded = !!m.seeded;
      return merged;
    }

    var out = seed().filter(function (m) { return !removed[m.id]; })
      .map(function (m) { return materialize(m, false); });

    var added = user.added.filter(function (m) { return !removed[m.id]; })
      .map(function (m) { return materialize(m, true); });

    return added.concat(out);                   /* 新上传的排最前，便于演示时立刻看到 */
  }

  function byId(id) {
    return getAll().filter(function (m) { return m.id === id; })[0] || null;
  }

  function forClause(lib, cid) {
    if (!lib || !cid) return [];
    return getAll().filter(function (m) {
      return (m.clauses || []).some(function (c) { return c.lib === lib && c.id === cid; });
    });
  }

  function clauseStats(lib, cid) {
    var list = forClause(lib, cid);
    var out = { total: list.length, archived: 0, pending: 0, returned: 0, classified: 0, list: list };
    list.forEach(function (m) {
      if (m.status === '已归档') out.archived++;
      else if (m.status === '已退回') out.returned++;
      else out.pending++;
      /* 「证据类型覆盖」：体系文件 / 执行记录 / 设施设备 / 人员 / 审核 五类证据线 */
      if (EVIDENCE_LINES.indexOf(lineOf(m)) >= 0) out.classified |= (1 << EVIDENCE_LINES.indexOf(lineOf(m)));
    });
    out.covered = popcount(out.classified);
    return out;
  }

  /* 评审取证的五条证据线（对应条款解读里的文件/执行/记录/处置思路） */
  var EVIDENCE_LINES = ['体系文件', '执行记录', '设施设备', '人员能力', '审核评估'];
  function lineOf(m) {
    if (m.cat === 'mgmt') return '体系文件';
    if (m.cat === 'people') return '人员能力';
    if (m.cat === 'facility' || m.cat === 'device') return '设施设备';
    if (m.cat === 'audit') return '审核评估';
    return '执行记录';
  }
  function popcount(n) { var c = 0; while (n) { c += n & 1; n >>= 1; } return c; }

  function catCounts() {
    var out = {};
    CATS.forEach(function (c) { out[c.k] = 0; });
    getAll().forEach(function (m) { if (out[m.cat] != null) out[m.cat]++; });
    return out;
  }

  function statusCounts() {
    var out = {};
    STATUSES.forEach(function (s) { out[s] = 0; });
    getAll().forEach(function (m) { if (out[m.status] != null) out[m.status]++; else out[m.status] = 1; });
    return out;
  }

  function stats() {
    var all = getAll();
    var sc = statusCounts();
    var week = all.filter(function (m) { return m.time.slice(0, 10) >= WEEK_FROM; }).length;

    var isoIds = CL ? CL.get('iso20387').map(function (x) { return x.id; }) : [];
    var covered = {};
    all.forEach(function (m) {
      (m.clauses || []).forEach(function (c) { if (c.lib === 'iso20387') covered[c.id] = 1; });
    });
    var cov = isoIds.filter(function (id) { return covered[id]; }).length;

    return {
      total: all.length,
      week: week,
      pending: (sc['待归类'] || 0) + (sc['待复核'] || 0),
      archived: sc['已归档'] || 0,
      returned: sc['已退回'] || 0,
      clauseCovered: cov,
      clauseTotal: isoIds.length,
      catCounts: catCounts(),
      statusCounts: sc
    };
  }

  /* ----------------------------------------------------------------------
     变更
     ---------------------------------------------------------------------- */
  function add(rec) {
    seq++;
    var time = rec.time || nowStamp();
    var m = {
      id: 'EV-NEW-' + Date.now().toString(36).toUpperCase() + '-' + seq,
      name: rec.name,
      ext: rec.ext || extOf(rec.name),
      size: rec.size || 0,
      cat: rec.cat || 'tech',
      status: rec.status || '待复核',
      matched: rec.matched != null ? rec.matched : 88,
      uploader: rec.uploader || '质量管理员',
      time: time,
      version: rec.version || 'V1.0',
      clauses: rec.clauses || [],
      note: rec.note || '',
      seeded: false
    };
    m.verify = (ST[m.status] || ST['待复核']).verify;
    m.keywords = keywordsOf(m);
    m.versions = [{ v: m.version, date: time.slice(0, 10), by: m.uploader, desc: '首次上传' }];
    m.logs = [
      { t: time, who: m.uploader, act: '上传', note: '上传文件 ' + m.name + '，大小 ' + fmtSize(m.size) },
      { t: time, who: '系统', act: '智能识别', note: '自动识别匹配度 ' + m.matched + '%，' + (m.clauses.length ? '归入「' + m.clauses[0].label + '」' : '待人工确认归属条款') }
    ];
    /* push 而非 unshift：批量上传时保持「先选的文件排在前面」，
       与用户在上传队列里看到的顺序一致（同分钟内时间戳相同，靠数组顺序稳定） */
    user.added.push(m);
    saveUser(); emit();
    return m;
  }

  function patch(id, p) {
    var old = byId(id);
    if (!old) return null;
    if (old.seeded) user.patches[id] = Object.assign({}, user.patches[id] || {}, p);
    else {
      var i = user.added.map(function (x) { return x.id; }).indexOf(id);
      if (i >= 0) user.added[i] = Object.assign({}, user.added[i], p);
      else user.patches[id] = Object.assign({}, user.patches[id] || {}, p);
    }
    saveUser(); emit();
    return byId(id);
  }

  function remove(id) {
    var old = byId(id);
    if (!old) return false;
    var i = user.added.map(function (x) { return x.id; }).indexOf(id);
    if (i >= 0) user.added.splice(i, 1);
    else if (user.removed.indexOf(id) < 0) user.removed.push(id);
    saveUser(); emit();
    return true;
  }

  function pushVersion(id, v) {
    var m = byId(id);
    if (!m) return null;
    user.extraVer[id] = (user.extraVer[id] || []).concat([v]);
    patch(id, { version: v.v, time: v.date + ' ' + (v.hm || '10:00') });
    addLog(id, { who: v.by || '质量管理员', act: '上传新版本', note: '更新为 ' + v.v + '：' + (v.desc || '') });
    return byId(id);
  }

  function addLog(id, entry) {
    var m = byId(id);
    if (!m) return null;
    user.extraLogs[id] = (user.extraLogs[id] || []).concat([{
      t: entry.t || nowStamp(), who: entry.who || '质量管理员',
      act: entry.act || '操作', note: entry.note || ''
    }]);
    saveUser(); emit();
    return byId(id);
  }

  /* ----------------------------------------------------------------------
     智能识别（演示口径）
     按文件名识别要素分类与归属条款，并给出一个稳定的匹配度。
     真实系统由 OCR + 内容比对实现，这里只做文件名规则 + 条款名命中的等价效果。
     ---------------------------------------------------------------------- */
  var CAT_RULES = [
    ['audit',    /审核|评审|自查|不符合|整改|复查|模拟/],
    ['people',   /资质|证书|培训|授权|能力|档案|签到|任命/],
    ['device',   /设备|校准|计量|维护|核查|验收|冰箱|液氮|离心机|移液|安全柜/],
    ['facility', /环境|设施|温湿|压差|消毒|洁净|平面图|门禁|冷库|应急电源/],
    ['mgmt',     /程序|手册|规定|制度|办法|声明|方案|方针|职责|控制/],
    ['tech',     /记录|台账|报表|统计|监测|数据|原始|清单/]
  ];

  function guessClause(name) {
    if (!CL) return null;
    var best = null;
    ['iso20387', 'cl10'].forEach(function (lib) {
      (CL.get(lib) || []).forEach(function (c) {
        if (!c.name || c.name.length < 2) return;
        if (String(name).indexOf(c.name) < 0) return;
        /* 命中更长的条款名更可信（如「样本接收」优先于「样本」） */
        if (!best || c.name.length > best.name.length) best = { lib: lib, id: c.id, name: c.name };
      });
    });
    return best;
  }

  function guess(name) {
    var n = String(name || '');
    var cat = 'tech';
    for (var i = 0; i < CAT_RULES.length; i++) {
      if (CAT_RULES[i][1].test(n)) { cat = CAT_RULES[i][0]; break; }
    }
    var h = hash(n);
    var matched = 58 + (h % 42);                 /* 58 ~ 99，稳定不跳变 */
    var hit = guessClause(n);
    if (hit) matched = Math.max(matched, 78 + (h % 22));   /* 命中条款名则不低于 78 */
    var clauses = [];
    if (hit) { var lb = clauseLabel(hit.lib, hit.id); if (lb) clauses.push(lb); }
    return {
      cat: cat, matched: matched, clauses: clauses,
      clause: hit,
      status: clauses.length ? '待复核' : '待归类'
    };
  }

  /* ----------------------------------------------------------------------
     智能推荐：该条款没有材料时，从已有材料里挑最可能相关的
     打分 = 分类命中共现条款 + 名称关键词与条款名/条款分类的重合
     ---------------------------------------------------------------------- */
  function recommend(lib, cid, limit) {
    limit = limit || 3;
    var clause = clauseLabel(lib, cid);
    if (!clause) return [];
    var want = clause.name;

    var scored = getAll()
      .filter(function (m) { return m.status !== '已退回'; })
      .map(function (m) {
        var score = 0;
        /* 名称里出现条款名的连续片段 → 强相关（片段越长越可信） */
        var nm = m.name.replace(/\.[a-zA-Z0-9]+$/, '');
        for (var L = 2; L <= Math.min(4, want.length); L++) {
          for (var s = 0; s + L <= want.length; s++) {
            if (nm.indexOf(want.substr(s, L)) >= 0) { score += L * 6; break; }
          }
        }
        /* 同二级节 / 同章节下的其他条款已有材料 → 相关 */
        var sec = cid.split('.').slice(0, 2).join('.');
        m.clauses.forEach(function (c) {
          if (c.lib !== lib || c.id === cid) return;
          if (c.id.split('.').slice(0, 2).join('.') === sec) score += 22;
          else if (c.id.split('.')[0] === cid.split('.')[0]) score += 8;
        });
        /* 关键词与条款名互为包含 */
        m.keywords.forEach(function (k) {
          if (k && k.length >= 2 && want.indexOf(k) >= 0) score += 10;
        });
        if (m.cat === 'mgmt') score += 4;               /* 体系文件几乎对所有条款有效 */
        if (m.status !== '已归档') score += 6;          /* 未归档的优先提醒补齐 */
        return { m: m, score: score };
      })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score || b.m.matched - a.m.matched; });

    var out = scored.slice(0, limit).map(function (x) { return x.m; });

    /* 兜底：相关条款少的新准则库（如 CNAS-CL10 多数三级条款）拿不满候选数时，
       用高识别匹配度的已归档材料补齐，并标记为低置信度建议，避免出现空推荐。 */
    if (out.length < limit) {
      var has = {};
      out.forEach(function (m) { has[m.id] = 1; });
      getAll()
        .filter(function (m) { return !has[m.id] && m.status === '已归档'; })
        .sort(function (a, b) { return b.matched - a.matched; })
        .slice(0, limit - out.length)
        .forEach(function (m) { m.__loose = true; out.push(m); });
    }
    return out;
  }

  function on(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  /* 下载内容：确认后真实产出一个可打开的文本说明（演示环境没有真文件可下） */
  function toText(m) {
    if (!m) return '';
    var L = [];
    L.push('佐证材料元信息');
    L.push('='.repeat(30));
    L.push('文件名称：' + m.name);
    L.push('材料编号：' + m.id);
    L.push('文件类型：' + String(m.ext).toUpperCase() + '　大小：' + fmtSize(m.size));
    L.push('要素分类：' + (CAT_BY[m.cat] ? CAT_BY[m.cat].label : m.cat));
    L.push('当前版本：' + m.version);
    L.push('归核状态：' + m.status + '（' + m.verify + '）');
    L.push('上传人：' + m.uploader + '　上传时间：' + m.time);
    L.push('识别匹配度：' + m.matched + '%');
    L.push('关联条款：' + ((m.clauses || []).map(function (c) { return c.label; }).join('、') || '未归类'));
    if (m.note) L.push('备注说明：' + m.note);
    L.push('');
    L.push('版本历史');
    L.push('-'.repeat(30));
    (m.versions || []).forEach(function (v) { L.push('  ' + v.v + '  ' + v.date + '  ' + v.by + '  ' + (v.desc || '')); });
    L.push('');
    L.push('操作记录');
    L.push('-'.repeat(30));
    (m.logs || []).forEach(function (g) { L.push('  ' + g.t + '  ' + g.who + '  ' + g.act + '  ' + g.note); });
    return L.join('\n');
  }

  function resetUser() {
    user = { added: [], patches: {}, removed: [], extraLogs: {}, extraVer: {} };
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    emit();
  }

  global.EVIDENCE = {
    CATS: CATS, CAT_BY: CAT_BY, STATUSES: STATUSES, ST: ST, EVIDENCE_LINES: EVIDENCE_LINES,
    WEEK_FROM: WEEK_FROM,
    getAll: getAll, byId: byId, forClause: forClause, clauseStats: clauseStats,
    catCounts: catCounts, statusCounts: statusCounts, stats: stats,
    add: add, patch: patch, remove: remove, pushVersion: pushVersion, addLog: addLog,
    guess: guess, guessClause: guessClause,
    recommend: recommend, clauseLabel: clauseLabel, lineOf: lineOf, toText: toText,
    fmtSize: fmtSize, iconOf: iconOf, extOf: extOf, nowStamp: nowStamp, keywordsOf: keywordsOf,
    on: on, resetUser: resetUser
  };
  global.EV = global.EVIDENCE;

})(window);
