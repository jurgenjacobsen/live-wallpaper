//go:build !windows

package main

func supportsTray() bool {
	return false
}

func runTray(_ trayCallbacks) error {
	return nil
}

func quitTray() {}

func setTrayTooltip(_ string) {}
