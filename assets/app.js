/* ==========================================================================
   CNAS 迎检模块 — 共享交互 & 弹窗引擎
   用法：任意元素加 data-action="xxx" + data-* 参数即可唤起对应弹窗
   ========================================================================== */

/* ---------- 基础交互 ---------- */

// 侧边栏折叠（二级分组 + 一级模块）
// 折叠态统一加在被折叠区块的父容器上：
//   .sidebar-group-header 的父是 .sidebar-group（二级）
//   .sidebar-level1       的父是 .sidebar-module（一级）
// 2026-09-23 前这里只认 .sidebar-group-header，一级菜单点上去不动。
document.querySelectorAll('.sidebar-group-header, .sidebar-level1').forEach(function (h) {
  h.addEventListener('click', function () {
    const g = h.parentElement;
    if (g) g.classList.toggle('collapsed');
  });
});

// 复选框
document.querySelectorAll('.checkbox').forEach(function (cb) {
  cb.addEventListener('click', function (e) { e.stopPropagation(); cb.classList.toggle('checked'); });
});

// Tab
document.querySelectorAll('.tabs').forEach(function (tabsEl) {
  tabsEl.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabsEl.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      const target = tab.getAttribute('data-target');
      if (target) {
        document.querySelectorAll('[data-pane]').forEach(function (p) {
          p.style.display = (p.getAttribute('data-pane') === target) ? '' : 'none';
        });
      }
    });
  });
});

// 过滤芯片
document.querySelectorAll('.filter-chip').forEach(function (chip) {
  chip.addEventListener('click', function () {
    const g = chip.parentElement;
    g.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
  });
});

// 进度条动画
document.querySelectorAll('.progress-bar[data-w]').forEach(function (bar) {
  const w = bar.getAttribute('data-w');
  setTimeout(function () { bar.style.width = w + '%'; }, 80);
});

// 当前角色（默认 质量管理员；可由顶部胶囊切换）
window.__currentRole = (function () {
  try { return localStorage.getItem('cnas_role') || 'manager'; } catch (e) { return 'manager'; }
})();
window.__ROLE_LABELS = { manager: '质量管理员', staff: '普通员工' };
window.applyRole = function () {
  const role = window.__currentRole;
  const navName = document.getElementById('user-name');
  if (navName) navName.textContent = window.__ROLE_LABELS[role];
  const sw = document.getElementById('role-switch');
  if (sw) sw.querySelectorAll('[data-role]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-role') === role);
  });
  const statPending = document.getElementById('stat-pending');
  const badge = document.getElementById('stat-pend-badge');
  if (statPending) {
    if (role === 'manager') {
      statPending.classList.add('stat-clickable');
      statPending.removeAttribute('data-tip');
    } else {
      statPending.classList.remove('stat-clickable');
      statPending.setAttribute('data-tip', '需要管理员权限才能审批');
    }
    statPending.classList.toggle('stat-locked', role !== 'manager');
  }
  if (badge) badge.style.display = role === 'manager' ? '' : 'none';
};
window.setRole = function (role) {
  window.__currentRole = role;
  try { localStorage.setItem('cnas_role', role); } catch (e) { /* ignore */ }
  window.applyRole();
};
document.addEventListener('click', function (ev) {
  const t = ev.target.closest('[data-role]');
  if (!t) return;
  const rs = document.getElementById('role-switch');
  if (!rs || !rs.contains(t)) return;
  const r = t.getAttribute('data-role');
  if (r && r !== window.__currentRole) {
    window.setRole(r);
    showToast(r === 'manager' ? '已切换至 质量管理员（拥有审批权限）' : '已切换至 普通员工（只读模式）');
  }
});
// 立即执行一次（script 位于 body 末尾，DOM 已就绪），再兜底 DOMContentLoaded
window.applyRole();
document.addEventListener('DOMContentLoaded', function () { window.applyRole(); });

// Toast
window.showToast = function (msg, type) {
  let t = document.getElementById('global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    t.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);padding:9px 18px;border-radius:8px;font-size:13px;z-index:2000;box-shadow:0 6px 24px rgba(0,0,0,.16);transition:opacity .25s,top .25s;pointer-events:none;';
    document.body.appendChild(t);
  }
  const bg = type === 'error' ? '#F53F3F' : (type === 'success' ? '#00B42A' : '#1D2129');
  t.style.background = bg;
  t.style.color = '#fff';
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.top = '24px';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () {
    t.style.opacity = '0'; t.style.top = '12px';
  }, 2000);
};

/* ---------- 弹窗引擎 ---------- */

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tagMap = { '已完成': 'success', '进行中': 'warning', '未开始': 'default', '符合': 'success', '部分符合': 'warning', '不符合': 'error', '已批准': 'success', '待审批': 'warning', '已驳回': 'error' };
const tg = (t) => `<span class="tag tag-${tagMap[t] || 'default'}">${esc(t)}</span>`;

const fCancel = () => `<button class="btn" data-modal-close>取消</button>`;
const fClose = () => `<button class="btn btn-primary" data-modal-close>关闭</button>`;
const fSave = (label) => `<button class="btn" data-modal-close>${label || '取消'}</button><button class="btn btn-primary" data-modal-close data-toast="已保存">保存</button>`;
const fConfirm = (label, msg) => `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="${esc(msg || '操作成功')}">${label || '确定'}</button>`;

const desc = (label, value, full) =>
  `<div class="desc-item${full ? ' full' : ''}"><div class="desc-label">${label}</div><div class="desc-value">${value}</div></div>`;

const inp = (label, ph, val, req) =>
  `<div class="form-item"><label class="form-label">${label}${req ? '<span class="req">*</span>' : ''}</label><input class="form-control" placeholder="${ph || ''}" value="${esc(val || '')}" /></div>`;

// 日期型 input（type=date，需单独函数，因 Chrome 对日期占位符行为不同）
const dateInp = (label, val, req) =>
  `<div class="form-item"><label class="form-label">${label}${req ? '<span class="req">*</span>' : ''}</label><input class="form-control" type="date" value="${esc(val || '')}" /></div>`;

const sel = (label, opts) =>
  `<div class="form-item"><label class="form-label">${label}</label><select class="form-control">${opts.map(o => `<option>${o}</option>`).join('')}</select></div>`;

// 行内紧凑下拉（用于工具栏）
const selInline = (label, opts) =>
  `<div style="display:flex;align-items:center;gap:6px;">` +
  `<span style="font-size:12px;color:var(--text-tertiary);white-space:nowrap;">${label}</span>` +
  `<select class="form-control" style="width:auto;min-width:150px;padding:5px 8px;">` +
  opts.map(o => `<option>${o}</option>`).join('') + `</select></div>`;

const ta = (label, ph, val) =>
  `<div class="form-item"><label class="form-label">${label}</label><textarea class="form-control" placeholder="${ph || ''}">${esc(val || '')}</textarea></div>`;

/* ---------- 版本查看器数据 ---------- */

function getVersionViewData(name, ver, status) {
  // 默认返回 SOP-007 血液样本处理标准操作规程（截图示例）
  const fileMap = {
    '血液样本处理标准操作规程': {
      code: 'SOP-007', category: '技术操作文件', clause: '7.6', owner: '孙伟', icon: '📄',
      versions: [
        {
          ver: 'V4.0', date: '2024-10-01', reviser: '孙伟', approver: '技术负责人陈磊',
          status: '现行有效', tag: '重大修订', obsolete: false,
          changeNote: '增加全血RNA处理步骤，修订离心参数（依据内审NCR-2024-002整改）',
          content: `
            <h4>1 目的</h4><p>规范血液样本（全血、血清、血浆）的处理操作，确保样本质量。</p>
            <h4>2 适用范围</h4><p>适用于本样本库所有血液类样本的处理操作。</p>
            <h4>3 操作人员资质要求</h4><p>持证上岗，完成血液处理培训≥8学时。</p>
            <h4>4 设备与试剂</h4>
            <ul><li>低温离心机（带温控）</li><li>EDTA抗凝管、红头管</li><li>分装管（1.5mL/0.5mL）</li></ul>
            <h4>5 处理流程</h4>
            <p><span class="highlight">5.1 全血</span>：接收后2h内处理，颠倒混匀8次，置4°C保存待处理。</p>
            <p><span class="highlight">5.2 血清</span>：室温静置30min后，1800×g、4°C离心10min，吸取上清。</p>
            <p><span class="highlight">5.3 血浆</span>：1800×g、4°C离心10min，吸取上清至分装管，-80°C保存。</p>
            <h4>6 全血RNA处理（新增）</h4>
            <p><span class="highlight">6.1</span> 采血后30min内处理。</p>
            <p><span class="highlight">6.2</span> 加入RNA保护剂，颠倒混匀，立即置-80°C保存。</p>
            <h4>7 质控要求</h4><p>血清/血浆：观察溶血情况，记录颜色及透明度。</p>`
        },
        {
          ver: 'V3.2', date: '2023-08-20', reviser: '赵丽', approver: '技术负责人陈磊',
          status: '已作废', tag: '纠正修订', obsolete: true, replacedBy: 'V4.0',
          changeNote: '纠正血清分离时间参数错误，更新质控标准',
          content: `
            <h4>1 目的</h4><p>规范血液样本（全血、血清、血浆）的处理操作，确保样本质量。</p>
            <h4>2 操作人员资质要求</h4><p>持证上岗，完成血液处理培训≥8学时。</p>
            <h4>3 设备与试剂</h4>
            <ul><li>低温离心机（带温控）</li><li>EDTA抗凝管、红头管</li></ul>
            <h4>4 处理流程（已修正离心时间参数）</h4>
            <p><span class="highlight">4.1 血清</span>：室温静置30min后，1800×g、4°C离心10min，吸取上清。</p>
            <p><span class="highlight">4.2 血浆</span>：1800×g、4°C离心10min（原v3.1为15min，已纠正），吸取上清至分装管。</p>
            <h4>5 质控要求</h4><p>观察溶血情况，记录颜色及透明度。</p>`
        },
        {
          ver: 'V3.1', date: '2023-05-12', reviser: '赵丽', approver: '技术负责人陈磊',
          status: '历史版本', tag: '', obsolete: false,
          changeNote: '更新质控标准',
          content: `
            <h4>1 目的</h4><p>规范血液样本（全血、血清、血浆）的处理操作，确保样本质量。</p>
            <h4>2 操作人员资质要求</h4><p>持证上岗，完成血液处理培训≥8学时。</p>
            <h4>3 设备与试剂</h4>
            <ul><li>低温离心机（带温控）</li><li>EDTA抗凝管、红头管</li></ul>
            <h4>4 处理流程</h4>
            <p><span class="highlight">4.1 血清</span>：室温静置30min后，1800×g、4°C离心10min，吸取上清。</p>
            <p><span class="highlight">4.2 血浆</span>：1800×g、4°C离心15min，吸取上清至分装管。</p>
            <h4>5 质控要求</h4><p>观察溶血情况，记录颜色及透明度。</p>`
        },
        {
          ver: 'V3.0', date: '2022-11-30', reviser: '张三', approver: '质量负责人王五',
          status: '历史版本', tag: '', obsolete: false,
          changeNote: '体系换版，依据 ISO 20387:2018 全面修订',
          content: `
            <h4>1 目的</h4><p>规范血液样本的处理操作，确保样本质量。</p>
            <h4>2 操作人员资质要求</h4><p>持证上岗，完成血液处理培训≥8学时。</p>
            <h4>3 设备与试剂</h4>
            <ul><li>低温离心机</li><li>EDTA抗凝管</li></ul>
            <h4>4 处理流程</h4>
            <p><span class="highlight">4.1 血清</span>：室温静置30min后离心，吸取上清。</p>
            <p><span class="highlight">4.2 血浆</span>：离心后吸取上清至分装管。</p>
            <h4>5 质控要求</h4><p>观察溶血情况，记录颜色及透明度。</p>`
        }
      ]
    }
  };

  let file = fileMap[name];
  if (!file) {
    // 通用回退：固定 3 个版本（V3.2 / V3.1 / V3.0），若请求的 ver 不在列表内，
    // 替换首槽为该版本（保持去重），避免点击 V3.1 / V3.0 等历史版本时出现重复 Tab
    const safeCode = name ? name.split(' - ')[0] : 'QM-001';
    const isObsolete = /作废/.test(status || '');
    const baseVersions = [
      { ver: 'V3.2', date: '2026-08-20', reviser: '陈主管', approver: '质量负责人王五', status: '现行有效', tag: '', obsolete: false, changeNote: '补充管理评审章节与职责分配表' },
      { ver: 'V3.1', date: '2025-06-11', reviser: '陈主管', approver: '质量负责人王五', status: '历史版本', tag: '', obsolete: false, changeNote: '更新质量方针表述，优化组织架构图' },
      { ver: 'V3.0', date: '2024-03-02', reviser: '张三', approver: '质量负责人王五', status: '历史版本', tag: '', obsolete: false, changeNote: '体系换版，依据 ISO 20387:2018 全面修订' }
    ];
    if (ver && !baseVersions.some(v => v.ver === ver)) {
      // 用请求的版本号替换首槽（标记 obsolete 以便 UI 给出"已作废"提示）
      baseVersions[0] = {
        ver: ver, date: '2026-08-20', reviser: '陈主管', approver: '质量负责人王五',
        status: status || '现行有效', tag: '', obsolete: isObsolete,
        replacedBy: isObsolete ? '最新版本' : '', changeNote: '本版变更说明'
      };
    } else if (ver) {
      // 命中列表：把对应版本的 status / obsolete 同步为当前行口径
      const hit = baseVersions.find(v => v.ver === ver);
      if (hit && status) {
        hit.status = status;
        if (isObsolete) { hit.obsolete = true; hit.replacedBy = hit.replacedBy || '最新版本'; }
      }
    }
    file = {
      code: safeCode, category: '质量管理体系文件', clause: '8.2 管理体系文件', owner: '陈主管', icon: '📄',
      versions: baseVersions.map(v => Object.assign({}, v, { content: genericVersionContent(v.ver) }))
    };
  }

  let activeIndex = file.versions.findIndex(v => v.ver === ver);
  if (activeIndex < 0) activeIndex = 0;
  return { file, activeIndex };
}

function genericVersionContent(ver) {
  return `
    <h4>1 目的</h4><p>明确本文件的管理要求与执行标准，确保质量管理体系有效运行。</p>
    <h4>2 适用范围</h4><p>适用于本样本库相关部门与岗位。</p>
    <h4>3 职责</h4>
    <ul><li>质量负责人：批准与监督执行</li><li>部门主管：组织实施</li><li>执行人员：按文件要求操作并记录</li></ul>
    <h4>4 程序要求</h4>
    <p><span class="highlight">4.1</span> 文件应受控发布，确保使用有效版本。</p>
    <p><span class="highlight">4.2</span> 文件变更需经过评审、批准并通知相关方。</p>
    <p><span class="highlight">4.3</span> 保留文件控制记录，确保可追溯。</p>
    <h4>5 相关记录</h5><p>文件发放回收记录、文件变更申请单、培训记录。</p>`;
}

function buildVersionTabs(name, versions, activeVer) {
  return versions.map(v => {
    const activeCls = v.ver === activeVer ? ' active' : '';
    const obsoleteCls = v.obsolete ? ' obsolete' : '';
    return `<button class="version-tab${activeCls}${obsoleteCls}" data-action="version-view" data-name="${esc(name)}" data-ver="${esc(v.ver)}" data-status="${esc(v.status)}">${esc(v.ver)}</button>`;
  }).join('');
}

/* 版本查看弹窗正文（供首次渲染与切换版本时复用） */
function renderVersionViewer(name, file, idx) {
  const v = file.versions[idx];
  const replacedNote = v.obsolete && v.replacedBy
    ? `<div class="version-viewer-replaced">⚠ 此版本已被 ${esc(v.replacedBy)} 替代</div>` : '';
  const changeTag = v.tag ? `<span class="version-viewer-change-tag">${esc(v.tag)}</span>` : '';
  const statusTag = v.obsolete
    ? `<span class="version-viewer-obsolete-tag">已作废</span>`
    : `<span class="version-viewer-version-tag">${esc(v.status)}</span>`;
  const obsoleteStamp = v.obsolete
    ? `<div class="version-obsolete-stamp">已作废<br><span>请使用 ${esc(v.replacedBy || '新版本')}</span></div>`
    : '';
  return `
    <div class="version-viewer-header">
      <div class="version-viewer-icon">${file.icon}</div>
      <div class="version-viewer-title-wrap">
        <div class="version-viewer-title">
          ${esc(name || '质量手册')}
          ${statusTag}
          ${changeTag}
        </div>
        <div class="version-viewer-sub">修订人：${esc(v.reviser)} · 审批人：${esc(v.approver)} · ${esc(v.date)}</div>
      </div>
    </div>
    ${replacedNote}
    <div class="version-meta-strip">
      <div class="version-meta-item"><div class="version-meta-label">文件编号</div><div class="version-meta-value">${esc(file.code)}</div></div>
      <div class="version-meta-item"><div class="version-meta-label">文件类别</div><div class="version-meta-value">${esc(file.category)}</div></div>
      <div class="version-meta-item"><div class="version-meta-label">相关条款</div><div class="version-meta-value">${esc(file.clause)}</div></div>
      <div class="version-meta-item"><div class="version-meta-label">文件负责人</div><div class="version-meta-value">${esc(file.owner)}</div></div>
    </div>
    <div class="version-change-note">
      <div class="version-change-note-label">本版变更说明</div>
      <div class="version-change-note-text">${esc(v.changeNote)}</div>
    </div>
    <div class="version-doc-title">
      <div class="version-doc-code">${esc(file.code)}</div>
      <h3>${esc(name || '质量手册')}</h3>
      <div class="version-doc-meta">
        <span>版本：${esc(v.ver)}</span>
        <span>日期：${esc(v.date)}</span>
        <span>状态：${esc(v.status)}</span>
      </div>
    </div>
    <div class="version-doc-content">
      ${v.content}
      ${obsoleteStamp}
    </div>`;
}

/* ---------- 弹窗模板库 ---------- */

