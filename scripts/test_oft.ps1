try {
    Write-Host "Starting Outlook COM test..."
    $outlook = New-Object -ComObject Outlook.Application
    Write-Host "Outlook COM object created successfully"
    
    $mail = $outlook.CreateItem(0)  # olMailItem
    Write-Host "Mail item created"
    
    $mail.To = 'test@example.com'
    $mail.Subject = 'Test Subject'
    $mail.HTMLBody = 'Test message content'
    Write-Host "Mail properties set"
    
    $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'test_template.oft')
    Write-Host "Saving to: $tempFile"
    
    $mail.SaveAs($tempFile, 5)  # olTemplate = 5
    Write-Host "SaveAs completed"
    
    if (Test-Path $tempFile) {
        Write-Host "SUCCESS: .oft file created at $tempFile"
        $fileSize = (Get-Item $tempFile).Length
        Write-Host "File size: $fileSize bytes"
        Remove-Item $tempFile -Force
        Write-Host "Test file cleaned up"
    } else {
        Write-Host "FAILED: .oft file was not created"
    }
    
    $mail = $null
    $outlook = $null
    Write-Host "COM objects released"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Full error: $($_.Exception.ToString())"
}
