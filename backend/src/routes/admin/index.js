// ===================== PARTIE ADMIN (à coder) =====================
// Toutes les routes ici sont déjà protégées : connecté + role = 'admin'.
// Ajoute tes fichiers dans ce dossier puis monte-les ci-dessous :
//   router.use('/projets', projetsAdmin);
//
// À faire (voir MPD + feuille de route) :
//  1. Suivi & Planning : liste des projets (filtre statut), accepter/refuser,
//     changer de statut -> services/statuts.js (peutPasser) + INSERT etape,
//     progression_pct / fin_impression_prevue pour le compte à rebours 3D,
//     agenda = SELECT sur etape.
//  2. Clôture « Projet fini » en UNE transaction (db.transaction) :
//     INSERT bilan + consommation (prix figé), UPDATE produit.quantite_stock,
//     UPDATE projet.statut = 'termine', INSERT etape 'cloture'.
//     Prix : services/prix.js. Si stock < 0, ck_stock fait tout échouer.
//  3. Stock : CRUD produit (désactiver au lieu de supprimer : est_actif = false).
//  4. Portfolio : publication + photos (middleware/upload.js -> uploadPortfolio).
//  5. Chat : liste des conversations, messages (SQL_MESSAGES dans routes/chat.js),
//     répondre -> emitToUser(id_client, 'message:nouveau', msg) + emitToAdmins(...)
//
// Après chaque changement visible par le client :
//   emitToUser(id_auteur, 'projet:maj', { id_projet })   -> le front client se rafraîchit
//   envoyerMailSansAttendre(mailChangementStatut(...))    -> mail Brevo
// ==================================================================
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

import projetsAdmin from './projets.js';
import stockAdmin from './stock.js';
import chatAdmin from './chat.js';
import portfolioAdmin from './portfolio.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Test rapide : GET /api/admin/ping
router.get('/ping', (req, res) => res.json({ ok: true, admin: req.user.email }));

router.use('/projets', projetsAdmin);
router.use('/stock', stockAdmin);
router.use('/chat', chatAdmin);
router.use('/portfolio', portfolioAdmin);

export default router;
