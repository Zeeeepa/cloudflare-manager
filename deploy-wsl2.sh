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
    log_info "Installing comprehensive system dependencies..."
    
    # Core build tools and compilers
    log_info "Installing build tools and compilers..."
    sudo apt-get install -y -qq \
        build-essential \
        gcc \
        g++ \
        make \
        cmake \
        autoconf \
        automake \
        libtool \
        pkg-config
    
    # Network and download tools
    log_info "Installing network tools..."
    sudo apt-get install -y -qq \
        curl \
        wget \
        git \
        net-tools \
        netcat-openbsd \
        telnet \
        nmap \
        dnsutils \
        iputils-ping \
        traceroute
    
    # SSL/TLS and security
    log_info "Installing SSL/TLS libraries..."
    sudo apt-get install -y -qq \
        openssl \
        libssl-dev \
        ca-certificates \
        gnupg \
        lsb-release
    
    # Python and development tools
    log_info "Installing Python development tools..."
    sudo apt-get install -y -qq \
        python3 \
        python3-pip \
        python3-dev \
        python3-venv \
        python3-setuptools \
        python3-wheel
    
    # Database tools
    log_info "Installing database tools..."
    sudo apt-get install -y -qq \
        sqlite3 \
        libsqlite3-dev \
        postgresql-client \
        default-mysql-client \
        redis-tools
    
    # Compression and archive tools
    log_info "Installing compression tools..."
    sudo apt-get install -y -qq \
        zip \
        unzip \
        tar \
        gzip \
        bzip2 \
        xz-utils \
        p7zip-full
    
    # Install rar/unrar separately (may not be available in free repos)
    sudo apt-get install -y -qq unrar-free 2>/dev/null || log_warning "rar/unrar not available (proprietary)"
    
    # Text processing and utilities
    log_info "Installing text processing tools..."
    sudo apt-get install -y -qq \
        vim \
        nano \
        jq \
        sed \
        gawk \
        grep \
        tree \
        htop \
        tmux \
        screen
    
    # Install yq separately (may not be available in all repos)
    sudo apt-get install -y -qq yq 2>/dev/null || log_warning "yq not available in apt, skipping (can install via snap or binary)"
    
    # Version control
    log_info "Installing version control tools..."
    sudo apt-get install -y -qq \
        git \
        git-lfs \
        subversion
    
    # Development libraries
    log_info "Installing development libraries..."
    sudo apt-get install -y -qq \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
        libyaml-dev \
        libreadline-dev \
        zlib1g-dev \
        libbz2-dev \
        libncurses5-dev \
        libncursesw5-dev \
        libgdbm-dev \
        liblzma-dev \
        uuid-dev
    
    # System monitoring and debugging
    log_info "Installing system monitoring tools..."
    sudo apt-get install -y -qq \
        htop \
        iotop \
        iftop \
        nethogs \
        sysstat \
        strace \
        ltrace \
        lsof
    
    # Container and virtualization tools (optional)
    log_info "Installing container tools (optional)..."
    sudo apt-get install -y -qq docker.io docker-compose 2>/dev/null || log_warning "Docker installation failed (non-critical)"
    sudo apt-get install -y -qq podman 2>/dev/null || log_warning "Podman installation failed (non-critical)"
    
    # Add current user to docker group if docker installed
    if command -v docker &> /dev/null; then
        sudo usermod -aG docker $USER || true
    fi
    
    log_success "Comprehensive system dependencies installed"
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

# Install global Node.js tools
install_node_tools() {
    log_info "Installing global Node.js development tools..."
    
    # Essential tools
    sudo npm install -g \
        typescript \
        ts-node \
        nodemon \
        npm-check-updates \
        yarn \
        pnpm
    
    # Linting and formatting
    sudo npm install -g \
        eslint \
        prettier \
        tslint
    
    # Build and bundling tools
    sudo npm install -g \
        webpack \
        webpack-cli \
        vite \
        rollup
    
    # Testing frameworks
    sudo npm install -g \
        jest \
        mocha \
        vitest
    
    log_success "Global Node.js tools installed"
}

