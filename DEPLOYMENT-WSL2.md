# WSL2 Ubuntu Deployment Guide

Complete guide for deploying Cloudflare Workers Manager on a fresh WSL2 Ubuntu instance.

## 🚀 Quick Start (One Command)

```bash
curl -fsSL https://raw.githubusercontent.com/Zeeeepa/cloudflare-manager/master/deploy-wsl2.sh | bash
```

Or download and run locally:

```bash
# Clone the repository
git clone https://github.com/Zeeeepa/cloudflare-manager.git
cd cloudflare-manager

# Make the script executable
chmod +x deploy-wsl2.sh

# Run deployment
./deploy-wsl2.sh
```

## 📋 What the Script Does

The deployment script automatically handles:

### 1. **System Updates**
- Updates all system packages
- Upgrades existing packages

### 2. **System Dependencies**
- curl, wget, git
- build-essential (gcc, g++, make)
- libsqlite3-dev
- Python3 (for node-gyp)
- pkg-config, ca-certificates

### 3. **Node.js Installation**
- Installs Node.js 20.x from NodeSource
- Installs npm (comes with Node.js)
- Verifies installation

### 4. **PM2 Process Manager**
- Installs PM2 globally
- Configures PM2 to start on system boot
- Sets up process monitoring

### 5. **Application Setup**
- Copies application files to `~/cloudflare-manager`
- Installs all npm dependencies
- Builds TypeScript to JavaScript

### 6. **Environment Configuration**
- Creates `.env` file with secure settings
- Generates random JWT_SECRET (using OpenSSL)
- Sets production environment

### 7. **Database Setup**
- Creates `data/` directory
- Database auto-initializes on first run
- Applies automatic migrations

### 8. **Service Configuration**
- Creates PM2 ecosystem config
- Sets up logging directory
- Optionally creates systemd service

### 9. **Application Startup**
- Starts application with PM2
- Saves PM2 process list
- Enables auto-restart on failure

## 🔧 Manual Installation Steps

If you prefer manual installation, follow these steps:

### Step 1: Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Step 2: Install System Dependencies

```bash
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    libsqlite3-dev \
    python3 \
    pkg-config \
    ca-certificates
```

### Step 3: Install Node.js 20.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node -v
npm -v
```

### Step 4: Install PM2

```bash
sudo npm install -g pm2

# Setup PM2 startup
pm2 startup systemd -u $USER --hp $HOME
# Run the command that PM2 outputs
```

### Step 5: Clone and Setup Application

```bash
# Clone repository
git clone https://github.com/Zeeeepa/cloudflare-manager.git
cd cloudflare-manager

# Install dependencies
npm install

# Create data directory
mkdir -p data
```

### Step 6: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Edit .env file
nano .env
# Set JWT_SECRET and other variables
```

Example `.env`:
```env
PORT=3000
JWT_SECRET=<your-secure-secret-here>
DB_PATH=./data/data.db
NODE_ENV=production
DEBUG_CF_API=false
CLIENT_URL=http://localhost:3000
```

### Step 7: Build Application

```bash
npm run build
```

### Step 8: Start with PM2

```bash
# Create PM2 config
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
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js

# Save PM2 list
pm2 save
```

## 📊 Post-Deployment

### Access the Application

1. **From WSL2:**
   ```
   http://localhost:3000
   ```

2. **From Windows Host:**
   ```bash
   # Get WSL2 IP address
   ip addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1
   
   # Access from Windows browser
   http://<WSL2-IP>:3000
   ```

### First Time Setup

1. Open browser to `http://localhost:3000`
2. **Initialize Master Password** (shown on first visit)
3. Login with your master password
4. **Add Cloudflare Account:**
   - Click "Add Account"
   - Enter account name
   - Choose authentication method:
     - **API Token** (recommended): Get from Cloudflare Dashboard
     - **Email + Global API Key**: Legacy method
5. Test connection with health check

## 🛠️ Management Commands

### PM2 Management

```bash
# View application status
pm2 status

# View logs (live tail)
pm2 logs cloudflare-manager

# View logs (last 100 lines)
pm2 logs cloudflare-manager --lines 100

# Monitor resources
pm2 monit

# Restart application
pm2 restart cloudflare-manager

# Stop application
pm2 stop cloudflare-manager

# Delete from PM2
pm2 delete cloudflare-manager

# Save PM2 process list
pm2 save

# Restore saved processes
pm2 resurrect

# Clear logs
pm2 flush
```

### Application Management

