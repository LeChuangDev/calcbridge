import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

/**
 * 离线单文件构建配置。
 * 输出到 apps/web/offline-build，再由 scripts/build-offline.mjs 把 JS/CSS/图标
 * 全部内联进一个 HTML；因此这里使用相对 base、单包 iife，避免 file:// 下的模块加载限制。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': srcDir },
  },
  build: {
    outDir: 'offline-build',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
