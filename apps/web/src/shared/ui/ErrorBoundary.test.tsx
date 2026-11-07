// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/shared/ui';

function Boom(): never {
  throw new Error('boom');
}

describe('面板错误边界', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('子组件正常渲染时不显示错误页', () => {
    render(
      <ErrorBoundary>
        <span>正常内容</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('捕获异常后显示可恢复操作', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRetry = vi.fn();
    const onResetDraft = vi.fn();
    const onHome = vi.fn();

    render(
      <ErrorBoundary title="过孔参数" onRetry={onRetry} onResetDraft={onResetDraft} onHome={onHome}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('过孔参数发生异常')).toBeTruthy();

    fireEvent.click(screen.getByText('重试'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('清除本页草稿并重试'));
    expect(onResetDraft).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('返回首页'));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
