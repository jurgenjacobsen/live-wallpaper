# live-wallpaper

Live Wallpaper is a Windows desktop app that turns your wallpaper into a live status board.

It packages a React UI and a Go runtime into a single executable (`Live Wallpaper.exe`). The app serves the UI locally, captures it with headless Chrome, and applies it as wallpaper per monitor. It supports both Plane Kanban data and weather widgets, with monitor-level provider assignment.

## What it does

- Ships as a single Windows executable (no Node.js needed at runtime)
- First-run setup form in your browser for local configuration
- Per-monitor provider selection (`plane` or `weather`)
- Scheduled refresh with configurable intervals
- Tray controls for daily use and troubleshooting
- Automatic update check on startup via GitHub Releases
- Manual update check from the tray menu

## Runtime behavior

On startup, the app:
1. Loads or creates `live-wallpaper-config.json` next to the executable
2. Starts a local HTTP server for the embedded frontend
3. Captures monitor-specific wallpaper images and applies them
4. Runs recurring provider updates on configured intervals
5. Writes logs to `live-wallpaper.log` next to the executable

### Tray menu

The tray icon currently provides:

- Open settings
- Open logs
- Check for updates
- Update wallpapers
- Restart
- Shutdown

## Architecture

| Layer | Tech |
|-------|------|
| UI | React 19 + TypeScript + Tailwind CSS v4 via Vite |
| Runtime | Go |
| Capture | chromedp (headless Chrome) |
| Data providers | Plane REST API, Weather API |
| Scheduling | Go `time.Ticker` |
| Windows integration | systray + wallpaper APIs |
| Update checks | GitHub Releases API |

## Repository structure

```
.
├─ go/                     # Go runtime and main application module
│  ├─ assets/              # Runtime icon source
│  └─ dist/                # Embedded frontend build output
├─ src/                    # React app source
├─ public/                 # Static frontend assets
├─ scripts/                # Optional Node development utilities
├─ installer/              # Inno Setup script and installer output
├─ build.bat               # Build Live Wallpaper.exe
├─ build-installer.bat     # Build installer .exe
└─ Makefile                # Optional cross-platform build helpers
```

---

## Build `Live Wallpaper.exe`

### Prerequisites

| Tool | Where to get it |
|------|-----------------|
| Node.js >= 18 | https://nodejs.org |
| Go >= 1.22 | https://go.dev/dl/ |
| Google Chrome | https://www.google.com/chrome/ |

Chrome is required at runtime for headless capture.

### Build commands

Windows:

```cmd
build.bat
```

Or from npm:

```bash
npm run build:exe
```

Linux/macOS cross-compile helper:

```bash
make build-windows
```

Output:

- `Live Wallpaper.exe` in repository root

## Build installer (`.exe`)

The project includes an Inno Setup installer with:

- User-selectable install location
- Optional desktop shortcut
- Start Menu shortcut
- Versioned installer output filename

Prerequisite:

- Inno Setup 6 (`ISCC`): https://jrsoftware.org/isinfo.php

Commands:

```cmd
build.bat
build-installer.bat
```

Or from npm:

```bash
npm run build:exe
npm run build:installer
```

Output:

- `installer/dist/LiveWallpaper-Setup-<version>.exe`

Notes:

- Installer defaults to `%LOCALAPPDATA%\Live Wallpaper`
- This avoids admin requirements and keeps config/logs writable

## Update delivery model

- App checks latest GitHub release once at startup
- User can manually trigger check via tray (`Check for updates`)
- If a newer version exists, the app prompts to open the release page
- Recommended release process: publish a new installer for each version

## Development workflow (frontend/util scripts)

For frontend-only iteration:

```bash
npm install
npm run dev
```

Optional Node capture scripts:

```bash
npm run wallpaper
npm run schedule
```

These scripts are convenience tools for local development. Production runtime uses the Go app.

## Plane board mapping

Issue columns are grouped as:

| Column | Plane states |
|--------|---------------|
| Todo | `backlog`, `unstarted`, `cancelled` |
| In Progress | `started` |
| Done | `completed` |

Issues are filtered to the current user, and to active cycle issues when a cycle exists.
