# 安全最佳实践审查报告

- 项目：CalcBridge / 樂創工程计算器
- 审查日期：2026-10-30
- 范围：`apps/web`（React 18 + TypeScript + Vite 纯前端 SPA）、`packages/*`、构建与依赖配置
- 方法：对照 `security-best-practices` 技能中的 React / JavaScript 前端规范，结合源码检索（危险 DOM sink、Web Storage、文件上传、第三方脚本、密钥）与 `npm audit`
- 结论口径：本报告区分“已修复”“生产残留风险”“仅开发工具链风险”，不把无法从仓库确认的 TLS/CDN 配置当作漏洞

## 执行摘要

本项目是纯静态前端应用，没有后端、登录会话、网络 API、第三方脚本或密钥，因此 CSRF、服务端授权、令牌存储、数据外泄等类别的风险当前不适用。源码检索未发现 `dangerouslySetInnerHTML`、`innerHTML`、`eval`、`new Function`、`DOMParser` 等危险 sink。

本次针对“文件导入设计”新增了设计文件（JSON）与稳压器参数文件（JSON/CSV）导入导出，并把它们按不可信输入处理。已完成两项整改：

1. **修复 CSV 公式注入**：报告导出与稳压器 CSV 导出统一使用带公式防护的单元格编码。
2. **建立文件导入边界**：限制文件大小/条目数/字符串长度/嵌套深度，拒绝原型污染键、非有限数值与未知版本，并在覆盖前二次确认。

三项环境整改已完成配置，仍需在实际部署环境做最终确认：

- 生产部署层已补充 CSP、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 与
  `frame-ancestors` 配置（Netlify/Cloudflare Pages `_headers`、Nginx 示例、Vite preview headers）。
- 开发工具链已升级到 Vitest 5 / Vite 8，`npm audit` 为 0；CI 使用 `npm ci` 并执行两项 audit。
- Vite 开发服务器默认只监听 `127.0.0.1`，需要通过 `CALCBRIDGE_DEV_HOST` 显式开放局域网。

Redis 当前不适用：应用没有服务端会话、共享缓存或计算任务队列。详见 SEC-INFO-02。

---

## 中危

### SEC-01 CSV 公式注入（已修复）

- 规则：OWASP CSV Injection / 输出编码
- 严重度：Medium（导出文件被其他用户用 Excel/WPS 打开时可升级为 High）
- 位置：
  - 修复实现：`apps/web/src/csv.ts:10-18`
  - 报告导出使用：`apps/web/src/report.ts:108`（`buildReportCsv` 内逐单元格调用 `csvCell`）
  - 参数文件导出使用：`apps/web/src/regulatorData.ts:476-482`
- 原问题证据（改动前 `apps/web/src/report.ts:86-89`）：

  ```ts
  function csvCell(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
  ```

  该实现只做 RFC 4180 转义，没有处理以 `=`、`+`、`-`、`@`、制表符或回车开头的单元格。

- 影响：备注、型号名或导入数据若以公式开头，导出 CSV 后在 Excel/WPS 中可能被当作公式执行（例如 `=HYPERLINK(...)`），造成钓鱼链接、数据外泄或本机命令执行。
- 修复：新增 `csvCell`，对危险前缀加 `'` 文本前缀；纯数字（含负数、科学计数法）保持原样，避免工程数值变成文本。
- 验证：`apps/web/src/csv.test.ts` 覆盖 `= + @ \t`、公式加逗号、负数与科学计数法；`apps/web/src/report.test.ts` 覆盖报告导出。
- 残余说明：CSV 公式防护只解决“导出后打开”的注入面，不替代对导出文件接收方的信任管理。

### SEC-02 设计文件/参数文件导入（已加固）

- 规则：React File Upload / 不可信输入 / 原型污染防护
- 严重度：Medium（若直接信任 JSON 并合并到对象，可导致存储污染、界面崩溃或后续逻辑被绕过）
- 位置：
  - 设计文件解析：`apps/web/src/designFile.ts:153-211`
  - 递归净化与原型污染键拒绝：`apps/web/src/designFile.ts:80-106`
  - 草稿数量/体积限制：`apps/web/src/designFile.ts:108-136`
  - 稳压器字段校验：`apps/web/src/regulatorData.ts:126-193`
  - 稳压器列表重名/上限：`apps/web/src/regulatorData.ts:196-214`
  - 文件选择与覆盖确认：`apps/web/src/App.tsx:91-134`、`apps/web/src/desktop.tsx:673-713`
  - 草稿 id 白名单、危险键拒绝与导入回滚：`apps/web/src/draftStore.ts:134-214`
