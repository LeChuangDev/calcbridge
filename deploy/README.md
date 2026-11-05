# 生产部署安全头

本目录提供静态部署的安全响应头示例。应用本身不写 CSP meta 标签，因为 Vite 开发模式会注入内联
React Refresh 脚本；安全策略应在生产部署层按环境下发。

## 当前策略

- `Content-Security-Policy`
  - `script-src 'self'`：不加载第三方脚本，不允许内联脚本；
  - `style-src 'self' 'unsafe-inline'`：报告中的色环、蒙特卡洛条形图等使用 React 内联 `style`，因此保留样式内联；
  - `object-src 'none'`、`base-uri 'none'`、`frame-ancestors 'none'`、`form-action 'none'`；
  - `img-src 'self' data:`：允许本地图标/数据 URI。
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`（与 `frame-ancestors 'none'` 双重防点击劫持）

## 使用方式

### Netlify / Cloudflare Pages

`apps/web/public/_headers` 会在 `npm run build:web` 时复制到 `dist/_headers`，由平台自动读取。
部署目录选择 `apps/web/dist`。

### Nginx

将 `apps/web/dist` 复制到 `/usr/share/nginx/html`，并在 `nginx.conf` 的 `http` 块中 include
`deploy/nginx-calcbridge.conf`。TLS 建议在反向代理层终止；不要在未确认全站 HTTPS 前开启 HSTS。

### Vercel

在项目根目录 `vercel.json` 中配置等价的 `headers` 与 SPA `rewrites`，或直接在 Vercel 项目设置中
添加同名响应头。`buildCommand` 使用 `npm run build:web`，`outputDirectory` 使用 `apps/web/dist`。

## 验证

```bash
npm run build:web
npm run preview
curl -I http://127.0.0.1:4173/
```

确认响应包含 `Content-Security-Policy`、`X-Content-Type-Options`、`Referrer-Policy`、
`Permissions-Policy` 与 `X-Frame-Options`。首次上线建议先用
`Content-Security-Policy-Report-Only` 观察违规，再切换为强制模式。

## 已知边界

- CSP 不能替代输入校验与输出编码；文件导入校验仍由 `designFile.ts` / `regulatorData.ts` 负责。
- 若未来引入第三方脚本、字体或分析服务，必须同步更新 `script-src` / `font-src` / `connect-src`，
  并优先使用 SRI 或自托管。
