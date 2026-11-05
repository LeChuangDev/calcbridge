# 樂創 LeChuang · calcbridge — 面板式工程计算器

> 面板式工程计算工具：左侧分类树 + 右侧计算面板（电路/截面示意、计算公式、输入与结果）。
> 所有结论尽量可追溯到公式、标准条款与假设；输出为工程估算，非认证依据。

## 当前计算器

| 分类       | 计算器             | 说明                                                                                                                       |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 电路与电源 | 稳压器（三端可调） | Vout = Vref × (1 + R2/R1) + Iadj × R2；支持反解 R1/R2、最小/典型/最大与精度容差、稳压器参数管理、JSON/CSV 参数文件导入导出 |
| 电路与电源 | 电阻计算器         | 串联 / 并联 / 分压（空载）                                                                                                 |
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

## 目录结构

```
packages/
├─ core/           # 计算内核：量纲、表达式、求解器、不确定度、回归（零依赖）
├─ calculators/    # 计算器即数据：稳压器、电阻、走线载流、受控阻抗、Buck 电感
└─ cli/            # 验证 CLI：demo / regression / validate-impedance
validation/
└─ impedance/      # Polar / Sigrity / 场解算 / coupon 对照数据与校验说明
apps/
└─ web/src/
   ├─ app/         # 应用外壳：路由、标题栏、菜单栏、导航树、命令面板、弹窗
   ├─ providers/   # 全局状态：单位制、主题
   ├─ features/    # 业务领域：每个计算器一个目录（面板 + 求解器 + 测试）
   ├─ components/  # 共享 UI 原语（无业务语义）
   ├─ lib/         # 基础设施：草稿、报告、文件、单位、CSV、下载、偏好
   ├─ data/        # 静态元数据：工具目录（分类 / 说明 / 关键词）
   └─ styles/      # 令牌 → 基础 → 外壳 → 面板 → 控件 → 首页 → 响应式
```

分层约束与新增计算器的步骤见 `docs/architecture.md`，且由 `npm run lint` 强制检查。

设计文件、稳压器参数文件与安全审查说明分别见 `apps/web/src/designFile.ts`、
`apps/web/src/regulatorData.ts`、`security_best_practices_report.md`；生产安全头与部署说明见
`deploy/README.md`。

## 快速开始

```bash
npm install
npm run dev          # 启动界面 http://localhost:5173/
npm test             # 全量单元测试 + 算例回归
npm run typecheck    # TypeScript 类型检查
npm run build:web    # 生产构建
npm run lint         # ESLint：类型规范 + React 规则 + 分层依赖约束
npm run format       # Prettier 统一格式
npm run regression   # 仅跑算例回归
npm run validate:impedance         # 微带线阻抗外部校验（Polar/Sigrity 数据待导入）
npm run validate:impedance:strict  # 强制要求 Polar 与 Sigrity 数据都已导入
npm run audit:prod   # 生产依赖漏洞审计
npm run audit:all    # 全量依赖审计
```

开发服务器默认只监听 `127.0.0.1`。如需手机或局域网联调：

```bash
# PowerShell
$env:CALCBRIDGE_DEV_HOST='0.0.0.0'; npm run dev
```

## 部署与安全

- 构建：`npm run build:web`，产物在 `apps/web/dist`。
- Netlify / Cloudflare Pages：`apps/web/public/_headers` 会随构建复制到 `dist/_headers`。
- Nginx：参考 `deploy/nginx-calcbridge.conf`。
- Vercel：参考 `deploy/README.md` 中的 headers / rewrites 配置。
- 本地验证安全头：`npm run preview` 后执行 `curl -I http://127.0.0.1:4173/`。
- 测试分三层：`packages/*` 的内核与算例回归、`features/*/xxxSolver.test.ts` 的纯函数校验、
  `app/App.test.tsx` 与 `features/panels.smoke.test.tsx` 的 jsdom 组件冒烟（路由、命令面板、主题、新面板）。
- CI：`.github/workflows/ci.yml` 使用 `npm ci`，依次执行 typecheck、测试、构建、生产依赖审计与全量依赖审计（均为阻断项）。
- 工具链：Vite 8 / Vitest 5；升级记录与后续维护见 `docs/toolchain-upgrade-plan.md`。

## 离线版（Windows / Linux）

