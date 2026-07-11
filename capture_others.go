//go:build !windows

package main

import "github.com/chromedp/chromedp"

// platformAllocatorOptions returns platform-specific options for the chromedp exec allocator.
func platformAllocatorOptions() []chromedp.ExecAllocatorOption {
	return nil
}
