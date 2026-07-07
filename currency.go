package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type currencyDataPayload struct {
	BaseCurrency string         `json:"baseCurrency"`
	UpdatedAt    string         `json:"updatedAt"`
	Dates        []string       `json:"dates"`
	Rates        []currencyRate `json:"rates"`
}

type currencyRate struct {
	Symbol      string    `json:"symbol"`
	CurrentRate float64   `json:"currentRate"`
	History     []float64 `json:"history"`
}

type frankfurterResponse struct {
	Amount float64                       `json:"amount"`
	Base   string                        `json:"base"`
	Start  string                        `json:"start_date"`
	End    string                        `json:"end_date"`
	Rates  map[string]map[string]float64 `json:"rates"`
}

func fetchCurrencyData(ctx context.Context, baseCurrency string, targets []string) (currencyDataPayload, error) {
	if len(targets) == 0 {
		return currencyDataPayload{}, fmt.Errorf("no target currencies specified")
	}

	requestCtx := ctx
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		requestCtx, cancel = context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
	}

	now := time.Now()
	// Get data for last 7 days to be safe and ensure we have 5 working days
	startDate := now.AddDate(0, 0, -7).Format("2006-01-02")
	endDate := now.Format("2006-01-02")

	endpoint := fmt.Sprintf("https://api.frankfurter.app/%s..%s", startDate, endDate)
	u, _ := url.Parse(endpoint)
	query := u.Query()
	query.Set("from", baseCurrency)
	query.Set("to", strings.Join(targets, ","))
	u.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, u.String(), nil)
	if err != nil {
		return currencyDataPayload{}, err
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return currencyDataPayload{}, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return currencyDataPayload{}, fmt.Errorf("frankfurter returned %d: %s", res.StatusCode, string(body))
	}

	var payload frankfurterResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return currencyDataPayload{}, fmt.Errorf("invalid currency response: %w", err)
	}

	// Sort dates to ensure chronological history
	dates := make([]string, 0, len(payload.Rates))
	for d := range payload.Rates {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	// Keep only last 5 dates
	if len(dates) > 5 {
		dates = dates[len(dates)-5:]
	}

	rates := make([]currencyRate, 0, len(targets))
	for _, target := range targets {
		history := make([]float64, 0, 5)
		currentRate := 0.0

		// Extract history for the selected 5 dates
		for _, d := range dates {
			if r, ok := payload.Rates[d][target]; ok {
				history = append(history, r)
				currentRate = r 
			}
		}

		rates = append(rates, currencyRate{
			Symbol:      target,
			CurrentRate: currentRate,
			History:     history,
		})
	}

	return currencyDataPayload{
		BaseCurrency: baseCurrency,
		UpdatedAt:    time.Now().Format(time.RFC3339),
		Dates:        dates,
		Rates:        rates,
	}, nil
}
