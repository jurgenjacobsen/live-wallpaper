package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"sort"
	"strings"
)

var errConfigNotFound = errors.New("app config file not found")

const (
	defaultPlaneUpdateIntervalMinutes   = 30
	defaultWeatherUpdateIntervalMinutes = 30
)

type wallpaperProvider string

const (
	providerPlane   wallpaperProvider = "plane"
	providerWeather wallpaperProvider = "weather"
)

type weatherWidgetCorner string

const (
	cornerTopLeft     weatherWidgetCorner = "top-left"
	cornerTopRight    weatherWidgetCorner = "top-right"
	cornerBottomLeft  weatherWidgetCorner = "bottom-left"
	cornerBottomRight weatherWidgetCorner = "bottom-right"
)

type providerPlaneConfig struct {
	APIKey        string `json:"apiKey"`
	WorkspaceSlug string `json:"workspaceSlug"`
	ProjectID     string `json:"projectId"`
}

type providerWeatherConfig struct {
	APIKey              string              `json:"apiKey"`
	City                string              `json:"city"`
	Corner              weatherWidgetCorner `json:"corner"`
	BackgroundImagePath string              `json:"backgroundImagePath"`
}

type monitorProviderAssignment struct {
	MonitorIndex int               `json:"monitorIndex"`
	Provider     wallpaperProvider `json:"provider"`
}

type appConfig struct {
	ConfigVersion                int                         `json:"configVersion"`
	LastUpdatedAtUnix            int64                       `json:"lastUpdatedAtUnix,omitempty"`
	PlaneUpdateIntervalMinutes   int                         `json:"planeUpdateIntervalMinutes"`
	WeatherUpdateIntervalMinutes int                         `json:"weatherUpdateIntervalMinutes"`
	Plane                        providerPlaneConfig         `json:"plane"`
	Weather                      providerWeatherConfig       `json:"weather"`
	MonitorAssignments           []monitorProviderAssignment `json:"monitorAssignments"`
	PlaneAPIKeyLegacy            string                      `json:"planeApiKey,omitempty"`
	WorkspaceSlugLegacy          string                      `json:"workspaceSlug,omitempty"`
	ProjectIDLegacy              string                      `json:"projectId,omitempty"`
	MonitorAllLegacy             bool                        `json:"monitorAll,omitempty"`
	MonitorIndexesLegacy         []int                       `json:"monitorIndexes,omitempty"`
	UpdateIntervalMinutesLegacy  int                         `json:"updateIntervalMinutes,omitempty"`
}

type runtimeClientConfig struct {
	SelectedProvider wallpaperProvider    `json:"selectedProvider"`
	MonitorIndex     int                  `json:"monitorIndex"`
	Plane            providerPlaneConfig  `json:"plane"`
	Weather          runtimeWeatherConfig `json:"weather"`
}

type runtimeWeatherConfig struct {
	City               string              `json:"city"`
	Corner             weatherWidgetCorner `json:"corner"`
	BackgroundImageURL string              `json:"backgroundImageUrl"`
}

