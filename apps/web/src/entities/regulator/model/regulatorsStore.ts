/** 自定义稳压器本地存储键与清理操作（非组件导出，独立成模块以稳定 HMR）。 */
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export const REG_LS = STORAGE_KEYS.regulators;

/** 清除本地自定义稳压器（菜单“设置”调用） */
export function clearCustomRegulators(): void {
  localStorage.removeItem(REG_LS);
}
