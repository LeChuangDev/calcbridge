# 工程计算器正确性保障体系与优化任务可行性研究报告

## 摘要

该方案的方向与工程计算器的核心风险匹配：把结果可信度拆成标准溯源、输入约束、算法实现、验证闭环、版本管控、可信度表达六个维度，覆盖了从公式到界面的完整链路。结合当前 calcbridge 代码库（19 个模块、189 项测试、IPC 与电源/射频混合场景）盘点后，主要结论如下。

- 六维度框架完整，但**验收阈值与模型能力不匹配**：方案要求经验/查表类误差 ≤5%，而行业工具自身公开的精度声明通常在 ±10% 量级[cite:5]，闭式微带模型在特定区间可做到 ±1%[cite:27]。若统一按 5% 拦截，容易迫使实现向基准数据“调参”，产生过拟合。
- 现状已具备约 **60% 的 P0 基础设施**：公式与假设公示、多模型并列、量纲内核、回归 CLI、外部阻抗校验框架、189 项自动化测试与 CI。主要缺口是**外部基准数据（Polar/Sigrity 仍未导入）、覆盖率度量、结果可信度分级、PDF 报告与计算历史**。
- 任务群 1（P0）与任务群 2（P1，新增 21 个模块）并行会稀释正确性投入。建议先完成「可信度基础设施 + 5 个高风险模块认证」，再横向铺开；新增模块优先选择可复用现有内核的数据驱动型。
- 两处标准体系需要纠正：**爬电距离不应以 IPC-2221 为主依据**，而应对照 IEC 60664-1 / GB/T 16935.1；**GB/T 16935.1-2008 在标准库中已标记为被代替**，新项目采标 IEC 60664-1:2020[cite:22][cite:23][cite:24]。焊盘速查则需注意 IPC-7351B（2010）的版权与版本[cite:11][cite:13]。

---

## 1 评估方法与证据边界

评估由两部分构成：一是对仓库当前实现做静态盘点（模块清单、测试、校验脚本、报告能力、CI 门禁）；二是对公开的标准与工具资料做检索，核对方案中引用的标准号、模型名与精度说法。

证据边界需要明确：

- Polar Si8000/SI9000、Sigrity 的对照数据属于商业软件导出结果，公开渠道只能确认其被板厂广泛使用[cite:7][cite:8]，无法验证具体版本在任意叠层下的误差；本报告不对其数值精度下结论。
- 标准原文受版权保护，公开渠道只能获取目录、范围与部分预览页；本报告引用条款范围与公开解读，不复制标准表格。
- 仓库内不存在 Polar/Sigrity 实测数据，相关可行性判断均标注为推断，不伪造基准值。

---

## 2 现状基线（calcbridge 仓库）

| 能力维度       | 当前实现                                                                                         | 关键位置                                                                   | 缺口                                        |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------- |
| 公式与假设公示 | 每个面板有假设/公式区块；README 列出各模块标准                                                   | `shared/ui/AssumptionsPanel.tsx`、`packages/calculators/src/*/spec.ts`     | 缺“标准号 + 年份 + 条款”的结构化元数据      |
| 多模型并列     | 走线载流：IPC-2221B 公式 + IPC-2152 近似；微带：IPC-2141 + Hammerstad–Jensen + 一致性检查        | `features/calculator-impedance/`、`features/calculator-generic/`           | 缺模型适用区间与误差等级的显式声明          |
| 量纲与单位     | 零依赖量纲内核、单位换算、表达式求值                                                             | `packages/core/src/unit/`、`shared/lib/unitSystem.ts`                      | 输入范围阈值散落在各面板，未进 spec         |
| 自动化测试     | 33 个测试文件、189 项测试；算例回归 CLI；CI 全绿                                                 | `packages/calculators/test/regression.test.ts`、`.github/workflows/ci.yml` | 无覆盖率工具与阈值门禁                      |
| 外部对标       | 阻抗校验框架支持 `polar/sigrity/field-solver/coupon` 来源，默认门槛平均绝对误差 ≤5%、通过率 ≥80% | `validation/impedance/`、`packages/cli`                                    | Polar/Sigrity 数据为空，`strict` 模式会阻断 |
| 不确定度       | 蒙特卡洛 P10/P50/P90 + 敏感度排序（ρ）                                                           | `shared/ui/MonteCarloPanel.tsx`、`packages/core/src/uncertainty/mc.ts`     | 未给出各输入对结果的贡献占比                |
| 结果导出       | Markdown / CSV 报告，含版本、页面、假设与免责声明                                                | `entities/report/model/report.ts`                                          | 无 PDF、无历史记录、无可信度分级字段        |
| 交互与体验     | 实时计算、搜索、收藏、暗黑主题、响应式、命令面板                                                 | `widgets/`、`pages/`                                                       | 无波形曲线、无设计流串联                    |

