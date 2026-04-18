# 0) masuk ke project backend yang benar

cd /www/wwwroot/apiwaway/backend || cd /www/wwwroot/apiwaway

# 1) install dependency runtime browser (Ubuntu 24 t64)

apt update
apt install -y \
 ca-certificates wget gnupg fonts-liberation xdg-utils \
 libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libc6 libcairo2 \
 libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0t64 \
 libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6

# 2) set cache puppeteer di path yang pasti ada

mkdir -p /www/wwwroot/.cache/puppeteer
export PUPPETEER_CACHE_DIR=/www/wwwroot/.cache/puppeteer

# 3) install Chrome for Testing sesuai Puppeteer

npx -y puppeteer@latest browsers install chrome

# 4) set env permanent di backend/.env

# PUPPETEER_CACHE_DIR=/www/wwwroot/.cache/puppeteer

# WA_HEADLESS=true

# (opsional) CHROME_PATH=/usr/bin/google-chrome-stable

# 5) restart service backend

# PM2: pm2 restart all

# systemd: systemctl restart <nama-service>
