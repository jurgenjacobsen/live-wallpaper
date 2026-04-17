package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// newHandler returns an http.Handler that:
//   - Proxies requests under /plane-api/ to https://api.plane.so
//   - Exposes runtime config for the embedded frontend under /api/runtime-config
//   - Exposes weather forecast payload under /api/weather-forecast
//   - Exposes weather background image under /api/weather-background
//   - Serves the embedded React production build for all other paths
func newHandler(cfg appConfig) http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("embedded dist/ directory not found: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))

	target, _ := url.Parse("https://api.plane.so")
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = "https"
		req.URL.Host = "api.plane.so"
		req.Host = "api.plane.so"
		// Strip the /plane-api prefix so /plane-api/api/v1/... → /api/v1/...
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/plane-api")
		req.URL.RawPath = strings.TrimPrefix(req.URL.RawPath, "/plane-api")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/runtime-config", func(w http.ResponseWriter, r *http.Request) {
		provider, monitorIndex := resolveRuntimeSelection(r, cfg)
		weatherBackgroundImageURL := ""
		if strings.TrimSpace(cfg.Weather.BackgroundImagePath) != "" {
			weatherBackgroundImageURL = "/api/weather-background"
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cfg.toRuntimeClientConfig(provider, monitorIndex, weatherBackgroundImageURL))
	})

	mux.HandleFunc("/api/weather-forecast", func(w http.ResponseWriter, r *http.Request) {
		city := strings.TrimSpace(cfg.Weather.City)
		if strings.TrimSpace(cfg.Weather.APIKey) == "" || city == "" {
			log.Printf("[live-wallpaper] weather update skipped: provider not configured")
			http.Error(w, "weather provider is not configured", http.StatusBadRequest)
			return
		}

		forecast, err := fetchWeatherForecast(r.Context(), cfg.Weather.APIKey, city)
		if err != nil {
			log.Printf("[live-wallpaper] weather update failed for %q: %v", city, err)
			http.Error(w, fmt.Sprintf("weather fetch failed: %v", err), http.StatusBadGateway)
			return
		}
		log.Printf("[live-wallpaper] weather updated for %q at %s (%d day(s), %dC)", forecast.City, forecast.UpdatedAt, len(forecast.Days), forecast.Current.TempC)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(forecast)
	})

	mux.HandleFunc("/api/weather-background", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimSpace(cfg.Weather.BackgroundImagePath)
		if path == "" {
			http.NotFound(w, r)
			return
		}

		if _, err := os.Stat(path); err != nil {
			http.NotFound(w, r)
			return
		}

		http.ServeFile(w, r, path)
	})

	mux.Handle("/plane-api/", proxy)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean(r.URL.Path)
		if cleanPath == "." || cleanPath == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}

		rel := strings.TrimPrefix(cleanPath, "/")
		if rel != "" {
			if _, err := fs.Stat(sub, rel); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		indexData, err := fs.ReadFile(sub, "index.html")
		if err != nil {
			http.Error(w, "index.html not found", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(indexData)
	})

	return mux
}

func resolveRuntimeSelection(r *http.Request, cfg appConfig) (wallpaperProvider, int) {
	defaultAssignment := monitorProviderAssignment{MonitorIndex: 0, Provider: providerPlane}
	if len(cfg.MonitorAssignments) > 0 {
		defaultAssignment = cfg.MonitorAssignments[0]
	}

	monitorIndex := defaultAssignment.MonitorIndex
	if rawMonitor := strings.TrimSpace(r.URL.Query().Get("monitor")); rawMonitor != "" {
		if parsed, err := strconv.Atoi(rawMonitor); err == nil && parsed >= 0 {
			monitorIndex = parsed
		}
	}

	assignmentForMonitor := defaultAssignment
	for _, assignment := range cfg.MonitorAssignments {
		if assignment.MonitorIndex == monitorIndex {
			assignmentForMonitor = assignment
			break
		}
	}

	provider := assignmentForMonitor.Provider
	rawProvider := wallpaperProvider(strings.TrimSpace(r.URL.Query().Get("provider")))
	if rawProvider == providerPlane || rawProvider == providerWeather {
		provider = rawProvider
	}

	return provider, monitorIndex
}
