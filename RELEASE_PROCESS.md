# Release process (short reference)

Purpose
- Capture the exact steps and commands used to build, name, and upload Windows installer assets so releases are reproducible and auto-update metadata (`latest.yml`) stays correct.

Principles
- Always produce an installer filename without spaces; use hyphens. Example: `Good-Life-Clinic-Inventory-Management-Setup-3.0.3.exe`.
- Create a backup of any DB edits, and run migrations against a working copy before packaging.
- Keep `dist/latest.yml` consistent with the remote asset name before uploading.

Checklist (minimal)
- Bump version in `package.json` and `client/package.json`.
- Commit and push the `release` branch (or appropriate branch) and tag the commit: `git tag -a vX.Y.Z -m "Release vX.Y.Z"` then `git push origin release && git push origin vX.Y.Z`.
- Build client and installer (see commands below).
- Ensure `backend/appdata.db` is sanitized for distribution (see `clean-database-for-dist.js`).
- Ensure `dist/latest.yml` `path`/`files[0].url` match the final installer filename.
- Upload assets with `scripts/upload_release_assets.js` using an env `GH_TOKEN`.

Commands (PowerShell) — build + package
```powershell
# from repo root
npx --yes npm-run-all --silent --print-name build-client
npx --yes npm-run-all --silent --print-name migrate-dist-db
npm run build-installer
```

Commands — sanitize DB for distribution (optional but recommended)
```powershell
node .\clean-database-for-dist.js .\backend\appdata.db
# verify
node .\tools\check_db_state.js .\backend\appdata.db
```

Filename hygiene and re-upload (safe, copy-and-upload approach)
- If GitHub converts spaces to dots when you upload, avoid that by uploading a hyphenated filename. Rather than rebuilding, copy the produced EXE to a hyphenated name and upload the copy.

PowerShell snippet: copy EXE to hyphenated name, upload, remove token
```powershell
$exe=(Resolve-Path '.\dist\Good Life Clinic - Inventory Management Setup 3.0.3.exe').Path
$hyph=Join-Path (Split-Path $exe) 'Good-Life-Clinic-Inventory-Management-Setup-3.0.3.exe'
Copy-Item $exe $hyph -Force
$env:GH_TOKEN = 'ghp_...'
node .\scripts\upload_release_assets.js mhare-int cliniko-inventory-app v3.0.3 $hyph .\dist\latest.yml
node .\scripts\list_release_assets.js mhare-int cliniko-inventory-app v3.0.3
Remove-Item Env:\GH_TOKEN
```

Notes on `dist/latest.yml`
- `dist/latest.yml` must contain the `path`/`files[0].url` entries that match the name GitHub will store. If you upload a hyphenated copy, update `dist/latest.yml` before uploading so the uploaded `latest.yml` refers to the hyphenated name.
- Example minimal snippet to ensure `path` matches the filename:
```yaml
files:
  - url: Good-Life-Clinic-Inventory-Management-Setup-3.0.3.exe
    sha512: <sha512-value>
    size: 105274127
path: Good-Life-Clinic-Inventory-Management-Setup-3.0.3.exe
```

Deleting an incorrectly-named asset on the release (if needed)
```powershell
# delete an uploaded asset named latest.yml
$env:GH_TOKEN='ghp_...'
node .\scripts\delete_release_asset_by_name.js mhare-int cliniko-inventory-app v3.0.3 latest.yml
node .\scripts\list_release_assets.js mhare-int cliniko-inventory-app v3.0.3
Remove-Item Env:\GH_TOKEN
```

Good practices
- Automate this in CI: prefer a workflow that builds the installer, renames the artifact to the canonical hyphenated filename, produces `dist/latest.yml` referencing that name, and uploads assets using a release job. That avoids manual renames/copies and GitHub conversions.
- Keep `dist/latest.yml` under source control only if you intend it to be the canonical upstream metadata. Otherwise generate it during the build and upload it with the release assets.

If you want, I can:
- add a short `scripts/rename_and_upload.ps1` wrapper that copies the EXE to the hyphenated name, updates `dist/latest.yml` (path/url), uploads both files, and optionally deletes the old dotted asset; or
- add a CI GitHub Actions workflow to produce deterministic filenames and upload releases automatically.

---
Short reference created by the release automation work on 2025-08-22.