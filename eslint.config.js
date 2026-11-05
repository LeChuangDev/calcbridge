import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * 全仓库统一规范（ESLint 9 flat config）。
 * 除通用 TS / React 规则外，这里用 no-restricted-imports 把分层约束固化成可执行检查：
 *   lib（基础设施）  → 不得依赖 app / features / components
 *   features（领域） → 不得依赖 app 外壳，且不横向依赖其它 feature
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'apps/web/dist/**',
      'apps/web/offline-build/**',
      'offline/app/**',
      'build/**',
      'restructure.mjs',
      'split.mjs',
      'fiximports.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // 跨层/跨模块一律走 @/ 别名，避免 ../../.. 这类脆弱相对路径
              group: ['..\\..\\..\\*', '../../../*'],
              message: '跨三层以上的相对导入请改用 @/ 别名。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/features/**', '@/components/**', '@/providers/**'],
              message: 'lib 层是基础设施，不得反向依赖 app / features / components / providers。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/features/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**'],
              message: 'feature 不得依赖应用外壳 app/（全局状态请用 @/providers/*）。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    // Provider 与 hook 同文件导出是 React 通用模式
    files: ['apps/web/src/providers/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // CLI 的输出就是产品行为
    files: ['packages/cli/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // 构建脚本运行在 Node，输出进度属于脚本行为
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'no-console': 'off' },
  },
  prettier,
);
