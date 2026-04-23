package main

type trayCallbacks struct {
	OpenSettings         func()
	OpenLogs             func()
	CheckUpdates         func()
	UpdateNow            func()
	Restart              func()
	Shutdown             func()
	GetRunOnStartupState func() (bool, error)
	ToggleRunOnStartup   func() (bool, error)
}
