#!/bin/bash

#####################################################################
# Cloudflare Workers Manager - Installation Verification Script
# 
# Checks if all components are properly installed and configured
#####################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║     Cloudflare Manager - Installation Verification       ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# Check system
check_system() {
    print_section "System Information"
    
    # OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "  OS: $PRETTY_NAME"
        check_pass "Operating system detected"
    else
        check_warn "Cannot determine OS"
    fi
    
    # WSL2
    if grep -qi microsoft /proc/version; then
        echo "  Environment: WSL2"
        check_pass "Running on WSL2"
    else
        check_warn "Not running on WSL2 (this is okay)"
    fi
    
    # Architecture
    ARCH=$(uname -m)
    echo "  Architecture: $ARCH"
    if [ "$ARCH" = "x86_64" ]; then
        check_pass "x86_64 architecture"
    else
        check_warn "Non-standard architecture: $ARCH"
    fi
}

# Check Node.js
check_nodejs() {
    print_section "Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo "  Version: $NODE_VERSION"
        
        # Check version (should be >= 18)
        NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            check_pass "Node.js version >= 18"
        else
            check_fail "Node.js version too old (need >= 18)"
        fi
    else
        check_fail "Node.js not installed"
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo "  npm version: $NPM_VERSION"
        check_pass "npm installed"
    else
        check_fail "npm not installed"
    fi
}

# Check PM2
check_pm2() {
    print_section "PM2 Process Manager"
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 -v)
        echo "  Version: $PM2_VERSION"
        check_pass "PM2 installed"
        
        # Check if PM2 is running
        if pm2 list | grep -q "cloudflare-manager"; then
            check_pass "Application registered in PM2"
            
            # Check status
            if pm2 list | grep "cloudflare-manager" | grep -q "online"; then
                check_pass "Application is online"
            else
                check_fail "Application is not running"
            fi
        else
            check_warn "Application not found in PM2 (may not be started yet)"
        fi
    else
        check_fail "PM2 not installed"
    fi
}

# Check application
check_application() {
    print_section "Application Files"
    
    APP_DIR="$HOME/cloudflare-manager"
    
    if [ -d "$APP_DIR" ]; then
        echo "  Location: $APP_DIR"
        check_pass "Application directory exists"
        
        cd "$APP_DIR"
        
        # Check key files
        [ -f "package.json" ] && check_pass "package.json found" || check_fail "package.json missing"
        [ -f "tsconfig.json" ] && check_pass "tsconfig.json found" || check_fail "tsconfig.json missing"
        [ -d "src" ] && check_pass "src/ directory found" || check_fail "src/ directory missing"
        [ -d "node_modules" ] && check_pass "node_modules/ installed" || check_warn "node_modules/ not found (run npm install)"
        [ -d "dist" ] && check_pass "dist/ built" || check_warn "dist/ not found (run npm run build)"
        
    else
        check_fail "Application directory not found at $APP_DIR"
    fi
}

# Check configuration
check_configuration() {
    print_section "Configuration"
    
    APP_DIR="$HOME/cloudflare-manager"
    
    if [ -f "$APP_DIR/.env" ]; then
        check_pass ".env file exists"
        
        # Check key variables
        if grep -q "JWT_SECRET=" "$APP_DIR/.env"; then
            JWT_SECRET=$(grep "JWT_SECRET=" "$APP_DIR/.env" | cut -d= -f2)
            if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your-secret-key-change-this" ]; then
                check_pass "JWT_SECRET configured"
            else
                check_fail "JWT_SECRET not properly configured"
            fi
        else
            check_fail "JWT_SECRET not found in .env"
        fi
        
        if grep -q "PORT=" "$APP_DIR/.env"; then
            check_pass "PORT configured"
        else
            check_warn "PORT not specified (will use default 3000)"
        fi
        
        if grep -q "DB_PATH=" "$APP_DIR/.env"; then
            check_pass "DB_PATH configured"
        else
            check_warn "DB_PATH not specified (will use default)"
        fi
    else
        check_fail ".env file not found"
    fi
}

