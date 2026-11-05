/**
 * 线缆截面选择（直流电压降法，双线回路）。
 *
 * A_req = 2·ρ·L·I / ΔV
 * R_loop = 2·ρ·L / A
 * ΔV = I·R_loop
 *
 * ρ 取 20°C 典型值：铜 0.0175 Ω·mm²/m，铝 0.0282 Ω·mm²/m。
 * 仅按电压降选型，不含载流量、绝缘、敷设方式与并联校正。
 */

export type CableMaterial = 'cu' | 'al';

export interface CableInput {
  voltageV: number;
  dropPct: number;
  currentA: number;
  lengthM: number;
  material: CableMaterial;
}

export interface CableResult {
  requiredArea: number;
  selectedArea: number;
  resistance: number;
  voltageDrop: number;
  actualDropPct: number;
  powerLoss: number;
  exceeded: boolean;
}

const RHO: Record<CableMaterial, number> = {
  cu: 0.0175,
  al: 0.0282,
};

export const CABLE_SIZES = [
  0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240,
];

export function solveCable(input: CableInput): { result: CableResult | null; error?: string } {
  const { voltageV, dropPct, currentA, lengthM, material } = input;
  if (
    ![voltageV, dropPct, currentA, lengthM].every((v) => Number.isFinite(v)) ||
    voltageV <= 0 ||
    dropPct <= 0 ||
    dropPct >= 100 ||
    currentA <= 0 ||
    lengthM <= 0
  ) {
    return { result: null, error: '电压、压降百分比、电流与长度必须为正数（压降 < 100%）。' };
  }

  const rho = RHO[material];
  const allowedDrop = (voltageV * dropPct) / 100;
  const requiredArea = (2 * rho * lengthM * currentA) / allowedDrop;

  const selected = CABLE_SIZES.find((s) => s >= requiredArea);
  const exceeded = selected === undefined;
  const selectedArea = selected ?? CABLE_SIZES[CABLE_SIZES.length - 1]!;
  const resistance = (2 * rho * lengthM) / selectedArea;
  const voltageDrop = currentA * resistance;
  const actualDropPct = (voltageDrop / voltageV) * 100;
  const powerLoss = currentA * currentA * resistance;

  return {
    result: {
      requiredArea,
      selectedArea,
      resistance,
      voltageDrop,
      actualDropPct,
      powerLoss,
      exceeded,
    },
  };
}
