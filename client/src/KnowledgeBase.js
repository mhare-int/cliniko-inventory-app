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
          'Manage user accounts and permissions'
        ],
        workflow: 'The basic process: Set up reorder points in Master Stock List → Create purchase orders for needed items → Generate supplier files → Send to suppliers → Receive and log deliveries'
      }
    },
    {
      id: 'home',
      title: '🏠 Home Dashboard',
      icon: '📊',
      content: {
        title: 'Starting Point for Daily Tasks',
        description: 'This is where you land when you first open the app. Use the buttons here to quickly jump to common tasks.',
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
          'The navigation tabs at the top are always available'
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
          'See calculated "No. to Order" amounts based on your reorder points'
        ],
        tips: [
          'Set reorder points for products you regularly stock',
          'Use search filters to find specific products quickly',
          'Stock levels update automatically from Cliniko',
          'Focus on setting good reorder points rather than manually selecting items',
          'Use bulk upload for initial setup of many reorder levels'
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
          'Keeps your requests organized by supplier'
        ],
        tips: [
          'Only use this after you\'ve created purchase requests',
          'Download files immediately after generating them',
          'Each supplier gets their own separate file',
          'Email these files directly to your suppliers'
        ],
        workflow: 'Create purchase requests first → Come to this page → Generate files → Download files → Email to suppliers'
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
      id: 'admin',
      title: '⚙️ Admin Panel',
      icon: '👥',
      content: {
        title: 'Managing Users and Viewing App Usage',
        description: 'Admin section with two tabs: one for managing user accounts, one for seeing how the app is being used.',
        features: [
          'Two tabs at the top: "User Management" and "User Analytics"',
          'User Management tab: add new users, edit existing accounts',
          'User Analytics tab: see who uses what features and when',
          'View detailed behavior patterns and usage statistics',
          'Track user engagement and identify training needs'
        ],
        tabs: [
          {
            name: 'User Management',
            description: 'Add new users, edit passwords, set admin permissions'
          },
          {
            name: 'User Analytics', 
            description: 'See usage statistics, behavior patterns, and user activity'
          }
        ],
        tips: [
          'Click between tabs at the top to switch sections',
          'Use User Management to control who can access what',
          'Check User Analytics to see if people need training',
          'Analytics show real data from actual app usage'
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
                  {activeSection === 'overview' && "If you're new: Start with Master Stock List to understand your product database and set reorder points, then use Create Purchase Requests when you need to order items. The Knowledge Base explains each page in detail."}
                  {activeSection === 'home' && "This page opens automatically when you log in. Click the blue button to start ordering or use the tabs at the top to explore other sections."}
                  {activeSection === 'master-list' && "Start by browsing your products and their current stock levels. Set reorder points for items you regularly stock. Use search filters to find specific products quickly."}
                  {activeSection === 'create-pr' && "First time? Try searching for a product you know you need. Check the 'Include Negative' box to see everything. Practice with a small order first."}
                  {activeSection === 'purchase-requests' && "This page will be empty until you create some requests. Once you do, check back here regularly to track progress and update statuses."}
                  {activeSection === 'archived' && "This shows completed orders from the past. Use the search to find specific old orders. Good for checking what you ordered last time."}
                  {activeSection === 'generate-files' && "Don't use this page until you've created purchase requests first. Once you have requests, come here to make Excel files for suppliers."}
                  {activeSection === 'receive-items' && "Use this when deliveries arrive. Scan or enter items as you receive them to keep stock levels accurate."}
                  {activeSection === 'sales-insights' && "Check this weekly or monthly to see which products sell best. Use the date controls to look at different time periods."}
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
