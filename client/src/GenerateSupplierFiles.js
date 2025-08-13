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

  const handleCreateSupplierOrderFilesFromPR = async () => {
    setError("");
    setDownloadLinks([]);
    if (!selectedPRId) {
      setError("Please select a Purchase Order to send orders to suppliers.");
      return;
    }
    if (!outputFolder) {
      setError("Please select an output folder for the email files.");
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
      } else {
        // Don't create virtual file entries when files aren't actually created
        files = [];
        // Automatically create email files when not creating CSV files
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

      // Extract vendor emails from files and populate from suppliers database
      const vendorEmailsObj = {};
      for (const file of files) {
        // Extract vendor name from filename (assuming format like "VendorName_PUR00001.csv")
        let vendorName = file.file.split('_')[0] || file.file.split('.')[0];
        
        // Clean up vendor name - remove any duplicate parts separated by "/"
        if (vendorName.includes('/')) {
          const parts = vendorName.split('/');
          vendorName = parts[0]; // Take the first part
        }
        
        // Try to get email from suppliers database
        try {
          const supplier = await window.api.getSupplierByName(vendorName);
          const supplierEmail = (supplier && supplier.email) ? supplier.email : "";
          const contactName = (supplier && supplier.contact_name) ? supplier.contact_name : "";
          
          vendorEmailsObj[vendorName] = {
            email: supplierEmail,
            contactName: contactName
          };
        } catch (err) {
          vendorEmailsObj[vendorName] = { email: "", contactName: "" }; // Empty if supplier not found
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
        // Directly create email files
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
          const emailData = Object.keys(vendorGroups).map(vendorName => {
            const vendorInfo = vendorEmailsObj[vendorName] || {};
            const vendorItems = vendorGroups[vendorName];
            
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
${supplierSpecificMessage.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
${supplierSpecificSignature.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
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

  const handleSendEmails = async () => {
    setSendingEmails(true);
    try {
      if (!window.api || !window.api.sendSupplierEmails) {
        throw new Error("Email functionality not available");
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

      // Group items by vendor directly from the PR data if no CSV files exist
      let emailData = [];
      
      // Check if we have real CSV files (not placeholder entries)
      const realFiles = downloadLinks.filter(file => file.type !== 'email' && file.type !== 'placeholder' && file.file);
      
      if (realFiles.length > 0) {
        // If CSV files exist, prepare email data from files
        emailData = realFiles.map(file => {
          // Extract vendor name from filename - handle cases like "VendorName_PUR00001.csv" or "VendorName/VendorName_PUR00001.csv"
          let vendorName = file.file.split('_')[0] || file.file.split('.')[0];
          
          // Clean up vendor name - remove any duplicate parts separated by "/"
          if (vendorName.includes('/')) {
            const parts = vendorName.split('/');
            vendorName = parts[0]; // Take the first part
          }
          
          const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
          
          // Get items for this vendor from the original PR
          const vendorItems = pr?.items?.filter(item => {
            const itemSupplier = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
            return itemSupplier === vendorName;
          }) || [];
          
          return { vendorName, vendorInfo, vendorItems };
        });
      } else {
        // If no CSV files, create email data directly from emailSettings.vendorEmails
        emailData = Object.keys(emailSettings.vendorEmails || {}).map(vendorName => {
          const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
          
          // Get items for this vendor from the original PR
          const vendorItems = pr?.items?.filter(item => {
            const itemSupplier = item["Supplier Name"] || item.supplier_name || "Unknown Supplier";
            return itemSupplier === vendorName;
          }) || [];
          
          return { vendorName, vendorInfo, vendorItems };
        });
      }

      // Process each vendor's email data
      const processedEmailData = emailData.map(({ vendorName, vendorInfo, vendorItems }) => {
        
        // Create both HTML and plain text tables for this vendor's items
        let htmlTable = '';
        let plainTextTable = '';
        
        if (vendorItems.length > 0) {
          // HTML Table (preferred)
          const htmlTableRows = vendorItems.map(item => {
            const productName = item["Product Name"] || item.name || "Unknown Product";
            const quantity = item["No. to Order"] ?? item.no_to_order ?? 0;
            return `<tr><td style="border: 1px solid #ddd; padding: 8px;">${productName}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${quantity}</td></tr>`;
          }).join('');
          
          htmlTable = `\n\nORDER DETAILS:\n\n<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tr style="background-color: #f0f0f0;"><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product Name</th><th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th></tr>${htmlTableRows}</table>\n\nPlease confirm receipt and estimated delivery date.\n\n`;
          
          // Plain Text Table (fallback)
          const tableHeader = '\n\n\nORDER DETAILS:\n' + 
                             '================================================\n' +
                             'Product Name                          Quantity\n' +
                             '================================================\n';
          
          const plainTextRows = vendorItems.map(item => {
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
          // Create HTML table for this supplier
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

          const vendorInfo = emailSettings.vendorEmails[vendorName] || {};
          
          return text
            // Double brace variables (new format)
            .replace(/\{\{orderNumber\}\}/g, purNumber)
            .replace(/\{\{supplierName\}\}/g, vendorName)
            .replace(/\{\{supplierEmail\}\}/g, vendorInfo.email || '')
            .replace(/\{\{supplierContactName\}\}/g, vendorInfo.contactName || '')
            .replace(/\{\{supplierInstructions\}\}/g, vendorInfo.special_instructions || vendorInfo.comments || '')
            .replace(/\{\{orderTable\}\}/g, orderTableContent)
            .replace(/\{\{currentDate\}\}/g, new Date().toLocaleDateString())
            .replace(/\{\{companyName\}\}/g, 'The Good Life Clinic')
            // Single brace variables (backward compatibility)
            .replace(/\{purchaseOrderNumber\}/g, purNumber)
            .replace(/\{supplierName\}/g, vendorName)
            .replace(/\{contactName\}/g, vendorInfo.contactName || '')
            .replace(/\{date\}/g, new Date().toLocaleDateString())
            .replace(/\{companyName\}/g, 'The Good Life Clinic');
        };

        // Use the replacement function to process template for this specific supplier
        const supplierSpecificSubject = replaceVarsForSupplier(rawTemplate.subject);
        const supplierSpecificMessage = replaceVarsForSupplier(rawTemplate.body);
        const supplierSpecificSignature = replaceVarsForSupplier(rawTemplate.signature);

        // Wrap the entire email content in HTML for proper formatting
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
${supplierSpecificMessage.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
${supplierSpecificSignature.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
</body>
</html>
        `.trim();
        
        console.log('Final email for', vendorName, ':', finalEmailMessage);
        
        return {
          vendorName,
          email: typeof vendorInfo === 'string' ? vendorInfo : (vendorInfo.email || ""),
          subject: supplierSpecificSubject,
          message: finalEmailMessage,
          fallbackMessage: finalEmailMessage, // Same content for both since template handles formatting
          attachmentFile: includeAttachments && createFiles && downloadLinks.find(f => f.file.includes(vendorName)) ? `${outputFolder}/${downloadLinks.find(f => f.file.includes(vendorName)).file}` : null // Only attach if both options are enabled
        };
      }).filter(email => email.email.trim() !== ""); // Only send to vendors with email addresses

      if (processedEmailData.length === 0) {
        setSendingEmails(false);
        // Keep email mode open so user can enter email addresses
        setEmailMode(true);
        return;
      }

      const result = await window.api.sendSupplierEmails(processedEmailData);
      
      if (result.success) {
        // Show success message with instructions for .oft files
        let message = `Successfully created ${result.sentCount} email template file(s)!\n\n`;
        message += `Email template files have been saved to your output folder:\n`;
        result.emlFiles.forEach(eml => {
          message += `• ${eml.filename} (${eml.vendor})\n`;
        });
        message += `\nDouble-click any .oft file to open it as an editable template in Outlook, or drag the files to your email application.`;
        
        if (result.errors && result.errors.length > 0) {
          message += `\n\nNote: ${result.errors.join(', ')}`;
        }
        alert(message);
        
        // Update downloadLinks to include .eml files for display
        const emlLinks = result.emlFiles.map(eml => ({
          file: eml.filename,
          path: eml.file,
          vendor: eml.vendor,
          email: eml.email,
          type: 'email',
          isOutlookDraft: eml.isOutlookDraft || false
        }));
        
        // Replace placeholder entries with actual email files
        setDownloadLinks(prev => {
          console.log('Current downloadLinks:', prev);
          console.log('Adding emlLinks:', emlLinks);
          // Remove placeholder entries and add email files
          const nonPlaceholderLinks = prev.filter(link => link.type !== 'placeholder');
          const newLinks = [...nonPlaceholderLinks, ...emlLinks];
          console.log('New downloadLinks:', newLinks);
          return newLinks;
        });
        setEmailMode(false);
      } else {
        throw new Error(result.error || "Failed to create email files");
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
          {loading ? "Processing..." : createFiles ? "Send Orders to Suppliers" : "Prepare Email Template"}
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
                {emailMode ? "📋 View Files" : "📧 Open in Email"}
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
                {sendingEmails ? "📤 Creating..." : "📧 Create Email Files"}
              </button>
            </div>
          ) : (
            /* File List - Show both regular files and .oft template files */
            (createFiles || downloadLinks.some(file => file.type === 'email')) && downloadLinks.some(file => file.type !== 'placeholder') ? (
              <ul style={{ paddingLeft: 20, listStyle: "none" }}>
                {downloadLinks.filter(file => file.type !== 'placeholder').map((file, idx) => (
                  <li key={idx} style={{ marginBottom: 5 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        // Handle different file types
                        if (file.isOutlookDraft) {
                          // For Outlook drafts, just show info message
                          alert(`This email was created as a draft in Outlook. Please check your Outlook drafts folder for: ${file.vendor}`);
                        } else if (file.type === 'email' && file.path) {
                          // Handle .eml template files
                          try {
                            if (window.api && window.api.openEmlFile) {
                              const result = await window.api.openEmlFile(file.path);
                              if (!result.success) {
                                alert(`Failed to open email template file: ${result.error}`);
                              }
                            } else {
                              alert('Email file opening not available');
                            }
                          } catch (e) {
                            alert(`Failed to open email file: ${e.message}`);
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
                        fontSize: "14px"
                      }}
                    >
                      {file.isOutlookDraft ? '📧' : (file.type === 'email' ? '📧' : '📄')} {file.file}
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
                  Click "📧 Open in Email" to compose emails with order tables.
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
