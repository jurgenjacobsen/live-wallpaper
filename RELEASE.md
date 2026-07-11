# Release & Publishing Guide

This guide explains how to release new versions of **Live Wallpaper**, publish version tags to trigger the automatic GitHub Action builders, and compile installers locally.

---

## 1. Triggering the GitHub Actions Release Workflow

The project contains a CI/CD workflow configured in `.github/workflows/release.yml` that automatically compiles the desktop application, packages the installers, and uploads them to GitHub Release assets whenever a version tag matching `v*` is pushed.

To tag and publish the current code:

### Step 1. Commit and push your local changes
Make sure all modifications are committed and pushed to your default repository branch (e.g. `main`):
```bash
# Stage all changed files
git add .

# Commit changes
git commit -m "Release v2.0.0: Wails migration, AMOLED dark slate theme, and monitor workspace preview"

# Push main branch code
git push origin main
```

### Step 2. Create and push the release tag
Create a local version tag and push it to GitHub. Pushing the tag triggers the packaging action:
```bash
# Create local tag
git tag v2.0.0

# Push the tag to GitHub
git push origin v2.0.0
```

**Note:** The GitHub Action will only run if the tag matches the pattern `v*` (e.g. `v2.0.0`, `v2.1.3`, etc.). If you push a tag that does not match this pattern, the workflow will not be triggered.

> **Tip:** You can also undo/delete a tag if you accidentally pushed the wrong version:
```bash
# Delete the local tag
git tag -d v2.0.0

# Delete the remote tag
git push --delete origin v2.0.0 
```

---

## 2. GitHub Actions Matrix Builds

Once the tag is pushed, the GitHub Action automatically runs the build matrix across three operating systems, outputting the following release assets:

| Platform | Runner OS | Build Command | Output Installer / Package |
| :--- | :--- | :--- | :--- |
| **Windows** | `windows-latest` | `wails build` + Inno Setup | `LiveWallpaper-Setup-v2.0.0.exe` |
| **macOS** | `macos-latest` | `wails build` + `hdiutil` | `LiveWallpaper-v2.0.0.dmg` (Universal) |
| **Linux** | `ubuntu-latest` | `wails build` + `dpkg-deb` | `live-wallpaper-v2.0.0.deb` (Debian Package) |

---

## 3. Compiling and Packaging Locally (Windows)

If you want to compile and package the Windows installer locally, helper scripts have been provided:

### Compile the Wails executable
To build the standalone `.exe` without compiling an installer (output to `build/bin/Live Wallpaper.exe`):
```cmd
build.bat
```

### Build the full Installer
To compile the executable and compile it into an Inno Setup installer package (output to `installer/dist/LiveWallpaper-Setup-2.0.0.exe`):
```cmd
build-installer.bat
```
*(Note: requires **Inno Setup 6** to be installed on your machine).*
