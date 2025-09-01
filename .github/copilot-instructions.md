## Quick task receipt
I will add concise, actionable guidance so an AI coding agent can be productive immediately in this repo: architecture, developer workflows, patterns, and important files to inspect or edit.

## Checklist for the agent
- Understand the runtime split: Electron main, Node backend (server-like modules), and React client in `client/`.
- Use the project's migration system (`backend/migrations.js`) and `backend/db.js` when touching the DB.
- Prefer Electron when generating PDFs; fallback is HTML output under `backend/test-output/`.
- Follow project-specific conventions for filenames, DB backups, and safe ALTER patterns.

## Big-picture architecture
- Top-level Electron app: `main.js` (main process) + `preload.js` (exposes `window.api` IPC helpers to renderer).
- Renderer: React app in `client/` (sources in `client/src/`). Use `npm install` then run `npm start` inside `client` for dev.
- Backend logic: Node modules in `backend/` (not a separate server process; modules are required by Electron main or invoked by scripts). Key DB file: `backend/appdata.db` (SQLite).

## Key files and responsibilities (start here)
- `main.js` — Electron lifecycle, auto-updater wiring, and where Electron-specific flows (BrowserWindow) are created.
- `preload.js` — IPC bridge; renderer calls `window.api.<method>` to invoke backend functions. Check usages in `client/src`.
- `backend/db.js` — DB open, migrations runner (`runMigrations(db)`), and helper DB functions (supplier/PR updates).
- `backend/migrations.js` — canonical migration list and versioning; _read before_ making schema changes. It uses a `schema_version` table.
- `backend/createSupplierOrderFiles.js` — Purchase Order generator. Produces styled HTML per supplier and (when run under Electron) optionally produces PDFs via BrowserWindow.printToPDF.

## Developer workflows & useful commands
- Install deps (root): `npm install` (also run in `client/` for client deps).
- Run Electron locally: `npm run electron` (root `package.json` script). Useful for testing PDF generation because it provides a BrowserWindow.
- Build client: `cd client && npm run build` then run packaged electron. For development, `cd client && npm start` serves React dev server.
- Create test PO HTML/PDF: `node tools/test_create_po.js` will generate HTML; to produce PDFs the test respawns under Electron — prefer `.
node_modules\.bin\electron.cmd .\tools\test_create_po.js` or `npx electron .\tools\test_create_po.js` on Windows.
- Schema check: `node tools/check_schema.js` reports missing tables/columns against expected set.

## Project-specific conventions & gotchas
- Migrations: SQLite disallows ALTER ADD COLUMN with non-constant defaults (e.g. `CURRENT_TIMESTAMP`). Migrations in `backend/migrations.js` use a two-step add-then-backfill pattern — follow this pattern for compatibility.
- DB backups: `backend/appdata.db.backup.*` exist. Avoid destructive changes; create backups before mass ALTERs.
- File generation: PO generator creates a folder per supplier under `backend/test-output/<Supplier>/` and writes HTML and optionally PDF files. The generator will only write PDFs when executed inside an Electron main process.
- IPC surface: search `window.api.` in `client/src` to discover available renderer→main methods (e.g. `createSupplierOrderFilesForVendors`). Edit `preload.js` and `main.js` if adding new IPC handlers.
- Naming: UI text changed from “purchase requests” to “purchase orders” in UX only; internal DB names may still use `purchase_requests`. Be careful when renaming internal APIs.

## Integration points & external deps
- SQLite via `sqlite3` (see `package.json`). DB code lives in `backend/` and uses raw SQL strings — small edits here must be tested with `tools/check_schema.js` and by running the app to let migrations apply.
- Electron is listed in `devDependencies` and is the recommended runtime for PDF generation via `BrowserWindow.printToPDF` (implemented in `backend/createSupplierOrderFiles.js`).
- Excel/XLSX libs (`exceljs`, `xlsx`) exist but the PO generator now prefers HTML; keep compatibility if you touch older code.
- Auto-updater: `package-electron.json` + `main.js` are configured for GitHub publishing; see `PACKAGING.md` and `GITHUB_SETUP.md` for release workflow.

## Quick examples (where to change behavior)
- To change PO layout: edit `backend/createSupplierOrderFiles.js` (HTML template + CSS). If adding a logo, reference `client/public/goodlife-512.png` or include a runtime path.
- To add a new DB column safely: add a migration in `backend/migrations.js` that `ALTER TABLE ADD COLUMN` without a non-constant default, then `UPDATE` to backfill values.
- To expose a new renderer API: add handler in `main.js`, then add the same name to `preload.js`'s `contextBridge.exposeInMainWorld`, and call `window.api.<name>` from `client/src`.

