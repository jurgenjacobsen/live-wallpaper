package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"image"
	"image/draw"
	"image/png"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "image/jpeg"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

type setupPageData struct {
	AppName                      string
	Heading                      string
	Intro                        string
	SubmitLabel                  string
	SuccessMessage               string
	ConfigPath                   string
	RunOnStartup                 bool
	PlaneUpdateIntervalMinutes   int
	WeatherUpdateIntervalMinutes int
	MonitorIndexes               []int
	MonitorProviders             map[int]wallpaperProvider
	PlaneAPIKey                  string
	PlaneWorkspaceSlug           string
	PlaneProjectID               string
	WeatherAPIKey                string
	WeatherCity                  string
	WeatherCorner                weatherWidgetCorner
	WeatherBackgroundPath        string
	Error                        string
}

var (
	setupSessionMu     sync.Mutex
	setupSessionActive bool
)

func ensureAppConfig(exeDir string) (appConfig, error) {
	configPath := filepath.Join(exeDir, appConfigFileName)
	cfg, err := loadAppConfig(configPath)
	if err == nil {
		return cfg, nil
	}
	if err != nil && err != errConfigNotFound {
		log.Printf("[live-wallpaper] config load failed, running setup: %v", err)
	}

	return runSetupSession(configPath, true)
}

func openSetupFromTray(configPath string) error {
	_, err := runSetupSession(configPath, false)
	if err != nil {
		return err
	}
	log.Printf("[live-wallpaper] settings saved to %s (restart from tray to apply changes)", configPath)
	return nil
}

