import { CONFIDENCE_LABEL, MODEL_CLASS_LABEL, standardOf } from '@/entities/calculator';

/** 计算依据与可信度标识条：所有模块统一从这里读取，避免页面各写一套。 */
export function CalculationBasis({ moduleId }: { moduleId: string }) {
  const std = standardOf(moduleId);
  if (!std) return null;

  return (
    <div className="calc-basis" role="note" aria-label="计算依据与可信度">
      <span className={`cb-chip conf-${std.confidence}`}>{CONFIDENCE_LABEL[std.confidence]}</span>
      <span className="cb-chip model">{MODEL_CLASS_LABEL[std.modelClass]}</span>
      <span className="cb-item" title={`${std.clause}\n${std.boundary}`}>
        依据：{std.basis}
      </span>
      <span className="cb-item">误差：{std.errorBand}</span>
      <span className="cb-boundary" title={std.boundary}>
        边界
      </span>
    </div>
  );
}
