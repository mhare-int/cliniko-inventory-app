# Migration Test Script for Windows
# Usage: .\test_migration.ps1 [path-to-database]

param(
    [string]$DatabasePath = ""
)

Write-Host "Cliniko Inventory App - Migration Test Tool" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Please install Node.js and try again." -ForegroundColor Red
    exit 1
}

# Default to current directory's backend database
if ($DatabasePath -eq "") {
    $DatabasePath = "backend\appdata.db"
}

# Check if database exists
if (!(Test-Path $DatabasePath)) {
    Write-Host "Database not found: $DatabasePath" -ForegroundColor Red
    Write-Host "Available options:" -ForegroundColor Yellow
    Write-Host "  1. Test with simulated 2.0.1 database:" -ForegroundColor White
    Write-Host "     node tools/test_migration_from_201.js" -ForegroundColor Cyan
    Write-Host "  2. Analyze your database:" -ForegroundColor White  
    Write-Host "     .\test_migration.ps1 'C:\path\to\your\database.db'" -ForegroundColor Cyan
    exit 1
}

Write-Host "Testing database: $DatabasePath" -ForegroundColor Blue

# Run the migration test
Write-Host "Running migration analysis..." -ForegroundColor Yellow
try {
    node tools/fix_migration.js $DatabasePath
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration test completed successfully!" -ForegroundColor Green
        Write-Host "Your database should be compatible with the latest version." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Migration test failed!" -ForegroundColor Red
        Write-Host "Please check the error messages above and refer to MIGRATION_GUIDE.md" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error running migration test: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "For more information, see MIGRATION_GUIDE.md" -ForegroundColor Blue