func (c appConfig) validate() error {
	if c.PlaneUpdateIntervalMinutes < 1 || c.PlaneUpdateIntervalMinutes > 1440 {
		return fmt.Errorf("plane update interval must be between 1 and 1440 minutes")
	}
	if c.WeatherUpdateIntervalMinutes < 1 || c.WeatherUpdateIntervalMinutes > 1440 {
		return fmt.Errorf("weather update interval must be between 1 and 1440 minutes")
	}

	if len(c.MonitorAssignments) == 0 {
		return fmt.Errorf("at least one monitor assignment is required")
	}

	seen := make(map[int]struct{}, len(c.MonitorAssignments))
	usesPlane := false
	usesWeather := false
	for _, assignment := range c.MonitorAssignments {
		idx := assignment.MonitorIndex
		if idx < 0 {
			return fmt.Errorf("invalid monitor index %d", idx)
		}
		if _, ok := seen[idx]; ok {
			return fmt.Errorf("monitor %d has multiple assignments", idx)
		}
		seen[idx] = struct{}{}

		switch assignment.Provider {
		case providerPlane:
			usesPlane = true
		case providerWeather:
			usesWeather = true
		default:
			return fmt.Errorf("invalid provider %q for monitor %d", assignment.Provider, idx)
		}
	}

	if usesPlane {
		if strings.TrimSpace(c.Plane.APIKey) == "" {
			return fmt.Errorf("plane api key is required when plane provider is assigned")
		}
		if strings.TrimSpace(c.Plane.WorkspaceSlug) == "" {
			return fmt.Errorf("plane workspace slug is required when plane provider is assigned")
		}
		if strings.TrimSpace(c.Plane.ProjectID) == "" {
			return fmt.Errorf("plane project id is required when plane provider is assigned")
		}
	}

	if usesWeather {
		if strings.TrimSpace(c.Weather.APIKey) == "" {
			return fmt.Errorf("weather api key is required when weather provider is assigned")
		}
		if strings.TrimSpace(c.Weather.City) == "" {
			return fmt.Errorf("weather city is required when weather provider is assigned")
		}
		if strings.TrimSpace(c.Weather.BackgroundImagePath) == "" {
			return fmt.Errorf("weather background image is required when weather provider is assigned")
		}
	}

	if !isValidWeatherCorner(c.Weather.Corner) {
		return fmt.Errorf("invalid weather corner %q", c.Weather.Corner)
	}
	return nil
}

func (c appConfig) normalized() appConfig {
	clone := c
	clone = clone.migrateLegacyIfNeeded()

	clone.Plane.APIKey = strings.TrimSpace(clone.Plane.APIKey)
	clone.Plane.WorkspaceSlug = strings.TrimSpace(clone.Plane.WorkspaceSlug)
	clone.Plane.ProjectID = strings.TrimSpace(clone.Plane.ProjectID)

	clone.Weather.APIKey = strings.TrimSpace(clone.Weather.APIKey)
	clone.Weather.City = strings.TrimSpace(clone.Weather.City)
	clone.Weather.BackgroundImagePath = strings.TrimSpace(clone.Weather.BackgroundImagePath)

	legacyInterval := clone.UpdateIntervalMinutesLegacy
	if clone.PlaneUpdateIntervalMinutes <= 0 {
		if legacyInterval > 0 {
			clone.PlaneUpdateIntervalMinutes = legacyInterval
		} else {
			clone.PlaneUpdateIntervalMinutes = defaultPlaneUpdateIntervalMinutes
		}
	}
	if clone.WeatherUpdateIntervalMinutes <= 0 {
		if legacyInterval > 0 {
			clone.WeatherUpdateIntervalMinutes = legacyInterval
		} else {
			clone.WeatherUpdateIntervalMinutes = defaultWeatherUpdateIntervalMinutes
		}
	}
	if !isValidWeatherCorner(clone.Weather.Corner) {
		clone.Weather.Corner = cornerTopRight
	}

	set := make(map[int]struct{}, len(clone.MonitorAssignments))
	assignments := make([]monitorProviderAssignment, 0, len(clone.MonitorAssignments))
	for _, assignment := range clone.MonitorAssignments {
		if assignment.MonitorIndex < 0 {
			continue
		}
		if assignment.Provider != providerPlane && assignment.Provider != providerWeather {
			continue
		}
		if _, exists := set[assignment.MonitorIndex]; exists {
			continue
		}
		set[assignment.MonitorIndex] = struct{}{}
		assignments = append(assignments, assignment)
	}
	sort.Slice(assignments, func(i, j int) bool {
		return assignments[i].MonitorIndex < assignments[j].MonitorIndex
	})
	clone.MonitorAssignments = assignments

	return clone
}

