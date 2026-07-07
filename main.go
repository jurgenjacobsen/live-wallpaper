package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

var (
	wailsCtx context.Context
	wailsMu  sync.Mutex
)

func main() {
	// Locate the directory containing the running executable
	exePath, err := os.Executable()
	if err != nil {
		log.Fatalf("[live-wallpaper] cannot resolve executable path: %v", err)
	}
	exeDir := filepath.Dir(exePath)

	// Redirect log output to a file
	logPath := filepath.Join(exeDir, "live-wallpaper.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		log.SetOutput(logFile)
		defer logFile.Close()
	}
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)

	// Start standard loopback HTTP server for chromedp capture and API proxies
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("[live-wallpaper] failed to start listener: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	readyState := newFrontendReadyState()

	// Load Configuration
	configPath := filepath.Join(exeDir, appConfigFileName)
	cfg, err := loadAppConfig(configPath)
	firstRunNeeded := false
	if err != nil {
		firstRunNeeded = true
		cfg = appConfig{
			ConfigVersion:                2,
			PlaneUpdateIntervalMinutes:   30,
			WeatherUpdateIntervalMinutes: 30,
			MonitorAssignments: []monitorProviderAssignment{
				{MonitorIndex: 0, Provider: providerNone, Widgets: []wallpaperProvider{}},
			},
		}
	}

	globalSaveConfigCh := make(chan appConfig, 1)
	globalSettingsClosedCh := make(chan struct{}, 1)

	// Server handler for background capture requests
	srv := &http.Server{Handler: newHandler(&cfg, configPath, readyState, globalSaveConfigCh, globalSettingsClosedCh)}
	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && serveErr != http.ErrServerClosed {
			log.Printf("[live-wallpaper] HTTP server error: %v", serveErr)
		}
	}()
	log.Printf("[live-wallpaper] serving React app at %s", serverURL)

	updateNowCh := make(chan string, 1)
	providerUpdateCh := make(chan wallpaperProvider, 1)
	shutdownReasonCh := make(chan string, 1)
	var shutdownOnce sync.Once

	requestUpdate := func(reason string) bool {
		select {
		case updateNowCh <- reason:
			log.Printf("[live-wallpaper] queued wallpaper update (%s)", reason)
			return true
		default:
			log.Printf("[live-wallpaper] update already queued/in progress; skipping request (%s)", reason)
			return false
		}
	}

	var isShuttingDown bool
	var isShuttingDownMu sync.Mutex

	requestShutdown := func(reason string) {
		shutdownOnce.Do(func() {
			log.Printf("[live-wallpaper] shutdown requested (%s)", reason)
			shutdownReasonCh <- reason
			quitTray()

			isShuttingDownMu.Lock()
			isShuttingDown = true
			isShuttingDownMu.Unlock()

			// Terminate Wails process loop cleanly
			wailsMu.Lock()
			ctx := wailsCtx
			wailsMu.Unlock()
			if ctx != nil {
				wailsRuntime.Quit(ctx)
			} else {
				os.Exit(0)
			}
		})
	}

	checkForUpdates := func(trigger string) {
		updateCtx, updateCancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer updateCancel()

		latestVersion, releaseURL, updateAvailable, updateErr := checkForGithubReleaseUpdate(updateCtx, appVersion)
		if updateErr != nil {
			log.Printf("[live-wallpaper] update check skipped (%s): %v", trigger, updateErr)
			return
		}
		if !updateAvailable {
			log.Printf("[live-wallpaper] no update available (%s): current=%s", trigger, appVersion)
			return
		}

		log.Printf("[live-wallpaper] update available (%s): current=%s latest=%s", trigger, appVersion, latestVersion)

		openReleasePage, promptErr := promptUpdateAvailable(appVersion, latestVersion)
		if promptErr != nil {
			log.Printf("[live-wallpaper] update prompt failed (%s): %v", trigger, promptErr)
			return
		}
		if !openReleasePage {
			log.Printf("[live-wallpaper] update prompt dismissed (%s)", trigger)
			return
		}

		if err := openBrowser(releaseURL); err != nil {
			log.Printf("[live-wallpaper] open release page failed (%s): %v", trigger, err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	runUpdate := func(reason string) {
		log.Printf("[live-wallpaper] updating wallpaper at %s (%s)", time.Now().Format(time.RFC3339), reason)
		for _, assignment := range cfg.MonitorAssignments {
			if assignment.Provider == providerNone && len(assignment.Widgets) == 0 {
				continue
			}
			waitProvider := assignment.Provider
			if waitProvider == providerNone && len(assignment.Widgets) > 0 {
				waitProvider = assignment.Widgets[0]
			}
			readyState.Reset(waitProvider, assignment.MonitorIndex)

			width, height, sizeErr := monitorSize(assignment.MonitorIndex)
			if sizeErr != nil {
				width = 1920
				height = 1080
			}

			wallpaperPath := filepath.Join(exeDir, fmt.Sprintf("wallpaper-monitor-%d.png", assignment.MonitorIndex))
			if captureErr := captureWallpaper(ctx, serverURL, wallpaperPath, waitProvider, assignment.MonitorIndex, width, height, readyState); captureErr != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("[live-wallpaper] screenshot failed for monitor %d: %v", assignment.MonitorIndex, captureErr)
				continue
			}

			if wpErr := setWallpaper(wallpaperPath, []int{assignment.MonitorIndex}); wpErr != nil {
				log.Printf("[live-wallpaper] set wallpaper failed for monitor %d: %v", assignment.MonitorIndex, wpErr)
			}
		}
		log.Println("[live-wallpaper] ✓ wallpaper updated successfully")
	}

	runProviderUpdate := func(provider wallpaperProvider, reason string) {
		log.Printf("[live-wallpaper] updating monitors with %s at %s (%s)", provider, time.Now().Format(time.RFC3339), reason)
		for _, assignment := range cfg.MonitorAssignments {
			isAssigned := assignment.Provider == provider
			if !isAssigned {
				for _, w := range assignment.Widgets {
					if w == provider {
						isAssigned = true
						break
					}
				}
			}
			if !isAssigned {
				continue
			}

			waitProvider := assignment.Provider
			if waitProvider == providerNone && len(assignment.Widgets) > 0 {
				waitProvider = assignment.Widgets[0]
			}
			readyState.Reset(waitProvider, assignment.MonitorIndex)

			width, height, sizeErr := monitorSize(assignment.MonitorIndex)
			if sizeErr != nil {
				width = 1920
				height = 1080
			}

			wallpaperPath := filepath.Join(exeDir, fmt.Sprintf("wallpaper-monitor-%d.png", assignment.MonitorIndex))
			if captureErr := captureWallpaper(ctx, serverURL, wallpaperPath, waitProvider, assignment.MonitorIndex, width, height, readyState); captureErr != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("[live-wallpaper] screenshot failed for monitor %d: %v", assignment.MonitorIndex, captureErr)
				continue
			}

			if wpErr := setWallpaper(wallpaperPath, []int{assignment.MonitorIndex}); wpErr != nil {
				log.Printf("[live-wallpaper] set wallpaper failed for monitor %d: %v", assignment.MonitorIndex, wpErr)
			}
		}
		log.Printf("[live-wallpaper] ✓ %s related monitors updated successfully", provider)
	}

	// Start background updates scheduler worker
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		planeTicker := time.NewTicker(time.Duration(cfg.PlaneUpdateIntervalMinutes) * time.Minute)
		weatherTicker := time.NewTicker(time.Duration(cfg.WeatherUpdateIntervalMinutes) * time.Minute)
		defer planeTicker.Stop()
		defer weatherTicker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-planeTicker.C:
				select {
				case providerUpdateCh <- providerPlane:
				default:
				}
			case <-weatherTicker.C:
				select {
				case providerUpdateCh <- providerWeather:
				default:
				}
			case reason := <-updateNowCh:
				runUpdate(reason)
			case provider := <-providerUpdateCh:
				runProviderUpdate(provider, "scheduled")
			}
		}
	}()

	// Wails App bindings
	app := NewApp(&cfg, configPath, exeDir, func(reason string) {
		requestUpdate(reason)
	})

	// Run system tray on background goroutine
	go func() {
		if supportsTray() {
			trayErr := runTray(trayCallbacks{
				OpenSettings: func() {
					wailsMu.Lock()
					defer wailsMu.Unlock()
					if wailsCtx != nil {
						wailsRuntime.WindowShow(wailsCtx)
					}
				},
				OpenLogs: func() {
					_ = openLogFile(logPath)
				},
				CheckUpdates: func() {
					checkForUpdates("tray menu: check for updates")
				},
				UpdateNow: func() {
					setTrayTooltip(trayUpdatingTooltip)
					if !requestUpdate("tray menu: update now") {
						setTrayTooltip(appDisplayName)
					} else {
						setTrayTooltip(appDisplayName)
					}
				},
				Restart: func() {
					cmd := exec.Command(exePath)
					cmd.Dir = exeDir
					_ = cmd.Start()
					requestShutdown("tray menu: restart")
				},
				Shutdown: func() {
					requestShutdown("tray menu: shutdown")
				},
				GetRunOnStartupState: func() (bool, error) {
					return isRunOnStartupEnabled(exePath)
				},
				ToggleRunOnStartup: func() (bool, error) {
					current, err := isRunOnStartupEnabled(exePath)
					if err != nil {
						return false, err
					}
					target := !current
					if err := applyRunOnStartupSetting(exePath, target); err != nil {
						return current, err
					}
					cfg.RunOnStartup = target
					_ = saveAppConfig(configPath, cfg)
					return target, nil
				},
			})
			if trayErr != nil {
				log.Printf("[live-wallpaper] tray failed: %v", trayErr)
			}
		}
	}()

	// Start initial wallpaper refresh completely in background
	go func() {
		time.Sleep(1 * time.Second)
		runProviderUpdate(providerWeather, "startup")
		runProviderUpdate(providerPlane, "startup")
	}()

	// Run Wails native application window
	err = wails.Run(&options.App{
		Title:             appDisplayName,
		Width:             760,
		Height:            600,
		StartHidden:       false, // Show splash screen on every launch, then hide if configured
		AlwaysOnTop:       false,
		DisableResize:     false, // Enable window resizing and maximize/minimize support
		Frameless:         true, // borderless window for custom Adobe-style splash and modern settings headers
		BackgroundColour:  &options.RGBA{R: 0, G: 0, B: 0, A: 0}, // transparent window support
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: func(wctx context.Context) {
			wailsMu.Lock()
			wailsCtx = wctx
			wailsMu.Unlock()
			app.startup(wctx)

			// Emit "init-complete" and hide/show window asynchronously after splash duration
			go func() {
				time.Sleep(1500 * time.Millisecond) // Let splash screen show for a short premium period
				wailsRuntime.EventsEmit(wctx, "init-complete", firstRunNeeded)
				if !firstRunNeeded {
					time.Sleep(800 * time.Millisecond) // Let fadeout transition finish
					wailsRuntime.WindowHide(wctx)
				}
			}()
		},
		OnBeforeClose: func(wctx context.Context) bool {
			isShuttingDownMu.Lock()
			quitting := isShuttingDown
			isShuttingDownMu.Unlock()

			if quitting {
				return false // Allow Wails to quit and process to exit
			}

			// Prevent native close; hide window back to system tray instead
			wailsRuntime.WindowHide(wctx)
			return true // Prevents exit
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Printf("[live-wallpaper] Wails run error: %v", err)
	}

	cancel()
	srv.Shutdown(context.Background())
	workers.Wait()
}
