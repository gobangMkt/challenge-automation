param([string]$Token = "gobangMKT")

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir   = Split-Path -Parent $ScriptDir
$DaemonScript = Join-Path $ScriptDir "voc-daemon.mjs"
$HealthUrl    = "http://127.0.0.1:3061/health"
$StopUrl      = "http://127.0.0.1:3061/stop"

$daemon = $null

function Is-Running {
  try {
    $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
    return $r.StatusCode -eq 200
  } catch { return $false }
}

function Start-Daemon {
  if (Is-Running) { return }
  $env:OPERATOR_TOKEN = $Token
  $global:daemon = Start-Process `
    -FilePath "node" `
    -ArgumentList "`"$DaemonScript`"" `
    -WorkingDirectory $ProjectDir `
    -PassThru -WindowStyle Hidden
  Start-Sleep -Milliseconds 1500
  Update-Tray
  $tray.ShowBalloonTip(2000, "VoC Daemon", "Started", [System.Windows.Forms.ToolTipIcon]::Info)
}

function Stop-Daemon {
  try {
    Invoke-WebRequest -Uri $StopUrl -Method POST -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
  } catch {}
  if ($global:daemon -and !$global:daemon.HasExited) { $global:daemon.Kill() }
  Start-Sleep -Milliseconds 500
  Update-Tray
  $tray.ShowBalloonTip(2000, "VoC Daemon", "Stopped", [System.Windows.Forms.ToolTipIcon]::Info)
}

function Update-Tray {
  $running = Is-Running
  $tray.Text = if ($running) { "VoC Daemon - Running" } else { "VoC Daemon - Stopped" }
  $startItem.Enabled = -not $running
  $stopItem.Enabled  = $running
}

$tray         = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon    = [System.Drawing.SystemIcons]::Information
$tray.Text    = "VoC Daemon"
$tray.Visible = $true

$menu       = New-Object System.Windows.Forms.ContextMenuStrip
$startItem  = $menu.Items.Add("Start")
$stopItem   = $menu.Items.Add("Stop")
$menu.Items.Add("-") | Out-Null
$statusItem = $menu.Items.Add("Refresh")
$menu.Items.Add("-") | Out-Null
$exitItem   = $menu.Items.Add("Exit")

$startItem.add_Click({ Start-Daemon })
$stopItem.add_Click({ Stop-Daemon })
$statusItem.add_Click({ Update-Tray })
$exitItem.add_Click({
  Stop-Daemon
  $tray.Visible = $false
  [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ if (Is-Running) { Stop-Daemon } else { Start-Daemon } })

Start-Daemon

[System.Windows.Forms.Application]::Run()
