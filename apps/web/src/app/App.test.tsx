// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/shared/lib/providers/ThemeProvider';
import { UnitSystemProvider } from '@/shared/lib/providers/UnitSystemProvider';
import { App } from '@/app/App';

/** 应用外壳冒烟测试：路由、导航、命令面板、主题切换。 */
function renderApp() {
  return render(
    <ThemeProvider>
      <UnitSystemProvider>
        <App />
      </UnitSystemProvider>
    </ThemeProvider>,
  );
}

describe('应用外壳', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
    document.documentElement.dataset.theme = '';
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    // jsdom 未实现 scrollIntoView，导航树会用到
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('首次进入落在工具目录首页，并列出全部工具卡片', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: '工具目录' })).toBeTruthy();
    // 首页卡片与左侧导航都会出现同名项，这里只要求至少各有一个入口
    expect(screen.getAllByRole('button', { name: /过孔参数/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /趋肤深度/ }).length).toBeGreaterThan(0);
    expect(window.location.hash).toBe('#/home');
  });

  it('点击左侧导航切换到对应计算器并写入地址栏', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /^过孔参数$/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/via'));
    expect(await screen.findByRole('heading', { name: '过孔参数' })).toBeTruthy();
  });

  it('命令面板：Ctrl+K 打开，输入关键词回车直达工具', async () => {
    renderApp();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByLabelText('搜索工具或命令');
    fireEvent.change(input, { target: { value: '阻抗' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(window.location.hash).toBe('#/impedance_microstrip'));
    expect(await screen.findByRole('heading', { name: /阻抗/ })).toBeTruthy();
  });

  it('主题开关写入 data-theme 并持久化', async () => {
    renderApp();
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: /切换到浅色主题/ }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(localStorage.getItem('calcbridge.theme')).toBe('light');
  });

  it('未知 hash 回退到首页而不是崩溃', () => {
    window.location.hash = '#/not-a-panel';
    renderApp();
    expect(screen.getByRole('heading', { name: '工具目录' })).toBeTruthy();
  });
});
