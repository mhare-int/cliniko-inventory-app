
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./TabsNav.css"; // Ensure this CSS file has your blue styles


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
          Active Purchase Requests
        </NavLink>
        <NavLink
          to="/archived"
          className={({ isActive }) =>
            isActive ? "tabsnav__link active" : "tabsnav__link"
          }
        >
          Archived Purchase Requests
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
          📚 Knowledge Base v1.0.1 ✨
        </NavLink>
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
        <span className="tabsnav__welcome">
          {user ? `Welcome, ${user.username}` : "Not Logged In"}
        </span>
        {user && (
          <button className="tabsnav__btn" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default TabsNav;
