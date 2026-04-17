@echo off
setlocal

if not exist "Live Wallpaper.exe" (
    echo [installer] Live Wallpaper.exe not found in repository root.
    echo [installer] Run build.bat first.
    exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set APP_VERSION=%%v
if "%APP_VERSION%"=="" set APP_VERSION=0.1.0

where ISCC >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    set ISCC_CMD=ISCC
) else (
    set "ISCC_CMD=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

if not exist "%ISCC_CMD%" (
    echo [installer] Inno Setup compiler not found.
    echo [installer] Install Inno Setup from: https://jrsoftware.org/isinfo.php
    echo [installer] Then rerun this script.
    exit /b 1
)

echo [installer] Building installer for version %APP_VERSION%...
"%ISCC_CMD%" "/DMyAppVersion=%APP_VERSION%" "/DMySourceExe=..\Live Wallpaper.exe" "installer\LiveWallpaper.iss"
if %ERRORLEVEL% NEQ 0 (
    echo [installer] ERROR: installer build failed.
    exit /b %ERRORLEVEL%
)

echo [installer] Done.
echo [installer] Output: installer\dist\LiveWallpaper-Setup-%APP_VERSION%.exe
endlocal