# Install PM2 process manager
install_pm2() {
    log_info "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        log_warning "PM2 is already installed"
        return
    fi
    
    sudo npm install -g pm2
    
    # Install PM2 log rotation
    pm2 install pm2-logrotate || true
    
    # Configure log rotation
    pm2 set pm2-logrotate:max_size 10M || true
    pm2 set pm2-logrotate:retain 7 || true
    pm2 set pm2-logrotate:compress true || true
    
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
    
    cat > ecosystem.config.cjs << 'EOF'
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
    pm2 start ecosystem.config.cjs
    
    # Save PM2 process list
    pm2 save
    
    log_success "Application started"
}

# Install additional development tools
install_additional_tools() {
    log_info "Installing additional development tools..."
    
    # Install GitHub CLI if not present
    if ! command -v gh &> /dev/null; then
        log_info "Installing GitHub CLI..."
        type -p curl >/dev/null || sudo apt install curl -y
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update -qq
        sudo apt install gh -y -qq
        log_success "GitHub CLI installed"
    else
        log_warning "GitHub CLI already installed"
    fi
    
    # Install lazygit (if available)
    log_info "Installing lazygit..."
    LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*')
    if [ -n "$LAZYGIT_VERSION" ]; then
        curl -sLo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz"
        tar xf lazygit.tar.gz lazygit
        sudo install lazygit /usr/local/bin
        rm lazygit lazygit.tar.gz
        log_success "lazygit installed"
    else
        log_warning "Could not determine lazygit version, skipping"
    fi
    
    # Install bat (better cat)
    log_info "Installing bat (better cat)..."
    sudo apt-get install -y -qq bat || log_warning "bat installation failed"
    
    # Create bat alias if installed as batcat
    if command -v batcat &> /dev/null && ! command -v bat &> /dev/null; then
        mkdir -p ~/.local/bin
        ln -s /usr/bin/batcat ~/.local/bin/bat || true
    fi
    
    # Install fd (better find)
    log_info "Installing fd-find..."
    sudo apt-get install -y -qq fd-find || log_warning "fd-find installation failed"
    
    # Install ripgrep (better grep)
    log_info "Installing ripgrep..."
    sudo apt-get install -y -qq ripgrep || log_warning "ripgrep installation failed"
    
    # Install exa (better ls)
    log_info "Installing exa..."
    sudo apt-get install -y -qq exa || log_warning "exa installation failed"
    
    # Install httpie (better curl)
    log_info "Installing httpie..."
    sudo apt-get install -y -qq httpie || log_warning "httpie installation failed"
    
    # Install tldr (simplified man pages)
    log_info "Installing tldr..."
    sudo npm install -g tldr || log_warning "tldr installation failed"
    
    # Install nvm (Node Version Manager) for easy Node.js switching
    log_info "Installing nvm..."
    if [ ! -d "$HOME/.nvm" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash || log_warning "nvm installation failed"
        log_success "nvm installed"
    else
        log_warning "nvm already installed"
    fi
    
    log_success "Additional development tools installed"
}

# Install monitoring and logging tools
install_monitoring_tools() {
    log_info "Installing monitoring and logging tools..."
    
    # Install Prometheus node exporter (optional)
    log_info "Installing Prometheus node exporter..."
    sudo apt-get install -y -qq prometheus-node-exporter || log_warning "Prometheus node exporter installation failed (non-critical)"
    
    # Install netdata (system monitoring)
    log_info "Installing netdata (this may take a while)..."
    bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait --disable-telemetry || log_warning "Netdata installation failed (non-critical)"
    
    # Install ctop (container monitoring)
    if command -v docker &> /dev/null; then
        log_info "Installing ctop..."
        sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop || true
        sudo chmod +x /usr/local/bin/ctop || true
    fi
    
    log_success "Monitoring tools installed"
}

# Install database tools and clients
install_database_tools() {
    log_info "Installing additional database tools..."
    
    # SQLite browser/manager
    log_info "Installing sqlite utilities..."
    sudo apt-get install -y -qq sqlite3 sqlitebrowser || log_warning "SQLite tools installation partial"
    
    # Install pgcli (better postgres CLI)
    log_info "Installing pgcli..."
    sudo pip3 install pgcli || log_warning "pgcli installation failed"
    
    # Install mycli (better mysql CLI)
    log_info "Installing mycli..."
    sudo pip3 install mycli || log_warning "mycli installation failed"
    
    # Install redis-cli tools
    log_info "Installing redis tools..."
    sudo apt-get install -y -qq redis-tools || log_warning "redis-tools installation failed"
    
    log_success "Database tools installed"
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

# Show installed tools summary
show_installed_tools() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║          📦 Installed Tools Summary 📦                    ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Core Tools:"
    command -v node &> /dev/null && echo "  ✓ Node.js: $(node -v)"
    command -v npm &> /dev/null && echo "  ✓ npm: v$(npm -v)"
    command -v pm2 &> /dev/null && echo "  ✓ PM2: v$(pm2 -v)"
    command -v python3 &> /dev/null && echo "  ✓ Python: $(python3 --version)"
    command -v git &> /dev/null && echo "  ✓ Git: $(git --version)"
    echo ""
    
    log_info "Node.js Tools:"
    command -v typescript &> /dev/null && echo "  ✓ TypeScript"
    command -v yarn &> /dev/null && echo "  ✓ Yarn"
    command -v pnpm &> /dev/null && echo "  ✓ pnpm"
    command -v nodemon &> /dev/null && echo "  ✓ Nodemon"
    command -v eslint &> /dev/null && echo "  ✓ ESLint"
    command -v prettier &> /dev/null && echo "  ✓ Prettier"
    echo ""
    
    log_info "Database Tools:"
    command -v sqlite3 &> /dev/null && echo "  ✓ SQLite3: $(sqlite3 --version | cut -d' ' -f1)"
    command -v psql &> /dev/null && echo "  ✓ PostgreSQL Client"
    command -v mysql &> /dev/null && echo "  ✓ MySQL Client"
    command -v redis-cli &> /dev/null && echo "  ✓ Redis CLI"
    command -v pgcli &> /dev/null && echo "  ✓ pgcli (Better PostgreSQL CLI)"
    command -v mycli &> /dev/null && echo "  ✓ mycli (Better MySQL CLI)"
    echo ""
    
    log_info "Development Tools:"
    command -v gh &> /dev/null && echo "  ✓ GitHub CLI"
    command -v lazygit &> /dev/null && echo "  ✓ lazygit"
    command -v docker &> /dev/null && echo "  ✓ Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
    command -v docker-compose &> /dev/null && echo "  ✓ Docker Compose"
    echo ""
    
    log_info "Modern CLI Tools:"
    command -v bat &> /dev/null && echo "  ✓ bat (Better cat)"
    command -v batcat &> /dev/null && echo "  ✓ batcat (Better cat)"
    command -v rg &> /dev/null && echo "  ✓ ripgrep (Better grep)"
    command -v fd &> /dev/null && echo "  ✓ fd (Better find)"
    command -v exa &> /dev/null && echo "  ✓ exa (Better ls)"
    command -v http &> /dev/null && echo "  ✓ httpie (Better curl)"
    command -v tldr &> /dev/null && echo "  ✓ tldr (Simplified man pages)"
    echo ""
    
    log_info "Monitoring Tools:"
    command -v htop &> /dev/null && echo "  ✓ htop"
    command -v iotop &> /dev/null && echo "  ✓ iotop"
    command -v nethogs &> /dev/null && echo "  ✓ nethogs"
    command -v ctop &> /dev/null && echo "  ✓ ctop (Container monitoring)"
    systemctl is-active --quiet netdata && echo "  ✓ netdata (System monitoring)"
    echo ""
    
    log_info "Text Editors & Utilities:"
    command -v vim &> /dev/null && echo "  ✓ vim"
    command -v nano &> /dev/null && echo "  ✓ nano"
    command -v jq &> /dev/null && echo "  ✓ jq (JSON processor)"
    command -v tree &> /dev/null && echo "  ✓ tree"
    command -v tmux &> /dev/null && echo "  ✓ tmux"
    echo ""
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
    
    log_info "Starting COMPREHENSIVE deployment process..."
    log_warning "This will install ALL possible dependencies and may take 10-15 minutes"
    echo ""
    
    # Ask user for confirmation
    read -p "Continue with full installation? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        log_info "Installation cancelled by user"
        exit 0
    fi
    
    # Execute deployment steps
    check_wsl2
    update_system
    install_system_deps
    install_nodejs
    install_node_tools
    install_pm2
    install_additional_tools
    install_database_tools
    install_monitoring_tools
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
    
    log_success "Comprehensive deployment completed successfully!"
    
    # Show installed tools summary
    show_installed_tools
}

# Run main function
main
