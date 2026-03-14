# AUDIT COMPLET IMPERIUM - Mars 2026

## Notes globales

| Categorie | Note /10 | Commentaire |
|-----------|----------|-------------|
| **UX Admin** | 7/10 | Fonctionnel, cohérent, manque pagination/tri/recherche sur certaines pages |
| **UX Chatteur** | 6.5/10 | Dashboard bien fait, MonProfil non-éditable, MaPerformance trop complexe |
| **UX Manager** | 6/10 | Interface admin allégée mais permissions parfois confuses |
| **Performance** | 5.5/10 | Pas de pagination, calculs non-memoizés, N+1 queries, PDF séquentiel |
| **Sécurité** | 6/10 | JWT httpOnly + CSRF OK, mais brute force, pas de refresh token, authz gaps |
| **Code Quality** | 6.5/10 | Bien structuré mais code dupliqué, composants trop gros, pas de TypeScript |
| **Fonctionnalités** | 7.5/10 | Complet pour V1, cycle paie solide, manque export/bulk/tri |

---

## PROBLEMES CRITIQUES (14)

### Backend
1. **Transaction manquante sur paie-calculator** — race condition si recalcul concurrent
2. **Soft delete non respecté** sur certaines requêtes (ventes, paies filtrent mal)
3. **Brute force non protégé** — rate limit IP seul, pas de lockout compte
4. **Authorization manquante** sur `/api/shifts/chatteur-modeles/:id` — chatteur peut voir les autres
5. **Validation dates manquante** sur exports CSV (paies, ventes)
6. **Index DB manquants** — `ventes.created_at`, `paies(periode_debut, periode_fin)`, `shifts(date)`
7. **Taux de change requêté 4-10x par requête** — pas de cache
8. **PDF batch séquentiel** — bloque l'event loop pour 50+ chatteurs
9. **calcTotals dashboard en JS** au lieu de SQL aggregate

### Frontend Admin
10. **Fonctions period/format dupliquées** dans 5+ fichiers
11. **useMemo manquant** sur calculs lourds (Dashboard, Paies, FacturationModeles)
12. **N+1 API calls** dans Modeles.jsx (1 call par modèle pour les plateformes)
13. **Pas de pagination** sur tables Ventes, Paies, Shifts

### Frontend Chatteur
14. **Bugs critiques** :
    - `MonProfil.jsx` : typo 'Béni' au lieu de 'Benin'
    - `MesDemandes.jsx` : mauvais import path `../../utils/api`
    - `MonPlanning.jsx` : optional chaining manquant sur `user?.chatteur_id`
    - `MesFactures.jsx` : type mismatch comparaison périodes

---

## FEATURES BETA (11 items)

| Feature | Priorité | Effort |
|---------|----------|--------|
| Transactions DB sur paie-calculator | Critique | Moyen |
| Pagination backend + frontend | Haute | Moyen |
| Validation formulaires complète | Haute | Faible |
| Error boundaries + retry UI | Haute | Faible |
| Cache API (taux de change + listes) | Moyenne | Faible |
| MonProfil éditable | Moyenne | Faible |
| Polling auto (30s) pour shifts/annonces | Moyenne | Faible |
| Tests E2E flows critiques (login → vente → paie → facture) | Haute | Moyen |
| Index DB manquants (ventes.created_at, paies.statut, notifications) | Haute | Faible |
| Vérification webhook Telegram | Haute | Faible |
| Export CSV sur toutes les listes | Basse | Faible |

---

## PAGES ADMIN AUDITEES (16)

| Page | Lignes | Issues majeures |
|------|--------|-----------------|
| Dashboard.jsx | 833 | useMemo manquant, stats recalculées chaque render |
| Chatteurs.jsx | 725 | OK, recherche présente, color picker OK |
| ChatteurDetail.jsx | 407 | Pas de retry, ventes sans limit |
| Modeles.jsx | 300 | N+1 API calls plateformes |
| Plateformes.jsx | 194 | OK, peu d'items |
| Shifts.jsx | ~1200 | Trop gros, à splitter, pas de pagination |
| Ventes.jsx | 753 | Pas de pagination, loose string comparison |
| Paies.jsx | 708 | Pas de pagination, batch progress faux |
| FacturationModeles.jsx | 558 | useMemo manquant, generatePeriods dupliqué |
| Malus.jsx | 359 | Pas de recherche, totaux non-memoizés |
| Objectifs.jsx | 223 | Pas de recherche |
| Annonces.jsx | 134 | OK, simple |
| Demandes.jsx | 118 | OK, simple |
| ActivityLog.jsx | 113 | Pagination OK |
| Settings.jsx | 169 | OK |
| TelegramBot.jsx | 327 | OK |

## PAGES CHATTEUR AUDITEES (7)

| Page | Lignes | Issues majeures |
|------|--------|-----------------|
| Dashboard.jsx | 469 | Pas d'error recovery partiel |
| MonPlanning.jsx | 238 | BUG optional chaining |
| MaPerformance.jsx | 744 | Trop complexe, 4 sous-composants inline |
| MesFactures.jsx | 365 | BUG type mismatch périodes |
| MesDemandes.jsx | 171 | BUG import path |
| MonProfil.jsx | 143 | BUG typo pays, non-éditable |
| (Sidebar/Navbar) | 365 | Breakpoints hardcodés |

## BACKEND SECURITE

| Sévérité | Issue | Fichier |
|----------|-------|---------|
| CRITIQUE | Brute force pas de lockout | auth.js, server.js |
| CRITIQUE | Validation dates exports | paies.js, ventes.js |
| HAUTE | Pas de refresh token | middleware/auth.js |
| HAUTE | Authz manquante shifts/chatteur-modeles | planning.js |
| HAUTE | Données sensibles si filtre oublié | chatteurs.js |
| HAUTE | PDF batch séquentiel | paies.js |
| HAUTE | Index manquants | database.js |
| MOYENNE | Taux change non-caché | Multiple |
| MOYENNE | calcTotals en JS | dashboard.js |
| MOYENNE | HSTS manquant | server.js |
| MOYENNE | Rate limiting par opération | Multiple |
| BASSE | Telegram poller pas de retry | telegram-poller.js |

---

## RECOMMANDATIONS ARCHITECTURE

1. **Extraire utils partagés** : `periods.js`, `formatters.js`, `getChatteurColor()`
2. **Composant FormModal réutilisable** au lieu de modals custom par page
3. **Pagination serveur** avec `parsePagination()` déjà disponible dans utils
4. **Cache mémoire** pour taux de change + listes statiques
5. **Splitter Shifts.jsx** en `ShiftGrid`, `TemplateModal`, `BulkCreationPanel`
6. **Splitter MaPerformance.jsx** en composants séparés
7. **TypeScript** à terme pour éviter les bugs de type
