package main

type trayCallbacks struct {
	OpenSettings func()
	OpenLogs     func()
	UpdateNow    func()
	Restart      func()
	Shutdown     func()
}
