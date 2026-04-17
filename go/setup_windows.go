//go:build windows

package main

import (
	"fmt"
	"os/exec"
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
