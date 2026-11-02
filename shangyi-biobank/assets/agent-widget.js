/* ==========================================================================
   迎检智能体 · 悬浮挂件
   第 1 部分：挂件宿主（浮动头像 / 页面内拖动 / 右下角对话窗口）
   第 2 部分：对话逻辑（继承迎检智能体对话页，已按挂件宿主改造）
   ========================================================================== */

(function initAgentWidget() {
  if (window.__AW_MOUNTED) return;
  if (!document.body) return;
  window.__AW_MOUNTED = true;

  /* ---------- 资源与站点路径 ---------- */
  var SELF = document.currentScript;
  var ROOT = '';
  if (SELF && SELF.src) ROOT = SELF.src.replace(/assets\/agent-widget\.js[^/]*$/, '');
  var AVATAR = ROOT + 'assets/agent-avatar.png';
  window.__AW_ROOT = ROOT;

  /* 对话里「🔗 相关模块」的直达链接：解析为站点内真实页面 */
  window.__AW_PAGE = function (name) {
    if (!name || name === '#') return ROOT + 'index.html';
    return ROOT + 'pages/' + name;
  };

  var POS_KEY = 'cnas_agent_widget_pos_v1';
  var MARGIN = 22;

  /* ---------- 注入挂件 DOM ---------- */
  var root = document.createElement('div');
  root.id = 'aw';
  root.innerHTML = [
    '<button class="aw-fab" id="aw-fab" type="button" aria-label="迎检智能体">',
      '<img class="aw-fab-img" src="' + AVATAR + '" alt="">',
      '<span class="aw-fab-ping"></span>',
      '<span class="aw-fab-tip"><b>迎检智能体</b><em>拖动可移动 · 点击开始对话</em></span>',
    '</button>',
    '<section class="aw-win" id="aw-win" hidden aria-label="迎检智能体对话">',
      '<header class="aw-head">',
        '<img class="aw-head-img" src="' + AVATAR + '" alt="">',
        '<div class="aw-head-main">',
          '<div class="aw-head-name">迎检智能体<span class="aw-head-tag">现场评审准备</span></div>',
          '<div class="aw-head-sub" id="aw-head-sub">已连接：CNAS 条款库 · 评审日程模板库 · 评审报告与附表模板库</div>',
        '</div>',
        '<div class="aw-head-actions">',
          '<button class="aw-icon-btn" id="aw-hist-btn" type="button" title="历史问答记录">🕘</button>',
          '<button class="aw-icon-btn" id="aw-new" type="button" title="新对话">⟲</button>',
          '<button class="aw-icon-btn" id="aw-min" type="button" title="收起（Esc）">—</button>',
        '</div>',
      '</header>',
      '<div class="aw-msgs" id="aw-msgs"></div>',
      '<div class="aw-hist" id="aw-hist" hidden style="position:absolute; left:0; right:0; top:56px; bottom:0; background:#fff; z-index:6; overflow:auto; padding:12px 14px;"></div>',
      '<div class="aw-composer">',
        '<div class="ag-composer-inner">',
          '<div class="ag-composer-box">',
            '<textarea id="aw-input" rows="1" placeholder="例如：编排初次评审的现场日程 / 生成评审报告与附表…"></textarea>',
            '<div class="ag-composer-bar">',
              '<div class="ag-composer-tools">',
                '<button class="ag-tool-btn" type="button" title="上传文件（原型演示）">📎</button>',
                '<button class="ag-tool-btn" type="button" title="快捷指令（原型演示）">／</button>',
                '<span class="ag-fn-pill on">迎检智能体</span>',
              '</div>',
              '<button class="ag-send" id="aw-send" type="button">发送 <span>↑</span></button>',
            '</div>',
          '</div>',
          '<div class="ag-composer-tip">迎检智能体生成的内容仅供参考，正式结论请以受控文件与 CNAS 评审依据为准。</div>',
        '</div>',
      '</div>',
    '</section>'
  ].join('');
  document.body.appendChild(root);

  var fab = document.getElementById('aw-fab');
  var win = document.getElementById('aw-win');

  /* ---------- 位置：默认右下角，可拖动并记忆 ---------- */
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function place(x, y) {
    var w = fab.offsetWidth || 68, hgt = fab.offsetHeight || 68;
    x = clamp(x, MARGIN, Math.max(MARGIN, window.innerWidth - w - MARGIN));
    y = clamp(y, MARGIN, Math.max(MARGIN, window.innerHeight - hgt - MARGIN));
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    /* 挂件靠左时，提示气泡翻到右侧，避免超出视口 */
    root.classList.toggle('aw-tip-right', x + w / 2 < window.innerWidth / 2);
    return { x: x, y: y };
  }

  function defaultPos() {
    return { x: window.innerWidth - 68 - MARGIN, y: window.innerHeight - 68 - MARGIN };
  }

  var pos = null;
  try { pos = JSON.parse(sessionStorage.getItem(POS_KEY) || 'null'); } catch (err) { pos = null; }
  var cur = place(
    (pos && typeof pos.x === 'number') ? pos.x : defaultPos().x,
    (pos && typeof pos.y === 'number') ? pos.y : defaultPos().y
  );

  window.addEventListener('resize', function () { cur = place(cur.x, cur.y); });

  /* ---------- 拖动（指针事件，兼容鼠标与触屏） ---------- */
  var drag = null;

  fab.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    drag = { sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y, moved: false, id: e.pointerId };
    fab.classList.add('dragging');
    if (fab.setPointerCapture) { try { fab.setPointerCapture(e.pointerId); } catch (err) {} }
    e.preventDefault();
  });

  fab.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;   /* 抖动不计为拖动 */
    drag.moved = true;
    cur = place(drag.ox + dx, drag.oy + dy);
  });

  function endDrag(e) {
    if (!drag) return;
    var moved = drag.moved;
    drag = null;
    fab.classList.remove('dragging');
    try { sessionStorage.setItem(POS_KEY, JSON.stringify(cur)); } catch (err) {}
    if (!moved) toggle();     /* 位移过小 → 视为点击 */
  }
  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', endDrag);

  /* 键盘回车触发（指针点击已由拖动逻辑接管） */
  fab.addEventListener('click', function (e) { if (e.detail === 0) toggle(); });

  /* ---------- 窗口开关 ---------- */
  var isOpen = false;

  function show() {
    if (isOpen) return;
    isOpen = true;
    root.classList.add('aw-open');
    win.hidden = false;
    if (window.__AW_CHAT) window.__AW_CHAT.open();
    setTimeout(function () {
      var i = document.getElementById('aw-input');
      if (i) i.focus();
    }, 160);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('aw-open');
    win.hidden = true;
    place(cur.x, cur.y);
  }
  function toggle() { isOpen ? close() : show(); }

  document.getElementById('aw-min').addEventListener('click', close);
  document.getElementById('aw-new').addEventListener('click', function () {
    if (window.__AW_CHAT) window.__AW_CHAT.reset();
    var i = document.getElementById('aw-input');
    if (i) i.focus();
  });

  /* 历史问答记录（2026-10-07）：读写 localStorage，点击可重新提问 */
  var HIST_KEY = 'cnas_agent_qa_v1';
  var histPanel = document.getElementById('aw-hist');
  var histBtn = document.getElementById('aw-hist-btn');
  function histRead() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; } }
  function histRender() {
    if (!histPanel) return;
    var H = histRead();
    var list = H.length ? H.map(function (x) {
      var d = new Date(x.t || 0);
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      var ts = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
      return '<div class="aw-hist-item" data-q="' + encodeURIComponent(x.q) + '">' +
        '<span class="aw-hist-q">' + x.q + '</span><em class="aw-hist-t">' + ts + '</em></div>';
    }).join('') : '<div class="aw-hist-empty">暂无历史问答记录</div>';
    histPanel.innerHTML = '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">' +
      '<b style="font-size:13px;">历史问答记录</b>' +
      '<button class="btn-text" id="aw-hist-clear" style="font-size:12px;">清空</button></div>' +
      '<div>' + list + '</div>';
  }
  if (histBtn && histPanel) {
    histBtn.addEventListener('click', function () {
      var show = histPanel.hidden;
      histPanel.hidden = !show;
      if (show) histRender();
    });
    histPanel.addEventListener('click', function (e) {
      if (e.target.closest('#aw-hist-clear')) { try { localStorage.removeItem(HIST_KEY); } catch (err) { } histRender(); return; }
      var it = e.target.closest('[data-q]');
      if (!it) return;
      var q = decodeURIComponent(it.getAttribute('data-q'));
      var inp = document.getElementById('aw-input');
      if (inp) inp.value = q;
      var send = document.getElementById('aw-send');
      if (send) send.click();
      histPanel.hidden = true;
    });
  }
  window.__AW_HIST = { read: histRead, push: function (q) { var H = histRead(); H.unshift({ q: q, t: Date.now() }); try { localStorage.setItem(HIST_KEY, JSON.stringify(H.slice(0, 50))); } catch (e) { } } };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  /* 深链：?aw=1 或带预置评审信息时自动展开挂件 */
  if (/[?&](aw|rt|tpl)=/.test(location.search)) setTimeout(show, 320);
})();

/* ==========================================================================
   第 2 部分：对话逻辑
   ========================================================================== */
/* ==========================================================================
   迎检智能体 · 交互逻辑（挂件版）
   由宿主挂件在窗口首次打开时启动；对话为预置脚本，用于演示交互效果
   ========================================================================== */
