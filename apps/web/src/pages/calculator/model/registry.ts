/**
 * 计算器面板路由表（页面级组合层）。
 * 只有需要定制交互的计算器才在此登记；其余一律走数据驱动的 GenericPanel（计算器即数据）。
 *
 * 这里全部使用动态 import：首屏只加载应用外壳与首页，面板在切换时按需加载，
 * 并通过 prefetchPanel 在悬停/聚焦时提前拉取对应切片。
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { CalcSpec } from '@calcbridge/core';

export type PanelProps = { group?: string };
export type PanelComponent = ComponentType<PanelProps>;
export type GenericPanelProps = { spec: CalcSpec; group?: string };
type PanelLoader = () => Promise<{ default: PanelComponent }>;

const loaders: Record<string, PanelLoader> = {
  regulator_3term: () =>
    import('@/features/calculator-regulator').then((m) => ({ default: m.RegulatorPanel })),
  resistor_calc: () =>
    import('@/features/calculator-resistor').then((m) => ({ default: m.ResistorPanel })),
  impedance_microstrip: () =>
    import('@/features/calculator-impedance').then((m) => ({ default: m.ImpedancePanel })),
  unit_converter: () =>
    import('@/features/calculator-unit-converter').then((m) => ({ default: m.UnitConverterPanel })),
  color_code: () =>
    import('@/features/calculator-color-code').then((m) => ({ default: m.ColorCodePanel })),
  e_series: () =>
    import('@/features/calculator-e-series').then((m) => ({ default: m.ESeriesPanel })),
  clearance: () =>
    import('@/features/calculator-clearance').then((m) => ({ default: m.ClearancePanel })),
  rf_attenuator: () =>
    import('@/features/calculator-rf-attenuator').then((m) => ({ default: m.RfAttenuatorPanel })),
  via: () => import('@/features/calculator-via').then((m) => ({ default: m.ViaPanel })),
  fuse: () => import('@/features/calculator-fuse').then((m) => ({ default: m.FusePanel })),
  cable_size: () => import('@/features/calculator-cable').then((m) => ({ default: m.CablePanel })),
  waveguide: () =>
    import('@/features/calculator-waveguide').then((m) => ({ default: m.WaveguidePanel })),
  pcb_class: () =>
    import('@/features/calculator-pcb-class').then((m) => ({ default: m.PcbClassPanel })),
  substrate: () =>
    import('@/features/calculator-substrate').then((m) => ({ default: m.SubstratePanel })),
  galvanic: () =>
    import('@/features/calculator-galvanic').then((m) => ({ default: m.GalvanicPanel })),
  skin_depth: () =>
    import('@/features/calculator-skin-depth').then((m) => ({ default: m.SkinDepthPanel })),
  led_resistor: () =>
    import('@/features/calculator-led-resistor').then((m) => ({ default: m.LedResistorPanel })),
};

export const PANEL_COMPONENTS: Record<
  string,
  LazyExoticComponent<PanelComponent>
> = Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazy(load)]));

export const FALLBACK_PANEL: LazyExoticComponent<ComponentType<GenericPanelProps>> = lazy(() =>
  import('@/features/calculator-generic').then((m) => ({ default: m.GenericPanel })),
);

/** 预取面板代码块；未知 id 静默忽略。 */
export function prefetchPanel(id: string | null | undefined): void {
  if (!id) return;
  void loaders[id]?.();
}

/** 空闲时预取常用面板，避免首次切换出现等待。 */
export function prefetchWhenIdle(ids: readonly string[]): void {
  // 不支持 requestIdleCallback 的环境（含 jsdom）直接跳过，避免拖慢首屏。
  if (typeof window.requestIdleCallback !== 'function') return;
  window.requestIdleCallback(() => ids.forEach(prefetchPanel), { timeout: 2000 });
}
