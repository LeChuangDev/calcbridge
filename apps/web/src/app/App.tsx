import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CALCULATOR_REGISTRY } from '@calcbridge/calculators';
import { AboutDialog } from '@/widgets/about-dialog';
import { CommandPalette } from '@/widgets/command-palette';
import { MenuBar } from '@/widgets/menu-bar';
import { ThemeToggle, UnitSwitch } from '@/widgets/display-controls';
import { TitleBar } from '@/widgets/title-bar';
import { TreeNav } from '@/widgets/side-nav';
import { useUnitSystem } from '@/shared/lib/providers/UnitSystemProvider';
import { ResultConfidenceProvider } from '@/shared/lib/providers/ResultConfidenceProvider';
import { CONFIDENCE_LABEL, HOME_ID, groupOf, standardOf } from '@/entities/calculator';
import {
  CalculationBasis,
  FALLBACK_PANEL,
  PANEL_COMPONENTS,
  prefetchPanel,
  prefetchWhenIdle,
} from '@/pages/calculator';
import { HomePanel } from '@/pages/home';
import { clearCustomRegulators } from '@/entities/regulator/model/regulatorsStore';
import { clearAllDrafts, clearPanelDrafts } from '@/entities/draft/model/draftStore';
import { getCurrentReport } from '@/entities/report/model/reportStore';
import { downloadReport } from '@/entities/report/model/report';
import { pushRecent } from '@/entities/preferences/model/prefsStore';
import { APP_VERSION } from '@/shared/config/constants';
import {
  ACTIVE_KEY,
  MAX_DESIGN_FILE_BYTES,
  applyDesignFile,
  downloadDesignFile,
  parseDesignFile,
} from '@/features/design-file';

function validPanelId(id: string | null | undefined): id is string {
  return !!id && (id === HOME_ID || !!CALCULATOR_REGISTRY[id] || !!groupOf(id));
}

/** 从 #/页面id 读取页面，便于书签、刷新与前进/后退。 */
function panelFromHash(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return validPanelId(raw) ? raw : null;
}

