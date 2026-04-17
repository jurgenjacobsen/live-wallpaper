//go:build !windows

package main

import (
	"fmt"
	"os/exec"
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
