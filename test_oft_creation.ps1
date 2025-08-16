try {
    Write-Host "=== Testing .oft file creation ==="
    
    # Test parameters
    $testEmail = "supplier@example.com"
    $testSubject = "Purchase Order - PUR00123"
    $testMessage = @"
<html>
<body>
<h2>Purchase Order Request</h2>
<p>Dear Supplier,</p>
<p>Please find our purchase order details below:</p>
<table border="1" style="border-collapse: collapse;">
<tr><th>Product</th><th>Quantity</th></tr>
<tr><td>Test Product 1</td><td>5</td></tr>
<tr><td>Test Product 2</td><td>3</td></tr>
</table>
<p>Please confirm receipt and provide delivery estimate.</p>
<p>Best regards,<br>Your Company</p>
</body>
</html>
"@
    
    # Output location - save to Documents folder for easy access
    $documentsPath = [Environment]::GetFolderPath("MyDocuments")
    $outputFile = Join-Path $documentsPath "Test_Supplier_Template.oft"
    
    Write-Host "Creating test .oft file..."
    Write-Host "Output location: $outputFile"
    
    # Create Outlook COM object
    Write-Host "Connecting to Outlook..."
    $outlook = New-Object -ComObject Outlook.Application
    Write-Host "✓ Outlook COM object created"
    
    # Create mail item
    $mail = $outlook.CreateItem(0)  # olMailItem = 0
    Write-Host "✓ Mail item created"
    
    # Set mail properties
    $mail.To = $testEmail
    $mail.Subject = $testSubject
    $mail.HTMLBody = $testMessage
    Write-Host "✓ Mail properties set"
    Write-Host "  To: $testEmail"
    Write-Host "  Subject: $testSubject"
    
    # Save as .oft template
    Write-Host "Saving as .oft template..."
    $mail.SaveAs($outputFile, 5)  # olTemplate = 5
    Write-Host "✓ SaveAs operation completed"
    
    # Verify file was created
    if (Test-Path $outputFile) {
        $fileInfo = Get-Item $outputFile
        Write-Host "✓ SUCCESS: .oft file created!"
        Write-Host "  File: $($fileInfo.FullName)"
        Write-Host "  Size: $($fileInfo.Length) bytes"
        Write-Host "  Created: $($fileInfo.CreationTime)"
        
        # Try to open the file (this will open it in Outlook)
        Write-Host ""
        Write-Host "Opening .oft file in Outlook..."
        Start-Process $outputFile
        Write-Host "✓ File opened - check Outlook for the template!"
        
    } else {
        Write-Host "✗ FAILED: .oft file was not created"
        throw "File not found after SaveAs operation"
    }
    
    # Clean up COM objects
    $mail = $null
    $outlook = $null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($outlook) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    Write-Host "✓ COM objects cleaned up"
    
    Write-Host ""
    Write-Host "=== TEST COMPLETED SUCCESSFULLY ==="
    Write-Host "The .oft file should now be open in Outlook as a new message template."
    Write-Host "You can modify it and send it, or close it to test the template functionality."
    
} catch {
    Write-Host "✗ ERROR: $($_.Exception.Message)"
    Write-Host "Full error details:"
    Write-Host $_.Exception.ToString()
    
    # Clean up on error
    if ($mail) { $mail = $null }
    if ($outlook) { 
        $outlook = $null 
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($outlook) | Out-Null
    }
}
