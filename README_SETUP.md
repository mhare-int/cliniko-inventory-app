Packaging and Installer (Windows NSIS)

This repository is packaged with electron-builder. The project already contains a `build` configuration in `package.json` and `package-electron.json` targeting NSIS installers for Windows.

Prerequisites
- Node.js (LTS recommended)
- npm available in PATH
- On Windows: Install NSIS (https://nsis.sourceforge.io/Download) so electron-builder can create installers.

Quick build steps (Windows PowerShell):

# 1) Install top-level deps
npm install

# 2) Install client deps and build the React app, then package the app into a Windows installer
npm run build-installer

This script runs `npm install` inside `client/`, builds the client (`client/build`) and then runs `electron-builder --win --x64` to create an NSIS installer. Output will be in the `dist` folder (per `package-electron.json`).

Notes
- The packaging config includes `extraResources` to bundle `backend/appdata.db` into the built app. Ensure `backend/appdata.db` is the intended starting DB; otherwise replace or backup before building.
- To publish releases to GitHub (auto-updater), update the `publish` section in `package.json` / `package-electron.json` with correct `owner` and `repo`, and create a GitHub token with repo access.
- If you need a portable or single-file build, adjust targets in the `build.win` section (see `electron-builder` docs).
