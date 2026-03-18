# IMPERIUM - Notes de projet

## Documentation complète
- **`IMPERIUM.md`** (racine du projet) — Audit exhaustif de l'application : architecture, 31 tables DB, 60+ endpoints API, moteur financier, bot Telegram, gamification, design system, équipe. **Toujours consulter ce fichier en premier** pour comprendre le projet.
- **`ROADMAP.md`** (racine du projet) — Projets futurs et idées d'évolution : interface modèles, transformation SaaS, améliorations planning/ventes/bot/gamification/UX. **Consulter avant de proposer de nouvelles fonctionnalités** pour éviter les doublons.

## Stack technique
- **Frontend**: React + Vite (port 5173), custom CSS inline (PAS de Tailwind), design marble white / navy blue / gold
- **Backend**: Node.js + Express (port 3001), SQLite via `node-sqlite3-wasm` (PAS better-sqlite3)
- **Auth**: JWT httpOnly cookies + bcryptjs (CSRF via X-Requested-With header)
- **DB wrapper**: `compatDb` dans `database.js` normalise les args pour node-sqlite3-wasm — utiliser `?? null` pour undefined
- **Preview servers**: configurés dans `.claude/launch.json` → `imperium-backend` (3001), `imperium-frontend` (5173)
- **Repo GitHub**: https://github.com/LeyZee/Imperium.git (branche `master`)

## Schema DB (tables principales)
- **users**: id, username, password_hash, role (`admin`/`chatteur`), email
- **chatteurs**: id, user_id, `prenom` (PAS de nom), email, adresse, code_postal, ville, pays (default 'France'), iban, taux_commission, `role` (`chatteur`/`manager`/`va`), taux_net_equipe, `couleur` (INTEGER = index dans palette), is_nouveau, actif, `telegram_user_id`, `telegram_dm_ok`
- **modeles**: id, `pseudo` (PAS nom+prenom), part_percent, actif
- **plateformes**: id, nom (OnlyFans / Reveal), devise, taux_conversion, actif
- **modeles_plateformes**: modele_id, plateforme_id (association M-N)
- **shifts**: id, chatteur_id, modele_id, plateforme_id, date, creneau (1-4), fuseau_horaire, notification_sent, reminder_sent
- **shift_templates**: pour shifts récurrents (day_of_week 1=Lun..7=Dim)
- **ventes**: chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, statut, shift_id, `source` ('admin'/'manager'/'chatteur'/'telegram')
- **paies**, **malus**: tables financières
- **telegram_state**: key/value store (last_offset, topic_cache, heartbeat, daily task flags)
- **telegram_log**: direction, chat_id, chatteur_id, message_type, content, success, error_message
- **login_lockouts**: username, attempts, locked_until (brute force protection)

## Palette de couleurs
- Fichier partagé: `frontend/src/constants/colors.js` → `CHATTEUR_COLORS`
- 24 couleurs en 8 familles x 3 nuances (clair/moyen/fonce): Rouge, Rose/Magenta, Orange, Jaune, Vert, Cyan/Teal, Bleu, Violet
- Importée par `Chatteurs.jsx` et `Shifts.jsx`

### Correspondance chatteurs ↔ Google Sheets
| Chatteur    | Index | Couleur        | Pays        |
|-------------|-------|----------------|-------------|
| AXEL        | 8     | Orange fonce   | Benin       |
| BIG-C       | 19    | Bleu           | Benin       |
| CARINE      | 12    | Vert clair     | Benin       |
| CHARBEL     | 1     | Rouge          | Benin       |
| HERMINE     | 17    | Teal fonce     | Benin       |
| PIERRE      | 22    | Violet         | Benin       |
| CELESTIN    | 16    | Cyan           | Benin       |
| MARIE-ANGE  | 4     | Magenta        | Benin       |
| JAMES       | 10    | Jaune/Or       | Benin       |
| NANCIA      | 7     | Orange         | Madagascar  |
| GILLES      | 18    | Bleu clair     | Benin       |

## Pages admin implementees
- Dashboard, Chatteurs (drapeaux flagcdn.com, color picker 8x3), Modeles (delete), Plateformes (delete)
- Shifts (tabs OF/Reveal, timezone selector France/Benin/Madagascar, bulk creation, recurring templates, compact week grid, couleurs depuis DB, alertes masquables doublons/non couverts)
- Paies (génération factures PDF via pdfkit, endpoint `/api/paies/facture`), Ventes, Telegram Bot