## Detailed change locations (quick map)
The lines below point to the exact files and patterns to edit when changing common behaviors. Use these as your first touch points.

- Purchase order layout & PDF behaviour
	- File: `backend/createSupplierOrderFiles.js` — HTML template, inline CSS and sanitizer live here. To change the visual layout, edit the HTML string/template generation and the `escapeHtml`/`sanitize` helpers. To adjust PDF options (margins/page size), update the Electron `webContents.printToPDF` options inside the same file.

- DB schema and migrations
	- Files: `backend/migrations.js`, `backend/db.js` — Add migration objects to `migrations.js` following the existing pattern (id, name, up function). Remember SQLite: `ALTER TABLE ADD COLUMN` must not use dynamic defaults; add column then `UPDATE` to backfill.
	- Example pattern (follow existing code):
		- add column: `ALTER TABLE suppliers ADD COLUMN account_number TEXT;`
		- backfill: `UPDATE suppliers SET account_number = '' WHERE account_number IS NULL;`

- IPC / renderer↔main surface
	- Files: `main.js`, `preload.js`, `client/src/*` — Search for `window.api.` to discover calls. To add an API:
		- In `main.js`: use `ipcMain.handle('myApi', async (evt, arg) => { /* ... */ });`
		- In `preload.js`: expose it: `contextBridge.exposeInMainWorld('api', { myApi: (arg) => ipcRenderer.invoke('myApi', arg), ...existing })`
		- In renderer: call `await window.api.myApi(payload)` from `client/src` files.

- Front-end UI text / terminology
	- Files: `client/src/*.js` (notably `purchaseRequests.js`, `GenerateSupplierFiles.js`, `App.js`) — User-facing renames ("purchase requests" → "purchase orders") were done in UX only; search the codebase for `purchase_requests` vs user strings. Update labels, buttons, and messages here.

- Build & packaging
	- Files: `package.json`, `package-electron.json`, `client/package.json` — Scripts `npm run electron`, `npm run build` (client) and electron-builder config live here. For auto-update, inspect `main.js` and `package-electron.json`.

- Tests, helpers and local tools
	- Files: `tools/test_create_po.js` (PO generation test; can run under Electron to produce PDFs), `tools/check_schema.js` (schema validator), various `scripts/` in `client/`. Use these to validate changes quickly.

- Logs & appdata
	- Folder: `backend/` contains `appdata.db` and `*.backup.*`. Preserve backups when running schema changes. Check `backend/backend.log` and `backend/createSupplierOrderFiles.js` console logs for runtime info.

- Auto-updater / releases
	- Files: `main.js` (autoUpdater wiring), `package-electron.json` (publish settings). See `GITHUB_SETUP.md` and `PACKAGING.md` for the release workflow.
	- Release helpers & naming: use the repository's release helpers and the new `RELEASE_PROCESS.md` for deterministic uploads. Prefer hyphenated installer filenames (no spaces) to avoid GitHub converting spaces to dots. If you need to remove or rename an uploaded asset, use `scripts/delete_release_asset_by_name.js` and the PowerShell copy-and-upload snippet in `RELEASE_PROCESS.md`.

## GitHub Release Process (CRITICAL - Use this exact method)
**ALWAYS use PowerShell + GitHub API for releases - DO NOT try to install gh CLI or use other methods.**

GitHub token is stored in `.tools/gh_token.txt`. Use this exact PowerShell pattern:

1. **Create Release:**
```powershell
$headers = @{ "Authorization" = "token $(Get-Content -Path '.\.tools\gh_token.txt' -Raw)".Trim(); "Accept" = "application/vnd.github.v3+json" }
$body = @{ 
    tag_name = "v[VERSION]"; 
    target_commitish = "main"; 
    name = "Version [VERSION] - [TITLE]"; 
    body = "[RELEASE_NOTES]" 
} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "https://api.github.com/repos/mhare-int/cliniko-inventory-app/releases" -Method POST -Headers $headers -Body $body -ContentType "application/json"
$response.id
```