(function initAgent() {
  var stage = document.getElementById('aw-msgs');       /* 挂件内的消息滚动区 */
  var msgs = document.getElementById('aw-msgs');
  var input = document.getElementById('aw-input');
  var sendBtn = document.getElementById('aw-send');
  if (!stage || !msgs || !input || !sendBtn) return;

  /* ---------- 工具 ---------- */
  /* 统一的滚动入口：默认平滑滚动，并尊重系统「减少动态效果」设置 */
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function scrollStage(top, smooth) {
    var y = Math.max(0, Math.round(top));
    if (smooth && !REDUCED && stage.scrollTo) stage.scrollTo({ top: y, behavior: 'smooth' });
    else stage.scrollTop = y;
  }
  function fullscreenTop() { scrollStage(0, false); }
  function toBottom() { scrollStage(stage.scrollHeight, true); }
  /* 把新气泡顶到可视区上沿（避开吸顶的会话头；偏移由 .ag-msg 的 scroll-margin-top 控制） */
  function scrollToBubble(el) {
    if (!el) return;
    /* 只滚动挂件内的消息区：scrollIntoView 会连带滚动整个站点页面，故改用容器内偏移 */
    scrollStage(el.offsetTop - 10, !REDUCED);
  }
  function h(html) { return html; }

  /* ---------- 富内容片段 ---------- */
  var FRAG = {
    countdown: h(
      '<p>距离现场评审还剩 <strong>12 天</strong>，按倒排计划你需要优先处理下面 4 件事：</p>' +
      '<div class="ag-table-wrap"><table class="ag-table">' +
      '<thead><tr><th>优先级</th><th>事项</th><th>对应条款</th><th>截止</th><th>状态</th></tr></thead><tbody>' +
      '<tr><td><span class="tag tag-error">P0</span></td><td>补齐 7.3 设施环境在线监控记录（近 3 个月）</td><td>7.3</td><td>剩余 3 天</td><td><span class="tag tag-warning">进行中</span></td></tr>' +
      '<tr><td><span class="tag tag-error">P0</span></td><td>完成 4.1 技术负责人任命文件更新</td><td>4.1</td><td>剩余 5 天</td><td><span class="tag tag-default">未开始</span></td></tr>' +
      '<tr><td><span class="tag tag-warning">P1</span></td><td>6.2 人员能力评估记录（12 人）</td><td>6.2</td><td>剩余 8 天</td><td><span class="tag tag-warning">进行中</span></td></tr>' +
      '<tr><td><span class="tag tag-warning">P1</span></td><td>8.7 纠正措施记录闭环（剩余 3 项）</td><td>8.7</td><td>剩余 10 天</td><td><span class="tag tag-default">未开始</span></td></tr>' +
      '</tbody></table></div>' +
      '<div class="ag-note">风险提示：7.3 条款材料缺口最大，若 3 天内无法补齐，将直接构成现场评审的<b>严重不符合</b>。</div>' +
      mods([
        { icon: '⊕', name: '任务配置', href: 'task-config.html' },
        { icon: '☐', name: '条款自评', href: 'self-assessment.html' },
        { icon: '✓', name: '检查清单', href: 'checklist.html' }
      ]) +
      suggest(['把这 4 件事生成任务并分配负责人', '展开 7.3 条款材料缺口清单', '生成迎检进度总览'])
    ),

    gap: h(
      '<p>ISO 20387 <strong>第 7 章「过程要求」</strong>共 9 条，当前材料完整度 <strong>72%</strong>，缺失如下：</p>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>7.1 通用要求</span><b>100%</b></div><div class="progress"><div class="progress-bar success" style="width:100%"></div></div></div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>7.2 样本采集与处理</span><b>85%</b></div><div class="progress"><div class="progress-bar" style="width:85%"></div></div></div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>7.3 设施与环境</span><b>40%</b></div><div class="progress"><div class="progress-bar warning" style="width:40%"></div></div></div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>7.4 设备与试剂</span><b>78%</b></div><div class="progress"><div class="progress-bar" style="width:78%"></div></div></div>' +
      '<ul class="ag-issues" style="margin-top:12px;">' +
      '<li><span class="ag-sev high">缺失</span><span><b>7.3.2</b> 环境监测记录（温湿度 / 洁净度）最近 3 个月不连续</span></li>' +
      '<li><span class="ag-sev high">缺失</span><span><b>7.3.4</b> 不同样本分区管理的现场标识照片</span></li>' +
      '<li><span class="ag-sev mid">待补</span><span><b>7.4.3</b> 试剂批次验证记录缺 4 批次</span></li>' +
      '</ul>' +
      mods([
        { icon: '📁', name: '材料智能归档', href: 'archive.html' },
        { icon: '≡', name: 'CNAS 条款库', href: 'clause-library.html' },
        { icon: '✓', name: '检查清单', href: 'checklist.html' }
      ]) +
      suggest(['列出所有缺失材料并指派责任人', '把 7.3 缺口转成整改任务', '导出第 7 章 gap 清单'])
    ),

    overview: h(
      '<p>当前迎检准备总览（数据截至今天）：</p>' +
      '<div class="ag-kpis">' +
      '<div class="ag-kpi"><b>86%</b><span>条款覆盖率</span></div>' +
      '<div class="ag-kpi"><b>143</b><span>已归档材料</span></div>' +
      '<div class="ag-kpi"><b>19</b><span>待补材料</span></div>' +
      '<div class="ag-kpi"><b>3</b><span>逾期任务</span></div>' +
      '</div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>材料归档</span><b>143 / 162</b></div><div class="progress"><div class="progress-bar" style="width:88%"></div></div></div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>检查清单完成</span><b>96 / 120</b></div><div class="progress"><div class="progress-bar" style="width:80%"></div></div></div>' +
      '<div class="ag-progress-row"><div class="pr-top"><span>纠正措施闭环</span><b>14 / 17</b></div><div class="progress"><div class="progress-bar warning" style="width:82%"></div></div></div>' +
      mods([
        { icon: '⌂', name: '系统首页', href: '#' },
        { icon: '📁', name: '材料智能归档', href: 'archive.html' },
        { icon: '▤', name: '报告自动生成', href: 'report.html' }
      ]) +
      suggest(['展开逾期的 3 个任务', '生成迎检报告草稿', '查看材料归档明细'])
    ),

    fallback: h(
      '<p>收到。我理解你的诉求是：<span class="ag-muted">（原型演示，未做真实语义解析）</span></p>' +
      '<ol class="ag-ol">' +
      '<li>解析你的诉求并定位迎检相关功能</li>' +
      '<li>检索 CNAS 条款库与受控文件，找出依据</li>' +
      '<li>生成可执行的结果或任务清单，并给出下一步建议</li>' +
      '</ol>' +
      '<div class="ag-note info">当前是静态原型：输入任意内容都会返回这条说明。真实版本将接入大模型与业务数据。</div>'
    )
  };

  function suggest(items) {
    return '<div class="ag-suggest"><div class="ag-suggest-title">建议下一步</div><div class="ag-chips">' +
      items.map(function (t) { return '<button class="ag-chip" data-ag-chip="' + t + '">' + t + '</button>'; }).join('') +
      '</div></div>';
  }

  /* 相关模块直达条：把智能体结论真正落到业务页面 */
  function mods(items) {
    if (!items || !items.length) return '';
    return '<div class="ag-modbar"><div class="ag-modbar-title">🔗 相关模块 <small>点击直达对应页面</small></div>' +
      '<div class="ag-mods">' + items.map(function (m) {
        return '<a class="ag-mod" href="' +
          (window.__AW_PAGE ? window.__AW_PAGE(m.href) : '#') +
          '"><span>' + m.icon + '</span>' + m.name +
          '<span class="ag-mod-go">›</span></a>';
      }).join('') + '</div></div>';
  }

  /* ---------- 功能配置 ---------- */
  var FUNCS = {
    yj: {
      icon: '🔍', accent: '#2B7FFF', accentBg: '#E8F1FF',
      name: '迎检智能体', tag: '现场评审准备',
      desc: '按 CNAS-PD14-09D0 编排现场评审日程，并按 CNAS-PD14-23D1 生成评审报告与附表等过程材料',
      caps: ['评审日程编排', '过程材料生成', '任务配置'],
      connected: '已连接：CNAS 条款库 · 评审日程模板库 · 评审报告与附表模板库 · 材料归档库',
      intro: '我是<b>迎检智能体</b>。可以按 <b>CNAS-PD14-09D0《现场评审日程表》</b>帮你编排现场评审日程 —— 逐时段列明评审组活动、我方准备与判定依据；编排完成后还能按 <b>CNAS-PD14-23D1</b> <b>逐份生成评审报告与附表 1~8</b>等过程材料，自动带入本次评审信息。',
      placeholder: '例如：编排初次评审的现场日程 / 生成评审报告与附表 / 距现场评审还有 12 天，帮我列一份迎检待办…',
      prompts: [
        { q: '按 CNAS-PD14-09D0 编排现场评审日程', t: ['读取现场评审日程模板', '匹配评审类型', '生成逐时段日程'], a: 'schedule' },
        { q: '生成评审报告与附表（过程材料）', t: ['读取 CNAS-PD14-23D1 模板库', '按评审阶段归集过程材料', '生成可填写表格'], a: 'materials' },
        { q: '距现场评审还有 12 天，帮我列一份迎检待办', t: ['读取评审排期', '匹配 30 条条款', '生成倒排计划'], a: 'countdown' },
        { q: 'ISO 20387 第 7 章还缺哪些材料？', t: ['检索条款库 7 章', '比对已归档材料'], a: 'gap' },
        { q: '生成迎检进度总览', t: ['汇总归档进度', '统计任务状态'], a: 'overview' }
      ]
    }
  };

  /* 承接式回复用的兜底模块直达与建议 */
  var FUNC_MODS = {
    yj: [
      { icon: '⊕', name: '任务配置', href: 'task-config.html' },
      { icon: '📁', name: '材料智能归档', href: 'archive.html' },
      { icon: '≡', name: 'CNAS 条款库', href: 'clause-library.html' }
    ]
  };
  var FUNC_NEXT = {
    yj: ['把结论转成迎检任务', '导出第 7 章 gap 清单', '定位缺材料的责任人']
  };

  /* ---------- 迎检：评审类型（源自 CNAS-PD14-09D0 现场评审日程表） ---------- */
  var REVIEW_TYPES = [
    { key: 'initial', no: '01', name: '初次评审', short: '初次', tpl: 'std3',
      scope: '全部要素 · 全部技术能力', note: '首次申请认可，全要素覆盖' },
    { key: 'surv-reg', no: '02', name: '监督评审（定期）', short: '监督定期', tpl: 'std3',
      scope: '全部要素 · 部分技术能力', note: '认可后按周期的例行监督' },
    { key: 'surv-irr', no: '03', name: '监督评审（不定期）', short: '监督不定期', tpl: 'light2',
      scope: '部分要素 · 部分技术能力', note: '投诉、变更等触发的专项监督' },
    { key: 'extend', no: '04', name: '扩项评审', short: '扩项', tpl: 'light2',
      scope: '扩项要素 · 新增技术能力', note: '新增样本类型或检测能力' },
    { key: 'reauth', no: '05', name: '复评审', short: '复评', tpl: 'std3',
      scope: '全部要素 · 全部技术能力', note: '有效期届满前的换证评审' }
  ];

  /* ---------- 迎检：评审组分工（源自同一文档，已做脱敏：不保留真实姓名与电话） ---------- */
  var REVIEW_TEAM = [
    { role: '评审组长', field: '管理要素 · 通用 / 结构 / 资源 / 过程 / 体系',
      clause: 'CL10 4 5 6.2 6.4 7.11~13 8' },
    { role: '技术评审员', field: '血液、衍生物 · 生物安全 / 生物安保',
      clause: 'CL10 6 7 8.3~8.6', codes: 'AB08-09 · AD01-02' },
    { role: '实习评审员', field: '血液、体液 · 伦理法规',
      clause: 'CL10 6 7 8.3~8.6', codes: 'AB03 · AB05 · AC01' },
    { role: '实习评审员', field: '组织 · 信息系统',
      clause: 'CL10 6 7 8.3~8.6', codes: 'AA03' }
  ];

  /* ---------- 迎检：现场评审日程模板 ----------
     结构取自 CNAS-PD14-09D0《现场评审日程表》。字段：
     t 时段 | r 评审组活动 | o 我方（样本库）准备 | c 依据
     日期用相对日（D-1 / D1…）表示，套用模板时再按实际评审起始日生成。 */
  var SCHED_TPL = {
    std3: {
      key: 'std3', name: '标准 3 天日程', days: 3, tag: '3 天现场',
      fit: '初次评审 · 定期监督评审 · 复评审',
      ask: '会前对接 + 预备会 + 3 天现场 + 2 个月整改，覆盖全要素',
      groups: [
        { g: '会前 · 对接与预备会', rows: [
          { t: 'T-7 起', r: '与被评审方对接人联系，协商现场评审期间不同样本类型的现场见证 / 现场试验安排', o: '指定唯一对接人；确认见证项目与形式；备好会场、办公网络、打印与住宿', c: 'CNAS-RL10' },
          { t: 'T-7 起', r: '样本量少或接收不规律的：要求前期录像备查 —— 确认拍摄关键内容（人员、关键设备、环境设施、工作流程）与关键操作环节，并约定时间地点', o: '按确认清单录制视频并注明时间地点留存；评审期无标本活动的准备模拟标本', c: 'CNAS-RL10' },
          { t: 'D-1 20:00—21:30', r: '评审组内部预备会：① 宣布评审纪律 ② 通报前期见证安排 ③ 签署廉洁自律声明 ④ 介绍文审情况并确定工作日程表 ⑤ 确定现场评审计划 ⑥ 统一重点难点认识 ⑦ 实习评审员培训', o: '行政保障到位（会场、投影、网络）；确认次日陪同人员与联络方式', c: 'CNAS-PD14-09D0' }
        ] },
        { g: '第 1 天 · 首次会与现场观察', rows: [
          { t: '8:30—9:00', r: '首次会（评审组长主持，6 项）：介绍组员与分工；样本库介绍参会人员；组长强调目的依据范围、确认日程表与现场试验结果提交时间、判定原则与公正保密、风险说明、不收取任何费用、廉洁自律声明交签；样本库负责人体系运行介绍（≤10 分钟）；样本库领导讲话（5 分钟）；确定陪同人员与特殊限制', o: '备《现场评审会议签到表》；<b>体系运行介绍 PPT（8-10 分钟，重点讲自上次评审以来的变化）</b>；领导讲话稿；法人签署 CNAS-PD14-22D0 廉洁自律声明；安排陪同人员与网络支持人员', c: 'CNAS-RL10 · PD14-22D0' },
          { t: '9:00—10:00', r: '现场观察：样本采集 → 登记 → 制备 → 暂存 → 入库 → 存储 → 分发的全过程与相关场所情况', o: '现场分区与标识清晰；陪同人熟悉流程；现场见证 / 现场试验条件就绪', c: 'CL10 7' },
          { t: '10:00—12:00', r: '按现场观察情况调整评审日程；管理要素 4 通用要求、5 结构要求；确定或调整技术能力考核方式，安排并观察现场见证 / 现场试验', o: '4 / 5 / 6 章材料就位：组织架构与职责、任命文件、人员档案、设备台账、环境记录', c: 'CL10 4 · 5 · 6' },
          { t: '13:30—14:30', r: '机构介绍不同样本类型所涉及的具体活动与工作流程（含信息管理系统）；伦理、人遗情况介绍', o: '样本类型流程说明；伦理批件；人遗备案材料', c: 'CL10 7' },
          { t: '14:30—16:30', r: '管理要素 5 结构要求、6 资源要求；观察现场见证 / 试验、现场演示、现场提问、查阅记录报告', o: '新进人员与轮岗人员名单及培训考核记录；设备使用维护与校准记录；作业指导文件', c: 'CL10 5 · 6' },
          { t: '16:30—17:00', r: '评审组当日内部会议（当日评审情况介绍、进度了解、疑难问题处理）', o: '待命，准备当日问题的答复口径', c: '—' },
          { t: '17:00—17:30', r: '与样本库代表简要沟通当天评审情况', o: '负责人与陪同人到场；记录问题清单，当晚组织整改', c: '—' }
        ] },
        { g: '第 2 天 · 过程要求与技术能力', rows: [
          { t: '8:30—9:30', r: '生物安全、生物安保情况介绍；详细介绍设施环境和设备的管理情况与本次评审周期中的变化', o: '生物安全 / 安保台账；设施环境监测记录；设备维护与校准记录', c: 'CL10 7' },
          { t: '9:30—11:30', r: '管理要素 7 过程要求；集中审查设施环境和设备控制情况', o: '7 章过程文件与记录；设施环境与设备控制记录', c: 'CL10 7' },
          { t: '11:30—12:00', r: '<b>授权签字人考核</b>，网上完成推荐表和评价表', o: '授权签字人到场；提前完成网上推荐表 / 评价表填报', c: 'CNAS-RL10' },
          { t: '13:00—14:00', r: '管理要素 7 过程要求；观察现场见证 / 试验、现场演示、现场提问、查阅记录报告', o: '7 章过程记录；样本质量问题与客户投诉处理记录；能力验证与样本库间比对结果', c: 'CL10 7' },
          { t: '14:00—16:30', r: '管理要素 8 质量管理体系要求；观察现场见证 / 试验、现场演示、现场提问、查阅记录报告', o: '8 章体系文件；内审与管理评审记录；风险与机遇、不符合与纠正措施记录', c: 'CL10 8' },
          { t: '16:30—17:00', r: '评审组内部会议（当日评审情况介绍、进度了解、疑难问题处理）', o: '待命', c: '—' },
          { t: '17:00—17:30', r: '与样本库沟通当天的评审情况', o: '负责人与陪同人到场；记录并当晚整改', c: '—' }
        ] },
        { g: '第 3 天 · 结论与末次会', rows: [
          { t: '8:30—11:00', r: '管理要素 8 质量管理体系要求；补充观察或核查相关问题，完成附表 5', o: '按前两日问题清单备好补充材料', c: 'CL10 8' },
          { t: '11:00—12:00', r: '向样本库反馈审核发现；与负责人交换意见，确定不符合项', o: '负责人与各条款责任人到场，现场确认不符合事实', c: 'CNAS-RL10' },
          { t: '13:30—14:30', r: '形成评审报告，完成附表 1、3、5、7；核对附表 1 与附表 6（授权领域代码范围）、附表 2（项目名称及仪器设备）、附表 4（PT 项目）', o: '陪同人员待命；准备补充说明与数据核对', c: 'CNAS-PD14-09D0' },
          { t: '14:30—15:00', r: '最后确认所有现场试验的数据及核查情况，完成评审报告', o: '确认现场试验记录与数据齐备', c: 'CNAS-PD14-09D0' },
          { t: '15:00—15:30', r: '修改、打印评审报告，双方签字，归还样本库的文件', o: '封存现场试验记录汇总；按《现场评审资料汇总表》核对资料完成情况与签名完整性；准备签字盖章', c: 'CNAS-PD14-09D0' },
          { t: '15:30—16:00', r: '末次会议（评审组长主持，7 项）：报告评审情况并宣读不符合项 / 观察项；宣布现场评审结论、提出整改要求及具体验证期限；说明评审的局限性与抽样风险；介绍 CNAS 对认可样本库的管理规定；样本库负责人发表意见；参会领导讲话；说明申诉投诉渠道；回收廉洁自律声明', o: '参会人员到场；备《现场评审会议签到表》；记录整改要求与验证期限；回收已签署的廉洁自律声明', c: 'CNAS-RL10 · R03' }
        ] },
        { g: '会后 · 整改与归档（2 个月内）', rows: [
          { t: 'T+2 个月内', r: '评审组长完成附表 8、附表 9；汇总资料提交 CNAS', o: '① 提交整改方案（含任务分解表及时间计划）给各评审专家及组长，经审核同意后启动整改 ② 提交汇总的整改报告（期间可能多次返回补正）', c: 'CNAS-RL10' }
        ] }
      ]
    },

    light2: {
      key: 'light2', name: '精简 2 天日程', days: 2, tag: '2 天现场',
      fit: '扩项评审 · 不定期监督评审',
      ask: '会前对接 + 预备会 + 2 天现场 + 2 个月整改，聚焦本次范围',
      groups: [
        { g: '会前 · 对接与预备会', rows: [
          { t: 'T-7 起', r: '协商现场见证 / 现场试验安排；确认本次扩项范围或监督重点', o: '指定对接人；准备本次涉及的样本类型与流程材料', c: 'CNAS-RL10' },
          { t: 'D-1 20:00—21:30', r: '评审组内部预备会：宣布纪律、签署廉洁自律声明、介绍文审情况、确定现场评审计划与拟核查问题、实习评审员培训', o: '行政保障到位；确认次日陪同人员', c: 'CNAS-PD14-09D0' }
        ] },
        { g: '第 1 天 · 首次会与范围核查', rows: [
          { t: '8:30—9:00', r: '首次会（评审组长主持）：介绍组员与分工、确认评审日程表与判定原则、廉洁自律声明交签、确定陪同人员', o: '签到表；<b>体系运行介绍 PPT（8-10 分钟，本次聚焦扩项 / 受监督范围的变化）</b>；领导讲话稿；法人签署廉洁自律声明', c: 'CNAS-RL10 · PD14-22D0' },
          { t: '9:00—10:30', r: '现场观察：本次涉及样本类型的采集 → 制备 → 暂存 → 入库 → 存储 → 分发全过程', o: '现场分区与标识清晰；陪同人熟悉流程', c: 'CL10 7' },
          { t: '10:30—12:00', r: '管理要素 5 结构要求、6 资源要求；确定技术能力考核方式并安排现场见证 / 试验', o: '组织与职责、任命文件、人员档案、设备台账、环境记录到桌面', c: 'CL10 5 · 6' },
          { t: '13:30—15:00', r: '机构介绍本次涉及样本类型的活动与工作流程；伦理、人遗情况介绍', o: '流程说明；伦理批件；人遗备案材料', c: 'CL10 7' },
          { t: '15:00—16:30', r: '管理要素 7 过程要求；观察现场见证 / 试验、现场演示、现场提问、查阅记录报告', o: '7 章过程记录；设施环境与设备控制记录', c: 'CL10 7' },
          { t: '16:30—17:00', r: '评审组内部会议', o: '待命', c: '—' },
          { t: '17:00—17:30', r: '与样本库沟通当天的评审情况', o: '负责人与陪同人到场；记录并当晚整改', c: '—' }
        ] },
        { g: '第 2 天 · 体系核查与结论', rows: [
          { t: '8:30—10:30', r: '管理要素 8 质量管理体系要求；补充观察或核查相关问题', o: '8 章体系文件；内审与管理评审、风险与纠正措施记录', c: 'CL10 8' },
          { t: '10:30—11:30', r: '向样本库反馈审核发现；与负责人交换意见，确定不符合项', o: '负责人与条款责任人到场确认不符合事实', c: 'CNAS-RL10' },
          { t: '11:30—12:00', r: '授权签字人考核（如涉及），网上完成推荐表和评价表', o: '授权签字人到场；提前完成网上填报', c: 'CNAS-RL10' },
          { t: '13:30—14:30', r: '形成评审报告，完成附表 1、3、5、7 并核对相关附表', o: '陪同人员待命；准备补充说明', c: 'CNAS-PD14-09D0' },
          { t: '14:30—15:00', r: '最后确认现场试验数据及核查情况；双方签字，归还样本库文件', o: '封存现场试验记录汇总；按《现场评审资料汇总表》核对签名与资料完整性', c: 'CNAS-PD14-09D0' },
          { t: '15:00—15:30', r: '末次会议（评审组长主持，7 项同上）：报告评审情况与不符合项、宣布结论与整改期限、说明局限性风险、说明申诉投诉渠道、回收廉洁自律声明', o: '参会人员到场；签到表；记录整改要求与验证期限', c: 'CNAS-RL10 · R03' }
        ] },
        { g: '会后 · 整改与归档（2 个月内）', rows: [
          { t: 'T+2 个月内', r: '评审组长完成附表 8、附表 9；汇总资料提交 CNAS', o: '提交整改方案（含任务分解表及时间计划）→ 提交汇总的整改报告（可能多次补正）', c: 'CNAS-RL10' }
        ] }
      ]
    }
  };

  /* ---------- 迎检：过程材料模板库（评审报告 + 附表 1~8） ----------
     结构取自 CNAS-PD14-23D1《生物样本库质量和能力认可评审报告》及其附表。
     字段：key | no 文件编号 | name 名称 | cat 归组 | stage 对应评审阶段 | tag 形态 | lead 说明
     blocks 内的 {{token}} 生成时按已确认的评审信息自动预填（机构 / 类型 / 日期 / 依据 / 范围 / 评审组），
     其余留空待填。真实姓名与电话一律不预置（脱敏）。 */
  var MAT_TPL = [
    { key: 'report', no: 'CNAS-PD14-23D1', name: '生物样本库质量和能力认可评审报告', cat: '评审结论',
      stage: '第 3 天', tag: '主报告',
      lead: '评审活动的主体报告：记录评审过程与结果评价，是 CNAS 评定专门委员会作出认可决定的主要信息来源，批准认可前作为参考。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' }, { k: '评审日期', v: '{{date}}' }
        ] },
        { t: 'sub', s: '一、样本库概况' },
        { t: 'info', items: [
          { k: '名称', v: '{{org}}', span: 'full' },
          { k: '地址', v: '', span: 'full' },
          { k: '电话（Tel）', v: '' }, { k: '传真（Fax）', v: '' }, { k: '邮政编码', v: '' },
          { k: '网址', v: '' }, { k: '电子信箱', v: '' }, { k: '负责人 / 职务', v: '' },
          { k: '负责人电话', v: '' }, { k: '负责人邮箱', v: '' }, { k: '联系人 / 职务', v: '' },
          { k: '联系人电话', v: '' }, { k: '手机', v: '' },
          { k: '样本库所在具有法人资格的机构名称（若样本库是法人单位则不填）', v: '', span: 'full' },
          { k: '统一社会信用代码', v: '' }, { k: '法定代表人', v: '' }, { k: '职务', v: '' },
          { k: '电话', v: '' }, { k: '传真', v: '' }, { k: '电子信箱', v: '' }
        ] },
        { t: 'sub', s: '二、样本库基本信息' },
        { t: 'text', k: '样本库人员及设施', hint: '按实际填写', lines: 3,
          v: '样本库始建于 ____ 年，当前有效管理体系于 ____ 年 ____ 月正式运行；现有工作人员 ____ 名，其中管理层 ____ 名、技术人员 ____ 名；主要仪器设备 ____ 台，其中样本存储设备 ____ 台；占地面积 ____ 平方米，其中存储场地 ____ 平方米、实验场地 ____ 平方米。' },
        { t: 'text', k: '获认可情况（若无，不填此项）', hint: '按实际填写', lines: 3,
          v: '初次获认可日期：____ 年 ____ 月 ____ 日；最新认可有效期至：____ 年 ____ 月 ____ 日；CNAS 证书号：________；已获认可的保藏项目 ____ 项；已获认可的授权签字人 ____ 名。' },
        { t: 'sub', s: '三、评审简况' },
        { t: 'info', items: [
          { k: '评审日期', v: '{{date}}（共 ____ 人日）', span: 'full' },
          { k: '评审地点', v: '', span: 'full' },
          { k: '评审类型', v: '{{type}}', span: 'full' },
          { k: '评审依据', v: '{{basis}}', span: 'full' },
          { k: '评审范围', v: '{{scope}}', span: 'full' }
        ] },
        { t: 'check', items: [
          { k: '评审类型（勾选）', opts: ['初次', '复评审', '扩大认可范围', '定期监督', '不定期监督', '其他（请说明）'] },
          { k: '评审依据（勾选）', opts: ['CNAS-CL10 及其他相关认可要求', '管理体系文件', '其他（请说明）'] },
          { k: '要素范围（勾选）', opts: ['全部要素', '部分要素（请列出条款号）'] }
        ] },
        { t: 'note', s: '要素逐条勾选：4.2 公正性 / 4.3 保密性 / 5 结构要求 / 6.2 人员 / 6.3 设施环境 / 6.4 外部提供 / 6.5 设备 / 7.2 采集 / 7.3 接收分发 / 7.4 运输 / 7.5 可追溯性 / 7.6 制备保存 / 7.7 存储 / 7.8 质量控制 / 7.9 方法学确认 / 7.10 信息数据管理 / 7.11 不符合输出 / 7.12 报告 / 7.13 投诉 / 8 管理要求。' },
        { t: 'sub', s: '四、评审情况及主要结果' },
        { t: 'text', k: '1. 评审时见面的样本库主要人员', hint: '填写人员及岗位', lines: 2 },
        { t: 'text', k: '2. 管理体系文件评审和运行符合性的评审结果', lines: 3 },
        { t: 'text', k: '3. 技术能力评审结果', hint: '人员 / 设施环境 / 保藏活动 / 关键设备是否变更；质量保证与技术能力确认方式', lines: 4,
          v: '主要管理人员 / 技术人员：□有变更　□无变更；设施和环境条件：□有变更　□无变更；保藏活动：□有变更　□无变更；关键仪器设备：□有变更　□无变更。技术能力确认方式：□现场试验　□现场演示　□现场提问　□利用能力验证结果　□查阅记录和报告　□核查仪器设备配置。' },
        { t: 'text', k: '4. 上次评审不符合项纠正措施有效性的评价', lines: 2 },
        { t: 'text', k: '5. 认可标识使用情况　6. 维持认可资格、遵守认可规定情况', lines: 2 },
        { t: 'note', s: '本评审共发现 ____ 个不符合项、____ 个观察项（见附表 7）；评审授权签字人 ____ 名、同意推荐 ____ 名（见附表 1），确认保藏样本类型 ____ 项（见附表 2）。' },
        { t: 'sub', s: '五、评审结论' },
        { t: 'check', items: [
          { k: '评审组推荐意见', opts: ['满足认可要求，同意推荐 / 维持认可', '不满足认可要求，不予推荐 / 维持认可', '建议 CNAS 撤销认可资格', '建议 CNAS 暂停认可资格（暂停 ____ 个月）', '提出纠正和纠正措施，跟踪评审合格后推荐 / 维持认可'] },
          { k: '跟踪评审拟采用的方式', opts: ['提交必要的文件或记录进行文件评审', '进行现场跟踪评审'] }
        ] },
        { t: 'info', items: [ { k: '完成纠正措施时间', v: '____ 年 ____ 月 ____ 日前', span: 'full' } ] },
        { t: 'sub', s: '六、评审组签名' },
        { t: 'sign', items: ['评审组长签字：＿＿＿＿＿　　日期：＿＿＿＿＿', '评审员（签字）／评审场所／确认的能力范围（附表 2 序号）：＿＿＿＿＿'] },
        { t: 'sub', s: '七、样本库确认意见' },
        { t: 'check', items: [ { k: '', opts: ['确认', '不确认，原因：＿＿＿＿＿'] } ] },
        { t: 'sign', items: ['样本库代表签字：＿＿＿＿＿　　日期：＿＿＿＿＿'] },
        { t: 'sub', s: '八、评审报告附表' },
        { t: 'check', items: [
          { k: '', opts: ['附表1 授权签字人一览表', '附表2 样本保藏能力范围表', '附表3 准则核查表', '附表4 能力验证核查表'], sep: '　' },
          { k: '', opts: ['附表5 样本保藏能力确认表', '附表6 授权签字人评审表', '附表7 不符合项 / 观察项记录表', '附表8 整改验收及最终推荐意见表'], sep: '　' },
          { k: '其他', opts: ['有（请注明）', '无'] }
        ] },
        { t: 'note', s: '九、附加说明：□有　□无（可另附页）。本报告版权属 CNAS 所有，未经批准不得翻印；评审组成员对评审中获知的信息负有保密责任。' }
      ] },

    { key: 't1', no: 'CNAS-PD14-23-01D1', name: '附表1 · 推荐认可的授权签字人一览表', cat: '评审结论',
      stage: '第 3 天', tag: '名单 · 需签字',
      lead: '逐名列出推荐认可的授权签字人及其授权领域，并标注维持 / 新增 / 扩大 / 缩小四种变更。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' }, { k: '样本库地址', v: '' }
        ] },
        { t: 'table', c: true, head: ['序号', '推荐认可的授权签字人', '推荐的授权签字领域', '说明'],
          rows: [
            ['1', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围'],
            ['2', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围'],
            ['3', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围'],
            ['4', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围'],
            ['5', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围'],
            ['6', '', '', '□维持　□新增　□扩大授权范围　□缩小授权范围']
          ] },
        { t: 'sign', items: ['评审组长：＿＿＿＿＿　　评审日期：＿＿＿＿＿'] },
        { t: 'note', s: '英文对照页（List of Recommended Signatories / No. · Name · Authorized field · Note）随附于后，字段与中文页一一对应。' }
      ] },

    { key: 't2', no: 'CNAS-PD14-23-02D2', name: '附表2 · 推荐认可的样本保藏能力范围表', cat: '评审结论',
      stage: '第 3 天', tag: '范围表 · 逐行录入',
      lead: '逐行列明推荐认可的样本保藏能力范围：保藏样本、领域代码、原始样本、主要活动、储存条件与依据的标准 / 体系文件。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' }, { k: '样本库地址', v: '' }
        ] },
        { t: 'table', c: true, head: ['序号', '保藏样本', '领域代码', '原始样本', '主要活动', '储存条件', '标准 / 体系文件', '说明', '备注'],
          rows: [['1', '', '', '', '', '', '', '', ''], ['2', '', '', '', '', '', '', '', ''],
                 ['3', '', '', '', '', '', '', '', ''], ['4', '', '', '', '', '', '', '', ''],
                 ['5', '', '', '', '', '', '', '', '']] },
        { t: 'note', s: '主要活动（至少选一项）：□采集　□获得　□制备　□储存　□检测 / 鉴定　□分发。储存条件：□室温（18~28℃）　□冷藏（2~8℃）　□低温（-20~-40℃）　□超低温（-60~-80℃）　□深低温（-150~-196℃）。标准 / 体系文件：□标准方法（注明标准号）　□非标准方法（注明文件号）。' },
        { t: 'info', items: [ { k: '合计', v: '共 ＿＿ 项', span: 'full' } ] },
        { t: 'sign', items: ['评审组长：＿＿＿＿＿　　评审日期：＿＿＿＿＿'] }
      ] },

    { key: 't3', no: 'CNAS-PD14-23-03D1', name: '附表3 · 《生物样本库质量和能力认可准则》核查表', cat: '评审结论',
      stage: '第 1–3 天', tag: '逐条核查 · 185 条',
      lead: '依据 CNAS-CL10：2020 逐条核查，编号与准则一致（准则第 1、2、3 章及附录的内容在本表中省略）。逐条给出评审结果与评审说明。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '评审类型', v: '{{type}}' },
          { k: '核查条款', v: '共 {{clauses}} 条 · 按第 4~8 章分组' }
        ] },
        { t: 'clauses' },
        { t: 'sign', items: ['评审员 / 技术专家（末页）：＿＿＿＿＿　　评审日期：＿＿＿＿＿'] }
      ] },

    { key: 't4', no: 'CNAS-PD14-23-04D1', name: '附表4 · 能力验证 / 实验室间比对核查表', cat: '现场评审中',
      stage: '第 2 天', tag: '逐行录入',
      lead: '保藏能力中涉及「检测 / 鉴定」活动时填写：记录参加的能力验证与实验室间比对、结果、纠正措施完成情况及评审组确认意见。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' }, { k: '样本库地址', v: '' }
        ] },
        { t: 'table', c: true,
          head: ['序号', '保藏样本', '领域代码', '能力验证计划提供者（PTP）', '实验室间比对组织方 / 比对方', '参加日期', '结果', '不满意结果的纠正措施是否完成（Y/N）', '评审组确认结果（Y/N）'],
          rows: [['1', '', '', '', '', '', '', '', ''], ['2', '', '', '', '', '', '', '', ''],
                 ['3', '', '', '', '', '', '', '', ''], ['4', '', '', '', '', '', '', '', ''],
                 ['5', '', '', '', '', '', '', '', '']] },
        { t: 'note', s: '填表说明：① 保藏能力中涉及「检测 / 鉴定」活动时填写此表；② 多场所样本库按不同场所分别填写；③ 序号、保藏样本、领域代码应与申请书附表 2-1 一致；④ 能力验证类型包括 CNAS 承认的外部能力验证或比对；⑤ 结果为不满意 / 不合格时，在「纠正措施是否完成」栏填样本库完成情况、在「评审组确认结果」栏说明重点核查的文件记录及确认结果；⑥ 评审组确认结果为 N 时须说明原因。' },
        { t: 'sign', items: ['评审员 / 技术专家（末页）：＿＿＿＿＿　　评审日期：＿＿＿＿＿'] }
      ] },

    { key: 't5', no: 'CNAS-PD14-23-05D1', name: '附表5 · 样本保藏能力确认表', cat: '现场评审中',
      stage: '第 2 天', tag: '逐行录入',
      lead: '逐项确认样本保藏能力：记录核查方式与现场试验 / 演示的设备、人员、要求、结果与判断标准，给出 Y/N 确认结论。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' }, { k: '样本库地址', v: '' }
        ] },
        { t: 'table', c: true,
          head: ['序号', '保藏样本', '领域代码', '原始样本', '活动', '核查场地 / 设施 / 设备', '现场观摩 / 提问', '查阅记录 / 报告', '现场试验 / 现场演示（设备 · 人员 · 要求 · 结果 · 判断标准）', '保藏能力确认（Y/N）', '说明'],
          rows: [['1', '', '', '', '', '', '', '', '', '', ''], ['2', '', '', '', '', '', '', '', '', '', ''],
                 ['3', '', '', '', '', '', '', '', '', '', ''], ['4', '', '', '', '', '', '', '', '', '', '']] },
        { t: 'note', s: '填表说明：① 多场所按不同场所分别填写；② 序号、保藏样本、领域代码、原始样本与活动应与申请书附表 2-1 一致；③「现场试验」用于确认检测 / 鉴定活动，「现场演示」用于确认其他活动；④「设备」填写设备名称及编号；⑤「要求」可填留样再测 / 设备比对 / 人员比对 / 标准操作考核 / 特定保藏活动；⑥「结果」可填每份样品结果及按判断标准计算的结果；⑦「判断标准」宜量化明确（如细胞活力 ＞90%），可依体系文件；⑧ 保藏能力确认 Y 表示确认、N 表示不确认，不确认时须在说明栏具体说明。' },
        { t: 'sign', items: ['评审员 / 技术专家（末页）：＿＿＿＿＿　　评审日期：＿＿＿＿＿'] }
      ] },

    { key: 't6', no: 'CNAS-PD14-23-06D1', name: '附表6 · 授权签字人评审表', cat: '现场评审中',
      stage: '第 2 天', tag: '逐人一份 · 需签字',
      lead: '每名授权签字人一份：申请人填写基本信息与申请签字范围，评审员在现场逐项确认 8 项能力并给出推荐意见。',
      blocks: [
        { t: 'info', items: [ { k: '任务编号', v: '{{taskno}}' }, { k: 'No.', v: '' } ] },
        { t: 'sub', s: '由申请人完成' },
        { t: 'table', c: true, head: ['姓名', '性别', '出生年月', '职务', '职称', '文化程度'],
          rows: [['', '', '', '', '', '']] },
        { t: 'text', k: '申请认可签字的范围', hint: '需填写二级领域代码与保藏样本名称', lines: 2 },
        { t: 'sub', s: '由评审员在现场完成' },
        { t: 'table', c: true, head: ['评审项目', '是', '否'],
          rows: [
            ['具有相应的职责和权利，对样本报告真实性和完整性负责', '□', '□'],
            ['掌握生物样本保藏技术、标准及方法', '□', '□'],
            ['有能力对相关样本保藏技术方法进行验证和确认', '□', '□'],
            ['掌握生物样本保藏的质量控制方法和判断标准', '□', '□'],
            ['熟悉生物样本保藏的相关伦理法律法规的要求', '□', '□'],
            ['熟悉记录、报告及其核查程序', '□', '□'],
            ['了解关键设备管理及定期校准的规定', '□', '□'],
            ['了解 CNAS 的认可条件、义务及认可标识使用等有关规定', '□', '□']
          ] },
        { t: 'text', k: '需要说明的问题', lines: 2 },
        { t: 'check', items: [
          { k: '推荐意见', opts: ['推荐为认可的授权签字人', '暂不推荐'] },
          { k: '推荐认可签字的范围', opts: [] }
        ] },
        { t: 'sign', items: ['评审员：＿＿＿＿＿　评审组长：＿＿＿＿＿　日期：＿＿＿＿＿'] }
      ] },

    { key: 't7', no: 'CNAS-PD14-23-07D1', name: '附表7 · 不符合项 / 观察项记录表', cat: '评审结论',
      stage: '第 3 天', tag: '逐条记录 · 需签字',
      lead: '逐条记录评审发现的不符合项与观察项：事实陈述、类型、依据条款、处理方式、验收方式与评审员，并由样本库确认。',
      blocks: [
        { t: 'info', items: [ { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' } ] },
        { t: 'table', c: true,
          head: ['序号', '被评审部门 / 岗位', '事实陈述', '事实类型', '依据文件 / 条款', '处理方式', '验收方式', '评审员姓名（打印 + 签字）'],
          rows: [
            ['1', '', '', '□不符合项<br>□观察项', '□CNAS-____ 第 ____ 条<br>□（体系文件）<br>□（依据标准 / 规范）', '□样本库采取纠正 / 纠正措施<br>□变更参数能力<br>□不予推荐 / 撤销相关项目<br>□向 CNAS 建议暂停相关项目', '□提供必要的见证材料<br>□现场跟踪评审', ''],
            ['2', '', '', '□不符合项<br>□观察项', '□CNAS-____ 第 ____ 条<br>□（体系文件）<br>□（依据标准 / 规范）', '□样本库采取纠正 / 纠正措施<br>□变更参数能力<br>□不予推荐 / 撤销相关项目<br>□向 CNAS 建议暂停相关项目', '□提供必要的见证材料<br>□现场跟踪评审', ''],
            ['3', '', '', '□不符合项<br>□观察项', '□CNAS-____ 第 ____ 条<br>□（体系文件）<br>□（依据标准 / 规范）', '□样本库采取纠正 / 纠正措施<br>□变更参数能力<br>□不予推荐 / 撤销相关项目<br>□向 CNAS 建议暂停相关项目', '□提供必要的见证材料<br>□现场跟踪评审', ''],
            ['4', '', '', '□不符合项<br>□观察项', '□CNAS-____ 第 ____ 条<br>□（体系文件）<br>□（依据标准 / 规范）', '□样本库采取纠正 / 纠正措施<br>□变更参数能力<br>□不予推荐 / 撤销相关项目<br>□向 CNAS 建议暂停相关项目', '□提供必要的见证材料<br>□现场跟踪评审', '']
          ] },
        { t: 'check', items: [ { k: '样本库确认', opts: ['全部确认', '部分确认（填写序号 ＿＿＿，原因 ＿＿＿）', '全部不确认（原因 ＿＿＿）'] } ] },
        { t: 'sign', items: ['样本库负责人（签字）：＿＿＿＿＿　　日期：＿＿＿＿＿', '评审组长（签字）：＿＿＿＿＿　　日期：＿＿＿＿＿'] },
        { t: 'note', s: '注：① 当不符合项引起已获认可的保藏能力发生变化（如需要缩小能力范围、增加限制范围）时，选择「变更参数能力」；② 本表可以每个评审员单独出具，也可评审组汇总出具。' }
      ] },

    { key: 't8', no: 'CNAS-PD14-23-09D1', name: '附表8 · 样本库整改验收及最终推荐意见表', cat: '会后整改',
      stage: '会后 2 个月内', tag: '需签字',
      lead: '现场评审结束后 2 个月内：逐条验收整改项，给出验收情况及结论与最终推荐意见，报评审组长签署。',
      blocks: [
        { t: 'info', items: [
          { k: '任务编号', v: '{{taskno}}' }, { k: '样本库名称', v: '{{org}}' },
          { k: '评审日期', v: '{{date}}' }, { k: '要求整改项数', v: '＿＿ 项' },
          { k: '整改完成时间', v: '＿＿＿＿＿', span: 'full' }
        ] },
        { t: 'text', k: '验收情况及结论', hint: '对不符合项逐条验收并给出验收意见；对观察项的说明或整改给出意见', lines: 5 },
        { t: 'text', k: '最终推荐意见', lines: 3 },
        { t: 'sign', items: ['评审组长：＿＿＿＿＿　　日期：＿＿＿＿＿'] },
        { t: 'note', s: '填表说明：① 对不符合项逐条验收并给出验收意见；② 对观察项应对样本库的说明或整改给出意见；③ 样本库不能按期完成整改、整改情况不是一次性验收合格、因组长原因不能按期验收、现场跟踪验收等情况应予说明；④ 追踪审核应利用生物样本库评审报告附表（在任务编号栏注明任务编号及追踪审核），作为资料性文件一并交 CNAS 秘书处。' }
      ] }
  ];

  /* CNAS-CL10：2020 准则条款（附表3 用）—— 由 tools/inject-cl10.py 从原表注入 */
  var CL10_CLAUSES = [{"n": "4.1.1", "t": "生物样本库应有程序规定每一种类型的生物样本和相关数据的保藏。包括特定的样本前处理过程、收集/采集、获取和接收、记录、登记、编目/分类、检查、制备、保存、储存、数据管理、销毁、包装以及安全防护、分发和运输等。生物样本库应建立程序确保符合生物安保和生物安全的要求，这些程序还应评估风险并建立防范措施。"}, {"n": "4.1.2", "t": "在可能的情况下，生物样本库宜关注用于后续使用生物样本和/或其相关数据最低要求，以确保这些生物样本和相关数据能满足可重复性研究。"}, {"n": "4.1.3", "t": "生物样本库的目标应明确和可行。"}, {"n": "4.1.4", "t": "与生物样本库活动、过程和程序相关的信息应以易理解的格式形成文件。"}, {"n": "4.1.5", "t": "文件应包括相关程序生成的信息、质量管理体系（见第8章）及设施/专用区域管理的信息。"}, {"n": "4.1.6", "t": "生物样本库应遵守有关生物样本和相关数据的相关地区、国家和国际伦理规范。<br>注：更多信息，请参照ISO 26000《社会责任指导》。"}, {"n": "4.1.7", "t": "生物样本库应规定4.1.1中所有程序中参与人员的具体身份。"}, {"n": "4.1.8", "t": "生物样本库宜确定在生物样本全部分发、处理或销毁后，保留与这些生物样本相关的成文信息和数据的时间周期。"}, {"n": "4.2.1", "t": "生物样本库应有组织结构和管理保证公正性。"}, {"n": "4.2.2", "t": "生物样本库管理层应做出公正性承诺。<br>注：更多信息，请参照ISO 26000《社会责任指导》。"}, {"n": "4.2.3", "t": "生物样本库应对样本保藏的公正性负责，不允许内部或外部压力损害其公正性。"}, {"n": "4.2.4", "t": "生物样本库应识别持续运行过程中影响公正性的风险。<br>注：以下关系可能会影响生物样本库的公正性：所有权、管理、经营、人员、共享样本和相关数据、财务、合同、营销（包括品牌）和销售支付佣金或吸引新客户方式等。"}, {"n": "4.2.5", "t": "如果识别出影响公正性的风险，生物样本库应能够证明如何消除或最小化这种风险。"}, {"n": "4.3.1", "t": "生物样本库应保护样本提供者/供体、接收者和用户的隐私信息和权利，尤其是在数据的储存和传输过程中。"}, {"n": "4.3.2", "t": "生物样本库应通过做出具有法律效力的承诺，对其日常活动中所获得或产生的保密信息承担管理责任。在分享数据或生物样本及相关数据时，在可能的情况下，生物样本库应告知提供者/供体的隐私和机密如何被保护。生物样本库仅根据相关协议和授权来发布生物样本及相关数据（如合同协议、具有法律约束力的文件、伦理批件）。"}, {"n": "4.3.3", "t": "当生物样本库需要根据法律要求公开隐私信息时，应告知提供者/供体需要提供的信息，除非法律禁止。"}, {"n": "4.3.4", "t": "所有能访问生物样本库机密数据的员工都应保密（见6.2.1.2）。"}, {"n": "5.1", "t": "生物样本库应是法人实体，或是法人实体的独立部分，能对其任何行为负法律责任。<br>注：在本准则中，政府性质的生物样本库被认为是法人实体，或者是与其政府地位相当的法人实体。"}, {"n": "5.2", "t": "生物样本库应指定对其负有全面责任的最高管理者。"}, {"n": "5.3", "t": "生物样本库应有相应的管理机构/顾问委员会以指导和建议科学、技术和/或管理行政等其他事项。"}, {"n": "5.4", "t": "生物样本库应对其设施中/专用区域中的活动行为负责。"}, {"n": "5.5", "t": "生物样本库应有一系列举措来界定和处理因其活动而产生的经济责任。"}, {"n": "5.6", "t": "生物样本库开展的活动应满足本准则、生物样本库协议和/或具有法律约束力的文件的要求以及提供认可的权威部门和组织的要求。"}, {"n": "5.7", "t": "生物样本库应规定符合本准则的活动范围，并形成文件。生物样本库应仅声明符合本准则的范围内的活动，不应包括外部提供的生物样本库活动。"}, {"n": "5.8", "t": "生物样本库应：<br>a) 确定管理架构，包括生物样本库的组织和管理、其在母体组织中的位置，以及管理、技术运作和支持服务间的关系；<br>b) 规定对生物样本库活动结果有影响的所有管理、操作、确认或验证人员的职责、权力和相互关系；"}, {"n": "5.9", "t": "生物样本库应配备专职或兼职人员，拥有权限和资源以履行以下职责：<br>a) 实施、保持、监控和改进质量管理体系；<br>b) 识别与质量管理体系或生物样本保藏程序的偏离；<br>c) 评估偏离的影响，并制定和实施适当的举措（见不符合输出7.11，纠正措施8.7）；<br>d) 向生物样本库管理层报告质量管理体系运行状况和改进需求。"}, {"n": "5.10", "t": "生物样本库管理层应确保：<br>a） 对质量管理体系的变化进行监测和控制；<br>b） 针对质量管理体系的有关性能指标以及任何改进的需求，与包括员工在内的利益相关方进行沟通；<br>c） 向生物样本库员工传达并使其理解满足来自接收方/用户要求以及其他适用性要求（包括本准则中描述的要求）的重要性。"}, {"n": "6.1.1", "t": "生物样本库应获得生物样本活动所需的人员、设施和专用区域、设备、信息系统及支持服务。<br>注：信息系统可以是电子的或者纸质的。"}, {"n": "6.1.2", "t": "生物样本库应有文件化的战略规划，确保有持续的资金支持其各项活动。这项战略规划应定期审核。"}, {"n": "6.2.1.1", "t": "所有可能影响生物样本保藏的内部或外部人员，都应行为公正（见 4.2）。"}, {"n": "6.2.1.2", "t": "所有能访问生物样本库机密数据的人员都应遵守保密规定（见4.3.4）。"}, {"n": "6.2.1.3", "t": "生物样本库应有人员管理的文件化程序，并维持能表明遵守相关要求的人员成文信息。"}, {"n": "6.2.1.4", "t": "生物样本库应在岗位描述中详细规定员工的岗位职责和权限，并传达相关人员。"}, {"n": "6.2.1.5", "t": "生物样本库或其母体组织应确保建立、实施相关文件以维护员工的健康和安全，并通过对生物和化学材料、操作过程和在用仪器进行全面的风险评估来确定所需安全培训的级别。"}, {"n": "6.2.2.1", "t": "生物样本库应定义并文件化其各项活动中的人员所的能力要求。"}, {"n": "6.2.2.2", "t": "生物样本库应确保其全体员工获得相关的教育、培训、技能证明和/或工作经验以胜任所承担的工作。"}, {"n": "6.2.2.3", "t": "生物样本库或其母体组织应妥善保管人员的成文信息，作为其专业能力和教育/培训（见6.2.3）的证据。"}, {"n": "6.2.2.4", "t": "生物样本库应根据制定的准则，开展人员与其从事相关工作能力的评估。"}, {"n": "6.2.2.5", "t": "生物样本库人员应定期接受适当且相关的能力评估，以确定哪些是需要获得的能力，哪些是要保持的必需的能力。"}, {"n": "6.2.3.1", "t": "全体人员应接受适当且相关的内部和/或外部培训，定期更新培训内容，获取新知识、保持必需的工作能力，培训应文件化。"}, {"n": "6.2.3.2", "t": "应对培训中人员进行监督，直到生物样本库确认该人员有能力胜任指定的工作职责。"}, {"n": "6.2.3.3", "t": "生物样本库应建立新员工入职政策，为新员工提供适当的任职培训。"}, {"n": "6.3.1", "t": "生物样本库应明确规定其活动所需的设施/专用区域和环境条件的要求。"}, {"n": "6.3.2", "t": "生物样本库或其母体组织应确定、控制和维持符合质量控制准则要求的设施/专用区域，并应建立相关程序以确保生物样本和相关数据满足预期要求及生物安全和生物安保的要求。"}, {"n": "6.3.3", "t": "必要时应对开展不相容活动的相邻区域进行有效隔离，采取措施避免交叉污染。"}, {"n": "6.3.4", "t": "生物样本库的设施/专用场所和环境条件应适合生物样本保藏，且不宜对预期要求产生负面影响。<br>注：可能影响预期目的的不良因素可能包括但不限于微生物污染、交叉污染、灰尘、电磁干扰、辐射、湿度、电力供应、温度、声音和振动。"}, {"n": "6.3.5", "t": "必要时，或当环境影响生物样本及相关数据的质量和/或人员健康和安全时，生物样本库应对设施/专用区域的环境条件进行测量、监测、控制和记录。"}, {"n": "6.3.6", "t": "生物样本库应考虑库容量扩展以储存增加的、分装的和/或处理的生物样本。"}, {"n": "6.3.7", "t": "生物样本库应制定应急预案，以确保在风险情况下其设施/专用区域内的环境条件符合要求。<br>示例：应有应急预案用于预防自然或人为的灾害，如停电、极端天气情况、地震和蓄意破坏。"}, {"n": "6.4.1", "t": "生物样本库应：<br>a) 确定外部供应中关键的过程、产品和服务的要求；<br>b) 将这些要求形成文件并告知外部供应方；<br>c) 保留上述沟通信息；<br>d) 确保外部供应的过程、产品和服务符合生物样本库的需求，不符合项应与外部供应方沟通。"}, {"n": "6.4.2", "t": "生物样本库应确定和采用相关准则，用于评价、选择、监管和再次评价外部供应方是否具备根据生物样本库需求提供过程或产品和服务的能力。生物样本库应保留这些活动及评估过程中必要措施的成文信息。"}, {"n": "6.4.3", "t": "生物样本库应明确哪些外部提供的过程或部分过程并应告知提供者/接收者/用户。"}, {"n": "6.4.4", "t": "生物样本库应确保外部提供的过程、产品和服务不会对生物样本库持续保存和供应经鉴定的生物样本和相关数据的能力产生负面影响。生物样本库应确定和评估外部提供的过程、产品和服务相关的风险。必要时，应采取措施避免对生物样本的保存和鉴定的符合性产生负面影响。"}, {"n": "6.4.5", "t": "生物样本库应确定必要的验证或其他活动，以确保外部供应的过程、产品和服务满足生物样本库的要求。"}, {"n": "6.4.6", "t": "当生物样本库决定利用外部提供的保存、储存和/或鉴定活动时，应遵循以下原则：<br>a) 根据提供的条款对此过程和全部相关的过程进行验证<br>b）外部供应方应针对该过程制定内审计划，并基于风险管理的方法定期实施（详见ISO 19011）；<br>c) 保留这些活动相关的成文信息。"}, {"n": "6.5.1", "t": "生物样本库应配备或控制访问生物样本保藏所需的所有设备。<br>注：这里的“设备”包括设备和相关软件（适用时）。"}, {"n": "6.5.2", "t": "生物样本库应建立、成文和实施程序，用于控制所有设备的操作、安全处置、运输、储存和计划性维护，必要时还应包括校准程序。"}, {"n": "6.5.3", "t": "生物样本库应有所有相关设备的使用和操作指南。"}, {"n": "6.5.4", "t": "生物样本库应根据设备对生物样本及相关数据的质量可能产生的直接或间接影响，对设备（包括备用设备）进行分类，确保能明确识别关键设备（如使用基于风险的方法）。"}, {"n": "6.5.5", "t": "生物样本库应建立和维持包含本准则6.5.1和6.5.2中确定的设备清单，包括每台设备的编目、性能、维护、验证及确认（如适用）的相关信息。"}, {"n": "6.5.6", "t": "生物样本库应在设备安装后和使用前验证其能达到必要的性能，并符合相关要求。"}, {"n": "6.5.7", "t": "关键设备应能达到所要求的准确度，并应符合样本处理或测试方法相关规范。"}, {"n": "6.5.8", "t": "应保存所有关键设备的成文信息，至少应包括以下内容：<br>a) 设备及其软件的标识；<br>b) 制造商名称、型号标识、序列号或其他唯一标识；<br>c) 核查设备符合说明书；<br>d) 当前的位置（适当时）；<br>e) 制造商的操作指南（如有）或其存放位置说明；<br>f) 校准、调试的结果、报告和证书，可接受准则和相关的日期（日期的记录格式参照GB/T 7408.1（见本准则7.1.3注）的规定）；<br>g) 下次校准的日期（日期的记录格式参照GB/T 7408.1（见本准则7.1.3注）<br>h) 维护计划、维护日期；<br>i) 设备的任何损坏、故障、改装或修理。"}, {"n": "6.5.9", "t": "关键设备及其软件应采取防护措施，防止被改动并产生无效结果。"}, {"n": "6.5.10", "t": "如适用，生物样本库应建立和维持测量结果的计量溯源性，通过不间断的比较链或比对，关联到适当的参考物质。"}, {"n": "6.5.11", "t": "发生以下情况时，设备应停止使用：<br>a) 过载或处置不当；<br>b) 设备产生潜在受损的过程输出/结果；<br>c) 显示有缺陷或超出指定范围。<br>这些设备应予以隔离以防误用，或加贴标签或标记以清晰表明该设备已停用，直至修复且经过校准或测试后表明能正常工作。"}, {"n": "6.5.12", "t": "生物样本库应根据本准则7.11采用适当的措施检查设备任何缺陷或与规范偏离所产生的影响。"}, {"n": "7.1.1", "t": "应明确生物样本及相关数据在生物样本库生命周期内所经历的阶段，并对适当过程进行确定和验证。工作流程应详细描述生命周期所有阶段的相关过程（如采集、登记、获取、标识、保存，长期储存、质控、运输和弃用）的具体程序（见4.1.1），每个程序的关键操作都应明确并形成文件（见7.8.2.7）。"}, {"n": "7.1.2", "t": "所有程序和过程都应持续更新并确保员工随时可用。"}, {"n": "7.1.3", "t": "所有生物样本生命周期内的关键阶段的日期都应按照标准格式文件化。生命周期关键阶段的时间（如，制备开始时间或持续时间、冷冻时间）宜规定按照标准格式。日期和时间的记录格式宜参照GB/T 7408.1的规定。<br>注：日期可表示为 YYYY-MM-DD（如 2018-04-25），时间可表示为 hh:mm:ss (如 04:26:55)"}, {"n": "7.2.1.1", "t": "当生物样本库负责生物样本采集时，应明确并记录需要采集的生物样本相关信息。这些信息应包含采集的日期、场所和程序及其他任何与实现目标有关的信息（如分类学信息），还宜包括生物样本采集的时间。日期和时间的记录格式宜参照GB/T 7408.1（见本准则7.1.3注）的规定。"}, {"n": "7.2.1.2", "t": "当生物样本库获得生物样本时（即生物样本库不负责采集样本），宜明确采集过程中所需或建议采集的信息并保留恰当的成文信息。"}, {"n": "7.2.2", "t": "只要可能，生物样本库应记录和/或保留接收前生物样本经历阶段的相关信息，这些阶段可能对生物样本的属性产生影响，记录/保留相关信息可用于评估生物样本与预期使用目的的适合性。更多详情和要求见附录A。附录B给出了补充信息。"}, {"n": "7.2.3.1", "t": "生物样本库和/或接收方/用户应根据生物样本预期用途、成熟技术或相关标准等确定采集程序。"}, {"n": "7.2.3.2", "t": "相关和适当时，宜依据ISO文件（如 ISO 20166-1，-2和-3，ISO 20184-1和-2，ISO 20186-1，-2和-3，ISO/TS 20658）执行分析前工作流程。"}, {"n": "7.2.3.3", "t": "合格和授权的员工和/或接收方/用户（适用时）应根据确定好的程序采集生物样本。<br>生物样本保藏要求也适用于需要临床评估和/或诊断的生物样本，这些样本的制备、解剖（需要时）、大体病理学评价和采集应由有资格的员工（如经过专门训练的、有经验的、机构认证或有资质的员工）承担。研究需要采集生物样本和/或数据时，应确保其不会对患者的护理和诊断或供体的健康产生不利影响。"}, {"n": "7.2.3.4", "t": "人类生物样本的采集应按照相关伦理要求执行（如相关伦理审批、病人/供体的知情同意或放弃同意）。"}, {"n": "7.3.1.1", "t": "生物样本库应制定、成文，并在相关的情况下公布生物样本及相关数据的访问原则。生物样本库应确保其与相关利益方建立的书面要求符合这些原则。"}, {"n": "7.3.2.1", "t": "生物样本库应建立、成文并实施接收或获得生物样本及相关数据的程序（如内部转移或外部运输/转移）。<br>注：这些程序也可称为登记程序。"}, {"n": "7.3.2.2", "t": "生物样本库应明确生物样本及相关数据的接收原则，包括生物安全、生物安保和知识产权等。在获得和接收生物样本及相关数据时应根据接收原则核实其身份。"}, {"n": "7.3.2.3", "t": "适当和适用时（如细胞株和微生物），生物样本库应依据现有相关的国际标准或指南对生物样本进行鉴定。"}, {"n": "7.3.2.4", "t": "生物样本库在接收或获得生物样本及相关数据时，无论是单个的、部分的还是完整的生物样本及相关数据，都应隔离（见7.7.5）保存，直至通过评估和管理使其符合相关法律、伦理、文件和质量要求后，方可最终储存。"}, {"n": "7.3.2.5", "t": "生物样本库应获取相关成文信息，特别是用于评估所接收或获得的生物样本属性与满足预期要求所需要的信息。"}, {"n": "7.3.2.6", "t": "生物样本库不负责采集或取样时，应予以文件说明。"}, {"n": "7.3.3.1", "t": "生物样本及相关数据的分发和交换应依据生物样本库访问原则（见7.3.1）、报告要求（见7.12）和其他相关要求（如材料转移协议（MTA），数据转移协议（DTA））进行。"}, {"n": "7.3.3.2", "t": "当向生物样本库以外的接收方/用户提供生物样本及相关数据时，应确保使用书面协议或具有法律约束力的文件（如合同、书面和签署的承诺、有约束力的网络接收条款和条件）阐明提供和使用生物样本及相关数据的条件。对这些文件的所有更改都应记录。"}, {"n": "7.3.3.3", "t": "生物样本库应建立、成文并实施生物样本和/或相关数据的制备和分发程序，使其满足本准则7.3.3.2中的书面协议或具有法律约束力的文件的要求。"}, {"n": "7.3.3.4", "t": "向接收方/用户分发生物样本和/或相关数据时，除生物样本库有正当理由拒绝外（如遵守数据保护规定），本准则7.12中的预定义信息也应提供。"}, {"n": "7.4.1", "t": "生物样本库应建立、成文并实施生物样本及相关数据运输和接收程序，包括本准则附录A中维持生物样本完整性的适当条件。示例详见附录B。"}, {"n": "7.4.2", "t": "生物样本库应保留生物样本从发送点到接收点关键监管链的记录。如运输会改变生物样本的质量（或认为有必要），就应对这些因素（如时间线/持续时间、温度、湿度和生物样本适宜的光照等）跟踪和监控确保生物样本的完整性。监管链的记录应根据本准则7.11条详细说明任何偏离指定参数的情况。"}, {"n": "7.4.3", "t": "生物样本库应有与生物样本相关的安全处理、包装、运输和接收程序。"}, {"n": "7.4.4", "t": "在生物样本库或其母体组织内，生物样本宜有人管理，或根据相关程序规定放置在指定监管区。"}, {"n": "7.4.5", "t": "运输生物样本的准备工作应交由能胜任此项工作的员工完成。"}, {"n": "7.4.6", "t": "在生物样本运输前，应满足本准则7.3.3.2条的要求，并就生物样本的分发和接收与有关各方共同做出安排。"}, {"n": "7.4.7", "t": "生物样本库应建立、成文并实施传输和接收数据的程序。数据传输应确保其完整性并防止侵犯数据隐私。数据传输前，应就数据的分发和接收与有关各方共同做出安排。"}, {"n": "7.5.1", "t": "生物样本库应确保每个生物样本及相关数据从采集（如相关）、获得或接收到分发、弃用或销毁的全过程具有可追溯性。并按下列方式来确保可追溯性：<br>a) 生物样本应有适当的标识，以确保在生物样本库监管下的整个生命周期中均可识别其身份。当生物样本使用唯一标识符时，应特别关注标识的持久性，例如使用外加或预制的方法，包括打印标签、条形码、二维码、射频识别技术（RFID）、微电子机械系统（MEMS）。生物样本库应有成文的标识程序，并符合环境要求及相关的储存条件。<br>b) 每个生物样本及相关数据都应关联到成文信息，该信息应包含其使用许可或限制的详细内容。<br>c) 库存或追踪系统应允许对任何处理程序关联的相关信息进行注释和查询，包括采集、包装、运输、制备、保存、储存和分发程序。该系统宜允许对生物样本保藏程序中的任何偏离进行标记。<br>d) 应建立和维护生物样本及相关数据之间的链接，以保证这些信息明确可追溯。<br>e) 应可随时确定生物样本及相关数据的位置。<br>f) 应可随时确定已分发给接收方/用户或已处置的生物样本及相关数据。"}, {"n": "7.5.2", "t": "信息宜方便员工获取，从而满足数据查询的需要，例如在收到关于分发样本的投诉或询问时。"}, {"n": "7.5.3", "t": "生物样本库应建立、成文并实施生物样本和/或数据的弃用和转移程序，既作为计划程序，也可做应急预案（见7.1.1）。"}, {"n": "7.6.1", "t": "制备和/或保存的方法应根据成文的循证方法（如国际标准）制定，或与生物样本提供者/接收者/客户协商一致的方法。"}, {"n": "7.6.2", "t": "应监控制备和/或保存程序（见A.4）中的关键活动并记录相关参数，应分别记录每一项保存步骤。"}, {"n": "7.6.3", "t": "所有生物样本的每个制备和/或保存步骤的日期应按标准格式记录，每个相关步骤的时间宜按标准格式记录，日期和时间的标准格式宜参照GB/T 7408.1（见本准则7.1.3注）的规定。"}, {"n": "7.7.1", "t": "生物样本库或其母体组织宜建立灾难保护计划，使用备选的安全措施避免生物样本损失。"}, {"n": "7.7.2", "t": "生物样本库应具备生物样本储存和追溯的书面程序，且至少包含下列信息：<br>a) 标识信息（至少包含生物样本唯一标识符）；<br>b) 储存生物样本的容器类型和环境条件；<br>c) 可追溯的机制（见7.5）；<br>d) 一旦发生影响既定储存条件的紧急事件，应有维持准确储存条件/温度的短期后备计划。"}, {"n": "7.7.3", "t": "在储存过程中执行关键处理步骤时，应测量、监控并记录相关过程参数。储存过程中对任何生物样本执行关键处理步骤的日期（见本准则7.1.3注）、操作时间（必要时）以及接触生物样本的工作人员（见本准则4.1.7）均应被记录。日期和时间均宜参照GB/T 7408.1（见本准则7.1.3注）规定的格式记录。"}, {"n": "7.7.4", "t": "生物样本库应记录和核实所有生物样本及相关数据的储存位置，任何时候应确保每份生物样本和每次储存可被追溯。"}, {"n": "7.7.5", "t": "储存地点和过程应被设计成能将污染风险降至最低，并能确保维持生物样本的内在完整性。"}, {"n": "7.7.6", "t": "储存条件应符合本准则6.3条的要求。"}, {"n": "7.7.7", "t": "生物样本库宜按规定的程序计划的间隔时间核查库存清单。"}, {"n": "7.7.8", "t": "适当时，生物样本库应建立、成文并实施程序，使患者/供体能行使撤回生物样本及相关数据储存和使用的知情同意的权利。"}, {"n": "7.8.1.1", "t": "生物样本库、提供者、接收者或用户应识别影响生物样本及相关数据质量的关键处理步骤。生物样本库应据此建立、成文并实施质量控制(QC)程序。"}, {"n": "7.8.1.2", "t": "生物样本库应提供满足要求的生物样本及相关数据，并应规定生物样本及相关数据至少所需的QC程序或其部分。珍稀生物样本、既存生物样本及相关数据，或QC程序导致生物样本耗尽时方可例外。<br>注：“既存生物样本及相关数据”是指生物样本库在实施本准则前获得和接收的生物样本及相关数据。"}, {"n": "7.8.1.3", "t": "上述QC程序应：<br>a) 根据已验证的技术制定并满足预期目的；<br>b) 定期更新；<br>c) 确保尽可能满足提供者、接收者或用户需求。"}, {"n": "7.8.2.1", "t": "生物样本库应建立、成文并实施程序，规定覆盖生物样本保藏全过程的QC活动，并包括符合既定规范的QC准则，以证明生物样本及相关数据能满足预期要求。"}, {"n": "7.8.2.2", "t": "QC应按既定的时间间隔执行，生物样本库应保留QC活动和结果的成文信息。"}, {"n": "7.8.2.3", "t": "应对QC数据进行分析。如不能满足既定的准则，应采取措施控制无效数据报告和/或不合格生物样本及相关数据的分发。"}, {"n": "7.8.2.4", "t": "生物样本库应确保将识别出的问题清晰记录并传达给接收者/用户。在生物样本及相关数据分发过程中，接收者/用户决定是否接收已书面告知存在问题的生物样本及相关数据。"}, {"n": "7.8.2.5", "t": "当有明确要求时，生物样本库应确保向接收者/用户提供QC结果。"}, {"n": "7.8.2.6", "t": "应定期分析QC结果的趋势，作为持续改进过程的输入。"}, {"n": "7.8.2.7", "t": "生物样本库应记录所有附录A中描述与过程的相关数据。"}, {"n": "7.8.2.8", "t": "作为QC系统的一部分，生物样本库宜有适宜的质控品（如内控品），应定期检查生物样本库选用的质控品以评估这些生物样本的重要质量特性，包括稳定性、处理方法的性能和QC程序的准确度/精密度。"}, {"n": "7.8.2.9", "t": "生物样本库应使用能提供客观证据的方法（可获得并适当时）以证明生物样本质量（如处理或检测结果）的可比性，这些方法包括相关的外部质量评价（EQA）计划、能力验证计划，实验室间比对，或生物样本库自行建立的方法，包括使用以下物质：<br>a) 有证参考物质，如可能，由符合ISO 17034的生产商生产的参考物质；<br>b) 之前检查过的样品；<br>c) 之前与其他生物样本库分享的样品；<br>d) EQA计划中常规测试的质控品。"}, {"n": "7.8.2.10", "t": "如生物样本库参加室间比对计划，应监控室间比对的结果，当未满足预定的评价准则时，应实施并记录纠正措施。"}, {"n": "7.8.3.1", "t": "生物样本库应确定能够影响生物样本质量的关键数据，且至少对这些关键数据建立、成文并实施QC程序。"}, {"n": "7.8.3.2", "t": "生物样本库应明确QC实施的类型和频率。QC应注重数据的准确性、完整性和一致性。"}, {"n": "7.9.1", "t": "生物样本库执行生物样本生命周期中的任何关键活动时，应遵循本准则7.9.2和7.9.3的相关要求，使用经过确认和/或验证的方法。"}, {"n": "7.9.2.1", "t": "当生物样本库为关键活动提供/应用方法时，生物样本库应确认这些方法可满足预期要求。当由生物样本库来进行确认时，生物样本库应记录并按规定的时间保留获得的结果、确认的程序以及该方法是否满足要求的声明。"}, {"n": "7.9.2.2", "t": "确认应尽可能广泛，并通过提供客观证据(以性能特征的形式)来确认预期用途的特定要求已得到满足。"}, {"n": "7.9.2.3", "t": "当对已确认的方法进行更改时，应记录这些更改的影响，适当时应进行新的确认。"}, {"n": "7.9.3.1", "t": "生物样本库应对未经修改的确认方法在使用前进行验证。"}, {"n": "7.9.3.2", "t": "生物样本库进行的验证应通过获取客观证据(以性能特征的形式)来证实该方法的设置标准已得到满足。"}, {"n": "7.9.3.3", "t": "生物样本库应文件化用以验证的程序和获得的结果。"}, {"n": "7.10.1", "t": "生物样本库应明确与生物样本有关的必要的信息和数据，并应有信息系统用于生物样本的跟踪。生物样本库应尽合理的努力支持信息和数据的交互性。"}, {"n": "7.10.2", "t": "生物样本库应明确系统未来能承载的容量，确保其能满足进一步添加和/或处理与生物样本相关的信息和数据。"}, {"n": "7.10.3", "t": "当信息系统用于生物样本库活动时，应有计算机系统的软件、硬件和数据库的安装、变更和使用程序。该程序应至少包括保护数据的完整性、安全控制和备份系统，防止数据的丢失或损坏。"}, {"n": "7.10.4", "t": "生物样本库应按合同协议规定提供访问所需数据和信息的服务。"}, {"n": "7.10.5", "t": "生物样本库应向利益相关方提供访问可利用的生物样本目录的途径。"}, {"n": "7.10.6", "t": "当研究目的需要时和/或符合适用要求及本准则7.3.3.2条时，生物样本库应保留对生物样本相关的适当数据的访问权。"}, {"n": "7.11.1.1", "t": "生物样本库应建立、成文并实施程序，用于管理与生物样本库既定要求和/或与接收者/用户（也见7.3.3.2）/提供者的协议不符合的输出。"}, {"n": "7.11.1.2", "t": "生物样本库应确保能识别和控制既定要求的不符合输出，以防止其被误用或提供。"}, {"n": "7.11.1.3", "t": "生物样本库应实施恰当的程序，向有关各方公开不符合输出的信息，适用时，使接收者/用户能判定不符合输出能否满足预期目的。"}, {"n": "7.11.1.4", "t": "生物样本库应基于不符合输出的性质以及对满足预期要求或对应用的影响，采取适当的纠正措施（见8.7），这也适用于在提供生物样本及相关数据后发现的不符合输出。"}, {"n": "7.11.1.5", "t": "不符合输出的程序应明确以下内容：<br>a) 不符合输出的管理责任和权限；<br>b) 评估不符合输出的严重性，包括将来使用这些不符合输出将造成的影响；<br>c) 决定是否接收、隔离、保留、归还、暂停供应或召回不符合输出；<br>d) 下列情况时，不符合输出持续存在：<br>1)\t不符合输出无法补救；<br>2)\t补救措施不可行；或<br>3)\t不符合输出可能影响第三方产生的结果；<br>e) 不符合输出的传达和接收者/用户接受的授权。"}, {"n": "7.11.1.6", "t": "不符合输出的处理程序应同样适用于首次采用本准则前所收集或获得的生物样本及相关数据。"}, {"n": "7.11.2.1", "t": "生物样本库应尽可能减少不符合输出的影响，采取与不符合输出造成的风险相称的纠正措施，以防止其再次发生。补救措施应在确定的范围内实施，且该措施在不符合输出纠正（也见8.7）后应加以控制。"}, {"n": "7.11.2.2", "t": "满足本准则8.7.3的要求。"}, {"n": "7.11.2.3", "t": "生物样本库应及时做出召回决定以限制不符合输出的使用。"}, {"n": "7.12.1.1", "t": "生物样本库应提供至少符合本准则7.12.2要求的报告，应包含与接收者/用户签署的书面协议或其他具有法律约束力的文件（见7.3.3.2）所要求的信息。<br>注：报告有时称为证书。"}, {"n": "7.12.1.2", "t": "本准则7.12.2中报告的形式可以是硬拷贝或电子数据或可访问的数据库中的电子数据。"}, {"n": "7.12.1.3", "t": "生物样本库宜声明报告应完整复制。"}, {"n": "7.12.2.1", "t": "除非有文件化的正当理由，每份报告应至少包括以下信息：<br>a) 标题（例如“质量报告”或“样本证书”）；<br>b) 生物样本库的名称和地址；<br>c) 根据GB/T 7408.1（见本准则7.1.3注）规定的格式发布日期；<br>d) 报告的唯一识别编号，且报告的每一页都应有识别编号，报告的结尾应有清晰的标识；<br>e) 生物样本识别或特性；<br>f) 有关生物样本及相关数据的质量信息；<br>g) 识别或描述生物样本的方法；<br>h) 测试结果，适用时，测量结果的单位；<br>i) 测试方法；<br>j) 适用时，采集/获取、制备和/或保存的方法；<br>k) 储存条件；<br>l) 报告批准人的姓名和职务。"}, {"n": "7.12.2.2", "t": "生物样本库应对报告所有信息负责，除非这些信息是由提供者/接收者/用户提供的。当生物样本库不负责样本的采集和收集时，报告应声明其内容是基于生物样本库所接收到的样本。"}, {"n": "7.13.1", "t": "生物样本库应建立、成文并实施投诉的接收、评估及处理程序。"}, {"n": "7.13.2", "t": "一旦有需求，应可获得投诉处理的说明。如接到投诉，生物样本库应确认投诉是否与其活动相关及是否对此负责，如果是，应解决它。生物样本库应对投诉处理的各层面负责。"}, {"n": "7.13.3", "t": "处理投诉的过程应至少包括以下要素和方法：<br>a) 对投诉的接收、接受和调查以及决定对此采取何种处理措施的说明；<br>b) 跟踪并记录投诉，包括解决投诉所采取的措施；<br>c) 确保采取适当的措施。"}, {"n": "7.13.4", "t": "收到投诉的生物样本库应负责收集和核实所有必要的信息,以便决定是否接受该投诉。生物样本库应告知投诉人已收到投诉。"}, {"n": "7.13.5", "t": "只要可能，生物样本库应向投诉方提供处理进程报告。"}, {"n": "7.13.6", "t": "对每项投诉应进行公正调查。公正性调查的结果应通知相关方。"}, {"n": "7.13.7", "t": "只要可能，生物样本库应正式通知投诉方投诉处理完毕。"}, {"n": "8.1.1", "t": "总则:<br>生物样本库应建立、成文、实施和维持质量管理体系，该质量管理体系应能够支持和证明持续满足本准则的要求，并保证生物样本保藏的质量。<br>除了满足本准则第4～7条款，生物样本库应按方式A(8.1.2、8.2-8.9)或方式B（8.1.3）实施质量管理体系*。<br>方式A"}, {"n": "8.1.2", "t": "生物样本库质量管理体系至少应包含下列内容：<br>a) 质量管理体系的成文信息（见8.2）；<br>b) 质量管理体系文件控制（见8.3）；<br>c) 记录控制（见8.4）；<br>d) 应对风险和机遇的措施（见8.5）；<br>e) 改进（见8.6）；<br>f) 不符合输出的纠正措施（见8.7）；<br>g) 内部审核（见8.8）；<br>h) 管理评审（见8.9）。<br>方式B"}, {"n": "8.1.3", "t": "生物样本库按照ISO 9001的要求建立并保持质量管理体系，此质量管理体系能支持和证实持续符合本准则第4～7条款要求，也至少满足本准则8.2～8.9条款中规定的质量管理体系要求。<br>方式A"}, {"n": "8.2.1", "t": "为符合适当要求及确保生物样本保藏能力,生物样本库应管理规划和运营必要的成文信息（内部的和外部的）。为此，生物样本库应：<br>a) 识别出应文件化的信息；<br>b) 确保成文信息合理生成和更新；<br>c) 确保成文信息合理受控。"}, {"n": "8.2.2", "t": "生物样本库管理层应建立、成文并保持符合本准则目的的方针和目标，并确保这些方针和目标能在生物样本库内的不同层级得到理解和实行。"}, {"n": "8.2.3", "t": "方针和目标应体现能力、公正性和一致运作。"}, {"n": "8.2.4", "t": "生物样本库管理层应提供质量管理体系发展、实施并持续改进其有效性承诺的证据。"}, {"n": "8.2.5", "t": "质量管理体系应包含或提及本准则要求的文件、过程、体系和记录等。"}, {"n": "8.2.6", "t": "参与生物样本库活动的所有人员可获得与其职责相适应部分的质量管理体系文件和相关信息。<br>方式A"}, {"n": "8.3.1", "t": "生物样本库应控制与满足本准则相关的文件（内部或外部的）。"}, {"n": "8.3.2", "t": "生物样本库应确保：<br>a) 文件发布前由经授权人员审查其充分性并批准；<br>b) 文件定期审查，必要时更新；<br>c) 识别更新内容及当前修订状态；<br>d) 操作现场应可获取适用文件的相关版本，必要时控制其发放；<br>e) 文件唯一性标识；<br>f) 防止误用作废文件，无论处于任何目的而保留的作废文件，应有适当标识。<br>方式A"}, {"n": "8.4.1", "t": "生物样本库应建立并保持清晰记录以证明满足本准则的要求。"}, {"n": "8.4.2", "t": "生物样本库应对其记录的识别、储存、保护、备份、存档、检索、保留时间和弃用实施所需的控制。生物样本库应遵循合同和法律规定的保存期限来保留记录。"}, {"n": "8.4.3", "t": "记录的调阅应符合机密的约定，记录应易于获得。<br>方式A"}, {"n": "8.5.1", "t": "生物样本库应考虑与其生物样本保藏活动相关的风险和机遇，为了：<br>a) 确保质量管理体系能实现预期结果；<br>b) 增强实现生物样本库目的和目标的机遇；<br>c) 预防或减少生物样本保藏中的不良影响和潜在失败，包括生物样本库操作的中止；<br>d) 实现持续改进。"}, {"n": "8.5.2", "t": "生物样本库应建立、成文并实施下列内容：<br>a) 应对风险和机遇的措施预案；<br>b) 在灾难性事件中，生物样本及相关数据的安保措施预案；<br>c) 中止相关操作的措施预案，尤其对生物样本及相关数据的处理；<br>注：可以是针对既存样本的预案。<br>d) 通过如下途径：<br>1）在质量管理体系中整合并实施这些措施；<br>2）评估这些措施的有效性；<br>3）在任何情况下若生物样本库关闭，处理后续事务。"}, {"n": "8.5.3", "t": "应对风险和机遇的措施应与其对生物样本保藏的潜在影响和有效性相适应。<br>注1：应对风险的方式包括识别并规避威胁，为寻求机遇承担风险，消除风险源，改变风险的可能性和后果，分担风险，或通过知情决策而保留风险。<br>注2：机遇可能促使扩大生物样本保藏范围，赢得新接收者/用户，使用新技术和其他可能方式应对接收者/用户的需求。<br>方式A"}, {"n": "8.6.1", "t": "生物样本库应识别并选择改进机遇，并实施必要的措施。<br>注：生物样品库可通过操作程序的评审、政策的使用、总体目标、审核结果、纠正措施、管理评审、风险评估、数据分析和能力验证结果识别改进机遇。"}, {"n": "8.6.2", "t": "生物样本库应向提供者/接收者/用户征求反馈，无论是正面的还是负面的。应分析和利用这些反馈，以改进质量管理体系、生物样本保藏和对提供者/接收者/用户的服务。<br>注：反馈的类型示例包括提供者/接收者/用户满意度调查、与提供者/接收者/用户共同评价报告。<br>方式A"}, {"n": "8.7.1", "t": "当发生本准则7.11中描述的不符合输出时，生物样本库应：<br>a) 适用时，对不符合输出做出应对：<br>1）采取措施以控制和纠正不符合；<br>2）对后果的处理。<br>b) 评价是否需要采取措施，以消除产生不符合输出的原因，避免其再次发生或者在其他场合发生：<br>1)\t评审和分析不符合输出；<br>2)\t确定不符合输出的原因；<br>3）确定是否存在或可能发生类似的不符合输出；<br>c)\t建立、成文并实施需采取的纠正措施；<br>d)\t评审所采取的任何纠正措施的有效性；<br>e)\t必要时，更新计划中确定的风险和机遇；<br>f)\t必要时，更改质量管理体系。"}, {"n": "8.7.2", "t": "纠正措施应与不符合输出的影响相适应。"}, {"n": "8.7.3", "t": "生物样本库应保留下列成文信息作为证据：<br>a) 不符合输出的性质、原因和后续采取的措施；<br>b) 任何纠正措施的结果和有效性。<br>方式A"}, {"n": "8.8.1", "t": "生物样本库应：<br>a) 考虑生物样本库相关活动的重要性、影响生物样本库的变化以及之前审核的结果，策划、实施和维护内部审核方案，审核方案包括频次、方法、职责、策划要求和报告；<br>b) 确定每次审核的审核准则和范围；<br>c) 确保将审核结果报告给相关管理层；<br>d) 及时采取适当的纠正和纠正措施；<br>e) 保留记录，作为实施审核方案和审核结果的证据。<br>注：内部审核参考GB/T 19011提供的指南。"}, {"n": "8.8.2", "t": "生物样本库应按计划的时间间隔进行内部审核，并提供以下信息用于评估质量管理体系：<br>a) 是否符合下列要求：<br>1）生物样本库自身质量管理体系要求；<br>2）本准则要求；<br>b)\t是否有效实施和维持。<br>方式A"}, {"n": "8.9.1", "t": "生物样本库最高管理层应按计划的时间间隔对质量管理体系进行评审，确保其持续的适宜性、充分性和有效性，包括为满足本准则所声明的相关方针和目标。"}, {"n": "8.9.2", "t": "应记录管理评审的输入，并应包含以下相关信息：<br>a) 生物样本库相关的内外部因素变化；<br>b) 目标实现情况；<br>c) 方针和程序的适宜性；<br>d) 以往管理评审采取措施的状态；<br>e) 近期内部审核的输出；<br>f) 纠正措施；<br>g) 外部机构进行的评审；<br>h) 生物样本库工作量和工作类型或工作范围变化；<br>i) 提供者/接收者/用户反馈；<br>j) 投诉；<br>k) 实施改进的有效性；<br>l) 生物样本及相关数据的充分性；<br>m) 风险识别的结果；<br>n) 质量控制的输出；<br>o) 其他相关要素，如监测活动和培训。"}, {"n": "8.9.3", "t": "管理评审的输出应记录与以下内容相关的决定和措施：<br>a) 质量管理体系及其过程的有效性；<br>b) 与满足本准则要求相关的活动的改进；<br>c) 所需的生物样本及相关数据的提供；<br>d) 任何变更的需求。"}];

  /* ---------- 对话渲染 ---------- */
  var cur = null;       // 当前功能 key
  var busy = false;

  /* ---------- 会话上下文 ----------
     迎检智能体留档一条会话：对话内容、工作流状态、滚动位置、最近一轮话题。
     切走再切回来上下文不丢；只有「新对话」才真正清空。 */
  var SESSIONS = {};   // key -> { html, wf, scroll, at, title }
  var CTX = {};        // key -> { q }  最近一轮话题，用于承接式回复

  function lastUserText() {
    var all = msgs.querySelectorAll('.ag-msg.user .ag-bubble');
    if (!all.length) return '';
    var t = all[all.length - 1].textContent.replace(/\s+/g, ' ').trim();
    return t.length > 20 ? t.slice(0, 20) + '…' : t;
  }

  function sessionTitle() {
    if (cur === 'yj') {
      var yp = [];
      if (ywf.type) yp.push(ywf.type.name);
      if (ywf.tpl) yp.push(ywf.tpl.name);
      if (ywf.mat) {
        var mt = MAT_TPL.filter(function (x) { return x.key === ywf.mat; })[0];
        if (mt) yp.push(mt.name.split(' · ').pop());
      }
      if (yp.length) return yp.join(' · ');
    }
    return lastUserText() || FUNCS[cur].name;
  }

  function saveSession() {
    if (!cur) return;
    /* 复制一份 DOM 再剔除未完成的「思考中」气泡，避免留档里留一个假气泡 */
    var box = document.createElement('div');
    box.innerHTML = msgs.innerHTML;
    Array.prototype.forEach.call(box.querySelectorAll('.ag-typing'), function (t) {
      var m = t.closest ? t.closest('.ag-msg') : null;
      if (m) m.remove();
    });
    SESSIONS[cur] = {
      html: box.innerHTML,
      wf: { yj: snapshotYwf() },
      scroll: stage.scrollTop,
      at: Date.now(),
      title: sessionTitle()
    };
  }

  function dropSession(key) { delete SESSIONS[key]; delete CTX[key]; }

  function pushUser(text) {
    var el = document.createElement('div');
    el.className = 'ag-msg user';
    el.innerHTML = '<div class="ag-msg-avatar">我</div><div class="ag-bubble">' + text + '</div>';
    msgs.appendChild(el);
    toBottom();
  }

  function pushAgent(html, trace) {
    var el = document.createElement('div');
    el.className = 'ag-msg agent';
    var traceHtml = '';
    if (trace && trace.length) {
      traceHtml = '<div class="ag-trace">' + trace.map(function (t) {
        return '<span class="ag-trace-chip"><span class="ok">✓</span>' + t + '</span>';
      }).join('') + '</div>';
    }
    el.innerHTML = '<div class="ag-msg-avatar">🤖</div><div class="ag-bubble">' + traceHtml + html + '</div>';
    msgs.appendChild(el);
    toBottom();
    return el;
  }

  var pendingYj = null;    // 深链交接：{ rt: 评审类型 key, tpl: 日程模板 key }

  /* ==================== 迎检工作流：评审信息 → 日程模板 → 生成评审日程 → 生成过程材料 ====================
     前 3 步以 CNAS-PD14-09D0《现场评审日程表》为蓝本倒排评审安排；
     第 4 步以 CNAS-PD14-23D1《评审报告》及附表 1~8 为模板生成各阶段过程材料。 */
  var YJ_STEPS = ['确认评审信息', '选择日程模板', '生成评审日程', '生成过程材料'];
  var ywf = { step: 0, type: null, tpl: null, start: null, done: null, mat: null };

  function yjReset() { ywf = { step: 0, type: null, tpl: null, start: null, done: null, mat: null }; }

  function snapshotYwf() {
    return {
      step: ywf.step,
      type: ywf.type ? ywf.type.key : null,
      tpl: ywf.tpl ? ywf.tpl.key : null,
      start: ywf.start,
      done: ywf.done,
      mat: ywf.mat
    };
  }

  function reviveYwf(s) {
    ywf = { step: s.step, type: null, tpl: null, start: s.start || null, done: s.done || null, mat: s.mat || null };
    var t = REVIEW_TYPES.filter(function (x) { return x.key === s.type; })[0];
    if (t) ywf.type = t;
    var p = s.tpl ? SCHED_TPL[s.tpl] : null;
    if (p) ywf.tpl = p;
  }

  /* 评审起始日：默认取「今天起 14 天」的周一，避免硬编码；套用模板时按相对日推算具体日期 */
  function yjDefaultStart() {
    var d = new Date();
    d.setDate(d.getDate() + 14);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
  }
  function yjFmt(d) {
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }
  var YJ_WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  /* 把相对日标签（T-7 / D-1 / D1…）换算成以 start 为 D1 的实际日期 */
  function yjDayLabel(start, day) {
    if (!start || !day) return '';
    var d = new Date(start.getTime());
    d.setDate(d.getDate() + (day - 1));
    return yjFmt(d) + '（' + YJ_WEEK[d.getDay()] + '）';
  }

  /* 倒排任务（渲染与导出共用一份数据） */
  function yjDueRows(start) {
    return [
      { when: 'T-7', d: 0, label: yjFmt(new Date(start.getTime())) + ' 前', task: '指定对接人，确认现场见证 / 现场试验安排与录像清单', who: '质量负责人' },
      { when: 'T-3', d: 0, label: '现场评审前 3 天', task: '体系运行介绍 PPT 定稿（8-10 分钟，聚焦自上次评审以来的变化）', who: '质量负责人' },
      { when: 'T-3', d: 0, label: '现场评审前 3 天', task: '完成 4/5/6/7/8 章材料到桌面就位与签名完整性核对', who: '各条款责任人' },
      { when: 'T-1', d: 0, label: '现场评审前 1 天', task: '会场、投影、网络、打印、住宿与陪同人员确认；廉洁自律声明送法人签署', who: '行政 / 办公室' },
      { when: 'D1', d: 1, label: yjDayLabel(start, 1), task: '首日签到表、领导讲话稿与陪同人到位；当日问题当晚整改', who: '质量负责人' },
      { when: 'D2', d: 2, label: yjDayLabel(start, 2), task: '授权签字人到场并完成网上推荐表 / 评价表填报', who: '授权签字人' },
      { when: 'D3', d: 3, label: yjDayLabel(start, 3), task: '封存现场试验记录汇总，按《现场评审资料汇总表》核对资料与签名', who: '资料员' },
      { when: 'T+2月', d: 0, label: '现场评审后 2 个月内', task: '提交整改方案（含任务分解表及时间计划）→ 汇总整改报告', who: '质量负责人' }
    ];
  }

  /* ---------- 评审日程导出（下载为 CSV，可用 Excel / WPS 打开） ---------- */
  function plainText(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(); }
  function csvCell(v) { return '"' + plainText(v).replace(/"/g, '""') + '"'; }
  function yjScheduleCSV() {
    var d = ywf.done;
    if (!d) return null;
    var t = d.type, p = d.tpl, start = d.start;
    var L = [];
    L.push(['现场评审日程表（CNAS-PD14-09D0）']);
    L.push(['被评审机构', '本机构临床数据及样本资源库']);
    L.push(['评审类型', t.name]);
    L.push(['评审日期', yjDayLabel(start, 1) + ' 起 ' + p.days + ' 天']);
    L.push(['日程模板', p.name]);
    L.push(['评审依据', 'CNAS-R01 · CNAS-RL10 · CNAS-CL10 · 本机构质量手册 / 程序文件 / SOP']);
    L.push(['评审范围', t.scope]);
    L.push(['导出时间', yjNow()]);
    L.push([]);
    L.push(['一、评审组成员分工']);
    L.push(['评审组成员', '负责评审的要素及技术领域', '对应条款 / 领域代码']);
    REVIEW_TEAM.forEach(function (m) { L.push([m.role, m.field, (m.clause || '') + (m.codes ? ' · ' + m.codes : '')]); });
    L.push([]);
    L.push(['二、现场评审日程（逐时段）']);
    p.groups.forEach(function (g, gi) {
      var dm = /第\s*(\d)\s*天/.exec(g.g);
      var dateTxt = dm ? yjDayLabel(start, parseInt(dm[1], 10))
        : (/会前/.test(g.g) ? 'T-7 ~ ' + yjDayLabel(start, 0) + '（预备会）' : '现场评审结束后 2 个月内');
      L.push([String.fromCharCode(9312 + gi) + ' ' + g.g, dateTxt]);
      L.push(['时段', '评审组活动', '我方（样本库）准备', '依据']);
      g.rows.forEach(function (r) { L.push([r.t, r.r, r.o, r.c]); });
      L.push([]);
    });
    L.push(['三、我方倒排任务']);
    L.push(['倒排节点', '截止', '我方准备事项', '责任人']);
    yjDueRows(start).forEach(function (x) { L.push([x.when, x.label, x.task, x.who]); });
    return '\uFEFF' + L.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  }
  function yjNow() {
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function downloadSchedule() {
    var csv = yjScheduleCSV();
    if (!csv) return null;
    var d = ywf.done, s = d.start, p = function (n) { return n < 10 ? '0' + n : '' + n; };
    var date = s.getFullYear() + p(s.getMonth() + 1) + p(s.getDate());
    var name = ('现场评审日程_' + d.type.name + '_' + date + '.csv').replace(/[\\/:*?"<>|]/g, '');
    downloadText(name, csv);
    return name;
  }

  /* --- 步骤 1：确认评审信息（评审类型 + 起始日期） --- */
  function renderYjTypePicker() {
    return renderStepper(0, YJ_STEPS) +
      '<p>开始迎检前，请先确认<b>评审类型</b>——不同类型对应的评审天数、覆盖要素与日程模板都不同。' +
      '选定后可继续挑选日程模板。</p>' +
      '<div class="ag-type-grid">' + REVIEW_TYPES.map(function (t) {
        return '<button class="ag-type-card" data-ag-rt="' + t.key + '">' +
          '<span class="ag-type-no">' + t.no + '</span>' +
          '<div><strong>' + t.name + '</strong><small>' + t.scope + ' · ' + t.note + '</small></div>' +
          '</button>';
      }).join('') + '</div>' +
      '<div class="ag-pick-foot"><span class="ag-pick-hint">点击卡片即选定，随后挑选评审日程模板</span></div>';
  }

  /* --- 步骤 2：选择日程模板（含评审起始日期） --- */
  function renderYjTplPicker() {
    var t = ywf.type;
    var recommend = t ? t.tpl : 'std3';
    var chosen = ywf.tpl ? ywf.tpl.key : recommend;
    var items = ['std3', 'light2'].map(function (k) {
      var p = SCHED_TPL[k];
      var on = k === chosen;
      return '<button class="ag-pick-item' + (on ? ' on' : '') + '" data-ag-tpl="' + k + '">' +
        '<span class="ag-pick-box">' + (on ? '✓' : '') + '</span>' +
        '<span class="ag-pick-main">' +
          '<span class="ag-pick-name">' + p.name + (k === recommend ? ' · 推荐' : '') + '</span>' +
          '<span class="ag-pick-meta"><i>' + p.tag + '</i><i>适用：' + p.fit + '</i></span>' +
          '<span class="ag-pick-meta"><i>' + p.ask + '</i></span>' +
        '</span></button>';
    }).join('');
    var start = ywf.start || yjDefaultStart();
    var base = yjDefaultStart();
    var days = ywf.tpl ? ywf.tpl.days : (t ? t.days : 3);
    /* 已有选定档期时，把它标成选中（而不是永远选第一个） */
    var selOff = 0;
    [0, 7, 14, 21].forEach(function (off) {
      var d = new Date(base.getTime());
      d.setDate(d.getDate() + off);
      if (d.toDateString() === start.toDateString()) selOff = off;
    });
    return renderStepper(1, YJ_STEPS) +
      '<p>评审类型：<b>' + (t ? t.name : '—') + '</b>（覆盖 <b>' + (t ? t.scope : '—') +
      '</b>）。请选择<b>评审日程模板</b>，并确认现场评审的起始日期。</p>' +
      '<div class="ag-pick">' +
        '<div class="ag-pick-head"><span>📋 日程模板</span><b>共 2 套</b>' +
        '<span class="ag-pick-count">' + days + ' 天现场</span></div>' +
        '<div class="ag-pick-grid" style="padding-top:11px">' + items + '</div>' +
      '</div>' +
      '<div class="ag-pick">' +
        '<div class="ag-pick-head"><span>📅 现场评审起始日（第 1 天）</span>' +
        '<span class="ag-pick-count">' + yjFmt(start) + ' 起 ' + days + ' 天</span></div>' +
        '<div class="ag-pick-grid" style="padding-top:11px">' +
          [0, 7, 14, 21].map(function (off) {
            var d = new Date(base.getTime());
            d.setDate(d.getDate() + off);
            var on = off === selOff;
            return '<button class="ag-pick-item' + (on ? ' on' : '') + '" data-ag-yjdate="' + off + '">' +
              '<span class="ag-pick-box">' + (on ? '✓' : '') + '</span>' +
              '<span class="ag-pick-main">' +
                '<span class="ag-pick-name">' + yjFmt(d) + '（' + YJ_WEEK[d.getDay()] + '）</span>' +
                '<span class="ag-pick-meta"><i>' + (off === 0 ? '默认档期' : '+' + off + ' 天') + '</i></span>' +
              '</span></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="ag-pick-foot"><span class="ag-pick-hint">起始日决定 D-1 预备会与现场各天的具体日期</span>' +
      '<button class="ag-go sec" data-ag-ywf="back-types">← 重选评审类型</button>' +
      '<button class="ag-go" data-ag-ywf="sched">生成评审日程 →</button></div>';
  }

  /* --- 步骤 3：生成评审日程（封面信息 + 组内分工 + 逐时段日程 + 倒排任务） --- */
  function renderYjSchedule() {
    var t = ywf.type, p = ywf.tpl, start = ywf.start || yjDefaultStart();

    var totalRows = 0, ownRows = 0;
    p.groups.forEach(function (g) {
      g.rows.forEach(function (r) { totalRows++; if (r.o && r.o !== '待命' && r.o !== '—') ownRows++; });
    });

    /* 封面信息 */
    var cover =
      '<div class="ag-obj">' +
      '<div class="ag-obj-item full"><div class="ag-obj-label">被评审机构</div>' +
      '<div class="ag-obj-value">本机构临床数据及样本资源库</div></div>' +
      '<div class="ag-obj-item"><div class="ag-obj-label">评审类型</div><div class="ag-obj-value">' +
      t.name + '</div></div>' +
      '<div class="ag-obj-item"><div class="ag-obj-label">评审日期</div><div class="ag-obj-value">' +
      yjDayLabel(start, 1) + ' 起 ' + p.days + ' 天</div></div>' +
      '<div class="ag-obj-item full"><div class="ag-obj-label">评审依据</div><div class="ag-obj-value"><small>' +
      'CNAS-R01《认可标志和认可状态声明管理规则》· CNAS-RL10《生物样本库认可规则》· ' +
      'CNAS-CL10《生物样本库质量和能力认可准则》· 本机构质量手册 / 程序文件 / SOP</small></div></div>' +
      '<div class="ag-obj-item full"><div class="ag-obj-label">评审范围</div><div class="ag-obj-value"><small>' +
      '① 认可准则要求的要素：' + t.scope.split(' · ')[0] + '　② 技术能力：' + t.scope.split(' · ')[1] +
      '　③ 涉及的分支机构或多地点：无</small></div></div>' +
      '</div>';

    /* 评审组分工 */
    var team =
      '<div class="ag-table-wrap"><table class="ag-table">' +
      '<thead><tr><th>评审组成员</th><th>负责评审的要素及技术领域</th><th>对应条款 / 领域代码</th></tr></thead><tbody>' +
      REVIEW_TEAM.map(function (m) {
        return '<tr><td class="ag-c">' + m.role + '</td><td>' + m.field + '</td>' +
          '<td><small>' + m.clause + (m.codes ? '　·　' + m.codes : '') + '</small></td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div class="ag-note">陪同人与联系电话按评审组通知后填入；本表已按脱敏规则处理，模板不保留真实姓名。</div>';

    /* 逐时段日程：按阶段分组，每组一张表；组标题带上换算后的实际日期 */
    var sched = '';
    p.groups.forEach(function (g, gi) {
      var dm = /第\s*(\d)\s*天/.exec(g.g);
      var dateTxt = dm ? yjDayLabel(start, parseInt(dm[1], 10))
        : (/会前/.test(g.g) ? 'T-7 ~ ' + yjDayLabel(start, 0) + '（预备会）'
          : '现场评审结束后 2 个月内');
      sched += '<div class="ag-answer-sub" style="margin-top:' + (gi ? '16px' : '4px') + '">' +
        String.fromCharCode(9312 + gi) + ' ' + g.g + '　·　' +
        '<span style="color:var(--primary-dark);font-weight:600">' + dateTxt + '</span></div>' +
        '<div class="ag-table-wrap"><table class="ag-table ag-sched">' +
        '<thead><tr><th>时段</th><th>评审组活动</th><th>我方（样本库）准备</th><th>依据</th></tr></thead><tbody>' +
        g.rows.map(function (r) {
          return '<tr><td class="ag-tm">' + r.t + '</td><td>' + r.r + '</td>' +
            '<td class="ag-own">' + r.o + '</td><td><small>' + r.c + '</small></td></tr>';
        }).join('') +
        '</tbody></table></div>';
    });

    /* 倒排任务：把「我方准备」抽成按日期倒排的待办 */
    var dued = yjDueRows(start);

    var dueTable =
      '<div class="ag-table-wrap"><table class="ag-table">' +
      '<thead><tr><th>倒排节点</th><th>截止</th><th>我方准备事项</th><th>责任人</th></tr></thead><tbody>' +
      dued.map(function (x, i) {
        var tag = i < 4 ? 'tag-error' : 'tag-default';
        return '<tr><td><span class="tag ' + tag + '">' + x.when + '</span></td><td><small>' + x.label +
          '</small></td><td>' + x.task + '</td><td><small>' + x.who + '</small></td></tr>';
      }).join('') +
      '</tbody></table></div>';

    ywf.done = { type: t, tpl: p, start: start, rows: totalRows, own: ownRows };

    var teamCodes = REVIEW_TEAM.length;
    return renderStepper(3, YJ_STEPS) +
      '<p>已按 <b>CNAS-PD14-09D0《现场评审日程表》</b> 生成 <b>' + t.name + '</b> 的现场评审日程：' +
      '模板 <b>' + p.name + '</b>，现场 <b>' + p.days + ' 天</b>，共 <b>' + totalRows + '</b> 个时段事项、' +
      '其中 <b>' + ownRows + '</b> 项需要我方在对应时点准备到位。</p>' +
      '<div class="ag-note">日程已从「评审组内部预备会」倒排到「会后 2 个月内整改」，' +
      '每个时段都标注了我方准备与判定依据 —— 可直接当迎检排班表用。</div>' +
      cover +
      '<div class="ag-answer-sub" style="margin-top:16px">评审组成员分工</div>' + team +
      '<div class="ag-answer-sub" style="margin-top:18px">现场评审日程（逐时段）</div>' + sched +
      '<div class="ag-answer-sub" style="margin-top:18px">我方倒排任务</div>' + dueTable +
      '<div class="ag-kpis">' +
      '<div class="ag-kpi"><b>' + p.days + '</b><span>现场评审天数</span></div>' +
      '<div class="ag-kpi"><b>' + totalRows + '</b><span>日程时段事项</span></div>' +
      '<div class="ag-kpi"><b>' + ownRows + '</b><span>我方准备项</span></div>' +
      '<div class="ag-kpi"><b>' + teamCodes + '</b><span>评审组分工</span></div>' +
      '</div>' +
      '<div class="ag-pick-foot">' +
      '<span class="ag-pick-hint">下一步：按阶段生成评审报告与附表</span>' +
      '<button class="ag-go sec" data-ag-dl="sched">⬇ 下载日程</button>' +
      '<button class="ag-go sec" data-ag-ywf="back-tpl">← 换日程模板</button>' +
      '<button class="ag-go" data-ag-ywf="mats">生成过程材料 →</button></div>' +
      mods([
        { icon: '⊕', name: '任务配置', href: 'task-config.html' },
        { icon: '📁', name: '材料智能归档', href: 'archive.html' },
        { icon: '✓', name: '检查清单', href: 'checklist.html' },
        { icon: '▤', name: '报告自动生成', href: 'report.html' }
      ]) +
      suggest([
        '把 ' + ownRows + ' 项准备事项转成任务并指派责任人',
        '导出「' + t.name + '」评审日程表',
        '按日程逐时段生成迎检检查清单'
      ]);
  }

  /* ==================== 迎检 · 过程材料（评审报告 + 附表 1~8） ====================
     模板里的 {{token}} 由 yjTokens() 按已确认的评审信息填充；未确认的留占位提示。
     材料表是「可填写表格」：结构 + 勾选项 + 签字栏都还原，值域留空待填。 */
  function yjTokens() {
    var t = ywf.type, p = ywf.tpl, start = ywf.start || yjDefaultStart();
    var days = p ? p.days : (t ? t.days : 3);
    var strip = function (s) { return s.replace(/（.*?）|\(.*?\)/g, ''); };
    var d1 = strip(yjDayLabel(start, 1)), dn = strip(yjDayLabel(start, days));
    return {
      org: '本机构临床数据及样本资源库',
      type: t ? t.name : '（待确认评审类型）',
      date: t ? (d1 + ' 至 ' + dn + '，共 ' + days + ' 天') : '（待确认评审日期）',
      start: d1, end: dn, days: String(days),
      basis: 'CNAS-R01《认可标志和认可状态声明管理规则》· CNAS-RL10《生物样本库认可规则》· CNAS-CL10《生物样本库质量和能力认可准则》· 本机构质量手册 / 程序文件 / SOP',
      scope: t ? t.scope : '（待确认评审范围）',
      teams: REVIEW_TEAM.map(function (m) { return m.role; }).join('、'),
      clauses: String(CL10_CLAUSES.length),
      taskno: 'BB______-____-__'
    };
  }
  function yjFill(s) {
    var tk = yjTokens();
    return String(s == null ? '' : s).replace(/\{\{(\w+)\}\}/g, function (m, k) {
      return tk[k] != null ? tk[k] : m;
    });
  }

  /* 空格待填：蓝色虚线底，视觉上区分「已预填」与「待填写」 */
  function matBlank() { return '<span class="mat-fill"></span>'; }

  function matBlocks(blocks) {
    return blocks.map(function (b) {
      if (b.t === 'sub') {
        return '<div class="ag-answer-sub" style="margin-top:18px">' + b.s + '</div>';
      }
      if (b.t === 'note') {
        return '<div class="ag-note">' + yjFill(b.s) + '</div>';
      }
      if (b.t === 'info') {
        return '<div class="ag-obj">' + b.items.map(function (it) {
          return '<div class="ag-obj-item' + (it.span === 'full' ? ' full' : '') + '">' +
            '<div class="ag-obj-label">' + it.k + '</div>' +
            '<div class="ag-obj-value">' + (it.v ? yjFill(it.v) : matBlank()) + '</div></div>';
        }).join('') + '</div>';
      }
      if (b.t === 'table') {
        return '<div class="ag-table-wrap"><table class="ag-table mat-table">' +
          '<thead><tr>' + b.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
          '<tbody>' + b.rows.map(function (r) {
            return '<tr>' + r.map(function (c, ci) {
              var cls = (b.c && ci === 0) ? ' class="ag-c"' : '';
              return '<td' + cls + '>' + (c === '' ? matBlank() : yjFill(c)) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (b.t === 'check') {
        return '<div class="mat-checks">' + b.items.map(function (it) {
          return '<div class="mat-check-row">' +
            (it.k ? '<b>' + it.k + '：</b>' : '') +
            '<span>' + it.opts.map(function (o) { return '□ ' + o; }).join(it.sep || '　　') + '</span></div>';
        }).join('') + '</div>';
      }
      if (b.t === 'text') {
        var lines = [];
        for (var i = 0; i < (b.lines || 3); i++) lines.push('<div class="mat-line"></div>');
        return '<div class="mat-text">' +
          '<div class="mat-text-label">' + b.k + (b.hint ? '<small>' + b.hint + '</small>' : '') + '</div>' +
          (b.v ? '<div class="mat-text-pre">' + yjFill(b.v) + '</div>' : '') +
          '<div class="mat-lines">' + lines.join('') + '</div></div>';
      }
      if (b.t === 'sign') {
        return '<div class="mat-sign">' + b.items.map(function (s) {
          return '<span>' + s + '</span>';
        }).join('') + '</div>';
      }
      if (b.t === 'clauses') {
        return matClauses();
      }
      return '';
    }).join('');
  }

  /* 附表3：185 条准则按第 4~8 章分组渲染，逐条给「评审结果 / 评审说明」填写位 */
  var CL10_CH = { '4': '第 4 章 通用要求', '5': '第 5 章 结构要求', '6': '第 6 章 资源要求',
    '7': '第 7 章 过程要求', '8': '第 8 章 管理体系要求' };
  function matClauses() {
    var chs = {};
    CL10_CLAUSES.forEach(function (c) {
      var ch = String(c.n).split('.')[0];
      (chs[ch] = chs[ch] || []).push(c);
    });
    return Object.keys(chs).sort().map(function (ch) {
      return '<div class="ag-answer-sub" style="margin-top:16px">' + (CL10_CH[ch] || ('第 ' + ch + ' 章')) +
        '　·　<b>' + chs[ch].length + '</b> 条</div>' +
        '<div class="ag-table-wrap"><table class="ag-table mat-table ag-clause">' +
        '<thead><tr><th>条款</th><th>认可准则要求（CNAS-CL10：2020）</th><th>评审结果</th><th>评审说明</th></tr></thead>' +
        '<tbody>' + chs[ch].map(function (c) {
          return '<tr><td class="ag-c">' + c.n + '</td><td>' + c.t + '</td>' +
            '<td class="ag-c"><small>□符合<br>□不符合<br>□不适用</small></td><td>' + matBlank() + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
  }

  /* --- 步骤 4：过程材料库（按评审阶段分组） --- */
  var MAT_CATS = ['现场评审中', '评审结论', '会后整改'];
  function renderYjMaterialLib() {
    var groups = {};
    MAT_TPL.forEach(function (m) { (groups[m.cat] = groups[m.cat] || []).push(m); });
    var t = ywf.type;
    var body = MAT_CATS.filter(function (c) { return groups[c]; }).map(function (c) {
      return '<div class="ag-answer-sub" style="margin-top:16px">' + c +
        '　·　<b>' + groups[c].length + '</b> 份</div>' +
        '<div class="ag-pick-grid" style="padding-top:11px">' +
        groups[c].map(function (m) {
          return '<button class="ag-pick-item" data-ag-mat="' + m.key + '">' +
            '<span class="ag-pick-box">▤</span>' +
            '<span class="ag-pick-main">' +
              '<span class="ag-pick-name">' + m.name + '</span>' +
              '<span class="ag-pick-meta"><i>' + m.no + '</i><i>' + m.stage + '</i></span>' +
              '<span class="ag-pick-meta"><i>' + m.tag + '</i></span>' +
            '</span></button>';
        }).join('') + '</div>';
    }).join('');
    return renderStepper(3, YJ_STEPS) +
      '<p>现场评审日程已就绪。接下来可以按评审阶段<b>逐份生成过程材料</b> —— ' +
      '报告与附表的结构、勾选项、签字栏都已按 <b>CNAS-PD14-23D1</b> 还原，' +
      '并把本次已确认的评审信息（<b>' + (t ? t.name : '评审类型待确认') + '</b>）自动带入。</p>' +
      '<div class="ag-note info">共 <b>' + MAT_TPL.length + '</b> 份材料：主报告 1 份 + 附表 8 份。' +
      '点开任意一份即可查看并填写；已预填的字段可直接改，蓝色虚线框为待填写项。</div>' +
      body +
      '<div class="ag-pick-foot">' +
      '<span class="ag-pick-hint">材料随「评审类型 / 日程模板 / 起始日」自动同步</span>' +
      '<button class="ag-go sec" data-ag-ywf="sched">← 回看评审日程</button>' +
      '<button class="ag-go sec" data-ag-ywf="back-types">← 换评审类型</button></div>';
  }

  /* --- 步骤 4：单份材料（可填写表格） --- */
  function renderYjMaterial() {
    var m = MAT_TPL.filter(function (x) { return x.key === ywf.mat; })[0];
    if (!m) return renderYjMaterialLib();
    ywf.done = ywf.done || { type: ywf.type, tpl: ywf.tpl, start: ywf.start };
    return renderStepper(4, YJ_STEPS) +
      '<p>已按 <b>' + m.no + '</b> 生成「<b>' + m.name + '</b>」——' + m.lead + '</p>' +
      '<div class="ag-note info">对应阶段：<b>' + m.stage + '</b>　·　形态：' + m.tag +
      '　·　已用本次评审信息预填机构 / 类型 / 日期 / 依据；空位请在现场填写。</div>' +
      matBlocks(m.blocks) +
      '<div class="ag-pick-foot">' +
      '<span class="ag-pick-hint">可继续生成其它材料</span>' +
      '<button class="ag-go sec" data-ag-ywf="mats">← 返回材料清单</button>' +
      '<button class="ag-go sec" data-ag-ywf="sched">← 回看评审日程</button></div>' +
      mods([
        { icon: '⊕', name: '任务配置', href: 'task-config.html' },
        { icon: '▤', name: '报告自动生成', href: 'report.html' },
        { icon: '📁', name: '材料智能归档', href: 'archive.html' }
      ]) +
      suggest([
        '把这份材料的待填项转成迎检任务',
        '生成下一份过程材料（' + nextMatName(m.key) + '）',
        '导出「' + m.name + '」'
      ]);
  }

  function nextMatName(key) {
    var i = MAT_TPL.map(function (x) { return x.key; }).indexOf(key);
    var n = MAT_TPL[(i + 1) % MAT_TPL.length];
    return n ? n.name : '评审报告';
  }

  /* --- 迎检工作流驱动 --- */
  function yjRun(steps, html) {
    return wfRun(steps, html);
  }

  function yjGoto(step) {
    ywf.step = step;
    if (step === 0) yjRun(['加载 CNAS 评审规则库', '匹配评审类型要求'], renderYjTypePicker());
    else if (step === 1) yjRun(['读取日程模板库', '校验档期冲突'], renderYjTplPicker());
    else if (step === 2) yjRun(['套用 CNAS-PD14-09D0 日程模板', '按评审类型补齐要素', '生成我方准备清单'], renderYjSchedule());
    else if (step === 3) {
      if (ywf.mat) yjRun(['读取 CNAS-PD14-23D1 模板库', '按已确认评审信息预填', '生成可填写过程材料'], renderYjMaterial());
      else yjRun(['读取 CNAS-PD14-23D1 模板库', '按评审阶段归集过程材料'], renderYjMaterialLib());
    }
  }

  /* 选定一份过程材料：带入本次评审信息后直接生成可填写表格 */
  function yjPickMat(key) {
    if (busy || cur !== 'yj') return;
    var m = MAT_TPL.filter(function (x) { return x.key === key; })[0];
    if (!m) return;
    ywf.mat = key;
    pushUser('生成过程材料：' + m.name);
    setTimeout(function () { yjGoto(3); }, 200);
  }

  function yjPickType(key) {
    if (busy || cur !== 'yj') return;
    var t = REVIEW_TYPES.filter(function (x) { return x.key === key; })[0];
    if (!t) return;
    ywf.type = t;
    ywf.tpl = SCHED_TPL[t.tpl];      // 按评审类型带出推荐模板
    ywf.start = yjDefaultStart();
    ywf.done = null;                 // 换类型即作废上一轮日程
    pushUser('评审类型：' + t.name);
    setTimeout(function () { yjGoto(1); }, 200);
  }

  function renderStepper(active, steps) {
    var arr = steps || YJ_STEPS;
    return '<div class="ag-stepper">' + arr.map(function (s, i) {
      var cls = i < active ? 'done' : (i === active ? 'now' : '');
      var no = i < active ? '✓' : (i + 1);
      return (i ? '<span class="ag-step-arrow">›</span>' : '') +
        '<span class="ag-step ' + cls + '"><span class="ag-step-no">' + no + '</span>' + s + '</span>';
    }).join('') + '</div>';
  }

  function wfRun(steps, html, trace) {
    busy = true;
    sendBtn.disabled = true;
    var typing = pushTyping();
    var txt = typing.querySelector('.ag-typing-text');
    var idx = 0;
    txt.textContent = steps[0] + '…';
    var timer = setInterval(function () {
      idx++;
      if (idx < steps.length) { txt.textContent = steps[idx] + '…'; return; }
      clearInterval(timer);
      typing.remove();
      var el = pushAgent(html, trace ? steps : null);
      scrollToBubble(el);
      busy = false;
      sendBtn.disabled = false;
    }, 420);
  }

  function pushIntro() {
    var f = FUNCS[cur];
    if (cur === 'yj') {
      yjReset();
      var pj = pendingYj; pendingYj = null;
      var rt = pj ? REVIEW_TYPES.filter(function (x) { return x.key === pj.rt; })[0] : null;
      if (rt) {
        ywf.type = rt;
        ywf.tpl = (pj.tpl && SCHED_TPL[pj.tpl]) || SCHED_TPL[rt.tpl];
        ywf.start = yjDefaultStart();
        pushAgent('<p>' + f.intro + '</p>');
        setTimeout(function () { yjGoto(2); }, 260);
        return;
      }
      pushAgent('<p>' + f.intro + '</p>' +
        '<div class="ag-note info">现场评审日程按 <b>CNAS-PD14-09D0</b> 编排：' +
        '<b>① 确认评审信息 → ② 选择日程模板 → ③ 生成评审日程 → ④ 生成过程材料</b>；' +
        '第 ④ 步按 <b>CNAS-PD14-23D1</b> 逐份生成评审报告与附表 1~8，并自动带入本次评审信息。</div>' +
        '<div class="ag-pick-foot" style="margin-top:2px">' +
        '<span class="ag-pick-hint">也可以直接用下方的快捷指令</span>' +
        '<button class="ag-go sec" data-ag-ywf="mats">过程材料模板</button>' +
        '<button class="ag-go" data-ag-ywf="start">编排现场评审日程 →</button></div>' +
        suggest(f.prompts.map(function (p) { return p.q; })));
      fullscreenTop();
      return;
    }
    pushAgent('<p>' + f.intro + '</p>' + suggest(f.prompts.map(function (p) { return p.q; })));
    // 开场白要完整可见，不自动滚到底
    fullscreenTop();
  }

  function pushTyping() {
    var el = document.createElement('div');
    el.className = 'ag-msg agent';
    el.innerHTML = '<div class="ag-msg-avatar">🤖</div>' +
      '<div class="ag-bubble ag-typing"><span class="ag-dots"><i></i><i></i><i></i></span>' +
      '<span class="ag-typing-text">正在思考…</span></div>';
    msgs.appendChild(el);
    toBottom();
    return el;
  }

  /* ==========================================================
     菜单导航意图（2026-09-24）
     输入「查看 <菜单名>」→ 给导引 + 直达入口。
     支持近义 / 相近词：动词（查看 / 打开 / 进入 / 看下 / 定位 …）
     + 菜单别名（规则/质量规则/规则库、审计/操作日志、数据治理/数据质控 …），
     并用「二元组 Dice 相似度 + 包含判定」做模糊匹配。
     ========================================================== */
  var MENUS = [
    { name: '迎检总览', page: '#', icon: '⌂', desc: '全局进度看板：条款 / 材料 / 任务 / 风险一屏总览', kw: ['首页', '主页', '总览', '看板', '仪表盘', '概览', '首页看板'] },
    { name: '任务分配', page: 'task-config.html', icon: '⊕', desc: '为每条条款配置负责人、自评人、复核人与截止日期', kw: ['任务', '任务分配', '任务配置', '派任务', '分配任务', '分派', '任务管理'] },
    { name: '检查清单', page: 'checklist.html', icon: '✓', desc: '现场迎检检查清单与逐项勾选', kw: ['清单', '检查清单', '核查表', '核对清单', 'checklist'] },
    { name: 'CNAS 条款库', page: 'clause-library.html', icon: '≡', desc: 'CNAS-CL01 / ISO 20387 条款全文与解读', kw: ['条款', '条款库', '准则', '标准条款', '条款查询', 'cnas'] },
    { name: '条款自评', page: 'self-assessment.html', icon: '☐', desc: '逐条自评打分并关联佐证材料', kw: ['自评', '条款自评', '自我评估', '自查', '自评价'] },
    { name: '材料智能归档', page: 'archive.html', icon: '📁', desc: '佐证材料上传、智能归类与核验', kw: ['材料', '归档', '材料归档', '证据材料', '佐证材料', '文件归档', '上传材料'] },
    { name: '版本管理', page: 'version.html', icon: '↻', desc: '受控文件版本对比与同步', kw: ['版本', '版本管理', '文件版本', '版本对比'] },
    { name: '智能报告', page: 'report.html', icon: '▤', desc: '选模板一键生成迎检报告', kw: ['报告', '智能报告', '评审报告', '报告生成', '生成报告', '报告模板', '迎检报告'] },
    { name: '历史评审记录', page: 'history.html', icon: '⏱', desc: '历次评审记录与整改复用', kw: ['历史', '历史记录', '评审记录', '历史评审', '历史评审记录'] },
    { name: '规则库', page: 'rule-library.html', icon: '📘', desc: '质量规则台账：规则列表 / 模板 / 版本 / 触发日志', kw: ['规则', '规则库', '质量规则', '规则管理', '规则列表'] },
    { name: '规则编排', page: 'rule-editor.html', icon: '✎', desc: '可视化新建 / 编辑规则（条件 → 动作）', kw: ['编排', '规则编排', '新建规则', '编辑规则', '规则编辑器'] },
    { name: '事件管控中心', page: 'event-control.html', icon: '🧭', desc: '事件全生命周期、预警与按条款/按人员查看', kw: ['事件', '事件中心', '事件管控', '告警', '预警', '事件监控'] },
    { name: '样本数据质控', page: 'data-quality.html', icon: '📊', desc: '数据质量规则、清洗建议与脱敏', kw: ['数据质控', '数据质量', '质控', '数据治理', '质量数据', '数据清洗'] },
    { name: '用户管理', page: 'system-users.html', icon: '◎', desc: '账号新建 / 停用 / 重置密码', kw: ['用户', '用户管理', '账号', '账号管理', '成员'] },
    { name: '角色管理', page: 'system-roles.html', icon: '🛡', desc: '角色与权限矩阵（9 模块 × 6 操作）', kw: ['角色', '角色管理', '权限', '权限矩阵', '角色权限', 'rbac'] },
    { name: '操作日志', page: 'system-audit.html', icon: '🔍', desc: '全量操作留痕与组合检索', kw: ['操作日志', '日志', '审计', '操作审计', '审计日志', '留痕'] }
  ];

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[\s，。！？、,.!?;；:：'"“”‘’（）()\[\]【】<>《》\-_/\\|＋+*#]+/g, '');
  }
  function bigrams(s) {
    var a = [];
    for (var i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2));
    return a;
  }
  /* 二元组 Dice 系数 + 包含判定：兼顾「完全同义」与「相近词」 */
  function sim(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 0.95;
    var A = bigrams(a), B = bigrams(b);
    if (!A.length || !B.length) return 0;
    var used = {}, m = 0;
    A.forEach(function (g) {
      for (var i = 0; i < B.length; i++) { if (!used[i] && B[i] === g) { used[i] = 1; m++; break; } }
    });
    return 2 * m / (A.length + B.length);
  }
  function topMenus(text, n) {
    var t = norm(text);
    return MENUS.map(function (m) {
      var s = 0;
      m.kw.concat([m.name]).forEach(function (k) { var sc = sim(t, k); if (sc > s) s = sc; });
      return { menu: m, score: s };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, n || 3);
  }
  function detectMenu(text) {
    var t = norm(text);
    if (!t) return null;
    if (/菜单|功能列表|有哪些功能|有哪些菜单|全部功能|功能导航|导航栏|能做什么|能干什么/.test(t)) return { list: true };
    var verbs = ['查看', '打开', '进入', '跳转', '切换', '定位', '导航', '看看', '看下', '看一下', '看',
                 '调出', '展示', '显示', '访问', '带我', '帮我打开', '我要看', '我想看'];
    var hasVerb = verbs.some(function (v) { return t.indexOf(norm(v)) >= 0; });
    var best = topMenus(text, 1)[0];
    if (!best || best.score <= 0) return hasVerb ? { list: true } : null;
    /* 无动词时，只有「几乎就是菜单名本身」（长度≈菜单名）才导航，
       避免把「生成迎检进度总览」这类指令误判成「去迎检总览」。 */
    var short = t.length <= norm(best.menu.name).length + 2 && t.length <= 8;
    if (hasVerb) return best.score >= 0.30 ? { menu: best.menu, score: best.score } : { list: true };
    if (short && best.score >= 0.60) return { menu: best.menu, score: best.score };
    return null;
  }
  function animateReply(steps, html) {
    busy = true; sendBtn.disabled = true;
    var typing = pushTyping();
    var txt = typing.querySelector('.ag-typing-text');
    var idx = 0; txt.textContent = steps[0] + '…';
    var timer = setInterval(function () {
      idx++;
      if (idx < steps.length) { txt.textContent = steps[idx] + '…'; }
      else { clearInterval(timer); typing.remove(); pushAgent(html, steps); busy = false; sendBtn.disabled = false; }
    }, 400);
  }
  function replyMenu(text, hit) {
    pushUser(text);
    if (hit.list) {
      var body = '<p>这是系统的主要功能菜单，点任意一项即可直达对应页面：</p>' +
        mods(MENUS.map(function (m) { return { icon: m.icon, name: m.name, href: m.page }; })) +
        suggest(['查看规则库', '打开事件管控中心', '查看操作日志']);
      animateReply(['读取菜单导航', '汇总功能入口'], body);
      return;
    }
    var m = hit.menu;
    var alts = topMenus(text, 4).filter(function (x) { return x.menu.name !== m.name && x.score > 0.3; }).slice(0, 3);
    var body = '<p>好的，为你打开 <b>' + esc(m.name) + '</b>。</p>' +
      '<div class="ag-note info">' + m.icon + ' <b>' + esc(m.name) + '</b>：' + esc(m.desc) + '</div>' +
      mods([{ icon: m.icon, name: m.name, href: m.page }]) +
      (alts.length ? '<div class="ag-suggest"><div class="ag-suggest-title">你可能还想去</div><div class="ag-chips">' +
        alts.map(function (x) { return '<button class="ag-chip" data-ag-chip="查看' + x.menu.name + '">' + x.menu.icon + ' ' + x.menu.name + '</button>'; }).join('') +
        '</div></div>' : '') +
      suggest(['查看操作日志', '打开事件管控中心', '查看规则库']);
    animateReply(['识别导航意图', '匹配菜单项', '生成入口'], body);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /* 我的待办：从 TASK_STORE（与事件管控中心同源）整理指定用户的待办 */
  function agentTodoHtml(text) {
    if (!window.TASK_STORE) return '<p>暂无法读取任务数据（请在本站内使用）。</p>';
    var all = window.TASK_STORE.all();
    var set = {}; all.forEach(function (t) { if (t.owner && t.owner !== '未分配') set[t.owner] = 1; });
    var names = Object.keys(set);
    var who = names.filter(function (n) { return text.indexOf(n) >= 0; })[0] || (names.indexOf('张三') >= 0 ? '张三' : names[0]);
    var mine = all.filter(function (t) { return t.owner === who; });
    function rel(d) { var m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(d || ''); if (!m) return null; var dd = new Date(+m[1], +m[2] - 1, +m[3]); var n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((dd - n) / 86400000); }
    function badge(t) {
      if (t.stage === '已完成') return '<span class="tag tag-success">已完成</span>';
      var r = rel(t.due); if (r == null) return '<span class="tag tag-default">' + esc(t.due) + '</span>';
      if (r < 0) return '<span class="tag tag-error">逾期 ' + (-r) + ' 天</span>';
      if (r <= 7) return '<span class="tag tag-warning">' + r + ' 天后到期</span>';
      return '<span class="tag tag-default">截止 ' + esc(t.due) + '</span>';
    }
    var g = { '未开始': [], '进行中': [], '已完成': [] };
    mine.forEach(function (t) { (g[t.stage] || g['未开始']).push(t); });
    ['未开始', '进行中', '已完成'].forEach(function (k) {
      g[k].sort(function (a, b) { var ra = rel(a.due), rb = rel(b.due); return (ra == null ? 9999 : ra) - (rb == null ? 9999 : rb); });
    });
    function grp(title, list) {
      if (!list.length) return '';
      return '<div class="ag-answer-sub" style="margin-top:14px">' + title + '　·　' + list.length + ' 条</div>' +
        '<div class="ag-table-wrap"><table class="ag-table"><thead><tr>' +
        '<th style="width:78px">条款</th><th>事项</th><th style="width:112px">截止</th><th style="width:110px">状态</th>' +
        '</tr></thead><tbody>' + list.map(function (t) {
          return '<tr><td class="ag-c">' + esc(t.code) + '</td><td>' + esc(t.name) + '</td><td>' + esc(t.due) + '</td><td>' + badge(t) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var od = mine.filter(function (t) { var r = rel(t.due); return t.stage !== '已完成' && r != null && r < 0; }).length;
    return '<p>已为你整理 <b>' + esc(who) + '</b> 的待办事项（数据来源：任务分配 / 事件管控中心同源）：共 <b>' + mine.length + '</b> 项' +
      (od ? '，其中 <b style="color:#F53F3F">' + od + ' 项逾期</b>' : '') + '。</p>' +
      grp('待完成（未开始）', g['未开始']) + grp('进行中', g['进行中']) + grp('已完成', g['已完成']) +
      mods([{ icon: '⊕', name: '任务分配', href: 'task-config.html' }, { icon: '🧭', name: '事件管控中心', href: 'event-control.html' }]) +
      suggest(['查看张三的待办', '把逾期的待办转成整改任务', '查看事件管控中心']);
  }

  function answer(text) {
    if (!cur || busy) return;

    /* 记录历史问答 */
    if (window.__AW_HIST) window.__AW_HIST.push(text);

    /* 菜单导航优先：命中「查看 <菜单名>」时直接给出导引与直达入口 */
    var navHit = detectMenu(text);
    if (navHit) { replyMenu(text, navHit); return; }

    /* 我的待办：整理某用户的待办事项（任务分配 / 事件管控同源数据） */
    if (/待办|待完成|待处理|我的任务|任务清单|to-?do/i.test(text) && window.TASK_STORE) {
      pushUser(text);
      animateReply(['读取任务数据', '按阶段与截止时间归类', '整理待办清单'], agentTodoHtml(text));
      return;
    }

    /* 日程导出：输入 / 点建议里的「导出…评审日程表」直接下载 */
    if (/导出|下载/.test(text) && /日程/.test(text)) {
      var exportName = downloadSchedule();
      pushUser(text);
      animateReply(['读取当前评审日程', '生成可下载文件'],
        exportName
          ? '<p>已导出当前现场评审日程：<b>' + exportName + '</b>（CSV · UTF-8 带 BOM，可直接用 Excel / WPS 打开）。</p>'
          : '<p>还没有生成评审日程，请先完成「评审信息 → 日程模板 → 生成日程」再导出。</p>');
      return;
    }

    // 迎检：评审日程编排是强顺序流程（评审信息 → 日程模板 → 生成日程）；
    // 其余诉求仍走原有的快捷指令（倒排待办 / gap 清单 / 进度总览）。
    if (cur === 'yj') {
      var wantSched = /评审日程|日程表|日程模板|编排|排班/.test(text);
      if (wantSched) {
        if (!ywf.type) { yjGoto(0); return; }   // 还不知道评审类型 → 先确认
        if (!ywf.tpl) { yjGoto(1); return; }    // 还缺日程模板 → 先选模板
        yjGoto(2); return;                      // 信息齐了 → 直接生成日程
      }
      /* 过程材料：说「评审报告 / 附表 / 模板」直接进材料库；点到具体表名就直接生成那一份 */
      var wantMat = /评审报告|附表|过程材料|材料模板|报告模板|材料表格|生成材料/.test(text);
      if (wantMat) {
        var pickedMat = MAT_TPL.filter(function (m) {
          return text.indexOf(m.name) >= 0 || text.indexOf(m.no) >= 0 ||
            text.indexOf(m.name.split(' · ')[1] || '') >= 0;
        })[0];
        if (pickedMat) { yjPickMat(pickedMat.key); return; }
        ywf.mat = null;
        CTX[cur] = { q: text };
        pushUser(text);
        setTimeout(function () { yjGoto(3); }, 180);
        return;
      }
      /* 原有 3 条快捷指令优先，不被工作流拦走 */
      var yjKw = ['待办', '倒排', '缺', '材料', '总览', '进度', '归档', '逾期', '超期'];
      var yjQuick = false;
      for (var qi = 0; qi < yjKw.length; qi++) {
        if (text.indexOf(yjKw[qi]) >= 0) { yjQuick = true; break; }
      }
      /* 工作流进行中且用户没说别的 → 回到当前步骤，别让流程断掉 */
      if (!yjQuick && (ywf.step === 0 || ywf.step === 1)) {
        var yjGuide = {
          0: '<p>需要先确认<b>评审类型</b>，我会据此带出对应的日程模板与评审天数。</p>' + renderYjTypePicker(),
          1: '<p>请选择<b>日程模板</b>并确认现场评审起始日，我会按 CNAS-PD14-09D0 生成逐时段日程。</p>' + renderYjTplPicker()
        }[ywf.step];
        CTX[cur] = { q: text };
        pushUser(text);
        wfRun(['解析诉求', '定位当前步骤'], yjGuide);
        return;
      }
    }

    var f = FUNCS[cur];
    var hit = null;
    for (var i = 0; i < f.prompts.length; i++) {
      if (f.prompts[i].q === text) { hit = f.prompts[i]; break; }
    }
    if (!hit) {
      var kw = {
        yj: ['评审', '迎检', '材料', '清单', '条款', '归档', '缺']
      };
      var words = kw[cur] || [];
      for (var j = 0; j < words.length; j++) {
        if (text.indexOf(words[j]) < 0) continue;
        for (var m = 0; m < f.prompts.length; m++) {
          if (f.prompts[m].q.indexOf(words[j]) >= 0) { hit = f.prompts[m]; break; }
        }
        if (hit) break;
      }
    }

    /* 「编排现场评审日程」这条预设不是一段静态回复，而是迎检工作流的入口 */
    if (hit && hit.a === 'schedule') { pushUser(text); yjGoto(0); return; }
    /* 「生成评审报告与附表」同为工作流入口：直达过程材料库 */
    if (hit && hit.a === 'materials') { pushUser(text); ywf.mat = null; yjGoto(3); return; }

    var steps = hit ? hit.t : ['解析诉求', '检索依据', '生成结果'];
    var bodyKey = hit ? hit.a : 'fallback';
    var customHtml = null;

    /* 命中留档的会话上下文：没匹配到预设指令时，沿着上一轮结论继续 */
    if (!hit && CTX[cur]) {
      steps = ['读取本会话上下文', '承接上一轮结论', '生成下一步建议'];
      customHtml = '<p>已接上本会话的上下文：上一轮我们处理的是「<b>' + CTX[cur].q + '</b>」。</p>'
        + '<div class="ag-note info">沿着这个结论，我可以继续为你：<br>'
        + '· 把结果转成任务单或整改单并指派责任人<br>'
        + '· 生成对应报告并走审批流程<br>'
        + '· 回到条款库核对本次判定依据</div>'
        + mods(FUNC_MODS[cur])
        + suggest(FUNC_NEXT[cur]);
    }
    CTX[cur] = { q: text };

    busy = true;
    sendBtn.disabled = true;
    pushUser(text);
    var typing = pushTyping();
    var txt = typing.querySelector('.ag-typing-text');
    var idx = 0;
    txt.textContent = steps[0] + '…';
    var timer = setInterval(function () {
      idx++;
      if (idx < steps.length) {
        txt.textContent = steps[idx] + '…';
      } else {
        clearInterval(timer);
        typing.remove();
        pushAgent(customHtml || FRAG[bodyKey], steps);
        busy = false;
        sendBtn.disabled = false;
      }
    }, 480);
  }

  /* ---------- 进入 / 退出功能 ---------- */
  function enter(key, presetQ) {
    if (cur && cur !== key) saveSession();   // 离开当前功能前先留档
    cur = key;
    var f = FUNCS[key];
    input.placeholder = f.placeholder;

    var saved = SESSIONS[key];
    if (saved) {
      /* 命中留档：原样还原对话与工作流状态，上下文不丢 */
      msgs.innerHTML = saved.html;
      yjReset();
      if (saved.wf && saved.wf.yj) reviveYwf(saved.wf.yj);
      var y = saved.scroll || 0;
      requestAnimationFrame(function () { scrollStage(y, false); });
    } else {
      yjReset();
      msgs.innerHTML = '';
      pushIntro();
    }
    if (presetQ) setTimeout(function () { answer(presetQ); }, 320);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    /* 迎检工作流：选定评审类型 */
    var rtBtn = e.target.closest('[data-ag-rt]');
    if (rtBtn) {
      yjPickType(rtBtn.getAttribute('data-ag-rt'));
      return;
    }

    /* 迎检工作流：切换日程模板（就地切换，不新起一条消息） */
    var tplBtn = e.target.closest('[data-ag-tpl]');
    if (tplBtn) {
      if (busy) return;
      var tkey = tplBtn.getAttribute('data-ag-tpl');
      var tpl = SCHED_TPL[tkey];
      if (!tpl) return;
      ywf.tpl = tpl;
      ywf.done = null;
      var tgrid = tplBtn.parentElement;
      Array.prototype.forEach.call(tgrid.children, function (c) {
        var on = c === tplBtn;
        c.classList.toggle('on', on);
        var bx = c.querySelector('.ag-pick-box');
        if (bx) bx.textContent = on ? '✓' : '';
      });
      var tc = tplBtn.closest('.ag-pick');
      var tcount = tc && tc.querySelector('.ag-pick-count');
      if (tcount) tcount.textContent = tpl.days + ' 天现场';
      return;
    }

    /* 迎检工作流：切换评审起始日（就地切换） */
    var dateBtn = e.target.closest('[data-ag-yjdate]');
    if (dateBtn) {
      if (busy) return;
      var off = parseInt(dateBtn.getAttribute('data-ag-yjdate'), 10) || 0;
      var d = new Date(yjDefaultStart().getTime());
      d.setDate(d.getDate() + off);
      ywf.start = d;
      ywf.done = null;
      var dgrid = dateBtn.parentElement;
      Array.prototype.forEach.call(dgrid.children, function (c) {
        var on = c === dateBtn;
        c.classList.toggle('on', on);
        var bx = c.querySelector('.ag-pick-box');
        if (bx) bx.textContent = on ? '✓' : '';
      });
      var dgrp = dateBtn.closest('.ag-pick');
      var dcount = dgrp && dgrp.querySelector('.ag-pick-count');
      if (dcount) dcount.textContent = yjFmt(d) + ' 起 ' + (ywf.tpl ? ywf.tpl.days : 3) + ' 天';
      return;
    }

    /* 迎检：下载当前评审日程（CSV） */
    var dlBtn = e.target.closest('[data-ag-dl]');
    if (dlBtn) {
      if (busy) return;
      var dlname = downloadSchedule();
      pushUser('下载评审日程表');
      if (!dlname) {
        animateReply(['检查日程状态'], '<p>还没有生成评审日程，请先完成「评审信息 → 日程模板 → 生成日程」再导出。</p>');
        return;
      }
      animateReply(['读取当前评审日程', '生成可下载文件'],
        '<p>已生成 <b>' + dlname + '</b>（CSV · UTF-8 带 BOM，可直接用 Excel / WPS 打开）。</p>' +
        '<div class="ag-note info">包含封面信息、评审组成员分工、逐时段日程与倒排任务，字段按 <b>CNAS-PD14-09D0《现场评审日程表》</b> 组织。</div>');
      return;
    }

    /* 迎检工作流：选定一份过程材料（评审报告 / 附表） */
    var matBtn = e.target.closest('[data-ag-mat]');
    if (matBtn) {
      yjPickMat(matBtn.getAttribute('data-ag-mat'));
      return;
    }

    /* 迎检工作流：步骤推进按钮 */
    var ywBtn = e.target.closest('[data-ag-ywf]');
    if (ywBtn) {
      if (busy) return;
      var yact = ywBtn.getAttribute('data-ag-ywf');
      ywf.start = ywf.start || yjDefaultStart();
      if (yact === 'start' || yact === 'back-types') {
        yjGoto(0);
      } else if (yact === 'back-tpl') {
        yjGoto(1);
      } else if (yact === 'sched') {
        if (!ywf.type || !ywf.tpl) return;
        pushUser('日程模板：' + ywf.tpl.name + ' · 起始日 ' + yjFmt(ywf.start));
        setTimeout(function () { yjGoto(2); }, 180);
      } else if (yact === 'mats') {
        var fromDetail = !!ywf.mat;
        ywf.mat = null;
        if (!fromDetail) pushUser('查看过程材料清单');
        setTimeout(function () { yjGoto(3); }, 180);
      }
      return;
    }

    var chip = e.target.closest('[data-ag-chip]');
    if (chip) {
      var t = chip.getAttribute('data-ag-chip');
      input.value = t;
      autoGrow();
      answer(t);
      input.value = '';
      autoGrow();
      return;
    }
  });

  document.getElementById('aw-new').addEventListener('click', function () {
    dropSession('yj');      // 只有「新对话」才真正清空上下文
    yjReset();
    msgs.innerHTML = '';
    cur = 'yj';
    pushIntro();
    toBottom();
  });

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  }
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
  sendBtn.addEventListener('click', doSend);

  function doSend() {
    var t = input.value.trim();
    if (!t || busy) return;
    input.value = '';
    autoGrow();
    answer(t);
  }

  /* ---------- 启动：由挂件宿主在窗口首次打开时驱动 ---------- */
  autoGrow();

  /* 深链：站点任意页面带 ?rt=initial&tpl=std3，挂件自动打开并预置评审信息 */
  var deepRt = (location.search.match(/[?&]rt=([a-z-]+)/) || [])[1];
  var deepTpl = (location.search.match(/[?&]tpl=([a-z0-9]+)/) || [])[1];
  if (deepRt || deepTpl) pendingYj = { rt: deepRt || null, tpl: deepTpl || null };

  window.__AW_CHAT = {
    booted: false,
    open: function () {
      if (this.booted) return;
      this.booted = true;
      enter('yj');
    },
    reset: function () {
      dropSession('yj');
      yjReset();
      msgs.innerHTML = '';
      cur = 'yj';
      pushIntro();
      toBottom();
    }
  };
})();
