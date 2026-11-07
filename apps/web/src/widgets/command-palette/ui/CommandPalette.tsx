import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { searchTools, type FlatTool } from '@/entities/calculator';
import { useTheme } from '@/shared/lib/providers/ThemeProvider';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';

export interface PaletteAction {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

interface Entry {
  key: string;
  label: string;
  hint: string;
  run: () => void;
}

/**
 * 全局命令面板（Ctrl / Cmd + K）：一处搜全部工具与常用操作。
 * 与左侧树内搜索互补——这里面向「我要干什么」，不要求先知道分类。
 */
export function CommandPalette({
  open,
  onClose,
  onPick,
  extraActions = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (calcId: string) => void;
  extraActions?: PaletteAction[];
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { toggleTheme, theme } = useTheme();
  const { system, setSystem } = useUnitSystem();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    // 弹层挂载后再聚焦，避免被 mask 的焦点抢占
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'home',
        label: '打开工具目录',
        hint: '首页 · 全部模块',
        run: () => onPick('home'),
      },
      {
        id: 'theme',
        label: theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
        hint: '外观',
        run: toggleTheme,
      },
      {
        id: 'unit',
        label: system === 'metric' ? '切换长度单位为英制（mil / oz）' : '切换长度单位为公制（mm）',
        hint: '单位制',
        run: () => setSystem(system === 'metric' ? 'imperial' : 'metric'),
      },
      ...extraActions,
    ],
    [extraActions, onPick, setSystem, system, theme, toggleTheme],
  );

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim();
    const tools: FlatTool[] = q ? searchTools(q, 10) : [];
    const matchedActions = actions.filter(
      (a) => !q || a.label.toLowerCase().includes(q.toLowerCase()),
    );
    return [
      ...tools.map((t) => ({
        key: `tool:${t.calcId}`,
        label: t.label,
        hint: t.group,
        run: () => onPick(t.calcId),
      })),
      ...matchedActions.map((a) => ({
        key: `action:${a.id}`,
        label: a.label,
        hint: a.hint,
        run: a.run,
      })),
    ];
  }, [actions, onPick, query]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(entries.length - 1, 0)));
  }, [entries.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const commit = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    entry.run();
    onClose();
  };

  return (
    <Modal className="modal-palette" onClose={onClose} titleId="palette-title">
      <div className="palette">
        <div className="palette-input">
          <span className="tree-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            aria-label="搜索工具或命令"
            placeholder="搜索工具或命令，↑↓ 选择，Enter 打开"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => (entries.length ? (c + 1) % entries.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => (entries.length ? (c - 1 + entries.length) % entries.length : 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                commit(cursor);
              }
            }}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="palette-list" ref={listRef} role="listbox" aria-label="命令结果">
          {entries.length === 0 && <div className="palette-empty">没有匹配的工具或命令</div>}
          {entries.map((e, i) => (
            <button
              key={e.key}
              type="button"
              role="option"
              aria-selected={i === cursor}
              data-index={i}
              className={`palette-item${i === cursor ? ' active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => commit(i)}
            >
              <span className="palette-label">{e.label}</span>
              <span className="palette-hint">{e.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
