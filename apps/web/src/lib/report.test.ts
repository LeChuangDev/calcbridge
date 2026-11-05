import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '@/lib/constants';
import {
  buildReportCsv,
  buildReportMarkdown,
  formatDateTime,
  reportFileName,
  type ReportSnapshot,
} from './report';

const snapshot: ReportSnapshot = {
  id: 'via',
  title: '过孔参数',
  subtitle: '工艺规则：常规板',
  sections: [
    {
      title: '输入参数',
      rows: [
        { label: '最终孔径 D', value: '0.4 mm' },
        { label: '镀层厚度 T', value: '0.035 mm', note: '铜镀层' },
      ],
    },
    {
      title: '计算结果',
      rows: [{ label: '过孔电阻', value: '0.575362 mΩ', note: 'R = ρL/A' }],
    },
  ],
  assumptions: ['截面 A = π(D+T)T'],
};

const date = new Date(2026, 9, 29, 21, 30);

describe('工程报告导出', () => {
  it('Markdown 含标题、输入、结果、假设和免责声明', () => {
    const md = buildReportMarkdown(snapshot, {
      generatedAt: date,
      version: APP_VERSION,
      pageUrl: 'http://localhost/#/via',
    });

    expect(md).toContain('# 工程计算报告 · 过孔参数');
    expect(md).toContain('生成时间：2026-10-29 21:30');
    expect(md).toContain('## 输入参数');
    expect(md).toContain('| 最终孔径 D | 0.4 mm |');
    expect(md).toContain('## 计算结果');
    expect(md).toContain('## 假设与边界');
    expect(md).toContain('- 截面 A = π(D+T)T');
    expect(md).toContain('工程估算，非认证');
  });

  it('Markdown 转义表格中的竖线', () => {
    const md = buildReportMarkdown({
      ...snapshot,
      sections: [{ title: '输入', rows: [{ label: 'a|b', value: 'c|d' }] }],
    });
    expect(md).toContain('| a\\|b | c\\|d |');
  });

  it('CSV 包含区块、项目、数值、备注并正确转义', () => {
    const csv = buildReportCsv(
      {
        ...snapshot,
        sections: [
          {
            title: '结果',
            rows: [{ label: 'R,1', value: '"0.5"', note: '多行\n备注' }],
          },
        ],
      },
      { generatedAt: date, version: APP_VERSION },
    );

    expect(csv).toContain('区块,项目,数值,备注');
    expect(csv).toContain('报告信息,页面,过孔参数');
    expect(csv).toContain('"R,1","""0.5""","多行\n备注"');
  });

  it('CSV 导出阻止公式注入', () => {
    const csv = buildReportCsv(
      {
        ...snapshot,
        sections: [
          {
            title: '结果',
            rows: [
              { label: '备注', value: '=HYPERLINK("http://evil","x")' },
              { label: '负温度', value: '-40' },
            ],
          },
        ],
      },
      { generatedAt: date, version: APP_VERSION },
    );

    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(',负温度,-40,');
  });

  it('报告文件名安全且带时间戳', () => {
    expect(reportFileName({ ...snapshot, id: 'a/b:c' }, 'md', date)).toBe(
      'calcbridge-a-b-c-20261029-2130.md',
    );
  });

  it('日期格式补零', () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04');
  });
});