func runSetupSession(configPath string, firstRun bool) (appConfig, error) {
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

	var existing appConfig
	if cfg, err := loadAppConfig(configPath); err == nil {
		existing = cfg
	} else {
		existing.MonitorAssignments = []monitorProviderAssignment{{
			MonitorIndex: 0,
			Provider:     providerNone,
		}}
		existing.Weather.Corner = cornerTopRight
		existing.PlaneUpdateIntervalMinutes = defaultPlaneUpdateIntervalMinutes
		existing.WeatherUpdateIntervalMinutes = defaultWeatherUpdateIntervalMinutes
	}

	monitorIndexes, monitorErr := listMonitorIndexes()
	if monitorErr != nil {
		log.Printf("[live-wallpaper] failed to enumerate monitors for setup: %v", monitorErr)
		monitorIndexes = []int{0}
	}
	if len(monitorIndexes) == 0 {
		monitorIndexes = []int{0}
	}

	monitorProviders := monitorProvidersFromConfig(existing, monitorIndexes)

	heading := appDisplayName + " settings"
	intro := "Update your configuration. Settings are saved locally."
	submitLabel := "Save settings"
	successMessage := "Settings saved. Restart from the tray menu to apply changes."
	if firstRun {
		heading = appDisplayName + " first-run setup"
		intro = "Complete this once. Your settings will be saved locally."
		submitLabel = "Save and start"
		successMessage = "Setup complete. You can close this tab now."
	}

	resultCh := make(chan appConfig, 1)
	serverErrCh := make(chan error, 1)

	basePageData := setupPageData{
		AppName:                      appDisplayName,
		Heading:                      heading,
		Intro:                        intro,
		SubmitLabel:                  submitLabel,
		SuccessMessage:               successMessage,
		ConfigPath:                   configPath,
		RunOnStartup:                 existing.RunOnStartup,
		PlaneUpdateIntervalMinutes:   existing.PlaneUpdateIntervalMinutes,
		WeatherUpdateIntervalMinutes: existing.WeatherUpdateIntervalMinutes,
		MonitorIndexes:               monitorIndexes,
		MonitorProviders:             monitorProviders,
		PlaneAPIKey:                  existing.Plane.APIKey,
		PlaneWorkspaceSlug:           existing.Plane.WorkspaceSlug,
		PlaneProjectID:               existing.Plane.ProjectID,
		WeatherAPIKey:                existing.Weather.APIKey,
		WeatherCity:                  existing.Weather.City,
		WeatherCorner:                existing.Weather.Corner,
		WeatherBackgroundPath:        existing.Weather.BackgroundImagePath,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		renderSetupPage(w, http.StatusOK, basePageData)
	})

	configDir := filepath.Dir(configPath)
	mux.HandleFunc("/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cfg, err := parseSetupForm(r, monitorIndexes, configDir)
		if err != nil {
			renderSetupPage(w, http.StatusBadRequest, setupPageData{
				AppName:                      appDisplayName,
				Heading:                      heading,
				Intro:                        intro,
				SubmitLabel:                  submitLabel,
				SuccessMessage:               successMessage,
				ConfigPath:                   configPath,
				RunOnStartup:                 strings.TrimSpace(r.FormValue("run_on_startup")) != "",
				PlaneUpdateIntervalMinutes:   mustAtoiOrDefault(strings.TrimSpace(r.FormValue("plane_update_interval_minutes")), defaultPlaneUpdateIntervalMinutes),
				WeatherUpdateIntervalMinutes: mustAtoiOrDefault(strings.TrimSpace(r.FormValue("weather_update_interval_minutes")), defaultWeatherUpdateIntervalMinutes),
				MonitorIndexes:               monitorIndexes,
				MonitorProviders:             monitorProvidersFromForm(r, monitorIndexes),
				PlaneAPIKey:                  strings.TrimSpace(r.FormValue("plane_api_key")),
				PlaneWorkspaceSlug:           strings.TrimSpace(r.FormValue("workspace_slug")),
				PlaneProjectID:               strings.TrimSpace(r.FormValue("project_id")),
				WeatherAPIKey:                strings.TrimSpace(r.FormValue("weather_api_key")),
				WeatherCity:                  strings.TrimSpace(r.FormValue("weather_city")),
				WeatherCorner:                weatherWidgetCorner(strings.TrimSpace(r.FormValue("weather_corner"))),
				WeatherBackgroundPath:        strings.TrimSpace(r.FormValue("weather_background_existing")),
				Error:                        err.Error(),
			})
			return
		}

		if err := saveAppConfig(configPath, cfg); err != nil {
			renderSetupPage(w, http.StatusInternalServerError, setupPageData{
				AppName:                      appDisplayName,
				Heading:                      heading,
				Intro:                        intro,
				SubmitLabel:                  submitLabel,
				SuccessMessage:               successMessage,
				ConfigPath:                   configPath,
				RunOnStartup:                 cfg.RunOnStartup,
				PlaneUpdateIntervalMinutes:   cfg.PlaneUpdateIntervalMinutes,
				WeatherUpdateIntervalMinutes: cfg.WeatherUpdateIntervalMinutes,
				MonitorIndexes:               monitorIndexes,
				MonitorProviders:             monitorProvidersFromConfig(cfg, monitorIndexes),
				PlaneAPIKey:                  cfg.Plane.APIKey,
				PlaneWorkspaceSlug:           cfg.Plane.WorkspaceSlug,
				PlaneProjectID:               cfg.Plane.ProjectID,
				WeatherAPIKey:                cfg.Weather.APIKey,
				WeatherCity:                  cfg.Weather.City,
				WeatherCorner:                cfg.Weather.Corner,
				WeatherBackgroundPath:        cfg.Weather.BackgroundImagePath,
				Error:                        fmt.Sprintf("failed to save config: %v", err),
			})
			return
		}

		exePath, exeErr := os.Executable()
		if exeErr != nil {
			renderSetupPage(w, http.StatusInternalServerError, setupPageData{
				AppName:                      appDisplayName,
				Heading:                      heading,
				Intro:                        intro,
				SubmitLabel:                  submitLabel,
				SuccessMessage:               successMessage,
				ConfigPath:                   configPath,
				RunOnStartup:                 cfg.RunOnStartup,
				PlaneUpdateIntervalMinutes:   cfg.PlaneUpdateIntervalMinutes,
				WeatherUpdateIntervalMinutes: cfg.WeatherUpdateIntervalMinutes,
				MonitorIndexes:               monitorIndexes,
				MonitorProviders:             monitorProvidersFromConfig(cfg, monitorIndexes),
				PlaneAPIKey:                  cfg.Plane.APIKey,
				PlaneWorkspaceSlug:           cfg.Plane.WorkspaceSlug,
				PlaneProjectID:               cfg.Plane.ProjectID,
				WeatherAPIKey:                cfg.Weather.APIKey,
				WeatherCity:                  cfg.Weather.City,
				WeatherCorner:                cfg.Weather.Corner,
				WeatherBackgroundPath:        cfg.Weather.BackgroundImagePath,
				Error:                        fmt.Sprintf("settings saved but startup registration update failed: %v", exeErr),
			})
			return
		}

		if err := applyRunOnStartupSetting(exePath, cfg.RunOnStartup); err != nil {
			renderSetupPage(w, http.StatusInternalServerError, setupPageData{
				AppName:                      appDisplayName,
				Heading:                      heading,
				Intro:                        intro,
				SubmitLabel:                  submitLabel,
				SuccessMessage:               successMessage,
				ConfigPath:                   configPath,
				RunOnStartup:                 cfg.RunOnStartup,
				PlaneUpdateIntervalMinutes:   cfg.PlaneUpdateIntervalMinutes,
				WeatherUpdateIntervalMinutes: cfg.WeatherUpdateIntervalMinutes,
				MonitorIndexes:               monitorIndexes,
				MonitorProviders:             monitorProvidersFromConfig(cfg, monitorIndexes),
				PlaneAPIKey:                  cfg.Plane.APIKey,
				PlaneWorkspaceSlug:           cfg.Plane.WorkspaceSlug,
				PlaneProjectID:               cfg.Plane.ProjectID,
				WeatherAPIKey:                cfg.Weather.APIKey,
				WeatherCity:                  cfg.Weather.City,
				WeatherCorner:                cfg.Weather.Corner,
				WeatherBackgroundPath:        cfg.Weather.BackgroundImagePath,
				Error:                        fmt.Sprintf("settings saved but startup registration update failed: %v", err),
			})
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#0f172a;color:#e2e8f0"><h2>` + template.HTMLEscapeString(appDisplayName) + `</h2><p>` + template.HTMLEscapeString(successMessage) + `</p></body></html>`))

		select {
		case resultCh <- cfg:
		default:
		}
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return appConfig{}, fmt.Errorf("start setup listener: %w", err)
	}

	srv := &http.Server{Handler: mux}
	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && serveErr != http.ErrServerClosed {
			serverErrCh <- serveErr
		}
	}()

	setupURL := fmt.Sprintf("http://127.0.0.1:%d", ln.Addr().(*net.TCPAddr).Port)
	if firstRun {
		log.Printf("[live-wallpaper] opening first-run setup at %s", setupURL)
	} else {
		log.Printf("[live-wallpaper] opening settings at %s", setupURL)
	}
	if err := openBrowser(setupURL); err != nil {
		log.Printf("[live-wallpaper] failed to open browser automatically: %v", err)
		log.Printf("[live-wallpaper] open this URL manually to continue settings: %s", setupURL)
	}

	select {
	case cfg := <-resultCh:
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer shutdownCancel()
		_ = srv.Shutdown(shutdownCtx)
		return cfg, nil
	case serveErr := <-serverErrCh:
		return appConfig{}, fmt.Errorf("setup server error: %w", serveErr)
	}
}

