import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 通用模态框：统一 Esc 关闭、遮罩点击关闭、打开即聚焦与 aria 语义。
 * 业务弹窗（关于、命令面板等）一律复用，避免各自实现一套键盘行为。
 */
export function Modal({
  title,
  titleId,
  onClose,
  children,
  footer,
  className = '',
}: {
  title?: ReactNode;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-mask" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <header id={titleId}>{title}</header> : null}
        {children}
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}
