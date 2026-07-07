//go:build !windows

package main

func showSplashWindow() (func(), error) {
	return func() {}, nil
}
