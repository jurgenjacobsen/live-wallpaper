package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct represents the Wails application controller
type App struct {
	ctx        context.Context
	exeDir     string
	configPath string
	cfg        *appConfig
	updateNow  func(string)
}

// NewApp creates a new Wails App controller instance
func NewApp(cfg *appConfig, configPath string, exeDir string, updateNow func(string)) *App {
	return &App{
		cfg:        cfg,
		configPath: configPath,
		exeDir:     exeDir,
		updateNow:  updateNow,
	}
}

// startup is called when the Wails application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetFullConfig returns the current configuration structure to the frontend
func (a *App) GetFullConfig() appConfig {
	return *a.cfg
}

// SaveFullConfig saves and validates settings posted from the React client
func (a *App) SaveFullConfig(newCfg appConfig) error {
	newCfg = newCfg.normalized()
	if err := newCfg.validate(); err != nil {
		return err
	}

	if err := saveAppConfig(a.configPath, newCfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	*a.cfg = newCfg

	// Sync run on startup setting
	exePath, err := os.Executable()
	if err == nil {
		_ = applyRunOnStartupSetting(exePath, newCfg.RunOnStartup)
	}

	// Trigger immediate update of wallpapers
	a.updateNow("settings saved")
	return nil
}

// GetMonitors lists the indices of the connected active display monitors
func (a *App) GetMonitors() ([]int, error) {
	return listMonitorIndexes()
}

// CloseSettings hides the native configuration settings window
func (a *App) CloseSettings() {
	wailsRuntime.WindowHide(a.ctx)
}

// UpdateNow triggers an immediate update cycle of wallpapers
func (a *App) UpdateNow() {
	a.updateNow("manual update")
}

// SelectBackgroundImage opens a native file dialog to select a weather background image,
// copies and resizes it to fit the monitor resolution, and returns the path to the resized image.
func (a *App) SelectBackgroundImage() (string, error) {
	selectedFile, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Weather Background Image",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Images (*.png;*.jpg;*.jpeg;*.webp)", Pattern: "*.png;*.jpg;*.jpeg;*.webp"},
		},
	})
	if err != nil {
		return "", err
	}
	if selectedFile == "" {
		return "", nil
	}

	file, err := os.Open(selectedFile)
	if err != nil {
		return "", fmt.Errorf("open selected file: %w", err)
	}
	defer file.Close()

	// Get monitor indexes from config
	var monitorIndexes []int
	for _, assignment := range a.cfg.MonitorAssignments {
		monitorIndexes = append(monitorIndexes, assignment.MonitorIndex)
	}

	destPath, err := saveWeatherBackgroundUpload(file, selectedFile, a.exeDir, monitorIndexes)
	if err != nil {
		return "", err
	}

	return destPath, nil
}

// GetBackgroundImageBase64 reads the image file at the given absolute local path,
// encodes it as Base64, and returns a standard data URL (data:image/...;base64,...)
// so the frontend can preview local images without violating WebView2 file loading policies.
func (a *App) GetBackgroundImageBase64(path string) (string, error) {
	if path == "" {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	contentType := "image/png"
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".jpg") || strings.HasSuffix(lower, ".jpeg") {
		contentType = "image/jpeg"
	} else if strings.HasSuffix(lower, ".gif") {
		contentType = "image/gif"
	} else if strings.HasSuffix(lower, ".webp") {
		contentType = "image/webp"
	}

	base64Str := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", contentType, base64Str), nil
}
