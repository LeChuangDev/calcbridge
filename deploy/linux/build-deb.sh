#!/usr/bin/env bash
# 构建 Debian/Ubuntu 安装包
# 用法：bash deploy/linux/build-deb.sh <version>
# 前置：已运行 npm run build:offline，且系统有 dpkg-deb（Ubuntu/Debian 自带）
set -euo pipefail

version="${1:?用法: build-deb.sh <version>}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
appsrc="$root/offline/app"
outdir="$root/build"
pkg="$outdir/deb"

if [ ! -f "$appsrc/index.html" ]; then
  echo "缺少离线产物，请先运行：npm run build:offline" >&2
  exit 1
fi

rm -rf "$pkg"
install -d "$pkg/DEBIAN" \
  "$pkg/opt/calcbridge" \
  "$pkg/usr/bin" \
  "$pkg/usr/share/applications" \
  "$pkg/usr/share/icons/hicolor/scalable/apps"

cp -R "$appsrc" "$pkg/opt/calcbridge/app"
cp "$root/offline/start.py" "$pkg/opt/calcbridge/start.py"
cp "$appsrc/icon.svg" "$pkg/usr/share/icons/hicolor/scalable/apps/calcbridge.svg"

cat > "$pkg/usr/bin/calcbridge" <<'EOF'
#!/bin/sh
exec python3 /opt/calcbridge/start.py "$@"
EOF
chmod 0755 "$pkg/usr/bin/calcbridge"

cat > "$pkg/usr/share/applications/calcbridge.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=calcbridge
Comment=面板式工程计算器（离线版）
Exec=/usr/bin/calcbridge
Icon=calcbridge
Terminal=true
Categories=Utility;Engineering;
EOF
chmod 0644 "$pkg/usr/share/applications/calcbridge.desktop"

cat > "$pkg/DEBIAN/control" <<EOF
Package: calcbridge
Version: $version
Section: utils
Priority: optional
Architecture: all
Depends: python3
Maintainer: 樂創 LeChuang <dev@zhangwenle.com>
Description: calcbridge 面板式工程计算器（离线版）
 纯前端工程计算器，覆盖阻抗、叠层、过孔、稳压器、LED 等 19 个模块。
 本地启动 Python 静态服务并打开浏览器，不联网、无第三方 Python 依赖。
EOF

mkdir -p "$outdir"
dpkg-deb --build --root-owner-group "$pkg" "$outdir/calcbridge_${version}_all.deb"
echo "已生成：$outdir/calcbridge_${version}_all.deb"