func monitorProvidersFromConfig(cfg appConfig, monitorIndexes []int) map[int]wallpaperProvider {
	providers := make(map[int]wallpaperProvider, len(monitorIndexes))
	defaultProvider := defaultProviderForUnassignedMonitors(cfg)
	for _, idx := range monitorIndexes {
		providers[idx] = defaultProvider
	}
	for _, assignment := range cfg.MonitorAssignments {
		providers[assignment.MonitorIndex] = assignment.Provider
	}
	return providers
}

func defaultProviderForUnassignedMonitors(cfg appConfig) wallpaperProvider {
	if len(cfg.MonitorAssignments) > 0 {
		return cfg.MonitorAssignments[0].Provider
	}

	planeConfigured := strings.TrimSpace(cfg.Plane.APIKey) != "" || strings.TrimSpace(cfg.Plane.WorkspaceSlug) != "" || strings.TrimSpace(cfg.Plane.ProjectID) != ""
	weatherConfigured := strings.TrimSpace(cfg.Weather.APIKey) != "" || strings.TrimSpace(cfg.Weather.City) != "" || strings.TrimSpace(cfg.Weather.BackgroundImagePath) != ""

	if weatherConfigured && !planeConfigured {
		return providerWeather
	}

	return providerNone
}

func monitorProvidersFromForm(r *http.Request, monitorIndexes []int) map[int]wallpaperProvider {
	providers := make(map[int]wallpaperProvider, len(monitorIndexes))
	for _, idx := range monitorIndexes {
		provider := wallpaperProvider(strings.TrimSpace(r.FormValue(fmt.Sprintf("monitor_provider_%d", idx))))
		if provider != providerNone && provider != providerPlane && provider != providerWeather {
			provider = providerNone
		}
		providers[idx] = provider
	}
	return providers
}

