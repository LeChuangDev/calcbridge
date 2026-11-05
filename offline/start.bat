@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 goto run_python

where py >nul 2>nul
if %errorlevel%==0 goto run_py

echo [calcbridge] 未检测到 Python 3。
echo 请先安装 Python 3.8 或更高版本：https://www.python.org/downloads/
pause
exit /b 1

:run_python
python start.py %*
goto done

:run_py
py -3 start.py %*
goto done

:done
if %errorlevel% neq 0 pause
endlocal
