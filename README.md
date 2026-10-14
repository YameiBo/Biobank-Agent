# Biobank-Agent · CNAS 迎检体系管理智能体（Demo）

纯前端高保真 Demo（无需后端/数据库）。含 15 个页面 + 迎检智能体挂件 + RBAC 演示身份。

## 在线预览（GitHub Pages）
启用 Pages 后访问：`https://YameiBo.github.io/Biobank-Agent/`

## 本地打开
方式 A（推荐）：
```
python3 -m http.server 8791
# 浏览器打开 http://localhost:8791/index.html
```
方式 B：直接双击 `index.html`（Chrome/Edge）。

## 演示要点
- 右上角「演示身份」可切换 6 个角色（越权操作会被拦截）。
- 右下角「迎检智能体」：试试「查看规则库」「看下规则」「整理我的待办事项」「按 CNAS-PD14-09D0 编排现场评审日程」（可下载日程 CSV）。
- 事件管控中心可切换「事件流 / 按条款 / 按人员」；条款库为 GB/T 37864-2019（等同采用 ISO 20387:2018）条款全文 185 条。

## 目录
- `index.html` 首页；`pages/` 各功能页；`assets/` 样式与脚本（含数据源 roles.js / task-store.js / rule-store.js / evidence-store.js）。
