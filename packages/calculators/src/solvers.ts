/**
 * 纯求解器聚合出口，仅供 Node 脚本与 CLI 使用。
 * Web 面板按子路径导入（如 `@calcbridge/calculators/cable`），
 * 避免把全部求解器打进首屏共享 chunk。
 */
export * from './cable/solver';
export * from './clearance/table';
export * from './e_series/solver';
export * from './fuse/solver';
export * from './galvanic/solver';
export * from './led_resistor/solver';
export * from './rf_attenuator/solver';
export * from './skin_depth/solver';
export * from './via/solver';
export * from './waveguide/solver';
export * from './trace_extras/solver';
export * from './unit_converter/units';
export * from './color_code/colors';
