# Imperium API Documentation

Base URL: `http://localhost:3001/api`

All state-changing requests (POST/PUT/DELETE) require `X-Requested-With: XMLHttpRequest` header.
Auth uses httpOnly cookies (set on login).

---

## Auth — `/api/auth`

### POST /api/auth/login
**Body:** `{ email, password }`
**Response:** `{ user: { id, email, role, prenom, chatteur_id, photo } }`
**Cookie:** Sets `token` (httpOnly, 24h)

### POST /api/auth/logout
Clears the auth cookie.

### GET /api/auth/me
Returns current user + chatteur profile if applicable.

### POST /api/auth/register *(admin only)*
**Body:** `{ email, password, role? }`
**Response:** `{ id, email, role }`

### PUT /api/auth/password
**Body:** `{ current_password, new_password }`

### PUT /api/auth/profile
**Body:** `{ email?, prenom?, photo?, current_password?, new_password? }`

---

## Chatteurs — `/api/chatteurs`

### GET /api/chatteurs
List active chatteurs. Non-admin users get stripped sensitive fields.

### GET /api/chatteurs/classement
**Query:** `periode_debut, periode_fin`
Leaderboard with prime data.

### GET /api/chatteurs/classement/historique-cagnotte
Historical jackpot data.

### GET /api/chatteurs/:id
Single chatteur details.

### POST /api/chatteurs *(admin only)*
**Body:** `{ prenom, email?, pays?, taux_commission?, role?, couleur?, ... }`

### PUT /api/chatteurs/:id *(admin only)*
**Body:** Partial update fields.

### PUT /api/chatteurs/:id/account *(admin only)*
Manage chatteur user account (create/update credentials).

### DELETE /api/chatteurs/:id *(admin only)*
Soft delete (sets `actif = 0`).

### GET /api/chatteurs/:id/kpis
KPI data for a specific chatteur.

### GET /api/chatteurs/:id/historique
Historical performance data.

---

## Modeles — `/api/modeles`

### GET /api/modeles
List active models with their platform associations.

### GET /api/modeles/:id
Single model.

### POST /api/modeles *(admin only)*
**Body:** `{ pseudo, part_percent?, photo? }`

### PUT /api/modeles/:id *(admin only)*
**Body:** `{ pseudo?, part_percent?, actif?, photo? }`

### DELETE /api/modeles/:id *(admin only)*
Soft delete.

### GET /api/modeles/:id/plateformes
Platforms associated with model.

### POST /api/modeles/:id/plateformes *(admin only)*
**Body:** `{ plateforme_id }`

### DELETE /api/modeles/:id/plateformes/:pid *(admin only)*

---

## Plateformes — `/api/plateformes`

### GET /api/plateformes
List active platforms.

### GET /api/plateformes/:id
### POST /api/plateformes *(admin only)*
**Body:** `{ nom, devise?, tva_rate?, commission_rate?, couleur_fond?, couleur_texte? }`

### PUT /api/plateformes/:id *(admin only)*
### DELETE /api/plateformes/:id *(admin only)*
Soft delete.

---

## Ventes — `/api/ventes`

### GET /api/ventes
**Query:** `periode_debut?, periode_fin?, chatteur_id?, page?, limit?`
Supports optional pagination. Returns array (no pagination) or `{ data, pagination }` (with page param).

### GET /api/ventes/par-modele
**Query:** `periode_debut, periode_fin`
Sales grouped by model.

### GET /api/ventes/summary
Summary statistics.

### POST /api/ventes *(admin only)*
**Body:** `{ chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin }`

### PUT /api/ventes/:id *(admin only)*
### DELETE /api/ventes/:id *(admin only)*

---

## Paies — `/api/paies`

### GET /api/paies
**Query:** `debut, fin, chatteur_id?`

### GET /api/paies/mes-paies
Chatteur's own pay slips.

### GET /api/paies/periodes
Available pay periods.

### POST /api/paies/recalculer *(admin only)*
**Body:** `{ debut, fin }`
Recalculates all pay for a period.

### PUT /api/paies/:id/statut *(admin only)*
**Body:** `{ statut }` — `calculé` | `validé` | `payé`

### GET /api/paies/facture
**Query:** `chatteur_id, debut, fin`
Generate PDF invoice.

### GET /api/paies/factures-zip *(admin only)*
**Query:** `debut, fin`
Download all invoices as ZIP.

---

## Planning (Shifts) — `/api/shifts`

### GET /api/shifts
**Query:** `date_debut?, date_fin?, chatteur_id?, plateforme_id?`

### GET /api/shifts/semaine
**Query:** `date?`
Week view with template merge.

### POST /api/shifts *(admin only)*
**Body:** `{ chatteur_id, modele_id?, plateforme_id?, date, creneau, fuseau_horaire?, notes? }`
Creneaux: 1=08h-14h, 2=14h-20h, 3=20h-02h, 4=02h-08h

### POST /api/shifts/bulk *(admin only)*
**Body:** `{ chatteur_id, modele_id?, plateforme_id?, dates[], creneaux[], fuseau_horaire?, replace? }`

### DELETE /api/shifts/:id *(admin only)*

### GET /api/shifts/template
### POST /api/shifts/template/save *(admin only)*
**Body:** `{ date }` — Save current week as recurring template.

---

## Malus — `/api/malus`

### GET /api/malus
**Query:** `chatteur_id?`

### POST /api/malus *(admin only)*
**Body:** `{ chatteur_id, montant, raison?, periode }`

### DELETE /api/malus/:id *(admin only)*
Soft delete.

---

## Taux de change — `/api/taux`

### GET /api/taux
Historical exchange rates.

### GET /api/taux/current
Current USD/EUR rate.

### POST /api/taux/refresh *(admin only)*
Fetch latest rate from API.

### POST /api/taux/check
Check current rate.

---

## Dashboard — `/api/dashboard`

### GET /api/dashboard *(admin only)*
**Query:** `debut?, fin?`
Dashboard statistics (revenue, trends, top performers).

---

## Telegram — `/api/telegram`

### POST /api/telegram/report
Webhook for Telegram bot reports. Requires `TELEGRAM_SECRET` header.

### GET /api/telegram/report *(admin only)*
View reports.

### GET /api/telegram/status *(admin only)*
Bot status (running, uptime, last message).

### POST /api/telegram/start *(admin only)*
### POST /api/telegram/stop *(admin only)*

---

## Facturation Modeles — `/api/facturation-modeles`

### GET /api/facturation-modeles *(admin only)*
Model billing data.

---

## Health

### GET /health
**Response:** `{ status: "ok", uptime, timestamp }`
No auth required.
