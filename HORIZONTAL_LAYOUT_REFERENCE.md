# Horizontal Layout Reference

## Working Pattern for Perfect Horizontal Alignment

When creating horizontal layouts with buttons and input fields that need perfect alignment, use this proven pattern from GenerateSupplierFiles.js:

### Container Setup
```jsx
<div style={{ 
  display: "flex", 
  alignItems: "flex-end",  // KEY: This aligns all elements to bottom baseline
  gap: 18,                 // Consistent spacing
  marginBottom: 20, 
  minHeight: 48            // Ensures minimum container height
}}>
```

### Button Elements
```jsx
<button
  style={{
    // ... other styles
    padding: "0 16px",     // Simplified padding (no top/bottom)
    height: 48,            // Fixed height (number, not string)
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  }}
>
  Button Text
</button>
```

### Text/Input Display Elements
```jsx
<span style={{
  // ... other styles
  height: 48,              // Same height as buttons
  display: "flex",
  alignItems: "center",
  paddingLeft: 12,         // Explicit left/right padding
  paddingRight: 12,
  boxSizing: "border-box"
}}>
  Display Text
</span>
```

## Key Points

1. **Use `alignItems: "flex-end"`** - This is crucial for baseline alignment
2. **Consistent height** - All elements should have `height: 48` (number, not string)
3. **Simplified padding** - Use `"0 16px"` for buttons, explicit `paddingLeft/Right` for spans
4. **Box sizing** - Always include `boxSizing: "border-box"`
5. **Gap spacing** - Use `gap: 18` for consistent spacing between elements

## Working Example (MasterList.js)
```jsx
{/* Custom upload UI - Single horizontal line */}
<div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 20, minHeight: 48 }}>
  {/* Choose File Button - 33% */}
  <button
    type="button"
    onClick={handleFakeButtonClick}
    style={{
      background: "#e8f0fe",
      color: "#1867c0",
      padding: "0 16px",
      borderRadius: 4,
      border: "1px solid #1867c0",
      fontWeight: 600,
      fontSize: "1em",
      cursor: "pointer",
      boxSizing: "border-box",
      width: "33%",
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  >
    Choose File
  </button>
  
  {/* Filename field - 33% */}
  <span style={{
    fontSize: "1em",
    color: fileInput ? "#222" : "#999",
    fontStyle: fileInput ? "normal" : "italic",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    background: "#f6fafd",
    borderRadius: 4,
    border: "1px solid #ccc",
    boxSizing: "border-box",
    width: "33%",
    display: "flex",
    alignItems: "center",
    height: 48,
    paddingLeft: 12,
    paddingRight: 12
  }}>
    {fileInput ? fileInput.name : "No file chosen"}
  </span>
  
  {/* Upload Button - 20% */}
  <button
    onClick={handleUploadClick}
    disabled={uploading}
    style={{
      padding: "0 16px",
      fontSize: "1em",
      fontWeight: 600,
      background: uploading ? "#999" : "#1867c0",
      color: "#fff",
      border: "none",
      borderRadius: 4,
      cursor: uploading ? "wait" : "pointer",
      transition: "background 0.2s",
      boxSizing: "border-box",
      width: "20%",
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  >
    {uploading ? "Uploading..." : "Update Reorder Levels from File"}
  </button>
  
  {/* Small Template Button - 14% */}
  <button
    onClick={handleDownloadTemplate}
    style={{
      background: "#f0f9ff",
      color: "#0369a1",
      padding: "0 12px",
      borderRadius: 4,
      border: "1px solid #0369a1",
      fontWeight: 600,
      fontSize: "1em",
      cursor: "pointer",
      boxSizing: "border-box",
      width: "14%",
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  >
    📥 Template
  </button>
</div>
```

## Common Mistakes to Avoid

❌ **Don't use `alignItems: "center"`** - This can cause alignment issues
❌ **Don't use string heights like `"48px"`** - Use numbers: `height: 48`
❌ **Don't use complex padding like `"8px 16px"`** - Use `"0 16px"` for buttons
❌ **Don't forget `boxSizing: "border-box"`** - Essential for proper sizing
❌ **Don't use `<div>` for text display** - Use `<span>` for inline text elements

✅ **Do use `alignItems: "flex-end"`** - Perfect baseline alignment
✅ **Do use consistent heights** - All elements same height
✅ **Do use explicit padding** - `paddingLeft/Right` for spans
✅ **Do include flex properties** - `display: flex`, `alignItems: center`, `justifyContent: center`

## Reference Components

- **GenerateSupplierFiles.js** - Original working pattern
- **MasterList.js** - Successfully implemented pattern
- **ReceiveItemsPage.js** - Another working example

## Troubleshooting

If elements are not aligning horizontally:
1. Check container has `alignItems: "flex-end"`
2. Verify all elements have same `height: 48`
3. Ensure `boxSizing: "border-box"` on all elements
4. Use `<span>` for text display, not `<div>`
5. Check padding is simplified (`"0 16px"` or `paddingLeft/Right`)

This pattern is proven to work and should be the standard for all horizontal button/input layouts.