这张表说明：方案并非从零建设，P0 的重点应放在**把已有能力结构化、可度量、可审计**，而不是重新实现计算逻辑。

---

## 3 六大正确性维度的可行性评估

### 3.1 公式与标准溯源

溯源的关键不是“在页面上写一条公式”，而是建立可机读的依据记录：标准号、修订年份、条款、变量定义、单位、适用区间、模型类别（解析/经验/查表）。IPC 走线载流公式本身是幂函数拟合：\(I = k \cdot \Delta T^{0.44} \cdot A^{0.725}\)，外层 \(k=0.048\)、内层 \(k=0.024\)[cite:1][cite:4]，这类系数必须与标准版本绑定，否则标准换版后无法追溯。

需要提前处理三个现实约束：

- **标准版权**：不能整表复制 IPC 表格入库，只能引用条款号并自建“适用条件 + 计算值”的数据，或在取得授权后收录。
- **版本漂移**：IPC-7351B（2010 年发布）在公开标准商店仍显示为当前修订版[cite:11][cite:13]；但标准版本状态会变化，依据记录必须带年份，不能只写“IPC-7351”。
- **E 系列依据**：电阻/电容优先数系列以 IEC 60063:2015 为准，且该标准给出系列与容差的推荐对应关系[cite:17][cite:18][cite:19]；E96 与 E192 的取舍应在模块元数据中声明，不能只写“E 系列”。

建议产物：一份 `standards.json`（模块 id → 标准/文献 → 条款 → 模型类别 → 误差等级 → 复核人/日期），由界面读取渲染，避免文档与实现两套口径。

### 3.2 输入参数校验

方案提出的范围、逻辑、量纲三层校验在工程上是可行的，而且当前仓库已具备量纲内核，边际成本主要在“阈值治理”。

- **范围校验**应作为 spec 的一部分声明（如铜厚 0.5–3 oz、线宽下限按板厂能力），并区分“警告”和“拦截”。硬编码在面板里会导致同一参数在不同模块阈值不一致。
- **逻辑校验**需要按模块写成可测试的断言，例如 Buck 的 \(V_{out} < V_{in}\)、分压两电阻不可同时为零、阻抗反解线宽超出工艺极限。断言应返回结构化错误码，便于界面统一提示与测试覆盖。
- **量纲校验**当前已由 `Quantity` 承担；需要补的是“输入解析失败”和“单位不匹配”的用户可见文案一致性，避免出现英文报错或静默换算。

一个容易被忽略的点是阈值的时效性：工艺能力（最小线宽、板厚、铜厚）随板厂能力变化，阈值必须带来源与日期，并允许用户覆盖。否则“合法区间”在两年后就会变成错误约束。

### 3.3 多基准对标：方案中最需要修正的部分

方案要求“精确公式 ≤1%、经验公式/查表 ≤5%，每模块 ≥10 组用例、≥2 款工具”。逐条核对后的判断如下。

| 方案假设                      | 公开证据                                                                                                                                                                                                      | 评估                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 经验/查表误差可控制在 5% 以内 | Saturn PCB Toolkit 官方说明其与图表值偏差在 ±10% 以内[cite:5][cite:6]                                                                                                                                         | 5% 阈值严于对标工具自身的公开精度                          |
| 闭式模型可做到 1%             | Hammerstad–Jensen 在 \(0.1 < W/h < 100\)、\(1 < \epsilon_r < 128\) 区间标称 Z0 ±1%、εeff ±0.2%[cite:27]；也有对比给出 Wheeler <0.59%[cite:26]                                                                 | 1% 对闭式模型可行，但仅在声明适用区间内                    |
| 微带模型之间差异可忽略        | 模型精度依赖 \(0.1 < W/h < 100\)、\(1 < \epsilon_r < 128\) 等适用区间，且不含阻焊、粗糙度与频变[cite:27]                                                                                                      | 应以“并列展示 + 区间声明”替代“单一真值”                    |
| IPC-2221 比 IPC-2152 保守     | 一种说法是 IPC-2221 忽略铜面散热、偏保守[cite:2]；另一组实测显示无平面时外层曲线偏乐观（10 A、10 °C 温升，公式 7.19 mm，图表需 18.7 mm）[cite:1]；IPC-2152 基于实测、考虑介质导热与铜面距离[cite:30][cite:31] | 两种结论并存，取决于是否有参考平面与叠层；不能只给一个模型 |

