Write-Host "Creating .oft file with different approach..."

try {
    # Create Outlook application
    $outlook = New-Object -ComObject Outlook.Application
    Write-Host "Outlook COM object created"
    
    # Create mail item
    $mail = $outlook.CreateItem(0)  # olMailItem
    $mail.To = "supplier@example.com"
    $mail.Subject = "Test Purchase Order"
    $mail.HTMLBody = "<p>This is a test .oft template file.</p>"
    Write-Host "Mail item configured"
    
    # Use user's desktop for easier access
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $oftPath = Join-Path $desktopPath "Test_OFT_$timestamp.oft"
    Write-Host "Saving to desktop: $oftPath"
    
    # Try different save format approaches
    try {
        # Method 1: Save as MSG first, then copy to OFT
        $msgPath = Join-Path $desktopPath "temp_message.msg"
        Write-Host "Saving as MSG first..."
        $mail.SaveAs($msgPath, 3)  # olMSG = 3
        
        if (Test-Path $msgPath) {
            Write-Host "MSG file created successfully"
            # Copy and rename to .oft
            Copy-Item $msgPath $oftPath -Force
            Remove-Item $msgPath -Force
            Write-Host "Copied MSG to OFT format"
        }
        
    } catch {
        Write-Host "MSG method failed: $($_.Exception.Message)"
        
        # Method 2: Direct OFT save with error handling
        Write-Host "Trying direct OFT save..."
        $mail.SaveAs($oftPath, 5)  # olTemplate = 5
    }
    
    # Verify and test the file
    if (Test-Path $oftPath) {
        $fileInfo = Get-Item $oftPath
        Write-Host "SUCCESS: File created"
        Write-Host "  Path: $($fileInfo.FullName)"
        Write-Host "  Size: $($fileInfo.Length) bytes"
        
        # Wait a moment for file to be fully written
        Start-Sleep -Seconds 2
        
        Write-Host "Attempting to open file..."
        try {
            # Try opening with Outlook explicitly
            $outlook.CreateItemFromTemplate($oftPath) | Out-Null
            Write-Host "SUCCESS: File opened successfully in Outlook"
        } catch {
            Write-Host "Could not open via COM: $($_.Exception.Message)"
            Write-Host "Trying Start-Process..."
            Start-Process $oftPath -ErrorAction Stop
        }
        
    } else {
        Write-Host "FAILED: File was not created"
    }
    
    # Clean up
    $mail = $null
    $outlook = $null
    Write-Host "COM objects cleaned up"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Full error: $($_.Exception.ToString())"
}
