/** 当前页面报告快照。面板通过 useReport 注册，菜单导出时读取。 */
import { useEffect } from 'react';
import type { ReportSnapshot } from './report';

let current: ReportSnapshot | null = null;

export function setCurrentReport(snapshot: ReportSnapshot | null): void {
  current = snapshot;
}

export function getCurrentReport(): ReportSnapshot | null {
  return current;
}

export function useReport(snapshot: ReportSnapshot | null): void {
  useEffect(() => {
    setCurrentReport(snapshot);
  }, [snapshot]);
}
