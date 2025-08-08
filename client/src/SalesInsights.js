import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { useBehaviorTracking } from "./hooks/useBehaviorTracking";
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const SalesInsights = ({ user }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState("graph"); // "graph" or "table"
  const limit = 500;

  // Initialize behavior tracking
  const behaviorTracking = useBehaviorTracking(user);

  // Custom date ranges state
  const [customRanges, setCustomRanges] = useState([]);
  const [newRangeStart, setNewRangeStart] = useState('');
  const [newRangeEnd, setNewRangeEnd] = useState('');
  const [newRangeLabel, setNewRangeLabel] = useState('');

  // Calculate next month's date range for last year
  const today = new Date();
  const lastYear = today.getFullYear() - 1;
  const nextMonth = today.getMonth() + 1; // JS months: 0=Jan, 11=Dec
  const yearForNextMonth = nextMonth > 11 ? lastYear + 1 : lastYear;
  const monthNum = nextMonth > 11 ? 0 : nextMonth; // wrap to Jan if Dec

  const startDate = new Date(yearForNextMonth, monthNum, 1).toISOString().slice(0, 10);
  const endDate = new Date(yearForNextMonth, monthNum + 1, 1).toISOString().slice(0, 10);


  // --- Filtering and Sorting State ---
  const baseColumns = [
    { key: "product_name", label: "Product Name", align: "left" },
    { key: "total_quantity", label: "Total Quantity (Last 12 Months)", align: "right" },
    { key: "current_stock", label: "Current Stock", align: "right" },
    { key: "last_month_sales", label: "Last Month Sales", align: "right" },
    { key: "currently_ordered", label: "Currently Ordered (PUR)", align: "right" },
    { key: "total_stock", label: "Total Stock", align: "right" },
  ];

  // Generate initial columns (base + custom ranges)
  const generateColumns = () => {
    const customColumns = customRanges.map((range, index) => ({
      key: `custom_range_${index}`,
      label: range.label,
      align: "right"
    }));
    return [...baseColumns, ...customColumns];
  };

  const [columns, setColumns] = useState(baseColumns);
  const [columnWidths, setColumnWidths] = useState(
    baseColumns.reduce((acc, col) => ({ ...acc, [col.key]: 180 }), {})
  );
  const [visibleColumns, setVisibleColumns] = useState(baseColumns.map(col => col.key));
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState(
    baseColumns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {})
  );

  // Extracted fetchData function to be reusable
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = customRanges.length > 0 
        ? await window.api.getSalesInsightsWithCustomRanges(customRanges, limit, offset)
        : await window.api.getSalesInsights(limit, offset);
      setData(result);
    } catch (e) {
      setError(e.message || e.error || "Failed to fetch sales insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.api || !window.api.getSalesInsightsWithCustomRanges) {
      setError("Sales insights not available");
      setLoading(false);
      return;
    }
    
    fetchData();
  }, [offset, customRanges]);

  // Update columns when custom ranges change
  useEffect(() => {
    const newColumns = generateColumns();
    setColumns(newColumns);
    
    // Update column widths for new columns
    const newWidths = { ...columnWidths };
    newColumns.forEach(col => {
      if (!newWidths[col.key]) {
        newWidths[col.key] = 180;
      }
    });
    setColumnWidths(newWidths);
    
    // Update visible columns
    setVisibleColumns(newColumns.map(col => col.key));
    
    // Update filters
    const newFilters = { ...filters };
    newColumns.forEach(col => {
      if (!newFilters[col.key]) {
        newFilters[col.key] = '';
      }
    });
    setFilters(newFilters);
  }, [customRanges]);

  // --- Filtering ---
  const filteredData = data.filter(row =>
    columns.every(col => {
      if (!filters[col.key]) return true;
      let val;
      if (col.key === 'total_stock') {
        val = (Number(row.current_stock) || 0) + (Number(row.currently_ordered) || 0);
      } else if (col.key.startsWith('custom_range_')) {
        val = row[col.key] || 0;
      } else {
        val = row[col.key];
      }
      return String(val).toLowerCase().includes(filters[col.key].toLowerCase());
    })
  );

  // --- Sorting ---
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const isNumeric = ['total_quantity', 'current_stock', 'last_month_sales', 'currently_ordered', 'total_stock']
      .concat(customRanges.map((_, index) => `custom_range_${index}`))
      .includes(sortConfig.key);
    
    return [...filteredData].sort((a, b) => {
      let aVal = sortConfig.key === 'total_stock'
        ? (Number(a.current_stock) || 0) + (Number(a.currently_ordered) || 0)
        : a[sortConfig.key];
      let bVal = sortConfig.key === 'total_stock'
        ? (Number(b.current_stock) || 0) + (Number(b.currently_ordered) || 0)
        : b[sortConfig.key];
      if (isNumeric) {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig, customRanges]);

  // --- Column Handlers ---
  const handleSort = key => {
    setSortConfig(prev => {
      const newDirection = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      
      // Track sorting behavior
      if (behaviorTracking.trackFeatureUse) {
        behaviorTracking.trackFeatureUse('sales_insights', {
          action: 'sort_column',
          column: key,
          direction: newDirection
        });
      }
      
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  
  const handleFilterChange = (key, value) => {
    // Track filtering behavior
    if (behaviorTracking.trackSearch && value.trim()) {
      behaviorTracking.trackSearch(value, null, {
        column: key,
        action: 'filter_column'
      });
    }
    setFilters(f => ({ ...f, [key]: value }));
  };
  
  const toggleColumn = key => {
    setVisibleColumns(cols => {
      const isVisible = cols.includes(key);
      
      // Track column visibility changes
      if (behaviorTracking.trackFeatureUse) {
        behaviorTracking.trackFeatureUse('sales_insights', {
          action: 'toggle_column',
          column: key,
          visible: !isVisible
        });
      }
      
      return isVisible
        ? cols.filter(c => c !== key)
        : [...cols, key];
    });
  };

  // --- Custom Range Handlers ---
  const addCustomRange = () => {
    if (!newRangeStart || !newRangeEnd || !newRangeLabel) {
      alert("Please fill in all fields for the date range");
      return;
    }
    
    if (new Date(newRangeStart) > new Date(newRangeEnd)) {
      alert("Start date must be before end date");
      return;
    }
    
    const newRange = {
      startDate: newRangeStart,
      endDate: newRangeEnd,
      label: newRangeLabel
    };
    
    // Track custom range creation
    if (behaviorTracking.trackFeatureUse) {
      behaviorTracking.trackFeatureUse('sales_insights', {
        action: 'add_custom_range',
        startDate: newRangeStart,
        endDate: newRangeEnd,
        label: newRangeLabel
      });
    }
    
    setCustomRanges(prev => [...prev, newRange]);
    setNewRangeStart('');
    setNewRangeEnd('');
    setNewRangeLabel('');
  };

  const removeCustomRange = (index) => {
    setCustomRanges(prev => prev.filter((_, i) => i !== index));
  };

  const handleResize = (key, e) => {
    e.preventDefault();
    if (e.target.dataset.resize !== "true") return;
    document.body.style.userSelect = "none";
    const startX = e.clientX;
    const startWidth = columnWidths[key];
    const onMouseMove = moveEvent => {
      const newWidth = Math.max(40, startWidth + moveEvent.clientX - startX); // Reduced minimum from 60 to 40
      setColumnWidths(widths => ({ ...widths, [key]: newWidth }));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };
  const handleAutoFit = key => {
    const cells = Array.from(document.querySelectorAll(`td[data-col="${key}"], th[data-col="${key}"]`));
    let maxWidth = 60;
    cells.forEach(cell => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const width = range.getBoundingClientRect().width + 24;
      if (width > maxWidth) maxWidth = width;
    });
    setColumnWidths(widths => ({ ...widths, [key]: Math.min(maxWidth, 400) }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <h2 style={{ textAlign: "center", width: "100%" }}>Sales Insights</h2>
      
      {/* Custom Date Range Controls */}
      <div style={{ 
        marginBottom: 20, 
        padding: 20, 
        background: "#f8fafc", 
        borderRadius: 12, 
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        width: "100%",
        maxWidth: 800
      }}>
        <h3 style={{ margin: "0 0 16px 0", color: "#2d3748", fontSize: "1.2em" }}>Custom Date Ranges</h3>
        
        {/* Add New Range */}
        <div style={{ 
          display: "flex", 
          gap: 12, 
          alignItems: "center", 
          flexWrap: "wrap",
          marginBottom: 16
        }}>
          <input
            type="date"
            value={newRangeStart}
            onChange={(e) => setNewRangeStart(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "2px solid #e2e8f0",
              borderRadius: 6,
              fontSize: "0.95em",
              outline: "none",
              transition: "border-color 0.2s ease"
            }}
            onFocus={(e) => e.target.style.borderColor = "#3182ce"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          <span style={{ color: "#718096", fontWeight: 500 }}>to</span>
          <input
            type="date"
            value={newRangeEnd}
            onChange={(e) => setNewRangeEnd(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "2px solid #e2e8f0",
              borderRadius: 6,
              fontSize: "0.95em",
              outline: "none",
              transition: "border-color 0.2s ease"
            }}
            onFocus={(e) => e.target.style.borderColor = "#3182ce"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          <input
            type="text"
            placeholder="Column Label"
            value={newRangeLabel}
            onChange={(e) => setNewRangeLabel(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "2px solid #e2e8f0",
              borderRadius: 6,
              fontSize: "0.95em",
              outline: "none",
              transition: "border-color 0.2s ease",
              minWidth: 150
            }}
            onFocus={(e) => e.target.style.borderColor = "#3182ce"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          <button
            onClick={addCustomRange}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #3182ce 0%, #2c5aa0 100%)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.95em",
              fontWeight: 600,
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(49, 130, 206, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
          >
            Add Range
          </button>
        </div>

        {/* Current Ranges */}
        {customRanges.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 12px 0", color: "#4a5568", fontSize: "1em" }}>Active Date Ranges:</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {customRanges.map((range, index) => (
                <div key={index} style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <span style={{ fontSize: "0.9em", color: "#2d3748", marginRight: 8 }}>
                    <strong>{range.label}:</strong> {range.startDate} to {range.endDate}
                  </span>
                  <button
                    onClick={() => removeCustomRange(index)}
                    style={{
                      background: "#fed7d7",
                      color: "#c53030",
                      border: "none",
                      borderRadius: 4,
                      width: 20,
                      height: 20,
                      cursor: "pointer",
                      fontSize: "0.8em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                    title="Remove range"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, marginBottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <label style={{ fontWeight: "bold", marginRight: 8 }}>Columns:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {columns.map(col => (
            <label key={col.key} style={{ fontSize: "0.95em", display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
                style={{ marginRight: 4 }}
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: "red" }}>Error: {error}</div>
      ) : sortedData.length === 0 ? (
        <div>No sales data found for the next month.</div>
      ) : (
        <div style={{
          overflowX: "auto",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          background: "#f8fafc",
          borderRadius: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          padding: 24,
          marginTop: 12
        }}>
          <table
            style={{
              minWidth: "100px",
              borderCollapse: "separate",
              borderSpacing: 0,
              tableLayout: "fixed",
              margin: "0 auto",
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)"
            }}
          >
            <thead>
              <tr>
                {columns.filter(col => visibleColumns.includes(col.key)).map((col, idx) => (
                  <th
                    key={col.key}
                    data-col={col.key}
                    style={{
                      borderBottom: "3px solid #1867c0",
                      borderRight: idx === columns.filter(col => visibleColumns.includes(col.key)).length - 1 ? "none" : "1px solid #e2e8f0",
                      textAlign: col.align === "right" ? "right" : "center",
                      padding: "16px 12px 12px 12px",
                      wordBreak: "keep-all",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      background: "linear-gradient(135deg, #1867c0 0%, #2196f3 100%)",
                      color: "#ffffff",
                      display: "table-cell",
                      verticalAlign: "middle",
                      width: columnWidths[col.key],
                      minWidth: 40,
                      maxWidth: 400,
                      position: "relative",
                      cursor: "move",
                      fontWeight: 700,
                      fontSize: "1.1em",
                      letterSpacing: 0.5,
                      textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)"
                    }}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("colIdx", idx);
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      const fromIdx = Number(e.dataTransfer.getData("colIdx"));
                      if (fromIdx === idx) return;
                      const visibleCols = columns.filter(col => visibleColumns.includes(col.key));
                      const colKeyFrom = visibleCols[fromIdx].key;
                      const colKeyTo = visibleCols[idx].key;
                      const allIdxFrom = columns.findIndex(col => col.key === colKeyFrom);
                      const allIdxTo = columns.findIndex(col => col.key === colKeyTo);
                      const newCols = [...columns];
                      const [moved] = newCols.splice(allIdxFrom, 1);
                      newCols.splice(allIdxTo, 0, moved);
                      setColumns(newCols);
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      height: "100%",
                      justifyContent: "space-between"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "baseline", 
                        justifyContent: "center", 
                        width: "100%",
                        minHeight: "24px"
                      }}>
                        <span>{col.label}</span>
                        {columnWidths[col.key] >= 50 && (
                          <span style={{ marginLeft: "4px" }}>
                            <button
                              style={{
                                fontSize: "0.75em",
                                background: "rgba(255,255,255,0.2)",
                                border: "1px solid rgba(255,255,255,0.3)",
                                borderRadius: "3px",
                                cursor: "pointer",
                                color: "#ffffff",
                                padding: "1px 3px",
                                transition: "background 0.2s ease",
                                fontWeight: "bold",
                                boxShadow: sortConfig.key === col.key ? "0 0 8px rgba(255,255,255,0.4)" : "none",
                                width: "18px",
                                height: "18px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                              }}
                              onClick={() => handleSort(col.key)}
                              title={
                                sortConfig.key === col.key
                                  ? (sortConfig.direction === 'asc' ? 'Sort descending' : 'Sort ascending')
                                  : 'Sort ascending'
                              }
                              onMouseEnter={e => {
                                e.target.style.background = "rgba(255,255,255,0.3)";
                              }}
                              onMouseLeave={e => {
                                e.target.style.background = "rgba(255,255,255,0.2)";
                              }}
                            >
                              {sortConfig.key === col.key
                                ? (sortConfig.direction === 'asc' ? '▲' : '▼')
                                : '↕'}
                            </button>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={filters[col.key] || ''}
                        onChange={e => handleFilterChange(col.key, e.target.value)}
                        placeholder="Filter..."
                        style={{
                          width: columnWidths[col.key] < 60 ? "85%" : "90%",
                          fontSize: "0.95em",
                          marginTop: 8,
                          marginBottom: 4,
                          padding: columnWidths[col.key] < 60 ? "4px 6px" : "6px 10px",
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.95)",
                          color: "#333",
                          textAlign: "left",
                          outline: "none",
                          transition: "all 0.2s ease",
                          fontWeight: "500",
                          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                          height: "32px",
                          boxSizing: "border-box"
                        }}
                        onFocus={e => {
                          e.target.style.border = "2px solid #ffffff";
                          e.target.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.1), 0 0 8px rgba(255,255,255,0.6)";
                        }}
                        onBlur={e => {
                          e.target.style.border = "2px solid rgba(255,255,255,0.3)";
                          e.target.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.1)";
                        }}
                      />
                    </div>
                    <span
                      data-resize="true"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 12,
                        cursor: "col-resize",
                        userSelect: "none",
                        zIndex: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.1)",
                        borderLeft: "1px solid rgba(255,255,255,0.2)"
                      }}
                      onMouseDown={e => handleResize(col.key, e)}
                      onDoubleClick={() => handleAutoFit(col.key)}
                      title="Resize column (double-click to auto-fit)"
                      onMouseEnter={e => {
                        e.target.style.background = "rgba(255,255,255,0.2)";
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = "rgba(255,255,255,0.1)";
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        width: 3,
                        height: "60%",
                        background: "#ffffff",
                        borderRadius: 2,
                        opacity: 0.8,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                      }} />
                      <span style={{
                        display: "inline-block",
                        width: 3,
                        height: "60%",
                        background: "#ffffff",
                        borderRadius: 2,
                        marginLeft: 2,
                        opacity: 0.8,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                      }} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f1f5f9" }}>
                  {columns.filter(col => visibleColumns.includes(col.key)).map((col, colIdx) => (
                    <td
                      key={col.key}
                      data-col={col.key}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        borderRight: colIdx === columns.filter(col => visibleColumns.includes(col.key)).length - 1 ? "none" : "1px solid #e2e8f0",
                        padding: "12px 8px",
                        textAlign: col.align === "right" ? "right" : "center",
                        fontSize: "1.04em",
                        verticalAlign: "middle"
                      }}
                    >
                      {col.key === "total_stock"
                        ? (Number(row.current_stock) || 0) + (Number(row.currently_ordered) || 0)
                        : col.key.startsWith('custom_range_')
                        ? row[col.key] || 0
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SalesInsights;

