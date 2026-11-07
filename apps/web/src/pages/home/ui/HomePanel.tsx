import { useMemo, useState } from 'react';
import { ALL_TOOLS, CALC_TREE, searchTools, type FlatTool } from '@/entities/calculator';
import { loadFavorites, loadRecent, toggleFavorite } from '@/entities/preferences/model/prefsStore';

/** 小卡片：首页工具目录的单项 */
function ToolCard({
  tool,
  onPick,
  favorite,
  onToggleFavorite,
}: {
  tool: FlatTool;
  onPick: (calcId: string) => void;
  favorite: boolean;
  onToggleFavorite: (calcId: string) => void;
}) {
  return (
    <div className="dir-card">
      <button type="button" className="dir-card-main" onClick={() => onPick(tool.calcId)}>
        <span className="dir-card-group">{tool.group}</span>
        <strong>{tool.label}</strong>
        <span className="dir-card-desc">{tool.desc}</span>
      </button>
      <button
        type="button"
        className={`dir-star${favorite ? ' on' : ''}`}
        aria-pressed={favorite}
        title={favorite ? '取消收藏' : '收藏'}
        aria-label={favorite ? `取消收藏 ${tool.label}` : `收藏 ${tool.label}`}
        onClick={() => onToggleFavorite(tool.calcId)}
      >
        {favorite ? '★' : '☆'}
      </button>
    </div>
  );
}

/**
 * 首页工具目录：一次看全所有模块，支持检索、收藏与最近使用。
 * 参考行业工具站的目录式入口，降低「先猜分类再找工具」的成本。
 */
export function HomePanel({ onPick }: { onPick: (calcId: string) => void }) {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [recent] = useState<string[]>(loadRecent);
  const q = query.trim();

  const { matched, groups } = useMemo(() => {
    if (q) {
      const hits = searchTools(q, 30);
      return { matched: hits, groups: [] as { label: string; items: FlatTool[] }[] };
    }
    return {
      matched: [] as FlatTool[],
      groups: CALC_TREE.map((g) => ({
        label: g.label,
        items: g.items.map((it) => ({ ...it, group: g.label, groupId: g.id })),
      })),
    };
  }, [q]);

  const favoriteTools = favorites
    .map((id) => ALL_TOOLS.find((t) => t.calcId === id))
    .filter((t): t is FlatTool => !!t)
    .slice(0, 6);
  const recentTools = recent
    .filter((id) => id !== 'home' && !favorites.includes(id))
    .map((id) => ALL_TOOLS.find((t) => t.calcId === id))
    .filter((t): t is FlatTool => !!t)
    .slice(0, 6);

  const onToggleFavorite = (calcId: string) => setFavorites(toggleFavorite(calcId));

  return (
    <div className="calc-panel home-panel">
      <header className="home-hero">
        <div className="home-hero-main">
          <span className="ch-kicker">TOOL DIRECTORY</span>
          <h2>工具目录</h2>
          <p>
            共 {ALL_TOOLS.length}{' '}
            个工程计算模块：量纲安全输入、正/反向求解、可行域判定与不确定度分析。
            所有结果为工程估算，非认证依据。
          </p>
        </div>
        <div className="home-hero-stats">
          <div className="home-stat">
            <b>{ALL_TOOLS.length}</b>
            <span>计算模块</span>
          </div>
          <div className="home-stat">
            <b>{CALC_TREE.length}</b>
            <span>分类</span>
          </div>
          <div className="home-stat">
            <b>{favorites.length}</b>
            <span>收藏</span>
          </div>
        </div>
      </header>

      <div className="home-search">
        <span className="tree-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索工具、参数或标准号（如 阻抗 / IPC-2152 / 过孔）"
          aria-label="搜索工具"
          spellCheck={false}
        />
        {q && (
          <button
            type="button"
            className="tree-search-clear"
            onClick={() => setQuery('')}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {q ? (
        <section className="home-section">
          <div className="home-section-head">
            <h3>搜索结果</h3>
            <span>{matched.length} 个匹配</span>
          </div>
          {matched.length === 0 ? (
            <p className="home-empty">没有匹配的工具，试试标准号或英文缩写。</p>
          ) : (
            <div className="dir-grid">
              {matched.map((t) => (
                <ToolCard
                  key={t.calcId}
                  tool={t}
                  onPick={onPick}
                  favorite={favorites.includes(t.calcId)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {favoriteTools.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h3>收藏</h3>
                <span>点击 ★ 取消</span>
              </div>
              <div className="dir-grid">
                {favoriteTools.map((t) => (
                  <ToolCard
                    key={t.calcId}
                    tool={t}
                    onPick={onPick}
                    favorite
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}

          {recentTools.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h3>最近使用</h3>
                <span>本机记录</span>
              </div>
              <div className="dir-chips">
                {recentTools.map((t) => (
                  <button
                    key={t.calcId}
                    type="button"
                    className="chip"
                    onClick={() => onPick(t.calcId)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.label} className="home-section">
              <div className="home-section-head">
                <h3>{g.label}</h3>
                <span>{g.items.length} 个模块</span>
              </div>
              <div className="dir-grid">
                {g.items.map((t) => (
                  <ToolCard
                    key={t.calcId}
                    tool={t}
                    onPick={onPick}
                    favorite={favorites.includes(t.calcId)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
