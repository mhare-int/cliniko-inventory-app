Write-Host "Creating realistic supplier order .oft file..."

try {
    # Create Outlook application
    $outlook = New-Object -ComObject Outlook.Application
    Write-Host "Outlook COM object created"
    
    # Test parameters - realistic supplier order data
    $testEmail = "supplier@healthworld.com"
    $testSubject = "Purchase Order - PUR00456"
    $currentDate = Get-Date -Format 'MMMM dd, yyyy'
    
    # Create comprehensive HTML email content
    $testMessage = @"
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; }
        .header { background-color: #f0f0f0; padding: 15px; border: 1px solid #ccc; margin-bottom: 15px; }
        .order-table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        .order-table th, .order-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .order-table th { background-color: #f2f2f2; font-weight: bold; }
        .total-row { background-color: #f9f9f9; font-weight: bold; }
        .footer { margin-top: 20px; padding: 15px; background-color: #f8f8f8; border: 1px solid #ddd; }
        .supplier-info { background-color: #e8f4fd; padding: 10px; margin: 10px 0; border-left: 4px solid #2196F3; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Purchase Order Request</h2>
        <p><strong>PUR Number:</strong> PUR00456</p>
        <p><strong>Date:</strong> $currentDate</p>
        <p><strong>Your Account Number:</strong> ACC-789456</p>
    </div>
    
    <div class="supplier-info">
        <p><strong>Supplier:</strong> Health World Limited (Metagenics)</p>
        <p><strong>Contact Person:</strong> Supply Manager</p>
        <p><strong>Email:</strong> supplier@healthworld.com</p>
        <p><strong>Special Instructions:</strong> Please ensure all products have minimum 12 months expiry</p>
    </div>
    
    <p>Dear Health World Limited (Metagenics),</p>
    
    <p>Please find our purchase order details below. We would appreciate confirmation of receipt and an estimated delivery date.</p>
    
    <table class="order-table">
        <thead>
            <tr>
                <th>Product Code</th>
                <th>Product Name</th>
                <th>Quantity Ordered</th>
                <th>Unit Price</th>
                <th>Line Total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>META-001</td>
                <td>Ultra Flora Balance 30 Capsules</td>
                <td>12</td>
                <td>`$45.50</td>
                <td>`$546.00</td>
            </tr>
            <tr>
                <td>META-002</td>
                <td>ArginMax 90 Tablets</td>
                <td>8</td>
                <td>`$62.95</td>
                <td>`$503.60</td>
            </tr>
            <tr>
                <td>META-003</td>
                <td>MetaGlycemX 60 Tablets</td>
                <td>15</td>
                <td>`$38.75</td>
                <td>`$581.25</td>
            </tr>
            <tr>
                <td>META-004</td>
                <td>PhytoMulti 120 Tablets</td>
                <td>6</td>
                <td>`$54.20</td>
                <td>`$325.20</td>
            </tr>
            <tr>
                <td>META-005</td>
                <td>OmegaGenics EPA-DHA 720</td>
                <td>10</td>
                <td>`$48.95</td>
                <td>`$489.50</td>
            </tr>
            <tr class="total-row">
                <td colspan="4"><strong>Total Order Value:</strong></td>
                <td><strong>`$2,445.55</strong></td>
            </tr>
        </tbody>
    </table>
    
    <div class="footer">
        <h3>Delivery Information:</h3>
        <p><strong>Delivery Address:</strong><br>
        GoodLife Health & Wellness<br>
        123 Wellness Drive<br>
        Melbourne VIC 3000<br>
        Australia</p>
        
        <p><strong>Delivery Instructions:</strong></p>
        <ul>
            <li>Deliver during business hours: Monday-Friday 9:00 AM - 5:00 PM</li>
            <li>All products must have minimum 12 months expiry from delivery date</li>
            <li>Include batch numbers and expiry dates on all documentation</li>
            <li>Cold chain products to be delivered in temperature-controlled transport</li>
        </ul>
        
        <h3>Contact Information:</h3>
        <p><strong>Purchasing:</strong> purchasing@goodlife.com | +61 3 9876 5432</p>
        <p><strong>Accounts Payable:</strong> accounts@goodlife.com | +61 3 9876 5433</p>
        <p><strong>Warehouse:</strong> warehouse@goodlife.com | +61 3 9876 5434</p>
        
        <h3>Please Confirm:</h3>
        <ul>
            <li>✓ Receipt of this purchase order</li>
            <li>✓ Estimated delivery date</li>
            <li>✓ Any items on backorder or unavailable</li>
            <li>✓ Invoice terms and payment details</li>
            <li>✓ Freight charges (if applicable)</li>
        </ul>
        
        <p style="margin-top: 20px;"><strong>Thank you for your continued partnership.</strong></p>
        
        <p><strong>Best regards,</strong><br>
        Purchasing Department<br>
        GoodLife Health & Wellness<br>
        ABN: 12 345 678 901<br>
        www.goodlifehealth.com.au</p>
    </div>
</body>
</html>
"@

    # Create mail item and set properties
    $mail = $outlook.CreateItem(0)  # olMailItem
    $mail.To = $testEmail
    $mail.Subject = $testSubject
    $mail.HTMLBody = $testMessage
    Write-Host "Comprehensive mail content configured"
    Write-Host "  To: $testEmail"
    Write-Host "  Subject: $testSubject"
    
    # Use user's desktop for easier access
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $oftPath = Join-Path $desktopPath "Supplier_Order_$timestamp.oft"
    Write-Host "Saving to desktop: $oftPath"
    
    # Try different save format approaches
    try {
        # Method 1: Save as MSG first, then copy to OFT
        $msgPath = Join-Path $desktopPath "temp_order_$timestamp.msg"
        Write-Host "Saving as MSG first..."
        $mail.SaveAs($msgPath, 3)  # olMSG = 3
        
        if (Test-Path $msgPath) {
            Write-Host "MSG file created successfully"
            # Copy and rename to .oft
            Copy-Item $msgPath $oftPath -Force
            Remove-Item $msgPath -Force
            Write-Host "Converted MSG to OFT format"
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
        Write-Host "SUCCESS: Comprehensive supplier order template created"
        Write-Host "  Path: $($fileInfo.FullName)"
        Write-Host "  Size: $($fileInfo.Length) bytes"
        
        # Wait a moment for file to be fully written
        Start-Sleep -Seconds 2
        
        Write-Host "Attempting to open supplier order template..."
        try {
            # Try opening with Outlook explicitly
            $newMail = $outlook.CreateItemFromTemplate($oftPath)
            Write-Host "SUCCESS: Supplier order template opened in Outlook"
            Write-Host "Check Outlook for the new message with comprehensive order details!"
        } catch {
            Write-Host "Could not open via COM, trying Start-Process..."
            Start-Process $oftPath
        }
        
    } else {
        Write-Host "FAILED: OFT file was not created"
    }
    
    # Clean up
    $mail = $null
    $outlook = $null
    Write-Host "COM objects cleaned up"
    
    Write-Host ""
    Write-Host "=== TEST COMPLETED ==="
    Write-Host "The supplier order template should now be open in Outlook."
    Write-Host "It includes:"
    Write-Host "- Professional header with PUR number and date"
    Write-Host "- Supplier contact information"
    Write-Host "- Detailed product table with pricing"
    Write-Host "- Delivery instructions"
    Write-Host "- Contact information"
    Write-Host "- Confirmation checklist"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Full error: $($_.Exception.ToString())"
}
