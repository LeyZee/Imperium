# IMPERIUM — Roadmap & Projets Futurs

> Idées et évolutions planifiées pour Imperium. Ce fichier sert de mémoire entre les sessions de développement.

---

## Projets majeurs

### 1. Interface Modèles (priorité haute)
> Espace dédié pour les modèles elles-mêmes

- Dashboard modèle avec vue sur leurs revenus, leurs chatteurs assignés
- Consultation des shifts sur leurs comptes
- Statistiques de performance par chatteur (quel chatteur génère le plus sur leur compte)
- Notifications (résumé de revenus, nouveau chatteur assigné)
- Authentification séparée (rôle `modele` dans users)
- *À définir : niveau d'accès aux données financières (brut seulement ? net aussi ?)*

### 2. Transformation SaaS (priorité future)
> Ouvrir Imperium à d'autres agences du même secteur

**Pré-requis techniques :**
- Multi-tenancy (isolation des données par agence)
- Migration SQLite → PostgreSQL (concurrence, scalabilité)
- Onboarding self-service (inscription, setup guidé)
- Système de billing (Stripe/Paddle, plans mensuels)
- Déploiement cloud (Docker, orchestration)
- Dashboard super-admin pour gérer toutes les agences
- Personnalisation par tenant (logo, couleurs, nom d'agence)

**Modèle économique à définir :**
- Freemium ? (X chatteurs gratuits, premium au-delà)
- Par nombre de chatteurs actifs ?
- Par volume de ventes ?

---

## Réalisé récemment (18 mars 2026)

### Bot Telegram — Refonte complète
- [x] Identification du modèle via les topics Telegram (forum mode)
- [x] Shift linking amélioré (±3 jours, shifts de nuit, modèle du topic)
- [x] Résilience : heartbeat, auto-recovery exponential backoff, circuit breaker
- [x] Watchdog : surveillance bot, taux d'erreurs, imports non résolus
- [x] DM enrichis avec boutons cliquables sur CHAQUE message (zero typing UX)
- [x] Menu interactif /aide avec inline keyboard
- [x] Commande /mesventes — résumé ventes de la période
- [x] Inscription par boutons (cliquer son prénom au lieu de le taper)
- [x] Fix bug inscription auto-linkés (telegram_dm_ok activé sur /start)
- [x] Détection conflit modèle (topic vs shift) → DM au chatteur pour confirmer
- [x] Shift ambigu → DM au chatteur avec boutons pour choisir le bon
- [x] Récap quotidien chatteur (DM 21h) + admin (notif 8h)
- [x] Audit quotidien auto-correction des imports incomplets
- [x] Annonce /start améliorée (montre qui est enregistré, qui ne l'est pas)
- [x] Commandes enregistrées dans le menu natif Telegram (setMyCommands)

### Interface Admin Telegram
- [x] Colonnes Modèle + Shift dans le tableau des imports
- [x] Date du rapport (vs date d'import) dans le tableau
- [x] Stats imports complets vs warnings
- [x] Bouton éditer sur tous les imports + badge CONFLIT
- [x] Section "Inviter les chatteurs" avec explications
- [x] Panneau statut Telegram des chatteurs (✅ / ⚠️ / ❌)
- [x] Heartbeat stale warning + bouton Redémarrer
- [x] Journal : types shift_selection, modele_selection, daily_summary

### Robustesse & Sécurité
- [x] PM2 log rotation (50MB, compression, exponential backoff restart)
- [x] Self-test au démarrage (DB, tables, intégrité, token)
- [x] Health check enrichi (/health : telegram, DB integrity, memory)
- [x] Matérialisation automatique des templates en vrais shifts
- [x] Purge automatique vieux logs (30j), notifications lues (30j), activity_log (90j)
- [x] DB ANALYZE quotidien
- [x] Circuit breaker auto-recovery (5 tentatives max, notif admin)
- [x] Exponential backoff sur les caches (topicNameCache, pendingRegistrations)

### Ventes & Shifts
- [x] Dropdown shifts centré sur la date du rapport
- [x] Shifts de nuit (🌙) : matching créneau 3/4 de la veille
- [x] Templates matérialisés automatiquement (startup + toutes les 30 min)

---

## Améliorations fonctionnelles

### Planning & Shifts (priorité haute — prochaine session)
- [ ] Vue planning mensuelle (en plus de la vue semaine)
- [ ] Drag & drop pour déplacer des shifts
- [ ] Auto-assignation intelligente (suggérer des chatteurs disponibles)
- [ ] Gestion des congés intégrée au planning (griser les jours de congé)
- [ ] Export planning en PDF / image pour partage Telegram/Discord
- [ ] Commande `/planning` Telegram pour voir son planning de la semaine
- [ ] Swap de shifts entre chatteurs (demande + validation manager)
- [ ] Alertes conflits de planning (même chatteur sur 2 modèles en même temps)
- [ ] Vue calendrier annuel (heatmap d'activité par chatteur)

### Ventes & Finances
- [ ] Graphiques de tendance sur plusieurs périodes (line chart évolution)
- [ ] Prévisions de revenus (basées sur l'historique)
- [ ] Alertes si un chatteur est en dessous de sa moyenne
- [ ] Intégration API OnlyFans / Reveal pour import automatique des revenus (si API dispo)
- [ ] Multi-devises étendu (au-delà USD/EUR)
- [ ] Comparaison modèle vs modèle (quel modèle rapporte le plus)
- [ ] Objectifs individuels par chatteur (en plus des objectifs collectifs)

### Bot Telegram
- [ ] Commande `/stats` pour qu'un chatteur consulte ses stats en DM
- [ ] Commande `/classement` pour voir le top 5
- [ ] Réponse automatique dans le groupe après import ("✅ 253€ importé pour CARINE")
- [ ] Support multi-langue (FR/EN) pour les chatteurs non francophones
- [ ] Commande `/planning` pour voir son planning de la semaine
- [ ] Bot admin : commandes de gestion depuis Telegram (/pause, /broadcast, /status)
- [ ] Détection de doublons inter-plateformes (même montant OF+Reveal = suspect)

### Gamification
- [ ] Système de niveaux (XP basé sur régularité + performance)
- [ ] Challenges hebdomadaires ("Meilleur shift de la semaine")
- [ ] Hall of Fame (meilleurs chatteurs all-time)
- [ ] Récompenses visuelles (avatars, cadres, titres)
- [ ] Leaderboard animé en temps réel
- [ ] Streaks : jours consécutifs avec feedback posté
- [ ] Badges d'accomplissement (100 shifts, 10K€ cumulés, etc.)

### UX / Interface
- [ ] Mode sombre (dark mode)
- [ ] PWA (Progressive Web App) pour installation mobile
- [ ] Notifications push navigateur (en plus de Telegram)
- [ ] Raccourcis clavier pour les admins (navigation rapide)
- [ ] Tutoriel interactif pour les nouveaux chatteurs (onboarding guidé)
- [ ] Icônes lucide-react sur les headers de toutes les pages admin et chatteur
- [ ] Dashboard chatteur amélioré : graphique évolution semaine par semaine
- [ ] Page "Mon équipe" pour les managers (vue de leurs chatteurs)

### Reporting & Analytics
- [ ] Export PDF des rapports mensuels (résumé global agence)
- [ ] Comparaison inter-périodes (tableaux côte à côte)
- [ ] Heatmap des créneaux les plus rentables
- [ ] Dashboard temps réel (websockets au lieu de polling)
- [ ] Rapport automatique hebdo envoyé par email aux managers
- [ ] KPIs agence : taux de remplissage planning, CA/shift moyen, top performers

### Sécurité & Technique
- [ ] 2FA (authentification à deux facteurs)
- [ ] Audit log plus détaillé (diff avant/après sur chaque modification)
- [ ] Tests E2E (Playwright ou Cypress)
- [ ] CI/CD GitHub Actions (lint, tests, deploy auto)
- [ ] Monitoring (uptime, alertes erreurs, métriques performance)
- [ ] Rate limiting par IP granulaire (différent pour API publique vs admin)
- [ ] Backup automatique sur stockage externe (S3, Google Drive)

---

## Idées en vrac
*À trier et prioriser plus tard*

- Application mobile native (React Native ?)
- Intégration Google Calendar pour les shifts
- Système de messagerie interne (chat entre admin et chatteurs)
- Module formation (vidéos, guides, quiz pour les nouveaux)
- Gestion des dépenses agence (charges, locaux, outils)
- Facturation automatique vers les modèles (part agence)
- Signature électronique des contrats chatteurs
- Intégration Discord (webhook pour les notifications agence)
- API publique documentée (pour intégrations tierces)
- White-label : permettre aux modèles d'avoir leur propre branding

---

*Dernière mise à jour : 18 mars 2026*
