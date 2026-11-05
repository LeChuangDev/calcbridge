# Vite / Vitest 工具链升级记录

## 状态

已于 2026-10-30 完成大版本升级并通过全量验证。

## 升级结果

| 包                     | 升级前   | 当前    |
| ---------------------- | -------- | ------- |
| `vitest`               | `2.1.9`  | `5.0.5` |
| `vite`（Web 构建）     | `5.4.21` | `8.3.5` |
| `@vitejs/plugin-react` | `4.x`    | `6.1.2` |

说明：

- `vitest 5` 内部使用 `vite 7.3.7` 作为运行时依赖；Web 生产构建使用 `vite 8.3.5`，两者通过 npm 的嵌套/提升机制共存。
- 本机 Node `v24.18.1`；CI 使用 Node 22（需 `22.12+`）。
- `npm run audit:prod` 与 `npm run audit:all` 均为 **0 漏洞**。

## 本次验证

```bash
npm ci --dry-run   # 本地验证锁文件一致；CI 在 Linux 上执行完整 npm ci
npm run typecheck
npm test           # 27 个测试文件 / 157 个测试
npm run build:web
npm run audit:prod
npm run audit:all
```

> Windows + Trae 沙箱环境下完整 `npm ci` 会受 workspace junction 清理限制；`npm ci --dry-run`
> 已确认锁文件与 manifest 一致，完整 `npm ci` 由 GitHub Actions 的 Linux runner 执行。

另外验证：

- `npm run preview` 的响应头包含生产 CSP 与安全头；
- 稳压器数据文件 JSON/CSV 导入导出、设计文件导入/导出回归通过；
- 恶意/超大文件拒绝、原型污染与 CSV 注入测试通过。

## 兼容点记录

1. **Vite 8 构建器**：`packages/core`、`packages/calculators` 的 TS 源码仍通过
   `optimizeDeps.exclude` 正常消费，生产包无重复 React 或未解析符号。
2. **plugin-react 6**：React Refresh（开发）与生产 JSX 转换正常；未启用可选 oxc/compiler peer。
3. **Vitest 5**：`vitest run` 退出码、测试发现规则与现有 `*.test.ts` 命名兼容；未使用 Vitest 2
   专有 API。
4. **Node 版本**：CI 与开发机统一在 Node 22.12+。
5. **安全头**：`npm run preview` 返回 CSP、`X-Content-Type-Options`、`Referrer-Policy`、
   `X-Frame-Options`。
6. **文件导入**：设计文件与稳压器 JSON/CSV 的导入导出、恶意/超大文件拒绝测试保持通过。

## 后续维护

- CI 固定 `npm ci`，禁止在 CI 中使用 `npm install` 漂移依赖树。
- CI 阻断项：typecheck、测试、生产构建、`audit:prod`、`audit:all`。
- 依赖更新应单独提交，并保持以下验收标准：
  - `npm ci` 成功且锁文件无漂移；
  - typecheck / test / build 全部通过；
  - 两项 audit 均为 0 高危；
  - preview 安全头有效；
  - 手工回归稳压器数据文件、设计文件、阻抗页、过孔页与报告导出。
- 如未来再次出现开发工具链漏洞，可沿用“单独分支升级 + 全量回归 + audit 门禁”的流程。

## 回滚参考

升级前 `package.json` 与 `package-lock.json` 已备份到本机临时目录；若后续需要回滚，恢复两份
文件后执行 `npm ci` 即可。仓库内不再保留临时备份文件。
