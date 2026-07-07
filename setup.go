package main

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "image/jpeg"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var (
	setupSessionMu     sync.Mutex
	setupSessionActive bool
)

func ensureAppConfig(exeDir string, serverURL string, saveConfigCh <-chan appConfig, settingsClosedCh <-chan struct{}) (appConfig, error) {
	configPath := filepath.Join(exeDir, appConfigFileName)
	cfg, err := loadAppConfig(configPath)
	if err == nil {
		return cfg, nil
	}
	if err != nil && err != errConfigNotFound {
		log.Printf("[live-wallpaper] config load failed, running setup: %v", err)
	}

	return runSetupSession(configPath, true, serverURL, saveConfigCh, settingsClosedCh)
}

func openSetupFromTray(configPath string, serverURL string, saveConfigCh <-chan appConfig, settingsClosedCh <-chan struct{}) error {
	_, err := runSetupSession(configPath, false, serverURL, saveConfigCh, settingsClosedCh)
	if err != nil {
		return err
	}
	log.Printf("[live-wallpaper] settings saved to %s (restart from tray to apply changes)", configPath)
	return nil
}

func runSetupSession(configPath string, firstRun bool, serverURL string, saveConfigCh <-chan appConfig, settingsClosedCh <-chan struct{}) (appConfig, error) {
	setupSessionMu.Lock()
	if setupSessionActive {
		setupSessionMu.Unlock()
		return appConfig{}, fmt.Errorf("a setup/settings session is already open")
	}
	setupSessionActive = true
	setupSessionMu.Unlock()
	defer func() {
		setupSessionMu.Lock()
		setupSessionActive = false
		setupSessionMu.Unlock()
	}()

	if firstRun {
		log.Printf("[live-wallpaper] opening first-run setup at %s", serverURL)
	} else {
		log.Printf("[live-wallpaper] opening settings at %s", serverURL)
	}

	if err := openSettingsWindow(serverURL); err != nil {
		return appConfig{}, fmt.Errorf("failed to open settings window: %w", err)
	}

	// Wait for the user to save via the React UI (POST /api/full-config) or close the window
	select {
	case cfg := <-saveConfigCh:
		return cfg, nil
	case <-settingsClosedCh:
		return appConfig{}, fmt.Errorf("settings window closed without saving")
	case <-time.After(30 * time.Minute):
		return appConfig{}, fmt.Errorf("setup/settings timed out")
	}
}

func saveWeatherBackgroundUpload(src io.Reader, originalFilename string, configDir string, monitorIndexes []int) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalFilename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
	default:
		return "", fmt.Errorf("weather background must be one of: .jpg, .jpeg, .png, .webp")
	}

	rawBytes, err := io.ReadAll(src)
	if err != nil {
		return "", fmt.Errorf("failed to read weather background upload: %w", err)
	}

	decoded, _, err := image.Decode(bytes.NewReader(rawBytes))
	if err != nil {
		return "", fmt.Errorf("failed to decode weather background image: %w", err)
	}

	targetWidth, targetHeight := targetBackgroundSize(monitorIndexes)
	resized := resizeImageCover(decoded, targetWidth, targetHeight)

	destPath := filepath.Join(configDir, "weather-background.png")
	destFile, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to save weather background: %w", err)
	}
	defer destFile.Close()

	if err := png.Encode(destFile, resized); err != nil {
		return "", fmt.Errorf("failed to write weather background: %w", err)
	}

	return destPath, nil
}

func targetBackgroundSize(monitorIndexes []int) (int, int) {
	maxWidth := 0
	maxHeight := 0
	for _, idx := range monitorIndexes {
		width, height, err := monitorSize(idx)
		if err != nil {
			continue
		}
		if width > maxWidth {
			maxWidth = width
		}
		if height > maxHeight {
			maxHeight = height
		}
	}

	if maxWidth < 1 || maxHeight < 1 {
		return 1920, 1080
	}
	return maxWidth, maxHeight
}

func resizeImageCover(src image.Image, targetWidth int, targetHeight int) image.Image {
	if targetWidth < 1 {
		targetWidth = 1920
	}
	if targetHeight < 1 {
		targetHeight = 1080
	}

	srcBounds := src.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()
	if srcWidth < 1 || srcHeight < 1 {
		return image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	}

	scaleX := float64(targetWidth) / float64(srcWidth)
	scaleY := float64(targetHeight) / float64(srcHeight)
	scale := scaleX
	if scaleY > scale {
		scale = scaleY
	}

	scaledWidth := int(float64(srcWidth)*scale + 0.5)
	scaledHeight := int(float64(srcHeight)*scale + 0.5)
	if scaledWidth < targetWidth {
		scaledWidth = targetWidth
	}
	if scaledHeight < targetHeight {
		scaledHeight = targetHeight
	}

	scaled := image.NewRGBA(image.Rect(0, 0, scaledWidth, scaledHeight))
	xdraw.CatmullRom.Scale(scaled, scaled.Bounds(), src, srcBounds, xdraw.Over, nil)

	offsetX := (scaledWidth - targetWidth) / 2
	offsetY := (scaledHeight - targetHeight) / 2
	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.Draw(dst, dst.Bounds(), scaled, image.Point{X: offsetX, Y: offsetY}, draw.Src)

	return dst
}
