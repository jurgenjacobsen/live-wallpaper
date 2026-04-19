package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/chromedp/chromedp"
)

// captureWallpaper launches headless Chrome, navigates to url, waits for the
// React app to finish rendering (fonts + data), takes a 1920×1080 screenshot,
// and saves the PNG to outputPath.
func captureWallpaper(ctx context.Context, pageURL, outputPath string, provider wallpaperProvider, monitorIndex int) error {
	renderURL, err := url.Parse(pageURL)
	if err != nil {
		return fmt.Errorf("invalid page url: %w", err)
	}

	switch provider {
	case providerNone:
		renderURL.Path = "/"
	case providerWeather:
		renderURL.Path = "/weather"
	default:
		renderURL.Path = "/plane"
	}

	query := renderURL.Query()
	query.Set("provider", string(provider))
	query.Set("monitor", fmt.Sprintf("%d", monitorIndex))
	renderURL.RawQuery = query.Encode()

	// Build exec-allocator options on top of the sensible defaults.
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	defer allocCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocCtx)
	defer taskCancel()

	timeoutCtx, timeoutCancel := context.WithTimeout(taskCtx, 60*time.Second)
	defer timeoutCancel()

	var buf []byte
	if err := chromedp.Run(timeoutCtx,
		// Pin viewport to exactly 1920×1080 at 1× DPI.
		chromedp.EmulateViewport(1920, 1080),
		chromedp.Navigate(renderURL.String()),
		// Wait for the DOM to be ready.
		chromedp.WaitVisible("body", chromedp.ByQuery),
		// Give the React app time to fetch Plane.so data and render it,
		// and for custom fonts to finish loading.
		chromedp.Sleep(5*time.Second),
		chromedp.CaptureScreenshot(&buf),
	); err != nil {
		return fmt.Errorf("screenshot failed: %w", err)
	}

	return os.WriteFile(outputPath, buf, 0644)
}
