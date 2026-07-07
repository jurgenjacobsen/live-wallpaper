//go:build !windows

package main

func isRunOnStartupEnabled(_ string) (bool, error) {
	return false, nil
}

func setRunOnStartupEnabled(_ string, _ bool) error {
	return nil
}
