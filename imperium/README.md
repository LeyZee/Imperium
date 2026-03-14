# Imperium

Plateforme de gestion d'agence de chat — gestion des chatteurs, modeles, planning, ventes, paies et facturation.

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Base de donnees | SQLite (node-sqlite3-wasm) |
| Auth | JWT (httpOnly cookies) + bcryptjs |
| PDF | pdfkit (generation de factures) |

## Installation

### Prerequisites
- Node.js 18+
- npm

### Backend
```bash
cd backend
npm install
node server.js
```
Le serveur demarre sur http://localhost:3001

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Le frontend demarre sur http://localhost:5173

## Variables d'environnement

Creer `backend/.env` :
```env
PORT=3001
JWT_SECRET=your-secret-key
ADMIN_DEFAULT_PASSWORD=your-admin-password
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_SECRET=your-webhook-secret
```

Si `ADMIN_DEFAULT_PASSWORD` n'est pas defini, un mot de passe aleatoire est genere et affiche dans la console.

## Structure du projet

```
imperium/
├── backend/
│   ├── server.js          # Point d'entree Express
│   ├── database.js        # Schema SQLite + migrations
│   ├── routes/            # Routes API REST
│   ├── services/          # Logique metier (paie, factures, telegram)
│   ├── middleware/        # Auth, validation
│   └── utils/             # Helpers (validation, constants, logger, pagination)
├── frontend/
│   ├── src/
│   │   ├── pages/         # Pages React (admin/ et chatteur/)
│   │   ├── components/    # Composants reutilisables
│   │   ├── context/       # AuthContext
│   │   ├── api/           # Client Axios
│   │   └── utils/         # Validators, gamification, cache
│   └── vite.config.js
├── Dockerfile
├── ecosystem.config.js    # Config PM2
└── CLAUDE.md              # Notes de developpement
```

## Tests

```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest + React Testing Library)
cd frontend && npm test
```

## Production

### Docker
```bash
docker build -t imperium .
docker run -p 3001:3001 imperium
```

### PM2
```bash
pm2 start ecosystem.config.js --env production
```

### Backup
```bash
node backend/scripts/backup.js
```

## Health Check

```bash
curl http://localhost:3001/health
```
