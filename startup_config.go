package main

import "fmt"

func applyRunOnStartupSetting(exePath string, enabled bool) error {
	if err := setRunOnStartupEnabled(exePath, enabled); err != nil {
		return fmt.Errorf("apply run-on-startup setting: %w", err)
	}
	return nil
}

func persistRunOnStartupSetting(configPath string, enabled bool) error {
	cfg, err := loadAppConfig(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	cfg.RunOnStartup = enabled
	if err := saveAppConfig(configPath, cfg); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	return nil
}
