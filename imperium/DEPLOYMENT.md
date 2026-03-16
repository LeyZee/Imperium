# Deploiement Production — IMPERIUM

Guide complet pour deployer Imperium sur un VPS Ubuntu (Hostinger).

- Frontend: `https://app.imperaagency.com`
- Backend API: `https://api.imperaagency.com`

---

## 1. Prerequis VPS

```bash
# Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# Nginx
sudo apt install -y nginx

# Certbot (Let's Encrypt SSL)
sudo apt install -y certbot python3-certbot-nginx

# SQLite3 (pour les backups)
sudo apt install -y sqlite3

# Verifier
node -v    # v20.x
pm2 -v     # 5.x
nginx -v   # 1.x
```

---

## 2. Installation

```bash
# Creer l'utilisateur (optionnel, recommande)
sudo adduser imperium
sudo usermod -aG sudo imperium
su - imperium

# Cloner le repo
git clone https://github.com/LeyZee/Imperium.git imperium
cd imperium

# Dependencies backend
cd backend && npm ci --omit=dev
cd ..

# Dependencies + build frontend
cd frontend && npm ci && npm run build
cd ..
```

---

## 3. Configuration .env

Copier le template et remplir les valeurs :

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Variables requises :

| Variable | Description | Exemple |
|----------|------------|---------|
| `NODE_ENV` | Environnement | `production` |
| `JWT_SECRET` | Secret JWT (32+ caracteres aleatoires) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | Port API | `3001` |
| `CORS_ORIGIN` | URL frontend | `https://app.imperaagency.com` |
| `APP_URL` | URL frontend (emails) | `https://app.imperaagency.com` |
| `TELEGRAM_SECRET` | Secret webhook Telegram | (votre secret) |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram | (depuis @BotFather) |
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Email SMTP | `admin@impera-agency.com` |
| `SMTP_PASS` | Mot de passe SMTP | (app password) |
| `SMTP_FROM` | Expediteur emails | `Imperium <admin@impera-agency.com>` |

---

## 4. Configuration Nginx

### 4.1 Frontend (app.imperaagency.com)

```bash
sudo nano /etc/nginx/sites-available/app.imperaagency.com
```

```nginx
server {
    listen 80;
    server_name app.imperaagency.com;

    root /home/imperium/imperium/frontend/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Cache assets (JS, CSS, images)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — toutes les routes vers index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 4.2 Backend API (api.imperaagency.com)

```bash
sudo nano /etc/nginx/sites-available/api.imperaagency.com
```

```nginx
server {
    listen 80;
    server_name api.imperaagency.com;

    # Taille max upload (photos base64 ~3MB)
    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.3 Activer les sites

```bash
sudo ln -s /etc/nginx/sites-available/app.imperaagency.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.imperaagency.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL / HTTPS (Let's Encrypt)

```bash
# Obtenir les certificats (Certbot modifie automatiquement la config Nginx)
sudo certbot --nginx -d app.imperaagency.com
sudo certbot --nginx -d api.imperaagency.com

# Verifier le renouvellement automatique
sudo certbot renew --dry-run
```

Certbot ajoute automatiquement les blocs `listen 443 ssl` et la redirection HTTP -> HTTPS.

---

## 6. Premier demarrage

```bash
cd /home/imperium/imperium

# Demarrer avec PM2
pm2 start ecosystem.config.js --env production

# Verifier que tout tourne
pm2 status
pm2 logs imperium --lines 20

# Sauvegarder la config PM2 (redemarrage auto apres reboot)
pm2 save
pm2 startup
# (executer la commande affichee par pm2 startup)
```

### Verifier le deploiement

```bash
# Health check API
curl https://api.imperaagency.com/health

# Verifier le frontend
curl -I https://app.imperaagency.com
```

---

## 7. Mises a jour

Utiliser le script de deploiement :

```bash
cd /home/imperium/imperium
./scripts/deploy.sh
```

Le script :
1. Sauvegarde la base de donnees
2. Pull le code depuis GitHub
3. Installe les dependencies backend (production)
4. Build le frontend
5. Redemarre PM2
6. Verifie le health check

---

## 8. Backup base de donnees

### Backup manuel
```bash
./scripts/backup-db.sh
```

### Backup automatique (cron)
```bash
crontab -e
# Ajouter :
0 3 * * * /home/imperium/imperium/scripts/backup-db.sh >> /home/imperium/backups/backup.log 2>&1
```

### Restauration
```bash
pm2 stop imperium
cp /home/imperium/backups/imperium_YYYYMMDD_HHMMSS.db /home/imperium/imperium/backend/imperium.db
pm2 start imperium
```

---

## 9. Monitoring

### PM2
```bash
pm2 status          # Etat des processus
pm2 monit           # Dashboard temps reel
pm2 logs imperium   # Logs en continu
pm2 logs imperium --err  # Erreurs uniquement
```

### Health endpoint
```bash
curl https://api.imperaagency.com/health
# Retourne: { status: "ok", uptime: ..., exchange_rate: ..., warnings: [] }
```

### Logs
```bash
# PM2 logs
tail -f /home/imperium/imperium/logs/pm2-out.log
tail -f /home/imperium/imperium/logs/pm2-error.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 10. Troubleshooting

### Cookies non envoyes (401 apres login)
- Verifier que `CORS_ORIGIN` dans `.env` correspond exactement a l'URL frontend (avec https)
- Verifier que Nginx forward les headers correctement
- Verifier que le certificat SSL est valide

### Erreur CORS
- Verifier `CORS_ORIGIN` dans `.env` backend
- Verifier que le frontend utilise `withCredentials: true`
- Pas de trailing slash dans `CORS_ORIGIN`

### Rate limiter bloque toutes les requetes
- Verifier que `trust proxy` est actif (`NODE_ENV=production`)
- Sans ca, toutes les requetes apparaissent comme venant de 127.0.0.1

### SQLite "database is locked"
- Normal sous charge — WAL mode est active
- Si persistent : verifier qu'un seul processus PM2 tourne (`instances: 1`)

### Telegram bot ne demarre pas
- Verifier `TELEGRAM_BOT_TOKEN` dans `.env`
- Verifier les logs : `pm2 logs imperium | grep -i telegram`
- Le bot demarre 2s apres le serveur HTTP

### Frontend affiche une page blanche
- Verifier que `frontend/dist/` existe et contient `index.html`
- Verifier la config Nginx `try_files $uri $uri/ /index.html`
- Verifier la console du navigateur pour les erreurs JS

---

## Architecture

```
VPS Ubuntu (Hostinger)
|
|-- Nginx (port 80/443)
|   |-- app.imperaagency.com -> /home/imperium/imperium/frontend/dist/
|   |-- api.imperaagency.com -> proxy http://127.0.0.1:3001
|
|-- PM2
|   |-- imperium (Node.js, port 3001)
|       |-- Express API
|       |-- Telegram bot (long-polling)
|       |-- SQLite DB (backend/imperium.db)
```

## Checklist pre-deploiement

- [ ] DNS configure : `app.imperaagency.com` et `api.imperaagency.com` pointent vers l'IP du VPS
- [ ] `.env` rempli avec toutes les variables (surtout `JWT_SECRET`, `CORS_ORIGIN`, `TELEGRAM_BOT_TOKEN`)
- [ ] `npm run build` frontend reussi
- [ ] Certificats SSL obtenus via Certbot
- [ ] PM2 startup configure (reboot auto)
- [ ] Backup cron configure
- [ ] Health check OK : `curl https://api.imperaagency.com/health`
- [ ] Login fonctionne depuis `https://app.imperaagency.com`
