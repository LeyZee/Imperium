# Code Review — Imperium
_Réalisé le 2026-03-09_

## Score global : 7.5/10

---

## 🔴 Bugs critiques (corrigés en session)

### ✅ [FIXED] `db.transaction` manquant — `routes/paies.js:151`
`node-sqlite3-wasm` n'implémente pas `.transaction()`. La route `/api/paies/calculer` plantait avec `TypeError: db.transaction is not a function`.
**Correction :** méthode `transaction()` ajoutée au wrapper `compatDb` dans `database.js`.

### ✅ [FIXED] `Shifts.jsx` — mauvaise structure de données
`setShifts(data)` stockait l'objet `{date_debut, date_fin, shifts:[...]}` au lieu du tableau.
`shifts.find(...)` plantait avec "is not a function".
**Correction :** `setShifts(data.shifts || [])`.

### ✅ [FIXED] Crash backend sur JSON malformé
Une requête avec JSON invalide faisait crasher le process entier.
**Correction :** handler d'erreur JSON ajouté dans `server.js`.

### ✅ [FIXED] `routes/dashboard.js` manquant
`server.js` montait `/api/dashboard` mais le fichier n'existait pas → `MODULE_NOT_FOUND` au démarrage.

---

## 🟠 Bugs non-critiques (à corriger)

### `routes/chatteurs.js:176` — Construction SQL fragile
```js
const malusTotal = db.prepare(`
  SELECT COALESCE(SUM(montant), 0) as total FROM malus WHERE chatteur_id = ?
  ${periode_debut && periode_fin ? 'AND periode >= ? AND periode <= ?' : ''}
`).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));
```
L'interpolation de SQL via template string est une mauvaise pratique (pas d'injection ici car pas d'input direct, mais fragile à maintenir).
**Suggestion :** utiliser une requête avec `WHERE ... AND (? IS NULL OR periode >= ?)`.

### ~~`routes/ventes.js` — Route `/summary`~~ ✅ OK
Pas de `GET /:id` dans ventes.js — pas de conflit, `/summary` fonctionne correctement.

### ~~`routes/paies.js` — Route `/periodes`~~ ✅ OK
Pas de `GET /:id` dans paies.js — `/periodes` fonctionne correctement.

---

## 🟡 Sécurité

### Pas de validation des types numériques
Dans plusieurs routes POST, `montant_brut`, `taux_commission`, etc. ne sont pas validés comme nombres.
Un attaquant peut envoyer `"montant_brut": "DROP TABLE ventes"` — pas d'injection SQL ici (parameterized), mais ça peut casser les calculs.
**Suggestion :** ajouter `parseFloat()` + vérification `isNaN()` sur tous les champs numériques.

### JWT fallback secret en dur
Dans `middleware/auth.js`, si `JWT_SECRET` env var n'est pas définie, le secret fallback est dans le code.
**Suggestion :** créer un fichier `.env` avec `JWT_SECRET=<random-256bit>` avant la prod.

### Pas de `.gitignore`
`imperium.db` et `.env` risquent d'être commités.
**Correction :** créer `.gitignore` à la racine du projet.

---

## 🟢 Points positifs

- ✅ **SQL paramétré partout** — aucun risque d'injection SQL
- ✅ **bcrypt 10 rounds** — hashage des mots de passe correct
- ✅ **JWT avec expiry 8h** — bien configuré
- ✅ **Helmet.js** activé — headers de sécurité HTTP
- ✅ **Rate limiting sur /login** — protection brute force
- ✅ **CORS strict** — localhost:5173 uniquement
- ✅ **Séparation admin/chatteur** — middleware `adminOnly` sur toutes les routes sensibles
- ✅ **Soft delete** sur chatteurs et modèles — pas de perte de données
- ✅ **Frontend ProtectedRoute** — redirection si non authentifié
- ✅ **Calculs financiers corrects** — TVA, commission plateforme, commission chatteur, prime top chatteur

---

## Actions recommandées avant mise en prod

1. **Swap routes `/summary` et `/:id`** dans `ventes.js` et `paies.js`
2. **Créer `.gitignore`** (imperium.db, .env, node_modules)
3. **Créer `.env`** avec JWT_SECRET aléatoire
4. **Valider les inputs numériques** dans les routes POST/PUT
5. **Changer admin123** dès la première connexion
6. **HTTPS** via Nginx reverse proxy ou Caddy en production
