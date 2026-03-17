# Git Setup Reference

## Git Installation Location
Git is installed at: `C:\Users\mhare\AppData\Local\Programs\Git\cmd\git.exe`

## How to Add Git to PATH (PowerShell)
```powershell
$env:PATH = "$env:USERPROFILE\AppData\Local\Programs\Git\cmd;$env:PATH"
```

## Verify Git is Working
```powershell
git --version
# Should output: git version 2.50.1.windows.1
```

## Common Git Commands for This Project
```powershell
# Check status
git status

# Stage all changes
git add .

# Commit changes
git commit -m "Your commit message"

# Check commit history
git log --oneline

# Check remotes
git remote -v
```

## Repository Status
- Repository is initialized (`.git` folder exists)
- Currently on `master` branch
- No remote origin configured (local repository only)

## Last Successful Operations
- Git path found: ✅
- PATH configured: ✅
- Changes committed: ✅
- Status: Working tree clean

## Notes
- Use the full path if git command not found: `&"$env:USERPROFILE\AppData\Local\Programs\Git\cmd\git.exe"`
- Repository location: `C:\Users\mhare\Documents\cliniko-inventory-app-2.0.5`
- Last commit: Major system overhaul (commit ID: 34a3dba)

## Emergency Git Access
If git command fails, use:
```powershell
&"C:\Users\mhare\AppData\Local\Programs\Git\cmd\git.exe" status
```
