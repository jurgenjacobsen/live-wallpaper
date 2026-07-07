//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

const splashScript = `
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        WindowStartupLocation="CenterScreen" WindowStyle="None" ResizeMode="NoResize"
        ShowInTaskbar="False" AllowsTransparency="True" Background="Transparent"
        Width="620" Height="340">
  <Border CornerRadius="18" BorderThickness="1" BorderBrush="#355570" Background="#F4121A2A" Padding="28">
    <Grid>
      <Grid.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
          <GradientStop Color="#F40A0F1C" Offset="0"/><GradientStop Color="#F4101728" Offset="0.5"/><GradientStop Color="#F40B1322" Offset="1"/>
        </LinearGradientBrush>
      </Grid.Background>
      <StackPanel VerticalAlignment="Center">
        <Border Width="76" Height="76" CornerRadius="16" BorderThickness="1" BorderBrush="#4B9AD5" Background="#FF17324A" HorizontalAlignment="Left">
            <TextBlock Text="LW" Foreground="#FFE7F1FB" FontSize="24" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
        </Border>
        <TextBlock Margin="0,18,0,0" Text="Live Wallpaper" Foreground="#FFF4F8FC" FontSize="30" FontWeight="SemiBold"/>
        <TextBlock Margin="0,10,0,0" Text="Loading core modules..." Foreground="#FFC8D6E8" FontSize="15"/>
      </StackPanel>
    </Grid>
  </Border>
</Window>
"@
$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)
$window.ShowDialog()
`

func showSplashWindow() (func(), error) {
	psExe, err := resolvePowerShellExe()
	if err != nil {
		return nil, err
	}

	tmpDir := os.TempDir()
	scriptPath := filepath.Join(tmpDir, "live-wallpaper-splash.ps1")
	if writeErr := os.WriteFile(scriptPath, []byte(splashScript), 0600); writeErr != nil {
		return nil, fmt.Errorf("write splash script: %w", writeErr)
	}

	cmd := exec.Command(psExe, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	if startErr := cmd.Start(); startErr != nil {
		_ = os.Remove(scriptPath)
		return nil, fmt.Errorf("start splash window: %w", startErr)
	}

	closeFn := func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			_, _ = cmd.Process.Wait()
		}
		_ = os.Remove(scriptPath)
	}

	return closeFn, nil
}

func resolvePowerShellExe() (string, error) {
	if path, err := exec.LookPath("powershell.exe"); err == nil {
		return path, nil
	}
	if path, err := exec.LookPath("pwsh.exe"); err == nil {
		return path, nil
	}
	return "", fmt.Errorf("powershell executable not found")
}
