import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function GenerateSupplierFiles() {
  const navigate = useNavigate();
  const [activePRs, setActivePRs] = useState([]);
  const [selectedPRId, setSelectedPRId] = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [checkingApiKey, setCheckingApiKey] = useState(true);
  const [emailMode, setEmailMode] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [emailSettings, setEmailSettings] = useState({
    subject: "",
    message: "",
    signature: "",
    vendorEmails: {}
  });
  const [sendingEmails, setSendingEmails] = useState(false);
  const [createFiles, setCreateFiles] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  // Fetch API key status
  useEffect(() => {
    async function fetchApiKey() {
      setCheckingApiKey(true);
      try {
        if (window.api && window.api.getApiKey) {
          const res = await window.api.getApiKey();
          setApiKeySet(!!(res && res.api_key));
        } else {
          setApiKeySet(false);
        }
      } catch {
        setApiKeySet(false);
      }
      setCheckingApiKey(false);
    }
    fetchApiKey();
  }, []);

  // Fetch active PRs on mount and load saved output folder
  useEffect(() => {
    // Load saved output folder from localStorage
    const savedFolder = localStorage.getItem('supplierFiles_outputFolder');
    if (savedFolder) {
      setOutputFolder(savedFolder);
    }

    if (!window.api || !window.api.getPurchaseRequests) return;
    window.api.getPurchaseRequests(true, undefined)
      .then(res => {
        setActivePRs(res);
        // Auto-select the highest PUR number (most recent)
        if (res && res.length > 0) {
          // Sort by ID to find the highest (assuming ID format like PUR00001, PUR00002, etc.)
          const sortedPRs = [...res].sort((a, b) => {
            const idA = (a.id || a._id || '').toString();
            const idB = (b.id || b._id || '').toString();
            return idB.localeCompare(idA);
          });
          const highestPR = sortedPRs[0];
          setSelectedPRId((highestPR.id || highestPR._id).toString());
        }
      })
      .catch(() => setActivePRs([]));
  }, []);

  // Load existing files when PR selection or output folder changes
  useEffect(() => {
    if (selectedPRId && outputFolder) {
      loadExistingFiles(selectedPRId);
    } else {
      // Clear download links if no PR selected or no output folder
      setDownloadLinks([]);
    }
  }, [selectedPRId, outputFolder]);

  const handlePickFolder = async () => {
    if (window.api && window.api.pickFolder) {
      const folder = await window.api.pickFolder();
      if (folder) {
        setOutputFolder(folder);
        // Save to localStorage for future use
        localStorage.setItem('supplierFiles_outputFolder', folder);
      }
    } else {
      alert("Folder picker not available in this build.");
    }
  };

  // Load existing files for the selected purchase request
  const loadExistingFiles = async (prId) => {
    if (!prId || !outputFolder) {
      console.log('🔍 loadExistingFiles called but missing prId or outputFolder:', { prId, outputFolder });
      return;
    }
    
    console.log('🔍 loadExistingFiles called with:', { prId, outputFolder });
    
    try {
      // Get all generated files for this PR (both Excel and .oft files)
      const generatedFiles = await window.api.getGeneratedFiles(prId);
      console.log('🔍 Raw generatedFiles from API:', generatedFiles);
      
      if (generatedFiles && generatedFiles.length > 0) {
        console.log('📁 Found existing generated files:', generatedFiles);
        
        // Create download links for existing files using stored filenames
        const existingFileLinks = [];
        
        for (const fileRecord of generatedFiles) {
          console.log('🔍 Processing file record:', fileRecord);
          
          if (fileRecord.filename) {
            // Use the stored filename and path
            const filePath = fileRecord.file_path || `${outputFolder}/${fileRecord.filename}`;
            
            // Verify the file still exists
            try {
              const fileExists = await window.api.fileExists(filePath);
              if (fileExists) {
                console.log(`✅ Found existing ${fileRecord.file_type} file from database:`, fileRecord.filename);
                existingFileLinks.push({
                  file: fileRecord.filename,
                  path: filePath,
                  vendor: fileRecord.vendor_name,
                  type: fileRecord.file_type === 'oft' ? 'email' : 'file',
                  isOutlookTemplate: fileRecord.file_type === 'oft',
                  fileType: fileRecord.file_type,
                  fileSize: fileRecord.file_size,
                  createdAt: fileRecord.created_at
                });
              } else {
                console.log('⚠️ File exists in database but not on disk:', filePath);
              }
            } catch (error) {
              console.log('❌ Error verifying file exists:', filePath, error);
            }
          } else {
            console.log('⚠️ File record has no filename stored:', fileRecord);
          }
        }
        
        console.log('📎 Total existing file links found:', existingFileLinks.length);
        if (existingFileLinks.length > 0) {
          console.log('📎 Loading existing files into download links:', existingFileLinks);
          setDownloadLinks(existingFileLinks);
        } else {
          console.log('📎 No existing files found or verified');
        }
      } else {
        console.log('📁 No existing generated files found in database');
      }
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  const handleCreateSupplierOrderFilesFromPR = async () => {
    setError("");
    setDownloadLinks([]);
    if (!selectedPRId) {
      setError("Please select a Purchase Order to send orders to suppliers.");
      return;
    }
    if (!outputFolder) {
      setError("Please select an output folder for the template files.");
      return;
    }
    setLoading(true);
    try {
      const pr = activePRs.find(pr => (pr.id || pr._id).toString() === selectedPRId);
      if (!pr || !pr.items || pr.items.length === 0) throw new Error("Selected PR has no items.");
      
      // Define purNumber at the top so it's available throughout the function
      const purNumber = pr.name || pr.number || pr.id || pr._id || "";
      
      // Create vendor groups for email template variables
      const vendorGroups = {};
      pr.items.forEach(item => {
        const supplierName = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
        if (!vendorGroups[supplierName]) {
          vendorGroups[supplierName] = [];
        }
        vendorGroups[supplierName].push(item);
      });
      
      let files = [];
      
      if (createFiles) {
        // Check if Excel files already exist for this PR
        console.log('🔍 Checking for existing Excel files for PR:', pr.id);
        const existingExcelFiles = await window.api.getGeneratedFiles(pr.id, 'excel');
        
        if (existingExcelFiles && existingExcelFiles.length > 0) {
          console.log('⚠️ Excel files already exist for this PR, skipping creation to avoid duplicates');
          console.log('📁 Existing Excel files:', existingExcelFiles.map(f => f.filename));
          
          // Use existing files instead of creating new ones
          files = existingExcelFiles.map(f => ({
            file: f.filename,
            supplier: f.vendor_name
          }));
          
          alert("Excel files already exist for this Purchase Order. Using existing files.");
        } else {
          console.log('✅ No existing Excel files found, creating new ones');
          
          // Create the actual files
          if (!window.api || !window.api.createSupplierOrderFilesForVendors) throw new Error("createSupplierOrderFilesForVendors not available");
          const vendorItems = pr.items.map(item => ({
            "PUR Number": purNumber,
            "Product Name": item["Product Name"] || item.name,
            "Supplier Name": item["Supplier Name"] || item.supplier_name || "Unknown Supplier",
            "No. to Order": item["No. to Order"] ?? item.no_to_order ?? 0
          }));
          const res = await window.api.createSupplierOrderFilesForVendors(vendorItems, outputFolder);
          // Accept both array of strings or array of {supplier, file}
          if (res && Array.isArray(res.files)) {
            files = res.files.map(f => {
              if (typeof f === 'string') return { file: f };
              if (f && typeof f === 'object' && f.file) return f;
              return { file: String(f) };
            });
          }
          alert("Orders sent to suppliers successfully!");
          
          // Track Excel files in the database
          if (res && Array.isArray(res.files) && res.files.length > 0) {
            try {
              for (const fileInfo of res.files) {
                const supplierName = fileInfo.supplier || 'Unknown Supplier';
                const filename = fileInfo.file || 'Unknown File';
                const fullPath = `${outputFolder}/${filename}`;
                
                // Get file size if possible
                let fileSize = 0;
                try {
                  if (window.api.getFileStats) {
                    const stats = await window.api.getFileStats(fullPath);
                    fileSize = stats?.size || 0;
                  }
                } catch (sizeErr) {
                  console.warn('Could not get file size for:', fullPath);
                }
                
                await window.api.markVendorFilesCreated(pr.id, supplierName, 'excel', filename, fullPath, fileSize);
                console.log(`✅ Tracked Excel file: ${filename} for ${supplierName}`);
              }
            } catch (trackErr) {
              console.error('❌ Failed to track Excel files:', trackErr);
            }
          }
          
          // Update purchase request status to mark supplier files as created
          if (pr && pr.id && window.api.updatePurchaseRequestSupplierFilesStatus) {
            try {
              await window.api.updatePurchaseRequestSupplierFilesStatus(pr.id, true);
              console.log('✅ Marked purchase request as having supplier files created');
            } catch (statusErr) {
              console.error('❌ Failed to update supplier files status:', statusErr);
            }
          }
        }
      } else {
        // Don't create virtual file entries when files aren't actually created
        files = [];
        // Automatically create email templates when not creating CSV files
        alert("Preparing email templates...");
      }
      
      setDownloadLinks(files);
      
      // Load saved email template or use defaults
      let defaultSubject = `Purchase Order - ${purNumber}`;
      let defaultMessage = `Dear Supplier,

Please find attached our purchase order ${purNumber}.

Could you please confirm receipt and provide an estimated delivery date?`;
      let defaultSignature = `Thank you for your continued service.

Best regards,
The Good Life Clinic`;

      try {
        const savedTemplate = await window.api.getEmailTemplate();
        if (savedTemplate && !savedTemplate.error) {
          // Use saved template
          defaultSubject = savedTemplate.subject || defaultSubject;
          defaultMessage = savedTemplate.body || defaultMessage;
          defaultSignature = savedTemplate.signature || defaultSignature;
        }
      } catch (error) {
        console.error('Error loading email template:', error);
        // Fall back to hardcoded defaults if template loading fails
      }

      // Extract vendor emails from vendor groups and populate from suppliers database
      const vendorEmailsObj = {};
      for (const vendorName of Object.keys(vendorGroups)) {
        // Skip "Unknown Supplier" entries
        if (vendorName === "Unknown Supplier") {
          vendorEmailsObj[vendorName] = { email: "", contactName: "", special_instructions: "", comments: "" };
          continue;
        }
        
        // Try to get email from suppliers database using the exact vendor name from the items
        try {
          const supplier = await window.api.getSupplierByName(vendorName);
          const supplierEmail = (supplier && supplier.email) ? supplier.email : "";
          const contactName = (supplier && supplier.contact_name) ? supplier.contact_name : "";
          const specialInstructions = (supplier && supplier.special_instructions) ? supplier.special_instructions : "";
          
          vendorEmailsObj[vendorName] = {
            email: supplierEmail,
            contactName: contactName,
            special_instructions: specialInstructions,
            comments: supplier?.comments || ""
          };
        } catch (err) {
          console.error(`Error getting supplier details for ${vendorName}:`, err);
          vendorEmailsObj[vendorName] = { email: "", contactName: "", special_instructions: "", comments: "" }; // Empty if supplier not found
        }
      }

      // Function to replace template variables with actual values
      const replaceTemplateVariables = (text, supplierName = '') => {
        // Create order table for this supplier using vendorGroups
        const orderTableContent = supplierName && vendorGroups[supplierName] ? 
          'ORDER DETAILS:\n==========================================\nProduct Name                    Quantity\n==========================================\n' + 
          vendorGroups[supplierName].map(item => {
            const productName = item["Product Name"] || item.name || "Unknown Product";
            const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
            return `${productName.padEnd(30)} ${quantity}`;
          }).join('\n') + 
          '\n==========================================' : '';

        return text
          // Double brace variables (new format)
          .replace(/\{\{orderNumber\}\}/g, purNumber)
          .replace(/\{\{supplierName\}\}/g, supplierName)
          .replace(/\{\{supplierEmail\}\}/g, vendorEmailsObj[supplierName]?.email || '')
          .replace(/\{\{supplierContactName\}\}/g, vendorEmailsObj[supplierName]?.contactName || '')
          .replace(/\{\{supplierInstructions\}\}/g, vendorEmailsObj[supplierName]?.special_instructions || vendorEmailsObj[supplierName]?.comments || '')
          .replace(/\{\{orderTable\}\}/g, orderTableContent)
          .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
          .replace(/\{\{companyName\}\}/g, 'The Good Life Clinic')
          // Single brace variables (backward compatibility)
          .replace(/\{purchaseOrderNumber\}/g, purNumber)
          .replace(/\{supplierName\}/g, supplierName)
          .replace(/\{contactName\}/g, vendorEmailsObj[supplierName]?.contactName || '')
          .replace(/\{date\}/g, new Date().toLocaleDateString())
          .replace(/\{companyName\}/g, 'The Good Life Clinic');
      };

      // Replace variables in the templates for display (no longer needed since we don't show the template)
      // Just store vendor emails for email sending
      setEmailSettings({
        vendorEmails: vendorEmailsObj
      });
      
      // When not creating files, automatically create email templates
      if (!createFiles) {
        setEmailMode(true);
        // Directly create email templates
        try {
          // Load email template
          let defaultSubject = `Purchase Order - ${purNumber}`;
          let defaultMessage = `Dear Supplier,

Please find attached our purchase order ${purNumber}.

Could you please confirm receipt and provide an estimated delivery date?`;
          let defaultSignature = `Thank you for your continued service.

Best regards,
The Good Life Clinic`;

          try {
            const savedTemplate = await window.api.getEmailTemplate();
            if (savedTemplate && !savedTemplate.error) {
              defaultSubject = savedTemplate.subject || defaultSubject;
              defaultMessage = savedTemplate.body || defaultMessage;
              defaultSignature = savedTemplate.signature || defaultSignature;
            }
          } catch (error) {
            console.error('Error loading email template:', error);
          }

          // Create email data directly from vendor groups
          console.log('🎯 FOUND THE CULPRIT! Creating email data from vendor groups');
          console.log('🎯 vendorGroups keys:', Object.keys(vendorGroups));
          const emailData = Object.keys(vendorGroups).map(vendorName => {
            console.log('🎯 Processing vendor from groups:', JSON.stringify(vendorName));
            const vendorInfo = vendorEmailsObj[vendorName] || {};
            const vendorItems = vendorGroups[vendorName];
            console.log('🎯 Vendor items count:', vendorItems?.length || 0);
            
            // Create replacement function for this supplier
            const replaceVarsForSupplier = (text) => {
              const orderTableContent = vendorItems.length > 0 ? 
                `<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
                  <tr style="background-color: #f0f0f0;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product Name</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th>
                  </tr>` + 
                vendorItems.map(item => {
                  const productName = item["Product Name"] || item.name || "Unknown Product";
                  const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
                  return `<tr><td style="border: 1px solid #ddd; padding: 8px;">${productName}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${quantity}</td></tr>`;
                }).join('') + 
                '</table>' : '';

              return text
                .replace(/\{\{orderNumber\}\}/g, purNumber)
                .replace(/\{\{supplierName\}\}/g, vendorName)
                .replace(/\{\{supplierEmail\}\}/g, vendorInfo.email || '')
                .replace(/\{\{supplierContactName\}\}/g, vendorInfo.contactName || '')
                .replace(/\{\{supplierInstructions\}\}/g, vendorInfo.special_instructions || vendorInfo.comments || '')
                .replace(/\{\{orderTable\}\}/g, orderTableContent)
                .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
                .replace(/\{\{companyName\}\}/g, 'The Good Life Clinic')
                .replace(/\{purchaseOrderNumber\}/g, purNumber)
                .replace(/\{supplierName\}/g, vendorName)
                .replace(/\{contactName\}/g, vendorInfo.contactName || '')
                .replace(/\{date\}/g, new Date().toLocaleDateString())
                .replace(/\{companyName\}/g, 'The Good Life Clinic');
            };

            const supplierSpecificSubject = replaceVarsForSupplier(defaultSubject);
            const supplierSpecificMessage = replaceVarsForSupplier(defaultMessage);
            const supplierSpecificSignature = replaceVarsForSupplier(defaultSignature);

            const finalEmailMessage = `
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; line-height: 1.4; margin: 0; padding: 20px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f0f0f0; text-align: center; }
p { margin: 8px 0; }
</style>
</head>
<body>
${supplierSpecificMessage}
${supplierSpecificSignature}
</body>
</html>
            `.trim();

            return {
              vendorName,
              email: typeof vendorInfo === 'string' ? vendorInfo : (vendorInfo.email || ""),
              subject: supplierSpecificSubject,
              message: finalEmailMessage,
              fallbackMessage: finalEmailMessage,
              attachmentFile: null // No attachments when not creating files
            };
          }).filter(email => email.email.trim() !== "");

          // When not creating files, always show email setup for review/editing
          setLoading(false);
          setEmailMode(true);
          
          // Populate the initial email settings for all suppliers with existing emails or blank
          const emailSetup = {};
          for (const vendorName of Object.keys(vendorGroups)) {
            const vendorInfo = vendorEmailsObj[vendorName];
            const existingEmail = typeof vendorInfo === 'string' ? vendorInfo : (vendorInfo?.email || "");
            const existingContact = typeof vendorInfo === 'object' ? (vendorInfo?.contactName || "") : "";
            
            emailSetup[vendorName] = { 
              email: existingEmail, 
              contactName: existingContact 
            };
          }
          setEmailSettings(prev => ({
            ...prev,
            vendorEmails: emailSetup
          }));
          
          setDownloadLinks([{ 
            type: 'placeholder', 
            vendor: 'Email Setup', 
            path: '',
            filename: 'Email Setup' 
          }]);
          return;

        } catch (emailError) {
          console.error('Error creating email templates:', emailError);
          setError("Failed to create email templates: " + (emailError.message || emailError));
        }
      } else {
        // For CSV file creation, just set email mode for manual email sending later
        setEmailMode(false);
      }
    } catch (err) {
      setError(
        err?.error || err?.message ||
        "Something went wrong while sending orders to suppliers."
      );
    }
    setLoading(false);
  };

  const handleDownloadAll = () => {
    downloadLinks.forEach(async file => {
      if (!window.api || !window.api.downloadFile) return;
      try {
        const filePath = await window.api.downloadFile(file.file);
        window.open(filePath);
      } catch (e) {}
    });
  };

  // Delete a generated file from database and filesystem
  const handleDeleteFile = async (file, fileIndex) => {
    if (!window.confirm(`Are you sure you want to delete "${file.file}"?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting file:', file);
      
      // Delete from database if we have the necessary info
      if (file.vendor && file.fileType && selectedPRId) {
        const success = await window.api.deleteGeneratedFile(selectedPRId, file.vendor, file.fileType, file.file);
        if (success) {
          console.log('✅ File deleted from database');
        } else {
          console.warn('⚠️ Could not delete from database');
        }
      }
      
      // Delete from filesystem if path exists
      if (file.path) {
        try {
          const deleted = await window.api.deleteFileFromDisk(file.path);
          if (deleted) {
            console.log('✅ File deleted from disk');
          } else {
            console.warn('⚠️ Could not delete from disk');
          }
        } catch (diskErr) {
          console.warn('⚠️ Could not delete from disk:', diskErr);
        }
      }
      
      // Remove from downloadLinks display
      const updatedLinks = downloadLinks.filter((_, index) => index !== fileIndex);
      setDownloadLinks(updatedLinks);
      
      alert(`File "${file.file}" has been deleted.`);
      
      // Reload existing files to refresh the display
      if (selectedPRId && outputFolder) {
        await loadExistingFiles(selectedPRId);
      }
      
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleSendEmails = async () => {
    console.log('🚀 handleSendEmails clicked!');
    setSendingEmails(true);
    try {
      if (!window.api || !window.api.sendSupplierEmails) {
        console.error('❌ Email functionality not available');
        throw new Error("Email functionality not available");
      }

      console.log('✅ API available, checking output folder:', outputFolder);

      // Validate output folder is selected
      if (!outputFolder) {
        console.log('❌ No output folder selected');
        setSendingEmails(false);
        alert("Please select an output folder before creating email template files.");
        return;
      }

      // Load the raw template from database
      let rawTemplate = {
        subject: 'Purchase Order - {{orderNumber}}',
        body: `Dear {{supplierName}},

We hope this email finds you well.

Please find our purchase order {{orderNumber}} with the following details:

{{orderTable}}

Contact Person: {{supplierContactName}}
{{supplierInstructions}}

Could you please confirm receipt and provide an estimated delivery date?

Thank you for your continued partnership.`,
        signature: `Best regards,
The Good Life Clinic

Phone: (XXX) XXX-XXXX
Email: orders@goodlifeclinic.com
Website: www.goodlifeclinic.com`
      };

      try {
        const savedTemplate = await window.api.getEmailTemplate();
        if (savedTemplate && !savedTemplate.error) {
          rawTemplate = {
            subject: savedTemplate.subject || rawTemplate.subject,
            body: savedTemplate.body || rawTemplate.body,
            signature: savedTemplate.signature || rawTemplate.signature
          };
        }
      } catch (error) {
        console.error('Error loading template for emails:', error);
      }

      // Get the purNumber from the selected PR
      const pr = activePRs.find(pr => (pr.id || pr._id).toString() === selectedPRId);
      const purNumber = pr?.name || pr?.number || pr?.id || pr?._id || "";

      console.log('🔍 Purchase Request Details:');
      console.log('  - PR:', pr);
      console.log('  - purNumber:', purNumber);
      console.log('  - Items count:', pr?.items?.length || 0);
      if (pr?.items?.length > 0) {
        console.log('  - First few items:', pr.items.slice(0, 3).map(item => ({
          name: item["Product Name"] || item.name,
          supplier: item["Supplier Name"] || item.supplier_name,
          quantity: item["No. to Order"] ?? item.no_to_order
        })));
        console.log('  - ALL item properties:', Object.keys(pr.items[0]));
        console.log('  - FULL first item:', pr.items[0]);
      }

      // Group items by vendor directly from the PR data if no CSV files exist
      let emailData = [];
      
      // Check if we have real CSV files (not placeholder entries)
      const realFiles = downloadLinks.filter(file => file.type !== 'email' && file.type !== 'placeholder' && file.file);
      
      console.log('🔍 DEBUGGING downloadLinks path:');
      console.log('   - downloadLinks count:', downloadLinks.length);
      console.log('   - downloadLinks:', downloadLinks.map(dl => ({ type: dl.type, file: dl.file })));
      console.log('   - realFiles count:', realFiles.length);
      console.log('   - realFiles:', realFiles);

      console.log('🚀 CRITICAL: About to determine emailData creation path...');
      
      if (realFiles.length > 0) {
        // If CSV files exist, prepare email data from files
        console.log('� CRITICAL: Taking CSV FILES path for emailData creation!');
        console.log('�📁 Processing real files for email data:', realFiles.map(f => f.file));
        emailData = realFiles.map(file => {
          console.log('📁 Processing file:', file.file);
          // Extract vendor name from filename - handle cases like "VendorName_PUR00001.csv" or "VendorName/VendorName_PUR00001.csv"
          let vendorName = file.file.split('_')[0] || file.file.split('.')[0];
          console.log('📁 Raw vendor name from file:', JSON.stringify(vendorName));
          
          // Clean up vendor name - remove any duplicate parts separated by "/"
          if (vendorName.includes('/')) {
            const parts = vendorName.split('/');
            vendorName = parts[0]; // Take the first part
          }
          
          // Also clean up any backslash corruption
          if (vendorName.includes('\\')) {
            vendorName = vendorName.split('\\')[0];
          }
          
          console.log('📁 Cleaned vendor name:', JSON.stringify(vendorName));
          
          const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
          console.log('📁 Found vendor info for', vendorName, ':', Object.keys(vendorInfo).length > 0 ? 'YES' : 'NO');
          
          // Get items for this vendor from the original PR
          const vendorItems = pr?.items?.filter(item => {
            const itemSupplier = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
            console.log(`📁 Checking item "${item["Product Name"] || item.name}" supplier "${itemSupplier}" against vendor "${vendorName}"`);
            return itemSupplier === vendorName;
          }) || [];
          
          console.log('📁 Found items for vendor', vendorName, ':', vendorItems.length);
          
          return { vendorName, vendorInfo, vendorItems };
        });
      } else {
        // If no CSV files, create email data directly from emailSettings.vendorEmails
        console.log('🚀 CRITICAL: Taking VENDOR EMAILS path for emailData creation!');
        console.log('🚀 Creating email data from vendor emails...');
        emailData = Object.keys(emailSettings.vendorEmails || {}).map(vendorName => {
          console.log('🔍 Mapping vendor name:', JSON.stringify(vendorName));
          
          // Fix corrupted vendor name here too (this might be where the corruption happens)
          const cleanVendorName = vendorName.includes('\\') 
            ? vendorName.split('\\')[0] 
            : vendorName;
          
          console.log('🧹 Clean vendor name for filtering:', JSON.stringify(cleanVendorName));
          
          const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
          console.log('📋 Found vendor info:', vendorInfo);
          
          // Get items for this vendor from the original PR - use clean vendor name
          const vendorItems = pr?.items?.filter(item => {
            const itemSupplier = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
            console.log(`🔍 Checking item: "${item["Product Name"] || item.name}" with supplier: "${itemSupplier}" against vendor: "${cleanVendorName}"`);
            const isMatch = itemSupplier === cleanVendorName;
            console.log(`   - Match result: ${isMatch}`);
            return isMatch;
          }) || [];
          console.log('🛍️ Found vendor items:', vendorItems.length);
          
          // Return the original vendorName for backward compatibility, but use clean name for matching
          const result = { vendorName, vendorInfo, vendorItems };
          console.log('✅ Created email data entry:', { 
            vendorName: JSON.stringify(result.vendorName), 
            hasInfo: Object.keys(result.vendorInfo).length > 0,
            itemsCount: result.vendorItems.length 
          });
          return result;
        });
      }

      console.log('📧 Email data before processing:', emailData);
      console.log('📝 Email settings vendor emails:', emailSettings.vendorEmails);
      console.log('🔍 Email data details:', emailData.map(ed => ({
        vendorName: ed.vendorName,
        vendorNameRaw: JSON.stringify(ed.vendorName),
        vendorNameLength: ed.vendorName?.length,
        hasInfo: Object.keys(ed.vendorInfo || {}).length > 0,
        itemsCount: ed.vendorItems?.length || 0
      })));
      
      console.log('🔍 Object.keys of emailSettings.vendorEmails:', Object.keys(emailSettings.vendorEmails || {}));
      
      // Process each vendor's email data and check database for existing .oft files
      
      // DEBUG: Show actual purchase request items and their supplier names
      console.log('🔍 DEBUGGING: Purchase request items and their suppliers:');
      if (pr?.items) {
        pr.items.forEach((item, index) => {
          console.log(`   Item ${index}: "${item["Product Name"] || item.name}" - Supplier: "${item["Supplier Name"] || item.supplier_name || "NO SUPPLIER"}"`);
          console.log(`   Item ${index} full object:`, item);
        });
      } else {
        console.log('   No purchase request items found!');
      }

      // Process each vendor's email data and check database for existing .oft files
      const processedEmailData = [];
      
      for (const { vendorName, vendorInfo, vendorItems } of emailData) {
        // Fix corrupted vendor name (remove duplicates and backslashes)
        const cleanVendorName = vendorName.includes('\\') 
          ? vendorName.split('\\')[0] 
          : vendorName;
        
        console.log('🔍 Processing vendor (RAW):', JSON.stringify(vendorName));
        console.log('🧹 Cleaned vendor name:', JSON.stringify(cleanVendorName));
        
        // Check if this vendor has already had .oft files created for this purchase request
        try {
          const hasOftFiles = await window.api.hasVendorFilesCreated(pr.id || pr._id, cleanVendorName, 'oft');
          if (hasOftFiles) {
            console.log('⚠️ Vendor already has .oft files created, skipping to avoid duplicates:', cleanVendorName);
            continue; // Skip this vendor
          }
        } catch (error) {
          console.error('Error checking vendor .oft files status:', error);
          // Continue processing even if check fails
        }
        
        console.log('✅ Vendor has no .oft files yet, will process:', cleanVendorName);
        
        console.log('🚨🚨🚨 TESTING IF CHANGES ARE LOADING! 🚨🚨🚨');
        
        // Debug vendor name matching
        console.log('🔍 Available vendor names in emailSettings:');
        Object.keys(emailSettings.vendorEmails || {}).forEach(name => {
          console.log(`  - "${name}" (length: ${name.length})`);
          console.log(`  - Match check: "${name}" === "${cleanVendorName}" = ${name === cleanVendorName}`);
        });
        console.log(`🔍 Looking for vendor: "${cleanVendorName}" (length: ${cleanVendorName.length})`);
        
        // Use cleaned vendor name for lookups
        const actualVendorInfo = emailSettings.vendorEmails[cleanVendorName] || {};
        console.log('📋 Vendor info (FOUND):', actualVendorInfo);
        console.log('🛍️ Vendor items (RAW):', vendorItems);
        
        // CRITICAL FIX: Force get items from PR if vendorItems is empty
        console.log('🚨 FORCE OVERRIDE: Getting items directly from PR!');
        const actualVendorItems = pr?.items?.filter(item => {
          const itemSupplier = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
          console.log(`🚨 Force checking: "${itemSupplier}" === "${cleanVendorName}" = ${itemSupplier === cleanVendorName}`);
          return itemSupplier === cleanVendorName;
        }) || [];
        console.log('🚨 FORCE OVERRIDE: Found items from PR:', actualVendorItems.length);
        
        // Create both HTML and plain text tables for this vendor's items
        let htmlTable = '';
        let plainTextTable = '';
        
        if (actualVendorItems.length > 0) {
          // HTML Table (preferred) - clean HTML with no extra spacing
          const htmlTableRows = actualVendorItems.map(item => {
            const productName = item["Product Name"] || item.name || "Unknown Product";
            const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
            return `<tr><td>${productName}</td><td>${quantity}</td></tr>`;
          }).join('');
          
          htmlTable = `<p>ORDER DETAILS:</p><table border="1" class="order-table"><tr><th>Product Name</th><th>Qty</th></tr>${htmlTableRows}</table><p>Please confirm receipt and estimated delivery date.</p>`;
          
          // Plain Text Table (fallback)
          const tableHeader = '\n\n\nORDER DETAILS:\n' + 
                             '================================================\n' +
                             'Product Name                          Quantity\n' +
                             '================================================\n';
          
          const plainTextRows = actualVendorItems.map(item => {
            const productName = item["Product Name"] || item.name || "Unknown Product";
            const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
            
            // Pad product name to 38 characters, center-align quantity in 8-character field
            const paddedName = productName.length > 38 ? 
              productName.substring(0, 35) + '...' : 
              productName.padEnd(38);
            const quantityStr = quantity.toString();
            // Simple center alignment: pad to center position, then pad to full width
            const centerPos = Math.floor((8 - quantityStr.length) / 2);
            const paddedQuantity = ' '.repeat(centerPos) + quantityStr + ' '.repeat(8 - centerPos - quantityStr.length);
            
            return `${paddedName} ${paddedQuantity}`;
          }).join('\n');
          
          plainTextTable = tableHeader + plainTextRows + '\n================================================\n\nPlease confirm receipt and estimated delivery date.\n\n';
        }

        // Create replacement function for this supplier
        const replaceVarsForSupplier = (text) => {
          // Create HTML table for this supplier - clean HTML with no extra spacing
          const orderTableContent = actualVendorItems.length > 0 ? 
            `<table border="1" class="order-table" style="font-size: 16px !important; font-family: Arial, sans-serif !important;"><tr><th style="font-size: 16px !important; font-family: Arial, sans-serif !important;">Product Name</th><th style="font-size: 16px !important; font-family: Arial, sans-serif !important;">Qty</th></tr>` + 
            actualVendorItems.map(item => {
              const productName = item["Product Name"] || item.name || "Unknown Product";
              const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
              return `<tr><td style="font-size: 16px !important; font-family: Arial, sans-serif !important;">${productName}</td><td style="text-align: center; font-size: 16px !important; font-family: Arial, sans-serif !important;">${quantity}</td></tr>`;
            }).join('') + 
            '</table>' : '';

          // Use the found vendor info instead of the original empty one
          
          return text
            // Double brace variables (new format)
            .replace(/\{\{orderNumber\}\}/g, purNumber)
            .replace(/\{\{supplierName\}\}/g, cleanVendorName)
            .replace(/\{\{supplierEmail\}\}/g, actualVendorInfo.email || '')
            .replace(/\{\{supplierContactName\}\}/g, actualVendorInfo.contactName || '')
            .replace(/\{\{supplierInstructions\}\}/g, actualVendorInfo.special_instructions || actualVendorInfo.comments || '')
            .replace(/\{\{orderTable\}\}/g, orderTableContent)
            .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
            .replace(/\{\{companyName\}\}/g, 'The Good Life Clinic')
            // Single brace variables (backward compatibility)
            .replace(/\{purchaseOrderNumber\}/g, purNumber)
            .replace(/\{supplierName\}/g, cleanVendorName)
            .replace(/\{contactName\}/g, actualVendorInfo.contactName || '')
            .replace(/\{date\}/g, new Date().toLocaleDateString())
            .replace(/\{companyName\}/g, 'The Good Life Clinic');
        };

        // Use the replacement function to process template for this specific supplier
        // Convert text to HTML with forced spacing that Outlook can't strip
        const formatTextAsHTML = (text) => {
          if (!text) return '';
          // Split by double line breaks first (paragraphs)
          const paragraphs = text.split(/\n\s*\n/);
          return paragraphs.map(paragraph => {
            // Within each paragraph, convert single line breaks to <br>
            const htmlParagraph = paragraph.replace(/\n/g, '<br>');
            return htmlParagraph;
          }).join('<br><br>'); // Double line breaks between paragraphs
        };

        const supplierSpecificSubject = replaceVarsForSupplier(rawTemplate.subject);
        const supplierSpecificMessage = formatTextAsHTML(replaceVarsForSupplier(rawTemplate.body));
        const supplierSpecificSignature = formatTextAsHTML(replaceVarsForSupplier(rawTemplate.signature));

        // Wrap the entire email content in HTML for proper formatting
        const finalEmailMessage = `
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; font-size: 16px !important; line-height: 1.4; margin: 0; padding: 20px; }
* { font-size: 16px !important; font-family: Arial, sans-serif !important; }
table, th, td { font-size: 16px !important; font-family: Arial, sans-serif !important; }
table.order-table { 
  border-collapse: collapse; 
  font-family: Arial, sans-serif !important;
  font-size: 16px !important;
  margin: 10px 0;
  border: none;
  width: auto;
  mso-table-lspace: 0pt !important;
  mso-table-rspace: 0pt !important;
}
table.order-table th { 
  background: #e8e8e8;
  border: 1px solid #999;
  padding: 2px 8px;
  font-size: 16px !important;
  font-family: Arial, sans-serif !important;
  font-weight: normal;
  text-align: left;
  height: 16px;
  line-height: 16px;
  vertical-align: middle;
  mso-line-height-rule: exactly;
}
table.order-table td { 
  border: 1px solid #999;
  padding: 4px 8px;
  font-size: 16px !important;
  font-family: Arial, sans-serif !important;
  text-align: left;
  vertical-align: top;
  mso-line-height-rule: exactly;
}
table.order-table th:last-child, 
table.order-table td:last-child { 
  text-align: center;
  width: 50px;
  min-width: 50px;
}
table.order-table th:first-child, 
table.order-table td:first-child { 
  min-width: 200px;
}
p { margin: 8px 0; }
</style>
</head>
<body>
${supplierSpecificMessage}
${supplierSpecificSignature}
</body>
</html>
        `.trim();
        
        console.log('Final email for', cleanVendorName, ':', finalEmailMessage);
        
        // Debug attachment logic
        const potentialAttachment = downloadLinks.find(f => f.file.includes(cleanVendorName));
        const attachmentFilePath = includeAttachments && createFiles && potentialAttachment ? `${outputFolder}/${potentialAttachment.file}` : null;
        console.log('Attachment debug for', cleanVendorName, ':', {
          includeAttachments,
          createFiles,
          potentialAttachment,
          attachmentFilePath,
          downloadLinks: downloadLinks.map(dl => dl.file)
        });
        
        const emailData = {
          vendorName: cleanVendorName,
          email: typeof actualVendorInfo === 'string' ? actualVendorInfo : (actualVendorInfo.email || ""),
          subject: supplierSpecificSubject,
          message: finalEmailMessage,
          fallbackMessage: finalEmailMessage, // Same content for both since template handles formatting
          attachmentFile: attachmentFilePath
        };
        
        // Only add vendors with email addresses
        if (emailData.email.trim() !== "") {
          console.log('✅ Adding vendor to processed email data:', cleanVendorName);
          processedEmailData.push(emailData);
        } else {
          console.log('⚠️ Skipping vendor with no email address:', cleanVendorName);
        }
      }

      console.log('📋 Processed email data after filtering:', processedEmailData.length, 'emails');

      if (processedEmailData.length === 0) {
        setSendingEmails(false);
        // Keep email mode open so user can enter email addresses
        setEmailMode(true);
        return;
      }

      console.log('📞 Calling sendSupplierEmails API with:', {
        emailDataCount: processedEmailData.length,
        outputFolder,
        firstEmail: processedEmailData[0]
      });

      const result = await window.api.sendSupplierEmails(processedEmailData, outputFolder);
      
      console.log('📨 API result:', result);
      
      if (result.success) {
        // Show success message with instructions for template files
        let message = `Successfully created ${result.sentCount} email template file(s)!\n\n`;
        message += `Email template files have been saved to your output folder:\n`;
        
        // Safety check for oftFiles array
        const emailFiles = result.oftFiles || [];
        emailFiles.forEach(file => {
          const fileType = file.isOutlookTemplate ? '.oft template' : 'email file';
          message += `• ${file.filename} (${file.vendor}) - ${fileType}\n`;
        });
        message += `\nClick on .oft file to open it as an editable template in Outlook`;
        
        if (result.errors && result.errors.length > 0) {
          message += `\n\nNote: ${result.errors.join(', ')}`;
        }
        alert(message);
        
        // Mark each vendor as having .oft files created in the database
        for (const emailData of processedEmailData) {
          try {
            // Find the corresponding file that was created for this vendor
            const vendorFile = emailFiles.find(file => file.vendor === emailData.vendorName);
            const filename = vendorFile ? vendorFile.filename : '';
            const filePath = vendorFile ? vendorFile.file : '';
            const fileSize = vendorFile ? vendorFile.size || 0 : 0;
            
            await window.api.markVendorFilesCreated(pr.id || pr._id, emailData.vendorName, 'oft', filename, filePath, fileSize);
            console.log('✅ Marked vendor as having .oft files created in database:', emailData.vendorName, 'filename:', filename);
          } catch (markErr) {
            console.error('❌ Failed to mark vendor .oft files status in database:', emailData.vendorName, markErr);
          }
        }
        
        // Update purchase request status to mark .oft files as created
        if (pr && pr.id && window.api.updatePurchaseRequestOftFilesStatus) {
          try {
            await window.api.updatePurchaseRequestOftFilesStatus(pr.id, true);
            console.log('✅ Marked purchase request as having .oft files created');
          } catch (statusErr) {
            console.error('❌ Failed to update .oft files status:', statusErr);
          }
        }
        
        // Update downloadLinks to include template files for display
        const emailLinks = emailFiles.map(file => ({
          file: file.filename,
          path: file.file,
          vendor: file.vendor,
          email: file.email,
          type: 'email',
          isOutlookDraft: file.isOutlookDraft || false,
          isOutlookTemplate: file.isOutlookTemplate || false
        }));
        
        // Merge new template files with existing ones, avoiding duplicates
        setDownloadLinks(prev => {
          console.log('Current downloadLinks:', prev);
          console.log('Adding emailLinks:', emailLinks);
          
          // Remove placeholder entries
          const nonPlaceholderLinks = prev.filter(link => link.type !== 'placeholder');
          
          // Create a set of existing vendor names to avoid duplicates
          const existingVendors = new Set(nonPlaceholderLinks.map(link => link.vendor));
          
          // Only add new email links for vendors that don't already have files
          const newEmailLinks = emailLinks.filter(link => !existingVendors.has(link.vendor));
          
          const newLinks = [...nonPlaceholderLinks, ...newEmailLinks];
          console.log('New downloadLinks (merged):', newLinks);
          return newLinks;
        });
        setEmailMode(false);
      } else {
        throw new Error(result.error || "Failed to create template files");
      }
    } catch (err) {
      alert(`Failed to open email client: ${err.message}`);
    }
    setSendingEmails(false);
  };

  const updateVendorEmail = (vendorName, email) => {
    setEmailSettings(prev => ({
      ...prev,
      vendorEmails: {
        ...prev.vendorEmails,
        [vendorName]: typeof prev.vendorEmails[vendorName] === 'object' 
          ? { ...prev.vendorEmails[vendorName], email }
          : { email, contactName: "" }
      }
    }));
  };

  return (
    <div className="center-card">
      <button
        type="button"
        onClick={() => navigate("/")}
        style={{
          position: "fixed",
          top: "100px",
          left: "20px",
          background: "none",
          border: "none",
          color: "#006bb6",
          fontSize: "24px",
          cursor: "pointer",
          padding: "8px",
          lineHeight: 1,
          zIndex: 1000,
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        title="Back to Home"
      >
        ←
      </button>
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "#006bb6" }}>
        Send Orders to Suppliers
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 16 }}>
        {/* Row 1: Folder Picker */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, minHeight: 48 }}>
          <button
            type="button"
            onClick={handlePickFolder}
            style={{
              background: "#006bb6",
              color: "#fff",
              fontWeight: 600,
              padding: "0 24px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: 17,
              minWidth: 170,
              width: 'auto',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              boxSizing: 'border-box',
              transition: "background 0.2s"
            }}
          >
            Choose Output Folder
          </button>
          <span style={{
            color: outputFolder ? '#006bb6' : '#888',
            fontSize: 17,
            minWidth: 340,
            maxWidth: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            height: 48,
            boxSizing: 'border-box',
            paddingLeft: 2
          }}>
            {outputFolder ? outputFolder : 'No folder selected'}
          </span>
        </div>
        {/* Row 2: Purchase Order Selector and Submit */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, minHeight: 48 }}>
          <label htmlFor="pr-select" style={{
            fontWeight: 600,
            minWidth: 170,
            fontSize: 17,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0
          }}>Select Purchase Order:</label>
          <select
            id="pr-select"
            value={selectedPRId || ''}
            onChange={e => setSelectedPRId(e.target.value)}
            style={{
              fontSize: 17,
              height: 48,
              padding: '0 16px',
              borderRadius: 6,
              border: '1px solid #bbb',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          >
            <option value="">-- Select Active PO --</option>
            {activePRs && activePRs.length > 0 && activePRs.map(pr => (
              <option key={pr.id || pr._id} value={pr.id || pr._id}>
                {pr.name ? pr.name : `PO #${pr.id || pr._id}`}
              </option>
            ))}
          </select>
        </div>
        
        {/* Row 3: Options Checkboxes */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, minHeight: 40, marginTop: 10 }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8,
            height: 32
          }}>
            <input
              type="checkbox"
              id="create-files"
              checked={createFiles}
              onChange={(e) => setCreateFiles(e.target.checked)}
              style={{ 
                width: 16, 
                height: 16,
                margin: 0,
                verticalAlign: "middle"
              }}
            />
            <label 
              htmlFor="create-files" 
              style={{ 
                fontSize: 16, 
                fontWeight: 500, 
                color: "#374151",
                margin: 0,
                lineHeight: "16px",
                display: "flex",
                alignItems: "center"
              }}
            >
              Create order files for suppliers
            </label>
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8,
            height: 32
          }}>
            <input
              type="checkbox"
              id="include-attachments"
              checked={includeAttachments}
              onChange={(e) => setIncludeAttachments(e.target.checked)}
              disabled={!createFiles}
              style={{ 
                width: 16, 
                height: 16,
                margin: 0,
                verticalAlign: "middle",
                opacity: createFiles ? 1 : 0.5
              }}
            />
            <label 
              htmlFor="include-attachments" 
              style={{ 
                fontSize: 16, 
                fontWeight: 500, 
                color: createFiles ? "#374151" : "#9ca3af",
                margin: 0,
                lineHeight: "16px",
                display: "flex",
                alignItems: "center"
              }}
            >
              Include files as email attachments
            </label>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 10 }}>
        <button
          type="button"
          disabled={loading || !selectedPRId || (createFiles && !outputFolder) || !apiKeySet}
          onClick={handleCreateSupplierOrderFilesFromPR}
          style={{
            fontWeight: 600,
            backgroundColor: loading || !selectedPRId || (createFiles && !outputFolder) || !apiKeySet ? "#eee" : "#22b573",
            color: loading || !selectedPRId || (createFiles && !outputFolder) || !apiKeySet ? "#888" : "white",
            padding: "14px 0",
            border: "none",
            borderRadius: "6px",
            cursor: loading || !selectedPRId || (createFiles && !outputFolder) || !apiKeySet ? "not-allowed" : "pointer",
            fontSize: "1.1em",
            width: "100%",
            transition: "background 0.2s"
          }}
        >
          {loading ? "Processing..." : createFiles ? "Create Supplier Excel Documents" : "Prepare Email Template"}
        </button>
      </div>
      {downloadLinks.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h4>
            {downloadLinks.some(file => file.type === 'placeholder') && emailMode ? 
              "📧 Email Setup Required" : 
              (createFiles ? "Orders Sent to Suppliers" : "Email Template Ready")
            }
          </h4>
          
          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "12px", marginBottom: 20 }}>
            {createFiles && (
              <button
                style={{
                  background: "#006bb6",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer"
                }}
                onClick={handleDownloadAll}
                type="button"
              >
                📥 Download All
              </button>
            )}
            {!downloadLinks.some(file => file.type === 'placeholder') && (
              <button
                style={{
                  background: emailMode ? "#666" : "#22b573",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer"
                }}
                onClick={() => setEmailMode(!emailMode)}
                type="button"
              >
                {emailMode ? "📋 View Files" : "📧 Create Email Templates"}
              </button>
            )}
          </div>

          {emailMode ? (
            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: 20
            }}>
              <h5 style={{ margin: "0 0 15px 0", color: "#374151" }}>📧 Email Setup</h5>
              
              <div style={{ 
                background: "#e0f2fe", 
                border: "1px solid #0891b2", 
                borderRadius: "6px", 
                padding: "12px", 
                marginBottom: 20,
                fontSize: "14px",
                color: "#0c4a6e"
              }}>
                <strong>📝 Note:</strong> Email templates are now managed in the <strong>Admin Portal → Email and Supplier Management → Email Templates</strong>. 
                The template configured there will be used automatically for all supplier emails.
              </div>

              {/* Vendor Email Addresses */}
              <div style={{ marginBottom: 20 }}>
                <h6 style={{ margin: "0 0 10px 0", color: "#374151" }}>Vendor Email Addresses:</h6>
                {Object.keys(emailSettings.vendorEmails || {}).map((vendorName, idx) => {
                  const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
                  const email = typeof vendorInfo === 'string' ? vendorInfo : (vendorInfo.email || "");
                  const contactName = typeof vendorInfo === 'object' ? vendorInfo.contactName : "";
                  
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 10 }}>
                      <div style={{ minWidth: 120, fontWeight: 500, color: "#4b5563" }}>
                        <div>{vendorName}:</div>
                        {contactName && (
                          <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 400 }}>
                            Contact: {contactName}
                          </div>
                        )}
                      </div>
                      <input
                        type="email"
                        placeholder="vendor@email.com"
                        value={email}
                        onChange={(e) => updateVendorEmail(vendorName, e.target.value)}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "14px"
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails}
                style={{
                  background: sendingEmails ? "#9ca3af" : "#22b573",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: sendingEmails ? "not-allowed" : "pointer",
                  fontSize: "16px"
                }}
              >
                {sendingEmails ? "📤 Creating..." : "📧 Create Email Templates"}
              </button>
            </div>
          ) : (
            /* File List - Show both regular files and .oft template files */
            (createFiles || downloadLinks.some(file => file.type === 'email')) && downloadLinks.some(file => file.type !== 'placeholder') ? (
              <ul style={{ paddingLeft: 20, listStyle: "none" }}>
                {downloadLinks.filter(file => file.type !== 'placeholder').map((file, idx) => (
                  <li key={idx} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        // Handle different file types
                        if (file.isOutlookDraft) {
                          // For Outlook drafts, just show info message
                          alert(`This email was created as a draft in Outlook. Please check your Outlook drafts folder for: ${file.vendor}`);
                        } else if (file.type === 'email' && file.path) {
                          // Handle .oft template files
                          try {
                            if (window.api && window.api.openOftFile) {
                              const result = await window.api.openOftFile(file.path);
                              if (!result.success) {
                                alert(`Failed to open email template file: ${result.error}`);
                              } else {
                                console.log(`Opened .oft template file: ${file.filename}`);
                              }
                            } else {
                              alert('Email template file opening not available');
                            }
                          } catch (e) {
                            alert(`Failed to open email template file: ${e.message}`);
                          }
                        } else {
                          // Handle regular files (Excel/CSV)
                          if (!window.api || !window.api.downloadFile) return;
                          try {
                            const filePath = await window.api.downloadFile(file.file);
                            window.open(filePath);
                          } catch (e) {}
                        }
                      }}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        color: "#1867c0", 
                        textDecoration: "underline", 
                        cursor: "pointer",
                        fontSize: "14px",
                        flex: 1,
                        textAlign: 'center'
                      }}
                    >
                      {file.isOutlookDraft ? '📧' : (file.type === 'email' ? (file.isOutlookTemplate ? '📝' : '📧') : '📄')} {file.file}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file, idx)}
                      style={{
                        background: "#ff4444",
                        border: "none",
                        color: "white",
                        borderRadius: "3px",
                        width: "20px",
                        height: "20px",
                        cursor: "pointer",
                        fontSize: "12px",
                        marginLeft: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Delete file"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "15px",
                color: "#374151"
              }}>
                <p style={{ margin: "0 0 10px 0", fontWeight: 500 }}>
                  📧 Email template prepared for {downloadLinks.filter(file => file.type !== 'placeholder').length} supplier{downloadLinks.filter(file => file.type !== 'placeholder').length === 1 ? '' : 's'}:
                </p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {downloadLinks.filter(file => file.type !== 'placeholder').map((file, idx) => {
                    let vendorName = file.file.split('_')[0] || file.file.split('.')[0];
                    if (vendorName.includes('/')) {
                      vendorName = vendorName.split('/')[0];
                    }
                    return (
                      <li key={idx} style={{ marginBottom: 3, fontSize: "14px" }}>
                        {vendorName}
                      </li>
                    );
                  })}
                </ul>
                <p style={{ margin: "10px 0 0 0", fontSize: "14px", color: "#6b7280" }}>
                  Click "📧 Create Email Templates" to generate .oft template files.
                </p>
              </div>
            )
          )}
        </div>
      )}
      {error && <div className="error-msg" style={{ marginTop: 28 }}>{error}</div>}
    </div>
  );
}

export default GenerateSupplierFiles;
