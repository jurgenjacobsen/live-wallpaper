//go:build !windows

package main

import "fmt"

// setWallpaper is a no-op on non-Windows platforms.
func setWallpaper(_ string, _ []int) error {
	return fmt.Errorf("setting the desktop wallpaper is only supported on Windows")
}

func listMonitorIndexes() ([]int, error) {
	return []int{0}, nil
}

func monitorSize(_ int) (int, int, error) {
	return 1920, 1080, nil
}
