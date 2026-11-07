/**
 * 共享 UI 原语的统一出口。
 * 只导出无业务语义的展示组件；业务面板一律放在 features/ 下。
 */
export { InputField } from '@/shared/ui/InputField';
export { FieldWarn } from '@/shared/ui/FieldWarn';
export { VerdictBadge } from '@/shared/ui/VerdictBadge';
export { OutputDisplay } from '@/shared/ui/OutputDisplay';
export { ResultCard } from '@/shared/ui/ResultCard';
export { MonteCarloPanel } from '@/shared/ui/MonteCarloPanel';
export { AssumptionsPanel } from '@/shared/ui/AssumptionsPanel';
export { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

// 截面 / 电路示意图
export { MicrostripFigure } from '@/shared/ui/figures/MicrostripFigure';
export { RegulatorFigure } from '@/shared/ui/figures/RegulatorFigure';
export { ResistorFigure } from '@/shared/ui/figures/ResistorFigure';
export { TraceFigure } from '@/shared/ui/figures/TraceFigure';
export { InductorFigure } from '@/shared/ui/figures/InductorFigure';