func parseSetupForm(r *http.Request, monitorIndexes []int, configDir string) (appConfig, error) {
	contentType := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if strings.Contains(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(16 << 20); err != nil {
			return appConfig{}, fmt.Errorf("invalid multipart form payload")
		}
	} else if err := r.ParseForm(); err != nil {
		return appConfig{}, fmt.Errorf("invalid form payload")
	}

	cfg := appConfig{
		RunOnStartup:                 strings.TrimSpace(r.FormValue("run_on_startup")) != "",
		PlaneUpdateIntervalMinutes:   mustAtoiOrDefault(strings.TrimSpace(r.FormValue("plane_update_interval_minutes")), defaultPlaneUpdateIntervalMinutes),
		WeatherUpdateIntervalMinutes: mustAtoiOrDefault(strings.TrimSpace(r.FormValue("weather_update_interval_minutes")), defaultWeatherUpdateIntervalMinutes),
		Plane: providerPlaneConfig{
			APIKey:        strings.TrimSpace(r.FormValue("plane_api_key")),
			WorkspaceSlug: strings.TrimSpace(r.FormValue("workspace_slug")),
			ProjectID:     strings.TrimSpace(r.FormValue("project_id")),
		},
		Weather: providerWeatherConfig{
			APIKey:              strings.TrimSpace(r.FormValue("weather_api_key")),
			City:                strings.TrimSpace(r.FormValue("weather_city")),
			Corner:              weatherWidgetCorner(strings.TrimSpace(r.FormValue("weather_corner"))),
			BackgroundImagePath: strings.TrimSpace(r.FormValue("weather_background_existing")),
		},
	}

	if !isValidWeatherCorner(cfg.Weather.Corner) {
		cfg.Weather.Corner = cornerTopRight
	}

	file, header, err := r.FormFile("weather_background_upload")
	if err == nil {
		defer file.Close()
		savedPath, saveErr := saveWeatherBackgroundUpload(file, header.Filename, configDir, monitorIndexes)
		if saveErr != nil {
			return appConfig{}, saveErr
		}
		cfg.Weather.BackgroundImagePath = savedPath
	} else if !errors.Is(err, http.ErrMissingFile) {
		return appConfig{}, fmt.Errorf("invalid weather background upload")
	}

	cfg.MonitorAssignments = make([]monitorProviderAssignment, 0, len(monitorIndexes))
	for _, idx := range monitorIndexes {
		raw := strings.TrimSpace(r.FormValue(fmt.Sprintf("monitor_provider_%d", idx)))
		provider := wallpaperProvider(raw)
		if provider != providerNone && provider != providerPlane && provider != providerWeather {
			return appConfig{}, fmt.Errorf("monitor %d has invalid provider %q", idx, raw)
		}
		cfg.MonitorAssignments = append(cfg.MonitorAssignments, monitorProviderAssignment{
			MonitorIndex: idx,
			Provider:     provider,
		})
	}
	if len(cfg.MonitorAssignments) == 0 {
		cfg.MonitorAssignments = []monitorProviderAssignment{{
			MonitorIndex: 0,
			Provider:     providerNone,
		}}
	}

	cfg = cfg.normalized()
	if err := cfg.validate(); err != nil {
		return appConfig{}, err
	}

	if hasWeatherProvider(cfg.MonitorAssignments) {
		testCtx, testCancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer testCancel()
		if _, err := fetchWeatherForecast(testCtx, cfg.Weather.APIKey, cfg.Weather.City); err != nil {
			return appConfig{}, fmt.Errorf("weather settings test failed: %w", err)
		}
	}

	return cfg, nil
}