- 证据（关键限制）：

  ```ts
  // designFile.ts
  export const MAX_DESIGN_FILE_BYTES = 1024 * 1024;
  export const MAX_DESIGN_DRAFTS = 100;
  export const MAX_DRAFT_BYTES = 200 * 1024;

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  ```

- 影响：若缺少校验，恶意/损坏文件可写入任意 localStorage 键、注入 `__proto__` 结构、用超大 JSON 阻塞页面，或把非法数值带入计算与报告。
- 修复：
  - 只接受普通对象/数组/有限数字/字符串/布尔/null；
  - 限制 1 MB 文件、100 份草稿、单份 200 KB、总草稿 600 KB、嵌套 10 层、单字符串 20000 字符；
  - 拒绝 `__proto__` / `constructor` / `prototype`；
  - 稳压器名称、Vref/Iadj 范围、`min ≤ typ ≤ max`、重名、内置型号冲突全部校验；
  - 导入前 `window.confirm` 明确提示将覆盖本机草稿与自定义稳压器；
  - 不把上传内容渲染为 HTML/SVG，也不创建 iframe/object/embed 预览。
- 验证：`designFile.test.ts`、`regulatorData.test.ts` 覆盖超大文件、未来版本、非法 `active`、原型污染、非有限数值、超长字符串、CSV 引号/逗号往返。
- 残余说明：草稿内部仍是“JSON 基础类型已净化”，不是针对每个计算器字段的完整业务 schema；来自非本应用导出的畸形草稿可能让个别面板显示异常。若未来支持第三方设计文件，建议增加按计算器 id 的字段级 schema。

### SEC-03 缺少 CSP 与安全响应头（配置已补齐，待真实部署验证）

- 规则：REACT-CSP-001 / REACT-HEADERS-001
- 严重度：Medium（配置层已缓解；真实环境未验证前仍保留）
- 位置：
  - Netlify / Cloudflare Pages：`apps/web/public/_headers`
  - Nginx：`deploy/nginx-calcbridge.conf`
  - 本地预览：`apps/web/vite.config.ts:6-40`（`preview.headers`）
  - 说明：`deploy/README.md`
- 证据：已配置 `Content-Security-Policy`、`X-Content-Type-Options: nosniff`、
  `Referrer-Policy: no-referrer`、`Permissions-Policy`、`X-Frame-Options: DENY` 与
  `frame-ancestors 'none'`。CSP 为 `script-src 'self'`、`style-src 'self' 'unsafe-inline'`；
  后者是因为色环与蒙特卡洛条形图使用 React 内联 `style` 属性。
- 影响：若未来引入富文本、第三方脚本或新的 DOM sink，缺少 CSP 会放大 XSS 影响；当前已通过部署配置提供纵深防御。
- 剩余动作：在实际 CDN/反向代理上确认响应头生效；首次上线建议先用
  `Content-Security-Policy-Report-Only` 观察，再切换为强制模式。
- 验证方式：`npm run preview` 后 `curl -I http://127.0.0.1:4173/`。
- 误报说明：仓库内配置不代表线上一定生效，仍需在真实域名检查响应头。

## 低危 / 工具链

### SEC-04 开发依赖漏洞（已修复）

- 规则：REACT-SUPPLY-001
- 严重度：Low（对最终用户）；修复前工具链自身为 Critical/High
- 位置：`package.json:24-29`、`apps/web/package.json:17-23`、`package-lock.json`
- 原证据：升级前 `npm audit` 报告 6 个漏洞（2 critical、1 high、3 moderate），全部位于开发依赖链：
  - `vitest < 3.2.6`（GHSA-5xrq-8626-4rwp，Vitest UI server 任意文件读取/执行）
  - `tinypool <= 2.1.1`（GHSA-5gmw-xhrv-c9v3、GHSA-85c8-ppgw-ccpr，原型污染到 RCE）
  - `vite <= 6.4.3`（多个开发服务器路径穿越/launch-editor 相关公告）
- 影响：不影响 `dist` 静态产物与最终用户，但会影响开发机与 CI：若暴露 Vitest UI / Vite 开发服务器，攻击者可能读取文件或执行代码。
- 修复：
  - 已升级 `vitest 2.1.9 → 5.0.5`、`vite 5.4.21 → 8.3.5`、`@vitejs/plugin-react → 6.1.2`；
  - `.github/workflows/ci.yml` 使用 `npm ci`，typecheck、测试、构建、`audit:prod`、`audit:all` 全部作为阻断门禁；
  - `docs/toolchain-upgrade-plan.md` 记录升级结果、兼容点与后续维护流程；
  - `server.host` 已默认限制为本机。
