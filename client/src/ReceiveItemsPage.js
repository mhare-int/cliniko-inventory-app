
import React, { useState, useRef } from "react";

const ReceiveItemsPage = () => {
  const [displayBarcode, setDisplayBarcode] = useState(""); // This is the last scanned/entered barcode for display and lookup
  const [matchingPURs, setMatchingPURs] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [itemInfo, setItemInfo] = useState(null);
  const [error, setError] = useState(null);
  const barcodeInputRef = useRef();

  // Handler for receiving items
  const handleReceive = async () => {
    console.log('handleReceive called');
    // Collect received quantities for each PUR
    console.log('quantities:', quantities);
    const received = Object.entries(quantities)
      .filter(([key, val]) => val && !isNaN(Number(val)) && Number(val) > 0)
      .map(([key, val]) => ({
        itemId: key,  // Change from purId to itemId
        quantity: Number(val)
      }));
    console.log('received:', received);
    if (received.length === 0) {
      alert("Please enter at least one quantity to receive.");
      return;
    }
    if (!window.api || !window.api.receiveItemById) {
      setError("Receive API not available - please make sure the app is running in Electron");
      console.error("Available API methods:", window.api ? Object.keys(window.api) : "window.api is undefined");
      return;
    }
    try {
      // For each received item, call receiveItemById with the correct itemId
      const stockUpdateResults = [];
      
      for (const receivedItem of received) {
        const itemId = receivedItem.itemId;
        const quantity = receivedItem.quantity;
        if (itemId && quantity > 0) {
          console.log('Calling receiveItemById for itemId', itemId, 'qty', quantity);
          const result = await window.api.receiveItemById(itemId, quantity);
          console.log('Result for itemId', itemId, ':', result);

          // Also update Cliniko stock if enabled
          if (itemInfo && itemInfo.name) {
            // Find the matching item in matchingPURs to get extra details
            const matchingItem = matchingPURs.find(item => String(item.id) === String(itemId));
            const purId = matchingItem ? matchingItem.pr_id : null;
            const supplier = matchingItem ? matchingItem.supplier : null;
            const qtyOrdered = matchingItem ? matchingItem.qty_ordered : null;
            const qtyOutstanding = matchingItem ? matchingItem.qty_outstanding : null;

            try {
              console.log('Updating Cliniko stock for product:', itemInfo.name, 'quantity:', quantity, 'PUR:', purId, 'Supplier:', supplier, 'QtyOrdered:', qtyOrdered, 'QtyOutstanding:', qtyOutstanding);
              // Pass purId to backend as before
              const stockResult = await window.api.updateClinikoStock(itemInfo.name, quantity, purId);
              stockUpdateResults.push({
                product: itemInfo.name,
                quantity: quantity,
                purId,
                supplier,
                qtyOrdered,
                qtyOutstanding,
                result: stockResult
              });
              console.log('Cliniko stock update result:', stockResult);
            } catch (stockError) {
              console.error('Failed to update Cliniko stock:', stockError);
              // Don't fail the whole operation if just stock update fails
              stockUpdateResults.push({
                product: itemInfo.name,
                quantity: quantity,
                purId,
                supplier,
                qtyOrdered,
                qtyOutstanding,
                error: stockError.message || 'Failed to update Cliniko stock'
              });
            }
          }
        }
      }
      
      setQuantities({});
      await fetchPURsForBarcode(displayBarcode);
      
      // Show detailed success message including stock update results
      let message = "Items received successfully.";
      const updatedStock = stockUpdateResults.filter(r => r.result && r.result.updated);
      const skippedStock = stockUpdateResults.filter(r => r.result && !r.result.updated);
      const failedStock = stockUpdateResults.filter(r => r.error);
      
      if (updatedStock.length > 0) {
        message += `\n✅ Updated Cliniko stock for ${updatedStock.length} product(s).`;
      }
      if (skippedStock.length > 0) {
        message += `\n⚠️ Cliniko stock updates disabled - ${skippedStock.length} product(s) not updated.`;
      }
      if (failedStock.length > 0) {
        message += `\n❌ Failed to update Cliniko stock for ${failedStock.length} product(s).`;
      }
      
      alert(message);
    } catch (e) {
      console.error('Error in handleReceive:', e);
      setError(e.message || "Failed to update received items");
    }
  };

  // Always focus barcode input on mount and when page becomes visible
  React.useEffect(() => {
    const focusInput = () => {
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };
    focusInput();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") focusInput();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Simulate API call to fetch active PURs for a barcode
  const fetchPURsForBarcode = async (barcode) => {
    setError(null);
    setMatchingPURs([]);
    setItemInfo(null);
      setQuantities({});
    try {
      // TODO: Replace with real API call
      if (!window.api || !window.api.getActivePURsForBarcode) {
        setError("API not available");
        return;
      }
      const result = await window.api.getActivePURsForBarcode(barcode);
      if (result.error) {
        setError(result.error || "Failed to fetch purchase orders");
        setMatchingPURs([]);
        setItemInfo(null);
        return;
      }
      setMatchingPURs(result.purs || []);
      setItemInfo(result.item || null);
    } catch (e) {
      setError(e.message || "Failed to fetch purchase orders");
    }
  };

  // Shared sanitize function
  function sanitizeBarcode(raw) {
    return (raw || '').replace(/^[|\s]+|[|\s]+$/g, '');
  }

  const handleScan = (scannedBarcode) => {
    const clean = sanitizeBarcode(scannedBarcode);
    setDisplayBarcode(clean); // Always update manual input with last scanned value
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 32, background: "#f8fafc", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <h2>Receive Items</h2>
      <div style={{ margin: "16px 0" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontWeight: 500 }}>Scan or enter barcode:</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
          <input
            ref={barcodeInputRef}
            type="text"
            value={displayBarcode}
            onChange={e => setDisplayBarcode(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const clean = sanitizeBarcode(displayBarcode);
                setDisplayBarcode(clean);
                if (clean) fetchPURsForBarcode(clean);
              }
            }}
            onBlur={e => {
              // Optionally sanitize on blur
              setDisplayBarcode(sanitizeBarcode(e.target.value));
            }}
            style={{ 
              padding: "8px 12px", 
              borderRadius: 4, 
              border: "1px solid #ccc", 
              fontSize: "1em", 
              width: 320, 
              boxSizing: 'border-box',
              margin: 0,
              outline: 'none'
            }}
            placeholder="Scan or enter barcode"
            autoFocus
          />
          <button
            onClick={() => {
              const clean = sanitizeBarcode(displayBarcode);
              setDisplayBarcode(clean);
              if (clean) fetchPURsForBarcode(clean);
            }}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 4, 
              border: '1px solid #1976d2', 
              background: '#1976d2', 
              color: '#fff', 
              fontWeight: 500, 
              fontSize: '1em', 
              cursor: 'pointer', 
              whiteSpace: 'nowrap', 
              boxSizing: 'border-box', 
              margin: 0,
              flexShrink: 0,
              width: 'auto'
            }}
          >
            Search
          </button>
        </div>
      </div>
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
      {itemInfo && (
        <div style={{ marginBottom: 16 }}>
          <div><b>Item:</b> {itemInfo.name || itemInfo.product_name || "Unknown"}</div>
          <div><b>Barcode:</b> {displayBarcode}</div>
        </div>
      )}
      {matchingPURs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4>Active Items to Receive:</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Item ID</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>PUR#</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Supplier</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Qty Ordered</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Qty Outstanding</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>Quantity Received</th>
              </tr>
            </thead>
            <tbody>
              {matchingPURs.map((item, idx) => {
                const rowKey = item.id ? `${item.id}` : `row-${idx}`;
                const qtyKey = item.id ? `${item.id}` : `row-${idx}`;
                return (
                  <tr key={rowKey} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>{item.id}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>{item.pr_id || ''}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>{item.supplier || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>{item.qty_ordered || 0}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>{item.qty_outstanding || 0}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        min={1}
                        max={item.qty_outstanding || 0}
                        value={quantities[qtyKey] || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setQuantities(q => ({ ...q, [qtyKey]: val }));
                        }}
                        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", width: 80 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            onClick={handleReceive}
            style={{ marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 6, border: 'none', background: '#1976d2', color: '#fff', fontWeight: 600, fontSize: '1.1em', cursor: 'pointer' }}
          >
            Receive
          </button>
        </div>
      )}
      {/* Add a submit button and logic as needed */}
    </div>
  );
}

export default ReceiveItemsPage;