func mustAtoiOrDefault(raw string, fallback int) int {
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func hasWeatherProvider(assignments []monitorProviderAssignment) bool {
	for _, assignment := range assignments {
		if assignment.Provider == providerWeather {
			return true
		}
	}
	return false
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

var setupPageTemplate = template.Must(template.New("setup").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{.AppName}} setup</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; background: radial-gradient(circle at top, #1e293b, #0f172a 55%); color: #e2e8f0; font-family: Segoe UI, Arial, sans-serif; }
    .wrap { max-width: 860px; margin: 38px auto; padding: 24px; border: 1px solid #334155; border-radius: 16px; background: rgba(15, 23, 42, 0.92); }
    h1 { margin-top: 0; font-size: 26px; }
    h2 { margin-bottom: 8px; font-size: 18px; }
    p { color: #94a3b8; }
    label { display: block; margin-top: 12px; margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="password"], input[type="number"], select { width: 100%; padding: 10px 12px; border: 1px solid #475569; border-radius: 10px; background: #0b1220; color: #e2e8f0; }
    input[type="file"] { width: 100%; }
    .section { margin-top: 18px; padding-top: 12px; border-top: 1px solid #334155; }
    .monitor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 10px; }
    .monitor { padding: 10px; border: 1px solid #334155; border-radius: 10px; }
    .error { margin: 12px 0; color: #fca5a5; background: #450a0a; border: 1px solid #7f1d1d; border-radius: 10px; padding: 10px; }
    .hint { margin-top: 8px; font-size: 12px; color: #93c5fd; }
    button { margin-top: 20px; background: #0ea5e9; color: #082f49; font-weight: 700; border: none; border-radius: 10px; padding: 10px 16px; cursor: pointer; }
    button:hover { filter: brightness(1.08); }
    code { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>{{.Heading}}</h1>
    <p>{{.Intro}} Config file: <code>{{.ConfigPath}}</code>.</p>
    {{if .Error}}<div class="error">{{.Error}}</div>{{end}}
    <form method="post" action="/save" enctype="multipart/form-data">
      <div class="section">
				<h2>Application</h2>
				<label for="run_on_startup" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
					<input id="run_on_startup" name="run_on_startup" type="checkbox" style="width:auto;" {{if .RunOnStartup}}checked{{end}} />
					<span>Run on startup</span>
				</label>
			</div>

			<div class="section">
        <h2>Plane provider</h2>
        <label for="plane_update_interval_minutes">Plane update interval (minutes)</label>
        <input id="plane_update_interval_minutes" name="plane_update_interval_minutes" type="number" min="1" max="1440" value="{{.PlaneUpdateIntervalMinutes}}" />

        <label for="plane_api_key">Plane API key</label>
        <input id="plane_api_key" name="plane_api_key" type="password" autocomplete="off" value="{{.PlaneAPIKey}}" />

        <label for="workspace_slug">Workspace slug</label>
        <input id="workspace_slug" name="workspace_slug" type="text" placeholder="my-team" value="{{.PlaneWorkspaceSlug}}" />

        <label for="project_id">Project ID / identifier</label>
        <input id="project_id" name="project_id" type="text" placeholder="Project ID" value="{{.PlaneProjectID}}" />
      </div>

      <div class="section">
        <h2>Weather provider</h2>
				<label for="weather_update_interval_minutes">Weather update interval (minutes)</label>
				<input id="weather_update_interval_minutes" name="weather_update_interval_minutes" type="number" min="1" max="1440" value="{{.WeatherUpdateIntervalMinutes}}" />

        <label for="weather_api_key">OpenWeatherMap API key</label>
        <input id="weather_api_key" name="weather_api_key" type="password" autocomplete="off" value="{{.WeatherAPIKey}}" />

        <label for="weather_city">City</label>
        <input id="weather_city" name="weather_city" type="text" placeholder="Amsterdam" value="{{.WeatherCity}}" />

        <label for="weather_corner">Widget corner</label>
        <select id="weather_corner" name="weather_corner">
          <option value="top-left" {{if eq .WeatherCorner "top-left"}}selected{{end}}>Top left</option>
          <option value="top-right" {{if eq .WeatherCorner "top-right"}}selected{{end}}>Top right</option>
          <option value="bottom-left" {{if eq .WeatherCorner "bottom-left"}}selected{{end}}>Bottom left</option>
          <option value="bottom-right" {{if eq .WeatherCorner "bottom-right"}}selected{{end}}>Bottom right</option>
        </select>

        <label for="weather_background_upload">Background image upload</label>
        <input id="weather_background_upload" name="weather_background_upload" type="file" accept=".jpg,.jpeg,.png,.webp" />
        <input name="weather_background_existing" type="hidden" value="{{.WeatherBackgroundPath}}" />
        <p class="hint">Current: {{if .WeatherBackgroundPath}}<code>{{.WeatherBackgroundPath}}</code>{{else}}none{{end}}</p>
      </div>

      <div class="section">
        <h2>Per-monitor provider mapping</h2>
        <p>Select which feature should be used on each monitor.</p>
        <div class="monitor-grid">
          {{range .MonitorIndexes}}
          <div class="monitor">
            <label for="monitor_provider_{{.}}">Monitor {{.}}</label>
            <select id="monitor_provider_{{.}}" name="monitor_provider_{{.}}">
							<option value="none" {{if eq (index $.MonitorProviders .) "none"}}selected{{end}}>None</option>
              <option value="plane" {{if eq (index $.MonitorProviders .) "plane"}}selected{{end}}>Plane board</option>
              <option value="weather" {{if eq (index $.MonitorProviders .) "weather"}}selected{{end}}>Weather</option>
            </select>
          </div>
          {{end}}
        </div>
      </div>

      <button type="submit">{{.SubmitLabel}}</button>
    </form>
  </div>
</body>
</html>`))

func renderSetupPage(w http.ResponseWriter, statusCode int, data setupPageData) {
	if !isValidWeatherCorner(data.WeatherCorner) {
		data.WeatherCorner = cornerTopRight
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(statusCode)
	if err := setupPageTemplate.Execute(w, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
