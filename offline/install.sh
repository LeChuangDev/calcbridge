#!/usr/bin/env bash
# calcbridge 离线版 Linux 安装脚本
# 用法：
#   ./install.sh                 安装到当前用户（~/.local）
#   ./install.sh --system        安装到 /usr/local（需要 sudo）
#   ./install.sh --prefix ~/apps 安装到指定前缀
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
prefix="${PREFIX:-$HOME/.local}"

for arg in "$@"; do
  case "$arg" in
    --system) prefix="/usr/local" ;;
    --prefix) echo "请使用 --prefix=路径 或 PREFIX=路径 ./install.sh" >&2; exit 1 ;;
    --prefix=*) prefix="${arg#--prefix=}" ;;
    -h|--help)
      sed -n '2,7p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) echo "未知参数：$arg" >&2; exit 1 ;;
  esac
done

if [ "$prefix" = "/usr/local" ] && [ "$(id -u)" -ne 0 ]; then
  echo "安装到 /usr/local 需要管理员权限，请运行：sudo ./install.sh --system" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未检测到 python3，请先安装 Python 3.8 或更高版本。" >&2
  exit 1
fi

dest="$prefix/share/calcbridge"
echo "正在安装 calcbridge 离线版到：$dest"

rm -rf "$dest"
mkdir -p "$dest" "$prefix/bin" "$prefix/share/applications"
cp -R "$here/app" "$dest/app"
cp "$here/start.py" "$dest/start.py"
cp "$here/uninstall.sh" "$dest/uninstall.sh"
chmod +x "$dest/uninstall.sh"

cat > "$prefix/bin/calcbridge" <<EOF
#!/usr/bin/env sh
exec python3 "$dest/start.py" "\$@"
EOF
chmod +x "$prefix/bin/calcbridge"

cat > "$prefix/share/applications/calcbridge.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=calcbridge
Comment=面板式工程计算器（离线版）
Exec="$prefix/bin/calcbridge"
Icon="$dest/app/icon.svg"
Terminal=true
Categories=Utility;Engineering;
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$prefix/share/applications" >/dev/null 2>&1 || true
fi

echo ""
echo "安装完成。"
echo "  启动：calcbridge（或在应用菜单中搜索 calcbridge）"
echo "  卸载：$dest/uninstall.sh"
if [ "$prefix" = "$HOME/.local" ]; then
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) echo "提示：请把 $HOME/.local/bin 加入 PATH，才能直接运行 calcbridge。" ;;
  esac
fi
