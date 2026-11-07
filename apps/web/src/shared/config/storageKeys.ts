/**
 * 浏览器本地存储的键名唯一来源。
 * 所有 localStorage 读写必须引用此处的常量，避免键名散落导致清理/迁移遗漏。
 */
export const STORAGE_KEYS = {
  /** 当前打开的计算器 id */
  active: 'calcbridge.active',
  /** 长度单位制：metric / imperial */
  unitSystem: 'calcbridge.unitSystem',
  /** 左侧分类树的折叠状态 */
  navCollapsed: 'calcbridge.nav.collapsed',
  /** 页面输入草稿前缀（后接 `.` + 计算器 id） */
  draft: 'calcbridge.draft',
  /** 自定义稳压器列表 */
  regulators: 'calcbridge.regulators',
  /** 收藏的计算器 id 列表 */
  favorites: 'calcbridge.favorites',
  /** 最近使用的计算器 id 列表 */
  recent: 'calcbridge.recent',
  /** 界面主题：dark / light */
  theme: 'calcbridge.theme',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
