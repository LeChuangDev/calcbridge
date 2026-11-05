; calcbridge 离线版 Windows 安装脚本（Inno Setup 6）
; 由 GitHub Actions 在 windows-latest 上使用，也可本地安装 Inno Setup 后编译：
;   ISCC.exe /DMyAppVersion=0.5.0 deploy\windows\calcbridge.iss
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

[Setup]
AppId={{6D2C8F1A-4B7E-4C3D-9A2F-1E5B6C7D8A90}
AppName=calcbridge
AppVersion={#MyAppVersion}
AppPublisher=樂創 LeChuang
DefaultDirName={localappdata}\Programs\calcbridge
DefaultGroupName=calcbridge
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=..\..\build\installer
OutputBaseFilename=calcbridge-{#MyAppVersion}-windows-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
UninstallDisplayName=calcbridge 面板式工程计算器（离线版）

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"

[Files]
Source: "..\..\offline\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\offline\start.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\offline\start.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\calcbridge"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\calcbridge"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\start.bat"; Description: "启动 calcbridge"; Flags: postinstall nowait skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if Exec('cmd.exe', '/C where python >nul 2>nul || where py >nul 2>nul', '',
          SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode <> 0 then
      MsgBox('未检测到 Python 3（3.8 或更高版本）。' + #13#10 +
             '安装完成后请先安装 Python，否则 calcbridge 无法启动。' + #13#10 +
             '下载地址：https://www.python.org/downloads/', mbInformation, MB_OK);
  end;
end;
