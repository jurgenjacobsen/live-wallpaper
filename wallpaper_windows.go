//go:build windows

package main

import (
	"fmt"
	"runtime"
	"slices"
	"syscall"
	"unsafe"
)

const (
	spiSetDeskWallpaper = 0x0014
	spifUpdateIniFile   = 0x0001
	spifSendChange      = 0x0002

	coInitApartmentThreaded = 0x2
	clsctxInprocServer      = 0x1
	clsctxLocalServer       = 0x4
)

type guid struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

type iUnknownVtbl struct {
	QueryInterface uintptr
	AddRef         uintptr
	Release        uintptr
}

type iDesktopWallpaperVtbl struct {
	iUnknownVtbl
	SetWallpaper        uintptr
	GetWallpaper        uintptr
	GetMonitorPathAt    uintptr
	GetMonitorPathCount uintptr
	GetMonitorRECT      uintptr
	SetBackgroundColor  uintptr
	GetBackgroundColor  uintptr
	SetPosition         uintptr
	GetPosition         uintptr
	SetSlideshow        uintptr
	GetSlideshow        uintptr
	SetSlideshowOptions uintptr
	GetSlideshowOptions uintptr
	AdvanceSlideshow    uintptr
	GetStatus           uintptr
	Enable              uintptr
}

type iDesktopWallpaper struct {
	lpVtbl *iDesktopWallpaperVtbl
}

type monitorRect struct {
	Left   int32
	Top    int32
	Right  int32
	Bottom int32
}

var (
	clsidDesktopWallpaper = guid{0xC2CF3110, 0x460E, 0x4FC1, [8]byte{0xB9, 0xD0, 0x8A, 0x1C, 0x0C, 0x9C, 0xC4, 0xBD}}
	iidIDesktopWallpaper  = guid{0xB92B56A9, 0x8B55, 0x4E14, [8]byte{0x9A, 0x89, 0x01, 0x99, 0xBB, 0xB6, 0xF9, 0x3B}}
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	procSystemParameters = user32.NewProc("SystemParametersInfoW")

	ole32              = syscall.NewLazyDLL("ole32.dll")
	procCoInitializeEx = ole32.NewProc("CoInitializeEx")
	procCoUninitialize = ole32.NewProc("CoUninitialize")
	procCoCreateInst   = ole32.NewProc("CoCreateInstance")
	procCoTaskMemFree  = ole32.NewProc("CoTaskMemFree")
)

// setWallpaper updates the wallpaper globally (all monitor indexes) or for
// each monitor index in monitorIndexes.
func setWallpaper(path string, monitorIndexes []int) error {
	if len(monitorIndexes) == 0 {
		return setWallpaperAllMonitors(path)
	}

	unique := make([]int, 0, len(monitorIndexes))
	for _, idx := range monitorIndexes {
		if idx < 0 || slices.Contains(unique, idx) {
			continue
		}
		unique = append(unique, idx)
	}
	if len(unique) == 0 {
		return setWallpaperAllMonitors(path)
	}

	for _, idx := range unique {
		if err := setWallpaperForMonitor(path, idx); err != nil {
			return err
		}
	}

	return nil
}

func setWallpaperAllMonitors(path string) error {
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return fmt.Errorf("invalid wallpaper path: %w", err)
	}

	r, _, callErr := procSystemParameters.Call(
		spiSetDeskWallpaper,
		0,
		uintptr(unsafe.Pointer(pathPtr)),
		spifUpdateIniFile|spifSendChange,
	)
	if r == 0 {
		return fmt.Errorf("SystemParametersInfoW failed: %w", callErr)
	}
	return nil
}

func setWallpaperForMonitor(path string, monitorIndex int) error {
	monitorCount, err := monitorCount()
	if err != nil {
		return err
	}
	if monitorIndex >= monitorCount {
		return fmt.Errorf("monitor index %d out of range (found %d monitor(s))", monitorIndex, monitorCount)
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hr, _, _ := procCoInitializeEx.Call(0, coInitApartmentThreaded)
	if hresultFailed(hr) {
		return fmt.Errorf("CoInitializeEx failed: HRESULT 0x%08X", uint32(hr))
	}
	defer procCoUninitialize.Call()

	wallpaper, err := createDesktopWallpaper()
	if err != nil {
		return err
	}
	defer syscall.SyscallN(
		wallpaper.lpVtbl.Release,
		uintptr(unsafe.Pointer(wallpaper)),
	)

	return setWallpaperWithDesktopWallpaper(wallpaper, path, monitorIndex)
}

func setWallpaperWithDesktopWallpaper(wallpaper *iDesktopWallpaper, path string, monitorIndex int) error {
	if monitorIndex < 0 {
		return fmt.Errorf("monitor index must be >= 0")
	}

	count, err := monitorCountFromDesktopWallpaper(wallpaper)
	if err != nil {
		return err
	}
	if monitorIndex >= count {
		return fmt.Errorf("monitor index %d out of range (found %d monitor(s))", monitorIndex, count)
	}

	var monitorID *uint16
	hr, _, _ := syscall.SyscallN(
		wallpaper.lpVtbl.GetMonitorPathAt,
		uintptr(unsafe.Pointer(wallpaper)),
		uintptr(uint32(monitorIndex)),
		uintptr(unsafe.Pointer(&monitorID)),
	)
	if hresultFailed(hr) {
		return fmt.Errorf("IDesktopWallpaper.GetMonitorDevicePathAt(%d) failed: HRESULT 0x%08X", monitorIndex, uint32(hr))
	}
	defer procCoTaskMemFree.Call(uintptr(unsafe.Pointer(monitorID)))

	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return fmt.Errorf("invalid wallpaper path: %w", err)
	}

	hr, _, _ = syscall.SyscallN(
		wallpaper.lpVtbl.SetWallpaper,
		uintptr(unsafe.Pointer(wallpaper)),
		uintptr(unsafe.Pointer(monitorID)),
		uintptr(unsafe.Pointer(pathPtr)),
	)
	if hresultFailed(hr) {
		return fmt.Errorf("IDesktopWallpaper.SetWallpaper failed: HRESULT 0x%08X", uint32(hr))
	}

	return nil
}

