/* ============================================================
 * 演示身份层（RBAC 呈现 + 守卫）
 * ------------------------------------------------------------
 * 职责：
 *   1. 顶栏注入「演示身份」切换器（6 角色，跨页持久化）；
 *   2. 页面顶部插入角色横幅（职责 / 权限摘要 / 限制）；
 *   3. 按权限给按钮打锁标（data-action / data-pm 由 ROLES.ACTION_MAP 判定）；
 *   4. capture 阶段拦截越权点击 → 弹出「权限不足」并可一键换身份重试；
 *   5. 侧栏无查看权限的菜单项置灰加锁，点击给提示。
 *
 * 加载顺序：必须在 app.js **之后**（要覆盖其遗留的两角色逻辑）。
 * ============================================================ */
(function () {
  'use strict';
  const R = window.ROLES;
  if (!R) { console.error('[role-guard] 缺少 assets/roles.js'); return; }

  const TONE = ['', '#722ED1', '#1E5BD6', '#0FC6C2', '#2B7FFF', '#F2994A', '#86909C'];

  /* ---------- 兼容 app.js 的遗留两角色变量 ---------- */
  const LABELS = {};
  R.list().forEach(function (r) { LABELS[r.id] = r.name; });
  window.__ROLE_LABELS = LABELS;
  window.__currentRole = R.current();
  window.applyRole = function () { apply(); };
  window.setRole = function (id) { R.setRole(id); apply(); };

  /* ---------- 小工具 ---------- */
  function el(tag, cls, html) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function ensureStyle() {
    if (document.getElementById('rbac-inline-style')) return;
    const s = el('style', null, '');
    s.id = 'rbac-inline-style';
    s.textContent = [
      /* 顶栏演示身份切换器 */
      '.demo-switch{position:relative;display:inline-block;vertical-align:middle;}',
      '.demo-switch-btn{display:flex;align-items:center;gap:7px;height:34px;padding:0 10px 0 5px;border:1px solid var(--border);border-radius:18px;background:var(--bg-white, #fff);cursor:pointer;transition:.16s;font-family:inherit;}',
      '.demo-switch-btn:hover{border-color:var(--primary);box-shadow:0 2px 10px rgba(30,91,214,.14);}',
      '.demo-avatar{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;flex:none;}',
      '.demo-meta{display:flex;flex-direction:column;line-height:1.15;text-align:left;}',
      '.demo-role-name{font-size:12.5px;color:var(--text-primary,#1D2129);font-weight:600;}',
      '.demo-role-sub{font-size:10px;color:var(--text-tertiary,#86909C);}',
      '.demo-caret{font-size:10px;color:var(--text-tertiary,#86909C);transition:transform .18s;}',
      '.demo-switch.open .demo-caret{transform:rotate(180deg);}',
      '.demo-menu{position:absolute;top:40px;right:0;width:392px;background:var(--bg-white,#fff);border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.14);z-index:3100;overflow:hidden;}',
      '.demo-menu-title{padding:11px 14px 8px;font-size:12px;color:var(--text-tertiary,#86909C);border-bottom:1px solid var(--border-light,#F2F3F5);background:var(--bg-gray,#F7F8FA);}',
      '.demo-menu-list{max-height:376px;overflow:auto;}',
      '.demo-mi{display:flex;gap:9px;padding:9px 13px;cursor:pointer;border-bottom:1px solid var(--border-light,#F2F3F5);transition:background .14s;}',
      '.demo-mi:hover{background:var(--bg-hover,#F7F8FA);}',
      '.demo-mi.active{background:rgba(43,127,255,.07);box-shadow:inset 3px 0 0 var(--primary,#2B7FFF);}',
      '.demo-mi-body{flex:1;min-width:0;}',
      '.demo-mi-top{display:flex;align-items:center;gap:7px;}',
      '.demo-mi-name{font-size:13px;font-weight:600;color:var(--text-primary,#1D2129);}',
      '.demo-mi-lv{font-size:10px;color:#fff;border-radius:8px;padding:1px 6px;}',
      '.demo-mi-duty{font-size:11.5px;color:var(--text-secondary,#4E5969);margin:3px 0 4px;line-height:1.45;}',
      '.demo-mi-perm{font-size:11px;color:var(--text-tertiary,#86909C);}',
      '.demo-mi-check{width:16px;flex:none;text-align:center;color:var(--primary,#2B7FFF);font-size:13px;}',
      '.demo-menu-foot{padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--bg-gray,#F7F8FA);border-top:1px solid var(--border-light,#F2F3F5);}',
      '.demo-menu-foot span{font-size:11px;color:var(--text-tertiary,#86909C);}',
      /* 权限不足 */
      '.perm-denied{position:relative;opacity:.52;cursor:not-allowed!important;}',
      '.perm-denied::after{content:"🔒";font-size:10px;margin-left:4px;opacity:.85;}',
      '.sidebar-item.nav-denied{opacity:.42;cursor:not-allowed;}',
      '.sidebar-item.nav-denied::after{content:"🔒";float:right;font-size:10px;opacity:.8;}',
      '.deny-roles{display:flex;flex-direction:column;gap:8px;margin-top:10px;}',
      '.deny-roles .btn{width:100%;text-align:left;}',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- 顶栏切换器 ---------- */
  function buildSwitcher() {
    const bar = document.querySelector('.topbar-right');
    if (!bar || document.getElementById('demo-switch')) return;
    ensureStyle();
    const wrap = el('div', 'demo-switch');
    wrap.id = 'demo-switch';
    bar.insertBefore(wrap, bar.firstChild);
    wrap.innerHTML =
      '<button class="demo-switch-btn" id="demo-switch-btn" type="button">' +
      '<span class="demo-avatar" id="demo-av"></span>' +
      '<span class="demo-meta"><span class="demo-role-name" id="demo-name"></span>' +
      '<span class="demo-role-sub">演示身份 · 点击切换</span></span>' +
      '<span class="demo-caret">▾</span></button>' +
      '<div class="demo-menu" id="demo-menu" style="display:none;">' +
      '<div class="demo-menu-title">切换演示身份 —— 不同身份看到的菜单、按钮与数据范围不同（RBAC）</div>' +
      '<div class="demo-menu-list" id="demo-menu-list"></div>' +
      '<div class="demo-menu-foot"><span id="demo-menu-foot-txt"></span>' +
      '<button class="btn btn-sm" id="demo-reset" type="button">恢复默认权限</button></div></div>';
    wrap.querySelector('#demo-switch-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
      wrap.querySelector('#demo-menu').style.display = wrap.classList.contains('open') ? '' : 'none';
    });
    document.addEventListener('click', function (e) {
      if (wrap.contains(e.target)) return;
      wrap.classList.remove('open');
      wrap.querySelector('#demo-menu').style.display = 'none';
    });
    wrap.querySelector('#demo-reset').addEventListener('click', function (e) {
      e.stopPropagation();
      R.reset();
      R.addAudit({ actor: '系统', kind: '重置', detail: '恢复各角色默认权限基线' });
      apply();
      if (window.showToast) showToast('已恢复 6 个角色的默认权限基线', 'success');
    });
    renderMenu();
  }

  function renderMenu() {
    const list = document.getElementById('demo-menu-list');
    if (!list) return;
    const cur = R.current();
    list.innerHTML = R.list().map(function (r) {
      const s = R.stats(r.id);
      return '<div class="demo-mi' + (r.id === cur ? ' active' : '') + '" data-mi="' + r.id + '">' +
        '<span class="demo-avatar" style="background:' + (TONE[r.tone] || '#2B7FFF') + '">' + r.short + '</span>' +
        '<span class="demo-mi-body">' +
        '<span class="demo-mi-top"><span class="demo-mi-name">' + r.name + '</span>' +
        '<span class="demo-mi-lv" style="background:' + (TONE[r.tone] || '#2B7FFF') + '">' + r.level + '</span></span>' +
        '<div class="demo-mi-duty">' + r.tagline + '</div>' +
        '<div class="demo-mi-perm">可见模块 ' + s.visible + '/' + R.MODULES.length + ' · 权限点 ' + s.points + '/' + s.total +
        (s.app ? ' · 可审批 ' + s.app + ' 个模块' : ' · 无审批权') +
        (s.del ? ' · 可删除 ' + s.del + ' 个模块' : '') + '</div></span>' +
        '<span class="demo-mi-check">' + (r.id === cur ? '✓' : '') + '</span></div>';
    }).join('');
    list.querySelectorAll('[data-mi]').forEach(function (it) {
      it.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = it.getAttribute('data-mi');
        R.setRole(id);
        document.getElementById('demo-switch').classList.remove('open');
        document.getElementById('demo-menu').style.display = 'none';
        apply();
        if (window.showToast) showToast('已切换演示身份：' + R.byId(id).name + ' · ' + R.byId(id).tagline, 'success');
      });
    });
    const foot = document.getElementById('demo-menu-foot-txt');
    if (foot) foot.textContent = R.isDirty() ? '※ 权限已被修改过，可一键恢复默认' : ('权限点 = ' + R.MODULES.length + ' 个功能模块 × ' + R.OPS.length + ' 类操作');
  }

  /* ---------- 给越权控件打锁标 ---------- */
  function mark() {
    const cur = R.current();
    document.querySelectorAll('[data-action],[data-pm]').forEach(function (n) {
      const a = n.getAttribute('data-action') || n.getAttribute('data-pm');
      const p = R.actionPerm(a);
      // 遗留的 data-requires-role 已由 ACTION_MAP 接管，摘掉避免二次拦截把「主任」也挡掉
      if (n.hasAttribute('data-requires-role')) n.removeAttribute('data-requires-role');
      if (!p) return;
      const ok = R.can(cur, p.module, p.op);
      n.classList.toggle('perm-denied', !ok);
      n.setAttribute('aria-disabled', ok ? 'false' : 'true');
      if (ok) n.removeAttribute('data-perm-tip');
      else n.setAttribute('data-perm-tip', '需要「' + p.modName + ' · ' + p.opName + '」权限');
    });
    // 侧栏：无查看权限的模块入口
    document.querySelectorAll('.sidebar-nav a[href], .sidebar a[href]').forEach(function (a) {
      const href = a.getAttribute('href') || '';
      if (!href || href === '#' || href.indexOf('#') === 0) return;
      const mod = R.pageModule(href);
      if (!mod) return;
      const ok = R.can(cur, mod, 'view');
      a.classList.toggle('nav-denied', !ok);
      a.setAttribute('data-nav-mod', mod);
      if (ok) a.removeAttribute('data-nav-tip');
      else a.setAttribute('data-nav-tip', '当前身份无「' + (R.module(mod) || {}).name + '」查看权限');
    });
  }

  function allows() {
    const cur = R.current();
    let n = 0;
    document.querySelectorAll('[data-action],[data-pm]').forEach(function (x) {
      const a = x.getAttribute('data-action') || x.getAttribute('data-pm');
      const p = R.actionPerm(a);
      if (!p) return;
      if (R.can(cur, p.module, p.op)) n++;
    });
    return n;
  }
  function countDenied() {
    const cur = R.current();
    let n = 0;
    document.querySelectorAll('[data-action],[data-pm]').forEach(function (x) {
      const a = x.getAttribute('data-action') || x.getAttribute('data-pm');
      const p = R.actionPerm(a);
      if (!p) return;
      if (!R.can(cur, p.module, p.op)) n++;
    });
    return n;
  }

  /* ---------- 找出有该权限的最小特权角色（用于「换身份重试」） ---------- */
  function suggestRole(module, op, exclude) {
    const order = ['guest', 'operator', 'quality_admin', 'quality_head', 'executive', 'director'];
    for (let i = 0; i < order.length; i++) {
      if (order[i] === exclude) continue;
      if (R.can(order[i], module, op)) return order[i];
    }
    return null;
  }

  /* ---------- 越权拦截（capture 阶段，先于 app.js 的冒泡委派） ---------- */
  function denyFeedback(p, node) {
    const cur = R.current(), me = R.byId(cur);
    const target = suggestRole(p.module, p.op, cur);
    const desc =
      '<div class="desc-list" style="display:grid;grid-template-columns:auto 1fr;gap:8px 14px;margin:6px 0 2px;">' +
      '<div style="font-size:12px;color:var(--text-tertiary);">当前身份</div><div style="font-size:13px;">' + me.name + '（' + me.level + '）</div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);">被拦截操作</div><div style="font-size:13px;"><strong>' + p.label + '</strong></div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);">所需权限</div><div style="font-size:13px;">' + p.modName + ' · ' + p.opName + '</div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);">制度依据</div><div style="font-size:13px;">《授权管理程序》· 最小必要原则，' + me.limits[0].replace(/\*\*/g, '') + '</div>' +
      '</div>' +
      (target ? '<div class="alert alert-warning" style="margin-top:10px;">可切换到 <strong>' + R.byId(target).name + '</strong> 后重试该操作。</div>' : '');
    if (window.showConfirm) {
      window.showConfirm({
        title: '🔒 权限不足',
        desc: desc,
        okLabel: target ? ('切换为 ' + R.byId(target).name + ' 并重试') : '知道了',
        cancelLabel: '留在本页',
        onOk: function () {
          if (!target) return;
          R.setRole(target);
          apply();
          if (window.showToast) showToast('已切换为 ' + R.byId(target).name + '，正在重试刚才的操作…', 'success');
          setTimeout(function () { if (node && node.isConnected) node.click(); else if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, 120);
        }
      });
    } else if (window.showToast) {
      showToast('该操作需要「' + p.modName + ' · ' + p.opName + '」权限', 'error');
    }
  }

  document.addEventListener('click', function (e) {
    const node = e.target.closest('[data-action],[data-pm]');
    if (node) {
      const a = node.getAttribute('data-action') || node.getAttribute('data-pm');
      const p = R.actionPerm(a);
      if (p && !R.can(R.current(), p.module, p.op)) {
        e.preventDefault(); e.stopPropagation();
        denyFeedback(p, node);
        return;
      }
    }
    const link = e.target.closest('a[data-nav-tip]');
    if (link) {
      e.preventDefault(); e.stopPropagation();
      if (window.showToast) showToast(link.getAttribute('data-nav-tip'), 'error');
      setTimeout(openRoleDetail, 60);
    }
  }, true);

  /* ---------- 权限详情弹窗（注册进 MODALS，全站可用） ---------- */
  function matrixHtml(roleId) {
    return R.MODULES.map(function (m) {
      const g = R.grants(roleId, m.id);
      return '<tr><td><strong style="font-size:12.5px;">' + m.name + '</strong>' +
        '<div style="font-size:11px;color:var(--text-tertiary);">' + m.desc + '</div></td>' +
        R.OPS.map(function (o) {
          const on = g.indexOf(o.id) >= 0;
          return '<td style="text-align:center;font-size:12px;">' + (on
            ? '<span style="color:#00B42A;">✓</span>'
            : '<span style="color:#C9CDD4;">—</span>') + '</td>';
        }).join('') + '</tr>';
    }).join('');
  }
  function openRoleDetail(roleId) {
    const cur = roleId || R.current();
    const r = R.byId(cur), s = R.stats(cur);
    const showModal = window.showConfirm;
    const body =
      '<div class="modal-section"><div class="modal-section-title">角色画像</div>' +
      '<div class="desc-list">' +
      '<div class="desc-item full"><div class="desc-label">职责</div><div class="desc-value">' + r.duty + '</div></div>' +
      '<div class="desc-item full"><div class="desc-label">典型使用场景</div><div class="desc-value">' + r.scenario + '</div></div>' +
      '<div class="desc-item full"><div class="desc-label">数据可见范围</div><div class="desc-value">' + r.dataScope + '</div></div>' +
      '</div></div>' +
      '<div class="modal-section"><div class="modal-section-title">权限矩阵（' + s.points + '/' + s.total + ' 个权限点）</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th style="width:150px;">功能模块</th>' +
      R.OPS.map(function (o) { return '<th style="text-align:center;">' + o.name + '</th>'; }).join('') +
      '</tr></thead><tbody>' + matrixHtml(cur) + '</tbody></table></div></div>' +
      '<div class="modal-section"><div class="modal-section-title">权限边界（不可越过的限制）</div>' +
      '<div class="alert alert-warning">' + r.limits.map(function (l) { return '· ' + l.replace(/\*\*/g, ''); }).join('<br/>') + '</div></div>';
    if (showModal) {
      window.showConfirm({
        title: r.name + ' · 权限详情',
        desc: body,
        okLabel: '切换为该身份',
        cancelLabel: '关闭',
        onOk: function () { R.setRole(cur); apply(); if (window.showToast) showToast('已切换演示身份：' + r.name, 'success'); }
      });
    }
  }
  window.openRoleDetail = openRoleDetail;

  /* ---------- 统一的重放 ---------- */
  function apply() {
    const cur = R.current(), r = R.byId(cur);
    window.__currentRole = cur;
    renderMenu();
    mark();
    const av = document.getElementById('demo-av'), nm = document.getElementById('demo-name');
    if (av) { av.textContent = r.short; av.style.background = TONE[r.tone] || '#2B7FFF'; }
    if (nm) nm.textContent = r.name;
    // 顶栏原有 user-chip 同步（每页写死的「质量管理员」）
    const chip = document.querySelector('.topbar-right .user-chip span:not([data-page-node-id])') ||
      document.querySelector('.topbar-right .user-chip span');
    if (chip) chip.textContent = r.name;
    const cav = document.querySelector('.topbar-right .user-chip .user-avatar');
    if (cav) { cav.textContent = r.short; cav.style.background = TONE[r.tone] || '#2B7FFF'; }
  }

  function boot() {
    ensureStyle();
    buildSwitcher();
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('rolechange', apply);
  // 动态插入的内容（异步渲染的表格、弹窗里的按钮）也要受控。
  // 必须去抖：mark() 会改 class/属性，若不节流，在含大量节点的页面会形成高频回调风暴。
  if (window.MutationObserver) {
    let pending = false;
    const mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; mark(); }, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('beforeunload', function () { mo.disconnect(); });
  }
})();
