$exe = Join-Path (Get-Location) 'dist\win-unpacked\Good Life Clinic - Inventory Management.exe'
if (Test-Path $exe) {
  Write-Output "Found EXE: $exe"
  $p = Start-Process -FilePath $exe -ArgumentList '--enable-logging','--no-sandbox' -PassThru
  Start-Sleep -Seconds 5
  if ($p.HasExited) {
    Write-Output "PROCESS_EXITED"
    Write-Output ("ExitCode:" + $p.ExitCode)
  } else {
    Write-Output ("PROCESS_RUNNING; Id:" + $p.Id)
  }
} else {
  Write-Output "EXE_NOT_FOUND"
}

Write-Output "--- APPDATA PATH ---"
$appd = $env:APPDATA
Write-Output $appd
Write-Output "Listing candidate user data folders:"
Get-ChildItem -Path (Join-Path $appd '*Good Life*') -ErrorAction SilentlyContinue | ForEach-Object { Write-Output $_.FullName }

Write-Output "--- TAIL local backend/backend.log ---"
if (Test-Path '.\backend\backend.log') { Get-Content .\backend\backend.log -Tail 200 } else { Write-Output 'No local backend/backend.log' }
