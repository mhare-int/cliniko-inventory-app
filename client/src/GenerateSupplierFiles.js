import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function GenerateSupplierFiles() {
  const navigate = useNavigate();
  const [activePRs, setActivePRs] = useState([]);
  const [selectedPRId, setSelectedPRId] = useState("");
  const [prSearch, setPrSearch] = useState("");
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
  const [excelOpen, setExcelOpen] = useState(true);
  const [oftOpen, setOftOpen] = useState(true);
  const [vendorSearch, setVendorSearch] = useState('');
  const [suppliersMap, setSuppliersMap] = useState({});
  const [vendorOptions, setVendorOptions] = useState([]);
  // One-time debug guard to avoid spamming the console
  const debugSupplierLoggedRef = useRef(false);

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
        // Sort PRs so the biggest PO number appears first in the select.
        // We try to extract a numeric portion from pr.pr_id / pr.name / pr.id and sort by that.
        const extractNum = (pr) => {
          const s = String(pr.pr_id || pr.name || pr.id || pr._id || '');
          const m = s.match(/(\d+)/);
          if (m) return parseInt(m[1], 10);
          const n = Number(s);
          return Number.isFinite(n) ? n : 0;
        };

        const sortedPRs = (res || []).slice().sort((a, b) => {
          return extractNum(b) - extractNum(a);
        });

        setActivePRs(sortedPRs);

        // Auto-select the highest PR if none selected and populate search text
        if (sortedPRs && sortedPRs.length > 0) {
          const highestPR = sortedPRs[0];
          const label = highestPR.name ? highestPR.name : `PO #${highestPR.id || highestPR._id}`;
          setSelectedPRId((highestPR.id || highestPR._id || '').toString());
          setPrSearch(label);
        }
      })
      .catch(() => setActivePRs([]));
  }, []);

  // Load vendor emails for the selected Purchase Request
  const loadVendorEmails = async (prId) => {
    try {
      const pr = activePRs.find(pr => (pr.id || pr._id).toString() === prId);
      if (!pr || !pr.items) {
        setEmailSettings({ vendorEmails: {} });
        setEmailMode(false);
        return;
      }

      // Group items by vendor (use supplier_id-backed lookup when possible)
      const vendorGroups = {};
      pr.items.forEach(item => {
        const vendorName = getSupplierName(item);
        if (!vendorGroups[vendorName]) vendorGroups[vendorName] = [];
        vendorGroups[vendorName].push(item);
      });

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
          // One-time debug: print the supplier object so we can inspect field names (account number etc.)
          try {
            if (!debugSupplierLoggedRef.current) {
              console.log('DEBUG supplier object for', vendorName, supplier);
              debugSupplierLoggedRef.current = true;
            }
          } catch (e) { /* ignore */ }
          const supplierEmail = (supplier && supplier.email) ? supplier.email : "";
          const contactName = (supplier && supplier.contact_name) ? supplier.contact_name : "";
          const specialInstructions = (supplier && supplier.special_instructions) ? supplier.special_instructions : "";
          
          // Include account number (several possible field names in DB)
          const accountNumber = supplier?.account_number || supplier?.customer_account_number || supplier?.customer_account || supplier?.account || '';
          const infoObj = {
            email: supplierEmail,
            contactName: contactName,
            special_instructions: specialInstructions,
            comments: supplier?.comments || "",
            // provide both snake_case and camelCase keys so callers can access either
            account_number: accountNumber,
            accountNumber: accountNumber
          };
          // Store under the original vendor name
          vendorEmailsObj[vendorName] = infoObj;
          // Also store under a cleaned vendor name (remove backslashes and trim) so lookups using cleaned names succeed
          try {
            const cleaned = (vendorName || '').toString().split('\\')[0].trim();
            if (cleaned && cleaned !== vendorName) {
              // Only set if not already present to avoid overwriting explicit entries
              if (!vendorEmailsObj[cleaned]) vendorEmailsObj[cleaned] = infoObj;
            }
          } catch (e) {
            // ignore
          }
        } catch (err) {
          console.error(`Error getting supplier details for ${vendorName}:`, err);
          vendorEmailsObj[vendorName] = { email: "", contactName: "", special_instructions: "", comments: "" }; // Empty if supplier not found
        }
      }

      // Set email settings and show email mode
      setEmailSettings({ vendorEmails: vendorEmailsObj });
      setEmailMode(Object.keys(vendorEmailsObj).length > 0);
      
    } catch (error) {
      console.error('Error loading vendor emails:', error);
      setEmailSettings({ vendorEmails: {} });
      setEmailMode(false);
    }
  };


  // Load existing files when PR selection or output folder changes
  useEffect(() => {
    if (selectedPRId && outputFolder) {
      loadExistingFiles(selectedPRId);
    } else {
      // Clear download links if no PR selected or no output folder
      setDownloadLinks([]);
    }
  }, [selectedPRId, outputFolder]);

  // At mount: remove any stale/duplicate filter inputs or clickable remnants inside the filter area
  useEffect(() => {
    try {
      const container = document.querySelector('[data-gsf-filter-area]');
      if (!container) return;
      const canonical = container.querySelector('#gsf-vendor-search');
      // Remove any inputs that aren't the canonical input (stale DOM/HMR artifacts)
      const inputs = Array.from(container.querySelectorAll('input'));
      inputs.forEach(inp => { if (inp !== canonical) inp.remove(); });
      // Remove any buttons or divs that look like suggestion chips (defensive)
      const extras = Array.from(container.querySelectorAll('button, div')).filter(el => {
        // keep the Clear button (it has onclick that clears vendorSearch) by checking its textContent
        if (el.tagName.toLowerCase() === 'button' && el.textContent && el.textContent.trim().toLowerCase() === 'clear') return false;
        return el !== canonical && el.tagName.toLowerCase() !== 'span';
      });
      extras.forEach(el => el.remove());
    } catch (e) {
      console.warn('Filter area cleanup failed', e);
    }
  }, []);

  // Load vendor emails when PR selection changes
  useEffect(() => {
    if (selectedPRId) {
      loadVendorEmails(selectedPRId);
    } else {
      setEmailSettings({ vendorEmails: {} });
      setEmailMode(false);
    }
  }, [selectedPRId, activePRs]);

  // Compute vendor suggestion options for the vendor search datalist
  useEffect(() => {
    try {
      const set = new Set();
      // From email settings (explicit vendor list)
      Object.keys(emailSettings.vendorEmails || {}).forEach(v => { if (v) set.add(v); });

      // From generated/download links (vendors + parsed filenames)
      (downloadLinks || []).forEach(f => {
        if (!f) return;
        if (f.vendor) set.add(f.vendor);
        const fname = (f.file || f.filename || '').toString();
        if (fname) {
          const vendorFromFile = fname.split('_')[0] || fname.split('.')[0];
          if (vendorFromFile) set.add(vendorFromFile);
        }
      });

      // From active PR items for the selected PR
      try {
        const pr = activePRs && activePRs.find(pr => (pr.id || pr._id).toString() === selectedPRId);
        if (pr && pr.items) {
          pr.items.forEach(item => {
            const name = getSupplierName(item);
            if (name) set.add(name);
          });
        }
      } catch (e) { /* ignore */ }

      // From suppliersMap values
      Object.values(suppliersMap || {}).forEach(v => { if (v) set.add(v); });

      const arr = Array.from(set).filter(Boolean).sort((a, b) => a.toString().localeCompare(b.toString()));
      setVendorOptions(arr);
    } catch (e) {
      console.warn('Failed to compute vendor options', e);
      setVendorOptions([]);
    }
  }, [emailSettings, downloadLinks, activePRs, selectedPRId, suppliersMap]);

  // Helper to get supplier display name from item (prefer supplier_id lookup)
  const getSupplierName = (item) => {
    if (!item) return "Unknown Supplier";
    const supplierId = item["Supplier Id"] || item.supplier_id || item.supplierId || item.supplier || null;
    const nameFromItem = item["Supplier Name"] || item.supplier_name || item.vendor_name || null;
    if (nameFromItem) return nameFromItem;
    if (supplierId && suppliersMap[supplierId]) return suppliersMap[supplierId];
    return "Unknown Supplier";
  };

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
      setError("Please select a Purchase Order to create email templates.");
      return;
    }
    if (!outputFolder) {
      setError("Please select an output folder for the email template files.");
      return;
    }
    setLoading(true);
    try {
      const pr = activePRs.find(pr => (pr.id || pr._id).toString() === selectedPRId);
      if (!pr || !pr.items || pr.items.length === 0) throw new Error("Selected PR has no items.");
      
  // We'll defer deletion of any existing generated files until we know new files were created.

      // Define purNumber at the top so it's available throughout the function
      const purNumber = pr.name || pr.number || pr.id || pr._id || "";
      
      // Create vendor groups for email template variables (use getSupplierName)
      const vendorGroups = {};
      pr.items.forEach(item => {
        const supplierName = getSupplierName(item);
        if (!vendorGroups[supplierName]) {
          vendorGroups[supplierName] = [];
        }
        vendorGroups[supplierName].push(item);
      });
      
      let files = [];
      
      // Step 1: Create Excel files if requested
      if (createFiles) {
        // Check if Excel files already exist for this PR (we will only delete them after new files are created)
        console.log('🔍 Checking for existing Excel files for PR:', pr.id);
        const existingExcelFiles = await window.api.getGeneratedFiles(pr.id, 'excel');
        if (existingExcelFiles && existingExcelFiles.length > 0) {
          console.log('ℹ️ Found existing Excel files; will delete them only after new files are successfully created:', existingExcelFiles.map(f => f.filename));
        }
        
        console.log('✅ Creating new Excel files');
        
  // Create the actual files
        if (!window.api || !window.api.createSupplierOrderFilesForVendors) throw new Error("createSupplierOrderFilesForVendors not available");
        const vendorItems = pr.items.map(item => {
          // Conservatively pass through known pricing fields if present so backend generator
          // doesn't have to rely on DB reload. Keep shape minimal and non-destructive.
          const qty = item["No. to Order"] ?? item.no_to_order ?? item.qty ?? item.quantity ?? 0;
          const unitCost = item.unit_cost ?? item.unitCost ?? item.unit_price ?? item.unitPrice ?? item["Unit Cost"] ?? item["Unit Price"] ?? 0;
          const lineTotal = item.line_total ?? item.lineTotal ?? item["Line Total"] ?? (unitCost && qty ? Number(unitCost) * Number(qty) : 0);
          return {
            "PUR Number": purNumber,
            "Product Name": item["Product Name"] || item.name,
            "Supplier Name": getSupplierName(item),
            "No. to Order": qty,
            "Quantity": qty,
            unit_cost: unitCost,
            line_total: lineTotal
          };
        });
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

        // If we previously found existing Excel files, delete them now that new files were created successfully
        if (existingExcelFiles && existingExcelFiles.length > 0) {
          console.log('\u26a0\ufe0f Deleting previous Excel files now that new ones were created:', existingExcelFiles.map(f => f.filename));
          for (const existingFile of existingExcelFiles) {
            try {
              // Delete from database
              await window.api.deleteGeneratedFile(pr.id, existingFile.vendor_name, 'excel', existingFile.filename);
              console.log('\u2705 Deleted old Excel DB record:', existingFile.filename);
            } catch (deleteErr) {
              console.warn('\u26a0\ufe0f Could not delete old Excel DB record:', existingFile.filename, deleteErr);
            }
            // Delete from disk if file path exists
            if (existingFile.file_path) {
              try {
                await window.api.deleteFileFromDisk(existingFile.file_path);
                console.log('\u2705 Deleted old Excel from disk:', existingFile.file_path);
              } catch (diskErr) {
                console.warn('\u26a0\ufe0f Could not delete old Excel file from disk:', existingFile.file_path, diskErr);
              }
            }
          }
        }
        
        // Track Excel files in the database
        if (res && Array.isArray(res.files) && res.files.length > 0) {
          try {
            for (const fileInfo of res.files) {
              const supplierName = fileInfo.supplier || 'Unknown Supplier';
              const fullFilePath = fileInfo.file || 'Unknown File';
              // Extract just the filename without folder path for display
              const filename = fullFilePath.includes('\\') ? fullFilePath.split('\\').pop() : fullFilePath;
              // Prefer absolute path returned by backend if provided
              const fullPath = fileInfo.path || fileInfo.file_path || `${outputFolder}/${fullFilePath}`;
              
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
        
        // Reload existing files after Excel creation to show them in UI
        await loadExistingFiles(pr.id, outputFolder);
        
        alert("Excel files created successfully!");
      }
      
      // Step 2: If email setup is ready, automatically create the .oft email template files
      console.log('📧 Email settings vendor emails:', emailSettings.vendorEmails);
      console.log('📧 Email settings keys:', Object.keys(emailSettings.vendorEmails || {}));
      
      if (Object.keys(emailSettings.vendorEmails || {}).length > 0) {
        console.log('🔄 Starting automatic email template creation...');
        try {
          // Get vendor groups from purchase request (use getSupplierName)
          const vendorGroups = {};
          pr?.items?.forEach(item => {
            const vendorName = getSupplierName(item);
            if (!vendorGroups[vendorName]) vendorGroups[vendorName] = [];
            vendorGroups[vendorName].push(item);
          });
          
          console.log('📧 Vendor groups keys:', Object.keys(vendorGroups));

          // Update downloadLinks with newly created files so handleSendEmails can find attachments
          console.log('🔄 BEFORE setDownloadLinks, files:', files.length, files.map(f => f.file));
          setDownloadLinks([...files]);
          
          // Small delay to ensure downloadLinks state is updated
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('🔄 ABOUT TO CALL handleSendEmails...');
          // Use the main handleSendEmails function that has proper HTML formatting
          // Pass the newly created files directly to avoid state timing issues
          await handleSendEmails(files);
          console.log('🔄 AFTER handleSendEmails call');
          setEmailMode(false); // Hide email setup after creating templates
          alert("Email templates created successfully!");
        } catch (emailError) {
          console.error('❌ Error creating email templates:', emailError);
          // Reload all files from database to show Excel files that were created
          await loadExistingFiles(pr.id, outputFolder);
          setError("Email templates creation failed: " + (emailError.message || emailError));
        }
      } else {
        // If no email setup available, reload files from database to show all created files
        await loadExistingFiles(pr.id, outputFolder);
        alert("Files created successfully! Email templates require vendor email addresses to be configured.");
      }
      
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
            const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
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
                .replace(/\{\{supplierAccountNumber\}\}/g, vendorInfo.account_number || vendorInfo.accountNumber || '')
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
            const vendorInfo = emailSettings.vendorEmails[vendorName];
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
    // Only open .oft Outlook template files
    const oftFiles = downloadLinks.filter(f => {
      if (!f) return false;
      const fname = (f.file || f.filename || '').toString().toLowerCase();
      if (fname.endsWith('.oft')) return true;
      if (f.fileType && f.fileType.toLowerCase() === 'oft') return true;
      if (f.type === 'email' && f.isOutlookTemplate) return true;
      return false;
    });

    if (oftFiles.length === 0) {
      alert('No .oft template files found to open.');
      return;
    }

    let opened = 0;
    const failed = [];

    // Open each .oft using the platform open API exposed by preload
    (async () => {
      for (const file of oftFiles) {
        try {
          const pathToOpen = file.path || file.file || file.filename;
          if (!pathToOpen) {
            failed.push({ file, reason: 'No path available' });
            continue;
          }

          if (window.api && window.api.openOftFile) {
            const res = await window.api.openOftFile(pathToOpen);
            if (res && res.success) {
              opened++;
            } else {
              // Fallback to downloadFile if openOftFile returned non-success
              if (window.api && window.api.downloadFile && file.file) {
                try {
                  const dres = await window.api.downloadFile(file.file);
                  if (dres && dres.success && dres.path) {
                    window.open(dres.path);
                    opened++;
                    continue;
                  }
                } catch (dErr) {}
              }
              failed.push({ file, reason: (res && res.error) ? res.error : 'openOftFile failed' });
            }
          } else if (window.api && window.api.downloadFile && file.file) {
            // No openOftFile available, fallback to downloading/opening the file
            try {
              const dres = await window.api.downloadFile(file.file);
              if (dres && dres.success && dres.path) {
                window.open(dres.path);
                opened++;
                continue;
              }
              failed.push({ file, reason: (dres && dres.error) ? dres.error : 'downloadFile failed' });
            } catch (dErr) {
              failed.push({ file, reason: dErr?.message || String(dErr) });
            }
          } else {
            failed.push({ file, reason: 'No API available to open file' });
          }
        } catch (err) {
          failed.push({ file, reason: err?.message || String(err) });
        }
      }

      let msg = `Attempted to open ${oftFiles.length} .oft file(s). Successfully opened: ${opened}.`;
      if (failed.length > 0) {
        msg += `\nFailed to open ${failed.length} file(s). See console for details.`;
        console.error('Failed to open .oft files:', failed);
      }
      alert(msg);
    })();
  };

  // Delete a generated file from database and filesystem
  const handleDeleteFile = async (file, fileIndex) => {
    if (!window.confirm(`Are you sure you want to delete "${file.file}"?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting file:', file);
      
      // Delete from database if we have the necessary info
      // Handle both old and new object structures
      const vendor = file.vendor || file.supplier;
      const fileType = file.fileType || (file.isOutlookTemplate ? 'oft' : 'excel');
      
      if (vendor && fileType && selectedPRId) {
        console.log('🔍 Deleting from DB with:', { selectedPRId, vendor, fileType, filename: file.file });
        const success = await window.api.deleteGeneratedFile(selectedPRId, vendor, fileType, file.file);
        if (success) {
          console.log('✅ File deleted from database');
        } else {
          console.warn('⚠️ Could not delete from database');
        }
      } else {
        console.warn('⚠️ Missing info for database deletion:', { vendor, fileType, selectedPRId, file });
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

  const handleSendEmails = async (freshFiles = null) => {
    console.log('🚀🚀🚀 HANDLESENDEMAILS FUNCTION CALLED!!! 🚀🚀🚀');
    console.log('🚀 handleSendEmails clicked!');
    console.log('🔍 DEBUG: downloadLinks at start of handleSendEmails:', downloadLinks.length, downloadLinks.map(dl => dl.file));
    console.log('🔍 DEBUG: freshFiles parameter:', freshFiles ? freshFiles.length : 'null', freshFiles ? freshFiles.map(f => f.file) : 'none');
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
            const itemSupplier = getSupplierName(item);
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
            const itemSupplier = getSupplierName(item);
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
          console.log(`   Item ${index}: "${item["Product Name"] || item.name}" - Supplier: "${getSupplierName(item)}"`);
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
          // If we are in a recreate run (there are existing downloadLinks), allow overwrite
          const isRecreate = Array.isArray(downloadLinks) && downloadLinks.some(f => f && f.type !== 'placeholder');
          if (hasOftFiles && !isRecreate) {
            console.log('⚠️ Vendor already has .oft files created, skipping to avoid duplicates:', cleanVendorName);
            continue; // Skip this vendor only if NOT recreating
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
          const itemSupplier = getSupplierName(item);
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
            .replace(/\{\{supplierAccountNumber\}\}/g, actualVendorInfo.account_number || actualVendorInfo.accountNumber || '')
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
        
        // Debug attachment logic - look specifically for Excel files, not OFT files
        // Use freshFiles if provided (for automatic workflow), otherwise use downloadLinks (for manual workflow)
        const filesToSearch = freshFiles || downloadLinks;
        const potentialAttachment = filesToSearch.find(f => {
          const fname = (f.file || f.filename || '').toString();
          return fname.includes(cleanVendorName) && (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.html') || fname.endsWith('.htm') || fname.endsWith('.pdf') || f.type === 'file');
        });
        // Construct the correct path: prefer absolute path fields if present, otherwise join outputFolder and relative file
        let attachmentFilePath = null;
        if (includeAttachments && createFiles && potentialAttachment) {
          attachmentFilePath = potentialAttachment.path || potentialAttachment.file_path || potentialAttachment.file || '';
          if (attachmentFilePath && !attachmentFilePath.startsWith('/') && !attachmentFilePath.match(/^[A-Za-z]:\\/)) {
            // Likely a relative path - prefix with outputFolder
            attachmentFilePath = `${outputFolder}\\${attachmentFilePath}`;
          }
        }
        console.log('Attachment debug for', cleanVendorName, ':', {
          includeAttachments,
          createFiles,
          potentialAttachment,
          attachmentFilePath,
          attachmentFileExists: attachmentFilePath ? '(checking...)' : 'NO FILE',
          downloadLinks: downloadLinks.map(dl => dl.file)
        });
        
        // Check if attachment file actually exists on disk
        if (attachmentFilePath) {
          console.log('🔍 CRITICAL: Attachment file path being sent to backend:', attachmentFilePath);
          console.log('🔍 CRITICAL: Potential attachment object:', potentialAttachment);
          
          // Try to check if file exists via API
          try {
            const fileExists = await window.api.fileExists(attachmentFilePath);
            console.log('🔍 CRITICAL: Attachment file exists on disk:', fileExists);
          } catch (checkErr) {
            console.error('🔍 CRITICAL: Could not check if attachment file exists:', checkErr);
          }
        }
        
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

  // Defer deletion of existing .oft files until we confirm new .oft files were created successfully.

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
        console.log('🔍 DEBUG: emailFiles from backend:', emailFiles);
        console.log('🔍 DEBUG: processedEmailData:', processedEmailData);
          // Before marking new files, delete any existing .oft files for these vendors so they are replaced cleanly
          try {
            const existingOftFiles = await window.api.getGeneratedFiles(pr.id || pr._id, 'oft');
            if (existingOftFiles && existingOftFiles.length > 0) {
              for (const emailData of processedEmailData) {
                const vendorName = emailData.vendorName;
                const matches = existingOftFiles.filter(f => f.vendor_name === vendorName || f.vendor === vendorName);
                if (matches && matches.length > 0) {
                  console.log('\u26a0\ufe0f Deleting previous .oft files for vendor before marking new ones:', vendorName, matches.map(m => m.filename));
                  for (const m of matches) {
                    try {
                      await window.api.deleteGeneratedFile(pr.id || pr._id, m.vendor_name || m.vendor || vendorName, 'oft', m.filename);
                      console.log('\u2705 Deleted old .oft DB record:', m.filename);
                    } catch (delErr) {
                      console.warn('Could not delete old .oft DB record:', m, delErr);
                    }
                    if (m.file_path) {
                      try {
                        await window.api.deleteFileFromDisk(m.file_path);
                        console.log('\u2705 Deleted old .oft from disk:', m.file_path);
                      } catch (diskErr) {
                        console.warn('Could not delete old .oft file from disk:', m.file_path, diskErr);
                      }
                    }
                  }
                }
              }
            }
          } catch (cleanupErr) {
            console.warn('Failed to clean up existing .oft files before marking new ones:', cleanupErr);
          }

          for (const emailData of processedEmailData) {
          try {
            // Find the corresponding file that was created for this vendor
            console.log('🔍 DEBUG: Looking for vendor:', emailData.vendorName);
            console.log('🔍 DEBUG: Available files:', emailFiles.map(f => ({ 
              vendor: f.vendor, 
              filename: f.filename,
              vendorLength: f.vendor ? f.vendor.length : 'null',
              vendorMatch: f.vendor === emailData.vendorName
            })));
            console.log('🔍 DEBUG: Target vendor length:', emailData.vendorName.length);
            
            const vendorFile = emailFiles.find(file => file.vendor === emailData.vendorName);
            console.log('🔍 DEBUG: Found vendorFile:', vendorFile);
            
            const filename = vendorFile ? vendorFile.filename : '';
            const filePath = vendorFile ? vendorFile.path : '';  // Changed from file.file to file.path
            const fileSize = vendorFile ? vendorFile.size || 0 : 0;
            
            console.log('🔍 DEBUG: Calling markVendorFilesCreated with:', {
              prId: pr.id || pr._id,
              vendor: emailData.vendorName,
              type: 'oft',
              filename,
              filePath,
              fileSize
            });
            
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
          path: file.path,  // Changed from file.file to file.path to match backend
          vendor: file.vendor,
          email: file.email,
          type: 'email',
          isOutlookDraft: file.isOutlookDraft || false,
          isOutlookTemplate: true  // .oft files are always Outlook templates
        }));
        
        // After creating .oft files, reload all files from database to show them in UI
        await loadExistingFiles(pr.id || pr._id, outputFolder);
        
        setEmailMode(false);
      } else {
        throw new Error(result.error || "Failed to create template files");
      }
    } catch (err) {
      alert(`Failed to open email client: ${err.message}`);
    }
    setSendingEmails(false);
  };

  // Direct email creation function for streamlined workflow
  const handleSendEmailsDirectly = async (vendorEmailsObj, vendorGroups, purNumber, files = []) => {
    console.log('🔄 Starting direct email template creation...');
    
    // Validate output folder is selected
    if (!outputFolder) {
      throw new Error("Please select an output folder before creating email template files.");
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
  .replace(/\{\{supplierAccountNumber\}\}/g, vendorEmailsObj[supplierName]?.account_number || vendorEmailsObj[supplierName]?.accountNumber || '')
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

    // Group items by vendor directly from vendor groups
    let emailData = [];
    
    // Check if we have real CSV files (not placeholder entries)
    const realFiles = files.filter(file => file.type !== 'email' && file.type !== 'placeholder' && file.file);
    
    if (realFiles.length > 0) {
      // If CSV files exist, prepare email data from files
      console.log('📁 Processing real files for email data:', realFiles.map(f => f.file));
      emailData = realFiles.map(file => {
        // Extract vendor name from filename
        let vendorName = file.file.split('_')[0] || file.file.split('.')[0];
        
        // Clean up vendor name - remove any duplicate parts separated by "/"
        if (vendorName.includes('/')) {
          vendorName = vendorName.split('/')[0];
        }
        if (vendorName.includes('\\')) {
          vendorName = vendorName.split('\\')[0];
        }
        
        const vendorInfo = vendorEmailsObj[vendorName] || {};
        const vendorItems = vendorGroups[vendorName] || [];
        
        return { vendorName, vendorInfo, vendorItems };
      });
    } else {
      // If no CSV files, create email data directly from vendorEmailsObj
      console.log('🚀 Creating email data from vendor emails...');
      emailData = Object.keys(vendorEmailsObj || {}).map(vendorName => {
        const vendorInfo = vendorEmailsObj[vendorName] || {};
        const vendorItems = vendorGroups[vendorName] || [];
        
        return { vendorName, vendorInfo, vendorItems };
      });
    }

    console.log('📧 Preparing to create email templates for vendors:', emailData.map(e => e.vendorName));

    // Prepare the API call data
    const emailFiles = [];
    for (const { vendorName, vendorInfo, vendorItems } of emailData) {
      // Skip vendors with no email
      if (!vendorInfo.email || vendorInfo.email.trim() === '') {
        console.log(`⚠️ Skipping ${vendorName} - no email address`);
        continue;
      }

      // Replace template variables with vendor-specific content
      const personalizedSubject = replaceTemplateVariables(rawTemplate.subject, vendorName);
      const personalizedBody = replaceTemplateVariables(rawTemplate.body, vendorName);
      const personalizedSignature = replaceTemplateVariables(rawTemplate.signature, vendorName);

      // Find corresponding Excel file for this vendor (if attachments are enabled)
      let excelFilePath = null;
      if (createFiles && realFiles.length > 0) {
        const matchingFile = realFiles.find(file => {
          let fileVendorName = file.file.split('_')[0] || file.file.split('.')[0];
          if (fileVendorName.includes('/')) {
            fileVendorName = fileVendorName.split('/')[0];
          }
          if (fileVendorName.includes('\\')) {
            fileVendorName = fileVendorName.split('\\')[0];
          }
          return fileVendorName === vendorName;
        });
        
        if (matchingFile) {
          excelFilePath = matchingFile.file;
        }
      }

      // Add to email files array
      emailFiles.push({
        vendorName: vendorName,
        email: vendorInfo.email,
        subject: personalizedSubject,
        message: personalizedBody + '\n\n' + personalizedSignature,
        attachmentFile: excelFilePath
      });
    }

    console.log('📧 Sending emails for', emailFiles.length, 'vendors');
    console.log('📧 Email files data:', emailFiles.map(ef => ({
      vendorName: ef.vendorName,
      email: ef.email,
      hasSubject: !!ef.subject,
      subjectLength: ef.subject?.length || 0,
      hasMessage: !!ef.message,
      messageLength: ef.message?.length || 0,
      attachmentFile: ef.attachmentFile,
      attachmentExists: !!ef.attachmentFile
    })));
    
    // Log the actual email files data structure
    console.log('📧 Full email files data:');
    emailFiles.forEach((ef, idx) => {
      console.log(`   Email ${idx}:`, {
        vendorName: ef.vendorName,
        email: ef.email,
        subject: ef.subject?.substring(0, 50) + '...',
        messagePreview: ef.message?.substring(0, 100) + '...',
        attachmentFile: ef.attachmentFile
      });
    });

    if (emailFiles.length === 0) {
      throw new Error("No vendors with email addresses found. Please check supplier email configuration in Admin Portal.");
    }

    // Call the API to create .oft template files
    const result = await window.api.sendSupplierEmails(emailFiles, outputFolder);
    console.log('📧 API Result:', result);
    console.log('📧 API Result type:', typeof result);
    console.log('📧 API Result keys:', Object.keys(result || {}));
    console.log('📧 API Result success:', result?.success);
    console.log('📧 API Result error:', result?.error);
    console.log('📧 API Result createdOftFiles:', result?.createdOftFiles);
    console.log('📧 API Result oftFiles:', result?.oftFiles);
    console.log('📧 API Result details:', result?.details);
    if (result?.details && Array.isArray(result.details)) {
      console.log('📧 Details breakdown:');
      result.details.forEach((detail, idx) => {
        console.log(`   Detail ${idx}:`, detail);
      });
    }

    if (result && result.success) {
      // Return the created .oft files for display
      const oftFiles = result.createdOftFiles || result.oftFiles || [];
      console.log('📧 Using oftFiles array:', oftFiles);
      return oftFiles.map(oftFile => ({
        vendor: oftFile.vendor || oftFile.vendorName,
        type: 'email',
        filename: oftFile.filename,
        path: oftFile.path,
        file: oftFile.path
      }));
    } else {
      console.error('❌ API call failed:', result);
      throw new Error(result?.error || "Failed to create any .oft files");
    }
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

  // Whether there are real generated files (not placeholders)
  const hasFiles = downloadLinks.some(file => file.type !== 'placeholder');
  const createButtonLabel = loading ? 'Processing...' : (hasFiles ? 'Recreate Supplier Emails' : 'Create Supplier Emails');

  return (
    <div className="center-card">
  {/* UI cleaned: debug panel removed */}
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
        {/* Row 1: Folder Picker + PR selector and options on the right */}
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

          {/* PR selector and option checkboxes on the same line, aligned right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 18, minHeight: 48 }}>
            <label htmlFor="pr-select" style={{ height: 48, display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12, boxSizing: 'border-box', fontWeight: 600, fontSize: 15, paddingTop: 12, transform: 'translateY(10px)' }}>PO:</label>
            <select
              id="pr-select"
              value={selectedPRId || ''}
              onChange={e => setSelectedPRId(e.target.value)}
              style={{
                fontSize: 15,
                height: 48,
                lineHeight: '48px',
                paddingLeft: 12,
                paddingRight: 12,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
                border: '1px solid #bbb',
                background: '#fff',
                outline: 'none',
                boxSizing: 'border-box',
                minWidth: 260
              }}
            >
              <option value="">-- Select Active PO --</option>
              {activePRs && activePRs.length > 0 && activePRs.map(pr => (
                <option key={pr.id || pr._id} value={pr.id || pr._id}>
                  {pr.name ? pr.name : `PO #${pr.id || pr._id}`}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="create-files"
                  checked={createFiles}
                  onChange={(e) => setCreateFiles(e.target.checked)}
                  style={{ width: 16, height: 16, margin: 0, verticalAlign: 'middle' }}
                />
                <label htmlFor="create-files" style={{ fontSize: 14, color: '#374151', margin: 0 }}>Create order files</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="include-attachments"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  disabled={!createFiles}
                  style={{ width: 16, height: 16, margin: 0, verticalAlign: 'middle', opacity: createFiles ? 1 : 0.5 }}
                />
                <label htmlFor="include-attachments" style={{ fontSize: 14, color: createFiles ? '#374151' : '#9ca3af', margin: 0 }}>Include attachments</label>
              </div>
            </div>
          </div>
  </div>
      </div>
      {/* If files already exist, show them above the create button grouped by type */}
      {hasFiles && (
        <div style={{ marginTop: 18 }}>
          <h4>Existing Generated Files</h4>

          {/* Vendor search (single plain input) */}
          <div data-gsf-filter-area style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
            <span style={{ height: 48, display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12, boxSizing: 'border-box', fontWeight: 600 }}>Filter:</span>
            <input
              id="gsf-vendor-search"
              type="text"
              placeholder="Vendor name or filename"
              value={vendorSearch}
              onChange={e => setVendorSearch(e.target.value)}
              style={{ height: 40, padding: '0 12px', borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box', width: '100%', maxWidth: 640 }}
            />
          </div>

          {/* Excel group */}
            {(() => {
            const excelFiles = downloadLinks.filter(f => f && (f.fileType === 'excel' || (f.type === 'file' && !f.isOutlookTemplate)));
            const excelFilesFiltered = vendorSearch && vendorSearch.trim() !== '' ? excelFiles.filter(f => {
              const hay = ((f.vendor || '') + ' ' + (f.file || '')).toLowerCase();
              return hay.includes(vendorSearch.toLowerCase());
            }) : excelFiles;
            return (
              <div style={{ marginBottom: 12, border: '1px solid #e6eef7', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f6fbff', padding: '8px 12px', cursor: 'pointer' }} onClick={() => setExcelOpen(prev => !prev)}>
                  <div style={{ fontWeight: 600 }}>PO</div>
                  <div style={{ fontSize: 13, color: '#0369a1' }}>{excelFiles.length} {excelFiles.length === 1 ? 'file' : 'files'} {excelOpen ? '▾' : '▸'}</div>
                </div>
                {excelOpen && (
                  <ul style={{ paddingLeft: 20, listStyle: 'none', margin: 0 }}> 
                    {excelFilesFiltered.map((file, idx) => {
                      const globalIdx = downloadLinks.findIndex(dl => dl === file || (dl.file === file.file && dl.vendor === file.vendor));
                      return (
                        <li key={idx} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button type="button" onClick={async () => {
                            const pathToOpen = file.path || file.file;
                            if (pathToOpen && window.api && window.api.openOftFile) {
                              await window.api.openOftFile(pathToOpen);
                            }
                          }} style={{ background: 'none', border: 'none', color: '#1867c0', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', flex: 1, textAlign: 'center' }}>
                            📄 {file.file}
                          </button>
                          <button type="button" onClick={() => handleDeleteFile(file, globalIdx)} style={{ background: '#ff4444', border: 'none', color: 'white', borderRadius: '3px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', marginLeft: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete file">×</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}

          {/* OFT group */}
            {(() => {
            const oftFiles = downloadLinks.filter(f => f && (f.fileType === 'oft' || (f.type === 'email' && f.isOutlookTemplate) || (f.file && f.file.toLowerCase().endsWith('.oft'))));
            const oftFilesFiltered = vendorSearch && vendorSearch.trim() !== '' ? oftFiles.filter(f => {
              const hay = ((f.vendor || '') + ' ' + (f.file || '')).toLowerCase();
              return hay.includes(vendorSearch.toLowerCase());
            }) : oftFiles;
            return (
              <div style={{ marginBottom: 12, border: '1px solid #eef7f6', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf9', padding: '8px 12px', cursor: 'pointer' }} onClick={() => setOftOpen(prev => !prev)}>
                  <div style={{ fontWeight: 600 }}>Outlook Templates (.oft)</div>
                  <div style={{ fontSize: 13, color: '#059669' }}>{oftFiles.length} {oftFiles.length === 1 ? 'file' : 'files'} {oftOpen ? '▾' : '▸'}</div>
                </div>
                {oftOpen && (
                  <ul style={{ paddingLeft: 20, listStyle: 'none', margin: 0 }}>
                    {oftFilesFiltered.map((file, idx) => {
                      const globalIdx = downloadLinks.findIndex(dl => dl === file || (dl.file === file.file && dl.vendor === file.vendor));
                      return (
                        <li key={idx} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button type="button" onClick={async () => {
                            const pathToOpen = file.path || file.file;
                            if (pathToOpen && window.api && window.api.openOftFile) {
                              await window.api.openOftFile(pathToOpen);
                            }
                          }} style={{ background: 'none', border: 'none', color: '#1867c0', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', flex: 1, textAlign: 'center' }}>
                            {file.isOutlookTemplate ? '📝' : '📧'} {file.file}
                          </button>
                          <button type="button" onClick={() => handleDeleteFile(file, globalIdx)} style={{ background: '#ff4444', border: 'none', color: 'white', borderRadius: '3px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', marginLeft: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete file">×</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            {createFiles && (
              <button style={{ width: '100%', background: '#006bb6', color: '#fff', fontWeight: 600, padding: '10px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }} onClick={handleDownloadAll} type="button">Open All Supplier emails</button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", marginTop: 10 }}>
        <button
          type="button"
          disabled={loading || !selectedPRId || !outputFolder || !apiKeySet}
          onClick={handleCreateSupplierOrderFilesFromPR}
          style={{
            fontWeight: 600,
            backgroundColor: loading || !selectedPRId || !outputFolder || !apiKeySet ? "#eee" : "#22b573",
            color: loading || !selectedPRId || !outputFolder || !apiKeySet ? "#888" : "white",
            padding: "14px 0",
            border: "none",
            borderRadius: "6px",
            cursor: loading || !selectedPRId || !outputFolder || !apiKeySet ? "not-allowed" : "pointer",
            fontSize: "1.1em",
            width: "100%",
            transition: "background 0.2s"
          }}
        >
          {createButtonLabel}
        </button>
      </div>
      
      {/* Email Setup Section - Shows immediately when PUR is selected */}
      {selectedPRId && emailMode && Object.keys(emailSettings.vendorEmails || {}).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h4>📧 Review Vendor Emails</h4>
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: 20
          }}>
            <div style={{ 
              background: "#e0f2fe", 
              border: "1px solid #0891b2", 
              borderRadius: "6px", 
              padding: "12px", 
              marginBottom: 20,
              fontSize: "14px",
              color: "#0c4a6e"
            }}>
              <strong>📝 Note:</strong> Review and edit vendor email addresses below. These are auto-populated from your supplier database.
            </div>

            {/* Vendor Email Addresses */}
            <div>
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
          </div>
        </div>
      )}

  {downloadLinks.length > 0 && !hasFiles && (
        <div style={{ marginTop: 28 }}>
          <h4>
            {createFiles ? "📁 Files Created Successfully" : "📧 Email Templates Created Successfully"}
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
          </div>

          {/* File List - Show all created files */}
          {downloadLinks.some(file => file.type !== 'placeholder') ? (
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
                        } else if (file.type === 'email') {
                          // Handle .oft template files (prefer file.path)
                          try {
                            const pathToOpen = file.path || file.file;
                            if (!pathToOpen) {
                              alert('No file path available to open the email template');
                            } else if (window.api && window.api.openOftFile) {
                              const result = await window.api.openOftFile(pathToOpen);
                              if (!result || !result.success) {
                                alert(`Failed to open email template file: ${result && result.error ? result.error : 'Unknown error'}`);
                              } else {
                                console.log(`Opened .oft template file: ${pathToOpen}`);
                              }
                            } else {
                              // Fallback: try downloadFile if openOftFile not available
                              if (window.api && window.api.downloadFile && file.file) {
                                try {
                                  const res = await window.api.downloadFile(file.file);
                                  if (res && res.success && res.path) {
                                    window.open(res.path);
                                  } else {
                                    const msg = res && (res.error || (res.details ? JSON.stringify(res.details) : null)) ? (res.error || JSON.stringify(res.details)) : 'Unknown error';
                                    alert('Failed to open email template file: ' + msg);
                                  }
                                } catch (innerErr) {
                                  alert('Failed to open email template file: ' + (innerErr?.message || innerErr));
                                }
                              } else {
                                alert('Email template file opening not available');
                              }
                            }
                          } catch (e) {
                            alert(`Failed to open email template file: ${e.message}`);
                          }
                        } else {
                          // Handle regular files (Excel/CSV)
                          try {
                            const pathToOpen = file.path || file.file;
                            if (pathToOpen && window.api && window.api.openOftFile) {
                              // openOftFile is a general openPath API in main process
                              await window.api.openOftFile(pathToOpen);
                            } else if (window.api && window.api.downloadFile && file.file) {
                              try {
                                const res = await window.api.downloadFile(file.file);
                                if (res && res.success && res.path) {
                                  window.open(res.path);
                                } else {
                                  const msg = res && (res.error || (res.details ? JSON.stringify(res.details) : null)) ? (res.error || JSON.stringify(res.details)) : 'Unknown error';
                                  alert('Failed to open file: ' + msg);
                                }
                              } catch (innerErr) {
                                alert('Failed to open file: ' + (innerErr?.message || innerErr));
                              }
                            } else {
                              alert('File open not available');
                            }
                          } catch (e) {
                            console.error('Failed to open file:', e);
                          }
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
                <p style={{ margin: 0 }}>
                  No files have been created yet.
                </p>
              </div>
            )}
        </div>
      )}
      {error && <div className="error-msg" style={{ marginTop: 28 }}>{error}</div>}
    </div>
  );
}

export default GenerateSupplierFiles;
