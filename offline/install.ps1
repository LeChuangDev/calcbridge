# calcbridge 离线版 Windows 安装脚本（当前用户安装，无需管理员权限）
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\calcbridge'),
  [switch]$NoShortcuts,
  [switch]$NoRegistry
)

$ErrorActionPreference = 'Stop'
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  throw '未检测到 Python 3。请先安装 Python 3.8+：https://www.python.org/downloads/'
}

$versionFile = Join-Path $Source 'app\VERSION'
$version = if (Test-Path $versionFile) { (Get-Content $versionFile -Raw).Trim() } else { '0.6.0' }

Write-Host "正在安装 calcbridge 离线版到：$InstallDir"
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Copy-Item (Join-Path $Source 'app') -Destination $InstallDir -Recurse
Copy-Item (Join-Path $Source 'start.py') $InstallDir
Copy-Item (Join-Path $Source 'start.bat') $InstallDir
Copy-Item (Join-Path $Source 'uninstall.ps1') $InstallDir
Copy-Item (Join-Path $Source 'uninstall.bat') $InstallDir
# 安装标记：供 uninstall.bat 判断是否处于已安装目录
New-Item -ItemType File -Force -Path (Join-Path $InstallDir '.installed') | Out-Null

if (-not $NoShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $target = Join-Path $InstallDir 'start.bat'
  $places = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    [Environment]::GetFolderPath('Desktop')
  )
  foreach ($dir in $places) {
    if (-not (Test-Path $dir)) { continue }
    $link = $shell.CreateShortcut((Join-Path $dir 'calcbridge.lnk'))
    $link.TargetPath = $target
    $link.WorkingDirectory = $InstallDir
    $link.Description = 'calcbridge 面板式工程计算器（离线版）'
    if ($python) { $link.IconLocation = "$($python.Source),0" }
    $link.Save()
  }
}

if (-not $NoRegistry) {
  $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\calcbridge'
  New-Item -Path $key -Force | Out-Null
  Set-ItemProperty -Path $key -Name DisplayName -Value 'calcbridge 面板式工程计算器（离线版）'
  Set-ItemProperty -Path $key -Name DisplayVersion -Value $version
  Set-ItemProperty -Path $key -Name Publisher -Value '樂創 LeChuang'
  Set-ItemProperty -Path $key -Name InstallLocation -Value $InstallDir
  Set-ItemProperty -Path $key -Name UninstallString -Value (
    'powershell -NoProfile -ExecutionPolicy Bypass -File "{0}\uninstall.ps1" -InstallDir "{0}"' -f $InstallDir
  )
  Set-ItemProperty -Path $key -Name NoModify -Value 1 -Type DWord
  Set-ItemProperty -Path $key -Name NoRepair -Value 1 -Type DWord
}

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host '  启动：开始菜单 / 桌面上的 calcbridge 快捷方式'
Write-Host "  命令行：`"$InstallDir\start.bat`""
Write-Host '  卸载：设置 → 应用 → calcbridge，或运行安装目录下的 uninstall.bat'
