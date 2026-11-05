# calcbridge 离线版 Windows 卸载脚本
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\calcbridge')
)

$ErrorActionPreference = 'Stop'
Write-Host "正在卸载 calcbridge 离线版：$InstallDir"

# 快捷方式
$links = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\calcbridge.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'calcbridge.lnk')
)
foreach ($link in $links) {
  if (Test-Path $link) { Remove-Item $link -Force }
}

# 卸载信息
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\calcbridge'
if (Test-Path $key) { Remove-Item $key -Recurse -Force }

# 程序目录
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }

Write-Host '已卸载 calcbridge 离线版。' -ForegroundColor Green
