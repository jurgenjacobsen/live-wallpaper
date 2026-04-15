# live-wallpaper

A dynamic desktop wallpaper system that renders a live Kanban board (powered by **Plane.so**) as your desktop background.

## Architecture

| Layer | Tech |
|-------|------|
| UI | React 19 + TypeScript + Tailwind CSS v4 via Vite |
| Data | Plane.so REST API |
| Capture | Node.js + Puppeteer (headless Chromium) |
| Scheduling | node-cron (every 30 minutes) |
| OS integration | `wallpaper` npm package |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_PLANE_API_KEY` | Your Plane.so API key (Profile → API Tokens) |
| `VITE_WORKSPACE_SLUG` | Workspace slug from the URL, e.g. `my-team` |
| `VITE_PROJECT_ID` | Project selector: Project ID, identifier (e.g. `ARCHIVUM`), or project name |

### 3. Start the dev server

```bash
npm run dev
```

The React app will be available at `http://localhost:5173`.

### 4. Capture the wallpaper once

```bash
npm run wallpaper
```

This launches headless Chromium, navigates to `http://localhost:5173`, takes a 1920×1080 screenshot saved as `wallpaper.png`, and sets it as your desktop background.

### 5. Run on a schedule (every 30 minutes)

```bash
npm run schedule
```

Keep this running alongside `npm run dev`. It updates the wallpaper immediately on startup and then every 30 minutes via cron.

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
