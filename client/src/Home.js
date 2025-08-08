import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Home() {
  const [dashboardData, setDashboardData] = useState({
    activePURs: 0,
    uniqueItemsOnOrder: 0,
    totalQuantityOnOrder: 0,
    itemsBelowReorder: 0,
    loading: true
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch active purchase requests
      const pursResponse = await window.api.getPurchaseRequests(true, false);
      
      // Fetch all products to check reorder points
      const productsResponse = await window.api.getAllProducts();
      
      // Calculate metrics
      const activePURs = Array.isArray(pursResponse) ? pursResponse.length : 0;
      
      // Count unique items on order and total quantity
      let uniqueItemsOnOrder = 0;
      let totalQuantityOnOrder = 0;
      
      if (Array.isArray(pursResponse)) {
        const uniqueItems = new Set();
        
        pursResponse.forEach(pur => {
          if (pur.items && Array.isArray(pur.items)) {
            pur.items.forEach(item => {
              // Use Product Name as the unique identifier
              const itemId = item['Product Name'] || item.product_name;
              if (itemId) {
                uniqueItems.add(itemId);
              }
              
              // Sum total quantities
              const quantity = item["No. to Order"] || item.no_to_order || 0;
              totalQuantityOnOrder += quantity;
            });
          }
        });
        
        uniqueItemsOnOrder = uniqueItems.size;
      }
      
      // Count items below reorder point
      const itemsBelowReorder = Array.isArray(productsResponse)
        ? productsResponse.filter(product => {
            const stock = product.stock || 0;
            const reorderLevel = product.reorder_level || 0;
            return reorderLevel > 0 && stock < reorderLevel;
          }).length
        : 0;

      setDashboardData({
        activePURs,
        uniqueItemsOnOrder,
        totalQuantityOnOrder,
        itemsBelowReorder,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };
  return (
    <div className="center-card">
      <img
        src={"goodlife.png"}
        alt="The Good Life Clinic"
        style={{
          width: 220,
          maxWidth: "70%",
          display: "block",
          margin: "0 auto 38px auto",
          boxShadow: "0 6px 26px 2px rgba(0,0,0,0.08)",
          borderRadius: "18px",
          background: "#fff",
        }}
      />
      
      {/* Version Indicator */}
      <div style={{
        textAlign: "center",
        margin: "0 0 24px 0",
        padding: "8px 16px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        borderRadius: "20px",
        fontSize: "14px",
        fontWeight: "600",
        display: "inline-block",
        boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)"
      }}>
        ✨ Version 1.0.1 - Auto-Update Test ✨
      </div>
      
      {/* Dashboard Summary */}
      <div style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "20px",
        margin: "24px 0",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
      }}>
        <h3 style={{ 
          margin: "0 0 16px 0", 
          color: "#334155", 
          fontSize: "1.1em",
          fontWeight: 600 
        }}>
          📊 Current Status
        </h3>
        
        {dashboardData.loading ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
            Loading dashboard data...
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px"
          }}>
            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "2em", fontWeight: "bold", color: "#3b82f6", marginBottom: "4px" }}>
                {dashboardData.activePURs}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.9em", fontWeight: 500 }}>
                Active Purchase Requests
              </div>
            </div>
            
            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "2em", fontWeight: "bold", color: "#059669", marginBottom: "4px" }}>
                {dashboardData.uniqueItemsOnOrder}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.9em", fontWeight: 500 }}>
                Product Types on Order
              </div>
            </div>
            
            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "2em", fontWeight: "bold", color: "#0891b2", marginBottom: "4px" }}>
                {dashboardData.totalQuantityOnOrder}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.9em", fontWeight: 500 }}>
                Total Quantity on Order
              </div>
            </div>
            
            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}>
              <div style={{ 
                fontSize: "2em", 
                fontWeight: "bold", 
                color: dashboardData.itemsBelowReorder > 0 ? "#dc2626" : "#059669", 
                marginBottom: "4px" 
              }}>
                {dashboardData.itemsBelowReorder}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.9em", fontWeight: 500 }}>
                Items Below Reorder Point
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 32 }}>
        <Link to="/create-pr">
          <button style={{
            background: "#006bb6",
            color: "#fff",
            fontWeight: 600,
            padding: "12px 32px",
            border: "none",
            borderRadius: "5px",
            fontSize: "1.1em",
            marginBottom: 8,
            cursor: "pointer"
          }}>
            Create Purchase Requests
          </button>
        </Link>
        <Link to="/generate-supplier-files">
          <button style={{
            background: "#00a86b",
            color: "#fff",
            fontWeight: 600,
            padding: "12px 32px",
            border: "none",
            borderRadius: "5px",
            fontSize: "1.1em",
            marginBottom: 8,
            cursor: "pointer"
          }}>
            Generate Supplier Files
          </button>
        </Link>
        <Link to="/receive-items">
          <button style={{
            background: "#f59e42",
            color: "#fff",
            fontWeight: 600,
            padding: "12px 32px",
            border: "none",
            borderRadius: "5px",
            fontSize: "1.1em",
            marginBottom: 8,
            cursor: "pointer"
          }}>
            Receive Items
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Home;
