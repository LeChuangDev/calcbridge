import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 冒烟配置。
 * 本地使用 Vite dev server，CI 使用构建后的 vite preview，避免开发态差异。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // 本地可复用系统 Chrome/Edge（PLAYWRIGHT_CHANNEL=chrome|msedge），CI 使用安装的 Chromium。
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' }
          : {}),
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'npx vite preview apps/web --host 127.0.0.1 --port 4173 --strictPort'
      : 'npx vite apps/web --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
