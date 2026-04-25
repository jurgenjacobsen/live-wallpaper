//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"unsafe"
)

const (
	mbYesNo           = 0x00000004
	mbIconInformation = 0x00000040
	mbTopMost         = 0x00040000
	idYes             = 6
)

func openBrowser(url string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("open browser: %w", err)
	}
	return nil
}

func openSettingsWindow(url string) error {
	// Append mode=settings to the URL
	if strings.Contains(url, "?") {
		url += "&mode=settings"
	} else {
		url += "?mode=settings"
	}

	// Try Microsoft Edge in "app" mode first for a native window feel.
	edgePaths := []string{
		os.Getenv("ProgramFiles(x86)") + `\Microsoft\Edge\Application\msedge.exe`,
		os.Getenv("ProgramFiles") + `\Microsoft\Edge\Application\msedge.exe`,
		"msedge.exe",
	}
	for _, p := range edgePaths {
		if _, err := os.Stat(p); err == nil || p == "msedge.exe" {
			cmd := exec.Command(p, "--app="+url)
			if err := cmd.Start(); err == nil {
				return nil
			}
		}
	}

	// Fallback to Google Chrome in "app" mode.
	chromePaths := []string{
		os.Getenv("ProgramFiles(x86)") + `\Google\Chrome\Application\chrome.exe`,
		os.Getenv("ProgramFiles") + `\Google\Chrome\Application\chrome.exe`,
		"chrome.exe",
	}
	for _, p := range chromePaths {
		if _, err := os.Stat(p); err == nil || p == "chrome.exe" {
			cmd := exec.Command(p, "--app="+url)
			if err := cmd.Start(); err == nil {
				return nil
			}
		}
	}

	// Absolute fallback to the default browser.
	return openBrowser(url)
}

func openLogFile(path string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("open log file: %w", err)
	}
	return nil
}

func promptUpdateAvailable(currentVersion string, latestVersion string) (bool, error) {
	message := fmt.Sprintf(
		"A new version of %s is available.\n\nCurrent version: %s\nLatest version: %s\n\nOpen GitHub Releases to download the update?",
		appDisplayName,
		currentVersion,
		latestVersion,
	)
	title := appDisplayName + " - Update Available"

	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")

	ret, _, callErr := messageBoxW.Call(
		0,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(message))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(title))),
		mbYesNo|mbIconInformation|mbTopMost,
	)
	if ret == 0 {
		if callErr != nil && callErr != syscall.Errno(0) {
			return false, fmt.Errorf("show update prompt: %w", callErr)
		}
		return false, fmt.Errorf("show update prompt: unknown error")
	}

	return ret == idYes, nil
}