```bash
# View application directory
cd ~/cloudflare-manager

# Update application
git pull
npm install
npm run build
pm2 restart cloudflare-manager

# View database
sqlite3 data/data.db
# Inside sqlite3:
.tables
SELECT * FROM accounts;
.quit

# Backup database
cp data/data.db data/data.db.backup.$(date +%Y%m%d_%H%M%S)

# View application logs manually
tail -f logs/out.log
tail -f logs/err.log
```

### System Service (Alternative to PM2)

If you prefer systemd over PM2:

```bash
# Enable systemd service
sudo systemctl enable cloudflare-manager

# Start service
sudo systemctl start cloudflare-manager

# Check status
sudo systemctl status cloudflare-manager

# View logs
sudo journalctl -u cloudflare-manager -f

# Stop service
sudo systemctl stop cloudflare-manager

# Restart service
sudo systemctl restart cloudflare-manager
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
nano .env
# Change PORT=3000 to PORT=3001
pm2 restart cloudflare-manager
```

### Database Locked Error

```bash
# Stop all instances
pm2 stop cloudflare-manager

# Check for lock
ls -la data/

# Remove lock files (if safe)
rm -f data/data.db-shm data/data.db-wal

# Restart
pm2 restart cloudflare-manager
```

### Permission Issues

```bash
# Fix data directory permissions
chmod -R 755 ~/cloudflare-manager/data
chown -R $USER:$USER ~/cloudflare-manager/data

# Restart application
pm2 restart cloudflare-manager
```

### Node.js Build Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# If python/build tools issue:
sudo apt-get install -y build-essential python3 python3-pip

# Rebuild native modules
npm rebuild
```

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs cloudflare-manager --lines 50

# Check for errors
pm2 describe cloudflare-manager

# Restart with error output
pm2 restart cloudflare-manager --log-date-format="YYYY-MM-DD HH:mm Z"

# Check environment variables
cat .env

# Manually run to see errors
cd ~/cloudflare-manager
node dist/index.js
```

### WSL2 IP Changes

WSL2 IP address changes on restart. To access from Windows:

**Option 1: Port Forwarding (PowerShell as Admin)**
```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL2-IP>
```

**Option 2: Always Use localhost**
- Access from WSL2 itself: `http://localhost:3000`
- Access via SSH tunnel from Windows

## 🔒 Security Recommendations

### Production Deployment

1. **Change JWT_SECRET**
   ```bash
   # Generate new secret
   openssl rand -base64 32
   
   # Update .env
   nano .env
   # Set new JWT_SECRET
   
   # Restart
   pm2 restart cloudflare-manager
   ```

2. **Use Firewall**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw enable
   ```

3. **Regular Backups**
   ```bash
   # Create backup script
   cat > ~/backup-cloudflare.sh << 'EOF'
   #!/bin/bash
   BACKUP_DIR="$HOME/cloudflare-backups"
   mkdir -p "$BACKUP_DIR"
   cp ~/cloudflare-manager/data/data.db "$BACKUP_DIR/data.db.$(date +%Y%m%d_%H%M%S)"
   # Keep only last 7 days
   find "$BACKUP_DIR" -name "data.db.*" -mtime +7 -delete
   EOF
   
   chmod +x ~/backup-cloudflare.sh
   
   # Add to crontab (daily at 2 AM)
   (crontab -l 2>/dev/null; echo "0 2 * * * $HOME/backup-cloudflare.sh") | crontab -
   ```

4. **Use Reverse Proxy (Nginx)**
   ```bash
   sudo apt-get install -y nginx
   
   # Create nginx config
   sudo nano /etc/nginx/sites-available/cloudflare-manager
   ```
   
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
       
       location /socket.io/ {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
       }
   }
   ```
   
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/cloudflare-manager /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 📊 Performance Tuning

### PM2 Cluster Mode

For better performance on multi-core systems:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'cloudflare-manager',
    script: './dist/index.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
```

### Database Optimization

```bash
# Inside sqlite3
sqlite3 data/data.db

# Run optimizations
PRAGMA optimize;
VACUUM;
ANALYZE;
.quit
```

## 📖 Additional Resources

- **Main README**: [README.md](README.md)
- **Cloudflare API**: https://developers.cloudflare.com/api/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Node.js Documentation**: https://nodejs.org/docs/

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `pm2 logs cloudflare-manager`
2. Review this troubleshooting guide
3. Check GitHub issues
4. Open a new issue with:
   - Error logs
   - System info (`uname -a`, `node -v`)
   - Steps to reproduce

---

**Happy Deploying! 🚀**

