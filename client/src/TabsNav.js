
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./TabsNav.css"; // Ensure this CSS file has your blue styles

// Get version from environment variable (set during build)
const APP_VERSION = process.env.REACT_APP_VERSION || '2.0.1';


const TabsNav = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // DEBUG: See what user is
  // Remove or comment this out after testing
  console.log("TabsNav user object:", user);

  const handleLogout = async () => {
    try {
      if (!window.api || !window.api.logout) {
        alert("Logout not available: window.api.logout is missing");
        return;
      }
      await window.api.logout();
    } catch (err) {
      alert("Logout failed: " + (err?.error || err?.message || 'Unknown error'));
      return;
    }
    if (onLogout) onLogout();
    navigate("/login");
  };

  // Accept any "truthy" is_admin value (1, true, "1")
  // const isAdmin = user && (user.is_admin === 1 || user.is_admin === true || user.is_admin === "1");
  // Admin gating disabled for open mode
  const isAdmin = true;

  return (
    <div className="tabsnav">
      <div className="tabsnav__links">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
          end
        >
          Home
        </NavLink>
        <NavLink
          to="/purchase-requests"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Active Purchase Orders
        </NavLink>
        <NavLink
          to="/archived"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Archived Purchase Orders
        </NavLink>
        <NavLink
          to="/master-list"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Master Stock List
        </NavLink>
        <NavLink
          to="/product-audit"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Product Audit
        </NavLink>
        <NavLink
          to="/sales-insights"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Sales Insights
        </NavLink>
        <NavLink
          to="/knowledge-base"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          📚 Knowledge Base
        </NavLink>
  {/* Supplier Discounts removed from top-level nav; managed under Admin -> Email & Supplier Management */}
        {/* Admin tab always visible in open mode */}
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Admin Panel
        </NavLink>
      </div>

      <div className="tabsnav__user">
        <span className="tabsnav__welcome" style={{ marginTop: "8px" }}>
          {user ? `Welcome, ${user.username}` : "Not Logged In"}
        </span>
        <div style={{ 
          fontSize: "11px", 
          color: "rgba(255, 255, 255, 0.8)", 
          marginTop: "2px",
          fontWeight: "500"
        }}>
          v{APP_VERSION}
        </div>
        {user && (
          <button className="tabsnav__btn" onClick={handleLogout} style={{ marginTop: "8px" }}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default TabsNav;
