@echo off
setlocal

echo [build] Building React frontend...
set VITE_PLANE_API_BASE_URL=/plane-api
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [build] ERROR: npm run build failed.
    exit /b %ERRORLEVEL%
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set APP_VERSION=%%v
if "%APP_VERSION%"=="" set APP_VERSION=0.1.0

echo [build] Embedding Windows icon and executable metadata...
pushd go
go run github.com/tc-hib/go-winres@latest simply --icon assets/icon.png --manifest gui --product-name "Live Wallpaper" --file-description "Live Wallpaper" --original-filename "Live Wallpaper.exe" --product-version "%APP_VERSION%" --file-version "%APP_VERSION%" --out rsrc
if %ERRORLEVEL% NEQ 0 (
    popd
    echo [build] ERROR: go-winres failed.
    exit /b %ERRORLEVEL%
)

echo [build] Building Go executable...
go build -ldflags="-H windowsgui -X main.appVersion=%APP_VERSION%" -o "..\Live Wallpaper.exe" .
if %ERRORLEVEL% NEQ 0 (
    popd
    echo [build] ERROR: go build failed.
    exit /b %ERRORLEVEL%
)
popd

echo [build] Done! Live Wallpaper.exe is ready.
echo [build] Run "Live Wallpaper.exe" and complete the first-run setup form in your browser.
endlocal
