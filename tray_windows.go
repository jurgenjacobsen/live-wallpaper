//go:build windows

package main

import (
	"bytes"
	_ "embed"
	"fmt"
	"image/png"
	"log"
	"sync/atomic"

	ico "github.com/Kodeworks/golang-image-ico"
	"github.com/getlantern/systray"
)

//go:embed assets/icon.png
var trayIconPNG []byte

var trayRunning atomic.Bool

func supportsTray() bool {
	return true
}

func runTray(callbacks trayCallbacks) error {
	if callbacks.OpenSettings == nil || callbacks.OpenLogs == nil || callbacks.CheckUpdates == nil || callbacks.UpdateNow == nil || callbacks.Restart == nil || callbacks.Shutdown == nil || callbacks.GetRunOnStartupState == nil || callbacks.ToggleRunOnStartup == nil {
		return fmt.Errorf("tray callbacks must be provided")
	}

	iconData, err := iconDataForWindowsTray()
	if err != nil {
		return err
	}

	systray.Run(func() {
		trayRunning.Store(true)
		systray.SetIcon(iconData)
		systray.SetTitle(appDisplayName)
		systray.SetTooltip(appDisplayName)

		runOnStartupEnabled, stateErr := callbacks.GetRunOnStartupState()
		if stateErr != nil {
			log.Printf("[live-wallpaper] run-on-startup state unavailable: %v", stateErr)
			runOnStartupEnabled = false
		}

		openSettings := systray.AddMenuItem("Open settings", "Open the setup/settings page")
		openLogs := systray.AddMenuItem("Open logs", "Open the log file")
		checkUpdates := systray.AddMenuItem("Check for updates", "Check GitHub Releases for a newer version")
		runOnStartup := systray.AddMenuItemCheckbox("Run on startup", "Start Live Wallpaper when you sign in", runOnStartupEnabled)
		systray.AddSeparator()
		updateNow := systray.AddMenuItem("Update wallpapers", "Capture and apply wallpaper immediately")
		restart := systray.AddMenuItem("Restart", "Restart Live Wallpaper")
		systray.AddSeparator()
		shutdown := systray.AddMenuItem("Shutdown", "Stop Live Wallpaper")

		go func() {
			for {
				select {
				case <-openSettings.ClickedCh:
					callbacks.OpenSettings()
				case <-openLogs.ClickedCh:
					callbacks.OpenLogs()
				case <-checkUpdates.ClickedCh:
					callbacks.CheckUpdates()
				case <-runOnStartup.ClickedCh:
					enabled, err := callbacks.ToggleRunOnStartup()
					if err != nil {
						log.Printf("[live-wallpaper] run-on-startup toggle failed: %v", err)
					}
					if enabled {
						runOnStartup.Check()
					} else {
						runOnStartup.Uncheck()
					}
				case <-updateNow.ClickedCh:
					callbacks.UpdateNow()
				case <-restart.ClickedCh:
					callbacks.Restart()
				case <-shutdown.ClickedCh:
					callbacks.Shutdown()
					return
				}
			}
		}()
	}, func() {
		trayRunning.Store(false)
	})

	return nil
}

func quitTray() {
	if trayRunning.Load() {
		systray.Quit()
	}
}

func setTrayTooltip(tooltip string) {
	if !trayRunning.Load() {
		return
	}
	if tooltip == "" {
		tooltip = appDisplayName
	}
	systray.SetTooltip(tooltip)
}

func iconDataForWindowsTray() ([]byte, error) {
	img, err := png.Decode(bytes.NewReader(trayIconPNG))
	if err != nil {
		return nil, fmt.Errorf("decode tray icon PNG: %w", err)
	}

	var b bytes.Buffer
	if err := ico.Encode(&b, img); err != nil {
		return nil, fmt.Errorf("encode tray icon ICO: %w", err)
	}
	return b.Bytes(), nil
}