由此建议把误差门禁改为**按模型类别分层**：

- 解析/闭式模型：≤2%（对标闭式参考或场解算），并在结果中标注适用区间。
- 经验公式/图表插值：≤10%，或在报告中直接声明“与对标工具声明精度一致”。
- 查表/安规类：不做百分比误差，改为逐单元格一致性校验（输入条件命中同一档位时数值必须完全一致）。

另外，商业工具数据存在许可与可复现性问题：Polar、Sigrity 的导出结果通常不能公开再分发。可行的做法是保存“输入几何 + 软件版本 + 期望值 + 采集日期 + 容差”，不保存软件界面截图或标准表格；公开仓库只放可再分发的公开基准与自建 coupon 数据。这也解释了当前仓库为什么不伪造 Polar/Sigrity 数据。

### 3.4 自动化测试体系

方案要求“核心函数覆盖率 ≥90%”，当前仓库尚未配置覆盖率工具（`vitest` 依赖中无 coverage 插件），因此这项应作为独立任务而不是验收口号。建议：

- 增加 `@vitest/coverage-v8`，设置 lines/functions ≥90%、branches ≥80%，并在 CI 上传报告。
- 测试分层：纯函数单测（求解器）→ 边界用例（CCM/DCM 临界、δ 等于铜厚、零/负输入）→ 外部基准回归（golden 数据）→ 面板冒烟（jsdom）。
- 回归门槛沿用现有机制：每条 golden 用例带 `tolerance_pct`，按模块汇总平均绝对误差与通过率；避免用模型自身输出作为期望值，这一点仓库的校验说明已经明确。
- 防止“为覆盖率而测”：覆盖率只统计 `model/` 下的求解器与内核，UI 组件走冒烟测试即可，不把样式与静态表格计入分母。

### 3.5 人工评审与版本管控

单人维护的项目难以实现组织级双人评审，但可以把评审固化为可执行清单：

- 计算逻辑变更必须附带“公式 → 代码”逐项对照（符号、系数、量纲、取整、边界）。
- 建立 `CALC_LOGIC_CHANGELOG.md`：记录公式、系数、阈值、标准版本的变化，标注影响模块与结果差异方向。
- 建议启用 `CODEOWNERS` 将 `packages/core`、`packages/calculators`、`features/calculator-*/model` 标为需复核路径。
- 版本语义：计算逻辑修正即便不改 UI，也应升 minor 并在 Release Notes 中单列“结果可能变化”。

### 3.6 结果可信度标识

当前已有“通过/告警/失败”徽标与免责声明，但缺少“结果类型”标签。建议在结果卡片上增加三类标识，并由模型元数据自动生成，而非人工填写：

- **理论计算值**：解析公式，给出公式与适用区间。
- **标准查表值**：给出标准号、表号/档位与插值方式。
- **工程估算值**：经验公式或近似模型，给出对标工具与声明精度。

不确定度方面，现有蒙特卡洛已输出 ρ 排序，可作为一阶敏感度；若要“贡献占比”，建议用标准化回归系数的平方归一化，而不是直接承诺 Sobol 指数（采样成本高、对非单调模型解释力有限）。

---

## 4 四组任务的落地评估

### 4.1 任务群 1（P0）：可行，但需要重排顺序

