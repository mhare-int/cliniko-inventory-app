import React, { useEffect } from "react";

function SalesDataSync({ syncLoading, setSyncLoading, syncMessage, setSyncMessage, syncStartDate, setSyncStartDate, syncEndDate, setSyncEndDate }) {
  // Initialize sync dates (default to last 2 years)
  useEffect(() => {
    if (!syncStartDate || !syncEndDate) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      setSyncStartDate(twoYearsAgo.toISOString().slice(0, 10));
      setSyncEndDate(new Date().toISOString().slice(0, 10));
    }
  }, [syncStartDate, syncEndDate, setSyncStartDate, setSyncEndDate]);

  // Sales data sync function
  const syncSalesData = async () => {
    if (!syncStartDate || !syncEndDate) {
      setSyncMessage("Please select both start and end dates for sync.");
      return;
    }
    if (new Date(syncStartDate) > new Date(syncEndDate)) {
      setSyncMessage("Start date must be before end date.");
      return;
    }
    setSyncLoading(true);
    setSyncMessage("Syncing sales data from Cliniko...");
    try {
      const result = await window.api.updateSalesDataFromCliniko(syncStartDate, syncEndDate);
      if (result.error) {
        setSyncMessage(`Error: ${result.error}`);
      } else {
        setSyncMessage(`✅ Success! Processed ${result.invoicesProcessed || 0} invoices and inserted ${result.salesRecordsInserted || 0} sales records.`);
      }
    } catch (error) {
      setSyncMessage(`Error: ${error.message || 'Failed to sync sales data'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 40, marginBottom: 30, padding: 20, background: "#fff8e1", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "2px solid #ffa726" }}>
      <h3 style={{ margin: "0 0 16px 0", color: "#e65100", fontSize: "1.2em", fontWeight: 700 }}>Sales Data Sync (Admin Only)</h3>
      <p style={{ margin: "0 0 16px 0", color: "#bf360c", fontSize: "0.95em" }}>
        Manually sync sales data from Cliniko for specific date ranges. Useful for recovering data or updating specific periods.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ color: "#bf360c", fontWeight: 500 }}>From:</span>
        <input type="date" value={syncStartDate} onChange={(e) => setSyncStartDate(e.target.value)} style={{ padding: "8px 12px", border: "2px solid #ffcc80", borderRadius: 6, fontSize: "0.95em", outline: "none", transition: "border-color 0.2s ease" }} onFocus={(e) => e.target.style.borderColor = "#ff9800"} onBlur={(e) => e.target.style.borderColor = "#ffcc80"} disabled={syncLoading} />
        <span style={{ color: "#bf360c", fontWeight: 500 }}>To:</span>
        <input type="date" value={syncEndDate} onChange={(e) => setSyncEndDate(e.target.value)} style={{ padding: "8px 12px", border: "2px solid #ffcc80", borderRadius: 6, fontSize: "0.95em", outline: "none", transition: "border-color 0.2s ease" }} onFocus={(e) => e.target.style.borderColor = "#ff9800"} onBlur={(e) => e.target.style.borderColor = "#ffcc80"} disabled={syncLoading} />
        <button onClick={syncSalesData} disabled={syncLoading} style={{ padding: "8px 16px", background: syncLoading ? "#ccc" : "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)", color: "white", border: "none", borderRadius: 6, cursor: syncLoading ? "not-allowed" : "pointer", fontSize: "0.95em", fontWeight: 600, transition: "transform 0.2s ease, box-shadow 0.2s ease" }} onMouseEnter={(e) => { if (!syncLoading) { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 4px 12px rgba(255, 152, 0, 0.4)"; } }} onMouseLeave={(e) => { if (!syncLoading) { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "none"; } }}>{syncLoading ? "Syncing..." : "📅 Sync Date Range"}</button>
      </div>
      {syncMessage && (<div style={{ padding: "12px", background: syncMessage.includes("Error") ? "#ffebee" : syncMessage.includes("✅") ? "#e8f5e8" : "#e3f2fd", color: syncMessage.includes("Error") ? "#c62828" : syncMessage.includes("✅") ? "#2e7d32" : "#1565c0", borderRadius: 6, fontSize: "0.9em", border: `1px solid ${syncMessage.includes("Error") ? "#ef5350" : syncMessage.includes("✅") ? "#4caf50" : "#42a5f5"}` }}>{syncMessage}</div>)}
    </div>
  );
}

export default SalesDataSync;