- 生成：`npm run build:offline`，产物在 `offline/`（静态资源 + Python 标准库启动器，无第三方依赖）。
- 免安装：`python offline/start.py`，或 Windows 双击 `offline/start.bat`。
- Windows 安装：双击 `offline/install.bat`（当前用户安装，创建开始菜单/桌面快捷方式与卸载项）。
- Linux 安装：`bash offline/install.sh`（默认 `~/.local`）；`sudo bash offline/install.sh --system` 安装到 `/usr/local`。
- 卸载：Windows 在「设置 → 应用」中卸载，或运行安装目录下的 `uninstall.bat`；Linux 运行 `~/.local/share/calcbridge/uninstall.sh`。
- 端口默认从 8787 起自动选择空闲端口，可用 `--port` 指定；数据保存在浏览器 localStorage。
- 预编译安装包：每次打 `v*` 标签会自动构建并发布到 [Releases](https://github.com/LeChuangDev/calcbridge/releases)，包含 Windows 安装包（`.exe`）、Windows 便携包（`.zip`）、Debian/Ubuntu 安装包（`.deb`）与 Linux 便携包（`.tar.gz`）。

## 设计约定

1. **计算器即数据**：通用计算器 = 一份 `CalcSpec`（变量/模型/约束/算例），新增计算器不发主版本。
2. **量纲安全**：输入必须带单位，量纲不一致直接报错，不静默换算。
3. **任意变量可作已知量**：反向求解用数值求根，不写反向公式。
4. **多标准并存**：同一问题多标准并列展示，不私自合并。
5. **算例校验**：手册示例直接转回归用例，偏差超阈值拒绝发布。
6. **输入单位自由**：通用面板的每个输入都可切换兼容单位；扩展计算读取内核换算后的声明单位值。
7. **草稿记忆**：每个模块的输入、模型选择与手动计算结果自动保存在浏览器本地，切换页面或刷新后恢复；可在「设置 → 清除全部页面草稿」中统一清理。
8. **设计文件可携带**：`文件 → 导出设计文件（JSON）` 会打包各页面草稿、单位制、当前页面与自定义稳压器；导入前严格校验大小、版本、字段白名单、条目数与原型污染键，并提示覆盖本机草稿。
9. **参数文件可交换**：稳压器页支持 JSON/CSV 参数文件导入导出；CSV 仅接受 `name`、`vref_*`、`iadj_*` 等已知列，导入会替换自定义项，内置型号不可覆盖。
10. **输入即算**：所有计算器在输入变化时立即重算，结果一律派生（不写回输入框）；必填项未齐时不报错，避免输入过程中刷错误。
11. **单一数据源**：工具元数据只在 `apps/web/src/data/navModel.ts` 登记；localStorage 键名只在 `apps/web/src/lib/storageKeys.ts` 定义；颜色只在 `apps/web/src/styles/tokens.css` 定义。
12. **跨层走别名**：跨目录引用统一使用 `@/` 别名，禁止三层以上的 `../../..` 相对路径。

## 界面能力

- **工具目录首页**：一次看全所有模块，支持全文检索（标签 / 说明 / 关键词 / 标准号），可收藏与查看最近使用。
- **命令面板**：`Ctrl / Cmd + K` 一处搜全部工具与常用命令（切主题、切单位制、回首页）。
- **亮 / 暗双主题**：跟随系统偏好初始化，页头一键切换并记忆；所有颜色来自设计令牌。
- **左侧导航**：搜索框（`/` 聚焦）、分类折叠、收藏置顶、书签式 `#/计算器id` 路由。

### 稳压器参数文件格式

CSV 表头（`json` 文件使用同名字段的驼峰形式，或使用应用导出的
`format: "calcbridge-regulators"` 包络）：

```csv
name,vref_min,vref_typ,vref_max,iadj_min,iadj_typ,iadj_max
TPS7A47,1.0,1.25,1.5,10,20,30
```

- `name`、`vref_typ`、`iadj_typ` 必填；其余列可留空。
- 数值必须有限，且满足 `min ≤ typ ≤ max`。
- 名称不能与内置型号（LM317、LM1117-ADJ、LM338、TL317）重名；同文件内不能重名。
- 单文件上限 256 KB、最多 50 个稳压器；导入按“全有或全无”处理，任何一行无效都会拒绝整份文件。
- 导出 CSV 会对以 `= + - @` 等开头的单元格加文本前缀，避免 Excel/WPS 公式注入。

### 设计文件格式

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
- 导入会整体替换本机草稿与自定义稳压器；建议先导出当前设计作为备份。
- 设计文件只适合在本工具中往返使用，不是板厂制造文件，也不包含 Polar/Sigrity 校验数据。

## 已知边界

- IPC-2152 曲线为近似数据，尚未完成人工校准，页面会明确标注。
- 阻抗页为微带线准静态多模型估算，不含阻焊、铜箔粗糙度、频变 Dk/Df、差分/带状线/共面波导与 2D 场解算；示例叠层不是板厂官方叠层，生产前必须用实际叠层与阻抗 coupon 复核。
- Polar/Sigrity 对照数据尚未导入；当前 `validate:impedance` 仅验证公开/取整基准，不能宣称已通过 Polar/Sigrity 校验；`validate:impedance:strict` 会因此阻断。
- 熔断、过孔载流、电偶腐蚀为工程估算模型，不含散热、镀层体系、实际介质与试验修正。
- 过孔页的「常规板 / 高密度板」工艺规则为示例阈值，必须按目标板厂能力表修改；自定义规则按 mm 输入。1 oz 铜厚按 35 µm 换算。
- 线缆尺寸仅按电压降选型，不含载流量、绝缘耐压、敷设与温度校正。
- 矩形波导仅覆盖空气填充、理想导体壁的 TE10 单模公式。
- 射频衰减器仅覆盖可实现的 Pi / T 无源网络。
- 趋肤深度为单侧趋肤近似（铜 μr ≈ 1），不含铜箔粗糙度、邻近效应与差分耦合；实际高频损耗需场解算或实测复核。
- LED 限流电阻按恒压降模型，不含 Vf 随电流/温度漂移与批次离散；并联 LED 必须各自串电阻。
- 电路板类别按 IPC-6012 性能类别提供概要参考；板材分类另页给出常见基材典型范围，两者不是同一概念。
- 板材页的 Tg、Dk、Df、导热率与 CTE 为典型范围，随厂家牌号、频率与工艺变化，不可直接作为验收依据。

## 免责声明

本工具输出均为工程估算，非认证、非实测结论；安全相关项（安规间距、熔断、绝缘）必须实测或送认证。

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。

Copyright © 2026 樂創 LeChuang
