#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to increment version
increment_version() {
    local version=$1
    # Remove 'v' prefix if it exists
    version="${version#v}"
    
    # Split version into major, minor, and patch
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    local patch=$(echo $version | cut -d. -f3)
    
    # Increment patch
    patch=$((patch + 1))
    
    # Return the new version
    echo "v${major}.${minor}.${patch}"
}

# Function to validate version format
validate_version() {
    local version=$1
    if [[ ! $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Invalid version format. Expected format: v1.0.0"
        exit 1
    fi
}

# Get the latest version tag
get_latest_version() {
    # Get all tags, sort them by version number, and get the latest one
    git fetch --tags > /dev/null 2>&1
    local latest_tag=$(git tag -l "v*" | sort -V | tail -n 1)
    
    if [ -z "$latest_tag" ]; then
        echo "v0.0.0"
    else
        echo "$latest_tag"
    fi
}

# Main script
echo -e "${GREEN}Starting release process...${NC}"

# If version is provided, use it; otherwise, increment the latest version
if [ -z "$1" ]; then
    LATEST_VERSION=$(get_latest_version)
    echo -e "Latest version: ${GREEN}${LATEST_VERSION}${NC}"
    
    VERSION=$(increment_version "$LATEST_VERSION")
    echo -e "New version will be: ${GREEN}${VERSION}${NC}"
    
    # Ask for confirmation unless AUTO_CONFIRM is set
    if [ -z "$AUTO_CONFIRM" ]; then
        read -p "Do you want to continue with this version? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Release cancelled${NC}"
            exit 1
        fi
    fi
else
    # Add 'v' prefix if not present
    VERSION=$1
    if [[ ! $VERSION =~ ^v ]]; then
        VERSION="v$VERSION"
    fi
    
    # Validate version format
    validate_version "$VERSION"
fi

# Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag $VERSION already exists${NC}"
    exit 1
fi

# Configure git for GitHub Actions environment
if [ -n "$GITHUB_ACTIONS" ]; then
    git config --local user.email "github-actions[bot]@users.noreply.github.com"
    git config --local user.name "github-actions[bot]"
fi

# Build the dist directory
echo -e "${GREEN}Building dist directory...${NC}"
npm run build

# Check if there are changes in dist
if git diff --quiet dist/; then
    echo -e "${GREEN}No changes in dist directory${NC}"
else
    echo -e "${GREEN}Changes detected in dist directory, committing...${NC}"
    git add dist/
    git commit -m "chore: update dist for release $VERSION"
    git push origin HEAD:main
fi

# Create the release using GitHub CLI
echo -e "${GREEN}Creating release $VERSION...${NC}"

# Get the previous tag for release notes
PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$PREVIOUS_TAG" ]; then
    # If no previous tag exists, create release without --notes-start-tag
    gh release create "$VERSION" \
        --title "Release $VERSION" \
        --draft \
        --generate-notes
else
    # Create release with notes from previous tag
    gh release create "$VERSION" \
        --title "Release $VERSION" \
        --draft \
        --notes-start-tag "$PREVIOUS_TAG" \
        --generate-notes
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Draft release $VERSION created successfully!${NC}"
    echo -e "Please review and publish it on GitHub:"
    echo -e "${NC}$(gh repo view --json url -q .url)/releases"

    # Update major version tag
    if [[ $VERSION =~ ^v([0-9]+)\. ]]; then
        MAJOR_VERSION="v${BASH_REMATCH[1]}"
        echo -e "${GREEN}Updating $MAJOR_VERSION tag...${NC}"
        git tag -f "$MAJOR_VERSION"
        git push -f origin "$MAJOR_VERSION"
        echo -e "${GREEN}Successfully updated $MAJOR_VERSION tag${NC}"
    fi
else
    echo -e "${RED}Failed to create release${NC}"
    exit 1
fi