| 任务             | 可行性 | 主要风险                               | 建议                                 |
| ---------------- | ------ | -------------------------------------- | ------------------------------------ |
| 1.1 标准依据梳理 | 高     | 19 个模块 × 条款梳理的工作量；标准版权 | 先做模板与 5 个高风险模块，再铺开    |
| 1.2 输入校验     | 高     | 阈值散落、易过时                       | 阈值进 spec，带来源与日期            |
| 1.3 多基准对标   | 中     | 商业工具许可；≥2 工具对安规类不现实    | 分层阈值；安规类用标准表格一致性校验 |
| 1.4 自动化测试   | 高     | 覆盖率口径                             | 增加 coverage 工具，只统计求解器     |
| 1.5 可信度标识   | 高     | 标签人工化会失真                       | 由模型元数据驱动，报告同步输出       |

### 4.2 任务群 2（P1）：21 个新模块与 P0 存在资源竞争

按实现成本可分为三档：

- **低成本（可数据驱动、复用现有内核）**：欧姆定律、RC/RLC 时间常数、dBm/功率/电压换算、AWG 对照、SMD 代码解码、色环电感解码。这类模块主要成本在数据表与校验，不在算法。
- **中成本（需要新模型 + 对标）**：L 型/Pi 匹配网络、波长/天线长度、传输线损耗拆分、走线延时与长度匹配、拼板利用率。
- **高成本（需要场解算或大量基准数据）**：差分阻抗与共面波导、过孔寄生参数、PCB 散热与结温、爬电距离、IPC-7351 焊盘速查。

其中两项需要纠正技术路线：

1. **爬电距离/电气间隙**：方案把两者都归到 IPC-2221。实际上安规爬电距离以 IEC 60664-1 体系为主，IPC-2221 主要给电气间隙；公开资料给出的同一工况对比是 IEC 60664-1 要求 2 mm、IPC-2221B 要求 2.5 mm，并建议取更保守值[cite:14]。污染等级 1/2/3 的定义也来自 IEC 体系[cite:16]。国内对应标准为 GB/T 16935.1，2008 版等同采用 IEC 60664-1:2007[cite:22][cite:25]；标准库显示该版本已被代替，且已有国家标准项目采标 IEC 60664-1:2020[cite:23][cite:24]。因此模块必须同时锁定“标准版本 + 污染等级 + 材料组别”，否则数值不可比。
2. **IPC-7351 焊盘速查**：IPC-7351B 发布于 2010 年，公开标准商店仍列为当前修订版[cite:11][cite:13]。焊盘数据表体量大且受版权保护，直接内置完整表格存在合规风险；更稳妥的是做“查询入口 + 计算器逻辑”，或仅收录可再分发的少量封装。

### 4.3 任务群 3（P2）：多数体验项已完成，缺口集中在结果落地

| 需求             | 现状                        | 结论                                               |
| ---------------- | --------------------------- | -------------------------------------------------- |
| 实时计算         | 已实现（输入即算）          | 无需新增                                           |
| 全局搜索         | 已实现（侧栏 + Ctrl/Cmd+K） | 无需新增                                           |
| 收藏/暗黑/响应式 | 已实现                      | 无需新增                                           |
| 波形/曲线        | 未实现                      | 仅对 Buck、RC、阻抗三类有意义，优先做 SVG 静态曲线 |
| 计算历史         | 未实现                      | 与草稿存储共用配额，需处理 localStorage 上限       |
| PDF 报告         | 未实现（仅 MD/CSV）         | 建议用打印样式导出 PDF，避免引入大依赖             |
| E96 标准值       | 部分实现（电阻侧 E 系列）   | 扩展到电容/电感前先确认 IEC 60063 系列范围         |

PDF 导出的工程价值高于“生成 PDF 文件”本身：报告需要包含输入、公式、结果、容差与标准依据，才能作为评审附件。用浏览器打印样式（`@media print`）实现零依赖导出，比引入 PDF 库更符合当前体积预算。

### 4.4 任务群 4（P3）：差异化方向正确，但依赖前置可信度

设计流串联（Buck 全流程、高速阻抗流程）确实能形成差异化，但其价值取决于每一步结果是否可信。建议在 P0 完成 5 个核心模块的对标后再启动，否则会把“未验证的估值”串成一条链，放大误差。

本土化标准方面，GB/T 与 IPC 并列展示时必须在同一工况下比较，并标注两套体系的适用对象差异（安规认证 vs 板级设计）。叠层模板需要标注来源（板厂名称、工艺能力、日期），否则会变成不可追溯的“经验模板”。

---

## 5 建议路线图