const MODALS = {

  /* ===== 纯提示类（不弹窗，仅 toast） ===== */
  'toast': (c) => ({ toastOnly: true, toastMsg: c.msg || '操作已执行' }),

  /* ===== 条款详情 ===== */
  'clause-detail': (c) => ({
    title: `${c.code || '4.1'} ${c.name || '公正性'}`,
    subtitle: 'ISO 20387 条款 · 评审要点与自评情况',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">条款信息</div>
        <div class="desc-list">
          ${desc('条款编号', esc(c.code || '4.1'))}
          ${desc('所属分类', esc(c.cat || '管理要求'))}
          ${desc('当前状态', tg(c.status || '已完成'))}
          ${desc('自评结果', tg(c.result || '符合'))}
          ${desc('负责人', esc(c.owner || '张三'))}
          ${desc('自评人', esc(c.assessor || '李四'))}
          ${desc('截止日期', esc(c.due || '2026-11-30'))}
          ${desc('关联材料', `${c.files || 3} 份`)}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">条款原文</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text-secondary);background:var(--bg-page);padding:12px 14px;border-radius:6px;">
          生物样本库应${c.name === '保密性' ? '通过具有法律效力的承诺，对在活动中获得或产生的所有信息承担管理责任，未经客户同意不得公开（法定要求除外）。' : '持续识别影响公正性的风险来源，包括其活动、关系或人员关系带来的压力，并采取措施消除或最大限度降低该风险。'}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">评审要点</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">要点 1</div><div class="tl-title">制度文件完备性</div><div class="tl-desc">是否建立对应程序文件并受控发布</div></div>
          <div class="tl-item done"><div class="tl-time">要点 2</div><div class="tl-title">执行记录留存</div><div class="tl-desc">是否保留制度执行的客观证据记录</div></div>
          <div class="tl-item warn"><div class="tl-time">要点 3</div><div class="tl-title">人员知晓与培训</div><div class="tl-desc">相关人员是否接受培训并留存考核记录</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">佐证材料</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">${esc(c.name || '公正性')}管理程序 V2.1.pdf</div><div class="file-sub">1.2 MB · 2026-08-20 上传</div></div><button class="btn btn-sm" data-modal-close data-toast="正在预览材料">预览</button></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">公正性风险识别记录表.xlsx</div><div class="file-sub">86 KB · 2026-08-22 上传</div></div><button class="btn btn-sm" data-modal-close data-toast="正在预览材料">预览</button></div>
        <div class="file-card"><div class="file-icon">📑</div><div class="file-meta"><div class="file-name">全员公正性培训签到表.pdf</div><div class="file-sub">240 KB · 2026-09-01 上传</div></div><button class="btn btn-sm" data-modal-close data-toast="正在预览材料">预览</button></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn btn-primary" data-modal-close data-toast="已跳转到自评编辑">去自评</button>`
  }),

  /* ===== 自评详情 ===== */
  'selfassess-detail': (c) => ({
    title: `自评详情 — ${c.code || '4.1'} ${c.name || '公正性'}`,
    subtitle: '查看该条款的完整自评过程与结论',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">自评概况</div>
        <div class="desc-list">
          ${desc('条款编号', esc(c.code || '4.1'))}
          ${desc('条款名称', esc(c.name || '公正性'))}
          ${desc('自评结果', tg(c.result || '符合'))}
          ${desc('任务状态', tg(c.status || '已完成'))}
          ${desc('负责人', esc(c.owner || '张三'))}
          ${desc('自评人', esc(c.assessor || '李四'))}
          ${desc('截止日期', esc(c.due || '2026-11-30'))}
          ${desc('完成日期', esc(c.done || '2026-11-28'))}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">自评说明</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text-secondary);background:var(--bg-page);padding:12px 14px;border-radius:6px;">
          本条款已对照 ISO 20387 要求完成自评。已建立《${esc(c.name || '公正性')}管理程序》并受控发布，管理制度覆盖识别、评价、控制全流程；本年度开展 2 次风险识别评审，形成 8 条风险记录并全部落实控制措施；相关岗位人员均已完成培训与考核，培训记录与考核试卷归档完整。
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">自评证据</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">${esc(c.name || '公正性')}管理程序 V2.1.pdf</div><div class="file-sub">1.2 MB · 已通过系统校验</div></div><span class="tag tag-success">已核验</span></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">风险识别与评价记录表.xlsx</div><div class="file-sub">86 KB · 已通过系统校验</div></div><span class="tag tag-success">已核验</span></div>
        <div class="file-card"><div class="file-icon">📑</div><div class="file-meta"><div class="file-name">培训签到与考核记录.pdf</div><div class="file-sub">240 KB · 待复核</div></div><span class="tag tag-warning">待复核</span></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">流转记录</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-11-28 16:20</div><div class="tl-title">自评提交</div><div class="tl-desc">由 ${esc(c.assessor || '李四')} 提交自评结果「${esc(c.result || '符合')}」</div></div>
          <div class="tl-item done"><div class="tl-time">2026-11-29 09:10</div><div class="tl-title">负责人复核</div><div class="tl-desc">${esc(c.owner || '张三')} 复核通过</div></div>
          <div class="tl-item"><div class="tl-time">待处理</div><div class="tl-title">质量负责人审批</div><div class="tl-desc">等待质量负责人终审</div></div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已导出自评详情">导出</button><button class="btn btn-primary" data-modal-close data-toast="已进入编辑模式">编辑自评</button>`
  }),

  /* ===== 编辑自评 ===== */
  'selfassess-edit': (c) => ({
    title: `编辑自评 — ${c.code || '4.1'} ${c.name || '公正性'}`,
    subtitle: '修改自评结论与说明，保存后进入复核流程',
    size: 'modal-lg',
    body: `
      <div class="alert alert-info">💡 修改自评结果后，该条款将重新进入复核流程，请同步更新佐证材料。</div>
      <div class="modal-section">
        <div class="modal-section-title">自评信息</div>
        <div class="form-row">
          ${inp('条款编号', '', c.code || '4.1')}
          ${inp('条款名称', '', c.name || '公正性')}
        </div>
        <div class="form-item">
          <label class="form-label">自评结果<span class="req">*</span></label>
          <div class="radio-group">
            <div class="radio-pill active" data-pill><span class="dotmark"></span>符合</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>部分符合</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>不符合</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>不适用</div>
          </div>
        </div>
        <div class="form-row">
          ${inp('负责人', '', c.owner || '张三')}
          ${inp('自评人', '', c.assessor || '李四')}
        </div>
        ${inp('截止日期', '', c.due || '2026-11-30')}
        ${ta('自评说明', '描述本条款的落实情况、取得的成效与存在的问题', '已建立对应程序文件并受控发布，本年度开展 2 次风险识别评审，形成 8 条风险记录并全部落实控制措施。')}
        ${ta('改进措施', '如选择「部分符合」或「不符合」，请填写整改计划')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">佐证材料</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:22px;text-align:center;cursor:pointer;" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:26px;">📤</div>
          <div style="font-size:13px;margin-top:6px;color:var(--text-secondary);">点击或拖拽文件到此处上传</div>
          <div style="font-size:11px;margin-top:4px;color:var(--text-tertiary);">支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件</div>
        </div>
      </div>`,
    footer: fSave()
  }),

  /* ===== 整改 ===== */
  'selfassess-rectify': (c) => ({
    title: `发起整改 — ${c.code || '6.2'} ${c.name || '人员'}`,
    subtitle: '针对不符合项制定整改计划并跟踪闭环',
    size: 'modal-lg',
    body: `
      <div class="alert alert-error">⚠ 该条款自评结果为「不符合」，需在 30 日内完成整改并提交验证。</div>
      <div class="modal-section">
        <div class="modal-section-title">问题描述</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text-secondary);background:var(--error-bg);padding:12px 14px;border-radius:6px;">
          现有人员技术档案中，缺少 3 名关键技术人员的授权文件与能力监控记录，不满足 ISO 20387 6.2.3 与 6.2.5 的要求。
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">整改计划</div>
        <div class="form-row">
          ${sel('整改类型', ['文件补充', '流程优化', '设备改造', '培训考核', '其他'])}
          ${inp('整改责任人', '', '孙七')}
        </div>
        <div class="form-row">
          ${inp('计划完成日期', '', '2026-10-15')}
          ${sel('优先级', ['高', '中', '低'])}
        </div>
        ${ta('整改措施', '请填写具体的整改措施、步骤与预期成果', '1. 一周内补齐 3 名技术人员授权文件；\n2. 建立人员能力监控记录表，纳入年度考核；\n3. 由质量负责人复核验证后关闭。')}
        ${ta('验证方式', '整改完成后如何验证有效性')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">整改跟踪</div>
        <div class="steps">
          <div class="step done"><div class="step-num">✓</div><div class="step-label">问题识别</div></div>
          <div class="step-line done"></div>
          <div class="step active"><div class="step-num">2</div><div class="step-label">措施制定</div></div>
          <div class="step-line"></div>
          <div class="step"><div class="step-num">3</div><div class="step-label">整改实施</div></div>
          <div class="step-line"></div>
          <div class="step"><div class="step-num">4</div><div class="step-label">验证关闭</div></div>
        </div>
      </div>`,
    footer: fConfirm('提交整改计划', '整改计划已提交，已通知责任人')
  }),

  /* ===== 上传佐证材料 =====
     2026-09-23：原来这一处有一套独立的上传实现（选择 / 拖拽 / 队列 / 进度），
     归档页的「＋ 上传材料」又是另一套静态弹窗，两边的上传行为不一致。
     现在统一到 evidence-upload，这里只保留旧 key 的别名，避免两套逻辑漂移。 */
  'sa-upload': (c) => MODALS['evidence-upload']({
    clause: (c.code || '') + (c.name ? ' ' + c.name : ''),
    lib: c.lib || '', cid: c.cid || c.code || ''
  }),

  /* ===== 文检模块：文档比对 / 智能校对 / 文检报告 ===== */

  'doc-compare-add': () => ({
    title: '添加比对文档',
    subtitle: '为文档指定角色标识，控制评审引擎的比对行为',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">文档信息</div>
        ${inp('文档名称', '例如：质量手册 V3.1.docx', '')}
        <div class="form-row">
          ${sel('角色标识', ['主体文档（本次评审的核心文档）', '参照标准（用于对比的权威标准文件）', '对比基准（历史版本或基准文档）', '辅助文档（补充参考，非必要对比）'])}
          ${sel('文档类型', ['质量手册', '程序文件', 'SOP', '记录表格', '标准文件', '其他'])}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📤 上传文档</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:22px;text-align:center;cursor:pointer;" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:26px;">📄</div>
          <div style="font-size:13px;margin-top:6px;color:var(--text-secondary);">点击或拖拽文件到此处上传</div>
          <div style="font-size:11px;margin-top:4px;color:var(--text-tertiary);">支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件</div>
        </div>
      </div>`,
    footer: fConfirm('添加文档', '文档已添加，已加入比对列表')
  }),

  'doc-compare-run': () => ({
    title: '开始文档比对',
    subtitle: '选择参照标准与比对参数，系统将自动解析并输出差异',
    size: 'modal-lg',
    body: `
      <div id="doc-compare-config">
        <div class="modal-section">
          <div class="modal-section-title">比对配置</div>
          <div class="form-row">
            ${sel('参照标准', ['CNAS-RL10 生物样本库通用要求', 'ISO/IEC 20387:2018 生物样本库通用要求', 'GB/T 19001:2016 质量管理体系', '自定义标准'])}
            ${sel('比对模式', ['strict 严格模式', 'normal 常规模式', 'loose 宽松模式'])}
          </div>
          <div class="form-row">
            ${inp('匹配阈值', '0 ~ 1，建议 0.82', '0.82')}
            ${sel('输出格式', ['structured_report 结构化报告', 'diff_only 仅差异', 'full 全文对照'])}
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">参与比对文档</div>
          <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">质量手册 V3.1.docx<div class="check-item-note">主体文档 · 1.2 MB</div></div></div>
          <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">CNAS-RL10 生物样本库认可规则.pdf<div class="check-item-note">参照标准 · 3.4 MB</div></div></div>
          <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">质量手册 V3.0.docx<div class="check-item-note">对比基准 · 1.1 MB</div></div></div>
        </div>
        <div class="alert alert-info">💡 系统将解析文档结构，按章节与条款逐项比对，输出「通过 / 待完善 / 不合规」三类结论。</div>
      </div>
      <div id="doc-compare-progress" style="display:none;">
        <div class="modal-section">
          <div class="modal-section-title">⚙ 比对执行中</div>
          <div style="height:8px;background:var(--bg-disabled);border-radius:999px;overflow:hidden;"><div id="doc-compare-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,var(--primary),#4F9DFF);transition:width .35s ease;"></div></div>
          <div id="doc-compare-progress-label" style="font-size:12px;color:var(--text-secondary);margin-top:8px;">准备开始…</div>
        </div>
        <div id="doc-compare-steps" style="display:grid;gap:8px;">
          <div data-compare-step="0" class="check-item"><div class="checkbox"></div><div class="check-item-text">解析文档结构<div class="check-item-note">识别章节、条款、表格与版本信息</div></div></div>
          <div data-compare-step="1" class="check-item"><div class="checkbox"></div><div class="check-item-text">匹配标准条款<div class="check-item-note">建立主体文档与参照标准的映射关系</div></div></div>
          <div data-compare-step="2" class="check-item"><div class="checkbox"></div><div class="check-item-text">生成差异结果<div class="check-item-note">输出通过、待完善、不合规三类结论</div></div></div>
        </div>
      </div>
      <div id="doc-compare-complete" style="display:none;">
        <div class="alert alert-success">✓ 比对完成，已生成结构化差异结果。</div>
        <div class="grid grid-3" style="margin-top:12px;"><div class="status-card"><strong>12</strong><span>通过</span></div><div class="status-card"><strong>5</strong><span>待完善</span></div><div class="status-card"><strong>3</strong><span>不合规</span></div></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="doc-compare-start">开始比对</button>`,
    onMount: (root) => {
      const start = root.querySelector('#doc-compare-start');
      const config = root.querySelector('#doc-compare-config');
      const progress = root.querySelector('#doc-compare-progress');
      const complete = root.querySelector('#doc-compare-complete');
      const bar = root.querySelector('#doc-compare-progress-bar');
      const label = root.querySelector('#doc-compare-progress-label');
      const steps = root.querySelectorAll('[data-compare-step]');
      let running = false;
      start.addEventListener('click', (e) => {
        e.stopPropagation();
        if (running) return;
        running = true;
        start.disabled = true;
        start.textContent = '比对中…';
        start.style.opacity = '.55';
        config.style.display = 'none';
        progress.style.display = '';
        const phases = [
          [25, '正在解析 3 份文档结构…', 0],
          [58, '正在匹配 CNAS-RL10 与 ISO 20387 条款…', 1],
          [86, '正在生成差异、风险与修订建议…', 2],
          [100, '比对完成，正在整理结果…', 2]
        ];
        phases.forEach((phase, index) => setTimeout(() => {
          bar.style.width = phase[0] + '%';
          label.textContent = phase[1];
          steps.forEach((step, i) => { if (i <= phase[2]) { step.classList.add('is-done'); step.querySelector('.checkbox').classList.add('checked'); } });
          if (index === phases.length - 1) {
            progress.style.display = 'none';
            complete.style.display = '';
            start.textContent = '查看比对结果';
            start.disabled = false;
            start.style.opacity = '1';
            start.onclick = (ev) => { ev.stopPropagation(); closeModal(); showToast('已定位到文档比对结果', 'success'); };
          }
        }, index * 850));
      });
    }
  }),

  'doc-detail': (c) => ({
    title: '文档详情 — ' + (c.name || '质量手册 V3.1.docx'),
    subtitle: '查看文档解析状态与参与比对的角色标识',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">文档名称</div><div class="info-tile-value">${esc(c.name || '质量手册 V3.1.docx')}</div></div>
        <div class="info-tile"><div class="info-tile-label">解析状态</div><div class="info-tile-value">已解析</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">基本信息</div>
        <div class="desc-list">
          ${desc('角色标识', '主体文档')}
          ${desc('文档类型', '质量手册')}
          ${desc('版本号', 'V3.1')}
          ${desc('文件大小', '1.2 MB')}
          ${desc('上传时间', '2026-08-20')}
          ${desc('上传人', '陈二')}
          ${desc('关联条款', '4.1、4.2、8.2')}
          ${desc('解析引擎', '文检智能体 v2.0')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📋 解析结果摘要</div>
        <div class="alert alert-success">✓ 文档结构完整，共识别 8 个章节、32 个条款引用，全部完成索引。</div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">条款覆盖度</span><span class="hb-val">86%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:86%; background:linear-gradient(90deg,#4CD263,#00A854);"></div></div>
        </div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">与参照标准一致率</span><span class="hb-val">82%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:82%; background:linear-gradient(90deg,#5A94FF,#2B7FFF);"></div></div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn btn-primary" data-modal-close data-toast="已发起重新解析">重新解析</button>`
  }),

  'doc-proofread-detail': (c) => ({
    title: '校对项详情 — ' + (c.name || '4.2.1'),
    subtitle: '查看该指标的标准依据、检查结论与修订建议',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">检查结论</div>
        <div class="desc-list">
          ${desc('标准', 'CNAS-RL10:2026')}
          ${desc('指标编号', esc(c.name || '4.2.1'))}
          ${desc('依据', 'ISO/IEC 20387:2018')}
          ${desc('章节', '第4章 通用要求')}
          ${desc('结果', tg('通过'))}
          ${desc('检查时间', '2026-09-05 10:42')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">结论说明</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text-secondary);background:var(--bg-page);padding:12px 14px;border-radius:6px;">
          文件已完整覆盖该条款要求，建议保持现有格式。系统比对 3 份文档后未发现实质差异。
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">💡 智能建议</div>
        <div class="insight-item">
          <div class="insight-icon">📌</div>
          <div class="insight-text">建议在下一版修订时补充条款编号索引，便于评审追溯。</div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn btn-primary" data-modal-close data-toast="已生成修订建议">生成修订建议</button>`
  }),

  'doc-proofread-run': () => ({
    title: '开始智能校对',
    subtitle: '选择检查类型与参照标准，系统将逐项输出一致性与符合性结论',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">检查配置</div>
        <div class="form-row">
          ${sel('检查类型', ['一致性检查', '符合性检查', '知识库问答'])}
          ${sel('参照标准', ['CNAS-RL10:2026', 'ISO/IEC 20387:2018', 'GB/T 19001:2016', '劳动合同法'])}
        </div>
        ${sel('受检文档', ['质量手册 V3.1.docx', '样本接收程序文件 QP-04.docx', 'SOP-007 血液样本处理规程.docx', '人员岗位职责说明书.docx', '设备校准记录表.xlsx'])}
        <div class="form-row">
          ${sel('检查模式', ['strict 严格模式', 'normal 常规模式'])}
          ${inp('匹配阈值', '0 ~ 1，建议 0.82', '0.82')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">检查维度</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">文件完整性<div class="check-item-note">章节与条款引用是否完整</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">流程规范性<div class="check-item-note">流程逻辑与闭环是否自洽</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">人员资质<div class="check-item-note">关键岗位任职资格与代理人</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">指标/数据一致性</div></div>
      </div>
      <div class="alert alert-info">💡 校对完成后将输出「通过 / 待完善 / 不合规」三类结论，不合规项可直接转入整改跟踪。</div>`,
    footer: fConfirm('开始校对', '校对完成：通过 12 项 · 待完善 5 项 · 不合规 3 项')
  }),

  'doc-report-preview': (c) => ({
    title: '报告预览 — ' + (c.name || 'DIR-2026-008'),
    subtitle: '文检报告正文预览，支持导出 PDF / Word',
    size: 'modal-lg',
    body: `
      <div class="report-preview">
        <h3 style="text-align:center; font-size:16px; margin:0 0 6px;">文 检 报 告</h3>
        <div style="text-align:center; font-size:12px; color:var(--text-tertiary); margin-bottom:14px;">报告编号：${esc(c.name || 'DIR-2026-008')} ｜ 参照标准：CNAS-RL10:2026 ｜ 生成日期：2026-09-05</div>
        <h4>一、受检文档</h4>
        <p>本次共受检 5 份文档：质量手册 V3.1.docx（主体文档）、CNAS-RL10 生物样本库认可规则.pdf（参照标准）、质量手册 V3.0.docx（对比基准）、程序文件清单.xlsx、人员岗位职责说明书.docx（辅助文档）。</p>
        <h4>二、比对与校对结论</h4>
        <p>按章节与条款逐项比对，共检查 20 项指标：<strong>通过 12 项</strong>、<strong>待完善 5 项</strong>、<strong>不合规 3 项</strong>，整体一致率 82%。</p>
        <h4>三、主要问题</h4>
        <p>1. 指标 4.3.2（第4章 人员要求）：关键岗位代理人条款缺失，需补充任职资格要求描述。<br>
        2. 指标 5.4.3（第5章 记录控制）：缺少电子记录保存期限的明确规定，须按规定补充。</p>
        <h4>四、建议</h4>
        <p>建议在下版修订中补充上述条款，并将报告提交质量负责人审批后归档。</p>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已导出 PDF">导出 PDF</button><button class="btn btn-primary" data-modal-close data-toast="已导出 Word">导出 Word</button>`
  }),

  'doc-report-new': () => ({
    title: '生成文检报告',
    subtitle: '汇总比对与校对结论，生成标准化报告',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">报告信息</div>
        <div class="form-row">
          ${inp('报告编号', '系统自动生成或手动指定', 'DIR-2026-009')}
          ${sel('报告类型', ['文档比对报告', '一致性检查报告', '符合性检查报告', '综合文检报告'])}
        </div>
        ${inp('报告名称', '例如：质量手册 V3.1 文检报告', '')}
        <div class="form-row">
          ${sel('参照标准', ['CNAS-RL10:2026', 'ISO/IEC 20387:2018', 'GB/T 19001:2016'])}
          ${inp('编制人', '', '陈二')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📋 纳入内容</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">文档比对差异明细</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">一致性与符合性检查结论</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">不合规项与整改建议<div class="check-item-note">含 3 项不合规、5 项待完善</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">佐证材料附件</div></div>
      </div>`,
    footer: fConfirm('生成报告', '报告已生成，已提交质量负责人审批')
  }),

  /* ===== 文检问题处置与报告流转 ===== */
  'doc-issue-create': (c) => ({
    title: '转为文检问题 — ' + (c.name || '检查发现'),
    subtitle: '将检查发现纳入问题台账，分配责任人并跟踪整改闭环',
    size: 'modal-lg',
    body: `
      <div class="alert alert-warning">⚠ 创建后将形成问题编号，并可在后续报告中自动引用。</div>
      <div class="modal-section">
        <div class="modal-section-title">问题信息</div>
        <div class="form-row">${inp('问题编号', '系统自动生成', 'DOC-NC-2026-004')}${sel('问题等级', ['严重', '一般', '观察'])}</div>
        ${inp('关联条款', '', c.name || '7.4 数据管理')}
        ${ta('问题描述', '描述文档缺陷、证据和影响范围', '电子记录保存期限未在现行程序文件中明确，可能影响记录追溯与归档管理。')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">整改分配</div>
        <div class="form-row">${sel('责任部门', ['质量管理部', '样本管理部', '信息管理部', '技术部'])}${sel('责任人', ['张三', '李四', '孙七', '周八'])}</div>
        <div class="form-row">${dateInp('整改期限', '2026-10-15', true)}${sel('优先级', ['高', '中', '低'])}</div>
        ${ta('整改建议', '填写建议措施或引用相关 SOP')}
      </div>`,
    footer: fConfirm('创建问题并通知', '问题已创建，责任人已收到整改通知')
  }),

  'doc-report-approve': (c) => ({
    title: '提交报告审批 — ' + (c.name || 'DIR-2026-008'),
    subtitle: '报告提交后将进入质量负责人审批流程',
    size: 'modal-md',
    body: `
      <div class="alert alert-info">📋 系统将校验报告是否包含：检查范围、依据标准、问题清单、整改建议和附件索引。</div>
      <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">检查结论与明细已生成</div></div>
      <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">不合规项已关联问题台账</div></div>
      <div class="check-item"><div class="checkbox"></div><div class="check-item-text">所有问题均已关闭或有延期说明</div></div>
      ${ta('提交说明', '补充审批人需要关注的重点')}`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="报告已提交质量负责人审批">提交审批</button>`
  }),

  'doc-report-archive': (c) => ({
    title: '归档文检报告 — ' + (c.name || 'DIR-2026-007'),
    subtitle: '归档后报告将进入历史文检档案，不再允许直接编辑',
    size: 'modal-md',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">归档信息</div>
        ${inp('档案编号', '', 'DOC-ARCH-2026-007')}
        ${sel('归档分类', ['质量手册文检', '程序文件文检', 'SOP 文检', '专项文检'])}
        ${inp('保存期限', '', '长期')}
        ${ta('归档备注', '记录本次文检的背景、范围和后续跟踪事项')}
      </div>
      <div class="alert alert-success">✓ 报告已审批，归档后将保留版本、证据索引和问题处置记录。</div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="报告已归档">确认归档</button>`
  }),

  /* ===== 新增自评 / 新建任务 ===== */
  'selfassess-new': () => ({
    title: '新增自评任务',
    subtitle: '选择条款并指派负责人与自评人',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">任务信息</div>
        <div class="form-row">
          ${sel('所属分类', ['管理要求', '技术要求'])}
          ${sel('条款', ['4.1 公正性', '4.2 保密性', '5.1 法律实体', '5.2 生物样本库结构', '6.1 总则（资源）', '6.2 人员', '6.3 设施和环境条件', '6.4 设备', '6.5 计量溯源性', '6.6 外部提供的产品和服务', '7.1 要求、标书和合同评审', '7.2 方法的选择、验证和确认', '8.1 方式选择', '8.2 管理体系文件'])}
        </div>
        <div class="form-row">
          ${sel('负责人', ['张三', '孙七', '周八', '吴九', '郑十'])}
          ${sel('自评人', ['李四', '王五', '赵六', '周八'])}
        </div>
        <div class="form-row">
          ${inp('截止日期', '', '2026-12-31')}
          ${sel('优先级', ['高', '中', '低'])}
        </div>
        ${ta('任务说明', '补充说明本次自评的重点与范围')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">通知设置</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">创建后立即通知负责人与自评人<div class="check-item-note">通过站内消息推送</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">截止前 3 天发送提醒</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">同步创建材料归档任务</div></div>
      </div>`,
    footer: fConfirm('创建任务', '自评任务已创建并通知相关人员')
  }),

  'task-new': () => MODALS['selfassess-new'](),

  /* ===== 批量分配 ===== */
  'batch-assign': () => ({
    title: '批量分配任务',
    subtitle: '按条款分类或人员批量指派负责人与自评人',
    size: 'modal-lg',
    body: `
      <div class="alert alert-info">💡 当前选中 <strong>8</strong> 个未分配任务，可批量指派。</div>
      <div class="modal-section">
        <div class="modal-section-title">分配范围</div>
        <div class="radio-group" style="margin-bottom:14px;">
          <div class="radio-pill active" data-pill><span class="dotmark"></span>全部未分配（8）</div>
          <div class="radio-pill" data-pill><span class="dotmark"></span>管理要求（3）</div>
          <div class="radio-pill" data-pill><span class="dotmark"></span>技术要求（5）</div>
        </div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">6.4 设备</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">6.5 计量溯源性</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">6.6 外部提供的产品和服务</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">6.7 外部提供的产品和服务</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">分配设置</div>
        <div class="form-row">
          ${sel('负责人', ['张三', '孙七', '周八', '吴九', '按条款自动匹配'])}
          ${sel('自评人', ['李四', '王五', '赵六', '按条款自动匹配'])}
        </div>
        <div class="form-row">
          ${inp('统一截止日期', '', '2026-12-31')}
          ${sel('分配策略', ['平均分配', '按专业匹配', '按当前负载'])}
        </div>
      </div>`,
    footer: fConfirm('确认分配', '已批量分配 8 个任务')
  }),

  /* ===== 材料详情 ===== */
  'archive-detail': (c) => ({
    title: `材料详情 — ${c.name || '质量手册 V3.2.pdf'}`,
    subtitle: '查看材料完整信息与关联条款',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">基本信息</div>
        <div class="desc-list">
          ${desc('文件名称', esc(c.name || '质量手册 V3.2.pdf'))}
          ${desc('文件类型', esc(c.type || '质量手册'))}
          ${desc('文件大小', esc(c.size || '1.2 MB'))}
          ${desc('上传时间', esc(c.time || '2026-08-20 14:30'))}
          ${desc('上传人', esc(c.uploader || '陈主管'))}
          ${desc('版本号', 'V3.2')}
          ${desc('关联条款', esc(c.clause || '8.2 管理体系文件'))}
          ${desc('归档状态', tg(c.status || '已归档'))}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">智能识别结果</div>
        <div class="alert alert-success">✓ 系统已自动识别该文件内容，匹配度 <strong>96%</strong>，建议归入「8.2 管理体系文件」。</div>
        <div class="desc-list">
          ${desc('识别关键词', '质量管理、方针目标、组织架构、职责权限、管理评审')}
          ${desc('建议分类', '质量手册')}
          ${desc('建议关联条款', '8.2 / 8.3 / 8.4')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">文件预览</div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;background:var(--bg-page);">
          <div style="font-size:48px;">📄</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:10px;">${esc(c.name || '质量手册 V3.2.pdf')}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:12px;" data-modal-close data-toast="正在打开预览器">在线预览</button>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">版本历史</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-08-20</div><div class="tl-title">V3.2（当前）</div><div class="tl-desc">补充管理评审章节，修订职责分配表</div></div>
          <div class="tl-item done"><div class="tl-time">2025-06-11</div><div class="tl-title">V3.1</div><div class="tl-desc">更新质量方针表述</div></div>
          <div class="tl-item done"><div class="tl-time">2024-03-02</div><div class="tl-title">V3.0</div><div class="tl-desc">体系换版，首次发布</div></div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已开始下载">下载</button><button class="btn btn-primary" data-modal-close data-toast="已重新归类">重新归类</button>`
  }),

  /* ===== 归档 / 归类 ===== */
  'archive-file': (c) => ({
    title: '归档材料',
    subtitle: '确认归档信息并选择目标条款',
    size: 'modal-lg',
    body: `
      <div class="alert alert-info">💡 系统已根据文件内容智能推荐归档位置，确认后即可完成归档。</div>
      <div class="modal-section">
        <div class="modal-section-title">待归档文件</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">${esc(c.name || '设备校准记录 2026Q3.pdf')}</div><div class="file-sub">860 KB · 刚刚上传</div></div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">归档位置</div>
        <div class="form-row">
          ${sel('要素分类', ['管理要求', '技术要求', '质量手册', '程序文件', 'SOP', '记录表格'])}
          ${sel('关联条款', ['6.4 设备', '6.5 计量溯源性', '6.3 设施和环境条件', '6.2 人员'])}
        </div>
        ${inp('材料标题', '', c.name || '设备校准记录 2026Q3')}
        ${ta('备注说明', '补充说明该材料的用途或覆盖范围', '覆盖 2026 年第三季度全部关键设备的校准记录，共 12 台设备。')}
        <div class="form-item">
          <label class="form-label">标签</label>
          <div class="radio-group">
            <div class="radio-pill active" data-pill><span class="dotmark"></span>关键证据</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>补充材料</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>参考文件</div>
          </div>
        </div>
      </div>`,
    footer: fConfirm('确认归档', '材料已归档至「6.4 设备」')
  }),

  'archive-classify': () => MODALS['archive-file']({}),

  /* ===== 上传材料 ===== */
  'archive-upload': () => ({
    title: '上传材料',
    subtitle: '支持批量上传，系统将自动识别并推荐归档位置',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">选择文件</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:36px;text-align:center;cursor:pointer;background:var(--primary-50);" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:40px;">📤</div>
          <div style="font-size:14px;margin-top:10px;color:var(--text-secondary);">点击选择文件或拖拽到此处</div>
          <div style="font-size:12px;margin-top:6px;color:var(--text-tertiary);">支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件</div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">上传队列</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">设备校准记录 2026Q3.pdf</div><div class="file-sub">860 KB · 识别中<div class="progress" style="height:4px;margin-top:6px;"><div class="progress-bar" style="width:82%"></div></div></div></div><span class="tag tag-warning">识别中</span></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">人员培训档案表.xlsx</div><div class="file-sub">320 KB · 已识别</div></div><span class="tag tag-success">已识别</span></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">上传设置</div>
        ${sel('默认要素分类', ['自动识别', '管理要求', '技术要求', '质量手册', '程序文件', 'SOP', '记录表格'])}
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">上传后自动智能归类<div class="check-item-note">基于文件内容匹配条款，可在归档前手动调整</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">同时创建自评任务</div></div>
      </div>`,
    footer: fConfirm('开始上传', '已提交 2 个文件，正在后台识别')
  }),

  /* ===== 检查清单 ===== */
  'checklist-new': () => ({
    title: '新建检查清单',
    subtitle: '基于条款自动生成检查项，或手动创建',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">清单信息</div>
        ${inp('清单名称', '例如：2026 年度内审检查清单', '2026 年度 CNAS 迎检内审清单')}
        <div class="form-row">
          ${sel('检查类型', ['内部审核', '管理评审', '专项检查', '模拟评审'])}
          ${sel('检查范围', ['全部条款', '管理要求', '技术要求', '自定义选择'])}
        </div>
        <div class="form-row">
          ${inp('计划开始日期', '', '2026-09-15')}
          ${inp('计划结束日期', '', '2026-09-30')}
        </div>
        ${sel('检查组长', ['陈主管', '张三', '孙七'])}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">自动生成检查项</div>
        <div class="alert alert-info">💡 将根据所选范围自动生成标准检查项，预计生成 <strong>156</strong> 项。</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">包含条款原文与评审要点</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">自动生成佐证材料要求<div class="check-item-note">每项标注需提供的证据清单</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">继承上次检查的整改项</div></div>
      </div>`,
    footer: fConfirm('创建清单', '检查清单已创建，共生成 156 项')
  }),

  'checklist-batch': () => ({
    title: '批量操作',
    subtitle: '对选中的检查项执行批量处理',
    size: '',
    body: `
      <div class="alert alert-info">💡 当前已选中 <strong>12</strong> 个检查项。</div>
      <div class="modal-section">
        <div class="modal-section-title">选择操作</div>
        <div class="radio-group" style="flex-direction:column;align-items:stretch;">
          <div class="radio-pill active" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>批量标记「已检查」</div>
          <div class="radio-pill" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>批量指派检查人</div>
          <div class="radio-pill" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>批量导出为 Excel</div>
          <div class="radio-pill" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>批量标记「需整改」</div>
        </div>
      </div>
      <div class="modal-section">
        ${sel('指派检查人（如选择批量指派）', ['陈主管', '张三', '孙七', '周八'])}
        ${ta('统一备注', '为所选检查项添加统一备注说明')}
      </div>`,
    footer: fConfirm('执行操作', '已对 12 个检查项执行批量操作')
  }),

  /* ===== 历史评审记录 ===== */
  'history-detail': (c) => ({
    title: `评审记录详情 — ${c.name || '2025 年度 CNAS 初次评审'}`,
    subtitle: '查看评审过程、发现项与整改情况',
    size: 'modal-xl',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">评审概况</div>
        <div class="desc-list">
          ${desc('评审名称', esc(c.name || '2025 年度 CNAS 初次评审'))}
          ${desc('评审类型', esc(c.type || '初次评审'))}
          ${desc('评审日期', esc(c.date || '2025-06-18 ~ 2025-06-20'))}
          ${desc('评审机构', '中国合格评定国家认可委员会（CNAS）')}
          ${desc('评审组长', esc(c.leader || '外部评审组长'))}
          ${desc('评审结论', tg(c.result || '通过'))}
          ${desc('开出不符合项', '<strong style="color:var(--error)">3 项</strong>')}
          ${desc('整改状态', tg('已全部关闭'))}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">评审发现</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>编号</th><th>条款</th><th>问题描述</th><th>严重程度</th><th>整改状态</th></tr></thead>
          <tbody>
            <tr><td>NCR-01</td><td>6.2 人员</td><td>2 名技术人员缺少能力监控记录</td><td><span class="tag tag-error">严重</span></td><td><span class="tag tag-success">已关闭</span></td></tr>
            <tr><td>NCR-02</td><td>6.4 设备</td><td>1 台离心机校准过期 12 天</td><td><span class="tag tag-warning">一般</span></td><td><span class="tag tag-success">已关闭</span></td></tr>
            <tr><td>NCR-03</td><td>7.5 样品处置</td><td>废弃样本处置记录不完整</td><td><span class="tag tag-warning">一般</span></td><td><span class="tag tag-success">已关闭</span></td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">整改过程</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2025-06-20</div><div class="tl-title">不符合项开出</div><div class="tl-desc">现场评审结束，开出 3 项不符合项</div></div>
          <div class="tl-item done"><div class="tl-time">2025-07-05</div><div class="tl-title">整改计划提交</div><div class="tl-desc">提交原因分析、纠正措施与完成计划</div></div>
          <div class="tl-item done"><div class="tl-time">2025-08-12</div><div class="tl-title">整改材料提交</div><div class="tl-desc">提交全部整改证据材料</div></div>
          <div class="tl-item done"><div class="tl-time">2025-09-03</div><div class="tl-title">整改验证通过</div><div class="tl-desc">评审组书面验证通过，不符合项全部关闭</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">评审档案</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">CNAS 评审报告正本.pdf</div><div class="file-sub">2.4 MB</div></div><button class="btn btn-sm" data-modal-close data-toast="正在打开预览…">预览</button><button class="btn btn-sm" data-modal-close data-toast="正在下载">下载</button></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">不符合项整改报告.pdf</div><div class="file-sub">1.8 MB</div></div><button class="btn btn-sm" data-modal-close data-toast="正在打开预览…">预览</button><button class="btn btn-sm" data-modal-close data-toast="正在下载">下载</button></div>
        <div class="file-card"><div class="file-icon">📑</div><div class="file-meta"><div class="file-name">现场评审记录与照片.zip</div><div class="file-sub">48 MB</div></div><button class="btn btn-sm" data-modal-close data-toast="正在打开预览…">预览</button><button class="btn btn-sm" data-modal-close data-toast="正在下载">下载</button></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button>`
  }),

  'history-download': (c) => ({
    title: '下载评审档案',
    subtitle: '选择需要下载的内容与格式',
    size: '',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">下载内容</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">评审报告正本</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">不符合项整改报告</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">现场评审记录与照片</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">评审员资质与分工表</div></div>
      </div>
      <div class="modal-section">
        ${sel('导出格式', ['PDF 合并包', 'ZIP 压缩包', '单个 PDF'])}
        <div class="form-hint">预计大小 52 MB，打包完成后将通过站内消息通知。</div>
      </div>`,
    footer: fConfirm('开始下载', '已加入下载队列，完成后将通知您')
  }),

  /* ===== 历史评审 · 趋势分析 ===== */
  'history-trend': () => ({
    title: '评审趋势分析',
    subtitle: '基于 5 次历史评审数据的多维度趋势洞察',
    size: 'modal-xl',
    body: `
      <div class="modal-section">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          ${selInline('统计范围', ['全部记录（5 次）', '近 5 年', '近 3 年', '仅 CNAS 正式评审'])}
          ${selInline('对比维度', ['符合率', '不符合项', '整改周期', '条款达标率'])}
          <button class="btn btn-sm" data-modal-close data-toast="分析参数已重置">重置</button>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">核心指标</div>
        <div class="metric-row">
          <div class="metric-card">
            <div class="metric-label">平均符合率</div>
            <div class="metric-value" style="color:var(--warning);">90%</div>
            <div class="metric-delta bad">▼ 较上周期 -10%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">不符合项总数</div>
            <div class="metric-value" style="color:var(--error);">4</div>
            <div class="metric-delta bad">▲ 较上周期 +1</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">平均整改周期</div>
            <div class="metric-value" style="color:var(--primary);">18<span style="font-size:12px;font-weight:400;"> 天</span></div>
            <div class="metric-delta good">▼ 缩短 5 天</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">正式评审通过率</div>
            <div class="metric-value" style="color:var(--success);">100%</div>
            <div class="metric-delta flat">— 持平</div>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">符合率趋势</div>
        <div class="chart-card">
          <div class="chart-title">各次评审符合率变化</div>
          <div class="chart-sub">单位：% · 虚线为 90% 目标线</div>
          <div class="chart-bars">
            <div class="bar-col"><div class="bar-value" style="color:var(--text-tertiary);">—</div><div class="bar muted" style="height:6px;"></div></div>
            <div class="bar-col"><div class="bar-value">100%</div><div class="bar success" style="height:120px;"></div></div>
            <div class="bar-col"><div class="bar-value">90%</div><div class="bar warning" style="height:108px;"></div></div>
            <div class="bar-col"><div class="bar-value">100%</div><div class="bar success" style="height:120px;"></div></div>
            <div class="bar-col"><div class="bar-value" style="color:var(--warning);">70%</div><div class="bar" style="height:84px;"></div></div>
          </div>
          <div class="bar-axis"><span>2018 筹建</span><span>2020 初评</span><span>2022 内审</span><span>2024 初评</span><span>2026 复审</span></div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">不符合项分布</div>
        <div class="chart-card">
          <div class="chart-title">历次评审开出的不符合项数量</div>
          <div class="chart-sub">单位：项</div>
          <div class="chart-bars" style="height:110px;">
            <div class="bar-col"><div class="bar-value" style="color:var(--text-tertiary);">—</div><div class="bar muted" style="height:6px;"></div></div>
            <div class="bar-col"><div class="bar-value" style="color:var(--success);">0</div><div class="bar success" style="height:6px;"></div></div>
            <div class="bar-col"><div class="bar-value" style="color:var(--error);">3</div><div class="bar warning" style="height:80px;"></div></div>
            <div class="bar-col"><div class="bar-value" style="color:var(--success);">0</div><div class="bar success" style="height:6px;"></div></div>
            <div class="bar-col"><div class="bar-value" style="color:var(--warning);">1</div><div class="bar" style="height:30px;"></div></div>
          </div>
          <div class="bar-axis"><span>2018</span><span>2020</span><span>2022</span><span>2024</span><span>2026</span></div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">条款分类达标率</div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">管理要求（13 条）</span><span class="hb-val">85%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:85%;background:var(--success);"></div></div>
        </div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">技术要求（17 条）</span><span class="hb-val">72%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:72%;background:var(--warning);"></div></div>
        </div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">6.2 人员</span><span class="hb-val">65%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:65%;background:var(--error);"></div></div>
        </div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">6.4 设备</span><span class="hb-val">90%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:90%;background:var(--success);"></div></div>
        </div>
        <div class="hbar-item">
          <div class="hbar-head"><span class="hb-name">8.2 管理体系文件</span><span class="hb-val">95%</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:95%;background:var(--success);"></div></div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">智能洞察</div>
        <div class="insight-item"><span class="insight-icon">📉</span><span class="insight-text"><strong>符合率下滑需警惕</strong>：2026 复审符合率降至 70%，为近 5 年最低，主要拖累项为技术要求中的「6.2 人员」与「6.4 设备」。</span></div>
        <div class="insight-item"><span class="insight-icon">🔁</span><span class="insight-text"><strong>不符合项呈周期性波动</strong>：内部预审（2022）开出 3 项，随后的正式评审（2024）降至 0 项，说明内部预审的整改机制有效。</span></div>
        <div class="insight-item"><span class="insight-icon">⚡</span><span class="insight-text"><strong>整改效率持续改善</strong>：平均整改周期由 23 天缩短至 18 天，建议保持当前的整改跟踪机制。</span></div>
        <div class="insight-item"><span class="insight-icon">🎯</span><span class="insight-text"><strong>行动建议</strong>：优先补齐「6.2 人员」的技术档案与能力监控记录，该条在 2022 与 2026 两次评审中均被开出不符合项，属于反复问题。</span></div>
      </div>

      <div class="alert alert-warning">⚠ 2026 年度复审正在进行中，当前符合率为阶段性数据，最终结论以评审结束后的正式报告为准。</div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="趋势分析图已导出">导出图表</button><button class="btn btn-primary" data-modal-close data-toast="分析报告已生成">生成分析报告</button>`
  }),

  /* ===== 历史评审 · 导出档案 ===== */
  'history-export': () => ({
    title: '导出评审档案',
    subtitle: '按范围与内容批量导出历次评审档案',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">导出范围</div>
        <div class="form-row">
          ${sel('时间范围', ['全部（2018 - 2026）', '近 5 年（2021 - 2026）', '近 3 年（2023 - 2026）', '自定义'])}
          ${sel('评审类型', ['全部类型', '仅 CNAS 正式评审', '仅内部评审'])}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">选择档案</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th style="width:36px;"></th><th>评审名称</th><th>时间</th><th>类型</th><th>结论</th><th>档案数</th></tr></thead>
          <tbody>
            <tr><td><div class="checkbox checked"></div></td><td>2026 年度复审</td><td>2026.09 ~ 2027.01</td><td><span class="tag tag-primary">CNAS 复评</span></td><td><span class="tag tag-primary">进行中</span></td><td>3</td></tr>
            <tr><td><div class="checkbox checked"></div></td><td>2024 初次评审</td><td>2024.08 ~ 2024.12</td><td><span class="tag tag-success">CNAS 初评</span></td><td><span class="tag tag-success">通过</span></td><td>5</td></tr>
            <tr><td><div class="checkbox checked"></div></td><td>2022 内部预审</td><td>2022.07 ~ 2022.09</td><td><span class="tag tag-default">内部</span></td><td><span class="tag tag-warning">部分符合</span></td><td>4</td></tr>
            <tr><td><div class="checkbox"></div></td><td>2020 初次评审</td><td>2020.09 ~ 2020.12</td><td><span class="tag tag-success">CNAS 初评</span></td><td><span class="tag tag-success">通过</span></td><td>5</td></tr>
            <tr><td><div class="checkbox"></div></td><td>2018 实验室认可筹建</td><td>2018.06 ~ 2018.12</td><td><span class="tag tag-default">筹建</span></td><td><span class="tag tag-default">筹备</span></td><td>2</td></tr>
          </tbody>
        </table></div>
        <div class="form-hint">已选中 <strong>3</strong> 次评审，共 <strong>12</strong> 份档案。</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">导出内容</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">评审报告正本</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">不符合项及整改报告<div class="check-item-note">含原因分析、纠正措施与验证材料</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">现场评审记录与照片</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">评审员资质与分工表</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">评审结论与证书扫描件</div></div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">导出设置</div>
        <div class="form-row">
          ${sel('导出格式', ['ZIP 压缩包（推荐）', 'PDF 合并包', '仅文件清单（Excel）'])}
          ${sel('文件命名规则', ['评审名称_文件类型', '评审编号_文件类型', '年份_评审名称'])}
        </div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">生成目录索引文件（README）</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">添加导出水印<div class="check-item-note">标注导出人与导出时间</div></div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">压缩包加密<div class="check-item-note">密码将通过站内消息单独发送</div></div></div>
        <div class="alert alert-info" style="margin-top:12px;">📦 预计打包大小 <strong>86 MB</strong>，包含 12 份档案。打包完成后将通过站内消息通知您下载。</div>
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已加入导出队列，完成后将通知您">开始导出</button>`
  }),

  /* ===== 历史评审 · 上传历史档案 ===== */
  'history-upload': () => ({
    title: '上传历史档案',
    subtitle: '将纸质或历史电子档案数字化归档，系统自动识别并建索引',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">选择文件</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:32px;text-align:center;cursor:pointer;background:var(--primary-50);" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:38px;">📤</div>
          <div style="font-size:14px;margin-top:10px;color:var(--text-secondary);">点击选择文件或拖拽到此处</div>
          <div style="font-size:12px;margin-top:6px;color:var(--text-tertiary);">支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件</div>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">上传队列</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">2018 实验室认可筹建报告.pdf</div><div class="file-sub">3.2 MB · OCR 识别中<div class="progress" style="height:4px;margin-top:6px;"><div class="progress-bar" style="width:64%"></div></div></div></div><span class="tag tag-warning">识别中</span></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">2020 初次评审不符合项清单.xlsx</div><div class="file-sub">420 KB · 已识别</div></div><span class="tag tag-success">已识别</span></div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">档案信息</div>
        <div class="form-row">
          ${inp('评审编号', '例如：CNAS-2018-Q3-001', 'SUP-2018-Q3-001')}
          ${inp('评审名称', '', '2018 实验室认可筹建')}
        </div>
        <div class="form-row">
          ${sel('评审类型', ['CNAS 初评', 'CNAS 复评', '监督评审', '扩项评审', '内部评审', '筹建'])}
          ${sel('评审结论', ['通过', '部分符合', '不通过', '筹备中', '进行中'])}
        </div>
        <div class="form-row">
          ${inp('开始日期', '', '2018-06-01')}
          ${inp('结束日期', '', '2018-12-31')}
        </div>
        <div class="form-row">
          ${sel('评审组长/负责人', ['王主管', '陈主管', '外部评审组长'])}
          ${inp('不符合项数量', '', '0')}
        </div>
        ${ta('备注说明', '补充说明本次评审的背景、范围或特殊情况', '实验室认可筹建阶段的咨询性评审，未形成正式不符合项。')}
      </div>

      <div class="modal-section">
        <div class="modal-section-title">智能识别结果</div>
        <div class="alert alert-success">✓ 已自动识别 <strong>2</strong> 份文件，提取关键信息 <strong>8</strong> 项，识别置信度 <strong>92%</strong>。</div>
        <div class="desc-list">
          ${desc('识别到的评审名称', '2018 实验室认可筹建')}
          ${desc('识别到的评审时间', '2018.06 ~ 2018.12')}
          ${desc('识别到的评审类型', '筹建')}
          ${desc('建议归档位置', '历史评审档案 / 2018')}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">归档设置</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">上传后自动生成档案索引<div class="check-item-note">便于后续全文检索</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">同步更新趋势分析数据</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">设为该年度基准档案<div class="check-item-note">作为后续评审的对比基准</div></div></div>
      </div>`,
    footer: fConfirm('确认上传', '档案已上传并归档，索引生成中')
  }),

  /* ===== 版本管理 ===== */
  'version-detail': (c) => ({
    title: `版本详情 — ${c.name || '质量手册'}`,
    subtitle: '查看文件全部历史版本与变更记录',
    size: 'modal-lg',
    headerAction: `<button class="btn btn-primary btn-sm" data-action="version-view" data-name="${esc(c.name || '质量手册')}" data-ver="${esc(c.ver || 'V3.2')}" data-status="${esc(c.status || '已批准')}">查看此版本</button>`,
    body: `
      <div class="modal-section">
        <div class="modal-section-title">文件信息</div>
        <div class="desc-list">
          ${desc('文件名称', esc(c.name || '质量手册'))}
          ${desc('文件编号', 'QM-001')}
          ${desc('当前版本', `<strong style="color:var(--primary)">${esc(c.ver || 'V3.2')}</strong>`)}
          ${desc('审批状态', tg(c.status || '已批准'))}
          ${desc('最后修改', esc(c.time || '2026-08-20'))}
          ${desc('修改人', esc(c.modifier || '陈主管'))}
          ${desc('生效日期', '2026-09-01')}
          ${desc('关联条款', esc(c.clause || '8.2 管理体系文件'))}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">版本历史</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-08-20</div><div class="tl-title">V3.2（当前 · 已批准）</div><div class="tl-desc">补充管理评审章节 4.5，修订附录 A 职责分配表 · 陈主管</div></div>
          <div class="tl-item done"><div class="tl-time">2025-06-11</div><div class="tl-title">V3.1</div><div class="tl-desc">更新质量方针表述，优化组织架构图 · 陈主管</div></div>
          <div class="tl-item done"><div class="tl-time">2024-03-02</div><div class="tl-title">V3.0</div><div class="tl-desc">体系换版，依据 ISO 20387:2018 全面修订 · 张三</div></div>
          <div class="tl-item"><div class="tl-time">2022-05-18</div><div class="tl-title">V2.0</div><div class="tl-desc">首次建立文件化质量管理体系 · 张三</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">变更影响分析</div>
        <div class="alert alert-warning">⚠ 该文件已关联 <strong>6.2 人员</strong> 与 <strong>8.2 管理体系文件</strong> 两条条款的自评材料，版本变更后请同步更新佐证材料。</div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-action="version-compare" data-name="${esc(c.name || '质量手册')}" data-ver="${esc(c.ver || 'V3.2')}" data-status="${esc(c.status || '已批准')}">版本对比</button><button class="btn btn-primary" data-modal-close data-toast="正在下载当前版本">下载</button>`
    /* 2026-09-23：「版本对比」原来是 data-modal-close + toast 的假动作，
       现在带文件上下文真正打开对比弹窗（全局委托在弹窗内同样生效）。 */
  }),

  'version-view': (c) => {
    const name = c.name || '质量手册';
    const { file, activeIndex } = getVersionViewData(c.name, c.ver, c.status);
    const v = file.versions[activeIndex];
    return {
      title: `${esc(name)} ${esc(v.ver)}`,
      subtitle: '查看此版本完整内容与历史状态',
      size: 'modal-xl',
      body: `<div class="version-viewer">${renderVersionViewer(name, file, activeIndex)}</div>`,
      footer: `<button class="btn" data-vv-exit>← 退出版本详情</button><div class="version-tabs">${buildVersionTabs(name, file.versions, v.ver)}</div><button class="btn btn-primary" data-modal-close>关闭</button>`,
      // 底部版本号切换：原地更新正文，避免重开弹窗导致滚动跳顶
      onMount(root) {
        const modal = root.querySelector('.modal') || root;
        const exitBtn = modal.querySelector('[data-vv-exit]');
        if (exitBtn) exitBtn.addEventListener('click', function () {
          closeModal();
          openModal('version-detail', { name: name, ver: v.ver, status: v.status });
        });
        modal.addEventListener('click', function (e) {
          const tab = e.target.closest('.version-tab');
          if (!tab) return;
          e.preventDefault();
          e.stopPropagation();
          const n = tab.getAttribute('data-name') || name;
          const ver = tab.getAttribute('data-ver');
          const st = tab.getAttribute('data-status');
          const d = getVersionViewData(n, ver, st);
          const idx = d.activeIndex;
          const viewer = modal.querySelector('.version-viewer');
          if (viewer) {
            viewer.innerHTML = renderVersionViewer(n, d.file, idx);
            viewer.classList.remove('vv-fade');
            void viewer.offsetWidth;
            viewer.classList.add('vv-fade');
          }
          const titleEl = modal.querySelector('.modal-title');
          if (titleEl) titleEl.textContent = n + ' ' + d.file.versions[idx].ver;
          const tabsBox = modal.querySelector('.version-tabs');
          if (tabsBox) tabsBox.innerHTML = buildVersionTabs(n, d.file.versions, d.file.versions[idx].ver);
          const bodyEl = modal.querySelector('.modal-body');
          if (bodyEl) bodyEl.scrollTop = 0;
        });
      }
    };
  },

  'version-compare': (c) => {
    const name = c.name || '质量手册';
    const { file } = getVersionViewData(name, c.ver, c.status);
    const vers = file.versions;
    const defNew = vers[0], defOld = vers[1] || vers[0];

    const optHtml = (sel) => vers.map(v =>
      `<option value="${esc(v.ver)}"${v.ver === sel ? ' selected' : ''}>${esc(v.ver)} — ${esc(v.date)}${v.ver === vers[0].ver ? '（当前）' : ''}</option>`).join('');

    return {
      title: `版本对比 — ${esc(name)}`,
      subtitle: '新旧版本可任选，差异内容实时联动',
      size: 'modal-xl',
      body: `
      <div class="modal-section">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <select class="form-control" id="vcmp-old" title="旧版本">${optHtml(defOld.ver)}</select>
          <span style="color:var(--text-tertiary);">⇄</span>
          <select class="form-control" id="vcmp-new" title="新版本">${optHtml(defNew.ver)}</select>
        </div>
        <div id="vcmp-diff"></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">变更摘要</div>
        <div id="vcmp-summary"></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">影响条款</div>
        <div class="radio-group">
          <div class="radio-pill active" data-pill><span class="dotmark"></span>7.2 方法选择与验证</div>
          <div class="radio-pill active" data-pill><span class="dotmark"></span>7.4 样本接收与制备</div>
          <div class="radio-pill active" data-pill><span class="dotmark"></span>6.4 设备</div>
        </div>
      </div>`,
      footer: `<button class="btn" data-modal-close>关闭</button>
               <button class="btn" id="vcmp-export">导出对比</button>
               <button class="btn btn-primary" id="vcmp-sync">同步条款</button>`,
      onMount(root) {
        const selO = root.querySelector('#vcmp-old'), selN = root.querySelector('#vcmp-new');
        const diffBox = root.querySelector('#vcmp-diff'), sumBox = root.querySelector('#vcmp-summary');
        function render() {
          const ov = selO.value, nv = selN.value;
          if (ov === nv) {
            diffBox.innerHTML = '<div class="alert alert-info">两次选择的是同一版本，请选择不同的新旧版本进行对比。</div>';
            sumBox.innerHTML = '';
            return;
          }
          const rows = vcmpRows(name, ov, nv);
          diffBox.innerHTML = vcmpDiffHtml(rows, ov, nv);
          sumBox.innerHTML = vcmpSummaryHtml(rows, ov, nv);
        }
        selO.addEventListener('change', render);
        selN.addEventListener('change', render);
        render();

        root.querySelector('#vcmp-export').addEventListener('click', function () {
          const ov = selO.value, nv = selN.value;
          window.showConfirm({
            title: '导出对比报告',
            desc: '将把 <strong>' + esc(ov) + ' → ' + esc(nv) + '</strong> 的差异明细导出为文本报告，确认继续？',
            okLabel: '导出',
            onOk: function () {
              const rows = vcmpRows(name, ov, nv);
              downloadText('版本对比_' + name + '_' + ov + '_' + nv + '.txt', vcmpReportText(name, ov, nv, rows));
              showToast('对比报告已导出（' + rows.length + ' 条差异）', 'success');
            }
          });
        });
        root.querySelector('#vcmp-sync').addEventListener('click', function () {
          const nv = selN.value;
          window.showConfirm({
            title: '同步至相关条款',
            desc: '把 <strong>' + esc(nv) + '</strong> 的变更内容同步到 3 条关联条款（7.2 / 7.4 / 6.4）的自评与佐证材料清单，确认继续？',
            okLabel: '确认同步',
            onOk: function () { showToast('版本差异已同步至 3 条关联条款，请相关自评人关注', 'success'); }
          });
        });
      }
    };
  },

  'version-approve': (c) => ({
    title: `版本审批 — ${c.name || 'SOP 样本接收与制备'} V4.0`,
    subtitle: '审核并批准新版本发布',
    size: 'modal-lg',
    body: `
      <div class="alert alert-warning">⚠ 该版本待审批，审批通过将自动发布并通知相关人员。</div>
      <div class="modal-section">
        <div class="modal-section-title">版本信息</div>
        <div class="desc-list">
          ${desc('文件名称', esc(c.name || 'SOP 样本接收与制备'))}
          ${desc('版本号', '<strong>V4.0</strong>')}
          ${desc('提交人', '周八')}
          ${desc('提交时间', '2026-09-05')}
          ${desc('变更类型', '修订换版')}
          ${desc('原版本', 'V3.0')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">变更说明</div>
        <div style="font-size:13px;line-height:1.9;background:var(--bg-page);padding:12px 14px;border-radius:6px;color:var(--text-secondary);">
          引入扫码验收流程，样本编号升级为 12 位含校验位编码，离心参数按样本类型差异化配置。已完成方法学验证，验证报告见附件。
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">审批意见</div>
        <div class="form-item">
          <label class="form-label">审批结论<span class="req">*</span></label>
          <div class="radio-group">
            <div class="radio-pill active" data-pill><span class="dotmark"></span>批准发布</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>退回修改</div>
            <div class="radio-pill" data-pill><span class="dotmark"></span>驳回</div>
          </div>
        </div>
        ${ta('审批意见', '填写审批意见（退回或驳回时必填）', '同意发布，请同步更新相关记录表格。')}
        ${inp('生效日期', '', '2026-09-15')}
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已批准，新版本 V4.0 已发布">提交审批</button>`
  }),

  'version-revise': (c) => ({
    title: `修订文件 — ${c.name || '程序文件 风险与机遇管理'}`,
    subtitle: '上传修订后的文件并说明变更内容',
    size: 'modal-lg',
    body: `
      <div class="alert alert-error">✗ 上一版本 V1.0 已被驳回，请根据驳回意见修订后重新提交。</div>
      <div class="modal-section">
        <div class="modal-section-title">驳回意见</div>
        <div style="font-size:13px;line-height:1.9;background:var(--error-bg);padding:12px 14px;border-radius:6px;color:#A81515;">
          风险识别方法描述不清晰，缺少风险等级判定准则；未明确风险监控的频次与责任人。请补充上述内容后重新提交。
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">上传修订文件</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:28px;text-align:center;cursor:pointer;" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:32px;">📤</div>
          <div style="font-size:13px;margin-top:8px;color:var(--text-secondary);">点击选择修订后的文件</div>
        </div>
      </div>
      <div class="modal-section">
        ${sel('新版本号', ['V1.1（小修订）', 'V2.0（大修订）'])}
        ${ta('修订说明', '说明本次修订的内容与对驳回意见的响应', '已补充风险等级判定准则（附录 B），明确各等级风险监控频次与责任人，修订第 4.2 与 5.3 章节。')}
      </div>`,
    footer: fConfirm('提交修订', '修订已提交，等待重新审批')
  }),

  'version-renew': (c) => ({
    title: `文件续期 — ${c.name || 'SOP 设施与环境监测'} V2.0`,
    subtitle: '该文件即将到期，请确认续期或换版',
    size: '',
    body: `
      <div class="alert alert-warning">⚠ 该文件将于 <strong>2026-10-01</strong> 到期，剩余 <strong>23 天</strong>。</div>
      <div class="modal-section">
        <div class="modal-section-title">续期方式</div>
        <div class="radio-group" style="flex-direction:column;align-items:stretch;">
          <div class="radio-pill active" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>直接续期（内容无变更，延长有效期 2 年）</div>
          <div class="radio-pill" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>修订后续期（需上传新版本）</div>
          <div class="radio-pill" data-pill style="justify-content:flex-start;"><span class="dotmark"></span>作废归档（文件不再使用）</div>
        </div>
      </div>
      <div class="modal-section">
        ${inp('新有效期至', '', '2028-10-01')}
        ${ta('续期说明', '说明续期理由', '经复核，文件内容仍适用，无需修订，申请延长有效期 2 年。')}
      </div>`,
    footer: fConfirm('确认续期', '文件已续期至 2028-10-01')
  }),

  /* ===== 新建版本（参照截图） ===== */
  'version-new': (c) => {
    const name = c.name || 'QM-001 质量手册';
    const code = c.code || 'QM-001';
    const curV = c.curVer || 'v5.0';
    const curDate = c.curDate || '2024-09-01';
    const suggestV = c.suggestVer || 'v5.1';
    return {
      title: '新建版本',
      subtitle: `${code} · ${name}`,
      size: 'modal-lg',
      body: `
        <div class="info-strip">
          <div class="info-tile">
            <div class="info-tile-label">当前版本 <span class="info-tile-tag">${curV}</span></div>
            <div class="info-tile-value">生效于 ${curDate}</div>
          </div>
          <div class="info-tile">
            <div class="info-tile-label">建议新版本号</div>
            <div class="info-tile-value" id="vm-suggest">${suggestV}</div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">变更类型<span class="req" style="color:var(--error);">*</span></div>
          <div class="radio-cards cols-3" id="vm-type">
            <label class="radio-card active" data-radio="minor">
              <div class="radio-card-head"><span class="radio-card-bullet"></span>次要修订</div>
              <div class="radio-card-desc">小范围内更新，版本号末位+1</div>
            </label>
            <label class="radio-card" data-radio="major">
              <div class="radio-card-head"><span class="radio-card-bullet"></span>重大修订</div>
              <div class="radio-card-desc">结构性修订，版本号主位+1</div>
            </label>
            <label class="radio-card" data-radio="fix">
              <div class="radio-card-head"><span class="radio-card-bullet"></span>纠正修订</div>
              <div class="radio-card-desc">因不符合整改触发的修订</div>
            </label>
          </div>
        </div>

        <div class="modal-section">
          <div class="form-row">
            <div class="form-item">
              <label class="form-label">版本号<span class="req" style="color:var(--error);">*</span></label>
              <input class="form-control" id="vm-ver" value="${suggestV}" />
              <div class="form-hint">依据变更类型自动生成，可在提交前修改</div>
            </div>
            <div class="form-item">
              <label class="form-label">计划生效日期</label>
              <input class="form-control" type="date" value="2026-09-08" />
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="form-item" style="margin-bottom:0;">
            <label class="form-label">变更说明<span class="req" style="color:var(--error);">*</span></label>
            <textarea class="form-control" id="vm-desc" rows="4" maxlength="500" placeholder="请详细描述本次版本变更的内容和原因，如：依据NCR-2024-003整改要求，修订了第5.2节中温度监控记录频率要求..."></textarea>
            <div class="char-count" id="vm-count">0 / 500 字</div>
          </div>
        </div>

        <div class="modal-section">
          <div class="form-item" style="margin-bottom:0;">
            <label class="form-label">审批人<span class="req" style="color:var(--error);">*</span></label>
            <select class="form-control">
              <option value="" disabled selected hidden>请选择审批人</option>
              <option>郑一 · 质量负责人</option>
              <option>陈二 · 技术负责人</option>
              <option>周八 · 文控员</option>
              <option>孙七 · 实验室主任</option>
            </select>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">上传新版本文件</div>
          <div class="dropzone" data-modal-close data-toast="已打开文件选择器">
            <div class="dropzone-icon">⇪</div>
            <div class="dropzone-text">点击选择文件或拖拽到此处</div>
            <div class="dropzone-hint">支持 .docx / .pdf，最大 50MB</div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">提交后审批流程</div>
          <div class="steps">
            <div class="step active"><div class="step-num">1</div><div class="step-label">提交申请</div></div>
            <div class="step-line"></div>
            <div class="step"><div class="step-num">2</div><div class="step-label">审批人审核</div></div>
            <div class="step-line"></div>
            <div class="step"><div class="step-num">3</div><div class="step-label">文控确认</div></div>
            <div class="step-line"></div>
            <div class="step"><div class="step-num">4</div><div class="step-label">正式生效</div></div>
          </div>
        </div>
      `,
      footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="vm-submit">📌 提交新版本审批</button>`,
      onMount: (root) => {
        const cards = root.querySelectorAll('#vm-type .radio-card');
        const verInput = root.querySelector('#vm-ver');
        const suggest = root.querySelector('#vm-suggest');
        const descTa = root.querySelector('#vm-desc');
        const counter = root.querySelector('#vm-count');
        const updateCnt = () => counter.textContent = `${descTa.value.length} / 500 字`;
        // 版本号生成映射
        const nextVer = (kind) => {
          const m = curV.match(/v?(\d+)\.(\d+)/i);
          if (!m) return suggestV;
          let major = +m[1], minor = +m[2];
          if (kind === 'major') return `v${major + 1}.0`;
          if (kind === 'fix') return `v${major}.${minor + 1}`;
          return `v${major}.${minor + 1}`; // minor
        };
        cards.forEach(card => {
          card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const kind = card.dataset.radio;
            const nv = nextVer(kind);
            verInput.value = nv;
            suggest.textContent = nv;
          });
        });
        descTa.addEventListener('input', updateCnt);
        updateCnt();
        root.querySelector('#vm-submit').addEventListener('click', () => {
          if (!descTa.value.trim()) { showToast('请填写变更说明', 'error'); descTa.focus(); return; }
          closeModal();
          showToast('新版本已提交，进入审批流程', 'success');
        });
      }
    };
  },

  /* ===== 报告 ===== */
  'report-preview': (c) => ({
    title: `报告预览 — ${c.name || 'CNAS 迎检自评报告'}`,
    subtitle: '预览报告完整内容，确认无误后导出',
    size: 'modal-xl',
    body: `
      <div class="report-preview">
        <h1>生物样本库 CNAS 迎检自评报告</h1>
        <div class="rp-meta">报告编号：CNAS-SAR-2026-001 ｜ 生成日期：2026-09-08 ｜ 版本：V1.0</div>

        <h2>一、概述</h2>
        <p>本报告依据 ISO 20387《生物样本库质量和能力要求》及 CNAS-CL05 相关要求，对样本库质量管理体系的运行情况开展全面自评。自评覆盖管理要求 13 个条款、技术要求 17 个条款，合计 30 个条款。</p>
        <p>本次自评自 2026 年 9 月 1 日启动，至 2026 年 9 月 8 日完成，由质量负责人牵头，各要素负责人与内审员共同参与。</p>

        <h2>二、自评结果汇总</h2>
        <table>
          <thead><tr><th>类别</th><th>条款数</th><th>符合</th><th>部分符合</th><th>不符合</th><th>完成率</th></tr></thead>
          <tbody>
            <tr><td>管理要求</td><td>13</td><td>7</td><td>4</td><td>0</td><td>54%</td></tr>
            <tr><td>技术要求</td><td>17</td><td>4</td><td>6</td><td>1</td><td>24%</td></tr>
            <tr><td><strong>合计</strong></td><td><strong>30</strong></td><td><strong>11</strong></td><td><strong>10</strong></td><td><strong>1</strong></td><td><strong>37%</strong></td></tr>
          </tbody>
        </table>

        <h2>三、不符合项及整改</h2>
        <p>本次自评共发现不符合项 1 项，涉及条款 6.2 人员。主要问题：3 名关键技术人员的技术档案中缺少授权文件与能力监控记录。已制定整改计划，责任人孙七，计划完成日期 2026 年 10 月 15 日。</p>

        <h2>四、改进建议</h2>
        <p>1. 加快技术要求部分的自评进度，重点关注 6.4 设备、6.5 计量溯源性等尚未启动的条款；<br/>
        2. 完善人员技术档案管理，建立常态化的能力监控机制；<br/>
        3. 加强佐证材料的规范化归档，确保每条条款均有完整的证据链支撑。</p>

        <h2>五、结论</h2>
        <p>样本库质量管理体系整体运行有效，符合 ISO 20387 的基本要求。针对发现的不符合项与部分符合项，应按计划完成整改与完善，确保在正式评审前达到全部符合。</p>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="正在导出 Word">导出 Word</button><button class="btn btn-primary" data-modal-close data-toast="正在导出 PDF">导出 PDF</button>`
  }),

  /* ===== 待审核版本列表（管理员专属：点击"待审核版本"卡片后进入） ===== */
  'version-pending-review': () => ({
    title: '待审核版本',
    subtitle: '下列 3 个版本正在等待您的审批，点击单项操作进入详细流程',
    size: 'modal-xl',
    body: `
      <div class="alert alert-info">💡 您当前以 <strong>质量管理员</strong> 身份登录，具备版本审批权限。可逐项审核，或使用底部按钮批量操作。</div>
      <div class="review-item">
        <div class="review-item-icon">📄</div>
        <div class="review-item-main">
          <div class="review-item-head">
            <span class="review-item-name">SOP - 样本接收与制备</span>
            <span class="review-item-ver">V4.0</span>
            <span class="tag tag-default">SOP</span>
            <span class="tag tag-warning">待审批</span>
          </div>
          <div class="review-item-meta">
            <span>👤 提交人 周八</span>
            <span>📅 2026-09-05 14:22</span>
            <span>📦 1.8 MB</span>
            <span>🔗 影响 4 个条款</span>
          </div>
          <div class="review-item-desc">依据 NCR-2024-003 整改要求，修订第 5.2 节中温度监控记录频率，新增扫码验收、含校验位编码与样本类型差异化离心参数。</div>
        </div>
        <div class="review-item-actions">
          <button class="btn btn-sm" data-action="version-detail" data-name="SOP - 样本接收与制备" data-ver="V4.0">预览</button>
          <button class="btn btn-sm" data-action="version-compare" data-name="SOP - 样本接收与制备" data-ver="V4.0">对比</button>
          <button class="btn btn-primary btn-sm" data-action="version-approve" data-name="SOP - 样本接收与制备" data-ver="V4.0">通过</button>
          <button class="btn btn-sm" style="color:var(--error);" data-action="version-revise" data-name="SOP - 样本接收与制备" data-ver="V4.0">驳回</button>
        </div>
      </div>

      <div class="review-item">
        <div class="review-item-icon">📊</div>
        <div class="review-item-main">
          <div class="review-item-head">
            <span class="review-item-name">记录表格 - 不符合项跟踪表</span>
            <span class="review-item-ver">V3.2</span>
            <span class="tag tag-default">表格</span>
            <span class="tag tag-warning">待审批</span>
          </div>
          <div class="review-item-meta">
            <span>👤 提交人 张三</span>
            <span>📅 2026-09-07 09:15</span>
            <span>📦 420 KB</span>
            <span>🔗 影响 2 个条款</span>
          </div>
          <div class="review-item-desc">新增"内审不符合项"、"外部评审不符合项"两个分类字段，调整状态枚举值，并补充整改证据附件上传说明。</div>
        </div>
        <div class="review-item-actions">
          <button class="btn btn-sm" data-action="version-detail" data-name="不符合项跟踪表" data-ver="V3.2">预览</button>
          <button class="btn btn-sm" data-action="version-compare" data-name="不符合项跟踪表" data-ver="V3.2">对比</button>
          <button class="btn btn-primary btn-sm" data-action="version-approve" data-name="不符合项跟踪表" data-ver="V3.2">通过</button>
          <button class="btn btn-sm" style="color:var(--error);" data-action="version-revise" data-name="不符合项跟踪表" data-ver="V3.2">驳回</button>
        </div>
      </div>

      <div class="review-item">
        <div class="review-item-icon">📑</div>
        <div class="review-item-main">
          <div class="review-item-head">
            <span class="review-item-name">程序文件 - 内部审核管理</span>
            <span class="review-item-ver">V2.0</span>
            <span class="tag tag-default">程序</span>
            <span class="tag tag-warning">待审批</span>
          </div>
          <div class="review-item-meta">
            <span>👤 提交人 孙七</span>
            <span>📅 2026-09-07 16:40</span>
            <span>📦 760 KB</span>
            <span>🔗 影响 3 个条款</span>
          </div>
          <div class="review-item-desc">依据 2026 内部审核结果调整内审频次为"每半年至少一次"，新增远程审核条款与电子档案归档要求。</div>
        </div>
        <div class="review-item-actions">
          <button class="btn btn-sm" data-action="version-detail" data-name="内部审核管理" data-ver="V2.0">预览</button>
          <button class="btn btn-sm" data-action="version-compare" data-name="内部审核管理" data-ver="V2.0">对比</button>
          <button class="btn btn-primary btn-sm" data-action="version-approve" data-name="内部审核管理" data-ver="V2.0">通过</button>
          <button class="btn btn-sm" style="color:var(--error);" data-action="version-revise" data-name="内部审核管理" data-ver="V2.0">驳回</button>
        </div>
      </div>
    `,
    footer: `
      <button class="btn" data-modal-close data-toast="全部 3 项已驳回，提交人将收到通知">全部驳回</button>
      <button class="btn" data-modal-close data-toast="已批量通过，全部版本已发布">批量通过</button>
      <button class="btn btn-primary" data-modal-close data-toast="已加入审批中心，稍后继续处理">稍后处理</button>
    `
  }),

  'report-new': () => ({
    title: '新建报告',
    subtitle: '选择模板与数据范围，系统将自动生成报告',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">报告信息</div>
        ${inp('报告名称', '', '2026 年度 CNAS 迎检自评报告')}
        <div class="form-row">
          ${sel('报告模板', ['自评报告（标准版）', '迎检汇报（简版）', '整改报告', '不符合项分析报告', '年度质量报告'])}
          ${sel('数据范围', ['全部条款（30）', '管理要求（13）', '技术要求（17）', '自定义选择'])}
        </div>
        <div class="form-row">
          ${inp('报告日期', '', '2026-09-08')}
          ${sel('编制人', ['质量管理员', '陈主管', '张三'])}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">内容模块</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">概述与自评依据</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">自评结果汇总表与图表</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">各条款自评详情</div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">不符合项及整改计划</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">佐证材料清单（附录）</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">上次评审整改情况回顾</div></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="报告生成中，请稍候">生成报告</button>`
  }),

  'report-template': () => ({
    title: '模板管理',
    subtitle: '管理报告模板，支持上传、编辑与设为默认',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">模板列表</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>模板名称</th><th>类型</th><th>更新人</th><th>更新时间</th><th>状态</th><th class="col-actions">操作</th></tr></thead>
          <tbody>
            <tr><td>自评报告（标准版）</td><td>Word</td><td>陈主管</td><td>2026-08-01</td><td><span class="tag tag-primary">默认</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="正在编辑模板">编辑</button></td></tr>
            <tr><td>迎检汇报（简版）</td><td>PPT</td><td>张三</td><td>2026-07-20</td><td><span class="tag tag-success">启用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="正在编辑模板">编辑</button></td></tr>
            <tr><td>整改报告</td><td>Word</td><td>孙七</td><td>2026-06-15</td><td><span class="tag tag-success">启用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="正在编辑模板">编辑</button></td></tr>
            <tr><td>不符合项分析报告</td><td>Excel</td><td>周八</td><td>2026-05-10</td><td><span class="tag tag-success">启用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="正在编辑模板">编辑</button></td></tr>
            <tr><td>年度质量报告</td><td>Word</td><td>陈主管</td><td>2026-03-02</td><td><span class="tag tag-default">停用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="模板已启用">启用</button></td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">上传新模板</div>
        <div style="border:1.5px dashed var(--border);border-radius:8px;padding:24px;text-align:center;cursor:pointer;" data-modal-close data-toast="已打开文件选择器">
          <div style="font-size:28px;">📤</div>
          <div style="font-size:13px;margin-top:6px;color:var(--text-secondary);">点击上传模板文件（支持 docx / pptx / xlsx）</div>
        </div>
        <div class="form-hint" style="margin-top:8px;">模板中使用 <code>{{条款}}</code>、<code>{{自评结果}}</code> 等占位符，系统将自动填充数据。</div>
      </div>`,
    footer: fClose()
  }),

  /* ===== 内审计划 ===== */
  'audit-plan-detail': (c) => ({
    title: '内审计划详情 — ' + (c.name || 'NA-2026-Q3-002 SOP 执行现场审核'),
    subtitle: '编制于 2026-08-28 ｜ 计划内审轮次 第二轮',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">计划编号</div><div class="info-tile-value">${esc(c.name || 'NA-2026-Q3-002')}</div></div>
        <div class="info-tile"><div class="info-tile-label">状态</div><div class="info-tile-value">进行中</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">基本信息</div>
        <div class="desc-list">
          ${desc('审核主题', esc(c.name || 'SOP 执行现场审核'))}
          ${desc('审核范围', '样本接收、制备、存储 SOP 程序执行情况')}
          ${desc('审核准则', 'ISO 20387 / CNAS-CL05 / 实验室 SOP 文件')}
          ${desc('审核组', '周八（组长）、孙七、王五')}
          ${desc('计划日期', '2026.10.15 ~ 2026.10.17')}
          ${desc('条款覆盖', '6.2 / 7.2 / 7.4 共 8 条条款')}
          ${desc('编制人', '郑一')}
          ${desc('审批人', '质量主管（已审批）')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📋 审核日程</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">10.15 09:00</div><div class="tl-title">首次会议 · 全员</div><div class="tl-desc">审核组长宣读审核计划、确认范围</div></div>
          <div class="tl-item"><div class="tl-time">10.15 ~ 10.16</div><div class="tl-title">现场审核 · 抽样 5 个环节</div><div class="tl-desc">样本接收 / 制备 / 存储 / 分发 / 销毁 SOP 执行</div></div>
          <div class="tl-item"><div class="tl-time">10.17 09:00</div><div class="tl-title">不符合项沟通</div><div class="tl-desc">审核组与责任人面对面确认发现</div></div>
          <div class="tl-item"><div class="tl-time">10.17 15:00</div><div class="tl-title">末次会议 · 报告初稿</div><div class="tl-desc">宣读审核发现与结论</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📊 本轮关联不符合项</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>编号</th><th>条款</th><th>描述</th><th>严重程度</th></tr></thead>
          <tbody>
            <tr><td>NC-2026-007</td><td>6.2 人员</td><td>2 名实验人员未完成 ISO 20387 基础培训</td><td><span class="tag tag-error">严重</span></td></tr>
            <tr><td>NC-2026-006</td><td>6.4 风险</td><td>公正性风险识别未覆盖新增项目</td><td><span class="tag tag-warning">一般</span></td></tr>
            <tr><td>NC-2026-005</td><td>7.4 数据</td><td>样本数据导出未做脱敏</td><td><span class="tag tag-error">严重</span></td></tr>
          </tbody>
        </table></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="正在导出 PDF">导出 PDF</button><button class="btn btn-primary" data-modal-close data-toast="已切换至对应页面">查看不符合项</button>`
  }),

  'audit-plan-new': (c) => ({
    title: '新建内审计划',
    subtitle: '依据 ISO 20387 编制内审计划，提交后自动流转至审批环节',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">基本信息</div>
        <div class="form-row">
          ${inp('计划编号', '例如：NA-2026-Q4-005', '')}
          ${sel('计划类型', ['年度内审', '专项内审', '跟进内审', '预审'])}
        </div>
        ${inp('审核主题', '例如：质量手册执行情况审核', '')}
        ${sel('审核范围', ['全部管理要求', '全部技术要求', '6.1 ~ 6.5 管理要求', '7.1 ~ 7.5 技术要求', '自定义范围'])}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📋 审核组与日期</div>
        <div class="form-row">
          ${inp('审核组长', '选自人员花名册', '周八')}
          ${inp('组员（多人请用逗号分隔）', '', '孙七、王五')}
        </div>
        <div class="form-row">
          ${inp('开始日期', '', '2026-12-08')}
          ${inp('结束日期', '', '2026-12-10')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📑 审核准则与参考</div>
        ${inp('审核准则', '多准则用逗号分隔', 'ISO 20387, CNAS-CL05, 实验室内部 SOP')}
        ${ta('说明备注', '说明本次审核的特殊背景、重点关注事项', '作为年度内审计划内的第三次内审，重点关注设施与环境条款（7.2）的执行落实情况。')}
      </div>
      <div class="alert alert-info">💡 系统将根据"审核范围"自动推荐对应的条款条目和检查清单</div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已提交审批，审批人将收到通知">提交审批</button>`
  }),

  /* ===== 不符合项 ===== */
  'audit-nc-detail': (c) => ({
    title: '不符合项详情 — ' + (c.name || 'NC-2026-007'),
    subtitle: '发现于 NA-2026-Q3-002 第二轮内审',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">编号</div><div class="info-tile-value">${esc(c.name || 'NC-2026-007')}</div></div>
        <div class="info-tile"><div class="info-tile-label">状态</div><div class="info-tile-value">逾期 3 天</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">基本信息</div>
        <div class="desc-list">
          ${desc('条款对照', '6.2 人员 — 能力要求')}
          ${desc('内审轮次', 'NA-2026-Q3-002')}
          ${desc('严重程度', '严重')}
          ${desc('发现日期', '2026-09-05')}
          ${desc('发现人', '周八')}
          ${desc('责任人', '陈二')}
          ${desc('整改期限', '2026-09-30（已逾期 3 天）')}
          ${desc('当前状态', '整改中（30%）')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">不符合描述与证据</div>
        <div class="alert alert-warning">2 名实验人员上岗前未完成 ISO 20387 基础培训，也未参加公正性培训。</div>
        <p style="margin:6px 0; color:var(--text-secondary);">现场核查人员培训档案时发现：王某某、张某某于 2026.07 进入实验室，岗位为样本制备员，但未见任何 ISO 20387 基础培训记录、公正性培训记录及考核合格证书。</p>
        ${desc('现场证据', '培训签到表（缺）、岗位资质核查表')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📝 关联整改任务</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>整改编号</th><th>整改措施</th><th>责任人</th><th>进度</th></tr></thead>
          <tbody>
            <tr><td>AC-2026-007</td><td>组织 2 名实验人员完成 ISO 20387 基础培训并考核</td><td>陈二</td><td><span class="tag tag-error">30%</span></td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">🗂 沟通与延期记录</div>
        <div class="timeline">
          <div class="tl-item"><div class="tl-time">2026-09-05</div><div class="tl-title">内审组确认不符合项</div><div class="tl-desc">周八提交 NC-2026-007，责任人陈二</div></div>
          <div class="tl-item"><div class="tl-time">2026-09-08</div><div class="tl-title">整改计划制定</div><div class="tl-desc">陈二 制定整改措施 AC-2026-007</div></div>
          <div class="tl-item warn"><div class="tl-time">2026-09-30</div><div class="tl-title">整改期限到达</div><div class="tl-desc">未按期提交整改证据</div></div>
          <div class="tl-item warn"><div class="tl-time">2026-10-03</div><div class="tl-title">⚠ 系统自动升级</div><div class="tl-desc">已通知质量主管郑一</div></div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已发起整改任务">发起整改</button><button class="btn btn-primary" data-modal-close data-toast="已升级至质量主管">升级处理</button>`
  }),

  'audit-nc-new': () => ({
    title: '登记新不符合项',
    subtitle: '从内审发现或日常监督中发现，按条款对照登记',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">不符合项内容</div>
        ${inp('编号', '系统自动生成或手动指定', 'NC-2026-008')}
        ${ta('不符合描述', '说明现场发现的不符合事实，含证据', '')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">条款与分类</div>
        <div class="form-row">
          ${sel('所属条款', ['6.1 组织架构', '6.2 人员能力', '6.3 设施环境', '6.4 风险', '6.5 公正性', '7.1 质量方针', '7.2 设施', '7.3 设备', '7.4 数据', '7.5 报告'])}
          ${sel('严重程度', ['严重', '一般', '观察'])}
        </div>
        <div class="form-row">
          ${inp('发现人', '', '周八')}
          ${sel('所属内审', ['NA-2026-Q1-001', 'NA-2026-Q3-002', 'NA-2026-Q4-003', 'NA-2026-Q4-004', '专项内审', '日常监督'])}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📝 分配与整改</div>
        <div class="form-row">
          ${inp('责任人', '', '陈二')}
          ${inp('整改期限', '', '2026-10-30')}
        </div>
        ${ta('初判整改措施', '', '')}
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn" data-modal-close data-toast="已保存为草稿">保存草稿</button><button class="btn btn-primary" data-modal-close data-toast="已登记，已通知责任人">登记并通知</button>`
  }),

  /* ===== 整改管理 ===== */
  'audit-correct-new': () => ({
    title: '制定整改计划',
    subtitle: '将不符合项分解为可执行任务，分配责任人',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">关联不符合项</div>
        ${sel('选择不符合项', ['NC-2026-007（6.2 人员-严重）', 'NC-2026-006（6.4 风险-一般）', 'NC-2026-005（7.4 数据-严重）', 'NC-2026-003（7.2 设施-一般）', '新建不符合项'])}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">整改措施</div>
        ${inp('整改编号', '', 'AC-2026-008')}
        ${ta('整改措施描述', '详细说明将通过什么方式解决该不符合项', '')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">负责人与时间</div>
        <div class="form-row">
          ${inp('责任人', '', '陈二')}
          ${sel('优先级', ['紧急', '高', '中', '低'])}
        </div>
        <div class="form-row">
          ${inp('开始日期', '', '2026-09-09')}
          ${inp('完成期限', '', '2026-10-30')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">验证安排</div>
        ${inp('验证人', '', '郑一（质量主管）')}
      </div>
      <div class="alert alert-info">系统将在到期前 7 / 3 / 1 天分别推送提醒至责任人</div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="整改计划已下达">下达计划</button>`
  }),

  'audit-correct-edit': (c) => ({
    title: '编辑整改任务 — ' + (c.name || 'AC-2026-007'),
    subtitle: '可编辑措施描述、责任人、期限',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">编号</div><div class="info-tile-value">${esc(c.name || 'AC-2026-007')}</div></div>
        <div class="info-tile"><div class="info-tile-label">关联不符合项</div><div class="info-tile-value">NC-2026-007</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📝 整改措施</div>
        ${ta('整改措施', '', '组织 2 名实验人员参加 ISO 20387 基础培训与考核；补录公正性培训记录；归档考核合格证书；本月内完成。')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">👥 责任人 / 期限</div>
        <div class="form-row">
          ${inp('责任人', '', '陈二')}
          ${sel('优先级', ['紧急', '高', '中', '低'])}
        </div>
        <div class="form-row">
          ${inp('完成期限', '', '2026-09-30')}
          ${sel('状态', ['整改中', '待验证', '已闭环'])}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📊 进度记录</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-09-08</div><div class="tl-title">已下发培训通知</div><div class="tl-desc">王某某、张某某确认参加培训</div></div>
          <div class="tl-item"><div class="tl-time">2026-09-15</div><div class="tl-title">预定培训场地与讲师</div><div class="tl-desc">外部讲师邀请中</div></div>
          <div class="tl-item warn"><div class="tl-time">2026-09-30</div><div class="tl-title">⚠ 截止日期</div><div class="tl-desc">需完成培训并归档考核记录</div></div>
        </div>
      </div>
      <div class="form-hint">本次修改将留下审计日志，确保过程可追溯。</div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已保存，通知责任人">保存</button>`
  }),

  'audit-correct-track': (c) => ({
    title: '整改跟踪 — ' + (c.name || 'AC-2026-007'),
    subtitle: '查看整改全过程时间轴',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">整改进度</div><div class="info-tile-value">30%</div></div>
        <div class="info-tile"><div class="info-tile-label">距期限</div><div class="info-tile-value" style="color:var(--error);">逾期 3 天</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📍 整改记录</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-09-05 17:23</div><div class="tl-title">不符合项 NC-2026-007 登记</div><div class="tl-desc">由周八 提交，质量组分配至陈二</div></div>
          <div class="tl-item done"><div class="tl-time">2026-09-08 10:15</div><div class="tl-title">陈二 制定整改计划 AC-2026-007</div><div class="tl-desc">明确 2 名实验人员培训计划与时间</div></div>
          <div class="tl-item done"><div class="tl-time">2026-09-12</div><div class="tl-title">下发培训通知、约定场次</div><div class="tl-desc">王某某、张某某 已确认报名</div></div>
          <div class="tl-item"><div class="tl-time">2026-09-22</div><div class="tl-title">预订外部讲师</div><div class="tl-desc">预计 9.25 完成讲师确认</div></div>
          <div class="tl-item warn"><div class="tl-time">2026-09-30</div><div class="tl-title">⚠ 整改截止</div><div class="tl-desc">培训执行中但尚未完成考核归档</div></div>
          <div class="tl-item warn"><div class="tl-time">2026-10-03</div><div class="tl-title">系统自动升级</div><div class="tl-desc">已通知质量主管郑一</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">💬 沟通记录</div>
        <ul style="margin:0; padding-left:18px; color:var(--text-secondary); font-size:13px; line-height:1.9;">
          <li>郑一：要求在 10.10 前完成所有培训与考核归档</li>
          <li>陈二：申请部分整改延期至 10.15</li>
          <li>周八（内审）：同意延期至 10.15</li>
        </ul>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已请求延期批准">请求延期</button><button class="btn btn-primary" data-modal-close data-toast="已提交整改证据，请验证">提交整改证据</button>`
  }),

  'audit-correct-verify': () => ({
    title: '整改验证',
    subtitle: '对已完成整改的措施进行现场验证',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">整改编号</div><div class="info-tile-value">AC-2026-004</div></div>
        <div class="info-tile"><div class="info-tile-label">已完成期限</div><div class="info-tile-value">2026-09-10</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📝 整改证据</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">质控员资格证书扫描件.pdf</div><div class="file-sub">1.2 MB · 2026-09-08 上传</div></div><button class="btn btn-sm" data-modal-close data-toast="已打开预览">预览</button></div>
        <div class="file-card"><div class="file-icon">📊</div><div class="file-meta"><div class="file-name">复证完成确认单.docx</div><div class="file-sub">86 KB · 2026-09-10 上传</div></div><button class="btn btn-sm" data-modal-close data-toast="已打开预览">预览</button></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">✅ 验证结论</div>
        <div class="radio-group">
          <div class="radio-pill active"><span class="dotmark"></span>有效，闭环</div>
          <div class="radio-pill"><span class="dotmark"></span>部分有效，需补充</div>
          <div class="radio-pill"><span class="dotmark"></span>无效，重新整改</div>
        </div>
        ${ta('验证备注', '', '已现场确认王某某 完成 2026 年度 ISO 20387 复训及考核，证书有效期至 2027.09，材料已归档为受控文件。')}
        <div class="form-hint">验证结论将记入内审报告与不符合项台账，自动同步条款符合性统计。</div>
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="验证通过，整改闭环">确认闭环</button>`
  }),

  /* ===== 内审报告 ===== */
  'audit-report-preview': () => ({
    title: '内审报告预览 — IR-2026-Q1-001',
    subtitle: '内部审核报告标准版',
    size: 'modal-xl',
    body: `
      <div class="report-preview">
        <h1>内部审核报告</h1>
        <div class="rp-meta">报告编号：IR-2026-Q1-001 ｜ 编制日期：2026-03-25 ｜ 版本：V1.0</div>

        <h2>一、审核概况</h2>
        <p>本次内审为 2026 年第一季度内审活动，依据 ISO 20387《生物样本库质量和能力要求》及 CNAS-CL05 相关准则，对样本库质量管理体系的运行情况进行全面审核，覆盖管理要求与技术要求共 30 个条款。</p>
        <table>
          <tbody>
            <tr><th style="width:110px;">审核范围</th><td>质量手册及 18 份程序文件</td></tr>
            <tr><th>审核组</th><td>组长陈二，组员张三、李四</td></tr>
            <tr><th>审核日期</th><td>2026 年 3 月 18 日 ~ 3 月 20 日</td></tr>
            <tr><th>审核依据</th><td>ISO 20387 / CNAS-CL05 / 实验室内部 SOP</td></tr>
          </tbody>
        </table>

        <h2>二、审核发现</h2>
        <p>本次审核共发现 3 项不符合项，其中一般不符合 2 项、观察项 1 项。条款分布如下：</p>
        <table>
          <thead><tr><th>编号</th><th>条款</th><th>描述</th><th>级别</th></tr></thead>
          <tbody>
            <tr><td>NC-2026-001</td><td>7.3 设备</td><td>移液器校准周期与 SOP 不一致</td><td>观察</td></tr>
            <tr><td>NC-2026-002</td><td>6.5 公正性</td><td>外部供应商评估表未签字</td><td>观察</td></tr>
          </tbody>
        </table>

        <h2>三、审核结论</h2>
        <p>样本库质量管理体系运行基本有效，符合 ISO 20387 与 CNAS-CL05 的相关要求。建议对已识别的 3 项不符合项按计划整改，并在下次内审中跟进验证其有效性。体系符合性较上一周期提升 8%。</p>

        <h2>四、签发</h2>
        <table>
          <tbody>
            <tr><th style="width:110px;">审核组长</th><td>陈二（已签发）</td></tr>
            <tr><th>质量主管</th><td>郑一（已签发）</td></tr>
            <tr><th>签发日期</th><td>2026-04-02</td></tr>
          </tbody>
        </table>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="正在导出 Word">📤 导出 Word</button><button class="btn" data-modal-close data-toast="正在导出 PDF">📤 导出 PDF</button><button class="btn btn-primary" data-modal-close data-toast="已通过系统通知发送至管理层">📩 系统通知</button>`
  }),

  'audit-report-new': () => ({
    title: '新建内审报告',
    subtitle: '关联审核计划，系统预填大部分字段',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">📋 关联与基本信息</div>
        ${sel('关联内审计划', ['NA-2026-Q3-002 SOP 执行现场审核', 'NA-2026-Q4-003 环境与设备管理', 'NA-2026-Q4-004 管理评审输入整理'])}
        ${sel('报告模板', ['标准内审报告', '详细内审报告（含证据链）', '摘要内审报告'])}
        <div class="form-row">
          ${inp('报告编号', '系统自动生成', 'IR-2026-Q3-002')}
          ${inp('编制人', '', '周八')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📊 报告要素预填</div>
        <div class="desc-list">
          ${desc('审核范围', '样本接收、制备、存储 SOP 程序执行情况')}
          ${desc('审核组', '周八、孙七、王五')}
          ${desc('审核日期', '2026.10.15 ~ 2026.10.17')}
          ${desc('不符合项总数', '3 项（严重 1 / 一般 2）')}
        </div>
      </div>
      <div class="alert alert-info">💡 选择报告模板后，系统将自动套入内审计划的所有字段，您只需补充结论与签发部分</div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已创建，预填完成，请前往编辑">套用模板创建</button>`
  }),

  'audit-report-template': () => ({
    title: '内审报告模板管理',
    subtitle: '新建、编辑、设默认',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">📑 当前模板</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>模板名</th><th>格式</th><th>更新人</th><th>更新时间</th><th>状态</th><th class="col-actions">操作</th></tr></thead>
          <tbody>
            <tr><td>标准内审报告</td><td>Word</td><td>陈二</td><td>2026-02-15</td><td><span class="tag tag-primary">默认</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="编辑中">编辑</button><button class="btn-text" data-modal-close data-toast="复制">复制</button></td></tr>
            <tr><td>详细内审报告（含证据链）</td><td>Word + 附件</td><td>郑一</td><td>2026-01-20</td><td><span class="tag tag-success">启用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="编辑中">编辑</button><button class="btn-text" data-modal-close data-toast="已设为默认">设为默认</button></td></tr>
            <tr><td>摘要内审报告</td><td>PDF</td><td>孙七</td><td>2025-12-08</td><td><span class="tag tag-success">启用</span></td><td class="col-actions"><button class="btn-text" data-modal-close data-toast="编辑中">编辑</button><button class="btn-text" data-modal-close data-toast="已设为默认">设为默认</button></td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📤 上传新模板</div>
        <div class="dropzone">
          <div class="dropzone-icon">📎</div>
          <div class="dropzone-text">点击或拖拽上传模板文件（支持 docx / dotx）</div>
          <div class="dropzone-hint">建议预置 <code>{{条款}}</code>、<code>{{不符合描述}}</code>、<code>{{审核结论}}</code> 等占位符</div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn btn-primary" data-modal-close data-toast="已上传至模板库">上传模板</button>`
  }),

  /* ===== 内审材料库 ===== */
  'audit-files-detail': (c) => ({
    title: '受控文件详情 — ' + (c.name || 'AD-NQ-001 内部审核检查表'),
    subtitle: '检查表 / 受控 / V2.1',
    size: 'modal-lg',
    body: `
      <div class="info-strip">
        <div class="info-tile"><div class="info-tile-label">编号</div><div class="info-tile-value">${esc(c.name || 'AD-NQ-001')}</div></div>
        <div class="info-tile"><div class="info-tile-label">受控状态</div><div class="info-tile-value" style="color:#0A7A1F;">受控</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📑 文件信息</div>
        <div class="desc-list">
          ${desc('文件名称', '内部审核检查表（程序文件）')}
          ${desc('所属类别', '检查表')}
          ${desc('关联内审', 'NA-2026-Q1-001')}
          ${desc('当前版本', 'V2.1')}
          ${desc('历史版本', '3 个版本')}
          ${desc('有效至', '2027-03-15')}
          ${desc('访问权限', '审核组 / 质量组')}
          ${desc('最近更新', '2026-03-15 by 陈二')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">🗂 版本变更记录</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-03-15</div><div class="tl-title">V2.1</div><div class="tl-desc">新增"公正性"专项检查项（陈二）</div></div>
          <div class="tl-item"><div class="tl-time">2025-12-10</div><div class="tl-title">V2.0</div><div class="tl-desc">格式重构、二维化（陈二）</div></div>
          <div class="tl-item"><div class="tl-time">2025-06-22</div><div class="tl-title">V1.0</div><div class="tl-desc">初版发布（陈二）</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">📊 访问统计（近 30 天）</div>
        <div class="desc-list">
          ${desc('总访问', '47 次')}
          ${desc('下载', '12 次')}
          ${desc('预览', '35 次')}
          ${desc('最热时段', '周一上午 10:00')}
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已下载 V2.1">下载当前版本</button><button class="btn" data-modal-close data-toast="已上传新版本待审批">📤 上传新版本</button><button class="btn btn-primary" data-modal-close data-toast="已发送查阅申请">申请查阅</button>`
  }),

  'audit-files-upload': () => ({
    title: '上传内审材料',
    subtitle: '支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件，系统将智能归类',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">📥 文件上传</div>
        <div class="dropzone">
          <div class="dropzone-icon">📎</div>
          <div class="dropzone-text">点击或拖拽上传，支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件</div>
          <div class="dropzone-hint">上传后将自动 OCR 并按内容 + 文件名双因子识别</div>
        </div>
      </div>
      <div class="modal-section" id="upload-queue">
        <div class="modal-section-title">📋 上传队列</div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">公正性风险识别记录表.xlsx</div><div class="file-sub">86 KB · 64%</div><div style="height:4px; background:var(--bg-disabled); border-radius:2px; margin-top:4px; overflow:hidden;"><div style="width:64%; height:100%; background:var(--primary);"></div></div></div><button class="btn btn-sm" data-modal-close data-toast="已取消">取消</button></div>
        <div class="file-card"><div class="file-icon">📄</div><div class="file-meta"><div class="file-name">二季度内审首次会议签到.docx</div><div class="file-sub">240 KB · 已识别 ✓</div></div><button class="btn btn-sm" data-modal-close data-toast="已归类为'首末次会议记录'">归类</button></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">🗂 自动归类建议</div>
        <div class="alert alert-info">系统识别到 2 份文件，建议归类为「首末次会议记录」「抽样单」。您可手动调整。</div>
        <div class="form-row">
          ${sel('指定类别', ['请选择类别', '检查表', '首末次会议记录', '抽样单', '不符合报告', '整改单'])}
          ${sel('受控状态', ['受控', '参考', '作废'])}
        </div>
        ${inp('关联内审计划', 'NA-2026-XXX', 'NA-2026-Q3-002')}
        ${ta('备注', '', '')}
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button><button class="btn btn-primary" data-modal-close data-toast="已上传，归类完成">上传并归档</button>`
  }),

  'audit-files-history': (c) => ({
    title: '历史版本 — ' + (c.name || 'AD-NQ-001'),
    subtitle: '查看所有历史版本，支持对比与回滚',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">🗂 版本时间轴</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-03-15</div><div class="tl-title">V2.1 · 当前</div><div class="tl-desc">新增"公正性"专项检查项（陈二）</div></div>
          <div class="tl-item"><div class="tl-time">2025-12-10</div><div class="tl-title">V2.0</div><div class="tl-desc">格式重构、二维化（陈二）</div></div>
          <div class="tl-item"><div class="tl-time">2025-08-02</div><div class="tl-title">V1.2</div><div class="tl-desc">补充 6.4 风险章节（孙七）</div></div>
          <div class="tl-item"><div class="tl-time">2025-06-22</div><div class="tl-title">V1.0</div><div class="tl-desc">初版发布（陈二）</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">🔍 版本对比（V2.0 ↔ V2.1）</div>
        <div class="diff-wrap">
          <div class="diff-col old">
            <div class="diff-head">V2.0 · 2025-12-10</div>
            <div class="diff-line">1. 内部审核目标与范围</div>
            <div class="diff-line">2. 条款对照表（27 条）</div>
            <div class="diff-line">3. 抽样比例与周期</div>
            <div class="diff-line">4. 现场核查记录</div>
          </div>
          <div class="diff-col new">
            <div class="diff-head">V2.1 · 2026-03-15</div>
            <div class="diff-line">1. 内部审核目标与范围</div>
            <div class="diff-line">2. 条款对照表（30 条）</div>
            <div class="diff-line">3. 抽样比例与周期</div>
            <div class="diff-line"><ins>4. 公正性专项检查</ins></div>
            <div class="diff-line">5. 现场核查记录</div>
          </div>
        </div>
      </div>`,
    footer: `<button class="btn" data-modal-close>关闭</button><button class="btn" data-modal-close data-toast="已下载对比报告">导出对比</button><button class="btn btn-primary" data-modal-close data-toast="已回滚至选中版本">回滚到 V2.0</button>`
  }),

  /* ===== 生成中（loading → 完成） ===== */
  'report-generate': (c) => ({
    title: '生成报告',
    subtitle: '',
    size: '',
    loading: true,
    body: `
      <div class="loading-box">
        <div class="spinner"></div>
        <div class="loading-text" id="gen-text">正在汇总自评数据…</div>
        <div class="progress" style="margin:18px 40px 0;"><div class="progress-bar" id="gen-bar" style="width:0%"></div></div>
      </div>`,
    footer: `<button class="btn" data-modal-close>取消</button>`,
    onMount: function (root) {
      const steps = ['正在汇总自评数据…', '正在匹配佐证材料…', '正在生成结果图表…', '正在套用报告模板…', '正在排版与校对…'];
      const bar = root.querySelector('#gen-bar');
      const txt = root.querySelector('#gen-text');
      let i = 0;
      const timer = setInterval(function () {
        i++;
        if (i < steps.length) {
          txt.textContent = steps[i];
          if (bar) bar.style.width = (i / steps.length * 100) + '%';
        } else {
          clearInterval(timer);
          if (bar) bar.style.width = '100%';
          txt.textContent = '报告生成完成！';
          showToast('报告已生成，可在「历史报告」中查看', 'success');
          setTimeout(function () { closeModal(); }, 900);
        }
      }, 620);
    }
  }),

  /* ===== 通用设置 ===== */
  'cycle-setting': () => ({
    title: '评审周期设置',
    subtitle: '配置当前评审周期的关键节点',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">周期信息</div>
        ${inp('评审周期名称', '', '2026 年度 CNAS 复评审')}
        <div class="form-row">
          ${sel('评审类型', ['初次评审', '复评审', '监督评审', '扩项评审'])}
          ${sel('评审标准', ['ISO 20387:2018', 'ISO 15189:2022', 'ISO 17025:2017'])}
        </div>
        <div class="form-row">
          ${inp('启动日期', '', '2026-09-01')}
          ${inp('预计评审日期', '', '2026-12-20')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">关键节点</div>
        <div class="timeline">
          <div class="tl-item done"><div class="tl-time">2026-09-01</div><div class="tl-title">自评启动</div><div class="tl-desc">已完成</div></div>
          <div class="tl-item"><div class="tl-time">2026-11-30</div><div class="tl-title">自评完成</div><div class="tl-desc">全部条款自评提交完毕</div></div>
          <div class="tl-item"><div class="tl-time">2026-12-10</div><div class="tl-title">整改关闭</div><div class="tl-desc">不符合项整改验证完成</div></div>
          <div class="tl-item"><div class="tl-time">2026-12-20</div><div class="tl-title">正式评审</div><div class="tl-desc">CNAS 评审组现场评审</div></div>
        </div>
      </div>`,
    footer: fSave()
  }),

  'system-setting': () => ({
    title: '设置',
    subtitle: '配置迎检模块的提醒、权限与自动化规则',
    size: 'modal-lg',
    body: `
      <div class="modal-section">
        <div class="modal-section-title">提醒设置</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">任务截止前 3 天提醒负责人<div class="check-item-note">系统通知</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">自评提交后通知复核人</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">每周一推送迎检进度周报</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">自动化规则</div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">上传材料后自动智能归类<div class="check-item-note">基于内容匹配条款，置信度低于 80% 时提示人工确认</div></div></div>
        <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">自评为「不符合」时自动创建整改任务</div></div>
        <div class="check-item"><div class="checkbox"></div><div class="check-item-text">文件版本更新后自动提醒关联条款负责人</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">权限设置</div>
        <div class="form-row">
          ${sel('自评提交权限', ['仅负责人与自评人', '全体质量管理员', '全体成员'])}
          ${sel('材料可见范围', ['全部成员', '仅相关条款人员', '仅管理员'])}
        </div>
      </div>`,
    footer: fSave()
  }),

  /* ======================================================================
     佐证材料 · 详情 —— 真实可操作（不是文字规格）
     预览可翻页缩放、版本可上传新版本、核验可通过/退回（带理由）、
     关联条款可增删、备注可保存、下载会真的产出文件、移出归档带确认。
     每个动作都真实改写 window.EVIDENCE → 归档页 / 条款自评页同步变化。
     ====================================================================== */
  'evidence-detail': (c) => {
    var E = window.EVIDENCE;
    if (!E) return { toastOnly: true, toastMsg: '材料数据未加载' };
    var m = E.byId(c.id);
    if (!m) return { toastOnly: true, toastMsg: '未找到该材料，可能已被移出归档' };
    var st = { tab: 'info', page: 1, zoom: 1, reject: false, clauseQ: '' };
    return {
      title: '材料详情 — ' + m.name,
      subtitle: esc(m.id) + '　·　' + esc((E.CAT_BY[m.cat] || {}).label || m.cat) + '　·　' + esc(m.status),
      size: 'modal-xl',
      body: EVD.body(m, st),
      footer: `<button class="btn" data-modal-close>关闭</button>` +
        `<button class="btn" data-evd-act="remove">🗑 移出归档</button>` +
        `<button class="btn" data-evd-act="download">⬇ 下载</button>` +
        `<button class="btn btn-primary" data-evd-act="newver">📤 上传新版本</button>`,
      onMount: (root) => EVD.mount(root, c.id, st)
    };
  },

  /* ======================================================================
     佐证材料 · 上传（统一入口，归档页与条款自评页共用）
     ====================================================================== */
  'evidence-upload': (c) => {
    var E = window.EVIDENCE;
    if (!E) return { toastOnly: true, toastMsg: '材料数据未加载' };
    var batch = c.mode === 'batch';
    var preset = (window.CLAUSE_LIB && c.lib && window.CLAUSE_LIB.libs[c.lib] && c.cid) ? (c.lib + '|' + c.cid) : '';
    return {
      title: batch ? '批量导入材料' : '上传佐证材料',
      subtitle: c.clause ? ('归属条款 ' + esc(c.clause) + '　·　支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件')
        : '支持批量上传，系统将自动识别并推荐归档位置',
      size: 'modal-lg',
      body: `
        <div class="modal-section">
          <div class="modal-section-title">📤 选择文件</div>
          <div class="dropzone" id="evu-drop" style="cursor:pointer;">
            <div class="dropzone-icon">📎</div>
            <div class="dropzone-text">点击选择文件，或将文件拖拽到此处</div>
            <div class="dropzone-hint">支持 PDF / Word / Excel / JPG、PNG格式，单文件最大 50MB，单次不大于10个文件${batch ? '（批量导入）' : ''}</div>
          </div>
          <input type="file" id="evu-input" multiple style="display:none"
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" />
        </div>
        <div class="modal-section">
          <div class="modal-section-title">📋 待上传队列 <span class="tag tag-default" id="evu-count">0</span></div>
          <div id="evu-queue"><div class="sa-empty">暂无待上传文件</div></div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">⚙ 归档设置</div>
          <div class="form-row">
            <div class="form-item"><label class="form-label">要素分类</label>
              <select class="form-control" id="evu-cat">
                <option value="">自动识别（推荐）</option>
                ${(E.CATS || []).map((x) => `<option value="${x.k}">${x.label}</option>`).join('')}
              </select></div>
            <div class="form-item"><label class="form-label">归属条款</label>
              <select class="form-control" id="evu-clause">
                <option value="">自动识别（推荐）</option>
                ${clauseOptionsHtml(preset)}
              </select></div>
          </div>
          <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">上传后自动智能归类<div class="check-item-note">基于文件名与内容匹配条款，未达阈值时进入「待归类」</div></div></div>
          <div class="check-item"><div class="checkbox checked"></div><div class="check-item-text">上传后进入待复核队列<div class="check-item-note">核验通过后方可作为迎检证据</div></div></div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">🗂 已归档材料（最近 3 份）</div>
          <div>${recentMaterialsHtml(3)}</div>
        </div>`,
      footer: `<button class="btn" data-modal-close>取消</button>` +
        `<button class="btn btn-primary" id="evu-btn" disabled style="opacity:.5;cursor:not-allowed;">开始上传</button>`,
      onMount: (root) => mountEvidenceUpload(root)
    };
  },

  /* ======================================================================
     佐证材料 · 归类（待归类的人工确认归属）
     ====================================================================== */
  'evidence-classify': (c) => {
    var E = window.EVIDENCE;
    if (!E) return { toastOnly: true, toastMsg: '材料数据未加载' };
    var ids = c.bulk ? String(c.ids || '').split(',').filter(Boolean) : [c.id];
    var list = ids.map(function (id) { return E.byId(id); }).filter(Boolean);
    if (!list.length) return { toastOnly: true, toastMsg: '未找到待归类的材料' };

    var one = list.length === 1 ? list[0] : null;
    var g = one ? E.guess(one.name) : null;
    var hint = '';
    if (one) {
      if (g && g.clause) {
        hint = `<div class="alert alert-success">✓ 文件名命中条款「${esc(g.clause.id + ' ' + g.clause.name)}」，识别匹配度 <strong>${g.matched}%</strong>，建议直接采纳。</div>`;
      } else {
        hint = `<div class="alert alert-warning">⚠ 未从文件名识别出条款归属（匹配度 ${g ? g.matched : 0}%），请手动选择归档位置。</div>`;
      }
    } else {
      hint = `<div class="alert alert-info">💡 将对选中的 ${list.length} 份材料统一设置归档位置。</div>`;
    }

    var suggest = (g && g.clause) ? (g.clause.lib + '|' + g.clause.id) : '';

    return {
      title: '材料归类',
      subtitle: list.length === 1 ? esc(list[0].name) : ('批量归类 ' + list.length + ' 份材料'),
      size: 'modal-lg',
      body: `
        ${hint}
        <div class="modal-section">
          <div class="modal-section-title">待归类材料</div>
          ${list.slice(0, 6).map(function (m) {
            return `<div class="file-card"><div class="file-icon">${E.iconOf(m)}</div>` +
              `<div class="file-meta"><div class="file-name">${esc(m.name)}</div>` +
              `<div class="file-sub">${E.fmtSize(m.size)} · ${esc(m.uploader)} · 识别匹配度 ${m.matched}%</div></div>` +
              `<span class="tag tag-warning">待归类</span></div>`;
          }).join('')}
          ${list.length > 6 ? `<div class="evd-empty">另有 ${list.length - 6} 份材料…</div>` : ''}
        </div>
        <div class="modal-section">
          <div class="modal-section-title">归档位置</div>
          <div class="form-row">
            <div class="form-item"><label class="form-label">要素分类</label>
              <select class="form-control" id="evc-cat">
                ${(E.CATS || []).map(function (x) {
                  var on = one && x.k === (g ? g.cat : one.cat);
                  return `<option value="${x.k}"${on ? ' selected' : ''}>${x.icon} ${x.label}</option>`;
                }).join('')}
              </select></div>
            <div class="form-item"><label class="form-label">关联条款<span class="req">*</span></label>
              <select class="form-control" id="evc-clause">
                <option value="">请选择归属条款</option>
                ${clauseOptionsHtml(suggest)}
              </select></div>
          </div>
          <div class="form-item"><label class="form-label">标签</label>
            <div class="radio-group">
              <div class="radio-pill active" data-pill><span class="dotmark"></span>关键证据</div>
              <div class="radio-pill" data-pill><span class="dotmark"></span>补充材料</div>
              <div class="radio-pill" data-pill><span class="dotmark"></span>参考文件</div>
            </div>
          </div>
          <div class="form-item"><label class="form-label">备注说明</label>
            <textarea class="form-control" id="evc-note" placeholder="补充说明该材料的覆盖范围或取证用途">${esc(one ? one.note : '')}</textarea>
          </div>
        </div>`,
      footer: `<button class="btn" data-modal-close>取消</button>` +
        `<button class="btn btn-primary" id="evc-ok">确认归类</button>`,
      onMount: (root) => mountEvidenceClassify(root, list.map(function (m) { return m.id; }))
    };
  }
};

/* ==========================================================================
   佐证材料弹窗 — 公共片段与挂载逻辑
   ========================================================================== */

/* 条款下拉：两套标准库全部条款，按库分组。q 为可选关键字过滤（条款号或名称）。 */
function clauseOptionsHtml(selected, q) {
  var CL = window.CLAUSE_LIB;
  if (!CL) return '';
  var kw = (q || '').trim().toLowerCase();
  var out = '';
  var total = 0;
  ['iso20387', 'cl10'].forEach(function (lib) {
    if (!CL.libs[lib]) return;
    var list = (CL.get(lib) || []).filter(function (c) {
      return !kw || (c.id + ' ' + c.name).toLowerCase().indexOf(kw) >= 0;
    });
    if (!list.length) return;
    total += list.length;
    out += '<optgroup label="' + esc(CL.libs[lib].name) + '（' + list.length + '）">';
    list.forEach(function (c) {
      var v = lib + '|' + c.id;
      out += '<option value="' + v + '"' + (selected === v ? ' selected' : '') + '>' + esc(c.id + ' ' + c.name) + '</option>';
    });
    out += '</optgroup>';
  });
  return out || '<option value="" disabled>没有匹配「' + esc(q) + '」的条款</option>';
}

function recentMaterialsHtml(n) {
  var E = window.EVIDENCE;
  if (!E) return '';
  return E.getAll().slice().sort(function (a, b) { return b.time.localeCompare(a.time); }).slice(0, n).map(function (m) {
    var st = E.ST[m.status] || E.ST['已归档'];
    return '<div class="file-card"><div class="file-icon">' + E.iconOf(m) + '</div>' +
      '<div class="file-meta"><div class="file-name">' + esc(m.name) + '</div>' +
      '<div class="file-sub">' + E.fmtSize(m.size) + ' · ' + esc(m.version) + ' · ' + esc(m.uploader) + ' · ' + esc(m.time) + '</div></div>' +
      '<span class="tag ' + st.tag + '">' + esc(m.status) + '</span></div>';
  }).join('') || '<div class="sa-empty">暂无材料</div>';
}

/* ---------- 上传 ---------- */
function mountEvidenceUpload(root) {
  var E = window.EVIDENCE;
  var dz = root.querySelector('#evu-drop');
  var input = root.querySelector('#evu-input');
  var queueEl = root.querySelector('#evu-queue');
  var countEl = root.querySelector('#evu-count');
  var btn = root.querySelector('#evu-btn');
  var catSel = root.querySelector('#evu-cat');
  var clsSel = root.querySelector('#evu-clause');
  var queue = [];

  function resetBtn() {
    btn.textContent = '开始上传';
    btn.disabled = true;
    btn.style.opacity = '.5';
    btn.style.cursor = 'not-allowed';
  }

  function renderQueue() {
    countEl.textContent = queue.length;
    if (!queue.length) {
      queueEl.innerHTML = '<div class="sa-empty">暂无待上传文件</div>';
      resetBtn();
      return;
    }
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.textContent = '开始上传';
    queueEl.innerHTML = queue.map(function (f, i) {
      var g = E.guess(f.name);
      var cat = E.CAT_BY[g.cat];
      return '<div class="file-card">' +
        '<div class="file-icon">' + E.iconOf({ ext: E.extOf(f.name) }) + '</div>' +
        '<div class="file-meta"><div class="file-name">' + esc(f.name) + '</div>' +
          '<div class="file-sub" data-sub="' + i + '">' + E.fmtSize(f.size) + ' · 待上传　·　识别：' +
            (cat ? cat.label : g.cat) +
            (g.clause ? ' / ' + esc(g.clause.id + ' ' + g.clause.name) : ' / 未匹配到条款') +
            '（' + g.matched + '%）</div>' +
          '<div class="evd-qbar" data-bar="' + i + '"><div></div></div>' +
        '</div>' +
        '<button class="btn btn-sm" data-evq-remove="' + i + '" type="button">移除</button>' +
      '</div>';
    }).join('');
  }

  function addFiles(list) {
    Array.prototype.slice.call(list || []).forEach(function (f) {
      if (!queue.some(function (q) { return q.name === f.name && q.size === f.size; })) queue.push(f);
    });
    renderQueue();
    if (queue.length && window.showToast) showToast('已加入 ' + queue.length + ' 个文件待上传', 'info');
  }

  dz.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      dz.style.borderColor = 'var(--primary)';
      dz.style.background = 'var(--primary-light)';
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) {
      e.preventDefault(); e.stopPropagation();
      dz.style.borderColor = '';
      dz.style.background = '';
    });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  queueEl.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-evq-remove]');
    if (!rm) return;
    e.stopPropagation();
    queue.splice(parseInt(rm.getAttribute('data-evq-remove'), 10), 1);
    renderQueue();
  });

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!queue.length) return;
    btn.disabled = true;
    btn.textContent = '上传中…';

    var forcedCat = catSel.value || '';
    var forcedClause = clsSel.value || '';
    var cards = Array.prototype.slice.call(queueEl.querySelectorAll('.file-card'));
    var done = 0, pending = 0;

    cards.forEach(function (card, i) {
      var f = queue[i];
      var bar = card.querySelector('[data-bar="' + i + '"]');
      var fill = bar.querySelector('div');
      var sub = card.querySelector('[data-sub="' + i + '"]');
      var base = sub.textContent.split(' · ')[0];
      bar.style.display = 'block';
      var pct = 0;
      var timer = setInterval(function () {
        pct += 14 + Math.random() * 20;
        if (pct < 100) {
          fill.style.width = pct + '%';
          sub.textContent = base + ' · 上传中 ' + Math.round(pct) + '%';
          return;
        }
        clearInterval(timer);
        fill.style.width = '100%';
        sub.textContent = base + ' · 已上传 ✓';

        var g = E.guess(f.name);
        var clauses = [];
        if (forcedClause) {
          var parts = forcedClause.split('|');
          var lb = E.clauseLabel(parts[0], parts[1]);
          if (lb) clauses.push(lb);
        } else {
          clauses = g.clauses;
        }
        var add = E.add({
          name: f.name, size: f.size, ext: E.extOf(f.name),
          cat: forcedCat || g.cat,
          matched: g.matched,
          clauses: clauses,
          status: clauses.length ? '待复核' : '待归类',
          uploader: '质量管理员',
          note: clauses.length
            ? '上传后自动识别归入「' + clauses[0].label + '」'
            : '自动识别未达归类阈值，待人工确认归属条款'
        });
        if (add.status === '待归类') pending++;

        done++;
        if (done === cards.length) {
          setTimeout(function () {
            closeModal();
            /* 上传完成后弹「结果确认」，而不是一闪而过的 toast ——
               让用户明确知道有几份进了待复核、几份需要人工归类。 */
            if (window.showConfirm) {
              window.showConfirm({
                title: '上传完成',
                desc: '成功上传 <strong>' + done + '</strong> 份材料' +
                  (pending
                    ? '，其中 <strong style="color:#A85400;">' + pending + ' 份</strong>自动识别未达归类阈值，已进入<strong>待归类</strong>，请在材料列表中人工确认归属条款'
                    : '，已全部进入<strong>待复核</strong>队列') +
                  '。点击行内「预览」可查看材料详情或调整归属。',
                okLabel: '知道了',
                cancelLabel: '留在本页'
              });
            } else if (window.showToast) {
              showToast('已上传 ' + done + ' 份材料' +
                (pending ? '，其中 ' + pending + ' 份待人工归类' : '，已进入待复核队列'),
                pending ? 'info' : 'success');
            }
          }, 260);
        }
      }, 190);
    });
  });

  renderQueue();
}

/* ---------- 归类 ---------- */
function mountEvidenceClassify(root, ids) {
  var E = window.EVIDENCE;
  var ok = root.querySelector('#evc-ok');
  ok.addEventListener('click', function (e) {
    e.stopPropagation();
    var v = root.querySelector('#evc-clause').value;
    if (!v) { showToast('请选择归属条款', 'error'); return; }
    var parts = v.split('|');
    var lb = E.clauseLabel(parts[0], parts[1]);
    if (!lb) { showToast('条款不存在，请重新选择', 'error'); return; }
    var cat = root.querySelector('#evc-cat').value;
    var note = root.querySelector('#evc-note').value.trim();

    ids.forEach(function (id) {
      var m = E.byId(id);
      if (!m) return;
      var clauses = (m.clauses || []).slice();
      var has = clauses.some(function (c) { return c.lib === lb.lib && c.id === lb.id; });
      if (!has) clauses.push(lb);
      var patch = { clauses: clauses, cat: cat, status: '已归档' };
      if (note) patch.note = note;
      E.patch(id, patch);
      E.addLog(id, { who: '质量管理员', act: '人工归类', note: '归入「' + lb.label + '」，状态更新为已归档' });
    });

    closeModal();
    showToast('已将 ' + ids.length + ' 份材料归入「' + lb.label + '」', 'success');
  });
}

/* ---------- 版本号递增 ---------- */
function nextVersionLabel(v) {
  var m = String(v || 'V1.0').match(/V?(\d+)\.(\d+)/i);
  if (!m) return 'V1.1';
  return 'V' + m[1] + '.' + (parseInt(m[2], 10) + 1);
}

/* ---------- 真实下载 ---------- */
/* ---------- 版本对比：差异内容（2026-09-23） ----------
   rows: [{sec, type:'mod'|'add'|'del', old, new}]
   有专属数据的文件按「旧版>新版」给全量行；相邻版本对之间用合并去重衔接；
   其余文件走通用模板（章节结构一致，差异落点按版本号生成，保证稳定不跳变）。 */
const VCMP_DIFF = {
  '血液样本处理标准操作规程': {
    'V3.1>V3.2': [
      { sec: '4.2', type: 'mod', old: '血浆：1800×g、4°C 离心 15min，吸取上清至分装管', new: '血浆：1800×g、4°C 离心 10min（纠正离心时间参数），吸取上清至分装管' },
      { sec: '5.1', type: 'mod', old: '质控：观察溶血情况', new: '质控：观察溶血情况，增加乳糜检测判据与记录要求' }
    ],
    'V3.2>V4.0': [
      { sec: '2.1', type: 'mod', old: '样本接收时需双人核对', new: '样本接收需扫码 + 双人核对，扫码记录自动入库' },
      { sec: '3.2', type: 'mod', old: '样本编号采用 8 位数字码', new: '样本编号采用 12 位字母数字混合码（含校验位）' },
      { sec: '5.3', type: 'del', old: '离心参数固定为 3000rpm', new: '' },
      { sec: '5.3', type: 'add', old: '', new: '离心参数按样本类型动态调整：血液 2500rpm / 组织 1500rpm' },
      { sec: '6',   type: 'add', old: '', new: '新增第 6 章 全血 RNA 处理：采血后 30min 内加入 RNA 保护剂，立即 -80°C 保存' }
    ]
  },
  __default: {
    'V3.0>V3.1': [
      { sec: '3.2', type: 'mod', old: '质量方针：坚持以样本质量为核心', new: '质量方针：坚持以样本质量与数据可靠性为核心' },
      { sec: '5.1', type: 'mod', old: '组织架构图（2024 版）', new: '组织架构图（2025 修订版，细化样本库与检测部接口职责）' },
      { sec: '7.4', type: 'add', old: '', new: '新增内审联动要求：文件变更后 30 个工作日内完成影响评估' }
    ],
    'V3.1>V3.2': [
      { sec: '3.2', type: 'mod', old: '质量方针：坚持以样本质量为核心', new: '质量方针：坚持以样本质量与数据可靠性为核心（同步更新质量手册引言）' },
      { sec: '4.5', type: 'add', old: '', new: '管理评审：每年至少一次管理评审，输出改进决议并跟踪闭环' },
      { sec: '附录A', type: 'mod', old: '职责分配表 R1 版（5 个部门）', new: '职责分配表 R3 版（7 个部门，新增设备与信息两个归口）' }
    ]
  }
};

function vcmpRows(name, oldVer, newVer) {
  const lib = VCMP_DIFF[name] || VCMP_DIFF.__default;
  const key = oldVer + '>' + newVer;
  if (lib[key]) return lib[key];
  /* 非相邻版本对：把旧→新路径上各段合并，同章节同类型以后段为准（版本更新） */
  const chain = [];
  const vers = getVersionViewData(name).file.versions.map(v => v.ver);
  const iOld = vers.indexOf(oldVer), iNew = vers.indexOf(newVer);
  if (iOld >= 0 && iNew >= 0 && iOld !== iNew) {
    const step = iOld < iNew ? 1 : -1;
    for (let i = iOld; i !== iNew; i += step) {
      const k = vers[i] + '>' + vers[i + step];
      if (lib[k]) chain.push(lib[k]);
    }
  }
  if (chain.length) {
    const seen = {};
    chain.forEach(rows => rows.forEach(r => { seen[r.sec + '|' + r.type] = r; }));
    return Object.keys(seen).map(k => seen[k]);
  }
  /* 兜底：按版本号生成的稳定差异（无专属数据也无路径可拼时） */
  return [
    { sec: '3.2', type: 'mod', old: '质量方针表述（' + oldVer + ' 版）', new: '质量方针表述更新，强化数据可靠性要求（' + newVer + ' 版）' },
    { sec: '4.5', type: 'add', old: '', new: '管理评审章节：年度管理评审安排与改进闭环要求' },
    { sec: '附录A', type: 'mod', old: '职责分配表（' + oldVer + '）', new: '职责分配表（' + newVer + '，归口部门调整）' }
  ];
}

function vcmpDiffHtml(rows, oldVer, newVer) {
  let o = '', n = '';
  rows.forEach(function (r) {
    const line = (sec, txt, cls, tag) =>
      '<div class="diff-line' + (cls ? ' ' + cls : '') + '">' + (sec ? esc(sec) + ' ' : '') +
      (tag ? '<' + tag + '>' + esc(txt) + '</' + tag + '>' : (esc(txt) || '&nbsp;')) + '</div>';
    if (r.type === 'add') { o += line('', '', 'empty'); n += line(r.sec, r.new, '', 'ins'); }
    else if (r.type === 'del') { o += line(r.sec, r.old, '', 'del'); n += line('', '', 'empty'); }
    else { o += line(r.sec, r.old, '', 'del'); n += line(r.sec, r.new, '', 'ins'); }
  });
  return '<div class="diff-wrap">' +
    '<div class="diff-col old"><div class="diff-head">⏷ ' + esc(oldVer) + '（旧版）</div>' + o + '</div>' +
    '<div class="diff-col new"><div class="diff-head">⏷ ' + esc(newVer) + '（新版）</div>' + n + '</div></div>';
}

function vcmpSummaryHtml(rows, oldVer, newVer) {
  const cnt = { mod: 0, add: 0, del: 0 };
  rows.forEach(r => { cnt[r.type] = (cnt[r.type] || 0) + 1; });
  const secs = [...new Set(rows.map(r => r.sec))].join('、');
  return '<div style="font-size:13px;line-height:1.9;background:var(--primary-lighter);padding:12px 14px;border-radius:6px;color:var(--text-secondary);">' +
    '共检测到 <strong>' + cnt.mod + ' 处修改</strong>、<strong>' + cnt.add + ' 处新增</strong>、<strong>' + cnt.del + ' 处删除</strong>，涉及章节：' + esc(secs) + '。' +
    '请相关条款自评人确认佐证材料是否需要同步更新。</div>';
}

function vcmpReportText(name, oldVer, newVer, rows) {
  const cnt = { mod: 0, add: 0, del: 0 };
  rows.forEach(r => { cnt[r.type]++; });
  const typeName = { mod: '修改', add: '新增', del: '删除' };
  let t = 'CNAS 迎检 · 版本对比报告\n';
  t += '==========================================\n';
  t += '文件：' + name + '\n';
  t += '对比版本：' + oldVer + '（旧） → ' + newVer + '（新）\n';
  t += '生成时间：' + new Date().toLocaleString('zh-CN') + '\n';
  t += '差异统计：修改 ' + cnt.mod + ' 处 · 新增 ' + cnt.add + ' 处 · 删除 ' + cnt.del + ' 处\n';
  t += '------------------------------------------\n';
  rows.forEach(function (r, i) {
    t += '\n[' + (i + 1) + '] ' + r.sec + ' · ' + typeName[r.type] + '\n';
    if (r.old) t += '  旧版：' + r.old + '\n';
    if (r.new) t += '  新版：' + r.new + '\n';
  });
  t += '\n==========================================\n';
  return t;
}

function downloadText(filename, text) {
  var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

/* ---------- 确认框（可叠在弹窗之上） ---------- */
function ensureConfirmRoot() {
  var el = document.getElementById('confirm-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'confirm-root';
    document.body.appendChild(el);
  }
  return el;
}

window.showConfirm = function (opts) {
  opts = opts || {};
  var root = ensureConfirmRoot();
  root.innerHTML =
    '<div class="cf-overlay">' +
      '<div class="cf-card' + (opts.danger ? ' danger' : '') + '">' +
        '<div class="cf-title">' + (opts.title || '请确认') + '</div>' +
        '<div class="cf-desc">' + (opts.desc || '') + '</div>' +
        '<div class="cf-foot">' +
          '<button class="btn" data-cf="cancel">' + (opts.cancelLabel || '取消') + '</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-cf="ok">' + (opts.okLabel || '确定') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  var ov = root.firstChild;
  ov.addEventListener('click', function (e) {
    if (e.target === ov) { root.innerHTML = ''; return; }
    var b = e.target.closest('[data-cf]');
    if (!b) return;
    root.innerHTML = '';
    if (b.getAttribute('data-cf') === 'ok' && typeof opts.onOk === 'function') opts.onOk();
  });
  return root;
};

/* ==========================================================================
   材料详情弹窗 — 渲染与交互
   ========================================================================== */
var EVD = (function () {
  'use strict';

  var TABS = [['info', '基本信息'], ['ver', '版本历史'], ['clause', '关联条款'], ['log', '操作记录']];

  function E() { return window.EVIDENCE; }

  /* 预览页数：由文件大小推一个稳定值，避免每次打开都变 */
  function pageCount(m) {
    return Math.max(1, Math.min(9, Math.round(m.size / 260000)));
  }
  function sheetCount(m) {
    return Math.max(1, Math.min(3, Math.ceil(pageCount(m) / 3)));
  }
  function isSheet(m) {
    var e = String(m.ext).toLowerCase();
    return e === 'xlsx' || e === 'xls';
  }

  /* ---------- 预览：按扩展名差异化渲染 ---------- */
  function previewHtml(m, st) {
    var ext = String(m.ext).toLowerCase();
    var total = isSheet(m) ? sheetCount(m) : pageCount(m);
    var p = st.page;
    var zoom = 'transform:scale(' + st.zoom + ');';

    if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
      var heads = ['一、目的', '二、适用范围', '三、职责分工', '四、工作程序', '五、相关记录'];
      var body = '';
      for (var i = 0; i < 4; i++) {
        body += '<div class="ln" style="width:' + (94 - i * 9) + '%"></div>';
        body += '<div class="ln" style="width:' + (80 - i * 6) + '%"></div>';
      }
      return '<div class="evd-page" style="' + zoom + '">' +
        '<h4>' + esc(m.name.replace(/\.[a-zA-Z0-9]+$/, '')) + '</h4>' +
        '<div class="cap">文件编号 ' + esc(m.id) + '　版本 ' + esc(m.version) + '　' +
          (m.status === '已归档' ? '受控状态：受控' : '受控状态：待定') + '</div>' +
        '<h4 style="text-align:left; font-size:12px; margin:8px 0 6px;">' + heads[(p - 1) % heads.length] + '</h4>' +
        '<p>' + esc(pageText(m, p, total)) + '</p>' + body +
        '<div class="foot">第 ' + p + ' 页 / 共 ' + total + ' 页　·　演示预览</div>' +
      '</div>';
    }

    if (isSheet(m)) {
      var cols = ['序号', '日期', '项目', '记录值', '结论', '记录人'];
      var rows = '';
      for (var r = 0; r < 9; r++) {
        rows += '<tr>';
        cols.forEach(function (c, ci) {
          rows += '<td>' + esc(ci === 0 ? String((p - 1) * 9 + r + 1) : cellOf(c, r, p)) + '</td>';
        });
        rows += '</tr>';
      }
      return '<div class="evd-page" style="width:100%;' + zoom + '">' +
        '<h4>' + esc(m.name.replace(/\.[a-zA-Z0-9]+$/, '')) + '</h4>' +
        '<div class="cap">工作表 Sheet' + p + '　·　文件编号 ' + esc(m.id) + '　版本 ' + esc(m.version) + '</div>' +
        '<table class="evd-sheet"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<div class="foot">第 ' + p + ' 页 / 共 ' + total + ' 页　·　演示预览</div>' +
      '</div>';
    }

    return '<div class="evd-shot">' +
      '<div style="font-size:40px;">' + esc(E().iconOf(m)) + '</div>' +
      '<div>图片预览 · ' + esc(String(m.ext).toUpperCase()) + '</div>' +
      '<div style="font-size:11px; opacity:.85;">' + esc(m.name) + '</div>' +
      '<div style="font-size:11px; opacity:.85;">' + esc(E().fmtSize(m.size)) + '　（真实系统在此渲染原件）</div>' +
    '</div>';
  }

  function pageText(m, p, total) {
    if (p === 1 && m.note) return m.note;
    var st = E().ST[m.status] || E().ST['已归档'];
    return '本页为演示预览，真实系统在此渲染文件原文。材料「' + m.name + '」识别匹配度 ' + m.matched +
      '%，核验状态「' + m.verify + '」，' + st.desc + '。';
  }

  function cellOf(col, r, p) {
    var s = r * 7 + p * 3 + col.length;
    if (col === '日期') return '2026-0' + (6 + (s % 4)) + '-' + (10 + (s % 18));
    if (col === '项目') return ['温度', '湿度', '报警次数', '响应时长'][s % 4];
    if (col === '记录值') return ['-80.2 ℃', '45 %RH', '0 次', '6 min'][s % 4];
    if (col === '结论') return ['正常', '符合', '达标', '正常'][s % 4];
    if (col === '记录人') return ['郑十', '孙七', '吴九', '李四'][s % 4];
    return '';
  }

  /* ---------- 左侧预览区 ---------- */
  function viewPane(m, st) {
    var total = isSheet(m) ? sheetCount(m) : pageCount(m);
    return '<div class="evd-view">' +
      '<div class="evd-view-head">' +
        '<span class="nm" title="' + esc(m.name) + '">' + esc(E().iconOf(m) + ' ' + m.name) + '</span>' +
        '<span style="flex-shrink:0;">' + esc(String(m.ext).toUpperCase()) + ' · ' + esc(E().fmtSize(m.size)) + '</span>' +
      '</div>' +
      '<div class="evd-view-body">' + previewHtml(m, st) + '</div>' +
      '<div class="evd-view-foot">' +
        '<button class="btn btn-sm" data-evd-nav="prev"' + (st.page === 1 ? ' disabled' : '') + '>‹</button>' +
        '<span style="min-width:74px; text-align:center;">第 ' + st.page + ' / ' + total + ' 页</span>' +
        '<button class="btn btn-sm" data-evd-nav="next"' + (st.page >= total ? ' disabled' : '') + '>›</button>' +
        '<span style="width:8px;"></span>' +
        '<button class="btn btn-sm" data-evd-zoom="out">−</button>' +
        '<span style="min-width:42px; text-align:center;">' + Math.round(st.zoom * 100) + '%</span>' +
        '<button class="btn btn-sm" data-evd-zoom="in">＋</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 右侧：基本信息 ---------- */
  function paneInfo(m, st) {
    var E1 = E();
    var cat = E1.CAT_BY[m.cat] || {};
    var stMeta = E1.ST[m.status] || E1.ST['已归档'];

    /* 状态操作按当前状态给出可用动作：
       已归档 → 只能撤回归档或转待复核；未归档 → 可核验通过 / 退回。
       （原来「已归档」后核验按钮消失、退回按钮也一起消失，等于归档后无法纠正） */
    var archived = m.status === '已归档';
    var actions =
      (archived ? '' : '<button class="btn btn-sm btn-primary" data-evd-act="verify">✓ 核验通过</button>') +
      '<button class="btn btn-sm" data-evd-act="reject">↩ ' + (archived ? '撤回归档' : '退回') + '</button>' +
      (m.status === '待复核' ? '' : '<button class="btn btn-sm" data-evd-act="pending">⏳ 转待复核</button>');

    var rejectBox = '';
    if (st.reject) {
      rejectBox =
        '<div class="evd-reason">' +
          '<div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">退回理由（必填，会写入操作记录并同步给上传人）</div>' +
          '<textarea class="form-control" id="evd-reason" rows="2" placeholder="例如：版本非现行有效版本，请换版后重新提交">版本非现行有效版本，请换版后重新提交。</textarea>' +
          '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">' +
            '<button class="btn btn-sm" data-evd-act="reject-cancel">取消</button>' +
            '<button class="btn btn-sm btn-danger" data-evd-act="reject-ok">确认退回</button>' +
          '</div>' +
        '</div>';
    }

    return '<div class="evd-status">' +
        '<span class="tag ' + stMeta.tag + '">' + esc(m.status) + '</span>' +
        '<span class="tag ' + (m.verify === '已核验' ? 'tag-success' : m.verify === '已退回' ? 'tag-error' : 'tag-warning') + '">' + esc(m.verify) + '</span>' +
        '<span style="font-size:11.5px; color:var(--text-tertiary);">' + esc(stMeta.desc) + '</span>' +
        '<span class="sp"></span>' + actions +
      '</div>' + rejectBox +

      '<div class="desc-list">' +
        desc('材料编号', esc(m.id)) +
        desc('要素分类', esc(cat.icon ? cat.icon + ' ' + cat.label : m.cat)) +
        desc('当前版本', esc(m.version)) +
        desc('文件大小', esc(E1.fmtSize(m.size))) +
        desc('上传人', esc(m.uploader)) +
        desc('上传时间', esc(m.time)) +
        desc('识别匹配度', '<strong style="color:' + (m.matched >= 80 ? 'var(--success)' : 'var(--warning)') + ';">' + m.matched + '%</strong>') +
        desc('存储位置', '对象存储 / 迎检材料库 / ' + esc(m.time.slice(0, 4))) +
      '</div>' +

      '<div style="margin-top:14px;">' +
        '<div class="modal-section-title">智能识别结果</div>' +
        (m.matched >= 80
          ? '<div class="alert alert-success">✓ 系统已识别该文件内容，匹配度 <strong>' + m.matched + '%</strong>，' +
            ((m.clauses || []).length ? '归入「' + esc(m.clauses[0].label) + '」。' : '建议人工确认归属条款。') + '</div>'
          : '<div class="alert alert-warning">⚠ 识别匹配度仅 <strong>' + m.matched + '%</strong>，未达自动归档阈值（80%），' +
            '已进入待归类队列，请人工确认归属条款。</div>') +
        '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">' +
          (m.keywords || []).map(function (k) { return '<span class="tag tag-default">' + esc(k) + '</span>'; }).join('') +
        '</div>' +
      '</div>' +

      '<div style="margin-top:14px;">' +
        '<div class="modal-section-title">备注说明</div>' +
        '<textarea class="form-control" id="evd-note" rows="2" placeholder="补充说明该材料的用途或覆盖范围">' + esc(m.note || '') + '</textarea>' +
        '<div style="display:flex; justify-content:flex-end; margin-top:8px;">' +
          '<button class="btn btn-sm" data-evd-act="savenote">保存备注</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 右侧：版本历史 ---------- */
  function paneVer(m) {
    var vs = (m.versions || []).slice().reverse();
    return '<div style="margin-bottom:12px; font-size:12px; color:var(--text-tertiary);">' +
        '共 ' + vs.length + ' 个版本，当前版本 <strong style="color:var(--primary);">' + esc(m.version) + '</strong>' +
      '</div>' +
      '<div class="timeline">' +
        vs.map(function (v) {
          var cur = v.v === m.version;
          return '<div class="tl-item done"><div class="tl-time">' + esc(v.date) + ' · ' + esc(v.by) + '</div>' +
            '<div class="tl-title">' + esc(v.v) + (cur ? '　<span class="tag tag-primary">当前版本</span>' : '') + '</div>' +
            '<div class="tl-desc">' + esc(v.desc || '') + '</div></div>';
        }).join('') +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; margin-top:6px;">' +
        '<button class="btn btn-sm btn-upload" data-evd-act="newver">📤 上传新版本</button>' +
      '</div>';
  }

  /* ---------- 右侧：关联条款 ---------- */
  function paneClause(m, st) {
    var E1 = E();
    var chips = (m.clauses || []).map(function (c, i) {
      return '<span class="evd-clause-chip">' + esc(c.label) +
        '<button type="button" title="解除关联" data-evd-del="' + i + '">×</button></span>';
    }).join('') || '<span class="tag tag-warning">未归类</span>';

    var suggest = '';
    if (!(m.clauses || []).length) {
      var g = E1.guess(m.name);
      if (g.clause) {
        suggest = '<div class="alert alert-success" style="margin-top:12px;">' +
          '✓ 文件名命中条款「' + esc(g.clause.id + ' ' + g.clause.name) + '」，识别匹配度 ' + g.matched + '%。' +
          '<div style="margin-top:8px;"><button class="btn btn-sm btn-primary" data-evd-act="adopt">采纳建议</button></div>' +
          '</div>';
      } else {
        suggest = '<div class="alert alert-warning" style="margin-top:12px;">⚠ 未能从文件名识别条款，请在下方手动选择归属条款。</div>';
      }
    }

    var opts = clauseOptionsHtml('', st.clauseQ);

    return '<div style="font-size:12px; color:var(--text-tertiary);">' +
        '一份材料可同时支撑多条条款的自评与迎检取证。当前关联 <strong style="color:var(--primary);">' + (m.clauses || []).length + '</strong> 条。' +
      '</div>' +
      '<div class="evd-clause-list">' + chips + '</div>' +
      suggest +
      '<div class="modal-section" style="margin-top:16px;">' +
        '<div class="modal-section-title">新增关联条款</div>' +
        /* 两套标准库合计 215 条条款（CL10 185 + ISO 20387 30），下拉逐个滚不现实；
           先按关键字收窄再选。过滤只重建 select 的 innerHTML，不整块重渲染，
           否则输入框会失去焦点、输一个字就断。 */
        '<input class="input" id="evd-clause-q" placeholder="输入条款号或名称过滤，如 8.2 / 管理体系文件" value="' + esc(st.clauseQ || '') + '" style="width:100%; margin-bottom:8px;" />' +
        '<div class="form-row">' +
          '<div class="form-item"><label class="form-label">标准库 / 条款</label>' +
            '<select class="form-control" id="evd-add-clause">' +
              '<option value="">请选择条款</option>' + opts +
            '</select></div>' +
          '<div class="form-item"><label class="form-label">要素分类</label>' +
            '<select class="form-control" id="evd-add-cat">' +
              (E1.CATS || []).map(function (x) {
                return '<option value="' + x.k + '"' + (x.k === m.cat ? ' selected' : '') + '>' + x.icon + ' ' + x.label + '</option>';
              }).join('') +
            '</select></div>' +
        '</div>' +
        '<div style="display:flex; justify-content:flex-end;">' +
          '<button class="btn btn-sm btn-primary" data-evd-act="addclause">＋ 添加关联</button>' +
        '</div>' +
      '</div>' +
      (m.status === '待归类'
        ? '<div style="display:flex; justify-content:flex-end; margin-top:10px;">' +
            '<button class="btn btn-sm btn-primary" data-evd-act="verify">✓ 归类完成并归档</button></div>'
        : '');
  }

  /* ---------- 右侧：操作记录 ---------- */
  function paneLog(m) {
    var logs = m.logs || [];
    if (!logs.length) return '<div class="evd-empty">暂无操作记录</div>';
    return logs.map(function (g) {
      var dot = 'dot';
      if (/退回|驳回/.test(g.act)) dot += ' err';
      else if (/待复核|指派|识别|上传/.test(g.act)) dot += ' warn';
      else if (/核验|归档|归类/.test(g.act)) dot += ' ok';
      return '<div class="evd-log"><div class="' + dot + '"></div><div class="bd">' +
        '<div class="t">' + esc(g.t) + ' · ' + esc(g.who) + '</div>' +
        '<div class="a">' + esc(g.act) + '</div>' +
        '<div class="n">' + esc(g.note) + '</div>' +
      '</div></div>';
    }).join('');
  }

  /* ---------- 整体 body ---------- */
  function body(m, st) {
    var pane = st.tab === 'ver' ? paneVer(m)
      : st.tab === 'clause' ? paneClause(m, st)
      : st.tab === 'log' ? paneLog(m)
      : paneInfo(m, st);

    var tabs = '<div class="evd-tabs">' + TABS.map(function (t) {
      return '<div class="evd-tab' + (st.tab === t[0] ? ' on' : '') + '" data-evd-tab="' + t[0] + '">' + t[1] + '</div>';
    }).join('') + '</div>';

    return '<div class="evd-wrap">' + viewPane(m, st) + '<div style="min-width:0;">' + tabs + pane + '</div></div>';
  }

  /* ---------- 挂载：事件委托 + 局部重渲染 ---------- */
  function mount(root, id, st) {
    var bodyEl = root.querySelector('.modal-body');

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
    root.appendChild(fileInput);

    function cur() { return E().byId(id); }

    function render() {
      var m = cur();
      if (!m) return;
      var titleEl = root.querySelector('.modal-title');
      var subEl = root.querySelector('.modal-subtitle');
      if (titleEl) titleEl.textContent = '材料详情 — ' + m.name;
      if (subEl) subEl.innerHTML = esc(m.id) + '　·　' + esc((E().CAT_BY[m.cat] || {}).label || m.cat) + '　·　' + esc(m.status);
      bodyEl.innerHTML = body(m, st);
    }

    function toast(msg, t) { if (window.showToast) showToast(msg, t || 'success'); }

    /* 文件选择：上传新版本 */
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      var m = cur();
      if (!m) return;
      var nv = nextVersionLabel(m.version);
      var stamp = E().nowStamp();
      E().patch(id, {
        name: f.name, size: f.size, ext: E().extOf(f.name),
        matched: E().guess(f.name).matched,
        version: nv, time: stamp
      });
      E().pushVersion(id, {
        v: nv, date: stamp.slice(0, 10), hm: stamp.slice(11),
        by: '质量管理员', desc: '替换文件为 ' + f.name
      });
      st.tab = 'ver';
      render();
      toast('已上传新版本 ' + nv + '，材料回到待复核', 'success');
    });

    /* 条款过滤框：边输边收窄下拉选项，已选项尽量保留 */
    root.addEventListener('input', function (e) {
      if (e.target.id !== 'evd-clause-q') return;
      var sel = root.querySelector('#evd-add-clause');
      if (!sel) return;
      var keep = sel.value;
      st.clauseQ = e.target.value;
      sel.innerHTML = '<option value="">请选择条款</option>' + clauseOptionsHtml('', st.clauseQ);
      if (keep) sel.value = keep;
    });

    root.addEventListener('click', function (e) {
      var t = e.target;

      var tab = t.closest('[data-evd-tab]');
      if (tab) { st.tab = tab.getAttribute('data-evd-tab'); st.reject = false; render(); return; }

      var nav = t.closest('[data-evd-nav]');
      if (nav) {
        var m0 = cur(); if (!m0) return;
        var total = isSheet(m0) ? sheetCount(m0) : pageCount(m0);
        var d = nav.getAttribute('data-evd-nav') === 'next' ? 1 : -1;
        st.page = Math.max(1, Math.min(total, st.page + d));
        render();
        return;
      }

      var zm = t.closest('[data-evd-zoom]');
      if (zm) {
        var dz = zm.getAttribute('data-evd-zoom') === 'in' ? 0.1 : -0.1;
        st.zoom = Math.max(0.8, Math.min(1.3, Math.round((st.zoom + dz) * 10) / 10));
        render();
        return;
      }

      /* 条款 chip 上的「×」解除关联。
         2026-09-23：这里原来漏了 —— 渲染时给了 data-evd-del，但委托里只接了
         data-evd-tab / nav / zoom / act，× 点了没反应（校验里「解除关联成功」FAIL 才暴露）。
         解除掉最后一条条款的材料退回「待归类」，免得留一条无归属却已归档的材料。 */
      var delc = t.closest('[data-evd-del]');
      if (delc) {
        var m1 = cur();
        if (!m1) return;
        e.preventDefault();
        e.stopPropagation();
        var di = parseInt(delc.getAttribute('data-evd-del'), 10);
        var arr = (m1.clauses || []).slice();
        if (!(di >= 0 && di < arr.length)) return;
        var gone = arr[di];
        arr.splice(di, 1);
        var p1 = { clauses: arr };
        if (!arr.length && m1.status === '已归档') p1.status = '待归类';
        E().patch(id, p1);
        E().addLog(id, { who: '质量管理员', act: '解除关联条款', note: '解除「' + gone.label + '」' });
        render();
        toast('已解除关联「' + gone.label + '」' + (p1.status ? '，材料退回待归类' : ''), 'info');
        return;
      }

      var act = t.closest('[data-evd-act]');
      if (!act) return;
      var m = cur();
      if (!m) return;
      var what = act.getAttribute('data-evd-act');
      e.preventDefault();
      e.stopPropagation();

      if (what === 'verify') {
        E().patch(id, { status: '已归档' });
        E().addLog(id, { who: '质量管理员', act: '核验通过', note: '人工核验通过，归档为迎检证据' });
        st.reject = false;
        render();
        toast('已核验归档：' + m.name, 'success');
        return;
      }

      if (what === 'reject') { st.reject = true; render(); return; }
      if (what === 'reject-cancel') { st.reject = false; render(); return; }

      if (what === 'reject-ok') {
        var ta = root.querySelector('#evd-reason');
        var reason = ta ? ta.value.trim() : '';
        if (!reason) { toast('请填写退回理由', 'error'); return; }
        E().patch(id, { status: '已退回' });
        E().addLog(id, { who: '质量管理员', act: '退回', note: reason });
        st.reject = false;
        render();
        toast('已退回并通知上传人：' + m.uploader, 'info');
        return;
      }

      if (what === 'pending') {
        E().patch(id, { status: '待复核' });
        E().addLog(id, { who: '质量管理员', act: '转待复核', note: '重新提交复核' });
        render();
        toast('已转入待复核队列', 'info');
        return;
      }

      if (what === 'savenote') {
        var nt = root.querySelector('#evd-note');
        E().patch(id, { note: nt ? nt.value.trim() : '' });
        E().addLog(id, { who: '质量管理员', act: '更新备注', note: '修改材料备注说明' });
        render();
        toast('备注已保存', 'success');
        return;
      }

      if (what === 'newver') { fileInput.click(); return; }

      if (what === 'addclause') {
        var v = root.querySelector('#evd-add-clause').value;
        if (!v) { toast('请先选择条款', 'error'); return; }
        var parts = v.split('|');
        var lb = E().clauseLabel(parts[0], parts[1]);
        if (!lb) return;
        var list = (m.clauses || []).slice();
        if (list.some(function (c) { return c.lib === lb.lib && c.id === lb.id; })) { toast('该条款已关联', 'info'); return; }
        list.push(lb);
        var patch = { clauses: list };
        var csel = root.querySelector('#evd-add-cat');
        if (csel && csel.value) patch.cat = csel.value;
        if (m.status === '待归类') patch.status = '待复核';
        E().patch(id, patch);
        E().addLog(id, { who: '质量管理员', act: '新增关联条款', note: '关联「' + lb.label + '」' });
        render();
        toast('已关联「' + lb.label + '」', 'success');
        return;
      }

      if (what === 'adopt') {
        var g2 = E().guess(m.name);
        if (!g2.clause) return;
        var lb2 = E().clauseLabel(g2.clause.lib, g2.clause.id);
        if (!lb2) return;
        E().patch(id, { clauses: [lb2], cat: g2.cat, status: '待复核' });
        E().addLog(id, { who: '质量管理员', act: '采纳智能建议', note: '采纳识别建议归入「' + lb2.label + '」（匹配度 ' + g2.matched + '%）' });
        render();
        toast('已采纳建议并归入「' + lb2.label + '」', 'success');
        return;
      }

      if (what === 'download') {
        showConfirm({
          title: '下载材料',
          desc: '演示环境没有真实文件正文，将下载该材料的<b>元信息 + 版本历史 + 操作记录</b>（.txt，可直接打开）。',
          okLabel: '下载',
          onOk: function () {
            downloadText(m.name.replace(/\.[a-zA-Z0-9]+$/, '') + '.元信息.txt', E().toText(m));
            toast('已下载：' + m.name, 'success');
          }
        });
        return;
      }

      if (what === 'remove') {
        showConfirm({
          title: '移出归档',
          desc: '将从材料库移除「' + esc(m.name) + '」，该材料关联的 ' + (m.clauses || []).length +
            ' 条条款自评将失去这份证据。演示环境可通过清空浏览器本地数据还原。',
          okLabel: '确认移出',
          danger: true,
          onOk: function () {
            E().remove(id);
            closeModal();
            toast('已移出归档：' + m.name, 'info');
          }
        });
        return;
      }
    });

    render();
  }

  return { body: body, mount: mount };
})();

/* ---------- 弹窗渲染 ---------- */

let modalRoot = null;
let modalClearTimer = null;

function ensureRoot() {
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }
  return modalRoot;
}

function closeModal() {
  const ov = document.querySelector('#modal-root .modal-overlay');
  if (ov) {
    ov.classList.remove('show');
    clearTimeout(modalClearTimer);
    modalClearTimer = setTimeout(function () {
      if (modalRoot) modalRoot.innerHTML = '';
      modalClearTimer = null;
    }, 180);
  }
}

function openModal(action, ctx) {
  const tpl = MODALS[action];
  if (!tpl) { showToast('该功能的详情页面正在开发中', 'error'); return; }
  const conf = tpl(ctx || {});
  // 取消上一次关闭遗留的延迟清空，否则会误删即将渲染的新弹窗
  if (modalClearTimer) { clearTimeout(modalClearTimer); modalClearTimer = null; }
  if (conf.toastOnly) { showToast(conf.toastMsg || '操作已执行', 'success'); return; }
  const root = ensureRoot();
  const sizeCls = conf.size ? ' ' + conf.size : '';
  root.innerHTML = `
    <div class="modal-overlay show">
      <div class="modal${sizeCls}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <div class="modal-title">${conf.title || ''}</div>
            ${conf.subtitle ? `<div class="modal-subtitle">${conf.subtitle}</div>` : ''}
          </div>
          <div class="modal-header-actions">
            ${conf.headerAction || ''}
            <button class="modal-close" data-modal-close aria-label="关闭">×</button>
          </div>
        </div>
        <div class="modal-body">${conf.body || ''}</div>
        ${conf.footer ? `<div class="modal-footer">${conf.footer}</div>` : ''}
      </div>
    </div>`;

  // 关闭：点遮罩 / 关闭按钮 / Esc
  const ov = root.querySelector('.modal-overlay');
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
  document.addEventListener('keydown', function escH(e) {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escH); }
  });

  // 单选胶囊
  root.querySelectorAll('[data-pill]').forEach(function (p) {
    p.addEventListener('click', function () {
      p.parentElement.querySelectorAll('[data-pill]').forEach(function (x) { x.classList.remove('active'); });
      p.classList.add('active');
    });
  });

  // 复选框
  root.querySelectorAll('.checkbox').forEach(function (cb) {
    cb.addEventListener('click', function () { cb.classList.toggle('checked'); });
  });

  if (typeof conf.onMount === 'function') conf.onMount(root);
}

/* ---------- 页面内操作（非弹窗） ---------- */

const INLINE = {

  // 条款自评：章节导航切换（高亮 + 提示）
  'sa-clause': function (el) {
    document.querySelectorAll('.sidebar-clause').forEach(function (c) { c.classList.remove('active'); });
    el.classList.add('active');
    const code = el.querySelector('strong') ? el.querySelector('strong').textContent : '';
    const name = el.querySelector('span:last-child') ? el.querySelector('span:last-child').textContent : '';
    showToast('已切换到条款 ' + code + ' ' + name, 'info');
  },

  // 文检工作台：切换检查模式并同步主操作区
  'wj-mode': function (el) {
    const wrap = el.closest('[data-wj-mode-group]');
    if (wrap) wrap.querySelectorAll('[data-action=\"wj-mode\"]').forEach(function (b) { b.classList.remove('active'); });
    el.classList.add('active');
    const name = el.getAttribute('data-mode-label') || el.textContent.trim();
    const hint = document.querySelector('[data-wj-mode-hint]');
    if (hint) hint.textContent = '当前检查类型：' + name + '，请选择文档后开始审校';
    showToast('已切换到「' + name + '」', 'info');
  },

  // 文检工作台：删除右侧文档卡片
  'wj-doc-delete': function (el) {
    const card = el.closest('[data-library-doc]');
    if (card) card.remove();
    const count = document.querySelector('[data-library-count]');
    if (count) count.textContent = document.querySelectorAll('[data-library-doc]').length;
    showToast('文档已从本次会话移除', 'info');
  },

  // 分页切换
  'page': function (el) {
    const box = el.closest('.pagination');
    if (!box) return;
    const curEl = box.querySelector('.active');
    let cur = parseInt(curEl ? curEl.textContent : '1', 10) || 1;
    const dir = el.getAttribute('data-dir');
    const pg = el.getAttribute('data-page');
    let next = pg ? parseInt(pg, 10) : (dir === 'prev' ? Math.max(1, cur - 1) : Math.min(3, cur + 1));
    if (next === cur) return;
    box.querySelectorAll('[data-page]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-page') === String(next));
    });
    showToast('已切换到第 ' + next + ' 页');
  },

  // 材料：在线预览（打开材料详情并停留在预览区）
  'evidence-preview': function (el) {
    openModal('evidence-detail', { id: el.getAttribute('data-id') });
  },

  // 展开 / 收起剩余条款
  'expand-clauses': function (el) {
    const wrap = el.parentElement;
    const MORE = [
      ['8.2', '管理体系文件', '应建立、编制、批准、发布并保持管理体系文件', '管理'],
      ['8.4', '文件控制', '应控制管理体系要求的所有文件，确保使用有效版本', '管理'],
      ['8.5', '记录控制', '应建立并保持清晰的记录，证明满足要求与体系有效运行', '管理'],
      ['8.6', '改进', '应识别并选择改进机会，采取必要措施予以实施', '管理'],
      ['8.7', '纠正措施', '发生不符合时应采取措施消除原因，防止再发生', '管理'],
      ['8.8', '内部审核', '应按计划的时间间隔进行内部审核，确认体系符合要求', '管理'],
      ['8.9', '管理评审', '最高管理者应按计划的时间间隔评审管理体系', '管理'],
      ['7.1', '要求、标书和合同评审', '应评审与客户要求相关的要求、标书和合同', '技术'],
      ['7.2', '方法的选择、验证和确认', '应使用适当的方法和程序开展所有活动', '技术'],
      ['7.3', '抽样', '当进行抽样时，应制定抽样计划和方法', '技术'],
      ['7.4', '生物样本和数据的处置', '应建立程序确保生物样本和数据在处置过程中的质量', '技术'],
      ['7.5', '技术记录', '应保存技术记录，确保结果可追溯', '技术'],
      ['7.6', '测量不确定度', '应评估测量不确定度对结果的影响', '技术'],
      ['7.7', '结果有效性保证', '应有监控结果有效性的程序', '技术']
    ];

    if (el.dataset.expanded === '1') {           // 收起
      const holder = wrap.querySelector('#more-clauses');
      if (holder) holder.remove();
      el.textContent = '展开剩余 14 条 ▼';
      el.dataset.expanded = '0';
      showToast('已收起');
      return;
    }

    const html = MORE.map(function (c) {
      const cls = c[3] === '管理' ? 'tag-primary' : 'tag-warning';
      return '<div class="clause-row" style="grid-template-columns: 60px 1fr 80px 80px;">' +
        '<span class="clause-code">' + c[0] + '</span>' +
        '<span class="clause-name"><strong>' + c[1] + '</strong><br>' +
        '<span style="color:var(--text-tertiary); font-size:12px;">' + c[2] + '</span></span>' +
        '<span class="tag ' + cls + '">' + c[3] + '</span>' +
        '<button class="btn btn-sm" data-action="clause-detail" data-code="' + c[0] +
        '" data-name="' + c[1] + '" data-cat="' + (c[3] === '管理' ? '管理要求' : '技术要求') + '">详情</button>' +
        '</div>';
    }).join('');

    const holder = document.createElement('div');
    holder.id = 'more-clauses';
    holder.innerHTML = html;
    wrap.parentNode.insertBefore(holder, wrap);
    el.textContent = '收起 ▲';
    el.dataset.expanded = '1';
    showToast('已展开剩余 14 条条款');
  }
};

/* ---------- 全局事件委托 ---------- */

document.addEventListener('click', function (e) {
  // 侧边栏占位项 → 显示 toast（不跳转）
  const soonEl = e.target.closest('.sidebar-item.is-soon');
  if (soonEl) {
    e.preventDefault();
    const msg = soonEl.getAttribute('data-toast') || '\u8be5\u529f\u80fd\u5373\u5c06\u4e0a\u7ebf';
    if (window.showToast) showToast(msg, 'info');
    return;
  }
  // 关闭弹窗
  const closeEl = e.target.closest('[data-modal-close]');
  if (closeEl) {
    const msg = closeEl.getAttribute('data-toast');
    if (msg) showToast(msg, closeEl.getAttribute('data-toast-type') || 'success');
    closeModal();
    return;
  }
  // 打开弹窗
  const actEl = e.target.closest('[data-action]');
  if (actEl) {
    const action = actEl.getAttribute('data-action');
    if (INLINE[action]) { INLINE[action](actEl); return; }   // 页面内操作优先
    // 角色权限检查
    const reqRole = actEl.getAttribute('data-requires-role');
    if (reqRole && window.__currentRole !== reqRole) {
      const tip = actEl.getAttribute('data-tip') || '该操作需要' + ({manager:'管理员',approver:'审批人'}[reqRole]||reqRole) + '权限';
      showToast(tip, 'error');
      return;
    }
    const ctx = {};
    Array.from(actEl.attributes).forEach(function (a) {
      if (a.name.indexOf('data-') === 0 && a.name !== 'data-action' && a.name !== 'data-toast') {
        ctx[a.name.slice(5)] = a.value;
      }
    });
    // 从所在行补齐上下文
    const row = actEl.closest('tr');
    if (row && row.cells) {
      // 优先用行上的 data-* 属性（版本页等数据驱动的表格）
      if (row.dataset) {
        if (!ctx.name && row.dataset.name) ctx.name = row.dataset.name;
        if (!ctx.ver && row.dataset.ver) ctx.ver = row.dataset.ver;
        if (!ctx.status && row.dataset.status) ctx.status = row.dataset.status;
        if (!ctx.type && row.dataset.type) ctx.type = row.dataset.type;
      }
      const cells = Array.from(row.cells).map(function (c) { return c.textContent.trim(); });
      if (!ctx.name && cells[0]) ctx.name = cells[0];
      if (!ctx.code && cells[0]) ctx.code = cells[0].split(/\s+/)[0];
      if (!ctx.cat && cells[1]) ctx.cat = cells[1];
      if (!ctx.owner && cells[1]) ctx.owner = cells[1];
      if (!ctx.assessor && cells[2]) ctx.assessor = cells[2];
      if (!ctx.due && cells[3]) ctx.due = cells[3];
      if (!ctx.result && cells[4]) ctx.result = cells[4];
      if (!ctx.status && cells[5]) ctx.status = cells[5];
      if (!ctx.type && cells[1]) ctx.type = cells[1];
      if (!ctx.size && cells[2]) ctx.size = cells[2];
      if (!ctx.time && cells[3]) ctx.time = cells[3];
      if (!ctx.uploader && cells[3]) ctx.uploader = cells[3];
      if (!ctx.ver && cells[2]) ctx.ver = cells[2];
      if (!ctx.modifier && cells[5]) ctx.modifier = cells[5];
      if (!ctx.date && cells[1]) ctx.date = cells[1];
      if (!ctx.leader && cells[3]) ctx.leader = cells[3];
      if (!ctx.clause && cells[2]) ctx.clause = cells[2];
    }
    openModal(action, ctx);
  }
});

/* ==========================================================================
   版本管理页：Tab 筛选 / 下拉联动 / 搜索 / 排序 / 计数 / 空状态
   ========================================================================== */
(function initVersionPage() {
  const tbody = document.getElementById('version-tbody');
  if (!tbody) return;                                  // 仅版本管理页生效

  const tabsWrap = document.getElementById('v-tabs');
  const selType = document.getElementById('v-filter-type');
  const selStatus = document.getElementById('v-filter-status');
  const search = document.getElementById('v-search');
  const bar = document.getElementById('v-filter-bar');
  const barText = document.getElementById('v-filter-text');
  const clearBtn = document.getElementById('v-clear-filter');
  const emptyBox = document.getElementById('v-empty');
  const emptyReset = document.getElementById('v-empty-reset');
  const bulkBar = document.getElementById('v-bulk-bar');
  const bulkText = document.getElementById('v-bulk-text');
  const bulkCancel = document.getElementById('v-bulk-cancel');
  const checkAll = document.getElementById('v-check-all');

  const ALL_ROWS = Array.from(tbody.querySelectorAll('tr'));
  // 缓存原始单元格 HTML，供关键词高亮还原
  ALL_ROWS.forEach(function (tr) {
    tr.__html = Array.from(tr.cells).map(function (td) { return td.innerHTML; });
  });

  const state = { type: 'all', status: 'all', kw: '', sort: '', dir: 'asc' };

  const numOfVer = (v) => {
    const m = String(v || '').match(/(\d+)\.(\d+)/);
    return m ? (+m[1]) * 1000 + (+m[2]) : 0;
  };
  const valOf = (tr, key) => {
    switch (key) {
      case 'name': return tr.dataset.name || '';
      case 'ver':  return numOfVer(tr.dataset.ver);
      case 'hist': return parseInt((tr.cells[4].textContent || '').replace(/\D/g, ''), 10) || 0;
      case 'mod':  return tr.dataset.mod || '';
      case 'eff':  return tr.dataset.eff === '—' ? '' : (tr.dataset.eff || '');
      default:     return '';
    }
  };

  // 更新 Tab 上的数量徽章（不受其他筛选影响，仅按类型统计）
  function updateTabCounts() {
    if (!tabsWrap) return;
    tabsWrap.querySelectorAll('[data-count-for]').forEach(function (sp) {
      const t = sp.getAttribute('data-count-for');
      const n = t === 'all' ? ALL_ROWS.length
        : t === '__pending' ? ALL_ROWS.filter(function (tr) { return tr.dataset.status === '待审批'; }).length
        : ALL_ROWS.filter(function (tr) { return tr.dataset.type === t; }).length;
      sp.textContent = n;
    });
  }

  /* ---- 批量选择 ---- */
  function visibleRows() {
    return ALL_ROWS.filter(function (tr) { return tr.style.display !== 'none'; });
  }
  function updateBulk() {
    const picked = visibleRows().filter(function (tr) {
      const c = tr.querySelector('.v-row-check');
      return c && c.checked;
    });
    if (bulkBar) bulkBar.hidden = picked.length === 0;
    if (bulkText) bulkText.innerHTML = '已选 <strong>' + picked.length + '</strong> 项';
    if (checkAll) {
      const vis = visibleRows();
      checkAll.checked = vis.length > 0 && picked.length === vis.length;
      checkAll.indeterminate = picked.length > 0 && picked.length < vis.length;
    }
  }
  function clearSelection() {
    ALL_ROWS.forEach(function (tr) {
      const c = tr.querySelector('.v-row-check');
      if (c) c.checked = false;
      tr.classList.remove('selected');
    });
    updateBulk();
  }

  function highlight(tr, kw) {
    const cells = Array.from(tr.cells);
    cells.forEach(function (td, i) {
      let html = tr.__html[i];
      if (kw && i === 1) {   // 文件名列为索引 1（0 是复选框列）
        const re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        html = html.replace(re, '<mark class="kw">$1</mark>');
      }
      if (td.innerHTML !== html) td.innerHTML = html;
    });
  }

  function render() {
    const kw = state.kw.trim().toLowerCase();
    let rows = ALL_ROWS.filter(function (tr) {
      if (state.type !== 'all' && tr.dataset.type !== state.type) return false;
      if (state.status !== 'all' && tr.dataset.status !== state.status) return false;
      if (kw) {
        const hay = ((tr.dataset.name || '') + ' ' + (tr.cells[6].textContent || '')).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });

    if (state.sort) {
      const k = state.sort, dir = state.dir === 'asc' ? 1 : -1;
      rows.sort(function (a, b) {
        const va = valOf(a, k), vb = valOf(b, k);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), 'zh-CN') * dir;
      });
    }

    // 先隐藏全部行，再按结果顺序显示（关键：不匹配的必须隐藏，否则只会重排）
    ALL_ROWS.forEach(function (tr) { tr.style.display = 'none'; });

    // 重排 DOM：匹配行按顺序 append 到末尾
    const frag = document.createDocumentFragment();
    rows.forEach(function (tr) {
      highlight(tr, state.kw.trim());
      tr.style.display = '';
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    rows.forEach(function (tr) {
      tr.classList.remove('row-in');
      void tr.offsetWidth;                 // 触发重排以重放动画
      tr.classList.add('row-in');
    });

    const total = ALL_ROWS.length, shown = rows.length;
    if (bar && barText) {
      const parts = [];
      if (state.type !== 'all') parts.push('类型：' + (selType ? selType.options[selType.selectedIndex].text : state.type));
      if (state.status !== 'all') parts.push('状态：' + state.status);
      if (kw) parts.push('关键词：' + state.kw.trim());
      barText.innerHTML = parts.length
        ? '筛选出 <strong>' + shown + '</strong> 条 / 共 ' + total + ' 条　·　' + parts.join('　·　')
        : '共 <strong>' + total + '</strong> 条受控文件';
      if (clearBtn) clearBtn.hidden = parts.length === 0;
      bar.hidden = false;
    }
    if (emptyBox) emptyBox.hidden = shown !== 0;
    updateBulk();
  }

  // 应用一个 Tab（类型 tab 与待审批 tab 互斥，作为快捷筛选入口）
  function applyTab(tabEl) {
    const fstatus = tabEl.getAttribute('data-fstatus');
    state.type = tabEl.getAttribute('data-ftype') || 'all';
    state.status = fstatus === 'pending' ? '待审批' : 'all';
    if (selType) selType.value = state.type;
    if (selStatus) selStatus.value = state.status;
    if (tabsWrap) tabsWrap.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t === tabEl);
    });
    render();
  }

  // Tab 点击
  if (tabsWrap) tabsWrap.addEventListener('click', function (e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    applyTab(t);
  });

  // 类型下拉（与 Tab 解绑，进入自定义态）
  if (selType) selType.addEventListener('change', function () {
    state.type = selType.value;
    if (tabsWrap) tabsWrap.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-ftype') === state.type && !t.hasAttribute('data-fstatus'));
    });
    render();
  });

  // 状态下拉
  if (selStatus) selStatus.addEventListener('change', function () {
    state.status = selStatus.value;
    if (tabsWrap) tabsWrap.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-fstatus') === 'pending' && state.status === '待审批' && state.type === 'all');
    });
    render();
  });

  // 搜索（防抖 200ms）
  if (search) {
    let timer = null;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.kw = search.value; render(); }, 200);
    });
  }

  // 排序
  document.querySelectorAll('th.sortable').forEach(function (th) {
    th.addEventListener('click', function () {
      const k = th.getAttribute('data-sort');
      if (state.sort === k) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = k; state.dir = 'asc';
      }
      document.querySelectorAll('th.sortable').forEach(function (o) { o.classList.remove('asc', 'desc'); });
      th.classList.add(state.dir);
      render();
    });
  });

  function resetAll() {
    state.type = 'all'; state.status = 'all'; state.kw = '';
    state.sort = ''; state.dir = 'asc';
    if (selType) selType.value = 'all';
    if (selStatus) selStatus.value = 'all';
    if (search) search.value = '';
    document.querySelectorAll('th.sortable').forEach(function (o) { o.classList.remove('asc', 'desc'); });
    applyTab(tabsWrap.querySelector('.tab[data-ftype="all"]'));
    clearSelection();
  }
  if (clearBtn) clearBtn.addEventListener('click', resetAll);
  if (emptyReset) emptyReset.addEventListener('click', resetAll);

  /* ---- 批量选择事件 ---- */
  if (checkAll) checkAll.addEventListener('change', function () {
    const vis = visibleRows();
    vis.forEach(function (tr) {
      const c = tr.querySelector('.v-row-check');
      if (c) { c.checked = checkAll.checked; tr.classList.toggle('selected', checkAll.checked); }
    });
    updateBulk();
  });
  tbody.addEventListener('change', function (e) {
    if (e.target && e.target.classList.contains('v-row-check')) {
      e.target.closest('tr').classList.toggle('selected', e.target.checked);
      updateBulk();
    }
  });
  if (bulkCancel) bulkCancel.addEventListener('click', clearSelection);

  /* ---- 行点击进详情（点击非交互区域） ---- */
  tbody.addEventListener('click', function (e) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
    const tr = e.target.closest('tr');
    if (!tr || !tr.dataset.name) return;
    openModal('version-detail', {
      name: tr.dataset.name,
      ver: tr.dataset.ver,
      status: tr.dataset.status
    });
  });

  updateTabCounts();
  render();
})();

window.openModal = openModal;
window.closeModal = closeModal;


/* ==========================================================================
   AI 智能问答 / 知识库 / 知识图谱 —— 右侧工作区嵌入外部系统（2026-10-07）
   保持左侧菜单布局：点击后仅把右侧 .content 换成 iframe，不做整页跳转，
   使外部接入部分与当前系统更像一个整体。
   ========================================================================== */
(function () {
  var BASE = 'http://192.168.77.144:20080/package1/';
  var MAP = { 'AI智能问答': { k: 'chat', t: 'AI 智能问答' }, '知识库': { k: 'kb', t: '知识库' }, '知识图谱': { k: 'kg', t: '知识图谱' } };
  var nav = document.querySelector('.sidebar-nav');
  if (!nav) return;
  var items = [];
  Array.prototype.forEach.call(nav.querySelectorAll('a.sidebar-item'), function (a) {
    var txt = a.textContent.replace(/\s/g, '');
    Object.keys(MAP).forEach(function (name) {
      if (txt.indexOf(name) >= 0 && txt.length <= name.length + 2 && !a.getAttribute('data-ext')) {
        a.setAttribute('data-ext', MAP[name].k);
        a.setAttribute('href', BASE + MAP[name].k);
        items.push(a);
      }
    });
  });
  if (!items.length) return;

  function embed(a) {
    var k = a.getAttribute('data-ext');
    var t = '智能体工作台';
    Object.keys(MAP).forEach(function (n) { if (MAP[n].k === k) t = MAP[n].t; });
    nav.querySelectorAll('.sidebar-item').forEach(function (x) { x.classList.remove('active'); });
    a.classList.add('active');
    var crumb = document.querySelector('.breadcrumb');
    if (crumb) crumb.innerHTML = '<span>智能体工作台</span><span class="sep">/</span><span class="current">' + t + '</span>';
    var main = document.querySelector('main.content') || document.querySelector('.content');
    if (!main) return;
    main.innerHTML =
      '<div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">' +
        '<div style="font-size:15px; font-weight:600;">' + t + '</div>' +
        '<span class="tag tag-primary">外部接入</span>' +
        '<span style="font-size:12px; color:var(--text-tertiary);">' + BASE + k + '</span>' +
        '<span style="margin-left:auto; display:flex; gap:8px;">' +
          '<button class="btn btn-sm" id="ext-reload">⟳ 刷新</button>' +
          '<a class="btn btn-sm" href="' + BASE + k + '" target="_blank" rel="noopener">↗ 新窗口打开</a>' +
        '</span>' +
      '</div>' +
      '<div style="border:1px solid var(--border-light); border-radius:12px; overflow:hidden; background:#fff;">' +
        '<iframe id="ext-frame" src="' + BASE + k + '" title="' + t + '" style="width:100%; height:calc(100vh - 176px); min-height:560px; border:0; display:block;"></iframe>' +
      '</div>' +
      '<div class="form-hint" style="margin-top:8px;">若右侧空白，通常是该外部系统禁止被 iframe 嵌入（X-Frame-Options / CSP），可点「↗ 新窗口打开」。</div>';
    var rb = document.getElementById('ext-reload');
    if (rb) rb.addEventListener('click', function () { var f = document.getElementById('ext-frame'); if (f) f.src = BASE + k; });
  }
  items.forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); embed(a); });
  });
})();


/* ==========================================================================
   当前评审条（全站顶部，2026-10-07）
   依赖 review-store.js：显示当前激活评审，可下拉切换（全站以激活评审为准）。
   ========================================================================== */
(function () {
  var RS = window.REVIEW_STORE; if (!RS) return;
  var topbar = document.querySelector('.topbar'); if (!topbar) return;
  var host = topbar.parentElement; if (!host) return;
  var isPages = location.pathname.indexOf('/pages/') >= 0;
  function link(p) { return (isPages ? '' : 'pages/') + p; }
  function render() {
    var bar = document.getElementById('review-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'review-bar'; bar.className = 'review-bar';
      host.insertBefore(bar, host.querySelector('main.content') || null);
    }
    var a = RS.active();
    var list = RS.all();
    var opts = list.map(function (r) {
      return '<option value="' + r.id + '"' + (a && r.id === a.id ? ' selected' : '') + '>' + r.name + '（' + r.id + '）</option>';
    }).join('');
    bar.innerHTML =
      '<div class="rb-left">' +
        '<span class="rb-label">当前评审</span>' +
        (a ? '<span class="rb-name">' + a.name + '</span><span class="tag ' + (a.status === '进行中' ? 'tag-primary' : 'tag-default') + '">' + a.status + '</span><span class="rb-meta">' + a.period + ' · ' + a.std + '</span>'
          : '<span class="rb-name" style="color:var(--warning);">未激活评审</span><span class="rb-meta">请到「评审列表」激活一个评审</span>') +
      '</div>' +
      '<div class="rb-right">' +
        '<span class="rb-switch-label">切换评审</span>' +
        '<select class="select" id="rb-select" style="width:230px;height:28px;">' + opts + '</select>' +
        '<a class="btn btn-sm" href="' + link('review-list.html') + '">评审列表 ›</a>' +
      '</div>';
    var sel = document.getElementById('rb-select');
    if (sel) sel.addEventListener('change', function () { RS.setActive(sel.value); location.reload(); });
  }
  render();
  window.addEventListener('reviewchange', render);
})();
