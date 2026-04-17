# live-wallpaper

A dynamic desktop wallpaper system that renders a live Kanban board (powered by **Plane.so**) as your desktop background.

## Architecture

| Layer | Tech |
|-------|------|
| UI | React 19 + TypeScript + Tailwind CSS v4 via Vite |
| Data | Plane.so REST API |
| Capture | Go + chromedp (headless Chrome) |
| Scheduling | Go `time.Ticker` (every 30 minutes) + tray "Update now" |
| OS integration | Windows `SystemParametersInfoW` + `IDesktopWallpaper` (per-monitor optional) |

The project ships as a single **`Live Wallpaper.exe`** that embeds the entire React frontend, serves it on a loopback port, screenshots it with headless Chrome, and sets the result as your Windows desktop background — all without Node.js at runtime.

On first run, the app opens a local setup form in your browser where you enter:
- Plane API key
- Workspace slug
- Project selector (project ID, identifier, or name)
- Target monitor(s)

Those values are stored in `live-wallpaper-config.json` next to the executable.

## Repository structure

```
.
├─ go/                 # Go runtime, tray integration, wallpaper capture, embedded frontend
│  ├─ assets/          # Go runtime icon assets
│  └─ dist/            # Vite production output embedded by Go
├─ src/                # React app source
├─ scripts/            # Optional Node-based local development utilities
├─ public/             # Static web assets (favicon, etc.)
├─ build.bat           # Windows production build script
└─ Makefile            # Optional build helpers
```

---

## Building the .exe (Windows)

### Prerequisites

| Tool | Where to get it |
|------|-----------------|
| Node.js ≥ 18 | <https://nodejs.org> |
| Go ≥ 1.22 | <https://go.dev/dl/> |
| Google Chrome | <https://www.google.com/chrome/> |

> Chrome is needed at **runtime** (headless) — it does not need to be installed on the build machine for cross-compilation.

### 1. Install Node dependencies

```bash
npm install
```

### 2. Build

**Windows (Command Prompt / PowerShell):**

```cmd
build.bat
```

**Linux / macOS (cross-compile for Windows):**

```bash
make build-windows
```

Both commands:
1. Run `npm run build` to compile the React app into `go/dist/`
2. Run `go build` in `go/` to embed `go/dist/` into a single Windows `.exe`

The output is **`Live Wallpaper.exe`** (~15 MB).

### 3. Deploy

Copy **`Live Wallpaper.exe`** to any folder and run it. On first launch it opens a setup form where you provide your Plane/workspace/project and monitor preferences.

After setup, it will:
- Set the wallpaper immediately
- Refresh every **30 minutes**
- Let you reopen setup from tray via **Open settings**
- Show a system tray icon with **Open logs**, **Update now**, **Restart**, and **Shutdown**
- Write logs to `live-wallpaper.log` in the same folder

The app favicon is sourced from `public/icon.png`.
The tray icon, executable icon, and Windows metadata are sourced from `go/assets/icon.png` during build.

### 4. Run on Windows startup

**Option A – Startup folder (simplest)**

1. Press `Win + R`, type `shell:startup`, press Enter
2. Copy `Live Wallpaper.exe` into that folder

**Option B – Task Scheduler (recommended)**

1. Open *Task Scheduler* → *Create Basic Task*
2. Trigger: **At log on**
3. Action: **Start a program** → browse to `Live Wallpaper.exe`
4. Set *Start in* to the folder containing `Live Wallpaper.exe`
5. Under *Properties → General*: tick **Run whether user is logged on or not** if desired

---

## Development workflow (Node.js, no build required)

### Start the dev server

```bash
npm run dev
```

The React app will be available at `http://localhost:5173`.

### Capture the wallpaper once

```bash
npm run wallpaper
```

### Run on a schedule (every 30 minutes)

```bash
npm run schedule
```

Keep this running alongside `npm run dev`.

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  200 px spacer    │              Kanban Board (1720 px)           │
│  (desktop icons)  │  ┌─────────┐  ┌────────────┐  ┌──────────┐  │
│                   │  │  Todo   │  │ In Progress│  │   Done   │  │
│                   │  └─────────┘  └────────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               1920 × 1080 px
```

## Issue grouping

| Column | Plane state groups |
|--------|--------------------|
| **Todo** | `backlog`, `unstarted`, `cancelled` |
| **In Progress** | `started` |
| **Done** | `completed` |

Issues are filtered to those **assigned to the current user**. When an active cycle exists, only cycle issues are shown.

## Priority colours

| Priority | Colour |
|----------|--------|
| 🔴 Urgent | `#ef4444` |
| 🟠 High | `#f97316` |
| 🟡 Medium | `#eab308` |
| 🔵 Low | `#3b82f6` |
| ⚪ None | `#4b5563` |
