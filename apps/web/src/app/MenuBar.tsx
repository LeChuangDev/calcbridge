import { useEffect, useState } from 'react';
import { useUnitSystem } from '@/providers/UnitSystemProvider';

export interface MenuBarProps {
  onImportDesign: () => void;
  onExportDesign: () => void;
  onReset: () => void;
  onClearDrafts: () => void;
  onClearRegulators: () => void;
  onExportReport: (format: 'md' | 'csv') => void;
  onHome: () => void;
  onPalette: () => void;
  onAbout: () => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  hint?: string;
}

export function MenuBar({
  onImportDesign,
  onExportDesign,
  onReset,
  onClearDrafts,
  onClearRegulators,
  onExportReport,
  onHome,
  onPalette,
  onAbout,
}: MenuBarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const { system, setSystem } = useUnitSystem();

  useEffect(() => {
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const menus: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        { label: '导入设计文件（JSON）…', action: onImportDesign },
        { label: '导出设计文件（JSON）', action: onExportDesign },
        { label: '导出当前报告（Markdown）', action: () => onExportReport('md') },
        { label: '导出当前报告（CSV）', action: () => onExportReport('csv') },
        { label: '重置本页（清除本页草稿）', action: onReset },
      ],
    },
    {
      id: 'view',
      label: '视图',
      items: [
        { label: '工具目录（首页）', action: onHome, hint: 'Home' },
        { label: '命令面板…', action: onPalette, hint: 'Ctrl + K' },
      ],
    },
    {
      id: 'setting',
      label: '设置',
      items: [
        {
          label:
            system === 'metric' ? '切换长度单位为英制（mil / oz）' : '切换长度单位为公制（mm）',
          action: () => setSystem(system === 'metric' ? 'imperial' : 'metric'),
        },
        { label: '清除全部页面草稿', action: onClearDrafts },
        { label: '清除本地稳压器参数', action: onClearRegulators },
      ],
    },
    { id: 'help', label: '帮助', items: [{ label: '关于计算工具', action: onAbout }] },
  ];

  return (
    <div className="menubar">
      {menus.map((m) => (
        <div key={m.id} className="menu">
          <button
            className={`menu-btn${open === m.id ? ' open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === m.id}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === m.id ? null : m.id);
            }}
          >
            {m.label}
          </button>
          {open === m.id && (
            <div className="menu-pop" role="menu" onClick={(e) => e.stopPropagation()}>
              {m.items.map((it) => (
                <button
                  key={it.label}
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setOpen(null);
                    it.action();
                  }}
                >
                  {it.label}
                  {it.hint && <kbd>{it.hint}</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
