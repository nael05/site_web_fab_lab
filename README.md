# Plateforme Web Fab Lab — Ydays

Impression 3D et flocage de tee-shirts. Connexion `@ynov.com` avec code OTP (Brevo).

| Dossier      | Contenu                                          |
|--------------|--------------------------------------------------|
| `database/`  | `init.sql` : toute la BDD (MPD v1) + données de démo |
| `backend/`   | API Node.js (Express 5, pg, Socket.IO)           |
| `frontend/`  | React + Vite                                     |

## Lancer en local

Prérequis : Docker Desktop et Node.js 20 ou plus.

```bash
# 1. BDD (init.sql est joué automatiquement au 1er lancement)
docker compose up -d

# 2. Back (port 3000)
cd backend
cp .env.example .env        # puis mettre un JWT_SECRET
npm install
npm run dev

# 3. Front (port 5173), dans un autre terminal
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173.

- **Codes OTP en dev** : tant que `BREVO_API_KEY` est vide, les mails (et donc les codes) s'affichent dans la console du back.
- **Comptes de démo** : `admin.fablab@ynov.com` (admin), `etudiant.demo@ynov.com` et `camille.martin@ynov.com` (clients).
- **Voir la BDD** : Adminer sur http://localhost:8080 (Système PostgreSQL, serveur `db`, utilisateur/mot de passe/base : `fablab`).
- **Port de la BDD : 5440** (pas 5432) pour ne pas entrer en conflit avec un PostgreSQL installé sur Windows. Pour pgAdmin / DBeaver : `localhost:5440`, utilisateur, mot de passe et base `fablab`.
- **Réinitialiser la BDD** (après une modif de `init.sql`) : `docker compose down -v && docker compose up -d`.

## Ce qui est fait (partie client)

- Auth OTP + routage automatique admin / client (liste blanche `ADMIN_EMAILS` dans `.env`)
- Portfolio avec résumé auto (conso, durées, délai, prix)
- Mes projets : suivi par étapes, jauge % + compte à rebours (3D en impression), bilan, bouton avis
- Formulaire « Soumettre un projet » 3D / tee-shirt avec la règle des 26 cm (plusieurs .stl au-delà)
- Avis (seulement sur un projet terminé, un seul par projet)
- Contact (mail à l'équipe) + messagerie temps réel avec les admins

## Pour la partie admin

**Back** : `backend/src/routes/admin/index.js` (déjà protégé par `requireAuth` et `requireAdmin`, la liste des tâches est en commentaire).

**Front** : `frontend/src/pages/admin/AdminAccueil.jsx` (route `/admin/*`).

Ce qui est déjà prêt à réutiliser :

| Besoin | Où |
|---|---|
| Requêtes SQL / transactions | `backend/src/db.js` (`query`, `transaction`) |
| Machine à états des statuts | `backend/src/services/statuts.js` |
| Calcul du prix (€/kg, €/ml, €/u) | `backend/src/services/prix.js` |
| Mails Brevo (changement de statut…) | `backend/src/services/mail.js` |
| Prévenir le client en direct | `emitToUser(id, 'projet:maj', …)` dans `backend/src/realtime.js` |
| Upload de photos du portfolio | `uploadPortfolio` dans `backend/src/middleware/upload.js` |
| Appels API côté front | `frontend/src/api.js` |
| Libellés, prix, durées | `frontend/src/utils/format.js` |
| Styles (couleurs Ynov, cartes, badges) | `frontend/src/styles/global.css` |

Le front client se met à jour tout seul sur ces événements Socket.IO : `projet:maj` (Mes projets), `portfolio:maj` (Portfolio) et `message:nouveau` (Messagerie).
