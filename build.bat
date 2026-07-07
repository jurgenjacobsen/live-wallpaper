@echo off
setlocal
echo [build] Building Live Wallpaper v2 with Wails...
wails build -platform windows/amd64 -clean
if %ERRORLEVEL% NEQ 0 (
    echo [build] ERROR: wails build failed.
    exit /b %ERRORLEVEL%
)
echo [build] Done! Executable is ready at build\bin\Live Wallpaper.exe
endlocal
