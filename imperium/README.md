<p align="center">
  <img src="frontend/public/favicon.svg" alt="Imperium" width="80" height="80" />
</p>

<h1 align="center">Imperium</h1>

<p align="center">
  <strong>Plateforme de gestion interne pour agence OFM</strong><br/>
  Planning, ventes, paies, facturation, bot Telegram & gamification
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Telegram_Bot-26A5E4?style=flat&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/license-private-1b2e4b" alt="License" />
</p>

<p align="center">
  <a href="https://imperaagency.com">imperaagency.com</a> · <a href="https://app.imperaagency.com">app.imperaagency.com</a>
</p>

---

## Apercu

**Imperium** est l'application interne d'**Impera Agency**, une agence OFM premium. Elle gere l'ensemble des operations : planification des shifts, suivi des ventes en temps reel, calcul automatique des paies, generation de factures PDF, et un bot Telegram intelligent pour l'import automatique des rapports de shift.

<table>
<tr>
<td width="50%">

### Espace Admin
- **Dashboard** temps reel avec KPIs & graphiques
- **Planning shifts** — grille 7 jours, 4 creneaux, 3 fuseaux horaires
- **Gestion ventes** — import manuel + auto (Telegram)
- **Moteur de paie** — commissions, primes, malus, taux de change
- **Factures PDF** — generation automatique avec numerotation
- **Bot Telegram** — monitoring, journal d'activite, broadcast
- **Gamification** — paliers, objectifs collectifs, classements

</td>
<td width="50%">

### Espace Chatteur
- **Dashboard personnel** avec stats de performance
- **Mon Planning** — vue semaine avec shifts assignes
- **Mes Ventes** — historique et suivi
- **Ma Performance** — progression, paliers, badges
- **Mes Factures** — telechargement PDF
- **Mon Profil** — informations personnelles, IBAN
- **Notifications** — in-app + Telegram DM

</td>
</tr>
</table>

### Site vitrine

Pages publiques accessibles sans authentification : page d'accueil agence, presentation de l'equipe, formulaire de contact.

---

## Stack technique

| Composant | Technologie |
|-----------|------------|
| **Frontend** | React 18 + Vite, CSS custom (pas de framework) |
| **Backend** | Node.js + Express |
| **Base de donnees** | SQLite via `node-sqlite3-wasm` |
| **Auth** | JWT httpOnly cookies + bcryptjs, CSRF via `X-Requested-With` |
| **Bot** | Telegram Bot API (long polling) |
| **PDF** | pdfkit (generation de factures) |
| **Email** | Nodemailer (SMTP) — invitations, verifications |
| **Deploiement** | PM2 + Nginx + Certbot SSL |

### Design system

Palette **marble white / navy blue / gold** avec typographie Inter + Cinzel. 24 couleurs assignables aux chatteurs (8 familles x 3 nuances). Interface 100% responsive, animations CSS natives.

---

## Installation

### Prerequis
- Node.js 18+
- npm

### Demarrage rapide

```bash
# Cloner le repo
git clone https://github.com/LeyZee/Imperium.git
cd Imperium/imperium

# Backend
cd backend
cp .env.example .env  # Configurer les variables
npm install
node server.js        # → http://localhost:3001

# Frontend (nouveau terminal)
cd frontend
npm install
npm run dev           # → http://localhost:5173
```

### Variables d'environnement

Creer `backend/.env` :

```env
PORT=3001
JWT_SECRET=your-secret-key
ADMIN_DEFAULT_PASSWORD=your-admin-password
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_SECRET=your-webhook-secret

# SMTP (optionnel — fallback console.log en dev)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Imperium <admin@yourdomain.com>
APP_URL=http://localhost:5173
```

> Si `ADMIN_DEFAULT_PASSWORD` n'est pas defini, un mot de passe aleatoire est genere et affiche dans la console au premier lancement.

---

## Architecture

```
imperium/
├── backend/
│   ├── server.js              # Point d'entree Express
│   ├── database.js            # Schema SQLite (31 tables) + migrations
│   ├── routes/                # 15+ fichiers de routes API REST
│   │   ├── auth.js            # Login, register, invitation, reset
│   │   ├── chatteurs.js       # CRUD chatteurs + comptes utilisateur
│   │   ├── shifts.js          # Planning + templates recurrents
│   │   ├── ventes.js          # Ventes + import Telegram
│   │   ├── paies.js           # Calcul paie + generation factures PDF
│   │   ├── telegram.js        # Controle bot + journal + broadcast
│   │   └── ...
│   ├── services/
│   │   ├── paie-calculator.js # Moteur financier (commissions, taux, primes)
│   │   ├── telegram-poller.js # Bot Telegram (long polling + registration DM)
│   │   └── telegram-parser.js # Parsing rapports de shift + import auto
│   ├── middleware/            # Auth JWT, rate limiting, validation
│   └── utils/                 # Logger, email, pagination, constants
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/         # 17 pages admin
│   │   │   ├── chatteur/      # 8 pages chatteur
│   │   │   └── public/        # Site vitrine (home, equipe, contact)
│   │   ├── components/        # Composants reutilisables
│   │   ├── context/           # AuthContext (JWT + roles)
│   │   └── constants/         # Couleurs, config
│   └── vite.config.js
├── ecosystem.config.js        # Config PM2
└── Dockerfile
```

---

## Bot Telegram

Le bot Telegram fonctionne en **long polling** et offre :

- **Import automatique des ventes** — detecte les rapports de shift dans les groupes Telegram configures, parse le montant et cree la vente automatiquement
- **Enregistrement par DM** — les chatteurs lient leur compte via `/start` + prenom
- **Auto-link** — association automatique Telegram ID ↔ chatteur par reconnaissance du nom dans les groupes
- **Notifications DM** — confirmations de vente, rappels de shift, resume de paie, paliers atteints
- **Journal d'activite** — trace complete des messages entrants et sortants avec filtres (direction, type, statut)
- **Broadcast** — envoi de messages a tous les chatteurs depuis l'interface admin

---

## Tests

```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest + React Testing Library)
cd frontend && npm test
```

---

## Deploiement production

### PM2 + Nginx (recommande)

```bash
# Build frontend
cd frontend && npm run build

# Demarrer avec PM2
pm2 start ecosystem.config.js --env production

# Nginx reverse proxy → port 3001
# Certbot pour SSL
```

### Docker

```bash
docker build -t imperium .
docker run -p 3001:3001 -v ./backend/imperium.db:/app/backend/imperium.db imperium
```

### Health check

```bash
curl https://api.yourdomain.com/health
```

---

## Securite

- JWT httpOnly cookies (non accessible en JS)
- CSRF protection via header `X-Requested-With`
- Rate limiting sur toutes les routes sensibles
- Sanitization HTML pour les messages Telegram
- Soft delete systematique (`actif = 0`)
- Mots de passe hashes avec bcryptjs
- Invitations par email avec token a usage unique

---

<p align="center">
  <sub>Built with care for <strong>Impera Agency</strong></sub><br/>
  <sub>
    <img src="https://img.shields.io/badge/navy-1b2e4b?style=flat&labelColor=1b2e4b" alt="" height="12" />
    <img src="https://img.shields.io/badge/gold-f5b731?style=flat&labelColor=f5b731" alt="" height="12" />
    <img src="https://img.shields.io/badge/marble-f8fafc?style=flat&labelColor=f8fafc" alt="" height="12" />
  </sub>
</p>
