#!/bin/bash

#####################################################################
# Cloudflare Workers Manager - Quick Start Script
# 
# Ultra-fast deployment for WSL2 Ubuntu
# 
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/cloudflare-manager/master/quick-start.sh | bash
#####################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Cloudflare Workers Manager - Quick Start             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Get the repository URL
REPO_URL="https://github.com/Zeeeepa/cloudflare-manager.git"
APP_DIR="$HOME/cloudflare-manager"

echo -e "${BLUE}[1/5]${NC} Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "Directory already exists. Updating..."
    cd "$APP_DIR"
    git pull
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

echo -e "${BLUE}[2/5]${NC} Making deployment script executable..."
chmod +x deploy-wsl2.sh

echo -e "${BLUE}[3/5]${NC} Running deployment script..."
./deploy-wsl2.sh

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║             Quick Start Complete!                      ║"
echo "║                                                        ║"
echo "║  🌐 Access: http://localhost:3000                     ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