| 阶段                   | 目标                                                | 关键产物                                                                             | 退出条件                                                              |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 阶段 0：基础设施       | 让“可信度”可机读、可度量                            | `standards.json`、误差分级规则、coverage 工具、`CALC_LOGIC_CHANGELOG.md`、CODEOWNERS | 覆盖率门禁接入 CI；标准依据字段在界面可查                             |
| 阶段 1：高风险模块认证 | 走线载流、微带阻抗、电气间隙/爬电、Buck、三端稳压器 | 每模块 8–10 组外部用例；修正记录；可信度标签                                         | 闭式 ≤2%、经验 ≤10%；安规逐档一致；`validate:impedance:strict` 可运行 |
| 阶段 2：横向铺开       | 其余 14 个模块                                      | 依据表补全、输入 limits 进 spec、报告含依据与容差                                    | 所有模块均有依据记录与边界用例                                        |
| 阶段 3：扩展与差异化   | 新模块与设计流                                      | 数据驱动模块优先；波形、历史、打印报告                                               | 新模块必须自带依据与校验数据                                          |

阶段 0 与阶段 1 是“可信度投资”，阶段 2 是“覆盖投资”，阶段 3 才是“增长投资”。把三者混在同一迭代里，最容易出现“模块数量上升、可信度没有变化”的结果。

---

## 6 主要风险

- **阈值过拟合**：为满足 5% 门禁而调整系数，会让实现偏离标准。应按模型类别设阈值，并保留原始对标记录。
- **基准不可复现**：商业工具版本、导出设置、叠层条件缺失时，数值无法复核。每条用例必须记录软件版本、日期与几何条件。
- **标准版权与版本**：标准表格不能整表复制；标准换版后旧阈值失效，需要版本化的依据记录。
- **覆盖率失真**：把静态表格、样式、类型声明计入覆盖率分母，会得到好看但无意义的数字。
- **存储配额**：历史记录 + 草稿 + 报告快照同时写入 localStorage，存在 5 MB 上限风险，需要容量策略与清理入口。
- **单人评审**：缺少独立复核时，至少保留“公式对照表 + 变更日志 + 外部基准”，让结果可被第三方复算。

---

## 7 结论

方案的六维框架可以作为长期治理结构，但需要三处校准才能落地：把误差门禁按模型类别分层、把“标准依据”做成结构化数据而非文档描述、把 P0 收敛到 5 个高风险模块并先建立度量工具。当前 calcbridge 已具备公式公开、多模型并列、量纲内核、自动化测试与外部校验框架，P0 的真实工作量集中在**外部基准数据的采集与许可处理**，以及**输入阈值与可信度标签的结构化**，而不是重写计算器。

任务群 2 的 21 个新模块应延后并与 P0 隔离；其中安规类模块必须切换到 IEC 60664-1 / GB/T 16935.1 体系，IPC-7351 焊盘速查需先解决数据版权。任务群 3 的大部分体验项已经完成，剩余价值最高的是打印式 PDF 报告与计算历史。任务群 4 的设计流应作为可信度体系完成后的差异化层。

---

## 参考资料

