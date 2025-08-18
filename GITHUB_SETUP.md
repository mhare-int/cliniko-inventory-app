# GitHub Auto-Updater Setup Guide

## Quick Setup (5 minutes)

### 1. **Update Configuration Files**
In your code, replace these placeholders:

**`main.js` (line ~125):**
```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'mhare-int', // ✅ Already updated!
  repo: 'cliniko-inventory-app' // ✅ Already updated!
});
```

**`package-electron.json` (line ~45):**
```json
"publish": {
  "provider": "github",
  "owner": "mhare-int", // ✅ Already updated!
  "repo": "cliniko-inventory-app", // ✅ Already updated!
  "private": false,
  "releaseType": "release"
}
```

### 2. **Create GitHub Repository**
1. Go to GitHub.com
2. Click "New Repository"
3. Name it: `cliniko-inventory-app` (or whatever you prefer)
4. Make it **Public** (for free auto-updates) or **Private** (requires GitHub Pro)
5. Create repository

### 3. **Push Your Code to GitHub**
```powershell
cd "/Users/mitchellhare/Downloads/Revamped Cliniko App"
git init
git add .
git commit -m "Initial commit - Cliniko Inventory App"
git branch -M main
git remote add origin https://github.com/mhare-int/cliniko-inventory-app.git
git push -u origin main
```

### 4. **Generate GitHub Token (for publishing releases)**
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: "Cliniko App Releases"
4. Select scopes: `repo` (full control)
5. Click "Generate token"
6. **Save the token somewhere safe!**

### 5. **Set Environment Variable**
Add this to your terminal profile (`~/.zshrc` on macOS):
```powershell
export GH_TOKEN="your_github_token_here"
```

Then reload: `source ~/.zshrc`

## Your Update Workflow

### **To Release an Update:**

1. **Make your changes** (fix bugs, add features)

2. **Update version in package-electron.json:**
   ```json
   "version": "1.0.1", // Increment this
   ```

3. **Build and publish:**
   ```powershell
   npm run build --prefix client
   npx electron-builder --publish=always
   ```

4. **That's it!** 🎉
   - GitHub release is created automatically
   - Customer apps detect the update
   - They get notification to restart and install

### **Customer Experience:**
- App opens normally
- Small notification: "Update available (v1.0.1)"
- They click "Install" 
- App restarts with new version
- All their data preserved

## Testing the System

### **Test in Development:**
Auto-updater is disabled in development mode for safety.

### **Test in Production:**
1. Build your app: `npm run dist`
2. Install the built app from `/dist` folder
3. Create a new release on GitHub with higher version
4. Open your installed app - it should detect the update!

## Common Issues

### **"Update not found"**
- Check your GitHub username/repo in the config
- Make sure the repository is public
- Verify the release exists on GitHub

### **"Permission denied"**
- Check your GitHub token has `repo` permissions
- Make sure `GH_TOKEN` environment variable is set

### **"App won't start after update"**
- Database migration might have failed
- Check logs in app data directory
- Restore from automatic backup if needed

## Security Notes

- Keep your GitHub token secure
- Don't commit the token to your repository
- Use environment variables for sensitive data
- Consider code signing for production releases

---

🎯 **Once this is set up, updating your app for customers becomes as simple as:**
1. Fix/improve something
2. Increment version
3. Run build command
4. Done! All customers get the update automatically.
