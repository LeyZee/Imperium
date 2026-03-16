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

## Améliorations fonctionnelles

### Planning & Shifts
- [ ] Vue planning mensuelle (en plus de la vue semaine)
- [ ] Drag & drop pour déplacer des shifts
- [ ] Auto-assignation intelligente (suggérer des chatteurs disponibles)
- [ ] Gestion des congés intégrée au planning (griser les jours de congé)
- [ ] Export planning en PDF / image pour partage Telegram

### Ventes & Finances
- [ ] Graphiques de tendance sur plusieurs périodes (line chart évolution)
- [ ] Prévisions de revenus (basées sur l'historique)
- [ ] Alertes si un chatteur est en dessous de sa moyenne
- [ ] Intégration API OnlyFans / Reveal pour import automatique des revenus (si API dispo)
- [ ] Multi-devises étendu (au-delà USD/EUR)

### Bot Telegram
- [ ] Commande `/stats` pour qu'un chatteur consulte ses stats en DM
- [ ] Commande `/planning` pour voir son planning de la semaine
- [ ] Commande `/classement` pour voir le top 5
- [ ] Réponse automatique dans le groupe après import ("✅ 253€ importé pour CARINE")
- [ ] Support multi-langue (FR/EN) pour les chatteurs non francophones

### Gamification
- [ ] Système de niveaux (XP basé sur régularité + performance)
- [ ] Challenges hebdomadaires ("Meilleur shift de la semaine")
- [ ] Hall of Fame (meilleurs chatteurs all-time)
- [ ] Récompenses visuelles (avatars, cadres, titres)
- [ ] Leaderboard animé en temps réel

### UX / Interface
- [ ] Mode sombre (dark mode)
- [ ] PWA (Progressive Web App) pour installation mobile
- [ ] Notifications push navigateur (en plus de Telegram)
- [ ] Raccourcis clavier pour les admins (navigation rapide)
- [ ] Tutoriel interactif pour les nouveaux chatteurs (onboarding guidé)
- [ ] Icônes lucide-react sur les headers de toutes les pages admin et chatteur

### Reporting & Analytics
- [ ] Export PDF des rapports mensuels (résumé global agence)
- [ ] Comparaison inter-périodes (tableaux côte à côte)
- [ ] Heatmap des créneaux les plus rentables
- [ ] Dashboard temps réel (websockets au lieu de polling)

### Sécurité & Technique
- [ ] 2FA (authentification à deux facteurs)
- [ ] Audit log plus détaillé (diff avant/après sur chaque modification)
- [ ] Tests E2E (Playwright ou Cypress)
- [ ] CI/CD GitHub Actions (lint, tests, deploy auto)
- [ ] Monitoring (uptime, alertes erreurs, métriques performance)

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

---

*Dernière mise à jour : 16 mars 2026*
