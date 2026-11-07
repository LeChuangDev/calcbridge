import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 当前面板名称，用于错误提示 */
  title?: string;
  onRetry?: () => void;
  onResetDraft?: () => void;
  onHome?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 面板级错误边界：单个计算器异常时只替换当前面板，
 * 外壳、导航与其他页面保持可用，并提供重试/清草稿/回首页的恢复路径。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[calcbridge] 计算面板异常', error, info.componentStack);
  }

  private retry = (): void => {
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  private resetDraft = (): void => {
    this.props.onResetDraft?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="error-pane" role="alert" aria-live="assertive">
        <header>
          <span className="error-kicker">PANEL ERROR</span>
          <h2>{this.props.title ?? '当前计算面板'}发生异常</h2>
        </header>
        <p>其他页面仍可正常使用。可以先重试；若由损坏的本页草稿引起，可清除本页草稿后重试。</p>
        <details>
          <summary>错误详情</summary>
          <pre>{error.message || '未知错误'}</pre>
        </details>
        <div className="error-actions">
          <button className="btn" onClick={this.retry}>
            重试
          </button>
          <button className="btn" onClick={this.resetDraft}>
            清除本页草稿并重试
          </button>
          {this.props.onHome && (
            <button className="btn" onClick={this.props.onHome}>
              返回首页
            </button>
          )}
        </div>
      </section>
    );
  }
}
