import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 与 tsconfig paths 保持一致：跨层引用一律走 @/ 别名，禁止深层 ../../ 相对路径。
const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// 生产 CSP：脚本全部来自本地构建产物；样式含 React 内联 style，故需 style-src 'unsafe-inline'。
// 开发服务器不启用严格 CSP，避免 Vite/React Refresh 的内联启动脚本被拦截。
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};

// 直接消费 monorepo 内 TS 源码包（@calcbridge/core 的 main 指向 src/index.ts）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': srcDir },
  },
  server: {
    port: 5173,
    // 默认只监听本机；需要手机/局域网联调时显式设置 CALCBRIDGE_DEV_HOST=0.0.0.0。
    host: process.env.CALCBRIDGE_DEV_HOST || '127.0.0.1',
    headers: BASE_SECURITY_HEADERS,
  },
  preview: {
    headers: {
      ...BASE_SECURITY_HEADERS,
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    },
  },
  optimizeDeps: {
    exclude: ['@calcbridge/core', '@calcbridge/calculators'],
  },
  build: {
    // 计算器面板已经是动态 import；这里再把 React 单独分包，利用长期缓存。
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
