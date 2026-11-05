/**
 * 计算器面板路由表。
 * 只有需要定制交互的计算器才在此登记；其余一律走数据驱动的 GenericPanel（计算器即数据）。
 */
import type { ComponentType } from 'react';
import { GenericPanel } from './generic/GenericPanel';
import { RegulatorPanel } from './regulator/RegulatorPanel';
import { ResistorPanel } from './resistor/ResistorPanel';
import { ImpedancePanel } from './impedance/ImpedancePanel';
import { UnitConverterPanel } from './unit-converter/UnitConverterPanel';
import { ColorCodePanel } from './color-code/ColorCodePanel';
import { ESeriesPanel } from './e-series/ESeriesPanel';
import { ClearancePanel } from './clearance/ClearancePanel';
import { RfAttenuatorPanel } from './rf-attenuator/RfAttenuatorPanel';
import { ViaPanel } from './via/ViaPanel';
import { FusePanel } from './fuse/FusePanel';
import { CablePanel } from './cable/CablePanel';
import { WaveguidePanel } from './waveguide/WaveguidePanel';
import { PcbClassPanel } from './pcb-class/PcbClassPanel';
import { SubstratePanel } from './substrate/SubstratePanel';
import { GalvanicPanel } from './galvanic/GalvanicPanel';
import { SkinDepthPanel } from './skin-depth/SkinDepthPanel';
import { LedResistorPanel } from './led-resistor/LedResistorPanel';

export type PanelProps = { group?: string };
export type PanelComponent = ComponentType<PanelProps>;

export const PANEL_COMPONENTS: Record<string, PanelComponent> = {
  regulator_3term: RegulatorPanel,
  resistor_calc: ResistorPanel,
  impedance_microstrip: ImpedancePanel,
  unit_converter: UnitConverterPanel,
  color_code: ColorCodePanel,
  e_series: ESeriesPanel,
  clearance: ClearancePanel,
  rf_attenuator: RfAttenuatorPanel,
  via: ViaPanel,
  fuse: FusePanel,
  cable_size: CablePanel,
  waveguide: WaveguidePanel,
  pcb_class: PcbClassPanel,
  substrate: SubstratePanel,
  galvanic: GalvanicPanel,
  skin_depth: SkinDepthPanel,
  led_resistor: LedResistorPanel,
};

export const FALLBACK_PANEL = GenericPanel;
