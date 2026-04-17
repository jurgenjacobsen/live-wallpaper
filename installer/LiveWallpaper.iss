; Inno Setup script for Live Wallpaper
; Build with: ISCC installer\LiveWallpaper.iss

#define MyAppName "Live Wallpaper"
#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#ifndef MyAppPublisher
  #define MyAppPublisher "Live Wallpaper"
#endif
#ifndef MySourceExe
  #define MySourceExe "..\\Live Wallpaper.exe"
#endif

[Setup]
AppId={{8D31BBCE-2615-4A8D-B8F7-95A9F58A8E0A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
VersionInfoVersion={#MyAppVersion}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoTextVersion={#MyAppVersion}
DefaultDirName={localappdata}\Live Wallpaper
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=dist
OutputBaseFilename=LiveWallpaper-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "{#MySourceExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\Live Wallpaper.exe"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\Live Wallpaper.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Live Wallpaper.exe"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
