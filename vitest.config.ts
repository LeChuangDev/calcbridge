import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 全仓库单测入口。
 * 这里只配置路径别名与测试范围；业务代码零依赖测试框架，packages 与 apps 共享同一套配置。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // 只统计计算内核与求解器，不把样式、静态数据与 UI 组件计入分母。
      include: [
        'packages/core/src/**/*.ts',
        'packages/calculators/src/**/*.ts',
        'apps/web/src/features/*/model/**/*.ts',
        'apps/web/src/entities/*/model/**/*.ts',
        'apps/web/src/shared/lib/**/*.ts',
      ],
      exclude: ['**/*.test.ts', 'apps/web/src/features/*/model/*.test.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