- 当前验证：`npm audit --omit=dev` 与 `npm audit` 均返回 **0 漏洞**。
- 残余说明：CI 需要 Node `22.12+`；本地升级用 `npm install` 已完成，CI 首次运行应确认 `npm ci` 与锁文件一致。

### SEC-05 Vite 开发服务器监听所有网卡（已修复）

- 规则：最小暴露面
- 严重度：Low（仅开发环境）
- 位置：`apps/web/vite.config.ts:29-34`
- 证据：

  ```ts
  server: {
    port: 5173,
    host: process.env.CALCBRIDGE_DEV_HOST || '127.0.0.1',
    headers: BASE_SECURITY_HEADERS,
  }
  ```

- 影响：原配置 `host: true` 会让同一局域网内的其他设备访问开发服务器；结合开发服务器漏洞会扩大风险。
- 修复：默认仅监听 `127.0.0.1`；需要手机/局域网联调时显式设置
  `CALCBRIDGE_DEV_HOST=0.0.0.0`。
- 说明：该改动需要重启开发服务器才生效。

## 信息项

### SEC-INFO-01 未发现危险 DOM sink、密钥或令牌存储

- 检索结果：`dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、`eval`、`new Function`、`DOMParser`、`createContextualFragment` 均无匹配。
- Web Storage 仅保存草稿、单位制、当前页面、导航折叠状态与自定义稳压器，不含会话令牌、密码或密钥。
- 文件导入只通过 React 文本节点展示错误/名称，不使用 HTML/SVG 预览。
- 结论：当前 XSS 面很小；仍建议用 CSP 作为纵深防御（SEC-03）。

### SEC-INFO-02 Redis 不适用于当前架构

- 当前应用是静态 SPA：无后端服务、无用户会话、无多用户协作、无共享缓存、无后台计算任务队列，所有数据仅保存在本机 localStorage。
- 引入 Redis 只会增加部署与运维面，无法带来当前缺失的能力。因此本次不引入 Redis。
- 只有在未来出现以下需求时才评估 Redis：
  - 云端设计项目库/多设备同步 → Redis 作会话/项目缓存，并启用 ACL、认证、TLS、网络隔离与 TTL；
  - 多用户协作/实时状态 → Redis Streams 或 Pub/Sub；
  - 大批量 Monte Carlo/场解算任务 → Redis 队列 + worker，并设置任务超时与内存上限。
- 若届时启用，需遵循 Redis 技能中的 `security-acls`、`security-auth`、`security-network`、`ram-ttl`、`ram-limits`、`conn-pooling` 等规则。

---

## 参考案例与方案借鉴

本次没有复制第三方代码，只借鉴公开项目的设计思路：

- `tracespace/pcb-stackup-core`：把叠层作为结构化数据模型分层处理，便于校验与可视化。
- `coppertrack/pcb.js`：浏览器端 PCB 几何/叠层库，强调纯前端可计算性与数据驱动。
- `FEDEVEL/pcb-stackups-free-for-your-projects`、`byscg/PCBWay-Stackups`：板厂叠层以文件/数据包形式分发，说明“叠层文件”应带来源、版本与免责说明。
- OWASP File Upload Cheat Sheet：扩展名/类型白名单、大小限制、生成文件名、不要在本站渲染主动内容。
- OWASP CSV Injection / XSS Prevention：导出编码与输出上下文隔离。

对本项目的直接落地：

1. 设计文件与参数文件都带 `format` + `version`，拒绝未知版本；
2. 导入前限制大小/条目/深度，导入后只作为纯数据使用；
3. 叠层/稳压器数据保留“示例不等于板厂官方数据”的免责边界；
4. 不提供 HTML/SVG 文件预览，避免把文件导入变成主动内容执行面。

## 验证记录

| 检查                          | 结果                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `npm run typecheck`           | 通过                                                                                    |
| `npm test`                    | 27 个测试文件、157 个测试全部通过（Vitest 5.0.5）                                       |
| `npm run build:web`           | 通过（Vite 8.3.5 生产构建成功）                                                         |
| `npm run audit:prod`          | 0 个生产依赖漏洞                                                                        |
| `npm run audit:all`           | 0 个漏洞                                                                                |
| `npm run preview` + `curl -I` | 通过：CSP、`nosniff`、`Referrer-Policy`、`Permissions-Policy`、`X-Frame-Options` 均存在 |

## 建议的后续整改顺序

1. 在真实部署环境确认 CSP 与安全响应头生效；首次上线先用 Report-Only 观察。
2. 确认 CI 首次 `npm ci` 与升级后的锁文件一致。
3. 若未来接受第三方设计文件，增加按计算器 id 的字段级 schema 校验与导入预览。
4. 若未来上云，再按 Redis 安全与内存规则设计会话/缓存/任务队列；当前不引入。
