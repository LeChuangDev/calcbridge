# 微带线阻抗校验数据

本目录是 Polar / Sigrity / 场解算 / 测试 coupon 的校验数据入口。  
**仓库不会伪造 Polar/Sigrity 数值**；没有导入真实数据时，报告会明确显示“待导入”。

## 1. 数据格式

JSON 见 `golden.json`，CSV 模板见 `polar-sigrity-template.csv`。

字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一用例 id |
| `source` | `polar` / `sigrity` / `field-solver` / `test-coupon` / `published` / `template` |
| `source_version` | 软件版本或导出批次 |
| `date` | 数据日期 |
| `mode` | `z0`（参考阻抗）或 `width`（参考线宽） |
| `w_mm` / `h_mm` / `t_mm` | 线宽 / 介质厚度 / 铜厚，单位 mm |
| `er` | 介电常数 |
| `target_ohm` | `width` 模式必填 |
| `expected` | 参考 Z0（Ω）或参考线宽（mm） |
| `tolerance_pct` | 允许相对误差，% |
| `notes` | 叠层、阻焊、粗糙度、频率等条件 |

> 所有几何量统一用 **mm** 导入；校验运行器内部不做单位猜测。

## 2. 采集 Polar / Sigrity 数据

每条用例至少记录：

- 叠层：信号层到参考平面的介质厚度 `h`、铜厚 `t`、Dk/Df
- 几何：线宽 `w`、单端/差分、是否有阻焊
- 参考结果：`Z0` 或目标阻抗对应的线宽
- 软件版本、日期、导出设置
- 是否含铜箔粗糙度模型、频变 Dk、阻焊模型

建议先固定一组与当前示例叠层相同的数据，再逐步加入阻焊、粗糙度、频变和差分案例。

## 3. 运行

```bash
# 冒烟校验（当前仓库只有公开/四舍五入基准）
npm run validate:impedance

# 要求 Polar 与 Sigrity 数据都已导入
npm run validate:impedance:strict
```

也可以直接指定文件：

```bash
npx tsx packages/cli/src/index.ts validate-impedance validation/impedance/my-polar.csv
```

- 默认门槛：每个模型平均绝对误差 ≤ 5%，适用案例通过率 ≥ 80%。
- `strict` 还会要求 Polar 和 Sigrity 各至少有 1 条用例。
- 退出码非 0 表示门槛未通过，可用于 CI。
- 输出 Markdown 报告，可直接归档到评审记录。

## 4. 科学边界

- `published` 案例只是框架冒烟和公开基准，不代表 Polar/Sigrity 校验完成。
- 模型自身输出不能作为 `expected`，否则只是自洽测试。
- 当前模型是准静态微带线模型；没有阻焊、粗糙度、频变和 2D 场解算，不能宣称覆盖所有叠层。