/** 应用外壳：标题栏 + 菜单栏 + 左侧分类树 + 右侧计算面板 */
export function App() {
  const [active, setActive] = useState(() => {
    const fromHash = panelFromHash();
    if (fromHash) return fromHash;
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      return validPanelId(saved) ? saved : HOME_ID;
    } catch {
      return HOME_ID;
    }
  });
  const [resetKey, setResetKey] = useState(0);
  const [about, setAbout] = useState(false);
  const [palette, setPalette] = useState(false);
  const [favoritesTick, setFavoritesTick] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const pushedRef = useRef(false);
  const designInputRef = useRef<HTMLInputElement>(null);
  const { setSystem } = useUnitSystem();

  const go = useCallback((id: string) => {
    if (!validPanelId(id)) return;
    setActive(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const importDesignFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // 清空 value，允许再次选择同一个文件。
    input.value = '';
    if (!file) return;

    if (file.size > MAX_DESIGN_FILE_BYTES) {
      setNotice({
        tone: 'bad',
        text: `设计文件超过 ${MAX_DESIGN_FILE_BYTES / 1024} KB，已拒绝导入。`,
      });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ tone: 'bad', text: '读取设计文件失败，请确认文件可访问后重试。' });
      return;
    }
    const parsed = parseDesignFile(text);
    if (!parsed.ok) {
      setNotice({ tone: 'bad', text: `无法导入设计文件：${parsed.error}` });
      return;
    }

    const draftCount = Object.keys(parsed.file.drafts).length;
    const regulatorCount = parsed.file.customRegulators.length;
    if (
      !window.confirm(
        `导入「${file.name}」将写入 ${draftCount} 份页面草稿与 ${regulatorCount} 个自定义稳压器，并覆盖本机现有草稿，是否继续？`,
      )
    ) {
      return;
    }

    try {
      const applied = applyDesignFile(parsed.file, validPanelId);
      setSystem(applied.unitSystem);
      if (applied.active) setActive(applied.active);
      setResetKey((key) => key + 1);
      setNotice({
        tone: 'ok',
        text: `已导入设计文件：${draftCount} 份草稿、${regulatorCount} 个自定义稳压器。`,
      });
    } catch (error) {
      setNotice({
        tone: 'bad',
        text: `导入失败：${(error as Error).message || '浏览器本地存储不可用或空间不足。'}`,
      });
    }
  };

  const exportDesignFile = () => {
    try {
      downloadDesignFile(active);
      setNotice({ tone: 'ok', text: '设计文件已导出。' });
    } catch {
      setNotice({ tone: 'bad', text: '导出设计文件失败：浏览器不允许下载文件。' });
    }
  };

  // 持久化当前页面并同步地址栏；首页不写入最近使用。
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, active);
    } catch {
      /* 本地存储不可用时忽略 */
    }
    if (active !== HOME_ID) pushRecent(active);
    const target = `#/${active}`;
    if (window.location.hash === target) {
      pushedRef.current = true;
      return;
    }
    // 首次加载替换当前历史项；之后的页面切换压入历史，支持浏览器前进/后退。
    if (pushedRef.current) {
      window.history.pushState(null, '', target);
    } else {
      window.history.replaceState(null, '', target);
      pushedRef.current = true;
    }
  }, [active]);

  useEffect(() => {
    const syncFromHash = () => {
      const next = panelFromHash();
      if (next) setActive(next);
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  // 首屏渲染后空闲预取常用面板，首次切换不再等待。
  useEffect(() => {
    prefetchWhenIdle(['regulator_3term', 'resistor_calc', 'via', 'led_resistor']);
  }, []);

  // Ctrl / Cmd + K 打开命令面板；输入态同样可用，故不走 TreeNav 的 "/" 逻辑。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const spec = CALCULATOR_REGISTRY[active] ?? CALCULATOR_REGISTRY['regulator_3term']!;
  const group = groupOf(active) ?? groupOf(spec.id);
  const ActivePanel = PANEL_COMPONENTS[active] ?? PANEL_COMPONENTS[spec.id];
  const standard = standardOf(active);
  const confidence = standard
    ? {
        label: CONFIDENCE_LABEL[standard.confidence],
        errorBand: standard.errorBand,
        basis: standard.basis,
      }
    : null;

  let panel;
  if (active === HOME_ID) {
    panel = (
      <HomePanel
        onPick={(id) => {
          setFavoritesTick((t) => t + 1);
          go(id);
        }}
      />
    );
  } else if (ActivePanel) {
    panel = <ActivePanel group={group} />;
  } else {
    const FallbackPanel = FALLBACK_PANEL;
    panel = <FallbackPanel spec={spec} group={group} />;
  }

  return (
    <div className="win">
      <header className="apphead">
        <TitleBar onHome={() => go(HOME_ID)} />
        <MenuBar
          onImportDesign={() => designInputRef.current?.click()}
          onExportDesign={exportDesignFile}
          onReset={() => {
            clearPanelDrafts(active);
            setResetKey((k) => k + 1);
          }}
          onClearDrafts={() => {
            clearAllDrafts();
            setResetKey((k) => k + 1);
          }}
          onClearRegulators={() => {
            clearCustomRegulators();
            setResetKey((k) => k + 1);
          }}
          onExportReport={(format) => {
            const snapshot = getCurrentReport();
            if (!snapshot || snapshot.id !== active) {
              window.alert('当前页面暂未生成可导出的报告。');
              return;
            }
            downloadReport(snapshot, format, {
              version: APP_VERSION,
              pageUrl: window.location.href,
              standard: standard ? `${standard.basis} · ${standard.clause}` : undefined,
              confidence: standard
                ? `${CONFIDENCE_LABEL[standard.confidence]}（误差 ${standard.errorBand}）`
                : undefined,
            });
          }}
          onHome={() => go(HOME_ID)}
          onPalette={() => setPalette(true)}
          onAbout={() => setAbout(true)}
        />
        <div className="head-right">
          <UnitSwitch />
          <ThemeToggle />
          <span className="head-status" aria-hidden="true">
            <i className="hled" />
            READY
          </span>
        </div>
      </header>
      <div className="win-body">
        <TreeNav
          active={active}
          onPick={go}
          favoritesTick={favoritesTick}
          onPrefetch={prefetchPanel}
        />
        <main className="pane" key={`${active}:${resetKey}`}>
          <CalculationBasis moduleId={active} />
          <ResultConfidenceProvider value={confidence}>
            <Suspense
              fallback={
                <div className="pane-loading" role="status" aria-live="polite">
                  <i aria-hidden="true" />
                  正在加载计算面板…
                </div>
              }
            >
              {panel}
            </Suspense>
          </ResultConfidenceProvider>
        </main>
      </div>
      <input
        ref={designInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importDesignFile}
      />
      {notice && (
        <div className={`toast ${notice.tone}`} role="status" aria-live="polite">
          <i aria-hidden="true" />
          {notice.text}
        </div>
      )}
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onPick={(id) => {
          setFavoritesTick((t) => t + 1);
          go(id);
        }}
      />
      {about && <AboutDialog onClose={() => setAbout(false)} />}
    </div>
  );
}
