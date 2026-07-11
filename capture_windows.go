//go:build windows

package main

import (
	"os/exec"
	"syscall"

	"github.com/chromedp/chromedp"
)

// platformAllocatorOptions returns Windows-specific options for the chromedp exec allocator
// to prevent blank window popups and hidden command windows.
func platformAllocatorOptions() []chromedp.ExecAllocatorOption {
	return []chromedp.ExecAllocatorOption{
		// Move the window far off-screen to work around the Chromium bug
		// where a blank window briefly appears in headless mode.
		chromedp.Flag("window-position", "-10000,-10000"),
		// Hide the cmd/console window spawned by the browser process.
		chromedp.ModifyCmdFunc(func(cmd *exec.Cmd) {
			if cmd.SysProcAttr == nil {
				cmd.SysProcAttr = &syscall.SysProcAttr{}
			}
			cmd.SysProcAttr.HideWindow = true
		}),
	}
}