## Bot Telegram — Architecture complète (refonte 18/03/2026)

### Fichiers principaux
- `backend/services/telegram-parser.js` — Parsing messages, findChatteur, findModele, findShiftForVente, processMessage
- `backend/services/telegram-poller.js` — Polling loop, DM registration, callback queries, heartbeat, auto-recovery
- `backend/utils/telegramSender.js` — Notifications DM avec inline keyboards, templates de messages
- `backend/services/watchdog.js` — Surveillance bot, audit auto-correction imports, maintenance DB
- `backend/services/post-shift-checker.js` — Rappels shift, rapports manquants, récaps quotidiens (GROUPÉS par chatteur)
- `backend/routes/telegram.js` — API endpoints admin (start/stop/broadcast/announce/log)
- `frontend/src/pages/admin/TelegramBot.jsx` — Interface admin (2 tabs: Bot & Imports / Journal d'activité)

### Fonctionnalités bot
- **Import ventes** depuis groupes Telegram (forum mode, topics)
- **Identification modèle** via nom du topic (cache persisté en DB `telegram_state.topic_cache`)
- **Shift linking** : ±3 jours, shifts de nuit (créneau 3/4 de la veille), modèle du topic prioritaire
- **Inscription** : `/start` avec boutons cliquables prénoms, auto-activation DM pour auto-linkés
- **Commandes** : `/start`, `/status`, `/mesventes`, `/aide` — toutes avec inline keyboards
- **Callback queries** : `cmd_*` (navigation), `reg_*` (inscription), `shift_*` (sélection shift), `modele_*` (sélection modèle)
- **Notifications DM** (TOUTES avec boutons) : vente détectée, import incomplet, conflit modèle, rappel shift, rapport manquant, palier, paie, récap quotidien, objectif collectif
- **Anti-spam** : rapports manquants et rappels shift GROUPÉS par chatteur (1 message au lieu de N)
- **Résumés quotidiens** : chatteur 21h (DM), admin 8h (notif in-app) — flags persistés en DB
- **Watchdog** : heartbeat check, taux d'erreurs, imports non résolus >24h, auto-correction
- **Résilience** : auto-recovery exponential backoff (10s→20s→40s→80s→160s), circuit breaker (5 max), heartbeat

### Matérialisation des templates
- `materializeTemplateShifts(startDate, endDate)` dans `routes/planning.js`
- Crée de vrais shifts en DB à partir des `shift_templates` pour les dates sans shift réel
- Appelée au démarrage (14 jours), toutes les 30 min, et dans `/api/shifts/for-vente`
- Nettoie les doublons exacts après création

### Notes sur les ventes Telegram
- Le champ `notes` contient le **feedback brut du chatteur** (200 chars max), PAS de préfixe "Import Telegram"
- Pour filtrer les imports Telegram, utiliser `source = 'telegram'` (PAS `notes LIKE 'Import Telegram%'`)
- Un montant de 0€ est **normal** (shift sans vente) → ignoré silencieusement, pas d'erreur

### Interface admin Telegram
- Tableau imports : colonnes Date rapport, Chatteur, Plateforme, Modèle, Shift (✅/⚠️), Montant, ✏️/🗑️
- Stats : imports aujourd'hui avec badge warnings
- Panneau statut chatteurs : ✅ enregistré / ⚠️ auto-linké / ❌ non lié
- Section "Inviter les chatteurs" avec explications
- Journal : filtres type/direction/statut/dates + bouton purger 🗑️

## Dropdown shifts dans le formulaire ventes
- Endpoint `GET /api/shifts/for-vente` avec params : chatteur_id, modele_id, plateforme_id, ref_date
- Filtré ±7 jours autour de ref_date, trié par proximité
- Matérialise les templates avant de chercher
- ⭐ meilleur match flaggé, 🌙 shift de nuit de la veille
- LIMIT 15 pour un dropdown propre

## Conventions
- Soft delete partout: `actif = 0` au lieu de suppression reelle
- Drapeaux pays: images `flagcdn.com/w40/{iso}.png` (les emojis ne marchent pas sur Windows)
- `PAYS_ISO` map: `{ 'France': 'fr', 'Benin': 'bj', 'Madagascar': 'mg' }`
- Creneaux: 1=08h-14h, 2=14h-20h, 3=20h-02h, 4=02h-08h
- `seed.js`: script pour peupler la DB depuis le Google Sheets (139 shifts, 11 chatteurs, 5 modeles)
- Devise par défaut : **EUR** (pas USD) pour les fallbacks frontend

## Utils backend
- `backend/utils/asyncHandler.js` — Wrapper pour catch sync/async des routes
- `backend/utils/ApiError.js` — Classe erreur avec statusCode
- `backend/utils/validation.js` — validatePassword, validateEmail, validatePhoto, validateDate
- `backend/utils/constants.js` — TIMEZONES, CRENEAUX, ROLES, PAIE_STATUTS
- `backend/utils/pagination.js` — parsePagination, paginatedResponse
- `backend/utils/logger.js` — Structured JSON logger (error/warn/info/debug)
- `backend/utils/notifier.js` — notify, notifyAdminsAndManagers, notifyChatteur, notifyAllChatteurs

## Utils frontend
- `frontend/src/utils/validators.js` — validateEmail, validateRequired, validatePassword, validatePositiveNumber
- `frontend/src/utils/apiCache.js` — Cache Map avec TTL 30s

## Tests
- **Backend**: Jest — `cd backend && npm test`
- **Frontend**: Vitest + @testing-library/react — `cd frontend && npm test`
- **Tests pré-existants cassés** (pas liés à nos changements) : 2 tests DELETE telegram imports (mock setup), paliers-primes 400, E2E flow vente-paie

## Migrations
- Table `migrations` dans database.js — `runMigration(name, fn)` track les migrations appliquées
- Utiliser `actif` (INTEGER) comme source de vérité pour soft delete (pas `statut`)

## CRITIQUE : Protection base de données SQLite
### Cause de la corruption du 16/03/2026
La DB a été corrompue à cause de **scripts externes exécutés pendant que le backend tournait**. Deux processus node ont ouvert simultanément le fichier `imperium.db` : le serveur Express et un script de seed/migration. SQLite en mode WAL supporte les lectures concurrentes mais PAS les écritures concurrentes depuis des processus séparés. Résultat : rootpages invalides, tables illisibles, VACUUM impossible.

### Règles ABSOLUES à ne JAMAIS enfreindre
1. **JAMAIS exécuter un script qui écrit dans la DB pendant que le backend tourne** — toujours arrêter le serveur AVANT (preview_stop), exécuter le script, puis relancer
2. **JAMAIS utiliser `require('./database')` dans un script standalone** quand le backend est actif — database.js ouvre la DB et la garde ouverte
3. **Pour les scripts de seed/migration** : soit les intégrer comme endpoint API (le backend gère l'accès), soit stopper le backend d'abord
4. **Migrations dangereuses (DROP TABLE + INSERT)** : toujours les entourer de `BEGIN/COMMIT` et tester AVANT en prod
5. **Backup automatique** : faire un backup avant toute migration ou seed

### En cas de problème DB
- Vérifier : `PRAGMA integrity_check`
- Backup : `imperium.db.backup` existe toujours
- Script de repair : `backend/repair-db.js` (export/reimport table par table)
- Dernier recours : supprimer la DB, laisser database.js recréer le schema, re-seeder avec `seed-direct.js` + `seed-shifts.js`

## Déploiement VPS (Hostinger Ubuntu)
- **PM2** : `ecosystem.config.js` — single instance, autorestart, log rotation 50MB, max_memory 500MB
- **Nginx** : frontend sur `app.imperaagency.com`, API sur `api.imperaagency.com`
- **SSL** : Certbot Let's Encrypt
- **Commandes deploy** : `git pull && cd frontend && npm run build && pm2 restart imperium`
- **Self-test au démarrage** : DB integrity, table count, token check, logged in logs
- **Health check** : `GET /health` (status, telegram, DB integrity, memory)

## Rôle directeur
- Le rôle `directeur` a les mêmes droits que `admin` dans tous les middlewares
- Le compte directeur (SACHA) est protégé : impossible de le supprimer ou désactiver
- CHECK constraint chatteurs : `('chatteur', 'manager', 'va', 'directeur')`

## Prochaines priorités (voir ROADMAP.md)
1. **Planning & Shifts** : vue mensuelle, drag & drop, congés, export PDF, commande /planning
2. **Audit interface chatteur** : vérifier bugs critiques sur Dashboard, MesVentes, MonPlanning, MesFactures
3. **Gamification** : niveaux, challenges, streaks

## Google Sheets de reference
https://docs.google.com/spreadsheets/d/1FNR6Yj_k1jt5-2a2zUSYrjZJb6VzQBGSarVrdbU4NTA/edit
