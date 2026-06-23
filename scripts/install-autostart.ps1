# VoC 트레이를 Windows 로그인 시 자동 시작으로 등록
# 실행: powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ps1 = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "voc-tray.ps1"
$startupDir = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir "VoC데몬트레이.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = "powershell.exe"
$sc.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ps1`" -Token gobangMKT"
$sc.WorkingDirectory = Split-Path $ps1
$sc.Save()

Write-Host "✅ 자동 시작 등록 완료: $shortcutPath"
Write-Host "다음 로그인부터 VoC 트레이가 자동 실행됩니다."