func (c appConfig) migrateLegacyIfNeeded() appConfig {
	clone := c
	if clone.ConfigVersion >= 2 {
		return clone
	}

	if clone.Plane.APIKey == "" {
		clone.Plane.APIKey = clone.PlaneAPIKeyLegacy
	}
	if clone.Plane.WorkspaceSlug == "" {
		clone.Plane.WorkspaceSlug = clone.WorkspaceSlugLegacy
	}
	if clone.Plane.ProjectID == "" {
		clone.Plane.ProjectID = clone.ProjectIDLegacy
	}

	if len(clone.MonitorAssignments) == 0 {
		if clone.MonitorAllLegacy {
			clone.MonitorAssignments = []monitorProviderAssignment{{
				MonitorIndex: 0,
				Provider:     providerPlane,
			}}
		} else if len(clone.MonitorIndexesLegacy) > 0 {
			clone.MonitorAssignments = make([]monitorProviderAssignment, 0, len(clone.MonitorIndexesLegacy))
			for _, idx := range clone.MonitorIndexesLegacy {
				clone.MonitorAssignments = append(clone.MonitorAssignments, monitorProviderAssignment{
					MonitorIndex: idx,
					Provider:     providerPlane,
				})
			}
		}
	}

	if len(clone.MonitorAssignments) == 0 {
		clone.MonitorAssignments = []monitorProviderAssignment{{
			MonitorIndex: 0,
			Provider:     providerPlane,
		}}
	}

	if !isValidWeatherCorner(clone.Weather.Corner) {
		clone.Weather.Corner = cornerTopRight
	}

	return clone
}

func (c appConfig) toRuntimeClientConfig(selectedProvider wallpaperProvider, monitorIndex int, weatherBackgroundImageURL string) runtimeClientConfig {
	return runtimeClientConfig{
		SelectedProvider: selectedProvider,
		MonitorIndex:     monitorIndex,
		Plane:            c.Plane,
		Weather: runtimeWeatherConfig{
			City:               c.Weather.City,
			Corner:             c.Weather.Corner,
			BackgroundImageURL: weatherBackgroundImageURL,
		},
	}
}

func (c appConfig) displayMonitorSelection() string {
	if len(c.MonitorAssignments) == 0 {
		return "no monitor assignments"
	}

	parts := make([]string, 0, len(c.MonitorAssignments))
	for _, assignment := range c.MonitorAssignments {
		parts = append(parts, fmt.Sprintf("monitor %d: %s", assignment.MonitorIndex, assignment.Provider))
	}
	return strings.Join(parts, "; ")
}

func loadAppConfig(path string) (appConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return appConfig{}, errConfigNotFound
		}
		return appConfig{}, fmt.Errorf("read config file: %w", err)
	}

	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return appConfig{}, fmt.Errorf("parse config file: %w", err)
	}

	cfg = cfg.normalized()
	if err := cfg.validate(); err != nil {
		return appConfig{}, fmt.Errorf("invalid config file: %w", err)
	}

	return cfg, nil
}

func saveAppConfig(path string, cfg appConfig) error {
	cfg = cfg.normalized()
	if err := cfg.validate(); err != nil {
		return err
	}

	cfg.ConfigVersion = 2

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("serialize config: %w", err)
	}

	if err := os.WriteFile(path, append(data, '\n'), 0600); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}

	return nil
}

func defaultMonitorSelection(monitorIndexes []int) []int {
	if len(monitorIndexes) == 0 {
		return nil
	}
	if slices.Contains(monitorIndexes, 0) {
		return []int{0}
	}
	return []int{monitorIndexes[0]}
}

func isValidWeatherCorner(corner weatherWidgetCorner) bool {
	switch corner {
	case cornerTopLeft, cornerTopRight, cornerBottomLeft, cornerBottomRight:
		return true
	default:
		return false
	}
}

func buildMonitorAssignments(monitorIndexes []int, provider wallpaperProvider) []monitorProviderAssignment {
	if provider != providerPlane && provider != providerWeather {
		provider = providerPlane
	}

	assignments := make([]monitorProviderAssignment, 0, len(monitorIndexes))
	for _, idx := range monitorIndexes {
		if idx < 0 {
			continue
		}
		assignments = append(assignments, monitorProviderAssignment{
			MonitorIndex: idx,
			Provider:     provider,
		})
	}
	return assignments
}
