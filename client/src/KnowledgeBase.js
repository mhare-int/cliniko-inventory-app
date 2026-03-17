import React, { useState } from 'react';
import './KnowledgeBase.css';

const KnowledgeBase = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const sections = [
    {
      id: 'overview',
      title: '📋 Overview',
      content: {
        title: 'What to do in this app',
        description: 'Use this app to check your stock levels, create purchase orders when items run low, and send orders to suppliers.',
        features: [
          'Check current stock levels and see what needs ordering',
          'Get AI-powered suggestions for how much to order',
          'Create purchase orders for products running low',
          'Generate Excel files to send to suppliers',
          'Track orders from creation to delivery',
          'View sales trends and performance data',
          'Set up volume discounts and supplier pricing',
          'Analyze supplier lead times and consolidate orders',
          'Run product audits to keep data clean',
          'Manage user accounts and track system usage'
        ],
  workflow: 'Set reorder points → Get AI suggestions → Create purchase orders → Generate supplier files → Email to suppliers → Receive and log deliveries'
      }
    },
    {
      id: 'first-time-setup',
      title: '🚀 First-Time Setup',
      content: {
        title: 'What to do when you first open the app',
        description: 'Follow three steps to get started: create an admin account, enter your Cliniko API key, and sync your products.',
        features: [
          'Step 1: Create an administrator account and log in',
          'Step 2: Enter your Cliniko API key (the app validates it before saving)',
          'Step 3: Click to sync products and suppliers - this runs immediately',
          'Sales sync runs in the background while you work',
          'You can use the app right away after products sync'
        ],
        tips: [
          'The app tests your API key to make sure it works',
          'Products sync quickly so you can start working',
          'Sales data syncs in the background - you\'ll see a small notification',
          'Go to Admin → Sales Data Sync anytime to sync more sales data'
        ],
        workflow: 'Open app → Create admin → Enter API key → Sync products → Start working while sales sync in background'
      }
    },
    {
      id: 'home',
      title: '🏠 Home Dashboard',
      content: {
        title: 'What to do on the home page',
        description: 'Click the big blue button to create purchase orders. Click the green button to generate supplier files. Use the tabs at the top to navigate.',
        features: [
          'Click "Create Purchase Orders" to start ordering stock',
          'Click "Generate Supplier Files" after creating orders',
          'Use the navigation tabs at the top to go to other pages',
          'See background sync progress in the small notification popup'
        ],
        tips: [
          'Start here each day to access main functions',
          'Use the big buttons instead of hunting through menus',
          'Navigation tabs are always available at the top',
          'Background sync shows progress when you log in'
        ]
      }
    },
    {
      id: 'master-list',
      title: '📋 Master Stock List',
      content: {
        title: 'What to do when managing products',
        description: 'Set reorder points for your products, use AI suggestions to determine order quantities, and click "Create PO" to place orders instantly.',
        features: [
          'Set reorder points by clicking on the numbers',
          'Use search boxes to filter by product or supplier',
          'Click "Suggest" for AI-powered order recommendations',
          'Get suggestions based on 90 days of sales history',
          'Click "Create PO" to order suggested quantities immediately',
          'Upload Excel files to set many reorder points at once',
          'Use barcode scanning to find products quickly',
          'Select multiple products for bulk operations'
        ],
        tips: [
          'Click "Suggest" to get smart ordering recommendations',
          'AI uses your sales history and supplier lead times',
          'Set supplier lead times in Admin Panel for better suggestions',
          'Use "Create PO" after getting suggestions for instant ordering',
          'Stock levels update automatically from Cliniko'
        ],
  workflow: 'Filter products → Set reorder points → Click "Suggest" → Review AI recommendations → Click "Create PO" to order'
      }
    },
    {
      id: 'create-pr',
  title: '📝 Create Purchase Orders',
      content: {
        title: 'What to do when creating orders',
        description: 'Search for products, tick "Include Negative" to see out-of-stock items, review suggested quantities, and submit your order.',
        features: [
          'Search for products in the dropdown',
          'Tick "Include Negative" to see items with zero or negative stock',
          'Look for red X marks showing out-of-stock products',
          'Review suggested quantities (app calculates based on reorder points)',
          'Products group automatically by supplier',
          'Adjust quantities before submitting'
        ],
        tips: [
          'Always tick "Include Negative" to see everything',
          'Red X marks = out of stock, green ticks = in stock',
          'The app groups items by supplier automatically',
          'Review quantities before clicking submit'
        ],
        workflow: 'Search products → Tick "Include Negative" → Find red X items → Adjust quantities → Submit order'
      }
    },
    {
      id: 'purchase-requests',
  title: '📋 Active Purchase Orders',
      content: {
        title: 'What to do when tracking orders',
  description: 'Check your current orders, update status as orders progress, mark complete when items arrive, and follow up with suppliers.',
        features: [
          'View all orders you haven\'t completed yet',
          'Update order status as things progress',
          'Mark orders complete when items arrive',
          'Edit orders if details change',
          'Cancel orders no longer needed',
          'See which supplier each order goes to'
        ],
        tips: [
          'Check this page regularly to track progress',
          'Update status when you send orders to suppliers',
          'Mark complete when deliveries arrive',
          'Use this to follow up on delayed orders'
        ],
        workflow: 'View current orders → Update status → Follow up on delays → Mark complete when delivered'
      }
    },
    {
      id: 'archived',
      title: '📚 Archived Requests',
      content: {
        title: 'What to do when reviewing history',
  description: 'Search past orders, analyze ordering patterns, reference previous quantities, and track supplier performance.',
        features: [
          'Search by date, supplier, or product',
          'Review past order quantities for guidance',
          'Track how well suppliers perform over time',
          'Export data for analysis in Excel',
          'Reorder items from past orders'
        ],
        tips: [
          'Use past orders to guide future quantities',
          'Track supplier delivery times and reliability',
          'Export data for deeper analysis',
          'Look for patterns in your ordering'
        ],
        workflow: 'Search archived orders → Review quantities and dates → Analyze patterns → Use insights for future orders'
      }
    },
    {
      id: 'generate-files',
      title: '🏢 Generate Supplier Files',
      content: {
        title: 'What to do when sending orders to suppliers',
  description: 'Generate Excel files from your purchase orders, download them, and email to suppliers. Each supplier gets their own file.',
        features: [
          'Click to generate Excel files from your orders',
          'Each supplier gets a separate file automatically',
          'Download links appear after files are created',
          'Files are formatted professionally for suppliers',
          'Use email templates with {{supplierAccountNumber}} variables',
          'On Windows, create Outlook .oft emails with attachments'
        ],
        tips: [
          'Create purchase orders first, then come here',
          'Download files immediately after generating',
          'Set supplier account numbers in Admin so {{supplierAccountNumber}} fills in',
          'Windows users can prepare Outlook emails automatically'
        ],
  workflow: 'Create purchase orders → Generate files → Download files → Email to suppliers'
      }
    },
    {
      id: 'receive-items',
      title: '📦 Receive Items',
      content: {
        title: 'What to do when deliveries arrive',
        description: 'Scan or enter received items, verify quantities match orders, note any issues, and update stock levels.',
        features: [
          'Scan barcodes as items arrive',
          'Enter quantities received',
          'Verify against purchase orders',
          'Note damaged or missing items',
          'Stock updates automatically',
          'Report discrepancies'
        ],
        tips: [
          'Scan items for accuracy',
          'Check quantities against what you ordered',
          'Note problems immediately',
          'Update stock right away'
        ],
        workflow: 'Scan items → Enter quantities → Verify against order → Note issues → Update stock'
      }
    },
    {
      id: 'sales-insights',
      title: '📊 Sales Insights',
      content: {
        title: 'What to do when analyzing sales',
        description: 'Select date ranges, review sales metrics, identify trends, and adjust your inventory strategy based on data.',
        features: [
          'Choose custom date ranges to analyze',
          'View sales trends and patterns',
          'See top-selling products',
          'Analyze seasonal patterns',
          'Track profit margins',
          'Check inventory turnover rates'
        ],
        tips: [
          'Review weekly for short-term trends',
          'Use seasonal data for planning',
          'Focus on high-margin, fast-moving items',
          'Compare time periods for growth'
        ],
        workflow: 'Select dates → Review metrics → Identify trends → Adjust ordering strategy'
      }
    },
    {
      id: 'supplier-discounts',
      title: '💰 Supplier Discounts',
      content: {
        title: 'What to do when setting up pricing',
        description: 'Create quantity-based discount bands, set supplier-wide or product-specific pricing, and configure effective dates for pricing changes.',
        features: [
          'Create quantity discounts (e.g., 10+ units = 5% off)',
          'Set supplier-wide or product-specific pricing',
          'Use percentage discounts or fixed prices',
          'Set date ranges for seasonal pricing',
          'Use bulk wizard to create multiple tiers quickly',
          'Add notes for special terms',
          'Edit or delete discounts anytime'
        ],
        tips: [
          'Use bulk wizard for quick setup of multiple bands',
          'Set effective dates for seasonal changes',
          'Configure supplier-wide discounts for preferred vendors',
          'Document special terms in the notes field',
          'Review active discounts regularly'
        ],
        workflow: 'Select supplier/product → Choose discount scope → Set quantity bands → Configure dates → Add notes → Create discount'
      }
    },
    {
      id: 'lead-time-insights',
      title: '⏱️ Lead Time Insights',
      content: {
        title: 'What to do when optimizing orders',
        description: 'Run vendor consolidation to group orders, review supplier lead times, and get individual product reorder suggestions with safety stock calculations.',
        features: [
          'View all suppliers with their lead times',
          'Run vendor consolidation (14-day window)',
          'See products needing reorder in next 2 weeks',
          'Get individual product suggestions with metrics',
          'Review historical lead time calculations',
          'See safety stock recommendations',
          'Configure service levels (default 95%)',
          'Track supplier performance'
        ],
        tips: [
          'Use vendor consolidation to save on shipping',
          'Check weekly to stay ahead of stock-outs',
          'Set supplier lead times manually for accuracy',
          'Review suggestions for high-value items',
          'Use historical data to validate estimates'
        ],
        workflow: 'Review lead times → Run consolidation → Check products needing reorder → Review suggestions → Plan consolidated orders'
      }
    },
    {
      id: 'product-audit',
      title: '🔍 Product Audit',
      content: {
        title: 'What to do when cleaning data',
        description: 'Run audit scans to find missing data, identify duplicates, check naming consistency, and clean up product records.',
        features: [
          'Find products with missing data',
          'Identify duplicate products',
          'Check naming consistency',
          'Review products without recent sales',
          'Find missing supplier information',
          'Validate barcodes and product IDs',
          'Export audit reports',
          'Bulk update for cleanup'
        ],
        tips: [
          'Run monthly audits to maintain quality',
          'Focus on high-value products first',
          'Use standard naming conventions',
          'Find discontinued products',
          'Clean data improves ordering accuracy'
        ],
        workflow: 'Run audit scan → Review flagged issues → Prioritize fixes → Clean data → Validate changes → Export report'
      }
    },
    {
      id: 'user-analytics',
      title: '📈 User Analytics',
      content: {
        title: 'What to do when tracking usage',
        description: 'Review user engagement metrics, analyze feature usage, identify patterns, and take action to improve workflows and training.',
        features: [
          'View user engagement metrics (sessions, page views, actions)',
          'Track feature usage frequency and duration',
          'See most visited pages',
          'Analyze individual user behavior patterns',
          'Choose time periods (7, 30, 90, 365 days)',
          'Review session statistics and login patterns',
          'See activity heatmaps and engagement scores',
          'Export for external analysis'
        ],
        tips: [
          'Review weekly to understand patterns',
          'Find features that need training',
          'Use data to optimize workflows',
          'Track new feature adoption',
          'Identify power users who can help train others'
        ],
        workflow: 'Go to Admin → User Analytics → Select time period → Review metrics → Analyze patterns → Take action'
      }
    },
    {
      id: 'admin',
      title: '⚙️ Admin Panel',
      content: {
        title: 'What to do when managing settings',
        description: 'Add users, change passwords, manage suppliers, configure email templates, sync sales data, and adjust system settings.',
        features: [
          'User Management: add users, change passwords, grant admin rights',
          'User Analytics: see feature usage and activity patterns',
          'Suppliers Management: add/edit suppliers, including Customer Account Number; restore inactive suppliers',
          'Email Template Management: edit supplier email templates; supports variables like {{supplierAccountNumber}}',
          'Email Supplier Management: generate and send supplier emails with attachments',
          'Sales Data Sync: preview invoices and run sales sync; shows estimated time (~3s per sale)',
          'Session Timeout: configure how long a login stays valid',
          'Settings: toggle features like Cliniko stock updates and Smart Prompts; set GitHub token for updates',
          'Supplier Cleanup: tools to reactivate or tidy supplier records',
          '🆕 Supplier Discounts: comprehensive discount and pricing management system',
          '🆕 Lead Time Insights: analyze and manage supplier lead times',
          '🆕 Advanced user behavior analytics with detailed engagement metrics'
        ],
        tips: [
          'Set supplier account numbers here so your email templates can include them',
          'Use Sales Data Sync to preview before running a large import',
          'If stock updates to Cliniko aren\'t desired, disable them in Settings',
          '🆕 Use Supplier Discounts to set up quantity-based pricing tiers',
          '🆕 Configure supplier lead times in Suppliers Management for accurate suggestions',
          '🆕 Check User Analytics to see which features are being used most'
        ]
      }
    }
  ];

  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActiveContent = () => {
    return sections.find(section => section.id === activeSection)?.content;
  };

  return (
    <div className="knowledge-base">
      <div className="kb-header">
        <h1>📚 Knowledge Base</h1>
        <p>Complete guide to using your inventory management system</p>
        
        <div className="kb-search">
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="kb-container">
        <div className="kb-sidebar">
          <h3>📖 Sections</h3>
          <div className="kb-nav">
            {filteredSections.map(section => (
              <button
                key={section.id}
                className={`kb-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-title">{section.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="kb-content">
          {getActiveContent() && (
            <>
              <div className="content-header">
                <h2>{getActiveContent().title}</h2>
                <p className="content-description">{getActiveContent().description}</p>
              </div>

              {getActiveContent().features && (
                <div className="content-section">
                  <h3>✨ Key Features</h3>
                  <ul className="feature-list">
                    {getActiveContent().features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {getActiveContent().tabs && (
                <div className="content-section">
                  <h3>🔧 Available Tabs</h3>
                  <div className="tabs-info">
                    {getActiveContent().tabs.map((tab, index) => (
                      <div key={index} className="tab-info">
                        <h4>{tab.name}</h4>
                        <p>{tab.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getActiveContent().workflow && (
                <div className="content-section workflow-section">
                  <h3>🔄 Typical Workflow</h3>
                  <div className="workflow-steps">
                    {getActiveContent().workflow.split(' → ').map((step, index, array) => (
                      <React.Fragment key={index}>
                        <div className="workflow-step">
                          <span className="step-number">{index + 1}</span>
                          <span className="step-text">{step.trim()}</span>
                        </div>
                        {index < array.length - 1 && <div className="workflow-arrow">→</div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {getActiveContent().tips && (
                <div className="content-section">
                  <h3>💡 Pro Tips</h3>
                  <ul className="tips-list">
                    {getActiveContent().tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="content-section getting-started">
                <h3>🚀 Getting Started</h3>
                <p>
                  {activeSection === 'overview' && "If you're new: Start with Master Stock List to understand your product database and set reorder points, then use Create Purchase Orders when you need to order items. The Knowledge Base explains each page in detail."}
                  {activeSection === 'home' && "This page opens automatically when you log in. Click the blue button to start ordering or use the tabs at the top to explore other sections."}
                  {activeSection === 'master-list' && "Start by browsing your products and their current stock levels. Set reorder points for items you regularly stock. Use search filters to find specific products quickly."}
                  {activeSection === 'create-pr' && "First time? Try searching for a product you know you need. Check the 'Include Negative' box to see everything. Practice with a small order first."}
                  {activeSection === 'purchase-requests' && "This page will be empty until you create some requests. Once you do, check back here regularly to track progress and update statuses."}
                  {activeSection === 'archived' && "This shows completed orders from the past. Use the search to find specific old orders. Good for checking what you ordered last time."}
                  {activeSection === 'generate-files' && "Don't use this page until you've created purchase orders first. Once you have orders, come here to make Excel files for suppliers."}
                  {activeSection === 'receive-items' && "Use this when deliveries arrive. Scan or enter items as you receive them to keep stock levels accurate."}
                  {activeSection === 'sales-insights' && "Check this weekly or monthly to see which products sell best. Use the date controls to look at different time periods."}
                  {activeSection === 'supplier-discounts' && "Set up volume discounts and pricing tiers for better supplier negotiations. Use the bulk wizard for multiple discount bands."}
                  {activeSection === 'lead-time-insights' && "Review supplier performance and plan consolidated orders. Run vendor consolidation weekly to optimize ordering."}
                  {activeSection === 'product-audit' && "Run monthly audits to maintain clean product data. Focus on high-value items and missing information first."}
                  {activeSection === 'user-analytics' && "Monitor how your team uses the system. Identify training needs and optimize workflows based on usage patterns."}
                  {activeSection === 'admin' && "Only administrators see this. Use User Management to add people, then check Analytics to see how the app is being used."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
