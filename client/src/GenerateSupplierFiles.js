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

  // Fetch active PRs on mount
  useEffect(() => {
    if (!window.api || !window.api.getPurchaseRequests) return;
    window.api.getPurchaseRequests(true, undefined)
      .then(res => setActivePRs(res))
      .catch(() => setActivePRs([]));
  }, []);

  const handlePickFolder = async () => {
    if (window.api && window.api.pickFolder) {
      const folder = await window.api.pickFolder();
      if (folder) setOutputFolder(folder);
    } else {
      alert("Folder picker not available in this build.");
    }
  };

  const handleCreateSupplierOrderFilesFromPR = async () => {
    setError("");
    setDownloadLinks([]);
    if (!selectedPRId) {
      setError("Please select a Purchase Request to generate supplier order files.");
      return;
    }
    if (!outputFolder) {
      setError("Please select an output folder for the supplier order files.");
      return;
    }
    setLoading(true);
    try {
      const pr = activePRs.find(pr => (pr.id || pr._id).toString() === selectedPRId);
      if (!pr || !pr.items || pr.items.length === 0) throw new Error("Selected PR has no items.");
      if (!window.api || !window.api.createSupplierOrderFilesForVendors) throw new Error("createSupplierOrderFilesForVendors not available");
      const purNumber = pr.name || pr.number || pr.id || pr._id || "";
      const vendorItems = pr.items.map(item => ({
        "PUR Number": purNumber,
        "Product Name": item["Product Name"] || item.name,
        "Supplier Name": item["Supplier Name"] || item.supplier_name || "Unknown Supplier",
        "No. to Order": item["No. to Order"] ?? item.no_to_order ?? 0
      }));
      const res = await window.api.createSupplierOrderFilesForVendors(vendorItems, outputFolder);
      // Accept both array of strings or array of {supplier, file}
      let files = [];
      if (res && Array.isArray(res.files)) {
        files = res.files.map(f => {
          if (typeof f === 'string') return { file: f };
          if (f && typeof f === 'object' && f.file) return f;
          return { file: String(f) };
        });
      }
      setDownloadLinks(files);
      alert("Supplier order files created successfully!");
      navigate("/");
    } catch (err) {
      setError(
        err?.error || err?.message ||
        "Something went wrong while creating supplier order files."
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

  return (
    <div className="center-card">
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "#006bb6" }}>
        Generate Supplier Order Files
      </h2>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            background: "#eee",
            color: "#006bb6",
            fontWeight: 600,
            padding: "8px 22px",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "1em",
            marginBottom: 10
          }}
        >
          ← Home
        </button>
      </div>
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
        {/* Row 2: Purchase Request Selector and Submit */}
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
          }}>Select Purchase Request:</label>
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
            <option value="">-- Select Active PR --</option>
            {activePRs && activePRs.length > 0 && activePRs.map(pr => (
              <option key={pr.id || pr._id} value={pr.id || pr._id}>
                {pr.name ? pr.name : `PR #${pr.id || pr._id}`}
              </option>
            ))}
          </select>
        </div>
      </div>
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
          {loading ? "Submitting..." : "Create Supplier Order Files"}
        </button>
      </div>
      {downloadLinks.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h4>Download Supplier Order Files</h4>
          <button
            style={{
              marginBottom: 10,
              background: "#006bb6",
              color: "#fff",
              fontWeight: 600,
              padding: "6px 16px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
            onClick={handleDownloadAll}
            type="button"
          >
            Download All
          </button>
          <ul style={{ paddingLeft: 20 }}>
            {downloadLinks.map((file, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.api || !window.api.downloadFile) return;
                    try {
                      const filePath = await window.api.downloadFile(file.file);
                      window.open(filePath);
                    } catch (e) {}
                  }}
                  style={{ background: "none", border: "none", color: "#1867c0", textDecoration: "underline", cursor: "pointer" }}
                >
                  {file.file}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="error-msg" style={{ marginTop: 28 }}>{error}</div>}
    </div>
  );
}

export default GenerateSupplierFiles;
