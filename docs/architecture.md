# 前端架构说明（apps/web）

> 目标：让「新增一个计算器」不需要改动外壳，让「改一处样式」不需要翻遍全库，
> 让架构约束可以被 CI 检查，而不是只写在文档里。

## 分层

```
apps/web/src/
├─ app/                 应用外壳：路由、标题栏、菜单栏、导航树、命令面板、弹窗
│  └─ providers/        全局状态 Provider（单位制、主题）
├─ features/            业务领域：每个计算器一个目录（面板 + 求解器 + 测试 + 类型）
│  └─ registry.ts       面板路由表（只有定制交互的计算器才登记）
├─ components/          共享 UI 原语：无业务语义的展示组件与图形
├─ lib/                 基础设施：草稿、报告、文件、单位、CSV、下载、偏好
├─ data/                静态元数据：工具目录（分类 / 说明 / 关键词）
└─ styles/              样式：令牌 → 基础 → 外壳 → 面板 → 控件 → 首页 → 响应式
```

依赖方向只能自上而下：

```
app  →  features  →  components  →  lib  →  data
                ↘──────────────↗
```

- `lib` 不依赖 `app` / `features` / `components`（ESLint 强制）
- `features` 不依赖 `app` 外壳（仅允许 `@/app/providers/*`，ESLint 强制）
- `components` 不依赖 `features`
- 跨层/跨模块引用统一使用 `@/` 别名，禁止三层以上的相对路径

## 约定

| 主题       | 约定                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 文件命名   | 组件 `PascalCase.tsx`；逻辑与数据 `camelCase.ts`；目录 `kebab-case`                                   |
| 计算位置   | 纯函数放在 `<feature>/xxxSolver.ts`，面板只做输入收集与结果渲染                                       |
| 状态派生   | 能由输入推导的结果一律用 `useMemo` 派生，不写回 state（避免双向数据源）                               |
| 持久化     | localStorage 键名统一在 `lib/storageKeys.ts`，禁止散落字符串                                          |
| 样式       | 颜色/圆角/字体一律引用 `styles/tokens.css` 的变量，禁止写死色值                                       |
| 测试       | 求解器必须带 `*.test.ts`；测试与实现同目录                                                            |
| 新增计算器 | ① `data/navModel.ts` 登记元数据 ② 写 solver + 测试 ③ 写面板 ④ 需要定制交互才进 `features/registry.ts` |

## 实时计算

所有计算器在输入变化时立即重算（行业工具如 Saturn PCB Toolkit 的一致体验）：

- 派生结果不写入 state，避免「输入 → 结果 → 覆盖输入」的循环写回
- 必填项未齐时返回 `empty` 状态而非报错，避免输入过程中刷错误提示
- 不确定度分析（蒙特卡洛）较重，仍保留 200ms 防抖与手动开关

## 主题

`styles/tokens.css` 是唯一的颜色来源，`:root[data-theme='light']` 覆盖同一组变量即可切换。
`app/providers/ThemeProvider.tsx` 负责跟随系统偏好初始化并持久化用户选择。

## 可观测的约束

`npm run lint` 会把上述分层规则、类型导入风格、React Hooks 规则与未使用变量一起检查；
`npm run format:check` 保证格式统一；两者都是 CI 阻断项。
