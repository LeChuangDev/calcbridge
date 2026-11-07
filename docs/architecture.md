# 前端架构说明（apps/web）

> 采用 Feature-Sliced Design（FSD）六层结构：`app → pages → widgets → features → entities → shared`。
> 目标：新增计算器不改外壳、改样式不翻全库，分层约束由 ESLint 在 CI 中强制执行。
> 更完整的 FSD 规范见 https://feature-sliced.design/ 。

## 目录

```
apps/web/src/
├─ app/                 应用层：入口 main.tsx、外壳 App.tsx、全局样式、Providers
│  ├─ styles/           令牌 → 基础 → 外壳 → 面板 → 控件 → 首页 → 响应式
│  └─ App.test.tsx      外壳冒烟测试
├─ pages/               页面层：只做组合与编排
│  ├─ home/             工具目录首页（ui/ + index.ts）
│  └─ calculator/       计算面板页：懒加载路由表 + 面板冒烟测试
├─ widgets/             组件层：可独立复用的界面块
│  ├─ title-bar/  menu-bar/  side-nav/  command-palette/
│  ├─ about-dialog/  display-controls/
│  └─ 每个切片 = ui/ + index.ts
├─ features/            功能层：一次用户动作对应的业务切片
│  ├─ calculator-*/     19 个计算器（ui/ 面板 + 可选 model/ 视图模型 + index.ts）
│  └─ design-file/      设计文件导入导出
├─ entities/            实体层：领域数据与状态
│  ├─ calculator/       工具目录元数据（navModel）
│  ├─ draft/            页面草稿持久化
│  ├─ regulator/        稳压器参数与自定义型号
│  ├─ report/           报告快照与导出
│  └─ preferences/      收藏与最近使用
└─ shared/              共享层：不含业务语义
   ├─ ui/               输入框、结果卡、模态框、电路示意图
   ├─ lib/              单位换算、表达式桥接、CSV、下载、热键、Providers
   └─ config/           版本常量、localStorage 键名
```

## 依赖方向

只能自上而下引用，禁止反向或跨层：

```
app → pages → widgets → features → entities → shared
```

| 层         | 允许依赖                               | ESLint 规则                           |
| ---------- | -------------------------------------- | ------------------------------------- |
| `app`      | 全部下层                               | 无额外限制                            |
| `pages`    | widgets / features / entities / shared | 禁止 `@/app/**`                       |
| `widgets`  | features / entities / shared           | 禁止 `@/app/**`、`@/pages/**`         |
| `features` | entities / shared（含本切片）          | 禁止 app / pages / widgets            |
| `entities` | shared                                 | 禁止 app / pages / widgets / features |
| `shared`   | 无                                     | 禁止所有上层                          |

补充约定：

- 每个切片通过根目录 `index.ts` 暴露公共 API，上层不得深链到 `ui/`、`model/` 内部。
- 跨层/跨模块引用统一使用 `@/` 别名，禁止三层以上的 `../../..` 相对路径。
- 切片内部可以相对引用（`./model/xxx`、`@/features/<自己>`）。

## 约定

| 主题       | 约定                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文件命名   | 组件 `PascalCase.tsx`；逻辑与数据 `camelCase.ts`；目录 `kebab-case`                                                                                                                                                  |
| 计算位置   | 可复用纯求解器放在 `packages/calculators/src/<module>/`，`ui/` 只做输入收集与结果渲染；仅 UI 专用的视图模型留在 `<feature>/model/`                                                                                   |
| 状态派生   | 能由输入推导的结果一律用 `useMemo` 派生，不写回 state（避免双向数据源）                                                                                                                                              |
| 持久化     | localStorage 键名统一在 `shared/config/storageKeys.ts`，禁止散落字符串                                                                                                                                               |
| 样式       | 颜色/圆角/字体一律引用 `app/styles/tokens.css` 的变量，禁止写死色值                                                                                                                                                  |
| 测试       | 求解器必须带 `*.test.ts`，统一放 `packages/calculators/test/`；跨切片冒烟测试放 `pages/calculator/ui/`                                                                                                               |
| 新增计算器 | ① `entities/calculator/model/navModel.ts` 登记 ② 纯求解器放 `packages/calculators/src/xx/` 并补测试 ③ `features/calculator-xx/` 建 ui ④ 加 index.ts 并在 `pages/calculator/model/registry.ts` 登记（仅定制交互需要） |

## 性能设计

- **首屏**：`pages/calculator/model/registry.ts` 全部使用动态 `import()`，首屏只含外壳、首页与 React；
  `App.tsx` 用 `Suspense` 兜底，`prefetchWhenIdle` / 导航悬停触发预取。
- **渲染**：数据驱动面板用 `useDeferredValue` 让输入即时响应、求解低优先级跟进；结果用 `useMemo` 派生。
- **构建**：React 单独分包（`react-vendor`），业务面板按切片分包；`npm run size` 对首屏 JS/CSS 做 gzip 预算门禁，CI 阻断。
- **缓存**：`/assets/*` 带内容指纹，EdgeOne（`edgeone.json`）与 Netlify/Cloudflare（`_headers`）均设置一年 immutable 缓存，HTML 不缓存。

## 实时计算

所有计算器在输入变化时立即重算（与 Saturn PCB Toolkit 一致的体验）：

- 派生结果不写入 state，避免「输入 → 结果 → 覆盖输入」的循环写回
- 必填项未齐时返回 `empty` 状态而非报错，避免输入过程中刷错误提示
- 不确定度分析（蒙特卡洛）较重，保留防抖与手动开关

## 主题

`app/styles/tokens.css` 是唯一的颜色来源，`:root[data-theme='light']` 覆盖同一组变量即可切换。
`shared/lib/providers/ThemeProvider.tsx` 负责跟随系统偏好初始化并持久化用户选择。

## 可观测的约束

`npm run lint` 检查分层边界、类型导入风格、Hooks 规则与未使用变量；
`npm run format:check` 保证格式统一；`npm run coverage` 对内核与求解器设置
lines/statements/functions ≥80%、branches ≥70% 的门禁；`npm run size` 保证首屏预算；
`npm run test:e2e` 用 Playwright 覆盖首页/面板、命令面板、深链与设计文件导出；均为 CI 阻断项。

计算依据与可信度由 `entities/calculator/model/standards.ts` 单一维护，页面标识条与报告导出共用；
输入工程范围由 `VariableSpec.limits` 声明，`packages/core/src/validation/limits.ts` 统一判定，
数据驱动面板通过 `InputField` 展示黄色警告，不阻断输入。
