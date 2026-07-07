//go:build windows

package main

import (
	"fmt"
	"strings"

	"golang.org/x/sys/windows/registry"
)

const (
	startupRunKeyPath = `Software\\Microsoft\\Windows\\CurrentVersion\\Run`
	startupValueName  = "LiveWallpaper"
)

func isRunOnStartupEnabled(exePath string) (bool, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, startupRunKeyPath, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, fmt.Errorf("open startup registry key: %w", err)
	}
	defer key.Close()

	raw, _, err := key.GetStringValue(startupValueName)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, fmt.Errorf("read startup registry value: %w", err)
	}

	return strings.TrimSpace(raw) != "", nil
}

func setRunOnStartupEnabled(exePath string, enabled bool) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, startupRunKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open startup registry key for write: %w", err)
	}
	defer key.Close()

	if !enabled {
		err := key.DeleteValue(startupValueName)
		if err != nil && err != registry.ErrNotExist {
			return fmt.Errorf("delete startup registry value: %w", err)
		}
		return nil
	}

	command := fmt.Sprintf("\"%s\"", exePath)
	if err := key.SetStringValue(startupValueName, command); err != nil {
		return fmt.Errorf("set startup registry value: %w", err)
	}

	return nil
}
