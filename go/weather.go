package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type weatherForecastPayload struct {
	City      string             `json:"city"`
	UpdatedAt string             `json:"updatedAt"`
	Current   weatherCurrentRow  `json:"current"`
	Days      []weatherDayColumn `json:"days"`
}

type weatherCurrentRow struct {
	TempC       int    `json:"tempC"`
	Condition   string `json:"condition"`
	Description string `json:"description"`
	IconURL     string `json:"iconUrl"`
	Humidity    int    `json:"humidity"`
	WindKph     int    `json:"windKph"`
}

type weatherDayColumn struct {
	DateKey     string `json:"dateKey"`
	DateLabel   string `json:"dateLabel"`
	MinC        int    `json:"minC"`
	MaxC        int    `json:"maxC"`
	Condition   string `json:"condition"`
	Description string `json:"description"`
	IconURL     string `json:"iconUrl"`
}

type openWeatherForecastResponse struct {
	List []openWeatherEntry `json:"list"`
	City struct {
		Name string `json:"name"`
	} `json:"city"`
}

type openWeatherEntry struct {
	DTText string `json:"dt_txt"`
	Main   struct {
		Temp     float64 `json:"temp"`
		TempMin  float64 `json:"temp_min"`
		TempMax  float64 `json:"temp_max"`
		Humidity int     `json:"humidity"`
	} `json:"main"`
	Wind struct {
		Speed float64 `json:"speed"`
	} `json:"wind"`
	Weather []struct {
		Main        string `json:"main"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	} `json:"weather"`
}

type dayAggregate struct {
	Date        time.Time
	MinC        int
	MaxC        int
	SampleCount int
	TempTotal   float64
	Reports     []dayReport
	Condition   string
	Description string
	IconURL     string
}

type dayReport struct {
	TempC       float64
	Condition   string
	Description string
	IconURL     string
}

func fetchWeatherForecast(ctx context.Context, apiKey, city string) (weatherForecastPayload, error) {
	endpoint, _ := url.Parse("https://api.openweathermap.org/data/2.5/forecast")
	query := endpoint.Query()
	query.Set("q", strings.TrimSpace(city))
	query.Set("appid", strings.TrimSpace(apiKey))
	query.Set("units", "metric")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return weatherForecastPayload{}, err
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return weatherForecastPayload{}, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		message := strings.TrimSpace(string(body))
		if message == "" {
			return weatherForecastPayload{}, fmt.Errorf("openweathermap returned %d", res.StatusCode)
		}
		return weatherForecastPayload{}, fmt.Errorf("openweathermap returned %d: %s", res.StatusCode, message)
	}

	var payload openWeatherForecastResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return weatherForecastPayload{}, fmt.Errorf("invalid weather response: %w", err)
	}
	if len(payload.List) == 0 {
		return weatherForecastPayload{}, fmt.Errorf("weather response did not include forecast entries")
	}

	nowEntry := payload.List[0]
	current := weatherCurrentRow{
		TempC:       rounded(nowEntry.Main.Temp),
		Condition:   weatherMain(nowEntry),
		Description: weatherDescription(nowEntry),
		IconURL:     weatherIconURL(nowEntry),
		Humidity:    nowEntry.Main.Humidity,
		WindKph:     rounded(nowEntry.Wind.Speed * 3.6),
	}

	aggregates := make(map[string]*dayAggregate)
	dateOrder := make([]string, 0, 8)
	for _, entry := range payload.List {
		parsed, err := time.Parse("2006-01-02 15:04:05", entry.DTText)
		if err != nil {
			continue
		}

		dateKey := parsed.Format("2006-01-02")
		minC := rounded(entry.Main.TempMin)
		maxC := rounded(entry.Main.TempMax)
		agg, exists := aggregates[dateKey]
		if !exists {
			agg = &dayAggregate{
				Date:        parsed,
				MinC:        minC,
				MaxC:        maxC,
				SampleCount: 0,
				TempTotal:   0,
				Reports:     make([]dayReport, 0, 8),
				Condition:   weatherMain(entry),
				Description: weatherDescription(entry),
				IconURL:     weatherIconURL(entry),
			}
			aggregates[dateKey] = agg
			dateOrder = append(dateOrder, dateKey)
		}

		if minC < agg.MinC {
			agg.MinC = minC
		}
		if maxC > agg.MaxC {
			agg.MaxC = maxC
		}

		reportMain := weatherMain(entry)
		reportDescription := weatherDescription(entry)
		reportIconURL := weatherIconURL(entry)
		agg.TempTotal += entry.Main.Temp
		agg.SampleCount++
		agg.Reports = append(agg.Reports, dayReport{
			TempC:       entry.Main.Temp,
			Condition:   reportMain,
			Description: reportDescription,
			IconURL:     reportIconURL,
		})
	}

	sort.Strings(dateOrder)
	days := make([]weatherDayColumn, 0, 5)
	for _, dateKey := range dateOrder {
		agg := aggregates[dateKey]
		if agg == nil {
			continue
		}

		if agg.SampleCount > 0 && len(agg.Reports) > 0 {
			avgTemp := agg.TempTotal / float64(agg.SampleCount)
			bestDiff := math.MaxFloat64
			for _, report := range agg.Reports {
				diff := math.Abs(report.TempC - avgTemp)
				if diff < bestDiff {
					bestDiff = diff
					agg.Condition = report.Condition
					agg.Description = report.Description
					agg.IconURL = report.IconURL
				}
			}
		}

		days = append(days, weatherDayColumn{
			DateKey:     dateKey,
			DateLabel:   agg.Date.Format("Mon 02 Jan"),
			MinC:        agg.MinC,
			MaxC:        agg.MaxC,
			Condition:   agg.Condition,
			Description: agg.Description,
			IconURL:     agg.IconURL,
		})
		if len(days) == 5 {
			break
		}
	}

	return weatherForecastPayload{
		City:      strings.TrimSpace(payload.City.Name),
		UpdatedAt: time.Now().Format(time.RFC3339),
		Current:   current,
		Days:      days,
	}, nil
}

func weatherMain(entry openWeatherEntry) string {
	if len(entry.Weather) == 0 {
		return "Unknown"
	}
	return entry.Weather[0].Main
}

func weatherDescription(entry openWeatherEntry) string {
	if len(entry.Weather) == 0 {
		return ""
	}
	return entry.Weather[0].Description
}

func weatherIconURL(entry openWeatherEntry) string {
	if len(entry.Weather) == 0 || strings.TrimSpace(entry.Weather[0].Icon) == "" {
		return ""
	}
	return fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", entry.Weather[0].Icon)
}

func rounded(v float64) int {
	if v >= 0 {
		return int(v + 0.5)
	}
	return int(v - 0.5)
}
