/**
 * CSV 单元格编码。
 *
 * 除了常规的引号/逗号/换行转义，还必须防止 CSV 公式注入：
 * Excel/WPS 会把以 = + - @、制表符或回车开头的单元格当作公式执行。
 * 纯数字（含负数、科学计数法）保持原样，避免把工程数值变成文本。
 */
const PURE_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function csvCell(value: string): string {
  const trimmedStart = value.trimStart();
  const dangerous =
    trimmedStart !== '' && /^[=+\-@\t\r]/.test(trimmedStart) && !PURE_NUMBER.test(trimmedStart);
  const text = dangerous ? `'${value}` : value;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
