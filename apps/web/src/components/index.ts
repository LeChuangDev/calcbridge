/**
 * 共享 UI 原语的统一出口。
 * 只导出无业务语义的展示组件；业务面板一律放在 features/ 下。
 */
export { InputField } from './InputField';
export { VerdictBadge } from './VerdictBadge';
export { OutputDisplay } from './OutputDisplay';
export { ResultCard } from './ResultCard';
export { MonteCarloPanel } from './MonteCarloPanel';
export { AssumptionsPanel } from './AssumptionsPanel';

// 截面 / 电路示意图
export { MicrostripFigure } from '@/components/figures/MicrostripFigure';
export { RegulatorFigure } from '@/components/figures/RegulatorFigure';
export { ResistorFigure } from '@/components/figures/ResistorFigure';
export { TraceFigure } from '@/components/figures/TraceFigure';
export { InductorFigure } from '@/components/figures/InductorFigure';
