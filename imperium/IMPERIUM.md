# IMPERIUM — Documentation Complète

> Plateforme de gestion d'agence de chat pour modèles adultes (OnlyFans, Reveal).
> Gère les shifts, ventes, paies, primes, et la communication via Telegram.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture](#3-architecture)
4. [Base de données](#4-base-de-données)
5. [Authentification & Sécurité](#5-authentification--sécurité)
6. [Pages & Fonctionnalités](#6-pages--fonctionnalités)
7. [Moteur financier (Paies)](#7-moteur-financier-paies)
8. [Bot Telegram](#8-bot-telegram)
9. [Gamification & Paliers](#9-gamification--paliers)
10. [Design System](#10-design-system)
11. [API — Endpoints](#11-api--endpoints)
12. [Déploiement](#12-déploiement)

---

## 1. Vue d'ensemble

**Imperium** est une application web interne développée pour **IMPERA Agency**, une agence de gestion de chatteurs (opérateurs) qui animent des comptes de modèles adultes sur des plateformes comme **OnlyFans** et **Reveal**.

### Ce que fait Imperium

- **Planning des shifts** : grille hebdomadaire avec 4 créneaux horaires, 3 fuseaux, récurrence
- **Suivi des ventes** : import manuel ou automatique (Telegram), validation, historique
- **Calcul des paies** : moteur financier automatique (taux de change, TVA, commissions, primes, malus)
- **Gestion d'équipe** : 11 chatteurs, 5 modèles, rôles (chatteur/manager/directeur/VA)
- **Notifications** : in-app + Telegram DM (rappels de shift, confirmation de vente, résumé de paie)
- **Gamification** : paliers de primes, objectifs collectifs, classement, badges, streaks
- **Facturation** : génération de factures PDF conformes (numérotation séquentielle)
- **Site vitrine** : pages publiques (accueil, équipe, contact)

### Utilisateurs

| Rôle | Accès | Description |
|------|-------|-------------|
| **Admin** | Tout | Gestion complète de l'agence |
| **Directeur** | Comme admin | Propriétaire (SACHA), protégé contre suppression |
| **Manager** | Presque tout | Peut valider paies, gérer ventes, pas supprimer |
| **Chatteur** | Son espace | Voit son planning, ses ventes, sa performance |
| **VA** | Limité | Virtual Assistant, pas de paie |

---

## 2. Stack technique

| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Frontend** | React 18 + Vite 5 | Port 5173, CSS inline (pas de Tailwind) |
| **Backend** | Node.js + Express | Port 3001, API REST |
| **Base de données** | SQLite (WAL mode) | Via `node-sqlite3-wasm` (pas better-sqlite3) |
| **Auth** | JWT httpOnly cookies | + bcryptjs, CSRF via header `X-Requested-With` |
| **PDF** | PDFKit | Génération de factures |
| **Charts** | Recharts + SVG custom | Donut charts animés, line/bar charts |
| **Icons** | Lucide React | Bibliothèque d'icônes vectorielles |
| **Bot** | Telegram Bot API | Long-polling, DM + groupes |
| **Taux de change** | frankfurter.app | Refresh auto toutes les 6h |

### Dépendances clés

- `express-rate-limit` — Limitation de requêtes par IP
- `helmet` — Headers de sécurité (CSP, HSTS, etc.)
- `bcryptjs` — Hashage de mots de passe
- `jsonwebtoken` — Tokens JWT
- `node-fetch` — Appels HTTP (Telegram API, taux de change)
- `pdfkit` — Génération PDF
- `recharts` — Graphiques React

---

## 3. Architecture

```
imperium/
├── backend/
│   ├── server.js              # Point d'entrée, middleware, jobs de fond
│   ├── database.js            # Schema SQLite, migrations, wrapper compatDb
│   ├── routes/                # 20 modules de routes
│   │   ├── auth.js            # Login, logout, invitations, vérification email
│   │   ├── chatteurs.js       # CRUD chatteurs, classement, KPIs
│   │   ├── modeles.js         # CRUD modèles, associations plateformes
│   │   ├── plateformes.js     # CRUD plateformes (OF, Reveal)
│   │   ├── ventes.js          # CRUD ventes, validation, export CSV
│   │   ├── paies.js           # Calcul paies, factures PDF, statuts
│   │   ├── planning.js        # Shifts, templates récurrents
│   │   ├── malus.js           # Pénalités (fixe ou pourcentage)
│   │   ├── primes.js          # Primes manuelles
│   │   ├── telegram.js        # Bot control, imports, broadcast, annonces
│   │   ├── dashboard.js       # Analytics admin
│   │   ├── objectifs.js       # Objectifs collectifs + paliers
│   │   ├── annonces.js        # Annonces internes
│   │   ├── demandes.js        # Demandes (congés, échanges)
│   │   ├── notifications.js   # Notifications in-app
│   │   ├── activity-logs.js   # Journal d'audit
│   │   ├── taux.js            # Gestion taux de change
│   │   ├── facturation-modeles.js  # Facturation par modèle
│   │   ├── contact.js         # Formulaire de contact public
│   │   └── notes.js           # Notes internes sur chatteurs
│   ├── services/
│   │   ├── paie-calculator.js     # Moteur financier (transactions atomiques)
│   │   ├── telegram-poller.js     # Bot polling + enregistrement DM
│   │   ├── telegram-parser.js     # Parsing messages Telegram
│   │   ├── facture-generator.js   # Génération factures PDF
│   │   ├── palier-notifier.js     # Notifications paliers atteints
│   │   └── post-shift-checker.js  # Vérif post-shift + rappels
│   ├── utils/
│   │   ├── activityLogger.js  # Audit trail
│   │   ├── apiCache.js        # Cache mémoire avec TTL
│   │   ├── asyncHandler.js    # Wrapper erreurs async
│   │   ├── ApiError.js        # Classe erreur HTTP
│   │   ├── constants.js       # Timezones, créneaux, rôles
│   │   ├── csvExport.js       # Export CSV
│   │   ├── email.js           # Templates email (invitation, vérification)
│   │   ├── logger.js          # Logger JSON structuré
│   │   ├── notifier.js        # Notifications in-app
│   │   ├── pagination.js      # Helpers pagination
│   │   ├── period.js          # Calcul période (1-15 ou 16-fin de mois)
│   │   ├── rateCache.js       # Cache taux de change
│   │   ├── telegramSender.js  # Envoi DM Telegram (rate limiting, templates)
│   │   └── validation.js      # Validation password, email, date, photo
│   ├── seed.js                # Peuplement initial via API
│   ├── seed-direct.js         # Peuplement direct DB
│   └── seed-shifts.js         # Peuplement shifts
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Routes, layouts, auth flow
│   │   ├── index.css          # Design system complet
│   │   ├── api/index.js       # Client Axios (CSRF, cookies, interceptors)
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Provider auth (login, logout, refreshUser)
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Header sticky (profil, notifs, logout)
│   │   │   ├── Sidebar.jsx        # Menu latéral collapsible (par rôle)
│   │   │   ├── StatCard.jsx       # Carte KPI animée
│   │   │   ├── DonutChart.jsx     # Graphique donut SVG animé
│   │   │   ├── NotificationPanel.jsx  # Dropdown notifications
│   │   │   ├── ProtectedRoute.jsx # Guard route par rôle
│   │   │   ├── Toast.jsx          # Système de toasts
│   │   │   ├── ConfirmModal.jsx   # Modal de confirmation
│   │   │   ├── Skeleton.jsx       # Loading placeholders
│   │   │   ├── FloatingContact.jsx # Bouton contact flottant
│   │   │   ├── Pagination.jsx     # Contrôles pagination
│   │   │   ├── ErrorBoundary.jsx  # Gestion erreurs React
│   │   │   └── PageLoader.jsx     # Loader plein écran
│   │   ├── pages/
│   │   │   ├── admin/         # 15 pages admin
│   │   │   ├── chatteur/      # 7 pages chatteur
│   │   │   ├── AgencyHome.jsx # Landing page publique
│   │   │   ├── TeamPage.jsx   # Page équipe
│   │   │   ├── ContactPage.jsx # Formulaire contact
│   │   │   ├── ImperiumPage.jsx # Page marque
│   │   │   └── Login.jsx      # Page connexion
│   │   ├── constants/
│   │   │   ├── colors.js      # Palette 24 couleurs (8 familles × 3 nuances)
│   │   │   └── statuses.js    # Statuts chatteurs (Actif, Malade, Congé...)
│   │   └── utils/
│   │       ├── validators.js      # Validation côté client
│   │       ├── gamification.js    # Streaks, badges, records
│   │       ├── palierColors.js    # Couleurs paliers (Bronze→Diamant)
│   │       └── apiCache.js        # Cache API (TTL 5min)
│   └── .env.production       # Config production
│
├── .claude/launch.json        # Config serveurs de dev
├── CLAUDE.md                  # Instructions pour l'IA
├── DEPLOYMENT.md              # Guide déploiement production
└── ecosystem.config.js        # Config PM2
```

---

## 4. Base de données

### Tables principales (31 tables)

#### Utilisateurs & Équipe
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `users` | Comptes utilisateur | id, username, password_hash, role (admin/chatteur/manager), email, photo |
| `chatteurs` | Profils chatteurs | id, user_id, prenom, email, iban, taux_commission, role (chatteur/manager/directeur/va), couleur, pays, telegram_user_id, telegram_dm_ok, actif |

#### Contenu & Plateformes
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `modeles` | Modèles (comptes animés) | id, pseudo, part_percent (20-50%), photo, couleur_fond, couleur_texte, actif |
| `plateformes` | Plateformes de streaming | id, nom, tva_rate, commission_rate, devise (EUR/USD), couleur_fond, couleur_texte, actif |
| `modeles_plateformes` | Association M-N | modele_id, plateforme_id |

#### Planning
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `shifts` | Shifts programmés | id, chatteur_id, modele_id, plateforme_id, date, creneau (1-4), fuseau_horaire |
| `shift_templates` | Shifts récurrents | id, chatteur_id, modele_id, plateforme_id, day_of_week, creneau |
| `shift_reports` | Rapports incidents | id, shift_id, chatteur_id, raison, commentaire |

#### Finances
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `ventes` | Ventes/revenus | id, chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, statut (en_attente/validée/rejetée), source (admin/chatteur/telegram), shift_id |
| `paies` | Paies calculées | id, chatteur_id, plateforme_id, ventes_brutes, taux_change, net_ht_eur, commission_chatteur, malus_total, prime, total_chatteur, statut (calculé/validé/payé) |
| `malus` | Pénalités | id, chatteur_id, montant, raison, type_malus (montant/pourcentage), periode, periode_fin, actif |
| `primes_manuelles` | Primes bonus | id, chatteur_id, montant, raison, periode_debut, periode_fin, created_by, actif |
| `factures` | Suivi facturation | id, invoice_num (FA-YYYY-NNNNN), chatteur_id, montant_ht |
| `taux_change` | Taux de change | devise_base, devise_cible, taux, date_maj |

#### Objectifs & Gamification
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `objectifs` | Objectifs individuels | id, chatteur_id, montant_cible, periode_debut, periode_fin |
| `objectifs_personnels` | Objectifs perso | id, chatteur_id, montant_cible |
| `objectifs_collectifs` | Objectifs d'équipe | id, montant_cible, description, actif |
| `paliers_primes` | Paliers de primes individuels | id, seuil_net_ht, bonus, label, emoji, couleur |
| `paliers_collectifs` | Paliers collectifs | id, objectif_collectif_id, seuil_pct, bonus_par_chatteur |

#### Communication & Notifications
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `notifications` | Notifications in-app | id, user_id, type, title, message, link, is_read |
| `annonces` | Annonces internes | id, author_id, title, content, actif |
| `demandes` | Demandes (congés, échanges) | id, chatteur_id, type, statut (en_attente/approuvé/rejeté) |
| `notes` | Notes internes | id, chatteur_id, author_id, content |

#### Système
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `activity_logs` | Journal d'audit | id, user_id, action, entity_type, entity_id, details |
| `login_lockouts` | Protection brute-force | username, attempts, locked_until |
| `invitation_tokens` | Tokens d'invitation | user_id, token, expires_at, used_at |
| `email_verifications` | Vérification email | user_id, new_email, token, expires_at |
| `telegram_state` | État du bot | key (last_offset), value |
| `telegram_log` | Historique messages bot | direction, chat_id, chatteur_id, message_type, success |
| `migrations` | Suivi migrations | name, applied_at |

### Créneaux horaires

| Créneau | Heures (France) | Heures (Bénin) | Heures (Madagascar) |
|---------|-----------------|-----------------|---------------------|
| 1 | 08h - 14h | 07h - 13h | 10h - 16h |
| 2 | 14h - 20h | 13h - 19h | 16h - 22h |
| 3 | 20h - 02h | 19h - 01h | 22h - 04h |
| 4 | 02h - 08h | 01h - 07h | 04h - 10h |

### Conventions

- **Soft delete** : `actif = 0` au lieu de suppression réelle
- **Périodes** : quinzaines (1-15 ou 16-fin du mois)
- **Drapeaux pays** : images `flagcdn.com/w40/{iso}.png` (pas d'emojis, incompatibles Windows)
- **Couleurs** : index entier dans palette de 24 couleurs

---

## 5. Authentification & Sécurité

### Flux d'authentification

```
1. Admin crée un chatteur → POST /api/chatteurs (+ email optionnel)
2. Admin envoie invitation → POST /api/auth/invite → email avec lien
3. Chatteur clique le lien → GET /api/auth/setup-password/:token
4. Chatteur définit son mot de passe → POST /api/auth/setup-password/:token
5. Connexion auto → JWT httpOnly cookie (24h)
6. Chaque requête → cookie envoyé automatiquement + header X-Requested-With (CSRF)
```

### Protections

| Protection | Détail |
|------------|--------|
| **JWT httpOnly** | Cookie non accessible par JavaScript, expiration 24h |
| **CSRF** | Header `X-Requested-With: XMLHttpRequest` requis sur POST/PUT/DELETE |
| **Bcrypt** | 10 rounds de hashage des mots de passe |
| **Lockout** | 5 échecs → blocage 15 minutes |
| **Rate limiting** | Global 100/min, login 10/min, PDF 10/min, ZIP 3/min |
| **Helmet** | CSP, HSTS (1 an preload), X-Frame-Options, etc. |
| **Validation** | Mot de passe : 8+ chars, 1 majuscule, 1 minuscule, 1 chiffre |
| **Photos** | Base64 validé, max 3 Mo |
| **Montants** | Triggers DB : 0.01 ≤ montant ≤ 100 000 |
| **Directeur protégé** | Impossible de supprimer/désactiver le compte SACHA |

### Rôles & Permissions

| Action | Admin | Directeur | Manager | Chatteur |
|--------|:-----:|:---------:|:-------:|:--------:|
| Gérer chatteurs | ✅ | ✅ | ✅ | ❌ |
| Créer/modifier ventes | ✅ | ✅ | ✅ | Ses propres |
| Valider paies | ✅ | ✅ | Jusqu'à "validé" | ❌ |
| Marquer "payé" | ✅ | ✅ | ❌ | ❌ |
| Gérer modèles/plateformes | ✅ | ✅ | ❌ | ❌ |
| Gérer shifts | ✅ | ✅ | ✅ | ❌ |
| Voir classement | ✅ | ✅ | ✅ | ✅ |
| Voir son planning | ✅ | ✅ | ✅ | ✅ |
| Gérer bot Telegram | ✅ | ✅ | ❌ | ❌ |
| Broadcaster annonce | ✅ | ✅ | ✅ | ❌ |

---

## 6. Pages & Fonctionnalités

### Pages Admin (15 pages)

#### Dashboard (`/admin`)
- **Cartes KPI** : Total Paies, Net HT Équipe, Ventes validées, Shifts programmés
- **Sélecteur de période** : 24 quinzaines navigables
- **Classement & Primes** : Top 5 chatteurs avec badges gradient (or/argent/bronze), barres de progression vers le palier suivant
- **Graphiques** : donut charts (répartition par plateforme/modèle), comparaison avec période précédente (delta %)

#### Planning / Shifts (`/admin/shifts`)
- **Grille 7 jours × 4 créneaux** par plateforme
- **Onglets** : OnlyFans / Reveal
- **Sélecteur timezone** : France / Bénin / Madagascar (horloge temps réel)
- **Cellules colorées** : couleur du chatteur assigné + initiales
- **Clic sur cellule** → modal d'assignation (dropdown chatteur)
- **Création en masse** : modal bulk avec templates récurrents
- **Détection conflits** : alerte si un modèle a déjà un chatteur sur le même créneau
- **Navigation** : semaine précédente/suivante

#### Ventes (`/admin/ventes`)
- **Tableau trié** : chatteur, modèle, plateforme, montant, date, source, statut
- **Sources** : badges colorés (Admin, Manager, Chatteur, Telegram)
- **Workflow statut** : En attente → Validée → Rejetée (clic pour cycler)
- **Filtres** : par période, statut, chatteur
- **Export CSV** (rate limité)
- **Verrouillage** : période validée/payée → modification impossible

#### Paies (`/admin/paies`)
- **Calcul automatique** : déclenché par ajout/modif de vente
- **Tableau détaillé** : brut, taux change, net HT, commission, malus, prime, total
- **Workflow** : Calculé → Validé → Payé (par étapes)
- **Factures PDF** : téléchargement individuel ou ZIP groupé
- **Delta** : % de variation vs période précédente

#### Paramètres (`/admin/parametres`)
- **5 onglets** :
  - **Équipe** : CRUD chatteurs (prenom, email, pays, commission, rôle, couleur, photo)
  - **Modèles** : CRUD modèles (pseudo, part_percent, plateformes associées, couleur)
  - **Plateformes** : CRUD plateformes (nom, devise, TVA, commission, couleurs)
  - **Journal** : audit trail filtrable (utilisateur, action, date)
  - **Telegram** : statut bot, imports, broadcast, journal messages

#### Objectifs (`/admin/objectifs`)
- **Objectifs collectifs** : montant cible pour l'équipe sur une période
- **Paliers** : seuils progressifs (50%, 75%, 100%, 120%) avec bonus par chatteur
- **Barre de progression** animée

#### Primes & Malus (`/admin/malus`)
- **Primes manuelles** : bonus par chatteur avec raison
- **Malus** : pénalités (montant fixe ou pourcentage), plafonnées au total commission+prime

#### Annonces (`/admin/annonces`)
- **CRUD annonces** avec broadcast Telegram optionnel
- **Visibilité** : actif/inactif

#### Facturation Modèles (`/admin/facturation`)
- **Vue par modèle** : revenus agrégés par période

#### Bot Telegram (`/admin/parametres?tab=telegram`)
- **Statut** : running/stopped, uptime, messages traités
- **Démarrer/Arrêter** le bot
- **Imports récents** : tableau des ventes importées automatiquement
- **Broadcast** : envoi de message à tous les chatteurs liés
- **Journal** : historique de tous les messages envoyés (type, succès/échec)

#### Demandes (`/admin/demandes`)
- **Workflow** : En attente → Approuvé / Rejeté
- **Types** : congé, échange de shift

---

### Pages Chatteur (7 pages)

#### Dashboard (`/chatteur`)
- **Message de bienvenue** personnalisé selon le classement
- **Prochain shift** : date, créneau, modèle, plateforme
- **KPIs** : classement actuel, Net HT, paies, palier atteint
- **Progression palier** : barre animée vers le prochain tier

#### Mon Planning (`/chatteur/planning`)
- **Grille hebdomadaire** personnelle (ses shifts uniquement)
- **Onglets plateformes** + navigation semaine
- **Fuseau horaire** ajusté selon le pays du chatteur

#### Planning Général (`/chatteur/planning-general`)
- **Vue d'équipe** en lecture seule (tous les shifts de tous les chatteurs)

#### Mes Ventes (`/chatteur/mes-ventes`)
- **CRUD ventes** : le chatteur peut créer/modifier/supprimer ses propres ventes
- **Verrouillage** : impossible si la période est validée/payée

#### Mes Paies (`/chatteur/mes-factures`)
- **Historique** : liste des paies avec statut
- **Téléchargement** : facture PDF par période

#### Ma Performance (`/chatteur/performance`)
- **Gamification** :
  - **Streaks** : périodes consécutives avec prime
  - **Records** : meilleure prime, meilleure paie
  - **Podiums** : nombre de périodes avec prime
  - **Badges** : Rising Star (↗), Régulier (3+ streak), Recrue (1ère prime)
- **Progression palier** : barre avec marqueurs Bronze → Argent → Or → Diamant
- **Graphiques** : donut répartition par modèle, courbe de progression

#### Mon Profil (`/chatteur/profil`)
- **Modifier** : email, adresse, IBAN, photo
- **Changer mot de passe**

---

### Pages Publiques (4 pages)

| Page | Route | Description |
|------|-------|-------------|
| Accueil | `/` | Landing page avec animation particules dorées, scroll reveal |
| Équipe | `/equipe` | Présentation de l'équipe en grille, FAQ |
| Imperium | `/imperium` | Page marque, mission, valeurs |
| Contact | `/contact` | Formulaire de contact (nom, email, sujet, message) |

---

## 7. Moteur financier (Paies)

### Flux de calcul (`paie-calculator.js`)

```
Pour chaque chatteur, pour chaque plateforme :

1. BRUT         = somme des ventes.montant_brut de la période
2. TTC (EUR)    = BRUT × taux_change (si devise = USD)
3. HT           = TTC ÷ (1 + plateforme.tva_rate)
4. NET HT       = HT × (1 - plateforme.commission_rate)
5. COMMISSION   = NET HT × chatteur.taux_commission

Puis globalement pour le chatteur :

6. MALUS FIXE   = somme des malus à montant fixe
7. MALUS %      = somme des (malus.montant × total_net_ht) pour les malus pourcentage
8. MALUS TOTAL  = min(MALUS FIXE + MALUS %, COMMISSION + PRIME)  // plafonné !
9. PRIME PALIER = bonus du plus haut palier atteint (basé sur total_net_ht)
10. PRIME COLLECTIVE = bonus si objectif collectif atteint
11. PRIME MANUELLE = somme des primes manuelles de la période
12. TOTAL        = COMMISSION - MALUS + PRIMES

Pour les managers (ligne séparée, plateforme_id = NULL) :
13. MANAGER NET  = total_net_ht_equipe × chatteur.taux_net_equipe
```

### Caractéristiques

- **Transaction atomique** : tout le calcul dans un BEGIN/COMMIT
- **Préservation statut** : les paies "payé" ne sont jamais recalculées
- **Taux de change** : USD → EUR via frankfurter.app, fallback 0.92
- **Arrondis** : `roundCents()` pour éviter les erreurs flottantes
- **Recalcul automatique** : déclenché à chaque ajout/modif/suppression de vente, malus ou prime

### Exemple concret

```
Chatteur: CARINE (taux_commission = 15%)
Plateforme: Reveal (EUR, TVA 20%, commission 10%)
Vente brute: 253€

TTC = 253€ (déjà en EUR)
HT = 253 ÷ 1.20 = 210.83€
Net HT = 210.83 × 0.90 = 189.75€
Commission = 189.75 × 0.15 = 28.46€

Si palier "Argent" atteint (seuil 500€ net HT, bonus 25€) :
Total = 28.46 - 0 (malus) + 25 (prime) = 53.46€
```

---

## 8. Bot Telegram

### Architecture

```
telegram-poller.js ←→ Telegram Bot API (long-polling)
       ↓
telegram-parser.js → Analyse messages → Insert vente
       ↓
telegramSender.js → DM notifications → Chatteurs
```

### Groupes configurés

| Chat ID | Groupe | Plateforme |
|---------|--------|------------|
| -1003327391292 | REVEAL Shift Soirée | Reveal (EUR) |
| -1003428313874 | REVEAL Shift Journée | Reveal (EUR) |
| -1003438053612 | ONLYFANS Shift | OnlyFans (USD) |

### Flux d'import automatique

1. Chatteur poste son rapport dans le groupe ("Fin de shift 16/03/2026, Montants générés: 253€")
2. Le bot détecte le pattern `montant brut|montants générés|fin de shift + €/$`
3. `findChatteur()` identifie le chatteur par `telegram_user_id` ou par nom
4. `parseReport()` extrait le montant et la date
5. Vérification doublon (même chatteur + plateforme + montant + période)
6. `insertVente()` + `recalculatePaies()` automatique
7. Notification DM au chatteur (si `/start` fait) + notification in-app

### Enregistrement DM

```
Chatteur envoie /start au bot en privé
  → Bot répond avec la liste des chatteurs non liés
Chatteur envoie son prénom
  → Bot fait le matching fuzzy
  → UPDATE chatteurs SET telegram_user_id = ?, telegram_dm_ok = 1
  → "✅ Parfait ! Tu es maintenant enregistré(e) comme CARINE"
```

### Auto-link vs /start

| Méthode | telegram_user_id | telegram_dm_ok | Peut recevoir DMs |
|---------|:----------------:|:--------------:|:-----------------:|
| Auto-link (message dans groupe) | ✅ | ❌ (0) | Non |
| /start en DM | ✅ | ✅ (1) | Oui |

### Types de notifications DM

| Type | Quand | Contenu |
|------|-------|---------|
| `vente_detected` | Vente importée depuis Telegram | Montant, plateforme, date |
| `paie_summary` | Paie validée | Commission, primes, malus, total |
| `shift_reminder` | 24h avant un shift | Plateforme, modèle, créneau |
| `missing_report` | 30min après fin de shift sans rapport | Rappel de poster |
| `palier_reached` | Nouveau palier atteint | Label, emoji, bonus |
| `announcement` | Annonce admin broadcastée | Titre, contenu |
| `collective_goal` | Progression objectif collectif | %, restant, bonus |

---

## 9. Gamification & Paliers

### Paliers individuels

Les paliers sont configurables en base (table `paliers_primes`) :

| Palier | Seuil Net HT | Bonus | Couleur |
|--------|:------------:|:-----:|---------|
| Bronze | 300€ | 10€ | #cd7f32 |
| Argent | 500€ | 25€ | #94a3b8 |
| Or | 800€ | 50€ | #f5b731 |
| Diamant | 1200€ | 100€ | #60a5fa |

Le plus haut palier atteint détermine la prime. Calculé automatiquement dans `paie-calculator.js`.

### Objectifs collectifs

- Un objectif avec montant cible par période
- Paliers progressifs (50%, 75%, 100%, 120%)
- Bonus par chatteur si le palier est atteint
- Excluant managers du calcul

### Badges chatteur

| Badge | Condition | Icône |
|-------|-----------|-------|
| **Rising Star** | Net HT en hausse vs période précédente | ↗ |
| **Régulier** | 3+ périodes consécutives avec prime | 🔁 |
| **Recrue** | Première prime débloquée | 🌱 |

### Classement

- Top 5 affiché avec badges gradient circulaires (1er or, 2e argent, 3e bronze, 4e indigo, 5e teal)
- Barres de progression vers le palier suivant
- Delta % vs période précédente

---

## 10. Design System

### Palette de couleurs

| Nom | Hex | Utilisation |
|-----|-----|-------------|
| Marble White | `#f5f3ef` | Fond principal |
| Navy | `#1b2e4b` | Texte, sidebar, boutons |
| Navy Light | `#243a5e` | Hover, headers |
| Gold | `#f5b731` | Accents, liens actifs, CTA |
| Gold Light | `#fcd34d` | Badges, highlights |
| Card White | `#ffffff` | Cartes, modals |
| Danger | `#ef4444` | Erreurs, suppression |
| Success | `#10b981` | Validé, confirmé |
| Warning | `#f59e0b` | Attention |

### Typographie

| Usage | Font | Poids |
|-------|------|-------|
| Titres, logo | **Cinzel** (serif) | 600-700 |
| Corps de texte | **Inter** (sans-serif) | 400-600 |

### Palette chatteurs (24 couleurs)

8 familles × 3 nuances (clair, moyen, foncé) :
Rouge, Rose/Magenta, Orange, Jaune, Vert, Cyan/Teal, Bleu, Violet

Chaque chatteur a un index de couleur permanent.

### Animations

| Animation | Utilisation | Durée |
|-----------|-------------|-------|
| `pageEnter` | Entrée de page | 400ms |
| `fadeIn` + `slideUp` | Apparition éléments | 300ms |
| `pulseGold` | Boutons importants | 2s loop |
| `tierReached` | Palier débloqué | 600ms bounce |
| `shimmer` | Skeleton loading | 1.5s loop |
| `confirmBounce` | Modal confirmation | 300ms |
| `spin` | Loader | 800ms |
| `floatSoft` | Éléments décoratifs | 3s loop |

### Responsive

| Breakpoint | Comportement |
|------------|-------------|
| > 768px | Sidebar ouverte, grilles multi-colonnes |
| ≤ 768px | Sidebar overlay, grilles 1 colonne, tables scrollables, boutons touch (44px min) |
| ≤ 480px | Padding réduit, cartes empilées |
| `prefers-reduced-motion` | Toutes animations désactivées |

---

## 11. API — Endpoints

### Authentification (`/api/auth`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| POST | `/login` | Connexion email/mot de passe | ❌ |
| POST | `/logout` | Déconnexion (clear cookie) | ✅ |
| GET | `/me` | Profil utilisateur courant | ✅ |
| POST | `/register` | Créer compte (admin only) | ✅ |
| PUT | `/password` | Changer mot de passe | ✅ |
| PUT | `/profile` | Modifier profil | ✅ |
| POST | `/invite` | Envoyer invitation email | ✅ Admin |
| GET | `/setup-password/:token` | Valider token invitation | ❌ |
| POST | `/setup-password/:token` | Définir mot de passe | ❌ |
| POST | `/change-email` | Demander changement email | ✅ |
| GET | `/verify-email/:token` | Confirmer email | ❌ |

### Chatteurs (`/api/chatteurs`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/` | Liste chatteurs actifs | ✅ |
| GET | `/classement` | Classement + primes | ✅ |
| GET | `/classement/historique-cagnotte` | Historique cagnotte | ✅ |
| GET | `/:id` | Détail chatteur | ✅ |
| GET | `/:id/kpis` | KPIs performance | ✅ |
| GET | `/:id/historique` | Historique 12 périodes | ✅ |
| POST | `/` | Créer chatteur | ✅ Admin/Manager |
| PUT | `/:id` | Modifier chatteur | ✅ Admin/Manager |
| PUT | `/:id/account` | Gérer compte user | ✅ Admin |
| DELETE | `/:id` | Soft delete | ✅ Admin |
| POST | `/:id/resend-invite` | Renvoyer invitation | ✅ Admin |

### Ventes (`/api/ventes`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/` | Liste ventes (filtrée) | ✅ |
| GET | `/summary` | Résumé dashboard | ✅ |
| GET | `/par-modele` | Groupé par modèle | ✅ |
| GET | `/export-csv` | Export CSV | ✅ Admin |
| GET | `/periode-status` | Statut verrouillage | ✅ |
| POST | `/` | Créer vente | ✅ Admin/Manager |
| PUT | `/:id` | Modifier vente | ✅ Admin/Manager |
| PUT | `/:id/valider` | Approuver/rejeter | ✅ Admin/Manager |
| DELETE | `/:id` | Supprimer vente | ✅ Admin/Manager |
| POST | `/mes-ventes` | Chatteur crée sa vente | ✅ Chatteur |
| PUT | `/mes-ventes/:id` | Chatteur modifie | ✅ Chatteur |
| DELETE | `/mes-ventes/:id` | Chatteur supprime | ✅ Chatteur |

### Paies (`/api/paies`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/` | Paies d'une période | ✅ |
| POST | `/recalculer` | Forcer recalcul | ✅ Admin |
| PUT | `/:id/statut` | Changer statut | ✅ Admin/Manager |
| GET | `/facture/:chatteurId` | Télécharger PDF | ✅ |
| GET | `/factures-zip` | ZIP toutes factures | ✅ Admin |

### Planning (`/api/shifts`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/` | Liste shifts (filtrable) | ✅ |
| POST | `/` | Créer shift | ✅ Admin/Manager |
| DELETE | `/:id` | Supprimer shift | ✅ Admin/Manager |
| DELETE | `/bulk` | Suppression en masse | ✅ Admin |
| GET | `/template` | Templates récurrents | ✅ |
| POST | `/template` | Créer template | ✅ Admin/Manager |
| DELETE | `/template/:id` | Supprimer template | ✅ Admin |
| GET | `/chatteur-modeles/:id` | Modèles d'un chatteur | ✅ |

### Telegram (`/api/telegram`)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/status` | Statut bot + imports récents | ✅ Admin |
| POST | `/start` | Démarrer le bot | ✅ Admin |
| POST | `/stop` | Arrêter le bot | ✅ Admin |
| POST | `/report` | Webhook import (token auth) | Token |
| GET | `/report` | Liste imports | ✅ Admin |
| DELETE | `/imports` | Supprimer tous les imports | ✅ Admin |
| POST | `/broadcast` | Broadcast DM à tous | ✅ Admin |
| POST | `/announce-start` | Annonce /start dans groupes | ✅ Admin |
| GET | `/log` | Journal messages envoyés | ✅ Admin |

### Autres

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/api/modeles` | CRUD modèles | ✅ |
| GET | `/api/plateformes` | CRUD plateformes | ✅ |
| GET | `/api/malus` | CRUD malus | ✅ |
| GET | `/api/primes` | CRUD primes manuelles | ✅ |
| GET | `/api/annonces` | CRUD annonces | ✅ |
| GET | `/api/demandes` | CRUD demandes | ✅ |
| GET | `/api/notifications` | Notifications in-app | ✅ |
| GET | `/api/activity-logs` | Journal d'audit | ✅ Admin |
| GET | `/api/objectifs/*` | Objectifs + paliers | ✅ |
| GET | `/api/dashboard` | Analytics admin | ✅ Admin |
| GET | `/api/taux` | Taux de change | ✅ |
| POST | `/api/contact` | Formulaire contact public | ❌ |
| GET | `/health` | Health check | ❌ |

---

## 12. Déploiement

### Prérequis

- Node.js 18+
- PM2 (gestionnaire de processus)
- Nginx (reverse proxy)

### Variables d'environnement

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<random-64-chars>
CORS_ORIGIN=https://app.impera-agency.com
TELEGRAM_BOT_TOKEN=<token-from-botfather>
TELEGRAM_SECRET=<random-32-chars>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@impera-agency.com
SMTP_PASS=<password>
SMTP_FROM=IMPERA Agency <noreply@impera-agency.com>
APP_URL=https://app.impera-agency.com
```

### Commandes

```bash
# Installation
cd backend && npm install
cd frontend && npm install && npm run build

# Lancement (production)
pm2 start ecosystem.config.js

# Lancement (développement)
# Backend + Frontend via .claude/launch.json
node backend/server.js          # Port 3001
npx vite frontend --host        # Port 5173

# Tests
cd backend && npm test           # Jest
cd frontend && npm test          # Vitest
```

### Jobs de fond (démarrés automatiquement)

| Job | Fréquence | Description |
|-----|-----------|-------------|
| Taux de change | 6 heures | Refresh USD→EUR depuis frankfurter.app |
| Bot Telegram | Continu | Long-polling messages (30s timeout) |
| Post-shift checker | 30 minutes | Rappels, rapports manquants, payday |
| Backup DB | Au démarrage | Copie de imperium.db (garde les 3 derniers) |

---

## Équipe actuelle

| Chatteur | Rôle | Pays | Couleur |
|----------|------|------|---------|
| SACHA | Directeur | France | Violet (#22) |
| AXEL | Chatteur | Bénin | Orange foncé (#8) |
| BIG-C | Chatteur | Bénin | Bleu (#19) |
| CARINE | Chatteur | Bénin | Vert clair (#12) |
| CHARBEL | Chatteur | Bénin | Rouge (#1) |
| HERMINE | Chatteur | Bénin | Teal foncé (#17) |
| PIERRE | Chatteur | Bénin | Violet (#22) |
| CELESTIN | Chatteur | Bénin | Cyan (#16) |
| MARIE-ANGE | Chatteur | Bénin | Magenta (#4) |
| JAMES | Chatteur | Bénin | Jaune/Or (#10) |
| NANCIA | Chatteur | Madagascar | Orange (#7) |
| GILLES | Chatteur | Bénin | Bleu clair (#18) |

### Modèles

| Modèle | Part Agence | Plateformes |
|--------|:-----------:|-------------|
| MESSALINA | 35% | OnlyFans + Reveal |
| ANGEL | 25% | OnlyFans + Reveal |
| EMMY | 30% | OnlyFans |
| SOUKI | 30% | OnlyFans + Reveal |
| LILY | 35% | Reveal |

---

*Document généré le 16 mars 2026 — Imperium v1.0*
