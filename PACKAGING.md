# Packaging Your Flask + React + SQLite App as a Native Windows Desktop App

## 1. Build Flask Backend as EXE
- Install PyInstaller:  
  `pip install pyinstaller`
- Build executable:  
  `pyinstaller --onefile --add-data "appdata.db;." backend/app.py`
- Result: `dist/app.exe` (your backend)

## 2. Build React Frontend
- In `client` folder:  
  `npm run build`
- Result: `client/build` folder with static files

## 3. Update Electron to Load React Build
- In `main.js`, use:
  ```javascript
  win.loadFile(path.join(__dirname, 'client/build/index.html'));
  ```

## 4. Install Electron Builder
- In project root:  
  `npm install --save-dev electron-builder`

## 5. Update `package.json`
Add or update these fields:
```json
"main": "main.js",
"build": {
  "appId": "com.yourcompany.yourapp",
  "productName": "ClinikoApp",
  "files": [
    "main.js",
    "dist/app.exe",
    "client/build/**/*"
  ],
  "extraResources": [
    "appdata.db"
  ],
  "win": {
    "target": "nsis"
  }
},
"scripts": {
  "electron": "electron .",
  "dist": "electron-builder"
}
```

## 6. Build Installer
- Run:  
  `npm run dist`
- Output:  
  `/dist/ClinikoApp Setup.exe` (installer for Windows)

---

**Result:**  
A single installer EXE for Windows that runs Electron, launches your Flask backend EXE, and serves your React frontend.

**Note:**  
- Ensure all required files (DB, .env, uploads, etc.) are included.
- Test the installer on a clean Windows machine.
