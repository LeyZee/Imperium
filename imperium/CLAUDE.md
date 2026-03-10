# IMPERIUM - Notes de projet

## Stack technique
- **Frontend**: React + Vite (port 5173), custom CSS inline (PAS de Tailwind), design marble white / navy blue / gold
- **Backend**: Node.js + Express (port 3001), SQLite via `node-sqlite3-wasm` (PAS better-sqlite3)
- **Auth**: JWT (admin / admin123), bcryptjs
- **DB wrapper**: `compatDb` dans `database.js` normalise les args pour node-sqlite3-wasm — utiliser `?? null` pour undefined
- **Preview servers**: configurés dans `.claude/launch.json` → `imperium-backend` (3001), `imperium-frontend` (5173)
- **Repo GitHub**: https://github.com/LeyZee/Imperium.git (branche `master`)

## Schema DB (tables principales)
- **users**: id, username, password_hash, role (`admin`/`chatteur`), email
- **chatteurs**: id, user_id, `prenom` (PAS de nom), email, adresse, code_postal, ville, pays (default 'France'), iban, taux_commission, `role` (`chatteur`/`manager`/`va`), taux_net_equipe, `couleur` (INTEGER = index dans palette), is_nouveau, actif
- **modeles**: id, `pseudo` (PAS nom+prenom), part_percent, actif
- **plateformes**: id, nom (OnlyFans / Reveal), devise, taux_conversion, actif
- **modeles_plateformes**: modele_id, plateforme_id (association M-N)
- **shifts**: id, chatteur_id, modele_id, plateforme_id, date, creneau (1-4), fuseau_horaire
- **shift_templates**: pour shifts récurrents
- **ventes**, **paies**, **malus**: tables financières

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
- Shifts (tabs OF/Reveal, timezone selector France/Benin/Madagascar, bulk creation, recurring templates, compact week grid, couleurs depuis DB)
- Paies, Ventes, KPIs, Telegram Bot

## Conventions
- Soft delete partout: `actif = 0` au lieu de suppression reelle
- Drapeaux pays: images `flagcdn.com/w40/{iso}.png` (les emojis ne marchent pas sur Windows)
- `PAYS_ISO` map: `{ 'France': 'fr', 'Benin': 'bj', 'Madagascar': 'mg' }`
- Creneaux: 1=08h-14h, 2=14h-20h, 3=20h-02h, 4=02h-08h
- `seed.js`: script pour peupler la DB depuis le Google Sheets (139 shifts, 11 chatteurs, 5 modeles)

## Google Sheets de reference
https://docs.google.com/spreadsheets/d/1FNR6Yj_k1jt5-2a2zUSYrjZJb6VzQBGSarVrdbU4NTA/edit
