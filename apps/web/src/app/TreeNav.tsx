import { useEffect, useMemo, useRef, useState } from 'react';
import { CALC_TREE, HOME_ID, type FlatTool } from '@/data/navModel';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { loadFavorites } from '@/lib/prefsStore';

const NAV_COLLAPSED_KEY = STORAGE_KEYS.navCollapsed;

/** 读取折叠状态；只接受当前分类树里存在的布尔值，避免旧数据污染。 */
function loadCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const g of CALC_TREE) {
      const value = (parsed as Record<string, unknown>)[g.id];
      if (typeof value === 'boolean') out[g.id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function allTools(): FlatTool[] {
  return CALC_TREE.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label, groupId: g.id })));
}

export interface TreeNavProps {
  active: string;
  onPick: (calcId: string) => void;
  /** 收藏变更计数：首页切换收藏后需要同步侧栏 */
  favoritesTick?: number;
}

export function TreeNav({ active, onPick, favoritesTick = 0 }: TreeNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsedGroups);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const favorites = useMemo<FlatTool[]>(() => {
    // favoritesTick 只是「收藏变了，重读一次」的信号，本身不参与计算
    void favoritesTick;
    const saved = loadFavorites();
    return allTools().filter((t) => saved.includes(t.calcId));
  }, [favoritesTick]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* 本地存储不可用时忽略 */
    }
  }, [collapsed]);

  // 切换页面时确保当前项所在分类展开，并把当前项滚到可视区域。
  useEffect(() => {
    const group = CALC_TREE.find((g) => g.items.some((it) => it.calcId === active));
    if (group) {
      setCollapsed((prev) => (prev[group.id] ? { ...prev, [group.id]: false } : prev));
    }
    const frame = window.requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = searching
    ? CALC_TREE.map((g) => {
        const groupMatch = g.label.toLowerCase().includes(q);
        const items = groupMatch
          ? g.items
          : g.items.filter(
              (it) => it.label.toLowerCase().includes(q) || it.calcId.toLowerCase().includes(q),
            );
        return { ...g, items };
      }).filter((g) => g.items.length > 0)
    : CALC_TREE;

  return (
    <nav className="tree" aria-label="计算器分类">
      <div className="nav-head">
        <span className="nav-title">calcbridge</span>
        <span className="nav-sub">ENGINEERING CALCULATORS</span>
      </div>

      <div className={`tree-search${searching ? ' active' : ''}`}>
        <span className="tree-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={searchRef}
          className="tree-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              e.currentTarget.blur();
            }
            if (e.key === 'Enter') {
              const matches = groups.flatMap((g) => g.items);
              if (matches.length === 1) {
                onPick(matches[0]!.calcId);
                setQuery('');
              }
            }
          }}
          placeholder="搜索计算器  /"
          aria-label="搜索计算器"
          spellCheck={false}
        />
        {query && (
          <button
            className="tree-search-clear"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
            title="清除搜索"
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {!searching && (
        <div className="tree-group">
          <button
            className={`tree-item home${active === HOME_ID ? ' active' : ''}`}
            aria-current={active === HOME_ID ? 'page' : undefined}
            onClick={() => onPick(HOME_ID)}
          >
            <span className="tree-item-icon" aria-hidden="true">
              ▦
            </span>
            工具目录
          </button>
          {favorites.map((t) => (
            <button
              key={`fav:${t.calcId}`}
              ref={active === t.calcId ? activeRef : undefined}
              className={`tree-item${active === t.calcId ? ' active' : ''}`}
              aria-current={active === t.calcId ? 'page' : undefined}
              title={`${t.group} · ${t.label}`}
              onClick={() => onPick(t.calcId)}
            >
              <span className="tree-item-icon" aria-hidden="true">
                ★
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && <div className="tree-empty">没有匹配的计算器</div>}

      {groups.map((g) => {
        const closed = !searching && !!collapsed[g.id];
        return (
          <div key={g.id} className="tree-group">
            <button
              className="tg-head"
              onClick={() => {
                if (!searching) setCollapsed((p) => ({ ...p, [g.id]: !p[g.id] }));
              }}
              title={searching ? '搜索中' : closed ? '展开' : '折叠'}
              aria-expanded={!closed}
            >
              <span className="tw">{closed ? '▸' : '▾'}</span>
              {g.label}
              {searching && <span className="tg-count">{g.items.length}</span>}
            </button>
            {!closed &&
              g.items.map((it) => (
                <button
                  key={it.id}
                  ref={active === it.calcId ? activeRef : undefined}
                  className={`tree-item${active === it.calcId ? ' active' : ''}`}
                  aria-current={active === it.calcId ? 'page' : undefined}
                  title={it.desc}
                  onClick={() => {
                    setCollapsed((p) => ({ ...p, [g.id]: false }));
                    onPick(it.calcId);
                    setQuery('');
                  }}
                >
                  {it.label}
                </button>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