# Check database
check_database() {
    print_section "Database"
    
    APP_DIR="$HOME/cloudflare-manager"
    
    if [ -d "$APP_DIR/data" ]; then
        check_pass "data/ directory exists"
        
        if [ -f "$APP_DIR/data/data.db" ]; then
            DB_SIZE=$(du -h "$APP_DIR/data/data.db" | cut -f1)
            echo "  Database size: $DB_SIZE"
            check_pass "Database file exists"
            
            # Check if SQLite3 is available
            if command -v sqlite3 &> /dev/null; then
                # Check database integrity
                if sqlite3 "$APP_DIR/data/data.db" "PRAGMA integrity_check;" | grep -q "ok"; then
                    check_pass "Database integrity OK"
                else
                    check_fail "Database integrity check failed"
                fi
                
                # Check tables
                TABLE_COUNT=$(sqlite3 "$APP_DIR/data/data.db" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
                echo "  Tables: $TABLE_COUNT"
                if [ "$TABLE_COUNT" -gt 0 ]; then
                    check_pass "Database tables created"
                else
                    check_warn "Database tables not found (will be created on first run)"
                fi
            else
                check_warn "sqlite3 CLI not installed (cannot verify database)"
            fi
        else
            check_warn "Database file not found (will be created on first run)"
        fi
    else
        check_warn "data/ directory not found (will be created)"
    fi
}

# Check network
check_network() {
    print_section "Network & Connectivity"
    
    APP_DIR="$HOME/cloudflare-manager"
    
    # Check port from .env
    PORT=3000
    if [ -f "$APP_DIR/.env" ]; then
        PORT=$(grep "^PORT=" "$APP_DIR/.env" | cut -d= -f2 || echo "3000")
    fi
    
    echo "  Configured port: $PORT"
    
    # Check if port is listening
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$PORT "; then
            check_pass "Port $PORT is listening"
        else
            check_warn "Port $PORT is not listening (application may not be started)"
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$PORT "; then
            check_pass "Port $PORT is listening"
        else
            check_warn "Port $PORT is not listening (application may not be started)"
        fi
    else
        check_warn "Cannot check port status (netstat/ss not available)"
    fi
    
    # Test HTTP endpoint
    if command -v curl &> /dev/null; then
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" | grep -q "200"; then
            check_pass "Health endpoint responding"
        else
            check_warn "Health endpoint not responding (application may not be running)"
        fi
    fi
    
    # Get IP address
    if command -v ip &> /dev/null; then
        WSL_IP=$(ip addr show eth0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
        if [ -n "$WSL_IP" ]; then
            echo "  WSL2 IP: $WSL_IP"
            echo "  Access from Windows: http://$WSL_IP:$PORT"
            check_pass "Network interface configured"
        fi
    fi
}

# Check dependencies
check_dependencies() {
    print_section "System Dependencies"
    
    # Essential tools
    command -v curl &> /dev/null && check_pass "curl installed" || check_warn "curl not installed"
    command -v wget &> /dev/null && check_pass "wget installed" || check_warn "wget not installed"
    command -v git &> /dev/null && check_pass "git installed" || check_fail "git not installed"
    
    # Build tools
    command -v gcc &> /dev/null && check_pass "gcc installed" || check_warn "gcc not installed"
    command -v make &> /dev/null && check_pass "make installed" || check_warn "make not installed"
    
    # Python (for node-gyp)
    command -v python3 &> /dev/null && check_pass "python3 installed" || check_warn "python3 not installed"
    
    # SQLite
    command -v sqlite3 &> /dev/null && check_pass "sqlite3 CLI installed" || check_warn "sqlite3 CLI not installed (optional)"
}

# Show summary
show_summary() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                      Summary                              ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "  ${GREEN}✓ Passed:${NC}   $PASSED"
    echo -e "  ${YELLOW}⚠ Warnings:${NC} $WARNINGS"
    echo -e "  ${RED}✗ Failed:${NC}   $FAILED"
    echo ""
    
    if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 Perfect! Everything is working correctly!${NC}"
        echo ""
        echo "Access your application at: http://localhost:3000"
    elif [ $FAILED -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Installation is mostly complete, but there are some warnings.${NC}"
        echo "The application should still work, but review the warnings above."
    else
        echo -e "${RED}❌ Installation has some issues that need to be fixed.${NC}"
        echo "Please review the failed checks above and fix them."
        echo ""
        echo "Common fixes:"
        echo "  • Run: ./deploy-wsl2.sh"
        echo "  • Install missing dependencies"
        echo "  • Check configuration files"
    fi
    
    echo ""
}

# Main
main() {
    print_header
    check_system
    check_nodejs
    check_pm2
    check_application
    check_configuration
    check_database
    check_network
    check_dependencies
    show_summary
}

main

