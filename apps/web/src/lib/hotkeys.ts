/** 全局快捷键：监听器只注册一次，始终调用最新的计算回调。 */
import { useEffect, useRef } from 'react';

export function useCtrlEnter(onTrigger: () => void): void {
  const latest = useRef(onTrigger);
  latest.current = onTrigger;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
