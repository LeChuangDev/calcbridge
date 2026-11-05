@echo off
setlocal
if exist "%~dp0.installed" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" -InstallDir "%~dp0."
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
)
if %errorlevel% neq 0 pause
endlocal
