/* ==========================================================================
   材料智能归档 — 页面数据层
   --------------------------------------------------------------------------
   改造前这一页是写死的静态表格：128 这个数字是硬编码的、左侧分类点了不过滤、
   搜索框不生效、没有分页与批量操作，表格列还被浏览器压成三四行。
   现在整页由 assets/evidence-store.js 驱动，并与「条款自评」页共用同一份材料数据。

   职责：
     · KPI / 左侧要素分类与归核状态 / 表格 / 分页 / 批量操作 全部由数据渲染
     · 筛选：要素分类（左侧）、标准库、格式、时间范围、关键词、排序
     · 上传：点击走统一上传弹窗；拖拽走快捷入库（自动识别分类与归属条款）
     · 导出清单：确认后真实产出 TSV 文件
   ========================================================================== */
(function () {
  'use strict';

  var EV = window.EVIDENCE;
  if (!EV) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dateStr(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function daysAgo(n) { return dateStr(new Date(Date.now() - n * 86400000)); }
  function fmtSize(b) { return EV.fmtSize(b); }
  function imgExt(e) { return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].indexOf(String(e).toLowerCase()) >= 0; }

  var state = {
    cat: 'all', status: 'all', lib: 'all', ext: 'all', range: 'all',
    kw: '', page: 1, per: 10, sort: 'time',
    sel: {}, deepSearch: false
  };

  var COLS = 6;                 /* 表格列数，空状态要 colspan */

  /* ======================================================================
     筛选
     ====================================================================== */
  function inRange(m) {
    if (state.range === 'all') return true;
    var d = m.time.slice(0, 10);
    if (state.range === 'week') return d >= EV.WEEK_FROM;
    if (state.range === 'month') return d >= daysAgo(30);
    if (state.range === 'quarter') return d >= daysAgo(90);
    return true;
  }

  function matches(m, kw) {
    if (!kw) return true;
    if (m.name.toLowerCase().indexOf(kw) >= 0) return true;
    if (m.uploader && m.uploader.indexOf(kw) >= 0) return true;
    if (m.status.indexOf(kw) >= 0) return true;
    if ((m.keywords || []).some(function (k) { return String(k).toLowerCase().indexOf(kw) >= 0; })) return true;
    /* 深度检索（全文检索入口）连带搜条款号、条款名、材料编号 */
    if (state.deepSearch) {
      if (String(m.id).toLowerCase().indexOf(kw) >= 0) return true;
      if ((m.clauses || []).some(function (c) {
        return (c.id + ' ' + c.name).toLowerCase().indexOf(kw) >= 0;
      })) return true;
      if (String(m.note || '').toLowerCase().indexOf(kw) >= 0) return true;
    }
    return false;
  }

  function filtered() {
    var kw = state.kw.trim().toLowerCase();
    var list = EV.getAll().filter(function (m) {
      if (state.cat !== 'all' && m.cat !== state.cat) return false;
      if (state.status !== 'all' && m.status !== state.status) return false;
      if (state.lib !== 'all' && !(m.clauses || []).some(function (c) { return c.lib === state.lib; })) return false;
      if (state.ext !== 'all') {
        if (state.ext === 'img') { if (!imgExt(m.ext)) return false; }
        else if (m.ext !== state.ext) return false;
      }
      if (!inRange(m)) return false;
      return matches(m, kw);
    });

    list.sort(function (a, b) {
      if (state.sort === 'name') return a.name.localeCompare(b.name, 'zh');
      if (state.sort === 'matched') return b.matched - a.matched;
      if (state.sort === 'pending') {
        var pa = a.status === '已归档' ? 1 : 0, pb = b.status === '已归档' ? 1 : 0;
        if (pa !== pb) return pa - pb;
      }
      return b.time.localeCompare(a.time);
    });
    return list;
  }

  /* ======================================================================
     渲染：概览
     ====================================================================== */
  function renderKpi() {
    var s = EV.stats();
    var sc = s.statusCounts;
    var weekItems = EV.getAll().filter(function (m) { return m.time.slice(0, 10) >= EV.WEEK_FROM; });
    var weekAuto = weekItems.filter(function (m) { return m.status !== '待归类'; }).length;
    var covPct = s.clauseTotal ? Math.round(s.clauseCovered / s.clauseTotal * 100) : 0;

    $('arc-kpi').innerHTML =
      tile('📁', '归档总数', s.total, '', '累计归档材料（含本周新增）', 'var(--primary)', 'var(--primary-light)') +
      tile('📄', '本周新增', s.week, '', '已自动归类 ' + weekAuto + ' 份', 'var(--success)', 'var(--success-bg)') +
      tile('⏳', '待处理', s.pending, '', '待归类 ' + (sc['待归类'] || 0) + ' · 待复核 ' + (sc['待复核'] || 0), 'var(--warning)', 'var(--warning-bg)') +
      tile('🏷', '关联条款', s.clauseCovered, '条', 'ISO 覆盖率 ' + covPct + '%', 'var(--primary)', 'var(--primary-light)');

    $('arc-desc').textContent = '按 CNAS-CL10 / ISO 20387 要素自动分类归档迎检材料，共 ' + s.total +
      ' 份材料、覆盖 ' + s.clauseCovered + ' 条 ISO 条款，支持 OCR 识别与条款智能匹配';
  }

  function tile(icon, label, value, unit, meta, color, bg) {
    return '<div class="stat stat-tile">' +
      '<div class="stat-ico" style="background:' + bg + '; color:' + color + ';">' + icon + '</div>' +
      '<div><div class="stat-label">' + label + '</div>' +
      '<div class="stat-value" style="color:' + color + ';">' + value +
      (unit ? '<span class="stat-unit">' + unit + '</span>' : '') + '</div>' +
      '<div class="stat-meta">' + meta + '</div></div></div>';
  }

  /* ======================================================================
     渲染：左侧分类 / 状态
     ====================================================================== */
  function renderCats() {
    var cc = EV.catCounts();
    var total = EV.getAll().length;
    var html = nav('all', '📁', '全部材料', total, null);

    EV.CATS.forEach(function (c) {
      html += nav(c.k, c.icon, c.label, cc[c.k] || 0, null);
    });

    html += '<div class="arc-sep"></div><div class="arc-cap">归核状态</div>';
    var sc = EV.statusCounts();
    EV.STATUSES.forEach(function (s) {
      var meta = EV.ST[s];
      html += nav(s, null, s, sc[s] || 0, 'status', meta.tag);
    });
    /* 未归类既不是分类也不是状态筛选，用「待归类」状态覆盖即可 */
    $('arc-cats').innerHTML = html;

    /* 标题上的计数 */
    var f = filtered();
    $('arc-list-title').innerHTML = '材料列表 <span class="tag tag-primary" style="margin-left:6px;">' +
      scopeLabel() + ' · ' + f.length + '</span>';
  }

  function scopeLabel() {
    if (state.cat !== 'all') return (EV.CAT_BY[state.cat] || {}).label || '全部';
    if (state.status !== 'all') return state.status;
    return '全部';
  }

  function nav(key, icon, label, count, kind, tagCls) {
    var on = kind === 'status' ? (state.status === key) : (state.cat === key && state.status === 'all');
    var dot = tagCls ? '<span class="dot" style="background:var(--' +
      (tagCls === 'tag-success' ? 'success' : tagCls === 'tag-error' ? 'error' : 'warning') + ');"></span>' : '';
    return '<div class="arc-nav' + (on ? ' on' : '') + '" data-arc-cat="' + (kind === 'status' ? '' : key) +
      '" data-arc-status="' + (kind === 'status' ? key : '') + '">' +
      dot + (icon ? '<span>' + icon + '</span>' : '') + '<span>' + esc(label) + '</span>' +
      '<span class="cnt">' + count + '</span></div>';
  }

  /* ======================================================================
     渲染：表格
     ====================================================================== */
  function clauseCell(m) {
    var tags = (m.clauses || []).map(function (c) {
      return '<span class="tag tag-primary" title="' + esc(c.label) + '">' + esc(c.id) + ' ' + esc(c.name) + '</span>';
    }).join('') || '<span class="tag tag-default">未归类</span>';
    var cat = EV.CAT_BY[m.cat];
    return '<div class="arc-clause">' + tags + '</div>' +
      '<div class="arc-sub" title="' + esc((cat ? cat.label : m.cat) + ' · 识别匹配度 ' + m.matched + '%') + '">' +
      (cat ? cat.icon + ' ' + esc(cat.label) : '') + ' · 匹配度 ' + m.matched + '%</div>';
  }

  function renderTable() {
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / state.per));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.per;
    var rows = list.slice(start, start + state.per);

    if (!rows.length) {
      $('arc-tbody').innerHTML = '<tr><td colspan="' + COLS + '" style="text-align:center; padding:34px 0; color:var(--text-tertiary); font-size:12.5px;">' +
        '没有符合条件的材料　·　<a href="#" data-action="arc-reset" style="color:var(--primary);">清空筛选条件</a></td></tr>';
      $('arc-pager').innerHTML = '<span>共 0 条</span>';
      return;
    }

    $('arc-tbody').innerHTML = rows.map(function (m) {
      var st = EV.ST[m.status] || EV.ST['已归档'];
      var on = !!state.sel[m.id];
      return '<tr' + (on ? ' style="background:var(--primary-lighter);"' : '') + '>' +
        '<td><div class="checkbox' + (on ? ' checked' : '') + '" data-arc-check="' + esc(m.id) + '"></div></td>' +
        '<td><div class="arc-file"><div class="ic">' + EV.iconOf(m) + '</div><div class="meta">' +
          '<div class="nm" title="' + esc(m.name) + '">' + esc(m.name) + '</div>' +
          '<div class="sub" title="' + esc(fmtSize(m.size) + ' · ' + m.version + ' · ' + m.uploader + ' · ' + m.time) + '">' +
            fmtSize(m.size) + ' · ' + esc(m.version) + ' · ' + esc(m.uploader) + '</div>' +
        '</div></div></td>' +
        '<td>' + clauseCell(m) + '</td>' +
        '<td><div class="ell" title="' + esc(m.time) + '">' + esc(m.time) + '</div></td>' +
        '<td><span class="tag ' + st.tag + '" title="' + esc(st.desc) + '">' + esc(m.status) + '</span></td>' +
        '<td class="col-actions">' +
          '<button class="btn-text" data-action="evidence-detail" data-id="' + esc(m.id) + '">详情</button> · ' +
          (m.status === '待归类'
            ? '<button class="btn-text" data-action="evidence-classify" data-id="' + esc(m.id) + '">归类</button>'
            : '<button class="btn-text" data-action="evidence-preview" data-id="' + esc(m.id) + '">预览</button>') +
        '</td></tr>';
    }).join('');

    var s = EV.stats();
    $('arc-list-title').innerHTML = '材料列表 <span class="tag tag-primary" style="margin-left:6px;">' +
      scopeLabel() + ' · ' + list.length + ' / ' + s.total + '</span>';

    renderPager(list.length, pages);
  }

  function renderPager(total, pages) {
    var b = [];
    b.push('<span>共 ' + total + ' 条</span>');
    b.push('<button class="btn btn-sm" data-arc-page="prev"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>');
    var from = Math.max(1, state.page - 2), to = Math.min(pages, from + 4);
    from = Math.max(1, to - 4);
    if (from > 1) {
      b.push('<button class="btn btn-sm" data-arc-page="1">1</button>');
      if (from > 2) b.push('<span style="padding:0 4px; color:var(--text-tertiary);">…</span>');
    }
    for (var i = from; i <= to; i++) {
      b.push('<button class="btn btn-sm' + (i === state.page ? ' active' : '') + '" data-arc-page="' + i + '">' + i + '</button>');
    }
    if (to < pages) {
      if (to < pages - 1) b.push('<span style="padding:0 4px; color:var(--text-tertiary);">…</span>');
      b.push('<button class="btn btn-sm" data-arc-page="' + pages + '">' + pages + '</button>');
    }
    b.push('<button class="btn btn-sm" data-arc-page="next"' + (state.page === pages ? ' disabled' : '') + '>›</button>');
    b.push('<select class="select" id="arc-per" style="width:88px;">' +
      [10, 20, 50].map(function (p) { return '<option value="' + p + '"' + (state.per === p ? ' selected' : '') + '>' + p + '条/页</option>'; }).join('') +
      '</select>');
    $('arc-pager').innerHTML = b.join('');
  }

  /* ======================================================================
     渲染：批量操作条
     ====================================================================== */
  function selIds() { return Object.keys(state.sel).filter(function (k) { return state.sel[k]; }); }

  function renderBulk() {
    var n = selIds().length;
    var bar = $('arc-bulk');
    bar.classList.toggle('on', n > 0);
    $('arc-bulk-n').textContent = n;
    /* 全选框状态跟随「本页是否全选」 */
    var boxes = Array.prototype.slice.call(document.querySelectorAll('#arc-tbody [data-arc-check]'));
    var all = boxes.length > 0 && boxes.every(function (b) { return state.sel[b.getAttribute('data-arc-check')]; });
    var ca = $('arc-check-all');
    ca.classList.toggle('checked', all);
  }

  function renderAll() {
    renderKpi();
    renderCats();
    renderTable();
    renderBulk();
  }

  /* ======================================================================
     导出：确认为前置，确认后真实产出 TSV（前端 Blob，无后端依赖）
     ====================================================================== */
  function downloadTSV(rows, filename) {
    var head = ['材料编号', '文件名', '要素分类', '归属条款', '版本', '大小', '上传人', '上传时间', '状态', '核验', '识别匹配度'];
    var lines = [head.join('\t')];
    rows.forEach(function (m) {
      var cat = EV.CAT_BY[m.cat];
      lines.push([
        m.id, m.name, cat ? cat.label : m.cat,
        (m.clauses || []).map(function (c) { return c.label; }).join(' / ') || '未归类',
        m.version, fmtSize(m.size), m.uploader, m.time, m.status, m.verify, m.matched + '%'
      ].join('\t'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function stamp() {
    var d = new Date();
    return '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes());
  }

  function ask(opts) {
    if (window.showConfirm) return window.showConfirm(opts);
    if (window.confirm(opts.title + '\n' + (opts.desc || ''))) opts.onOk && opts.onOk();
  }

  /* ======================================================================
     拖拽快捷入库
     ====================================================================== */
  function addDropped(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var added = [];
    list.forEach(function (f) {
      var g = EV.guess(f.name);
      var m = EV.add({
        name: f.name, size: f.size, ext: EV.extOf(f.name),
        cat: g.cat, matched: g.matched, clauses: g.clauses,
        status: g.status, uploader: '质量管理员',
        note: g.clause ? '拖拽上传，自动识别归入「' + g.clause.name + '」' : '拖拽上传，未匹配到条款，待人工归类'
      });
      added.push(m);
    });
    var pending = added.filter(function (m) { return m.status === '待归类'; }).length;
    if (window.showToast) {
      showToast('已入库 ' + added.length + ' 份材料' + (pending ? '，其中 ' + pending + ' 份待人工归类' : '，均已进入待复核'),
        pending ? 'info' : 'success');
    }
    state.page = 1;
    state.cat = 'all'; state.status = 'all';
    renderAll();
  }

  function bindDrop() {
    var dz = $('arc-drop');
    if (!dz) return;
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dz.classList.add('hot');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dz.classList.remove('hot');
      });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addDropped(e.dataTransfer.files);
    });
  }

  /* ======================================================================
     页面内动作（注册进 app.js 的 INLINE 表）
     ====================================================================== */
  if (typeof INLINE !== 'undefined') {
    INLINE['arc-search-focus'] = function () {
      var inp = $('arc-search');
      state.deepSearch = true;
      state.range = 'all';
      $('arc-range').value = 'all';
      renderAll();
      inp.focus();
      inp.select();
      if (window.showToast) showToast('已开启全文检索：可搜文件名、条款号与条款名、材料编号、备注说明', 'info');
    };

    INLINE['arc-reset'] = function () {
      state.cat = 'all'; state.status = 'all'; state.lib = 'all'; state.ext = 'all';
      state.range = 'all'; state.kw = ''; state.page = 1; state.deepSearch = false;
      $('arc-search').value = '';
      $('arc-lib').value = 'all';
      $('arc-ext').value = 'all';
      $('arc-range').value = 'all';
      renderAll();
      if (window.showToast) showToast('已清空筛选条件', 'info');
    };

    INLINE['arc-export'] = function () {
      var picked = selIds();
      var rows = picked.length ? EV.getAll().filter(function (m) { return picked.indexOf(m.id) >= 0; }) : filtered();
      if (!rows.length) { if (window.showToast) showToast('当前没有可导出的材料', 'info'); return; }
      ask({
        title: '导出材料清单',
        desc: (picked.length ? '将导出已选中的 ' + rows.length + ' 份材料。' : '未选择材料，将导出当前筛选结果的 ' + rows.length + ' 份材料。') +
          '导出格式为 TSV（可用 Excel 直接打开），不含文件正文。',
        okLabel: '导出 TSV',
        onOk: function () {
          downloadTSV(rows, '迎检材料清单-' + stamp() + '.tsv');
          if (window.showToast) showToast('已导出 ' + rows.length + ' 份材料的清单', 'success');
        }
      });
    };

    INLINE['arc-bulk-verify'] = function () {
      var ids = selIds();
      if (!ids.length) return;
      ask({
        title: '批量核验归档',
        desc: '将把选中的 ' + ids.length + ' 份材料标记为「已归档 / 已核验」，并写入操作记录。',
        okLabel: '确认核验',
        onOk: function () {
          ids.forEach(function (id) {
            EV.patch(id, { status: '已归档' });
            EV.addLog(id, { who: '质量管理员', act: '批量核验通过', note: '批量操作：核验通过并归档' });
          });
          state.sel = {};
          renderAll();
          if (window.showToast) showToast('已核验归档 ' + ids.length + ' 份材料', 'success');
        }
      });
    };

    INLINE['arc-bulk-classify'] = function () {
      var ids = selIds();
      if (!ids.length) return;
      openModal('evidence-classify', { bulk: String(ids.length), ids: ids.join(',') });
    };

    INLINE['arc-bulk-remove'] = function () {
      var ids = selIds();
      if (!ids.length) return;
      ask({
        title: '移出归档',
        desc: '将从材料库中移除选中的 ' + ids.length + ' 份材料（演示环境可恢复：清空浏览器本地数据即可还原种子数据）。',
        okLabel: '确认移出',
        danger: true,
        onOk: function () {
          ids.forEach(function (id) { EV.remove(id); });
          state.sel = {};
          renderAll();
          if (window.showToast) showToast('已移出 ' + ids.length + ' 份材料', 'info');
        }
      });
    };

    INLINE['arc-bulk-clear'] = function () {
      state.sel = {};
      renderAll();
    };
  }

  /* 表头全选。
     必须直接绑在元素上：app.js 在加载时给所有 .checkbox 绑了
     「toggle + stopPropagation」，而 #arc-check-all 是静态节点会被绑上，
     冒泡被掐断后 document 上的委托收不到这个点击（2026-09-23 踩过）。
     这里只切状态与行选中，.checked 视觉交给 app.js 那支处理器。 */
  function toggleAll() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll('#arc-tbody [data-arc-check]'));
    if (!boxes.length) return;
    var allOn = boxes.every(function (b) { return state.sel[b.getAttribute('data-arc-check')]; });
    boxes.forEach(function (b) {
      var id = b.getAttribute('data-arc-check');
      if (allOn) delete state.sel[id]; else state.sel[id] = 1;
      b.classList.toggle('checked', !allOn);
      var tr = b.closest('tr');
      if (tr) tr.style.background = allOn ? '' : 'var(--primary-lighter)';
    });
    renderBulk();
  }

  function bindCheckAll() {
    var ca = $('arc-check-all');
    if (ca) ca.addEventListener('click', function () { setTimeout(toggleAll, 0); });
  }

  /* ======================================================================
     事件
     ====================================================================== */
  document.addEventListener('click', function (e) {
    var ck = e.target.closest('[data-arc-check]');
    if (ck) {
      e.preventDefault();
      var id = ck.getAttribute('data-arc-check');
      if (state.sel[id]) delete state.sel[id]; else state.sel[id] = 1;
      ck.classList.toggle('checked', !!state.sel[id]);
      var tr = ck.closest('tr');
      if (tr) tr.style.background = state.sel[id] ? 'var(--primary-lighter)' : '';
      renderBulk();
      return;
    }

    var nv = e.target.closest('.arc-nav');
    if (nv) {
      state.cat = nv.getAttribute('data-arc-cat') || 'all';
      var st = nv.getAttribute('data-arc-status') || '';
      state.status = st || 'all';
      if (state.cat !== 'all') state.status = 'all';
      state.page = 1;
      renderAll();
      return;
    }

    var pg = e.target.closest('[data-arc-page]');
    if (pg) {
      var v = pg.getAttribute('data-arc-page');
      var pages = Math.max(1, Math.ceil(filtered().length / state.per));
      if (v === 'prev') state.page = Math.max(1, state.page - 1);
      else if (v === 'next') state.page = Math.min(pages, state.page + 1);
      else state.page = parseInt(v, 10) || 1;
      renderTable();
      renderBulk();
      return;
    }

    var reset = e.target.closest('[data-action="arc-reset"]');
    if (reset) { e.preventDefault(); if (typeof INLINE !== 'undefined') INLINE['arc-reset'](); }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'arc-search') {
      state.kw = e.target.value;
      state.page = 1;
      renderAll();
    }
  });

  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'arc-lib') { state.lib = e.target.value; state.page = 1; renderAll(); }
    if (id === 'arc-ext') { state.ext = e.target.value; state.page = 1; renderAll(); }
    if (id === 'arc-range') { state.range = e.target.value; state.page = 1; renderAll(); }
    if (id === 'arc-sort') { state.sort = e.target.value; state.page = 1; renderTable(); }
    if (id === 'arc-per') { state.per = parseInt(e.target.value, 10) || 10; state.page = 1; renderTable(); renderBulk(); }
  });

  /* 材料数据变化（上传 / 核验 / 退回 / 移出）后自动重渲染 */
  EV.on(renderAll);

  bindDrop();
  bindCheckAll();
  renderAll();

  window.__ARC = { state: state, filtered: filtered, renderAll: renderAll, addDropped: addDropped };
})();
