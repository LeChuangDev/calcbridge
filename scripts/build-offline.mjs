/**
 * 生成离线版（Python 本地启动）：构建 Web 产物并复制到 offline/app。
 * 构建：npm run build:offline
 * 启动：python offline/start.py
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');
const buildDir = join(webDir, 'offline-build');
const offlineDir = join(root, 'offline');
const appDir = join(offlineDir, 'app');

// 1. 构建（相对 base + iife 单包，兼容任意本地静态服务）
execSync('npx vite build -c vite.offline.config.ts', { cwd: webDir, stdio: 'inherit' });

// 2. 复制到 offline/app
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
cpSync(buildDir, appDir, { recursive: true });
rmSync(join(appDir, '_headers'), { force: true });

// 3. 版本号（供安装脚本读取）
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(join(appDir, 'VERSION'), `${pkg.version}\n`, 'utf8');

// 4. 自检
if (!existsSync(join(appDir, 'index.html'))) {
  throw new Error('离线包缺少 index.html');
}
const files = readdirSync(appDir, { recursive: true }).map(String);
if (!files.some((f) => f.endsWith('.js')) || !files.some((f) => f.endsWith('.css'))) {
  throw new Error('离线包缺少前端资源文件');
}

// 5. 清理中间产物与旧的单文件版本
rmSync(buildDir, { recursive: true, force: true });
rmSync(join(offlineDir, 'calcbridge.html'), { force: true });

console.log(`\n离线版已生成：${appDir}`);
console.log('启动方式：双击 start.bat，或执行 python start.py');
