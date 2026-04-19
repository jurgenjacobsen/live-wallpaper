package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

func main() {
	// Locate the directory containing the running executable so we can find
	// the .env file and write wallpaper.png / live-wallpaper.log next to it.
	exePath, err := os.Executable()
	if err != nil {
		log.Fatalf("[live-wallpaper] cannot resolve executable path: %v", err)
	}
	exeDir := filepath.Dir(exePath)

	// Redirect log output to a file (important when the binary is launched
	// without a console window via -ldflags="-H windowsgui").
	logPath := filepath.Join(exeDir, "live-wallpaper.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		log.SetOutput(logFile)
		defer logFile.Close()
	}
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)

	cfg, err := ensureAppConfig(exeDir)
	if err != nil {
		log.Fatalf("[live-wallpaper] setup/config failed: %v", err)
	}
	log.Printf("[live-wallpaper] targeting %s", cfg.displayMonitorSelection())
	log.Printf("[live-wallpaper] plane interval: every %d minute(s)", cfg.PlaneUpdateIntervalMinutes)
	log.Printf("[live-wallpaper] weather interval: every %d minute(s)", cfg.WeatherUpdateIntervalMinutes)

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

	go func() {
		checkForUpdates("startup")
	}()

	// Start the embedded HTTP server on a random loopback port.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("[live-wallpaper] failed to start listener: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	srv := &http.Server{Handler: newHandler(cfg)}
	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && serveErr != http.ErrServerClosed {
			log.Printf("[live-wallpaper] HTTP server error: %v", serveErr)
		}
	}()
	log.Printf("[live-wallpaper] serving React app at %s", serverURL)

	appArgs := append([]string(nil), os.Args[1:]...)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var updateMu sync.Mutex
	updateNowCh := make(chan string, 1)
	providerUpdateCh := make(chan wallpaperProvider, 1)
	shutdownReasonCh := make(chan string, 1)
	var shutdownOnce sync.Once

	providerAssigned := func(provider wallpaperProvider) bool {
		for _, assignment := range cfg.MonitorAssignments {
			if assignment.Provider == provider {
				return true
			}
		}
		return false
	}

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

	requestShutdown := func(reason string) {
		shutdownOnce.Do(func() {
			log.Printf("[live-wallpaper] shutdown requested (%s)", reason)
			shutdownReasonCh <- reason
			quitTray()
		})
	}

	runUpdate := func(reason string) {
		updateMu.Lock()
		defer updateMu.Unlock()

		if reason == "tray menu: update now" {
			defer setTrayTooltip(appDisplayName)
		}

		log.Printf("[live-wallpaper] updating wallpaper at %s (%s)", time.Now().Format(time.RFC3339), reason)

		for _, assignment := range cfg.MonitorAssignments {
			if assignment.Provider == providerNone {
				continue
			}

			width, height, sizeErr := monitorSize(assignment.MonitorIndex)
			if sizeErr != nil {
				log.Printf("[live-wallpaper] monitor size lookup failed for monitor %d, using fallback 1920x1080: %v", assignment.MonitorIndex, sizeErr)
				width = 1920
				height = 1080
			}

			wallpaperPath := filepath.Join(exeDir, fmt.Sprintf("wallpaper-monitor-%d-%s.png", assignment.MonitorIndex, assignment.Provider))
			if captureErr := captureWallpaper(ctx, serverURL, wallpaperPath, assignment.Provider, assignment.MonitorIndex, width, height); captureErr != nil {
				if ctx.Err() != nil {
					log.Printf("[live-wallpaper] update canceled during shutdown")
					return
				}
				log.Printf("[live-wallpaper] screenshot failed for monitor %d (%s): %v", assignment.MonitorIndex, assignment.Provider, captureErr)
				continue
			}

			if wpErr := setWallpaper(wallpaperPath, []int{assignment.MonitorIndex}); wpErr != nil {
				log.Printf("[live-wallpaper] set wallpaper failed for monitor %d (%s): %v", assignment.MonitorIndex, assignment.Provider, wpErr)
				continue
			}
		}

		log.Println("[live-wallpaper] ✓ wallpaper updated successfully")
	}

	runProviderUpdate := func(provider wallpaperProvider, reason string) {
		if !providerAssigned(provider) {
			return
		}

		updateMu.Lock()
		defer updateMu.Unlock()

		log.Printf("[live-wallpaper] updating %s wallpaper at %s (%s)", provider, time.Now().Format(time.RFC3339), reason)

		for _, assignment := range cfg.MonitorAssignments {
			if assignment.Provider != provider {
				continue
			}

			width, height, sizeErr := monitorSize(assignment.MonitorIndex)
			if sizeErr != nil {
				log.Printf("[live-wallpaper] monitor size lookup failed for monitor %d, using fallback 1920x1080: %v", assignment.MonitorIndex, sizeErr)
				width = 1920
				height = 1080
			}

			wallpaperPath := filepath.Join(exeDir, fmt.Sprintf("wallpaper-monitor-%d-%s.png", assignment.MonitorIndex, assignment.Provider))
			if captureErr := captureWallpaper(ctx, serverURL, wallpaperPath, assignment.Provider, assignment.MonitorIndex, width, height); captureErr != nil {
				if ctx.Err() != nil {
					log.Printf("[live-wallpaper] update canceled during shutdown")
					return
				}
				log.Printf("[live-wallpaper] screenshot failed for monitor %d (%s): %v", assignment.MonitorIndex, assignment.Provider, captureErr)
				continue
			}

			if wpErr := setWallpaper(wallpaperPath, []int{assignment.MonitorIndex}); wpErr != nil {
				log.Printf("[live-wallpaper] set wallpaper failed for monitor %d (%s): %v", assignment.MonitorIndex, assignment.Provider, wpErr)
				continue
			}
		}

		log.Printf("[live-wallpaper] ✓ %s wallpaper updated successfully", provider)
	}

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

	// Run provider-specific startup refreshes immediately so weather is current
	// as soon as the app launches.
	runProviderUpdate(providerWeather, "startup")
	runProviderUpdate(providerPlane, "startup")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	workers.Add(1)
	go func() {
		defer workers.Done()
		select {
		case sig := <-sigCh:
			requestShutdown(fmt.Sprintf("received %s", sig))
		case <-ctx.Done():
		}
	}()

	if supportsTray() {
		configPath := filepath.Join(exeDir, appConfigFileName)
		trayErr := runTray(trayCallbacks{
			OpenSettings: func() {
				go func() {
					if err := openSetupFromTray(configPath); err != nil {
						log.Printf("[live-wallpaper] open settings failed: %v", err)
					}
				}()
			},
			OpenLogs: func() {
				go func() {
					if err := openLogFile(logPath); err != nil {
						log.Printf("[live-wallpaper] open logs failed: %v", err)
					}
				}()
			},
			CheckUpdates: func() {
				go checkForUpdates("tray menu: check for updates")
			},
			UpdateNow: func() {
				setTrayTooltip(trayUpdatingTooltip)
				if !requestUpdate("tray menu: update now") {
					setTrayTooltip(appDisplayName)
				}
			},
			Restart: func() {
				cmd := exec.Command(exePath, appArgs...)
				cmd.Dir = exeDir
				if startErr := cmd.Start(); startErr != nil {
					log.Printf("[live-wallpaper] restart failed: %v", startErr)
					return
				}
				requestShutdown("tray menu: restart")
			},
			Shutdown: func() {
				requestShutdown("tray menu: shutdown")
			},
		})
		if trayErr != nil {
			log.Printf("[live-wallpaper] tray disabled due to error: %v", trayErr)
			requestShutdown("tray startup failure")
		}
	}

	reason := <-shutdownReasonCh
	log.Printf("[live-wallpaper] shutting down (%s)", reason)
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if shutdownErr := srv.Shutdown(shutdownCtx); shutdownErr != nil && shutdownErr != http.ErrServerClosed {
		log.Printf("[live-wallpaper] HTTP shutdown error: %v", shutdownErr)
	}

	workers.Wait()
}
