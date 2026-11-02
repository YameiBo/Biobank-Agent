/* ==========================================================================
   条款自评 — 数据驱动层
   --------------------------------------------------------------------------
   两个来源：
     · 从「CNAS 条款库 → 条款详情 → 去自评」带参进入：
         self-assessment.html?lib=cl10&id=7.5.4
     · 从侧栏直接进入：默认 ISO 20387 首条

   能力：
     · 标准库切换（ISO 20387 / CNAS-CL10），条数、统计、清单全部随库变化
     · 章节导航（可搜索）+ 条款工作区（标准解读 + 五类评审方式 + 自评填写）
     · 条款清单：按类别 / 状态筛选、搜索、按负责人与结果过滤、真实分页

   数据源：assets/clause-lib.js（条款）、assets/clause-reading.js（解读与评审方式）
   自评状态为演示数据：显式覆盖 + 稳定哈希分配，保证同一条款每次刷新结果一致。
   ========================================================================== */
(function () {
  'use strict';

  var CL = window.CLAUSE_LIB;
  var CR = window.CLAUSE_READING;
  var EV = window.EVIDENCE;          /* 佐证材料数据源：与材料归档页同源 */
  if (!CL) return;

  var CUSTOM_KEY = 'cnas_custom_clauses_v1';
  var PEOPLE = ['张三', '孙七', '李四', '王五', '赵六', '周八', '吴九', '郑十'];
  var DUE_POOL = ['2026-11-15', '2026-11-30', '2026-12-15', '2026-12-20', '2026-12-25', '2026-12-30'];

  /* ---------- 状态口径 ---------- */
  var ST = {
    done:  { result: '符合',     state: '已完成', rt: 'tag-success', st: 'tag-success', dot: 'done'  },
    doing: { result: '部分符合', state: '进行中', rt: 'tag-warning', st: 'tag-warning', dot: 'doing' },
    nc:    { result: '不符合',   state: '需整改', rt: 'tag-error',   st: 'tag-error',   dot: 'nc'    },
    todo:  { result: '—',        state: '未开始', rt: 'tag-default', st: 'tag-default', dot: ''      }
  };

  /* ISO 库保留原演示数据的 10 条显式状态，其余按配额补齐 */
  var OVERRIDE = {
    iso20387: {
      '4.1': { st: 'done',  result: '符合',     owner: '张三',   assessor: '李四',   due: '2026-11-30' },
      '4.2': { st: 'done',  result: '符合',     owner: '张三',   assessor: '王五',   due: '2026-11-30' },
      '5.1': { st: 'done',  result: '符合',     owner: '张三',   assessor: '李四',   due: '2026-11-15' },
      '5.2': { st: 'doing', result: '部分符合', owner: '张三',   assessor: '赵六',   due: '2026-12-15' },
      '6.1': { st: 'done',  result: '符合',     owner: '孙七',   assessor: '周八',   due: '2026-11-30' },
      '6.2': { st: 'doing', result: '部分符合', owner: '孙七',   assessor: '吴九',   due: '2026-12-15' },
      '6.3': { st: 'doing', result: '部分符合', owner: '孙七',   assessor: '郑十',   due: '2026-12-20' },
      '6.4': { st: 'todo',  result: '—',        owner: '孙七',   assessor: '未分配', due: '2026-12-25' },
      '6.5': { st: 'todo',  result: '—',        owner: '未分配', assessor: '未分配', due: '2026-12-30' },
      '8.3': { st: 'nc',    result: '不符合',   owner: '张三',   assessor: '李四',   due: '2026-11-30' }
    }
  };

  /* 五类评审方式的「自查 / 备证动作」模板（{name} 替换为条款名） */
  var ACTIONS = {
    '查阅文件': [
      '备齐覆盖「{name}」的程序文件 / 作业指导书，确认受控发布、版本现行、批准签署齐全',
      '整理「{name}」相关记录表最近 3 个月的填写记录，确保完整、及时、有签字',
      '核对文件规定与实际执行口径是否一致，不一致处准备书面说明'
    ],
    '访谈调查': [
      '安排岗位人员接受访谈：说清自己在「{name}」中的职责与日常做法',
      '备好培训签到、考核与授权记录，证明人员知悉最新要求',
      '准备最近一次异常 / 变更时的处理过程与上报路径说明'
    ],
    '跟踪核实': [
      '任取一条与「{name}」相关的记录，沿流程正向追踪至归档，核实时限与条件控制',
      '反向从结果倒查至原始记录，验证信息可追溯、记录链能闭合',
      '梳理跨岗位 / 跨部门交接处的接口记录，确认责任清晰'
    ],
    '现场演示': [
      '确定现场演示「{name}」所涉关键步骤的岗位与人员',
      '演练时确保实际动作与文件规定一致，重点覆盖偏差与应急场景',
      '准备演示所需的设备、耗材与记录表单，避免现场临时找'
    ],
    '现场试验': [
      '核对与「{name}」相关的设备校准 / 验证状态是否在有效期内',
      '准备一次现场测试或比对所需的条件与记录表格',
      '整理质控数据的评价结论与处置记录，确保闭环'
    ]
  };

  /* ---------- 工具 ---------- */
  /* FNV-1a + murmur3 尾混合：纯 FNV-1a 的低位对短字符串分布退化
     （实测 h%4 恒为 0，会让"自评人"整列落进同一个分支），必须做一次 finalizer。 */
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function toList(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).split(/[\n,，;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; } catch (e) { return []; }
  }

  /* ---------- 数据构建 ---------- */
  var ITEMS = {};   /* libKey -> 条款数组 */
  var REC = {};     /* libKey -> { id: 自评记录 } */

  function itemsOf(libKey) {
    var base = CL.get(libKey).slice();
    var seen = {};
    base.forEach(function (x) { seen[x.id] = 1; });
    loadCustom().forEach(function (x) {
      if (x.lib !== libKey || seen[x.id]) return;
      seen[x.id] = 1;
      base.push({
        id: x.id, name: x.name, ch: x.ch, chName: x.chName || '',
        sec: x.sec, secName: x.secName || '', cat: x.cat || CL.catOf(x.ch),
        lib: libKey, text: x.text || '', points: x.points || [], custom: true
      });
    });
    return base;
  }

  function buildRec(libKey, items) {
    var n = items.length;
    var nc = Math.max(1, Math.round(n * 0.03));
    var done = Math.round(n * 0.37);
    var doing = Math.round(n * 0.33);
    var todo = Math.max(0, n - nc - done - doing);
    var ov = OVERRIDE[libKey] || {};
    var used = { done: 0, doing: 0, nc: 0, todo: 0 };
    items.forEach(function (x) { if (ov[x.id]) used[ov[x.id].st]++; });
    var need = {
      done: Math.max(0, done - used.done),
      doing: Math.max(0, doing - used.doing),
      nc: Math.max(0, nc - used.nc),
      todo: Math.max(0, todo - used.todo)
    };
    var rest = items.filter(function (x) { return !ov[x.id]; })
      .sort(function (a, b) {
        var ha = hash(libKey + '|' + a.id), hb = hash(libKey + '|' + b.id);
        return ha < hb ? -1 : (ha > hb ? 1 : 0);
      });

    var order = [];
    ['done', 'doing', 'nc', 'todo'].forEach(function (k) {
      for (var i = 0; i < need[k]; i++) order.push(k);
    });
    while (order.length < rest.length) order.push('todo');

    var map = {};
    items.forEach(function (x) {
      var o = ov[x.id];
      if (!o) return;
      map[x.id] = { st: o.st, result: o.result, owner: o.owner, assessor: o.assessor, due: o.due, st_meta: ST[o.st] };
    });
    rest.forEach(function (x, i) {
      var st = order[i] || 'todo';
      var h = hash(libKey + '#' + x.id);
      map[x.id] = {
        st: st,
        result: ST[st].result,
        owner: (st === 'todo' && h % 5 === 0) ? '未分配' : pick(PEOPLE, h),
        assessor: (h % 4 === 0) ? '未分配' : pick(PEOPLE, h >>> 3),
        due: pick(DUE_POOL, h >>> 5),
        st_meta: ST[st]
      };
    });
    return map;
  }

  function ensure(libKey) {
    if (!ITEMS[libKey]) {
      ITEMS[libKey] = itemsOf(libKey);
      REC[libKey] = buildRec(libKey, ITEMS[libKey]);
    }
    return ITEMS[libKey];
  }

  function statsOf(libKey) {
    var rec = REC[libKey], out = { total: 0, done: 0, doing: 0, nc: 0, todo: 0 };
    Object.keys(rec).forEach(function (k) { out.total++; out[rec[k].st]++; });
    return out;
  }

  function findItem(libKey, id) {
    return ensure(libKey).filter(function (x) { return x.id === id; })[0] || null;
  }

  /* ---------- 页面状态 ---------- */
  var params = new URLSearchParams(location.search);
  var state = {
    lib: 'iso20387',
    id: '',
    kw: '',           /* 条款导航搜索 */
    filter: 'all',    /* 清单筛选 */
    tkw: '',          /* 清单搜索 */
    owner: '全部负责人',
    result: '全部结果',
    page: 1,
    per: 10,
    pane: 'std'
  };

  /* ---------- 渲染：概览 ---------- */
  function renderKpi() {
    var s = statsOf(state.lib);
    var libMeta = CL.libs[state.lib];
    var pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    $('sa-kpi-total').innerHTML = s.total + '<span class="stat-unit">条</span>';
    $('sa-kpi-total-meta').textContent = libMeta.name + ' 全部条款';
    $('sa-kpi-done').innerHTML = s.done + '<span class="stat-unit">条</span>';
    $('sa-kpi-done-meta').innerHTML = '<span class="pos">占比 ' + pct + '%</span>';
    $('sa-kpi-doing').innerHTML = s.doing + '<span class="stat-unit">条</span>';
    $('sa-kpi-doing-meta').textContent = '待继续推进';
    $('sa-kpi-nc').innerHTML = s.nc + '<span class="stat-unit">条</span>';
    $('sa-kpi-nc-meta').innerHTML = s.nc ? '<span class="neg">需整改</span>' : '暂无不符合项';
    $('sa-desc').textContent = '基于 ' + libMeta.name + ' 全部 ' + s.total + ' 条条款，逐条提交自评结论、证据材料与整改记录';
  }

  /* ---------- 渲染：条款导航 ---------- */
  function renderNav() {
    var items = ensure(state.lib), rec = REC[state.lib];
    var kw = state.kw.trim().toLowerCase();
    var html = '', shown = 0;
    CL.libs[state.lib].chapters.forEach(function (c) {
      var list = items.filter(function (x) { return x.ch === c.ch; });
      if (kw) list = list.filter(function (x) { return (x.id + ' ' + x.name).toLowerCase().indexOf(kw) >= 0; });
      if (!list.length) return;
      shown += list.length;
      html += '<div style="padding:7px 16px; font-size:12px; color:var(--text-secondary);">⌄ 第 ' + esc(c.ch) + ' 章 ' + esc(c.name) + '</div>';
      list.forEach(function (x) {
        var st = rec[x.id] ? rec[x.id].st : 'todo';
        html += '<button class="sidebar-clause' + (x.id === state.id ? ' active' : '') + '" type="button" data-sa-go="' + esc(x.id) + '" title="' + esc(x.id + ' ' + x.name) + '">' +
          '<span class="clause-status ' + ST[st].dot + '"></span>' +
          '<strong>' + esc(x.id) + '</strong><span>' + esc(x.name) + '</span></button>';
      });
    });
    $('sa-nav').innerHTML = html || '<div style="padding:12px 16px; font-size:12px; color:var(--text-tertiary);">没有匹配的条款</div>';
    $('sa-nav-count').textContent = kw ? '命中 ' + shown + ' 条' : '共 ' + items.length + ' 条';
  }

  /* ---------- 渲染：条款工作区 ---------- */
  function noteOf(rec) {
    if (rec.st === 'done') return '已建立对应程序文件并完成年度评审。';
    if (rec.st === 'doing') return '程序文件已发布，相关记录仍在补充与核验中。';
    if (rec.st === 'nc') return '相关记录不完整，已制定整改计划并跟踪落实。';
    return '';
  }

  /* ---------- 佐证材料区（数据驱动，与材料归档页同源） ----------
     2026-09-23：原来这里是三条用条款名拼出来的假文件名 + 一个只弹 toast 的拖拽区，
     点不出任何东西。现在改为真实材料列表（可点开材料详情弹窗）+ 证据链覆盖 +
     缺口提示 + 智能推荐关联 + 统一上传入口。任一页改动，另一页即时一致。 */
  function evRow(m) {
    var st = EV.ST[m.status] || EV.ST['已归档'];
    return '<div class="sa-ev-row" data-sa-ev="' + esc(m.id) + '" title="点击查看材料详情">' +
      '<div class="ic">' + EV.iconOf(m) + '</div>' +
      '<div class="meta">' +
        '<div class="nm">' + esc(m.name) + '</div>' +
        '<div class="sub">' + EV.fmtSize(m.size) + ' · ' + esc(m.version) + ' · ' +
          esc(m.uploader) + ' · ' + esc(m.time) + ' · 匹配度 ' + m.matched + '%</div>' +
      '</div>' +
      '<span class="tag ' + st.tag + '">' + esc(m.status) + '</span>' +
      '<span class="btn-text">查看</span>' +
    '</div>';
  }

  function evidenceBlock(item) {
    if (!EV) return '';
    var lib = state.lib, cid = item.id;
    var s = EV.clauseStats(lib, cid);
    var lines = EV.EVIDENCE_LINES || [];
    var covered = {};
    s.list.forEach(function (m) { covered[EV.lineOf(m)] = 1; });
    var miss = lines.filter(function (l) { return !covered[l]; });

    var head = '<div class="sa-ev-head">' +
      '<span class="ttl">已关联佐证材料</span>' +
      '<span class="tag tag-primary">' + s.total + ' 份 · 已归档 ' + s.archived +
        (s.pending ? ' · 待处理 ' + s.pending : '') +
        (s.returned ? ' · 已退回 ' + s.returned : '') + '</span>' +
      '<span class="sp"></span>' +
      '<a class="btn btn-sm" href="archive.html">材料归档页 →</a>' +
    '</div>';

    var lineBar = '<div class="sa-ev-lines"><span class="lb">证据链覆盖</span>' +
      lines.map(function (l) {
        return '<span class="sa-line' + (covered[l] ? ' ok' : '') + '">' +
          (covered[l] ? '✓' : '○') + ' ' + l + '</span>';
      }).join('') +
      '<span class="ln">' + s.covered + ' / ' + lines.length + '</span></div>';

    var body = s.total
      ? '<div class="sa-ev-list">' + s.list.map(evRow).join('') + '</div>'
      : '<div class="sa-ev-empty">该条款尚未关联任何佐证材料 —— 评审时无法提供文件与记录，会被直接判为不符合。</div>';

    var gap = '';
    if (s.returned || s.pending || miss.length) {
      gap = '<div class="sa-ev-gap">' +
        (s.returned ? '<div>· ' + s.returned + ' 份材料已退回，需换版后重新提交。</div>' : '') +
        (s.pending ? '<div>· ' + s.pending + ' 份材料待复核，核验通过后才算有效证据。</div>' : '') +
        (miss.length ? '<div>· 缺口：' + miss.map(function (l) { return '<strong>' + l + '</strong>'; }).join('、') +
          ' 尚无对应材料。</div>' : '') +
      '</div>';
    } else if (s.total) {
      gap = '<div class="sa-ev-ok">✓ 五条证据线均已覆盖，材料状态有效。</div>';
    }

    /* 智能推荐：材料不足或缺证据线时，从已有材料里挑可能相关的 */
    var recHtml = '';
    if (miss.length || s.total === 0) {
      var recs = EV.recommend(lib, cid, 3) || [];
      if (recs.length) {
        recHtml = '<div class="sa-ev-rec"><div class="hd">💡 可能相关，建议关联' +
          (s.total ? '（用于补齐缺口）' : '') + '</div>' +
          recs.map(function (m) {
            return '<div class="sa-rec-row">' +
              '<div class="meta"><div class="nm">' + EV.iconOf(m) + ' ' + esc(m.name) + '</div>' +
              '<div class="sub">' + EV.fmtSize(m.size) + ' · ' + esc(m.uploader) +
                ' · 匹配度 ' + m.matched + '%' + (m.__loose ? ' · 低置信度建议' : '') + '</div></div>' +
              '<button class="btn btn-sm" data-sa-link="' + esc(m.id) + '">关联本条款</button>' +
            '</div>';
          }).join('') + '</div>';
      }
    }

    var drop = '<div class="sa-drop" data-sa-drop="' + esc(item.id) + '">' +
      '<div style="font-size:20px;">📤</div>' +
      '<div style="font-size:12px; margin-top:4px; color:var(--text-secondary);">点击或拖拽文件到此处 —— 自动识别并直接归入「' + esc(item.id + ' ' + item.name) + '」</div>' +
      '<button class="btn btn-sm btn-upload" style="margin-top:8px;" data-sa-upload data-code="' + esc(item.id) + '" data-name="' + esc(item.name) + '">选择文件</button>' +
    '</div>';

    return '<div class="sa-ev">' + head + lineBar + body + gap + recHtml + drop + '</div>';
  }

  /* 拖拽到本条款：识别文件名 → 直接关联当前条款入库 */
  function dropToClause(cid, files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length || !EV) return;
    var lb = EV.clauseLabel(state.lib, cid);
    list.forEach(function (f) {
      var g = EV.guess(f.name);
      EV.add({
        name: f.name, size: f.size, ext: EV.extOf(f.name),
        cat: g.cat, matched: g.matched,
        clauses: lb ? [lb] : g.clauses,
        status: lb ? '待复核' : g.status,
        uploader: '质量管理员',
        note: lb ? '自评页拖拽上传，直接归入「' + lb.label + '」'
                 : '自评页拖拽上传，未匹配到条款，待人工归类'
      });
    });
    if (window.showToast) {
      showToast('已入库 ' + list.length + ' 份材料' +
        (lb ? '并关联「' + lb.label + '」，状态待复核' : '，未匹配到条款，待人工归类'),
        lb ? 'success' : 'info');
    }
  }

  function renderDetail() {
    var item = findItem(state.lib, state.id);
    if (!item) { $('sa-detail').innerHTML = '<div style="padding:24px; font-size:13px; color:var(--text-tertiary);">未找到条款</div>'; return; }
    var libName = CL.libs[state.lib].name;
    var rec = REC[state.lib][item.id] || { st: 'todo', result: '—', owner: '未分配', assessor: '未分配', due: '', st_meta: ST.todo };
    var meta = ST[rec.st];
    var text = item.text || ('应按 ' + libName + ' 第 ' + item.ch + ' 章要求，对「' + item.name + '」建立文件化程序、明确岗位职责，并保留可追溯的实施记录。');
    var reading = (CR && CR.build) ? CR.build({
      id: item.id, name: item.name, lib: state.lib, ch: item.ch, chName: item.chName,
      sec: item.sec, secName: item.secName, text: text, points: item.points
    }, libName) : { interp: [], methods: [] };

    var methods = reading.methods || [];
    var stPane = state.pane;
    if (stPane !== 'std' && methods.map(function (_, i) { return 'm' + i; }).indexOf(stPane) < 0) stPane = 'std';

    /* --- 头部 --- */
    var head =
      '<div style="padding:16px 20px 12px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; gap:14px; align-items:flex-start;">' +
        '<div style="min-width:0;">' +
          '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">' +
            '<span style="font-family:monospace; font-size:14px; font-weight:600; color:var(--primary);">' + esc(item.id) + '</span>' +
            '<strong style="font-size:15px;">' + esc(item.name) + '</strong>' +
            '<span class="tag tag-primary">' + esc(item.cat) + '要求</span>' +
            (item.custom ? '<span class="tag tag-success">自定义条款</span>' : '') +
          '</div>' +
          '<div style="font-size:12px; line-height:1.7; color:var(--text-tertiary);">' + esc(text) + '</div>' +
          '<div style="font-size:11.5px; color:var(--text-tertiary); margin-top:5px;">' + esc(libName) + ' · 第 ' + esc(item.ch) + ' 章 ' + esc(item.chName) + ' › ' + esc(item.sec) + ' ' + esc(item.secName) + '</div>' +
        '</div>' +
        '<div style="display:flex; gap:6px; flex-shrink:0;">' +
          '<span class="tag ' + meta.st + '">' + meta.state + '</span>' +
          '<span class="tag ' + meta.rt + '">' + meta.result + '</span>' +
        '</div>' +
      '</div>';

    /* --- 页签 --- */
    var tabs = '<div class="tabs" style="padding:0 20px; border-bottom:1px solid var(--border-light);" id="sa-tabs">' +
      '<div class="tab' + (stPane === 'std' ? ' active' : '') + '" data-sa-pane="std">标准解读</div>' +
      methods.map(function (m, i) {
        return '<div class="tab' + (stPane === 'm' + i ? ' active' : '') + '" data-sa-pane="m' + i + '">' +
          m.icon + ' ' + esc(m.n) + (m.main ? '<span class="sa-main-dot" title="建议主用"></span>' : '') + '</div>';
      }).join('') +
    '</div>';

    /* --- 内容 --- */
    function shell(inner) { return '<div style="padding:16px 20px;">' + inner + '</div>'; }

    var stdPane = shell(
      '<div style="background:var(--primary-50); border:1px solid #D7E6FF; border-radius:8px; padding:12px 14px; font-size:12px; line-height:1.85; color:var(--text-secondary);">' +
        '<strong style="display:block; color:var(--primary-dark); margin-bottom:5px;">【标准解读】</strong>' +
        (reading.interp.length
          ? reading.interp.map(function (p) { return '<p style="margin:0 0 6px;">' + esc(p) + '</p>'; }).join('')
          : '<p style="margin:0;">暂无解读内容。</p>') +
      '</div>' +
      '<div style="font-size:12px; line-height:1.9; color:var(--text-secondary); margin-top:12px;">' +
        '<strong style="color:var(--text-primary);">评审要点</strong>' +
        (toList(item.points).length
          ? '<div style="margin-top:6px;">' + toList(item.points).map(function (p, i) { return (i + 1) + '. ' + esc(p); }).join('<br>') + '</div>'
          : '<div style="margin-top:6px; color:var(--text-tertiary);">该条款未单独列出评审要点，按标准原文与条款解读执行。</div>') +
      '</div>'
    );

    var methodPanes = methods.map(function (m, i) {
      var acts = (ACTIONS[m.n] || []).map(function (a) { return a.replace(/\{name\}/g, item.name); });
      var inner =
        '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +
          '<span style="font-size:13px; font-weight:600; color:var(--text-primary);">' + m.icon + ' 【' + esc(m.n) + '】</span>' +
          (m.main ? '<span class="tag tag-primary">建议主用</span>' : '<span class="tag tag-default">配合使用</span>') +
        '</div>' +
        '<div style="font-size:12px; line-height:1.8; color:var(--text-tertiary);">' + esc(m.desc) + '</div>' +
        (m.focus ? '<div style="margin-top:10px; padding:9px 12px; border-radius:8px; background:var(--primary-lighter); font-size:12px; line-height:1.8; color:var(--primary-dark);"><strong>本条重点：</strong>' + esc(m.focus) + '</div>' : '') +
        '<div style="margin-top:12px; font-size:12px; font-weight:600; color:var(--text-primary);">自查 / 备证动作</div>' +
        '<div style="font-size:12px; line-height:1.95; color:var(--text-secondary); margin-top:6px;">' +
          acts.map(function (a, k) { return '<div style="display:flex; gap:7px;"><span style="color:var(--primary);">' + (k + 1) + '.</span><span>' + esc(a) + '</span></div>'; }).join('') +
        '</div>';

      if (m.n === '查阅文件') {
        inner += evidenceBlock(item);
      }
      return '<div data-sa-pane-body="m' + i + '"' + (stPane === 'm' + i ? '' : ' style="display:none;"') + '>' + shell(inner) + '</div>';
    }).join('');

    var stdWrap = '<div data-sa-pane-body="std"' + (stPane === 'std' ? '' : ' style="display:none;"') + '>' + stdPane + '</div>';

    /* --- 自评结果填写 --- */
    var checked = function (v) { return rec.result === v ? ' checked' : ''; };
    var foot =
      '<div class="sa-form">' +
        '<div style="border:1px solid var(--border-light); border-radius:8px; padding:12px;">' +
          '<div style="font-size:12px; font-weight:600; margin-bottom:8px;">自评结果填写</div>' +
          '<div style="display:flex; gap:14px; font-size:12px; color:var(--text-secondary); flex-wrap:wrap;">' +
            '<label><input type="radio" name="sa-result" value="符合"' + checked('符合') + ' /> 符合 (Y)</label>' +
            '<label><input type="radio" name="sa-result" value="部分符合"' + checked('部分符合') + ' /> 部分符合 (P)</label>' +
            '<label><input type="radio" name="sa-result" value="不符合"' + checked('不符合') + ' /> 不符合 (N)</label>' +
            '<label><input type="radio" name="sa-result" value="不适用"' + checked('不适用') + ' /> 不适用 (NA)</label>' +
          '</div>' +
          '<textarea class="input" id="sa-note" rows="2" style="width:100%; margin-top:10px; resize:vertical;" placeholder="填写自评说明或整改计划…">' + esc(noteOf(rec)) + '</textarea>' +
        '</div>' +
        '<div style="display:flex; flex-direction:column; justify-content:flex-end; gap:8px;">' +
          '<button class="btn btn-primary" data-sa-save data-code="' + esc(item.id) + '" data-name="' + esc(item.name) + '">💾 保存自评结果</button>' +
          '<button class="btn btn-upload" data-sa-upload data-code="' + esc(item.id) + '" data-name="' + esc(item.name) + '">📤 上传佐证材料</button>' +
        '</div>' +
      '</div>';

    $('sa-detail').innerHTML = head + tabs + '<div id="sa-panes">' + stdWrap + methodPanes + '</div>' + foot;
  }

  /* ---------- 渲染：清单筛选 tab ---------- */
  function renderFilters() {
    var s = statsOf(state.lib);
    var items = ensure(state.lib);
    var mg = items.filter(function (x) { return x.cat === '管理'; }).length;
    var tt = items.length - mg;
    var defs = [
      ['all', '全部', s.total, 'tag-default'],
      ['management', '管理要求', mg, 'tag-default'],
      ['technical', '技术要求', tt, 'tag-default'],
      ['done', '已完成', s.done, 'tag-success'],
      ['doing', '进行中', s.doing, 'tag-warning'],
      ['nc', '需整改', s.nc, 'tag-error'],
      ['todo', '未开始', s.todo, 'tag-default']
    ];
    $('sa-filters').innerHTML = defs.map(function (d) {
      return '<div class="tab' + (state.filter === d[0] ? ' active' : '') + '" data-sa-filter="' + d[0] + '">' +
        d[1] + ' <span class="tag ' + d[3] + '" style="margin-left:4px;">' + d[2] + '</span></div>';
    }).join('');
  }

  /* ---------- 渲染：清单表格 ---------- */
  function filtered() {
    var items = ensure(state.lib), rec = REC[state.lib];
    var kw = state.tkw.trim().toLowerCase();
    return items.filter(function (x) {
      var r = rec[x.id] || { st: 'todo' };
      if (state.filter === 'management' && x.cat !== '管理') return false;
      if (state.filter === 'technical' && x.cat !== '技术') return false;
      if (['done', 'doing', 'nc', 'todo'].indexOf(state.filter) >= 0 && r.st !== state.filter) return false;
      if (kw && (x.id + ' ' + x.name).toLowerCase().indexOf(kw) < 0) return false;
      if (state.owner !== '全部负责人' && r.owner !== state.owner) return false;
      if (state.result !== '全部结果') {
        var want = state.result === '未填写' ? '—' : state.result;
        if (r.result !== want) return false;
      }
      return true;
    });
  }

  function renderTable() {
    var rec = REC[state.lib];
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / state.per));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.per;
    var rows = list.slice(start, start + state.per);

    $('sa-tbody').innerHTML = rows.length ? rows.map(function (x) {
      var r = rec[x.id] || { st: 'todo', result: '—', owner: '未分配', assessor: '未分配', due: '', st_meta: ST.todo };
      var meta = ST[r.st];
      return '<tr' + (x.id === state.id ? ' class="sa-row-on"' : '') + '>' +
        '<td><div class="checkbox"></div></td>' +
        '<td><strong>' + esc(x.id) + '</strong></td>' +
        '<td>' + esc(x.name) + '</td>' +
        '<td>' + esc(r.owner) + '</td><td>' + esc(r.assessor) + '</td><td>' + esc(r.due || '—') + '</td>' +
        '<td><span class="tag ' + meta.rt + '">' + meta.result + '</span></td>' +
        '<td><span class="tag ' + meta.st + '">' + meta.state + '</span></td>' +
        '<td class="col-actions">' +
          (r.st === 'nc'
            ? '<button class="btn-text" data-sa-go="' + esc(x.id) + '">详情</button> · <button class="btn-text" data-sa-go="' + esc(x.id) + '">整改</button>'
            : '<button class="btn-text" data-sa-go="' + esc(x.id) + '">' + (r.st === 'todo' ? '开始自评' : '详情') + '</button>') +
        '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="9" style="text-align:center; padding:28px 0; color:var(--text-tertiary); font-size:12.5px;">没有符合条件的条款</td></tr>';

    /* 分页 */
    var btns = [];
    btns.push('<span>共 ' + list.length + ' 条</span>');
    btns.push('<button class="btn btn-sm" data-sa-page="prev"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>');
    var from = Math.max(1, state.page - 2), to = Math.min(pages, from + 4);
    from = Math.max(1, to - 4);
    if (from > 1) {
      btns.push('<button class="btn btn-sm" data-sa-page="1">1</button>');
      if (from > 2) btns.push('<span style="padding:0 4px; color:var(--text-tertiary);">…</span>');
    }
    for (var i = from; i <= to; i++) {
      btns.push('<button class="btn btn-sm' + (i === state.page ? ' active' : '') + '" data-sa-page="' + i + '">' + i + '</button>');
    }
    if (to < pages) {
      if (to < pages - 1) btns.push('<span style="padding:0 4px; color:var(--text-tertiary);">…</span>');
      btns.push('<button class="btn btn-sm" data-sa-page="' + pages + '">' + pages + '</button>');
    }
    btns.push('<button class="btn btn-sm" data-sa-page="next"' + (state.page === pages ? ' disabled' : '') + '>›</button>');
    btns.push('<select class="select" id="sa-per" style="width:88px;">' +
      [10, 20, 50].map(function (p) { return '<option value="' + p + '"' + (state.per === p ? ' selected' : '') + '>' + p + '条/页</option>'; }).join('') +
      '</select>');
    $('sa-pager').innerHTML = btns.join('');

    /* 行内复选框（app.js 只在加载时绑定，动态行需自行绑定） */
    $('sa-tbody').querySelectorAll('.checkbox').forEach(function (cb) {
      cb.addEventListener('click', function (e) { e.stopPropagation(); cb.classList.toggle('checked'); });
    });
  }

  /* ---------- 渲染：负责人下拉 ---------- */
  function renderOwnerOptions() {
    var rec = REC[state.lib];
    var names = ['全部负责人'];
    ensure(state.lib).forEach(function (x) {
      var o = rec[x.id] && rec[x.id].owner;
      if (o && o !== '未分配' && names.indexOf(o) < 0) names.push(o);
    });
    var sel = $('sa-owner');
    sel.innerHTML = names.map(function (n) { return '<option' + (state.owner === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
  }

  /* ---------- 总渲染 ---------- */
  function renderAll() {
    renderKpi();
    renderNav();
    renderDetail();
    renderFilters();
    renderOwnerOptions();
    renderTable();
  }

  /* ---------- 条款切换 ---------- */
  function selectClause(id, opts) {
    if (!findItem(state.lib, id)) return;
    state.id = id;
    state.pane = 'std';
    renderNav();
    renderDetail();
    if (opts && opts.scrollUp) {
      var box = $('sa-detail');
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- 库切换 ---------- */
  function renderLibSelect() {
    var sel = $('sa-lib');
    sel.innerHTML = Object.keys(CL.libs).map(function (k) {
      return '<option value="' + k + '"' + (state.lib === k ? ' selected' : '') + '>' + esc(CL.libs[k].name) + '</option>';
    }).join('');
  }

  function switchLib(k) {
    if (!CL.libs[k] || k === state.lib) return;
    state.lib = k;
    state.page = 1;
    state.filter = 'all';
    state.kw = '';
    state.owner = '全部负责人';
    state.result = '全部结果';
    state.pane = 'std';
    $('sa-search').value = '';
    $('sa-table-search').value = '';
    $('sa-result').value = '全部结果';
    ensure(k);
    state.id = ITEMS[k][0] ? ITEMS[k][0].id : '';
    renderLibSelect();
    renderAll();
    var u = new URL(location.href);
    u.searchParams.set('lib', state.lib);
    if (state.id) u.searchParams.set('id', state.id); else u.searchParams.delete('id');
    history.replaceState(null, '', u.pathname + u.search);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-sa-go]');
    if (go) {
      e.preventDefault();
      selectClause(go.getAttribute('data-sa-go'), { scrollUp: !!go.closest('#sa-tbody') });
      return;
    }
    var pg = e.target.closest('[data-sa-page]');
    if (pg) {
      var v = pg.getAttribute('data-sa-page');
      var pages = Math.max(1, Math.ceil(filtered().length / state.per));
      if (v === 'prev') state.page = Math.max(1, state.page - 1);
      else if (v === 'next') state.page = Math.min(pages, state.page + 1);
      else state.page = parseInt(v, 10) || 1;
      renderTable();
      return;
    }
    var ft = e.target.closest('[data-sa-filter]');
    if (ft) {
      state.filter = ft.getAttribute('data-sa-filter');
      state.page = 1;
      renderFilters();
      renderTable();
      return;
    }
    var tb = e.target.closest('[data-sa-pane]');
    if (tb) {
      state.pane = tb.getAttribute('data-sa-pane');
      document.querySelectorAll('#sa-tabs .tab').forEach(function (t) { t.classList.toggle('active', t === tb); });
      document.querySelectorAll('[data-sa-pane-body]').forEach(function (p) {
        p.style.display = (p.getAttribute('data-sa-pane-body') === state.pane) ? '' : 'none';
      });
      return;
    }
    var sv = e.target.closest('[data-sa-save]');
    if (sv) {
      var item = findItem(state.lib, state.id);
      var picked = document.querySelector('input[name="sa-result"]:checked');
      if (window.showToast) {
        showToast('已保存「' + (item ? item.id + ' ' + item.name : '') + '」自评结果' + (picked ? '：' + picked.value : ''), 'success');
      }
      return;
    }
    /* 点材料行 → 打开材料详情弹窗（真实可操作：预览 / 版本 / 关联条款 / 操作记录） */
    var ev = e.target.closest('[data-sa-ev]');
    if (ev) {
      if (window.openModal) openModal('evidence-detail', { id: ev.getAttribute('data-sa-ev') });
      return;
    }

    /* 智能推荐 → 关联本条款 */
    var sl = e.target.closest('[data-sa-link]');
    if (sl) {
      var mid = sl.getAttribute('data-sa-link');
      var lb = EV && EV.clauseLabel(state.lib, state.id);
      var mm = EV && EV.byId(mid);
      if (!lb || !mm) return;
      var arr = (mm.clauses || []).slice();
      if (arr.some(function (c) { return c.lib === lb.lib && c.id === lb.id; })) {
        if (window.showToast) showToast('该材料已关联本条款', 'info');
        return;
      }
      arr.push(lb);
      var patch = { clauses: arr };
      if (mm.status === '待归类') patch.status = '待复核';
      EV.patch(mid, patch);
      EV.addLog(mid, { who: '质量管理员', act: '关联条款', note: '自评页关联「' + lb.label + '」' });
      if (window.showToast) showToast('已关联「' + lb.label + '」', 'success');
      return;
    }

    /* 上传入口统一走佐证材料上传弹窗（与归档页同一个，预置当前条款） */
    var up = e.target.closest('[data-sa-upload]');
    if (up) {
      var it = findItem(state.lib, state.id);
      if (window.openModal) {
        openModal('evidence-upload', {
          clause: state.id + (it ? ' ' + it.name : ''),
          lib: state.lib, cid: state.id
        });
      }
      return;
    }
  });

  /* 拖拽上传：委托到 document，页面重渲染后依然有效 */
  document.addEventListener('dragover', function (e) {
    var dz = e.target.closest && e.target.closest('[data-sa-drop]');
    if (!dz) return;
    e.preventDefault(); e.stopPropagation();
    dz.classList.add('hot');
  });
  document.addEventListener('dragleave', function (e) {
    var dz = e.target.closest && e.target.closest('[data-sa-drop]');
    if (dz) dz.classList.remove('hot');
  });
  document.addEventListener('drop', function (e) {
    var dz = e.target.closest && e.target.closest('[data-sa-drop]');
    if (!dz) return;
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('hot');
    dropToClause(dz.getAttribute('data-sa-drop'), e.dataTransfer && e.dataTransfer.files);
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'sa-search') { state.kw = e.target.value; renderNav(); }
    if (e.target.id === 'sa-table-search') { state.tkw = e.target.value; state.page = 1; renderTable(); }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'sa-owner') { state.owner = e.target.value; state.page = 1; renderTable(); }
    if (e.target.id === 'sa-result') { state.result = e.target.value; state.page = 1; renderTable(); }
    if (e.target.id === 'sa-per') { state.per = parseInt(e.target.value, 10) || 10; state.page = 1; renderTable(); }
    if (e.target.id === 'sa-lib') { switchLib(e.target.value); }
  });

  /* 「＋ 新增自评」：打开当前库第一条未开始条款 */
  if (typeof INLINE !== 'undefined') {
    INLINE['selfassess-new'] = function () {
      var rec = REC[state.lib];
      var next = ensure(state.lib).filter(function (x) { return rec[x.id] && rec[x.id].st === 'todo'; })[0];
      if (!next) { if (window.showToast) showToast('当前标准库下的条款都已有自评记录', 'info'); return; }
      state.filter = 'todo';
      state.page = 1;
      renderFilters();
      renderTable();
      selectClause(next.id, { scrollUp: true });
      if (window.showToast) showToast('已打开待自评条款 ' + next.id + ' ' + next.name, 'success');
    };
  }

  /* ---------- 启动 ---------- */
  (function boot() {
    var libParam = params.get('lib');
    state.lib = (libParam && CL.libs[libParam]) ? libParam : 'iso20387';
    ensure(state.lib);

    var idParam = params.get('id');
    var first = ITEMS[state.lib][0];
    state.id = (idParam && findItem(state.lib, idParam)) ? idParam : (first ? first.id : '');

    renderLibSelect();
    renderAll();

    /* 从条款库「去自评」跳转进入时，给出定位反馈 */
    if (params.get('from') === 'clause-lib' && state.id) {
      var it = findItem(state.lib, state.id);
      if (it) {
        setTimeout(function () {
          if (window.showToast) showToast('已从条款库定位到 ' + it.id + ' ' + it.name + '，可直接提交自评', 'success');
        }, 350);
      }
    }
  })();

  /* 材料数据变化（上传 / 核验 / 关联 / 退回）→ 佐证材料区即时跟上 */
  if (EV && EV.on) EV.on(function () { if (state.id) renderDetail(); });

  window.__SA = { state: state, items: ITEMS, rec: REC };
})();
