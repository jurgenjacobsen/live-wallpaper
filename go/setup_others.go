//go:build !windows

package main

import (
	"fmt"
	"os/exec"
	"strings"
)

func openBrowser(url string) error {
	cmd := exec.Command("xdg-open", url)
	if err := cmd.Start(); err == nil {
		return nil
	}
	cmd = exec.Command("open", url)
	if err := cmd.Start(); err == nil {
		return nil
	}
	return fmt.Errorf("could not open browser automatically")
}

func openSettingsWindow(url string) error {
	if strings.Contains(url, "?") {
		url += "&mode=settings"
	} else {
		url += "?mode=settings"
	}
	return openBrowser(url)
}

func openLogFile(path string) error {
	cmd := exec.Command("xdg-open", path)
	if err := cmd.Start(); err == nil {
		return nil
	}
	cmd = exec.Command("open", path)
	if err := cmd.Start(); err == nil {
		return nil
	}
	return fmt.Errorf("could not open log file automatically")
}

func promptUpdateAvailable(_ string, _ string) (bool, error) {
	return false, nil
}
