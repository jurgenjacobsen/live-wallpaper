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
// React app to finish rendering (fonts + data), takes a screenshot using the
// monitor's resolution, and saves the PNG to outputPath.
func captureWallpaper(ctx context.Context, pageURL, outputPath string, provider wallpaperProvider, monitorIndex int, width int, height int, readyState *frontendReadyState) error {
	if width < 1 || height < 1 {
		return fmt.Errorf("invalid capture size %dx%d", width, height)
	}

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
		chromedp.WindowSize(width, height),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	defer allocCancel()

	taskCtx, taskCancel := chromedp.NewContext(allocCtx)
	defer taskCancel()

	timeoutCtx, timeoutCancel := context.WithTimeout(taskCtx, 60*time.Second)
	defer timeoutCancel()

	var buf []byte
	if err := chromedp.Run(timeoutCtx,
		// Pin viewport to the monitor dimensions at 1x DPI.
		chromedp.EmulateViewport(int64(width), int64(height)),
		chromedp.Navigate(renderURL.String()),
		// Wait for the DOM to be ready.
		chromedp.WaitVisible("body", chromedp.ByQuery),
	); err != nil {
		return fmt.Errorf("initial page render failed: %w", err)
	}

	if err := waitForFrontendReady(timeoutCtx, readyState, provider, monitorIndex); err != nil {
		return err
	}

	if err := chromedp.Run(timeoutCtx,
		// Small delay allows splash fade-out transition to complete.
		chromedp.Sleep(250*time.Millisecond),
		chromedp.CaptureScreenshot(&buf),
	); err != nil {
		return fmt.Errorf("screenshot failed after frontend ready: %w", err)
	}

	return os.WriteFile(outputPath, buf, 0644)
}

func waitForFrontendReady(ctx context.Context, readyState *frontendReadyState, provider wallpaperProvider, monitorIndex int) error {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		if readyState.IsReady(provider, monitorIndex) {
			return nil
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for frontend ready signal: %w", ctx.Err())
		case <-ticker.C:
		}
	}
}