func listMonitorIndexes() ([]int, error) {
	count, err := monitorCount()
	if err != nil {
		return nil, err
	}

	indexes := make([]int, 0, count)
	for i := 0; i < count; i++ {
		indexes = append(indexes, i)
	}
	return indexes, nil
}

func monitorSize(monitorIndex int) (int, int, error) {
	if monitorIndex < 0 {
		return 0, 0, fmt.Errorf("monitor index must be >= 0")
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hr, _, _ := procCoInitializeEx.Call(0, coInitApartmentThreaded)
	if hresultFailed(hr) {
		return 0, 0, fmt.Errorf("CoInitializeEx failed: HRESULT 0x%08X", uint32(hr))
	}
	defer procCoUninitialize.Call()

	wallpaper, err := createDesktopWallpaper()
	if err != nil {
		return 0, 0, err
	}
	defer syscall.SyscallN(
		wallpaper.lpVtbl.Release,
		uintptr(unsafe.Pointer(wallpaper)),
	)

	count, err := monitorCountFromDesktopWallpaper(wallpaper)
	if err != nil {
		return 0, 0, err
	}
	if monitorIndex >= count {
		return 0, 0, fmt.Errorf("monitor index %d out of range (found %d monitor(s))", monitorIndex, count)
	}

	var monitorID *uint16
	hr, _, _ = syscall.SyscallN(
		wallpaper.lpVtbl.GetMonitorPathAt,
		uintptr(unsafe.Pointer(wallpaper)),
		uintptr(uint32(monitorIndex)),
		uintptr(unsafe.Pointer(&monitorID)),
	)
	if hresultFailed(hr) {
		return 0, 0, fmt.Errorf("IDesktopWallpaper.GetMonitorDevicePathAt(%d) failed: HRESULT 0x%08X", monitorIndex, uint32(hr))
	}
	defer procCoTaskMemFree.Call(uintptr(unsafe.Pointer(monitorID)))

	var rect monitorRect
	hr, _, _ = syscall.SyscallN(
		wallpaper.lpVtbl.GetMonitorRECT,
		uintptr(unsafe.Pointer(wallpaper)),
		uintptr(unsafe.Pointer(monitorID)),
		uintptr(unsafe.Pointer(&rect)),
	)
	if hresultFailed(hr) {
		return 0, 0, fmt.Errorf("IDesktopWallpaper.GetMonitorRECT(%d) failed: HRESULT 0x%08X", monitorIndex, uint32(hr))
	}

	width := int(rect.Right - rect.Left)
	height := int(rect.Bottom - rect.Top)
	if width < 1 || height < 1 {
		return 0, 0, fmt.Errorf("invalid monitor size for index %d: %dx%d", monitorIndex, width, height)
	}

	return width, height, nil
}

func monitorCount() (int, error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hr, _, _ := procCoInitializeEx.Call(0, coInitApartmentThreaded)
	if hresultFailed(hr) {
		return 0, fmt.Errorf("CoInitializeEx failed: HRESULT 0x%08X", uint32(hr))
	}
	defer procCoUninitialize.Call()

	wallpaper, err := createDesktopWallpaper()
	if err != nil {
		return 0, err
	}
	defer syscall.SyscallN(
		wallpaper.lpVtbl.Release,
		uintptr(unsafe.Pointer(wallpaper)),
	)

	return monitorCountFromDesktopWallpaper(wallpaper)
}

func createDesktopWallpaper() (*iDesktopWallpaper, error) {
	var wallpaper *iDesktopWallpaper
	hr, _, _ := procCoCreateInst.Call(
		uintptr(unsafe.Pointer(&clsidDesktopWallpaper)),
		0,
		clsctxInprocServer|clsctxLocalServer,
		uintptr(unsafe.Pointer(&iidIDesktopWallpaper)),
		uintptr(unsafe.Pointer(&wallpaper)),
	)
	if hresultFailed(hr) {
		return nil, fmt.Errorf("CoCreateInstance(IDesktopWallpaper) failed: HRESULT 0x%08X", uint32(hr))
	}
	return wallpaper, nil
}

func monitorCountFromDesktopWallpaper(wallpaper *iDesktopWallpaper) (int, error) {
	var monitorCount uint32
	hr, _, _ := syscall.SyscallN(
		wallpaper.lpVtbl.GetMonitorPathCount,
		uintptr(unsafe.Pointer(wallpaper)),
		uintptr(unsafe.Pointer(&monitorCount)),
	)
	if hresultFailed(hr) {
		return 0, fmt.Errorf("IDesktopWallpaper.GetMonitorDevicePathCount failed: HRESULT 0x%08X", uint32(hr))
	}
	return int(monitorCount), nil
}

func hresultFailed(hr uintptr) bool {
	return int32(hr) < 0
}
