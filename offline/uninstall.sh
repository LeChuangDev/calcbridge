#!/usr/bin/env bash
# calcbridge 离线版 Linux 卸载脚本
# 安装目录内运行时自动识别前缀；在仓库内运行时使用 PREFIX（默认 ~/.local）。
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$here/app/index.html" ] && [ "$(basename "$here")" = "calcbridge" ]; then
  prefix="$(cd "$here/../.." && pwd)"
else
  prefix="${PREFIX:-$HOME/.local}"
  for arg in "$@"; do
    case "$arg" in
      --system) prefix="/usr/local" ;;
      --prefix=*) prefix="${arg#--prefix=}" ;;
    esac
  done
fi

if [ "$prefix" = "/usr/local" ] && [ "$(id -u)" -ne 0 ]; then
  echo "卸载 /usr/local 下的安装需要管理员权限，请运行：sudo ./uninstall.sh --system" >&2
  exit 1
fi

echo "正在卸载 calcbridge 离线版：$prefix"
rm -rf "$prefix/share/calcbridge"
rm -f "$prefix/bin/calcbridge"
rm -f "$prefix/share/applications/calcbridge.desktop"
echo "已卸载 calcbridge 离线版。"
