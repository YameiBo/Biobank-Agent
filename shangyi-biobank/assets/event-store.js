/* ============================================================
 * 事件数据源（跨页共享）—— 事件管控中心 ↔ 样本数据质控 打通
 * ------------------------------------------------------------
 * 数据质控「数据清洗」发现的问题，按问题类型自动指派负责人/执行人，
 * 生成「事件」写入本数据源；事件管控中心读取并展示（看板 / 列表 / 按人员）。
 * localStorage: cnas_events_v1；变更时派发 eventchange。
 * ============================================================ */
window.EVENT_STORE = (function () {
  'use strict';

  var K = 'cnas_events_v1';
  var seq = 0;

  function read() { try { var r = localStorage.getItem(K); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) { } }
  function emit() { try { window.dispatchEvent(new CustomEvent('eventchange')); } catch (e) { } }
  function nowStr() {
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  var api = {
    all: function () { return read(); },
    count: function () { return read().length; },
    /* 新增一条或多条事件（数据质控批量下发） */
    add: function (list) {
      var arr = read();
      (Array.isArray(list) ? list : [list]).forEach(function (e) {
        seq++;
        arr.unshift({
          id: e.id || ('EV-' + Date.now().toString(36).toUpperCase() + '-' + seq),
          title: e.title || '数据质量问题',
          type: e.type || '样本质量',
          pri: e.pri || '中',
          owner: e.owner || '—',
          due: e.due || '12-08 17:00',
          progress: e.progress || 0,
          status: e.status || 'assigned',
          desc: e.desc || '',
          clause: e.clause || '—',
          created: e.created || nowStr(),
          source: e.source || '数据质控 · 数据清洗',
          count: e.count || 1,
          log: e.log || [{ t: '事件创建', who: '数据质控', time: nowStr(), note: e.desc || '' },
                         { t: '分派处理人', who: '质量管理员', time: nowStr(), note: '按问题类型自动分派给 ' + (e.owner || '—') }]
        });
      });
      write(arr); emit();
      return arr;
    },
    remove: function (id) { write(read().filter(function (e) { return e.id !== id; })); emit(); },
    clear: function () { write([]); emit(); },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } emit(); }
  };
  return api;
})();
