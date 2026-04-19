.PHONY: build build-windows clean

APP_VERSION := $(shell node -p "require('./package.json').version")

# Build for the current OS (useful if you are on Windows running make via Git Bash / WSL)
build:
	VITE_PLANE_API_BASE_URL=/plane-api npm run build
	cd go && go run github.com/tc-hib/go-winres@latest simply --icon assets/icon.png --manifest gui --product-name "Live Wallpaper" --file-description "Live Wallpaper" --original-filename "Live Wallpaper.exe" --product-version "$(APP_VERSION)" --file-version "$(APP_VERSION)" --out rsrc
	cd go && go build -ldflags="-H windowsgui -X main.appVersion=$(APP_VERSION)" -o "../Live Wallpaper.exe" .

# Cross-compile a Windows .exe from Linux / macOS
build-windows:
	VITE_PLANE_API_BASE_URL=/plane-api npm run build
	cd go && go run github.com/tc-hib/go-winres@latest simply --icon assets/icon.png --manifest gui --product-name "Live Wallpaper" --file-description "Live Wallpaper" --original-filename "Live Wallpaper.exe" --product-version "$(APP_VERSION)" --file-version "$(APP_VERSION)" --out rsrc
	cd go && GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui -X main.appVersion=$(APP_VERSION)" -o "../Live Wallpaper.exe" .

clean:
	rm -f "Live Wallpaper.exe" live-wallpaper.exe live-wallpaper go/rsrc.syso go/rsrc_windows_amd64.syso go/rsrc_windows_386.syso
	rm -rf go/dist/*
