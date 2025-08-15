#!/bin/bash

# Comprehensive Release Script for Cliniko Inventory App
# This script automates the entire release process with proper versioning and validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to get latest GitHub release version
get_latest_github_version() {
    local latest_version=$(gh release list --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null | sed 's/v//')
    if [ -z "$latest_version" ]; then
        echo "0.0.0"
    else
        echo "$latest_version"
    fi
}

# Function to increment version
increment_version() {
    local version=$1
    local type=$2
    
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $type in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Function to update version in package.json files
update_package_version() {
    local new_version=$1
    
    # Update main package.json
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available (more reliable)
        jq ".version = \"$new_version\"" package.json > package.json.tmp && mv package.json.tmp package.json
        jq ".version = \"$new_version\"" client/package.json > client/package.json.tmp && mv client/package.json.tmp client/package.json
    else
        # Fallback to sed
        sed -i.bak "s/\"version\": \".*\"/\"version\": \"$new_version\"/" package.json
        sed -i.bak "s/\"version\": \".*\"/\"version\": \"$new_version\"/" client/package.json
        rm -f package.json.bak client/package.json.bak
    fi
}

# Main script starts here
echo "🚀 Cliniko Inventory App - Automated Release Script"
echo "==================================================="

# Step 1: Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository!"
    exit 1
fi

# Step 2: Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    print_warning "You have uncommitted changes."
    read -p "Do you want to commit them first? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Committing changes..."
        git add .
        read -p "Enter commit message: " commit_message
        git commit -m "$commit_message"
        print_success "Changes committed"
    else
        print_error "Please commit or stash your changes before releasing."
        exit 1
    fi
fi

# Step 3: Get current and latest versions
print_step "Checking versions..."
current_version=$(node -p "require('./package.json').version")
latest_github_version=$(get_latest_github_version)

echo "Current version: $current_version"
echo "Latest GitHub version: $latest_github_version"

# Step 4: Determine new version
echo ""
echo "What type of release is this?"
echo "1) Patch (bug fixes) - ${current_version} → $(increment_version $current_version patch)"
echo "2) Minor (new features) - ${current_version} → $(increment_version $current_version minor)"
echo "3) Major (breaking changes) - ${current_version} → $(increment_version $current_version major)"
echo "4) Custom version"
echo "5) Keep current version ($current_version)"

read -p "Choose an option (1-5): " version_choice

case $version_choice in
    1)
        new_version=$(increment_version $current_version patch)
        ;;
    2)
        new_version=$(increment_version $current_version minor)
        ;;
    3)
        new_version=$(increment_version $current_version major)
        ;;
    4)
        read -p "Enter custom version (e.g., 2.1.0): " new_version
        ;;
    5)
        new_version=$current_version
        ;;
    *)
        print_error "Invalid choice!"
        exit 1
        ;;
esac

echo "New version will be: $new_version"
read -p "Continue with version $new_version? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Release cancelled."
    exit 1
fi

# Step 5: Update package.json versions
if [ "$new_version" != "$current_version" ]; then
    print_step "Updating package.json versions..."
    update_package_version $new_version
    print_success "Version updated to $new_version"
fi

# Step 6: Clean database for distribution
print_step "Cleaning database for distribution..."
npm run clean-db
if [ $? -ne 0 ]; then
    print_error "Database cleaning failed!"
    exit 1
fi
print_success "Database cleaned"

# Step 7: Validate database
print_step "Validating database..."
npm run validate-db
if [ $? -ne 0 ]; then
    print_error "Database validation failed!"
    exit 1
fi
print_success "Database validated"

# Step 8: Build React client
print_step "Building React client..."
cd client
npm run build
if [ $? -ne 0 ]; then
    print_error "React build failed!"
    exit 1
fi
cd ..
print_success "React client built"

# Step 9: Rebuild native dependencies
print_step "Rebuilding native dependencies..."
npm run rebuild
if [ $? -ne 0 ]; then
    print_error "Native dependency rebuild failed!"
    exit 1
fi
print_success "Native dependencies rebuilt"

# Step 10: Build Electron application
print_step "Building Electron application..."
npm run package
if [ $? -ne 0 ]; then
    print_error "Electron build failed!"
    exit 1
fi
print_success "Electron application built"

# Step 11: Commit version changes (if any)
if [ "$new_version" != "$current_version" ]; then
    print_step "Committing version changes..."
    git add package.json client/package.json
    git commit -m "chore: bump version to $new_version"
    print_success "Version changes committed"
fi

# Step 12: Create git tag
print_step "Creating git tag..."
git tag -a "v$new_version" -m "Release v$new_version"
print_success "Git tag v$new_version created"

# Step 13: Push changes and tags
print_step "Pushing to GitHub..."
git push origin main
git push origin "v$new_version"
print_success "Changes and tags pushed to GitHub"

# Step 14: Create GitHub release
print_step "Creating GitHub release..."

# Check if dist files exist
expected_files=(
    "dist/Good Life Clinic - Inventory Management Setup $new_version.exe"
    "dist/Good Life Clinic - Inventory Management-$new_version-arm64.dmg"
    "dist/Good Life Clinic - Inventory Management-$new_version-arm64-mac.zip"
    "dist/latest.yml"
)

missing_files=()
for file in "${expected_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    print_error "Missing distribution files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    print_warning "Continuing with available files..."
fi

# Create release notes
release_notes="## 🎉 Version $new_version

### ✨ Key Features:
- JavaScript precision fixes for large ID values
- Enhanced supplier sync functionality  
- Improved Windows email generation
- Database schema improvements with foreign key relationships

### 🔧 Improvements:
- Fixed reorder level updates for all product IDs
- Automatic supplier population from Cliniko
- Enhanced cross-platform email client support
- Better error handling and logging

### 🛠️ Technical:
- Database migration v7 with TEXT ID handling
- Improved PowerShell email scripting for Windows
- Enhanced supplier relationship management
- Maintained backward compatibility

This release resolves critical precision issues and enhances the supplier management workflow."

# Build the gh release command with available files
gh_command="gh release create v$new_version --title \"Release v$new_version\" --notes \"$release_notes\""

for file in "${expected_files[@]}"; do
    if [ -f "$file" ]; then
        gh_command="$gh_command \"$file\""
    fi
done

# Execute the release creation
eval $gh_command

if [ $? -eq 0 ]; then
    print_success "GitHub release v$new_version created successfully!"
else
    print_error "Failed to create GitHub release!"
    exit 1
fi

# Step 15: Summary
echo ""
echo "🎉 RELEASE COMPLETED SUCCESSFULLY! 🎉"
echo "======================================"
echo "Version: $new_version"
echo "Tag: v$new_version"
echo "GitHub Release: https://github.com/mhare-int/cliniko-inventory-app/releases/tag/v$new_version"
echo ""
echo "Next steps:"
echo "- Test the auto-updater functionality"
echo "- Verify the release on different platforms"
echo "- Update any documentation if needed"
echo ""
print_success "Release process complete!"
