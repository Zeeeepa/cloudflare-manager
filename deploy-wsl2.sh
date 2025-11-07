#!/bin/bash

#####################################################################
# Cloudflare Workers Manager - WSL2 Ubuntu Deployment Script
# 
# This script performs a complete deployment on a fresh WSL2 Ubuntu instance:
# - System dependencies (Node.js, SQLite, build tools)
# - Application setup
# - Database initialization
# - Service configuration
# - UI startup
#
# Usage: bash deploy-wsl2.sh
#####################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     Cloudflare Workers Manager - WSL2 Deployment         ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if running on WSL2
check_wsl2() {
    log_info "Checking if running on WSL2..."
    if ! grep -qi microsoft /proc/version; then
        log_warning "This script is designed for WSL2 Ubuntu. Continuing anyway..."
    else
        log_success "Running on WSL2"
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    sudo apt-get update -qq
    sudo apt-get upgrade -y -qq
    log_success "System packages updated"
}

# Install system dependencies
install_system_deps() {
    log_info "Installing system dependencies..."
    
    # Essential build tools
    sudo apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        libsqlite3-dev \
        python3 \
        pkg-config \
        ca-certificates \
        gnupg \
        lsb-release
    
    log_success "System dependencies installed"
}

# Install Node.js (using NodeSource)
install_nodejs() {
    log_info "Installing Node.js 20.x..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_warning "Node.js is already installed: $NODE_VERSION"
        read -p "Do you want to reinstall Node.js? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping Node.js installation"
            return
        fi
    fi
    
    # Install Node.js 20.x from NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    log_success "Node.js installed: $NODE_VERSION"
    log_success "npm installed: v$NPM_VERSION"
}

# Install PM2 process manager
install_pm2() {
    log_info "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        log_warning "PM2 is already installed"
        return
    fi
    
    sudo npm install -g pm2
    
    # Setup PM2 startup script
    pm2 startup systemd -u $USER --hp $HOME | grep -v 'PM2' | sudo bash || true
    
    log_success "PM2 installed and configured"
}

# Setup application directory
setup_app_directory() {
    log_info "Setting up application directory..."
    
    APP_DIR="$HOME/cloudflare-manager"
    
    # Get current script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    # If we're already in the app directory, use current location
    if [ "$SCRIPT_DIR" = "$APP_DIR" ]; then
        log_info "Already in application directory: $APP_DIR"
    else
        # Create app directory if it doesn't exist
        mkdir -p "$APP_DIR"
        
        # Copy all files to app directory (if not already there)
        if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
            log_info "Copying application files to $APP_DIR..."
            cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
        fi
    fi
    
    cd "$APP_DIR"
    log_success "Application directory ready: $APP_DIR"
}

# Install application dependencies
install_app_deps() {
    log_info "Installing application dependencies..."
    
    # Clean install
    rm -rf node_modules package-lock.json
    npm install
    
    log_success "Application dependencies installed"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ -f .env ]; then
        log_warning ".env file already exists"
        read -p "Do you want to regenerate it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Using existing .env file"
            return
        fi
    fi
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Create .env file
    cat > .env << EOF
# Server Configuration
PORT=3000

# JWT Secret - Generated automatically
JWT_SECRET=$JWT_SECRET

# Database Configuration
DB_PATH=./data/data.db

# Environment
NODE_ENV=production

# Debug Cloudflare API (set to true for debugging)
DEBUG_CF_API=false

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
EOF
    
    log_success "Environment file created with secure JWT_SECRET"
}

# Create data directory
setup_data_directory() {
    log_info "Creating data directory..."
    
    mkdir -p data
    chmod 755 data
    
    log_success "Data directory created"
}

# Build the application
build_application() {
    log_info "Building application..."
    
    npm run build
    
    log_success "Application built successfully"
}

# Initialize database
init_database() {
    log_info "Initializing database..."
    
    # The database will be automatically initialized when the app starts
    # This is handled by src/db/schema.ts
    
    log_success "Database will be initialized on first startup"
}

# Setup PM2 ecosystem file
setup_pm2_config() {
    log_info "Creating PM2 ecosystem configuration..."
    
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'cloudflare-manager',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    log_success "PM2 configuration created"
}

# Start the application
start_application() {
    log_info "Starting application with PM2..."
    
    # Stop existing instance if running
    pm2 delete cloudflare-manager 2>/dev/null || true
    
    # Start the application
    pm2 start ecosystem.config.js
    
    # Save PM2 process list
    pm2 save
    
    log_success "Application started"
}

# Create systemd service (alternative to PM2)
create_systemd_service() {
    log_info "Creating systemd service (alternative method)..."
    
    SERVICE_FILE="/etc/systemd/system/cloudflare-manager.service"
    APP_DIR="$HOME/cloudflare-manager"
    
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Cloudflare Workers Manager
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $APP_DIR/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflare-manager

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    log_success "Systemd service created (not enabled by default)"
    log_info "To use systemd instead of PM2:"
    log_info "  sudo systemctl enable cloudflare-manager"
    log_info "  sudo systemctl start cloudflare-manager"
}

# Display status and access information
show_status() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║              🎉 Deployment Complete! 🎉                   ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_success "Application is running!"
    echo ""
    
    log_info "Access Information:"
    echo "  🌐 Web UI: http://localhost:3000"
    echo "  📁 App Directory: $HOME/cloudflare-manager"
    echo "  💾 Database: $HOME/cloudflare-manager/data/data.db"
    echo ""
    
    log_info "Useful Commands:"
    echo "  📊 View status:    pm2 status"
    echo "  📝 View logs:      pm2 logs cloudflare-manager"
    echo "  🔄 Restart:        pm2 restart cloudflare-manager"
    echo "  ⏹️  Stop:          pm2 stop cloudflare-manager"
    echo "  🗑️  Remove:        pm2 delete cloudflare-manager"
    echo ""
    
    log_info "PM2 Management:"
    echo "  📊 Monitor:        pm2 monit"
    echo "  💾 Save list:      pm2 save"
    echo "  🔄 Resurrect:      pm2 resurrect"
    echo ""
    
    log_info "Database Backup:"
    echo "  📦 Backup:         cp data/data.db data/data.db.backup"
    echo ""
    
    # Show PM2 status
    echo ""
    pm2 status
    echo ""
    
    log_warning "First Time Setup:"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Initialize master password"
    echo "  3. Add your Cloudflare accounts"
    echo ""
    
    log_info "For Windows access from host (if needed):"
    echo "  Get WSL2 IP: ip addr show eth0 | grep inet | awk '{print \$2}' | cut -d/ -f1"
    echo "  Access via: http://<WSL2-IP>:3000"
    echo ""
}

# Main deployment function
main() {
    print_banner
    
    log_info "Starting deployment process..."
    echo ""
    
    # Execute deployment steps
    check_wsl2
    update_system
    install_system_deps
    install_nodejs
    install_pm2
    setup_app_directory
    install_app_deps
    setup_environment
    setup_data_directory
    build_application
    init_database
    setup_pm2_config
    start_application
    create_systemd_service
    
    # Show final status
    show_status
    
    log_success "Deployment completed successfully!"
}

# Run main function
main

