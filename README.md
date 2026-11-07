<div align="center">

<a id="top"></a>

<h1>樂創 LeChuang · calcbridge</h1>

<p><strong>面板式工程计算器</strong><br>左侧分类树 + 右侧计算面板，让每个数字都能追溯到公式、标准与假设</p>

<p>
  <a href="https://github.com/LeChuangDev/calcbridge/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/LeChuangDev/calcbridge/ci.yml?branch=main&amp;style=flat-square&amp;label=CI" alt="CI"></a>
  <a href="https://github.com/LeChuangDev/calcbridge/releases"><img src="https://img.shields.io/badge/version-0.6.0-2563eb?style=flat-square" alt="version 0.6.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-0f766e?style=flat-square" alt="Apache-2.0"></a>
</p>

<p>
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.6">
  <img src="https://img.shields.io/badge/React-18-087ea4?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&amp;logo=vite&amp;logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/Vitest-5-6e9f18?style=flat-square&amp;logo=vitest&amp;logoColor=white" alt="Vitest 5">
  <img src="https://img.shields.io/badge/Playwright-1.65-2ead33?style=flat-square&amp;logo=playwright&amp;logoColor=white" alt="Playwright">
</p>

<p>
  <a href="https://calc.zhangwenle.com"><strong>在线使用</strong></a> ·
  <a href="https://github.com/LeChuangDev/calcbridge/releases">下载安装包</a> ·
  <a href="https://github.com/LeChuangDev/calcbridge">开源仓库</a> ·
  <a href="docs/architecture.md">架构说明</a> ·
  <a href="docs/research-calculation-credibility.md">正确性报告</a>
</p>

</div>

---

> **19 个计算器**，覆盖电路与电源、PCB 与制造、高速与射频、参考规范与实用工具。
> 纯前端运行，输入与结果留在本机浏览器；也可打包为 Windows / Linux 离线版。
> 输出为**工程估算，不是认证依据**。

**`19` 个计算器　·　`17` 个受门禁数值模块　·　`111` 条外部基准用例　·　`6` 条阻抗 golden　·　`5` 大分类**

