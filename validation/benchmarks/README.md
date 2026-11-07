# 外部基准用例

本目录用于存放各计算模块的外部基准用例（Polar / Sigrity / 场解算 / 实测 coupon / 公开手册）。
仓库不会伪造商业工具数值；没有导入真实数据时，覆盖率报告会明确显示“缺失”。

## 用例格式

`cases.json`：

```json
{
  "cases": [
    {
      "moduleId": "trace_current",
      "id": "ipc2221-10a-10k-external",
      "source": "published",
      "sourceVersion": "IPC-2221B 表 6-1 公开示例",
      "sourceUrl": "https://example.com/standard-preview",
      "evidence": "table",
      "date": "2026-11-07",
      "inputs": { "I": 10, "dT": 10, "cu": 1 },
      "expected": { "wMm": 7.19 },
      "tolerancePct": 5,
      "notes": "记录叠层、铜厚、是否有参考平面等适用条件。"
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `moduleId` | 计算器 id，必须与导航目录一致 |
| `id` | 用例唯一 id（同一模块内不得重复） |
| `source` | `polar` / `sigrity` / `field-solver` / `test-coupon` / `jlc` / `published` |
| `sourceVersion` | 必填：软件版本、手册版本、标准表编号或导出批次，用于追溯同一份依据 |
| `sourceUrl` | 可选：公开来源链接（商业工具导出时留空） |
| `evidence` | 可选：`table`（标准/厂商表值）/ `recompute`（按公开公式复算）/ `tool`（工具导出） |
| `date` | 数据采集日期 `YYYY-MM-DD` |
| `inputs` | 输入参数（按模块声明单位） |
| `expected` | 期望输出，可含多个字段 |
| `tolerancePct` | 该用例允许的相对误差（%） |
| `notes` | 叠层、环境、是否含阻焊/粗糙度等适用条件 |

## 覆盖率口径

`npm run benchmark:coverage` 会聚合：

- 本目录 `cases.json`
- `validation/impedance/golden.json`（自动归入 `impedance_microstrip`）

状态定义：

- **工具对标**：用例数 ≥ 10，且至少 2 个不同工具来源（`polar` / `sigrity` / `field-solver` / `test-coupon` / `jlc`）
- **标准验证**：用例数 ≥ 6，且至少 2 份可追溯依据（不同 `sourceVersion`）
- **部分**：有任意用例或来源，但未满足上述条件
- **缺失**：没有任何外部用例

`published` 只算公开参考，不计入“工具来源”。`published` 用例应来自公开标准表格或厂商手册公式，并在 `notes` 中注明“复算”还是“表值一致性校验”；不得把本仓库的实现输出当作期望值。

`--strict` 模式只对 17 个数值模块（走线载流、间隙、过孔、熔断、阻抗、稳压器、Buck、线缆、LED、趋肤、波导、衰减器、E 系列、电偶、电阻、单位换算、色环）要求达到“标准验证”；`pcb_class`、`substrate` 属于规范参考类，只报告不阻断。
