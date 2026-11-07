/** 兼容入口：微带线多模型实现已下沉到 @calcbridge/core，供 Web 与校验 CLI 共用。 */
export {
  IMPEDANCE_MODELS,
  confidenceLabel,
  confidenceTone,
  evaluateImpedance,
  type ImpedanceEvaluation,
  type ImpedanceMode,
  type ImpedanceModel,
  type ImpedanceSummary,
  type MicrostripParams,
} from '@calcbridge/core';
