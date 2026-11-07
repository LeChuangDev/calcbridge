import { createContext, useContext, type ReactNode } from 'react';

export interface ResultConfidence {
  /** 理论计算值 / 工程估算值 / 规范参考值 */
  label: string;
  errorBand: string;
  basis: string;
}

const ResultConfidenceContext = createContext<ResultConfidence | null>(null);

/** 由应用层注入当前模块的可信度信息，输出组件只负责展示。 */
export function ResultConfidenceProvider({
  value,
  children,
}: {
  value: ResultConfidence | null;
  children: ReactNode;
}) {
  return (
    <ResultConfidenceContext.Provider value={value}>{children}</ResultConfidenceContext.Provider>
  );
}

export function useResultConfidence(): ResultConfidence | null {
  return useContext(ResultConfidenceContext);
}
