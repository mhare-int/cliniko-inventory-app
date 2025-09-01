<#
Run database migrations on a remote/installed machine.

Usage:
  .\run_migrations_remote.ps1 [-ExePath <path-to-exe>] [-DbPath <path-to-appdata.db>] [-LogPath <path-to-log>]

Behavior:
  1) If -ExePath is provided (or the script finds the installed exe under Program Files), it will run the exe with --migrate-only and capture output.
  2) If that fails or no exe is available, the script prints instructions to run the included Node migration runner. The Node runner requires Node.js and a copy of `migrations.js` alongside it.

Notes:
  - The packaged app must be the version that includes the --migrate-only flag (v3.0.2+).
  - If you choose the Node runner path, copy `run_migrations_copy.js` and `migrations.js` (from the app or repo) to the target machine and run: `node run_migrations_copy.js --db "C:\path\to\appdata.db"`
  - Always create or preserve backups. The migrate-only mode performs a backup before changing the DB.
#>

param(
  [string]$ExePath,
  [string]$DbPath,
  [string]$LogPath = "$PSScriptRoot\migration-run.log"
)

function Write-Log($msg) {
  $line = "[$((Get-Date).ToString('s'))] $msg"
  Write-Output $line
  Add-Content -Path $LogPath -Value $line
}

Write-Log "Starting migration helper script"

if (-not $ExePath) {
  # Try common install locations
  $candidates = @(
    "$Env:ProgramFiles\Good Life Clinic\Good Life Clinic - Inventory Management.exe",
    "$Env:ProgramFiles(x86)\Good Life Clinic\Good Life Clinic - Inventory Management.exe",
    "$Env:ProgramFiles\Good Life Clinic - Inventory Management\Good Life Clinic - Inventory Management.exe",
    "$Env:ProgramFiles(x86)\Good Life Clinic - Inventory Management\Good Life Clinic - Inventory Management.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $ExePath = $c; break }
  }
}

if ($ExePath) {
  Write-Log "Found executable: $ExePath"
  Write-Log "Running: $ExePath --migrate-only"
  try {
    $proc = Start-Process -FilePath $ExePath -ArgumentList '--migrate-only' -PassThru -Wait -NoNewWindow -RedirectStandardOutput ($LogPath) -RedirectStandardError ($LogPath)
    $exit = $proc.ExitCode
    if ($exit -eq 0) {
      Write-Log "Migration completed successfully (exit code 0). See log: $LogPath"
      exit 0
    } else {
      Write-Log "Migration process exited with code $exit. Check $LogPath for details. Falling back to Node runner instructions."
    }
  } catch {
    Write-Log "Failed to run executable: $_. Exception: $($_.Exception.Message)"
  }
} else {
  Write-Log "No installed executable found. Will show Node runner instructions."
}

Write-Log "--- FALLBACK: Node migration runner instructions ---"
Write-Log "If you have Node.js installed on this machine, use the included Node runner to apply migrations against a DB file." 
Write-Log "Steps:"
Write-Log "  1) Copy these files to the target machine in the same folder:"
Write-Log "       - run_migrations_copy.js  (this repo's tools folder)"
Write-Log "       - migrations.js           (from the app's backend folder; ensure it's the same version as the app)"
Write-Log "  2) Open PowerShell as the user who owns the DB file and run:" 
Write-Log "       node .\run_migrations_copy.js --db \"C:\path\to\appdata.db\""
Write-Log "  3) The script will create a backup next to the DB and run migrations. Logs will be printed to the console."

if ($DbPath) {
  Write-Log "Optional: you provided -DbPath = $DbPath. To run the Node runner locally, execute:"
  Write-Log "  node .\run_migrations_copy.js --db \"$DbPath\""
}

Write-Log "Script finished."