- [cite:1] [PCB Trace Width: IPC-2221 vs IPC-2152 — rftools.io](https://rftools.io/blog/pcb-trace-width-current-capacity/)
- [cite:2] [PCB Trace Width Calculator | IPC-2221 and IPC-2152 — Salitronic](https://salitronic.com/pcb-trace-width-calculator/)
- [cite:3] [PCB Trace Width for Your Current: IPC-2221, Copper Weight & IPC-2152 — Circflow](https://circflow.com/blog/pcb-trace-width-for-current/)
- [cite:4] [PCB Trace Width Calculator - IPC-2221 & IPC-2152 — Standard Clarity](https://standardclarity.com/calculators/pcb-trace-width/)
- [cite:5] [Saturn PCB Toolkit Help — Saturn PCB](https://saturnpcb.com/saturn-pcb-toolkit-help-htm/)
- [cite:6] [Saturn PCB Toolkit — Saturn PCB](https://saturnpcb.com/saturn-pcb-toolkit/)
- [cite:7] [What is the best PCB impedance control? — Ideas PCB](https://www.ideaspcb.com/info/what-is-the-best-pcb-impedance-control-72189786.html)
- [cite:8] [Differential pair trace impedance calculations — EDAboard](https://www.edaboard.com/threads/differential-pair-trace-impedance-calculations.339505/)
- [cite:9] [Confusions in characteristic impedance calculations — EDAboard](https://www.edaboard.com/threads/confusions-in-characteristic-impedance-calculations.276002/)
- [cite:10] [IPC-7351B Table of Contents — IPC](https://www.electronics.org/TOC/IPC-7351B.pdf)
- [cite:11] [IPC-7351 Revision B Standard — IPC Store](https://shop.electronics.org/standards/standard-only)
- [cite:12] [IPC-7351B — IPC Store Japan](https://www.ipcstore.jp/item/12/)
- [cite:13] [IPC 7351:B Standard — NSAI](https://shop.standards.ie/en-ie/standards/ipc-7351-b-574514_saig_ipc_ipc_1314839/)
- [cite:14] [Demystifying Clearance and Creepage Distance for High-Voltage End Equipment — TI](https://www.ti.com/lit/ml/slup419/slup419.pdf)
- [cite:15] [High Voltage PCB: Creepage, Clearance & Safety Design — Andwin PCB](https://www.andwinpcb.com/high-voltage-pcb-design-creepage-clearance-and-safety-requirements/)
- [cite:16] [电玩具中爬电距离和电气间隙的检验方法 SZDB/Z 210—2016](https://amr.sz.gov.cn/attachment/1/1195/1195369/9772235.pdf)
- [cite:17] [IEC 60063:2015 Preferred number series for resistors and capacitors — IEC Webstore](https://webstore.iec.ch/en/publication/22011)
- [cite:18] [IEC 60063:2015 Preview — ANSI Webstore](https://webstore.ansi.org/preview-pages/IEC/preview_iec60063%7Bed3.0%7Db.pdf)
- [cite:19] [IEC 60063:2015 Sample — iTeh Standards](https://cdn.standards.iteh.ai/samples/21131/0b431abe83d64551accdfaebc210796e/IEC-60063-2015.pdf)
- [cite:20] [IEC 60063:1963 (Withdrawn) — IEC Webstore](https://webstore.iec.ch/publication/486)
- [cite:21] [IEC TC 40 Dashboard — IEC](https://iec.ch/dyn/www/f?p=103:22:0::::FSP_ORG_ID:1219)
- [cite:22] [GB/T 16935.1-2008/IEC 60664-1:2007 低压系统内设备的绝缘配合 第1部分](http://www.weboos.cn/assets/basicStandard/std_29615.pdf)
- [cite:23] [GB/T 16935.1-2008 标准详细信息（被代替）— 中国标准在线服务网](https://www.spc.org.cn/online/6ccd8023ca32283eec091cfa77e036af.html)
- [cite:24] [低压供电系统内设备的绝缘配合 国家标准项目（采标 IEC 60664-1:2020）— 国家标准全文公开系统](https://std.samr.gov.cn/gb/search/gbDetailed?id=B8E87AE08B688CFBE05397BE0A0AC10A)
- [cite:25] [印制板中爬电距离和电气间隙检测的探讨 — 电子工程世界](https://news.eeworld.com.cn/dygl/2014/0309/article_20829.html)
- [cite:26] [Microstrip formulas comparison — RF cat corner](https://f4inx.github.io/posts/microstrip-formulas-comparison.html)
- [cite:27] [Hammerstad-Jensen Model for Microstrip Impedance — RF Essentials](https://rfessentials.com/rf-knowledge-base/what-is-the-hammerstad-jensen-model-and-when-is-it-accurate-for-microstrip-imped/)
- [cite:28] [Computer-aided design-based circuit model of microstrip line for terahertz interconnects — Wiley](https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/joe.2017.0078)
- [cite:29] [Microstrip Calculator — RF Studio Labs](https://rfstudiolabs.com/calculators/microstrip)
- [cite:30] [An integrated approach to developing thermal models for automotive electric drives — TechRxiv](https://www.techrxiv.org/users/721189/articles/706925/master/file/data/ECCE_2020_wCopyrightNotice/ECCE_2020_wCopyrightNotice.pdf)
- [cite:31] [PCB Trace Width Calculator — IPC-2152, IPC-2221, Current Capacity — PCB Viewer](https://pcbviewer.app/en/blog/pcb-trace-width-calculator)