| **[快速开始](#快速开始)** | **[界面速览](#界面速览)** |   **[计算器一览](#计算器一览)**   |
| :-----------------------: | :-----------------------: | :-------------------------------: |
|   [工程命令](#工程命令)   |   [项目结构](#项目结构)   | [架构与工程约定](#架构与工程约定) |
|   [验证体系](#验证体系)   |   [文件格式](#文件格式)   |     [部署与安全](#部署与安全)     |
|     [离线版](#离线版)     |   [发布流程](#发布流程)   |       [已知边界](#已知边界)       |

---

## 为什么用它

| 特性           | 说明                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **依据可追溯** | 标准依据、模型类别、可信度与误差带由 `standards.ts` 单一维护，界面标识条与导出报告共用；外部基准用例必须带 `sourceVersion` |
| **量纲安全**   | 输入必须带单位，量纲不一致直接报错，不静默换算；任意变量可作已知量，反向求解用数值求根而非手写反公式                       |
| **输入即算**   | 参数变化立即重算，结果由输入派生、不回写输入框；必填项未齐时静默等待，避免输入过程中刷错误提示                             |
| **多标准并列** | 同一问题多模型 / 多标准并排展示（如 IPC-2221B 与 IPC-2152），不私自合并成一个数                                            |
| **算例闭环**   | 手册示例直接转回归用例；111 条外部基准用例 + 6 条阻抗 golden，超出容差或依据覆盖率不足即阻断 CI                            |
| **数据可携带** | 草稿自动记忆，支持设计文件（JSON）与稳压器参数（JSON / CSV）导入导出，导入前做尺寸、字段白名单与原型污染校验               |

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173/
```

提交前一把梭：

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build:web
```

开发服务器默认只监听 `127.0.0.1`。局域网或手机联调：

```powershell
$env:CALCBRIDGE_DEV_HOST='0.0.0.0'; npm run dev
```

首次运行 E2E 前需安装浏览器：`npx playwright install chromium`。

## 界面速览

| 能力         | 说明                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 工具目录首页 | 一次看全 19 个模块，全文检索标签 / 说明 / 关键词 / 标准号，支持收藏与最近使用 |
| 命令面板     | `Ctrl / Cmd + K` 搜工具与常用命令（切主题、切单位制、回首页）                 |
| 亮 / 暗主题  | 跟随系统偏好初始化，页头一键切换并记忆；所有颜色来自设计令牌                  |
| 左侧导航     | `/` 聚焦搜索、分类折叠、收藏置顶                                              |
| 深链         | 书签式 `#/计算器id`，可直接分享到某个面板                                     |
| 草稿记忆     | 每个模块的输入与模型选择自动存本机，切换页面或刷新后恢复                      |

> **快捷键**　`Ctrl / Cmd + K` 命令面板　·　`/` 聚焦导航搜索　·　`Ctrl / Cmd + Enter` 触发当前面板动作　·　`Esc` 关闭弹窗与菜单

---

## 计算器一览

| 分类       | 计算器             | 说明                                                                                                                       |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 电路与电源 | 稳压器（三端可调） | Vout = Vref × (1 + R2/R1) + Iadj × R2；支持反解 R1/R2、最小/典型/最大与精度容差、稳压器参数管理、JSON/CSV 参数文件导入导出 |
| 电路与电源 | 电阻计算器         | 串联 / 并联 / 分压（空载）等效阻值与分压比                                                                                 |
| 电路与电源 | Buck 电感选型      | CCM 电感量、纹波、峰值、有效值、饱和电流要求                                                                               |
| 电路与电源 | 线缆尺寸           | 按允许电压降选择标准公制线径（铜/铝，双线回路）                                                                            |
| 电路与电源 | LED 限流电阻       | R = (Vin − n·Vf) / If；E12/E24 标准值选型、实际电流偏差与 2 倍裕度功率档                                                   |
| PCB 与制造 | 走线宽度（载流）   | IPC-2221B 外层/内层公式法与 IPC-2152 图表法（近似）；并给出电阻、压降、功耗                                                |
| PCB 与制造 | 电气间隙           | IPC-2221 最小电气间隙查表（B1–B4 / A5–A7）                                                                                 |
| PCB 与制造 | 过孔参数           | 镀层电阻、压降、功耗、热阻、载流估算、电容/电感/上升时间；支持 mm/mil 与 oz 单位切换，以及常规/高密度/自定义工艺规则检查   |
| PCB 与制造 | 熔断电流           | 绝热能量平衡估算熔断电流与熔断时间                                                                                         |
| 高速与射频 | 传输线（受控阻抗） | 单端微带线：IPC-2141 + Hammerstad–Jensen 多模型并列、示例叠层/自定义叠层、正向 Z0 与反向线宽求解、模型一致性检查           |
| 高速与射频 | 射频衰减器         | Pi / T 无源衰减网络设计，含实际端接阻抗与衰减校验                                                                          |
| 高速与射频 | 矩形波导           | 空气填充矩形波导 TE10：截止频率、导波波长、相速/群速、波阻抗                                                               |
| 高速与射频 | 趋肤深度           | 高频趋肤深度 δ、有效导电厚度、Rac/Rdc 比值与临界频率（δ = 铜厚）                                                           |
| 参考与规范 | 电路板类别         | IPC-6012 Class 1/2/3 性能类别概要参考                                                                                      |
| 参考与规范 | 板材分类           | FR-4 / CEM / 金属基 / 高频 / 陶瓷 / 柔性等常见 PCB 基材对照                                                                |
| 参考与规范 | 电偶腐蚀           | 常用阳极指数差值法与环境阈值快速评估                                                                                       |
| 实用工具   | 单位换算           | 18 类常用工程单位，含温度偏移换算                                                                                          |
| 实用工具   | 色环电阻           | 4/5 环 IEC 60062 解码、容差范围与色环对照表                                                                                |
| 实用工具   | E 系列组合         | E1/E3/E6/E12/E24 标准值，1–4 个电阻串并联组合搜索（0.1Ω–9.1MΩ）                                                            |

工具元数据（分类、说明、搜索关键词）只在 `entities/calculator/model/navModel.ts` 登记，首页卡片、左侧导航与命令面板共用。

---

## 工程命令

### 开发与构建

| 命令                    | 作用                                                   |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | 启动开发服务器 `127.0.0.1:5173`                        |
| `npm run preview:web`   | 预览生产构建（默认 `4173`，用于验证安全头）            |
| `npm run build:web`     | 生产构建，产物在 `apps/web/dist`；面板按切片懒加载分包 |
| `npm run build:offline` | 生成离线版，产物在 `offline/`                          |
| `npm run demo`          | CLI 演示内核计算                                       |
| `npm run regression`    | 只跑算例回归                                           |

### 质量门禁（CI 阻断项）

| 命令                                | 作用                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `npm run typecheck`                 | 两个 tsconfig 全量类型检查                                                  |
| `npm run lint` / `lint:fix`         | ESLint：类型规范、React 规则、**FSD 分层依赖约束**                          |
| `npm run format` / `format:check`   | Prettier 统一格式                                                           |
| `npm test` / `npm run coverage`     | 全量单测 + 算例回归；后者附内核/求解器覆盖率门禁（lines≥80%、branches≥70%） |
| `npm run size`                      | 首屏 gzip 预算门禁：JS ≤ 100 KB、CSS ≤ 15 KB                                |
| `npm run test:e2e`                  | Playwright 冒烟：首页/面板、命令面板、深链与设计文件导出                    |
| `npm run benchmark:coverage:strict` | 17 个数值模块均需 ≥6 条用例且 ≥2 份可追溯依据                               |
| `npm run benchmark:run`             | 执行全部外部基准用例，超出容差即失败                                        |
| `npm run audit:prod` / `audit:all`  | 生产 / 全量依赖高危漏洞审计                                                 |

CI（`.github/workflows/ci.yml`）用 `npm ci` 安装，两个 job：`verify` 依次跑上述门禁，`e2e` 单独跑 Playwright。

### 数据与依据

| 命令                                                       | 作用                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `npm run benchmark:coverage`                               | 外部基准覆盖率报告（不阻断）                              |
| `npm run benchmark:run:report`                             | 只出基准执行报告，不校验容差                              |
| `npm run validate:impedance` / `validate:impedance:strict` | 微带线阻抗外部校验；strict 要求 Polar 与 Sigrity 数据齐全 |

`validation/benchmarks/cases.json` 只收录可公开复现的数据，每条用例必须带 `sourceVersion`，并按 `evidence` 标注证据类型：

| 证据类型    | 含义                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| `table`     | 标准表格或厂商公开表值（IPC-2221B 间隙表、IEC 60228 导体电阻、EIA-261 波导尺寸） |
| `recompute` | 按公开公式独立复算（TI AN-1192、LM317 数据手册、Onderdonk 熔断公式）             |
| `tool`      | 工具导出或在线计算器查询（当前仅阻抗 golden 中的嘉立创叠层）                     |

<details>
<summary><strong>展开：外部基准的完整来源清单</strong></summary>

当前来源包括 IPC-2221B / IPC-2152、IEC 60228 / IEC 60063 / IEC 60062、NIST SP 811、EIA-261、TI LM317 / LM1117 / AN-1192 / SLVA477B / SNVA766、Electronics Notes 衰减器速查表、ElectroCalc / NextPCB 趋肤深度表、MIL-STD-889 / AZOM 阳极指数表。商业工具 Polar / Sigrity 数据仍未导入，覆盖率报告不会把公开数据标成「工具对标」。

</details>

---

## 项目结构

```
packages/
├─ core/           # 计算内核：量纲、表达式、求解器、不确定度、回归（零依赖）
├─ calculators/    # 计算器即数据：稳压器、电阻、走线载流、受控阻抗、Buck 电感…
└─ cli/            # 验证 CLI：demo / regression / validate-impedance
validation/        # Polar / Sigrity / 场解算 / coupon 对照数据与外部基准用例
e2e/               # Playwright 冒烟用例
apps/web/src/      # Feature-Sliced Design 六层
   ├─ app/         # 应用入口与外壳：main.tsx、App.tsx、全局样式
   ├─ pages/       # 页面组合：home（工具目录）、calculator（面板路由与懒加载）
   ├─ widgets/     # 独立界面块：标题栏、菜单栏、导航树、命令面板、弹窗
   ├─ features/    # 业务切片：计算器面板（数据驱动模块共用通用面板）+ 设计文件导入导出
   ├─ entities/    # 领域数据：工具目录、草稿、稳压器、报告、收藏、标准依据
   └─ shared/      # 无业务语义的基础设施：ui / lib / config
deploy/            # 部署与打包：Nginx 配置、Windows 安装包（Inno Setup）、Linux deb 脚本
offline/           # 离线启动器与安装脚本（start.py / install.bat / install.sh）
scripts/           # 体积门禁、离线构建、基准覆盖率与执行脚本
.github/workflows/ # CI（push/PR 校验）与 Release（打标签自动出安装包）
edgeone.json       # EdgeOne Pages 构建配置
```

> 延伸阅读　[docs/architecture.md](docs/architecture.md)（分层约束与新增计算器步骤）·
> [docs/research-calculation-credibility.md](docs/research-calculation-credibility.md)（正确性保障体系）·
> [docs/toolchain-upgrade-plan.md](docs/toolchain-upgrade-plan.md)（工具链升级记录）

## 架构与工程约定

依赖方向只能自上而下，反向引用由 `npm run lint` 阻断：

```mermaid
flowchart LR
  A["app · 应用外壳"] --> B["pages · 页面组合"]
  B --> C["widgets · 界面块"]
  C --> D["features · 业务切片"]
  D --> E["entities · 领域数据"]
  E --> F["shared · 基础设施"]
```

| 内容              | 唯一位置                                 |
| ----------------- | ---------------------------------------- |
| 工具元数据        | `entities/calculator/model/navModel.ts`  |
| 标准依据与可信度  | `entities/calculator/model/standards.ts` |
| localStorage 键名 | `shared/config/storageKeys.ts`           |
| 版本常量          | `shared/config/constants.ts`             |
| 设计令牌（颜色）  | `app/styles/tokens.css`                  |
| 定制面板路由      | `pages/calculator/model/registry.ts`     |

其他约定：

- **计算器即数据**：通用计算器 = 一份 `CalcSpec`（变量 / 模型 / 约束 / 算例），只有需要定制交互的模块才在 `registry.ts` 登记独立面板；新增计算器不改外壳。
- **状态派生**：能由输入推导的结果一律 `useMemo` 派生，不写回 state；仅不确定度分析（蒙特卡洛）保留防抖与手动开关。
- **输入单位自由**：通用面板每个输入可切换兼容单位；扩展计算读取内核换算后的声明单位值。
- **草稿记忆**：输入、模型选择自动存本机，可在「设置 → 清除全部页面草稿」统一清理。
- **设计文件可携带**：`文件 → 导出设计文件（JSON）` 打包各页面草稿、单位制、当前页面与自定义稳压器；导入前严格校验大小、版本、字段白名单、条目数与原型污染键。
- **参数文件可交换**：稳压器页支持 JSON/CSV 参数文件导入导出，CSV 仅接受已知列，导入替换自定义项，内置型号不可覆盖。
- **跨层走别名**：跨目录引用统一用 `@/` 别名，禁止三层以上的 `../../..` 相对路径；切片通过 `index.ts` 暴露公共 API。

实现细节：设计文件校验见 `apps/web/src/features/design-file/model/designFile.ts`，稳压器参数校验见 `apps/web/src/entities/regulator/model/regulatorData.ts`，安全审查说明见 `security_best_practices_report.md`。

## 验证体系

| 层次     | 位置                                                               | 覆盖                            |
| -------- | ------------------------------------------------------------------ | ------------------------------- |
| 纯函数   | `packages/calculators/test/`、`packages/core/test/`                | 求解器、量纲、算例回归          |
| 领域逻辑 | `features/calculator-*/model/`、`entities/*/model/`、`shared/lib/` | 视图模型、规则、存储与工具函数  |
| 组件冒烟 | `app/App.test.tsx`、`pages/calculator/ui/panels.smoke.test.tsx`    | 路由、导航、命令面板、主题      |
| 端到端   | `e2e/smoke.spec.ts`                                                | 首页/面板、命令面板、深链、导出 |

---

## 文件格式

### 稳压器参数（CSV）

```csv
name,vref_min,vref_typ,vref_max,iadj_min,iadj_typ,iadj_max
TPS7A47,1.0,1.25,1.5,10,20,30
```

- `json` 文件使用同名字段的驼峰形式，或应用导出的 `format: "calcbridge-regulators"` 包络。
- `name`、`vref_typ`、`iadj_typ` 必填；数值必须有限且满足 `min ≤ typ ≤ max`。
- 名称不能与内置型号（LM317、LM1117-ADJ、LM338、TL317）重名，同文件内也不能重名。
- 单文件上限 256 KB、最多 50 个稳压器；导入按「全有或全无」处理，任一行无效即拒绝整份文件。
- 导出 CSV 会对以 `= + - @` 开头的单元格加文本前缀，避免 Excel / WPS 公式注入。

### 设计文件（JSON）

```json
{
  "format": "calcbridge-design",
  "version": 1,
  "unitSystem": "metric",
  "active": "via",
  "drafts": { "via": { "hole": "0.4" } },
  "customRegulators": []
}
```

- 文件上限 1 MB、最多 100 份草稿、单份草稿 200 KB；只接受 JSON 基础类型。
- 拒绝 `__proto__` / `constructor` / `prototype` 键、非有限数值、超深嵌套与未知版本。
- 导入整体替换本机草稿与自定义稳压器，建议先导出当前设计作为备份。
- 设计文件只适合在本工具中往返使用，不是板厂制造文件，也不含 Polar / Sigrity 校验数据。

## 部署与安全

- 构建：`npm run build:web`，产物 `apps/web/dist`；本地验证安全头用 `npm run preview:web` 后执行 `curl -I http://127.0.0.1:4173/`。
- EdgeOne Pages：根目录 `edgeone.json` 已声明构建命令、输出目录与 Node 版本，导入仓库即可部署；线上 <https://calc.zhangwenle.com>。
- Netlify / Cloudflare Pages：`apps/web/public/_headers` 会随构建复制到 `dist/_headers`。
- Nginx：参考 `deploy/nginx-calcbridge.conf`；Vercel：参考 `deploy/README.md` 中的 headers / rewrites 配置。
- 性能：`registry.ts` 全部动态 `import()`，首屏只含外壳、首页与 React；React 单独分包长期缓存，`npm run size` 对首屏 JS/CSS 做 gzip 预算门禁。
- 生产安全头（CSP、X-Content-Type-Options、Referrer-Policy 等）与逐平台配置见 `deploy/README.md`。

## 离线版

- 生成：`npm run build:offline`，产物在 `offline/`（静态资源 + Python 标准库启动器，无第三方依赖）。
- 免安装：`python offline/start.py`，或 Windows 双击 `offline/start.bat`。
- Windows 安装：双击 `offline/install.bat`（当前用户安装，创建开始菜单/桌面快捷方式与卸载项）。
- Linux 安装：`bash offline/install.sh`（默认 `~/.local`）；`sudo bash offline/install.sh --system` 安装到 `/usr/local`。
- 卸载：Windows 在「设置 → 应用」中卸载，或运行安装目录下的 `uninstall.bat`；Linux 运行 `~/.local/share/calcbridge/uninstall.sh`。
- 端口默认从 8787 起自动选择空闲端口，可用 `--port` 指定；数据保存在浏览器 localStorage。

## 发布流程

版本号取自 `package.json` 的 `version`。打标签并推送即触发自动发布：

```bash
git tag -a v0.5.1 -m "calcbridge v0.5.1"
git push origin v0.5.1
```

`.github/workflows/release.yml` 会并行构建四类产物并自动创建 Release：

| 平台            | 产物                                      |
| --------------- | ----------------------------------------- |
| Windows 安装    | `calcbridge-<版本>-windows-setup.exe`     |
| Windows 便携    | `calcbridge-<版本>-windows-portable.zip`  |
| Debian / Ubuntu | `calcbridge_<版本>_all.deb`               |
| Linux 便携      | `calcbridge-<版本>-linux-portable.tar.gz` |

也可以在 Actions 页面手动运行 Release 工作流并填写版本号（不带 `v` 前缀）。

---

## 已知边界

<details>
<summary><strong>展开：12 项模型边界与适用范围</strong></summary>

- IPC-2152 采用保守图表（无参考平面 / 自由空气近似），已按 4A/10°C=300 sq mil、10A/20°C=680 sq mil 公开示例校准；有大面积参考平面时应按标准平面修正系数另算，当前模型偏保守。
- 阻抗页为微带线准静态多模型估算，不含阻焊、铜箔粗糙度、频变 Dk/Df、差分/带状线/共面波导与 2D 场解算；示例叠层不是板厂官方叠层，生产前必须用实际叠层与阻抗 coupon 复核。
- Polar / Sigrity 对照数据尚未导入；当前已有 17 个数值模块通过公开标准/厂商手册验证（111 条用例 + 6 条阻抗 golden），但「标准验证」不等同于商业工具对标；`validate:impedance:strict` 会因缺少 Polar / Sigrity 数据阻断。
- 熔断、过孔载流、电偶腐蚀为工程估算模型，不含散热、镀层体系、实际介质与试验修正；电偶腐蚀按 MIL-STD-889 常用阈值（受控 0.50 V / 一般 0.25 V / 海洋 0.15 V）筛选，不同来源的阳极指数表可能略有差异。
- 过孔页的「常规板 / 高密度板」工艺规则为示例阈值，必须按目标板厂能力表修改；自定义规则按 mm 输入。1 oz 铜厚按 35 µm 换算。
- 线缆尺寸仅按电压降选型，不含载流量、绝缘耐压、敷设与温度校正。
- 矩形波导仅覆盖空气填充、理想导体壁的 TE10 单模公式。
- 射频衰减器仅覆盖可实现的 Pi / T 无源网络。
- 趋肤深度为单侧趋肤近似（铜 μr ≈ 1），不含铜箔粗糙度、邻近效应与差分耦合；实际高频损耗需场解算或实测复核。
- LED 限流电阻按恒压降模型，不含 Vf 随电流/温度漂移与批次离散；并联 LED 必须各自串电阻。
- 电路板类别按 IPC-6012 性能类别提供概要参考；板材分类另页给出常见基材典型范围，两者不是同一概念。
- 板材页的 Tg、Dk、Df、导热率与 CTE 为典型范围，随厂家牌号、频率与工艺变化，不可直接作为验收依据。

</details>

---

<div align="center">

<p><strong>免责声明</strong>　本工具输出均为工程估算，非认证、非实测结论；安全相关项（安规间距、熔断、绝缘）必须实测或送认证。</p>

<p>本项目基于 <a href="LICENSE">Apache License 2.0</a> 开源 · Copyright © 2026 樂創 LeChuang · <a href="#top">回到顶部</a></p>

</div>
