import React, { useState } from 'react';
import './KnowledgeBase.css';

const KnowledgeBase = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const sections = [
    {
      id: 'overview',
      title: '📋 Overview',
      icon: '🏠',
      content: {
        title: 'Getting Started with Your Inventory App',
        description: 'This app helps you manage stock levels, create purchase orders, and track deliveries for your business.',
        features: [
          'Monitor what products you have in stock',
          'Create orders when items are running low',
          'Generate files to send to your suppliers',
          'Track orders from request to delivery',
          'View sales data and trends',
          'Manage user accounts and permissions',
          '🆕 AI-powered reorder suggestions with smart analytics',
          '🆕 Advanced supplier discount and pricing management',
          '🆕 Lead time analysis and vendor consolidation tools',
          '🆝 Comprehensive product audit and data quality management',
          '🆕 Detailed user behavior analytics and engagement tracking'
        ],
  workflow: 'The basic process: Set up reorder points in Master Stock List → Use AI suggestions for smart ordering → Create purchase orders for needed items → Configure supplier discounts → Generate supplier files → Send to suppliers → Receive and log deliveries → Analyze with Lead Time Insights'
      }
    },
    {
      id: 'first-time-setup',
      title: '🚀 First-Time Setup',
      icon: '🚀',
      content: {
        title: 'Complete your initial setup in three quick steps',
        description: 'On first run, the app guides you through creating an admin, saving your Cliniko API key, and importing data.',
        features: [
          'Step 1: Create your administrator account and log in',
          'Step 2: Enter your Cliniko API key (stored securely)',
          'Step 3: Sync products and suppliers now; sales data continues syncing in the background',
          'Preview the number of invoices and estimated time before running sales sync',
          'Time estimate uses ~3 seconds per sale record for planning only'
        ],
        tips: [
          'After products are synced, you can start using the app right away',
          'Background sales sync will keep running while you work; progress is shown in a small notification',
          'You can revisit Admin → Sales Data Sync to preview or run a sync anytime'
        ],
        workflow: 'Open app → Create admin → Save API key → Sync products & suppliers now → Sales sync continues in background'
      }
    },
    {
      id: 'home',
      title: '🏠 Home Dashboard',
      icon: '📊',
      content: {
        title: 'Starting Point for Daily Tasks',
        description: 'This is where you land when you first open the app. Use the buttons here to quickly jump to common tasks. When the app starts, you may see a small popup showing background sync progress (stock and sales).',
        features: [
          'Good Life company logo at the top',
          'Welcome message confirms you\'re in the right place',
          'Blue "Create Purchase Orders" button - click to start ordering',
          'Green "Generate Supplier Files" button - click after making requests',
          'Navigation tabs at the top take you to other sections'
        ],
        tips: [
          'Start here each day to access main functions',
          'Use the big buttons instead of hunting through menus',
          'The navigation tabs at the top are always available',
          'Background sync runs automatically after login and shows a brief notification'
        ]
      }
    },
    {
      id: 'master-list',
      title: '📋 Master Stock List',
      icon: '📦',
      content: {
        title: 'How to Manage Your Product Database',
        description: 'This page shows all your products with current stock levels and lets you set reorder points. It\'s your central product management hub.',
        features: [
          'View current stock levels for all products (synced from Cliniko)',
          'Set and update reorder points for each product',
          'Search boxes at the top to filter by product or supplier',
          'Click on reorder level numbers to edit them directly',
          'Select multiple products using checkboxes for bulk operations',
          'Upload Excel files to update reorder levels in bulk',
          'See calculated "No. to Order" amounts based on your reorder points',
          '🆕 Smart "Suggest" button for AI-powered reorder recommendations',
          '🆕 Automated quantity suggestions based on 90-day sales history',
          '🆕 Lead time analysis (7-day default or supplier-specific)',
          '🆕 "Create PO" button to instantly order suggested quantities',
          '🆕 Barcode scanning and product search functionality'
        ],
        tips: [
          'Set reorder points for products you regularly stock',
          'Use search filters to find specific products quickly',
          'Stock levels update automatically from Cliniko',
          'Focus on setting good reorder points rather than manually selecting items',
          'Use bulk upload for initial setup of many reorder levels',
          '🆕 Click "Suggest" to get AI recommendations based on sales history',
          '🆕 The suggestion uses 90 days of data and 7-day lead times by default',
          '🆕 Set supplier lead times in Admin Panel for more accurate suggestions',
          '🆕 Use "Create PO" button after getting suggestions for instant ordering'
        ],
  workflow: 'Open page → Use filters to find products → Set reorder points → Save changes → Use Create Purchase Orders for actual ordering'
      }
    },
    {
      id: 'create-pr',
  title: '📝 Create Purchase Orders',
      icon: '✏️',
      content: {
        title: 'How to Order More Stock',
        description: 'Use this page when you need to order products that are running low. It helps you build a list of what to buy.',
        features: [
          'Search for products using the dropdown box',
          'Tick "Include Negative" to see out-of-stock items',
          'Green ticks mean you have stock, red crosses mean you\'re out',
          'Products automatically group by which supplier sells them',
          'Quantities are suggested based on what you need'
        ],
        tips: [
          'Always check the "Include Negative" box to see everything',
          'Look for red X marks - these products are out of stock',
          'The app groups items by supplier automatically',
          'Review suggested quantities before submitting'
        ],
        workflow: 'Search for products → Check "Include Negative" → Review items with red X marks → Adjust quantities → Submit request'
      }
    },
    {
      id: 'purchase-requests',
  title: '📋 Active Purchase Orders',
      icon: '⏳',
      content: {
        title: 'Checking Your Current Orders',
  description: 'This shows you all the purchase orders you\'ve made that haven\'t been completed yet.',
        features: [
          'See all orders you\'ve submitted but not finished',
          'Check which supplier each order goes to',
          'Update the status as orders progress',
          'Edit order details if you need to change something',
          'Cancel orders that are no longer needed'
        ],
        tips: [
          'Check this page regularly to track order progress',
          'Update status when you place orders with suppliers',
          'Mark orders complete when items arrive',
          'Use this to follow up with suppliers about delays'
        ],
        workflow: 'Check current orders → Update status as things progress → Follow up with suppliers → Mark complete when delivered'
      }
    },
    {
      id: 'archived',
      title: '📚 Archived Requests',
      icon: '🗄️',
      content: {
        title: 'Historical Records',
  description: 'Access completed purchase orders and historical ordering data.',
        features: [
          'Complete order history',
          'Search by date, supplier, or product',
          'Order performance analysis',
          'Reorder functionality',
          'Cost tracking over time',
          'Supplier performance metrics'
        ],
        tips: [
          'Use for analyzing ordering patterns',
          'Reference past orders for quantity guidance',
          'Track supplier delivery performance',
          'Export data for external analysis'
        ],
        workflow: 'Search archived orders → Analyze patterns → Use insights for future orders'
      }
    },
    {
      id: 'generate-files',
      title: '🏢 Generate Supplier Files',
      icon: '📄',
      content: {
        title: 'How to Send Orders to Your Suppliers',
  description: 'After creating purchase orders, use this page to turn them into Excel files you can email to suppliers.',
        features: [
          'Creates Excel files from your purchase orders',
          'Makes separate files for each supplier automatically',
          'Download links appear after files are generated',
          'Files are formatted professionally for suppliers',
          'Keeps your requests organized by supplier',
          'Supports email templates with variables like {{supplierAccountNumber}} in subject/body'
        ],
        tips: [
          'Only use this after you\'ve created purchase orders',
          'Download files immediately after generating them',
          'Each supplier gets their own separate file',
          'Set supplier account numbers in Admin → Suppliers Management so {{supplierAccountNumber}} fills in your emails',
          'On Windows, the app can prepare Outlook .oft emails with your template and attachment'
        ],
  workflow: 'Create purchase orders first → Come to this page → Generate files → Download files → Email to suppliers'
      }
    },
    {
      id: 'receive-items',
      title: '📦 Receive Items',
      icon: '✅',
      content: {
        title: 'Process Incoming Stock',
        description: 'Log received inventory and update stock levels efficiently.',
        features: [
          'Barcode scanning support',
          'Batch processing',
          'Quantity verification',
          'Quality control notes',
          'Automatic stock updates',
          'Discrepancy reporting'
        ],
        tips: [
          'Scan items as they arrive for accuracy',
          'Check quantities against purchase orders',
          'Note any damaged or missing items',
          'Update stock levels immediately'
        ],
        workflow: 'Scan/enter received items → Verify quantities → Note any issues → Update stock'
      }
    },
    {
      id: 'sales-insights',
      title: '📊 Sales Insights',
      icon: '📈',
      content: {
        title: 'Performance Analytics',
        description: 'Analyze sales data and inventory performance to make informed decisions.',
        features: [
          'Sales trends and patterns',
          'Top-selling products',
          'Seasonal analysis',
          'Profit margin tracking',
          'Inventory turnover rates',
          'Custom date ranges'
        ],
        tips: [
          'Review weekly for short-term trends',
          'Use seasonal data for planning',
          'Focus on high-margin, fast-moving items',
          'Compare periods for growth analysis'
        ],
        workflow: 'Select date range → Review metrics → Identify trends → Adjust inventory strategy'
      }
    },
    {
      id: 'supplier-discounts',
      title: '💰 Supplier Discounts',
      icon: '💵',
      content: {
        title: 'Advanced Pricing & Discount Management',
        description: 'Configure volume discounts, supplier-specific pricing, and quantity-based pricing tiers for better cost management.',
        features: [
          'Create quantity-based discount bands (e.g., 10+ units = 5% off)',
          'Set supplier-wide discounts or product-specific pricing',
          'Percentage discounts or fixed price per unit options',
          'Effective date ranges for seasonal or temporary pricing',
          'Bulk discount wizard for creating multiple pricing tiers',
          'Visual discount summary showing active pricing',
          'Notes field for discount terms and conditions',
          'Easy edit and delete functionality for all discounts'
        ],
        tips: [
          'Use the bulk wizard to set up multiple quantity bands quickly',
          'Set effective dates for seasonal pricing changes',
          'Configure supplier-wide discounts for preferred vendors',
          'Use the notes field to document special terms or conditions',
          'Review active discounts regularly to ensure pricing accuracy'
        ],
        workflow: 'Select supplier/product → Choose scope (supplier-wide or product-specific) → Set discount bands → Configure dates and notes → Create discount'
      }
    },
    {
      id: 'lead-time-insights',
      title: '⏱️ Lead Time Insights',
      icon: '📊',
      content: {
        title: 'Supplier Performance & Lead Time Analysis',
        description: 'Analyze supplier delivery performance, manage lead times, and optimize ordering schedules for better inventory planning.',
        features: [
          'View all suppliers with calculated or configured lead times',
          'Run vendor consolidation analysis (14-day window)',
          'See products that need reordering within the next 2 weeks',
          'Individual product reorder suggestions with detailed metrics',
          'Historical lead time calculations from past orders',
          'Safety stock recommendations based on demand variability',
          'Service level configuration (95% default) for stock calculations',
          'Supplier performance tracking and optimization suggestions'
        ],
        tips: [
          'Use vendor consolidation to group orders by supplier and save on shipping',
          'Check this weekly to stay ahead of stock-outs',
          'Configure supplier lead times manually for more accurate planning',
          'Review individual product suggestions for high-value items',
          'Use historical data to validate lead time estimates'
        ],
        workflow: 'Review supplier lead times → Run vendor consolidation → Analyze products needing reorder → Get individual product suggestions → Plan consolidated orders'
      }
    },
    {
      id: 'product-audit',
      title: '🔍 Product Audit',
      icon: '📋',
      content: {
        title: 'Data Quality & Product Management',
        description: 'Comprehensive product data analysis and cleanup tools to maintain accurate inventory records.',
        features: [
          'Identify products with missing or incomplete data',
          'Find duplicate products across different suppliers',
          'Analyze product naming consistency and standardization',
          'Review products without recent sales activity',
          'Check for missing supplier information',
          'Validate barcode and product ID integrity',
          'Export audit reports for external analysis',
          'Bulk update capabilities for data cleanup'
        ],
        tips: [
          'Run monthly audits to maintain data quality',
          'Focus on high-value products first for cleanup',
          'Use standardized naming conventions across all products',
          'Regular audits help identify discontinued products',
          'Clean data improves ordering accuracy and efficiency'
        ],
        workflow: 'Run audit scan → Review flagged issues → Prioritize by impact → Clean up data → Validate changes → Export report'
      }
    },
    {
      id: 'user-analytics',
      title: '📈 User Analytics',
      icon: '👥',
      content: {
        title: 'Advanced User Behavior & System Usage Analytics',
        description: 'Comprehensive tracking and analysis of user engagement, feature usage, and system performance metrics.',
        features: [
          'Detailed user engagement metrics (session duration, page views, actions)',
          'Feature usage frequency and duration tracking',
          'Most visited pages and user journey analysis',
          'Individual user detailed analytics and behavior patterns',
          'Customizable time periods (7, 30, 90, 365 days)',
          'Session statistics and login pattern analysis',
          'User activity heatmaps and engagement scoring',
          'Export capabilities for external reporting and analysis'
        ],
        tips: [
          'Review analytics weekly to understand usage patterns',
          'Identify underutilized features that may need training',
          'Use engagement data to optimize workflows',
          'Track user adoption of new features over time',
          'Identify power users who can help train others'
        ],
        workflow: 'Access Admin → User Analytics → Select time period → Review engagement metrics → Analyze patterns → Take action on insights'
      }
    },
    {
      id: 'admin',
      title: '⚙️ Admin Panel',
      icon: '👥',
      content: {
        title: 'Administration & Settings',
        description: 'Manage users, suppliers, templates, and system settings. Use these tools to keep your data clean and your workflows smooth.',
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
