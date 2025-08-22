Release 3.0.2

Files produced by the build:

- dist/Good Life Clinic - Inventory Management Setup 3.0.2.exe
- dist/Good Life Clinic - Inventory Management Setup 3.0.2.exe.blockmap
- dist/latest.yml

Notes:
- The installer binary is large; it is not checked into git. Upload the `.exe` and `.blockmap` to the GitHub Release for tag `v3.0.2` (recommended).
- The `latest.yml` file in `dist/` can be used by the auto-updater if you publish these artifacts to GitHub Releases under the `release` channel.
- To create the release on GitHub and attach artifacts, use the web UI or `gh` CLI: `gh release create v3.0.2 dist/*.exe dist/*.blockmap --title "v3.0.2" --notes-file RELEASE_NOTES.md`.

Build run summary:
- Built on: 2025-08-22
- package.json version: 3.0.2
- electron-builder config: package-electron.json
