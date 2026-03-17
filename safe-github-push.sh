#!/bin/bash

# Safe GitHub Push Script
# This script ensures the database is clean and tokens are validated before pushing to GitHub

set -e  # Exit on any error

echo "🚀 Safe GitHub Push Script"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
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

# Step 1: Check if we're in a git repository
print_status "Checking git repository status..."
if [ ! -d ".git" ]; then
    print_error "Not in a git repository!"
    exit 1
fi

# Step 2: Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_status "Found uncommitted changes. Staging all files..."
    git add .
    print_success "All files staged"
else
    print_warning "No changes to commit"
fi

# Step 3: Validate GitHub token exists
print_status "Validating GitHub token..."
if node decrypt-github-token.js --db "backend/appdata.db" > /dev/null 2>&1; then
    print_success "GitHub token is present and valid"
else
    print_error "GitHub token validation failed!"
    print_error "Please run: ./setup-github-token.sh"
    exit 1
fi

# Step 4: Clean database for distribution
print_status "Cleaning database for safe distribution..."
node clean-database-for-dist.js
if [ $? -eq 0 ]; then
    print_success "Database cleaned successfully"
else
    print_error "Database cleaning failed!"
    exit 1
fi

# Step 5: Re-validate GitHub token after cleaning
print_status "Re-validating GitHub token after cleaning..."
if node decrypt-github-token.js --db "backend/appdata.db" > /dev/null 2>&1; then
    print_success "GitHub token preserved during cleaning"
else
    print_error "GitHub token was lost during cleaning!"
    exit 1
fi

# Step 6: Validate database schema and cleanliness
print_status "Validating database schema and cleanliness..."
npm run validate-db
if [ $? -eq 0 ]; then
    print_success "Database validation passed"
else
    print_error "Database validation failed!"
    exit 1
fi

# Step 7: Add cleaned database to git
print_status "Adding cleaned database to commit..."
git add backend/appdata.db

# Step 8: Check if there are actually changes to commit
if [ -z "$(git diff --cached --name-only)" ]; then
    print_warning "No changes to commit after cleaning"
    echo "Repository is already up to date"
    exit 0
fi

# Step 9: Get commit message (if not provided as argument)
if [ -z "$1" ]; then
    echo ""
    echo "Enter commit message (or press Enter for default):"
    read -r commit_message
    if [ -z "$commit_message" ]; then
        commit_message="chore: update application with cleaned database"
    fi
else
    commit_message="$1"
fi

# Step 10: Commit changes
print_status "Committing changes..."
git commit -m "$commit_message"
print_success "Changes committed successfully"

# Step 11: Push to GitHub
print_status "Pushing to GitHub..."
git push origin main
if [ $? -eq 0 ]; then
    print_success "Successfully pushed to GitHub!"
else
    print_error "Failed to push to GitHub!"
    exit 1
fi

echo ""
echo "🎉 Safe GitHub push completed successfully!"
echo "✅ Database was cleaned and validated"
echo "✅ GitHub token was preserved"
echo "✅ Changes committed and pushed"
echo ""
print_warning "Remember: Your local database was cleaned. Use the backup if you need your data:"
echo "   Backend backup files are saved with timestamps"