2. **Upload Assets (use release ID from step 1):**
```powershell
$releaseId = [ID_FROM_STEP_1]
$headers = @{ "Authorization" = "token $(Get-Content -Path '.\.tools\gh_token.txt' -Raw)".Trim(); "Content-Type" = "application/octet-stream" }

# Upload installer
$fileName = "Good Life Clinic - Inventory Management Setup [VERSION].exe"
$filePath = "dist\$fileName"
Invoke-RestMethod -Uri "https://uploads.github.com/repos/mhare-int/cliniko-inventory-app/releases/$releaseId/assets?name=$([System.Web.HttpUtility]::UrlEncode($fileName))" -Method POST -Headers $headers -InFile $filePath

# Upload auto-updater metadata
$fileName = "latest.yml"
$filePath = "dist\$fileName"
Invoke-RestMethod -Uri "https://uploads.github.com/repos/mhare-int/cliniko-inventory-app/releases/$releaseId/assets?name=$fileName" -Method POST -Headers $headers -InFile $filePath
```

**Standard Release Workflow:**
1. `npm run build-installer` (builds client + Electron + cleans DB)
2. `git add . && git commit -m "Release [VERSION]"`
3. `git push origin HEAD:main && git push origin v[VERSION]`
4. Use PowerShell commands above to create GitHub release with assets

**Never** try to install gh CLI, use browser methods, or other approaches - stick to this proven PowerShell + API method.

If you can't find a string or handler, run a workspace search for the exact text (e.g. `window.api`, `purchase_requests`, `createSupplierOrderFiles`) — that's the fastest way to find related code.

## When in doubt: tests & validation
- Run `node tools/check_schema.js` after schema edits.
- Use `tools/test_create_po.js` to sanity-check the PO generator; run under Electron to verify PDF output.
- Start Electron (`npm run electron`) and watch logs for migration application messages — migrations run at DB open time.

---
If anything here is unclear or you'd like me to include more examples (e.g., exact IPC handler signatures, a migration template, or a small Puppeteer HTML→PDF script), tell me which piece to expand and I'll iterate.

## Styling & layout conventions (how to build components consistently)
This repo uses a small set of consistent layout rules so UI is predictable across pages. Follow these rules when adding new horizontal controls, tabs, or page containers.

- Source of truth for horizontal alignment: `HORIZONTAL_LAYOUT_REFERENCE.md` at the repo root. Copy the pattern from `GenerateSupplierFiles.js` and `MasterList.js` when creating new horizontal rows.
- Top-level page wrapper: components are normally rendered inside `client/src/PageWrapper.js`. Keep page-level padding/margins in that component (it exposes the `.page-wrapper` class).
- CSS files to update for global styles: `client/src/index.css`, `client/src/App.css`. Per-component styles live next to components (`TabsNav.css`, `SmartPrompt.css`, etc.).

Concrete rules (copy-paste friendly)
- Containers:
	- Use a flex row container for horizontal groups:
		```jsx
		<div style={{display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 20, minHeight: 48}}>
			{/* children */}
		</div>
		```
	- Key: `alignItems: 'flex-end'` ensures baseline alignment.

- Buttons and spans:
	- Buttons: `height: 48` (number), `padding: '0 16px'`, `display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`, `boxSizing: 'border-box'`.
	- Inline display fields: use `<span>` with `height: 48`, `display: 'flex'`, `alignItems: 'center'`, and `paddingLeft/Right` instead of complex padding shorthand.
	- Avoid using string pixel heights (e.g. `'48px'`) — use numbers in inline style where possible.

- Tabs and navigation:
	- Tabs are implemented under `client/src/TabsNav.js` and styled in `client/src/TabsNav.css`. Follow the existing class naming and structure when adding new tabs.
	- Keep tab content inside the `.page-wrapper` so the PageWrapper smart prompt and consistent margins apply.

- Component structure recommendations
	- Keep components small and focused: prefer many small components in `client/src/` rather than monolithic pages.
	- CSS responsibilities: global layout (page margins, fonts) in `index.css` / `App.css`; component-specific styles in companion `.css` files.
	- Prefer inline styles only for one-off layout rules that won't be reused; for repeated patterns, add a class to the component CSS.

- Accessibility & responsive notes
	- Keep buttons keyboard-focusable and ensure color contrast (existing styles follow simple blue/white themes used elsewhere).
	- For responsive behavior, rely on percent widths in the horizontal pattern (see example in `HORIZONTAL_LAYOUT_REFERENCE.md`) and fall back to stacked vertical flow on narrow screens.

If you want, I can add a small `client/src/ui-guidelines.md` or a CSS utility file (`client/src/styles/layout.css`) that exports the canonical classes (`.h-row`, `.h-btn`, `.h-field`) to reduce duplication — tell me which you prefer and I'll add it.
