// =====================================================================
// routes/admin/chat.js — Messagerie côté admin
// Monté dans routes/admin/index.js -> déjà protégé (connecté + admin)
//
//   GET  /api/admin/chat                  -> toutes les conversations (une par élève)
//   GET  /api/admin/chat/:idClient        -> les messages d'un élève
//   POST /api/admin/chat/:idClient        -> répondre (multipart : contenu + piece_jointe optionnelle)
//   Pièce jointe : GET /api/chat/pieces/:idMessage (déjà ouvert aux admins dans routes/chat.js)
//
// QUI VOIT QUOI
//   - Élève : uniquement SA conversation. Côté client (routes/chat.js), la
//     conversation est TOUJOURS déduite de req.user, jamais d'un id dans l'URL.
//     Changer un numéro dans l'URL ne permet donc pas de lire le chat d'un autre.
//   - Admins : toutes les conversations, et n'importe quel admin peut répondre.
//   - Temps réel : un message va dans la "salle" de l'élève concerné
//     (emitToUser) + la salle "admins". JAMAIS io.emit(...) : ça l'enverrait à tout le monde.
//
// Les conversations sont repérées par l'id de l'ÉLÈVE (une seule par élève) :
// un admin peut donc aussi écrire en premier, la conversation est créée au besoin.
// =====================================================================
import { Router } from 'express';
import { query } from '../../db.js';
import { uploadChat, cheminRelatif, supprimerFichiers } from '../../middleware/upload.js';
import { emitToAdmins, emitToUser } from '../../realtime.js';
import { SQL_MESSAGES } from '../chat.js';

const router = Router();

const erreur = (status, message) => Object.assign(new Error(message), { status });

// "12" -> 12 ; "abc", "-3" -> erreur 400
function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw erreur(400, 'Identifiant invalide');
  return id;
}

// L'id doit être celui d'un ÉLÈVE (pas d'un admin, pas d'un compte inexistant)
async function lireClient(idClient) {
  const { rows } = await query(
    `SELECT id_utilisateur, email, prenom, nom FROM utilisateur
      WHERE id_utilisateur = $1 AND role = 'client'`,
    [idClient],
  );
  if (!rows[0]) throw erreur(404, 'Élève introuvable');
  return rows[0];
}

// ---------------------------------------------------------------------
// GET /api/admin/chat -> la boîte de réception des admins
// Une ligne par élève qui a au moins un message, la plus récente en haut.
// attend_reponse = true si le dernier message vient de l'élève (personne n'a encore répondu).
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id_conversation,
            json_build_object('id', u.id_utilisateur, 'email', u.email,
                              'prenom', u.prenom, 'nom', u.nom) AS client,
            dernier.contenu, dernier.a_piece_jointe, dernier.date_envoi,
            (dernier.id_auteur = c.id_client) AS attend_reponse,
            (SELECT count(*)::int FROM message m WHERE m.id_conversation = c.id_conversation) AS nb_messages
       FROM conversation c
       JOIN utilisateur u ON u.id_utilisateur = c.id_client
       -- LATERAL : pour CHAQUE conversation, va chercher son dernier message
       JOIN LATERAL (
             SELECT m.contenu, m.piece_jointe IS NOT NULL AS a_piece_jointe, m.date_envoi, m.id_auteur
               FROM message m
              WHERE m.id_conversation = c.id_conversation
              ORDER BY m.date_envoi DESC, m.id_message DESC
              LIMIT 1
            ) AS dernier ON true
      ORDER BY dernier.date_envoi DESC`,
  );
  res.json(rows);
});

// ---------------------------------------------------------------------
// GET /api/admin/chat/:idClient -> fil complet d'un élève
// Pas de conversation encore ? On renvoie une liste vide (sans rien créer).
// ---------------------------------------------------------------------
router.get('/:idClient', async (req, res) => {
  const client = await lireClient(lireId(req.params.idClient));
  const { rows } = await query(
    `${SQL_MESSAGES}
       JOIN conversation c ON c.id_conversation = m.id_conversation
      WHERE c.id_client = $1
      ORDER BY m.date_envoi, m.id_message`,
    [client.id_utilisateur],
  );
  res.json({ client, id_conversation: rows[0]?.id_conversation ?? null, messages: rows });
});

// ---------------------------------------------------------------------
// POST /api/admin/chat/:idClient -> répondre à un élève
// Même format que côté client : multipart avec "contenu" et/ou "piece_jointe".
// (Depuis Postman sans fichier, du JSON { "contenu": "..." } marche aussi.)
// ---------------------------------------------------------------------
router.post('/:idClient', uploadChat.single('piece_jointe'), async (req, res) => {
  try {
    const client = await lireClient(lireId(req.params.idClient));
    const contenu = String(req.body?.contenu || '').trim().slice(0, 5000) || null;
    if (!contenu && !req.file) throw erreur(400, 'Message vide');

    // La conversation de l'élève : créée si l'admin écrit en premier.
    // "DO UPDATE SET id_client = EXCLUDED.id_client" ne change rien, mais
    // permet à RETURNING de renvoyer la ligne même si elle existait déjà.
    const { rows: [conv] } = await query(
      `INSERT INTO conversation (id_client) VALUES ($1)
       ON CONFLICT (id_client) DO UPDATE SET id_client = EXCLUDED.id_client
       RETURNING id_conversation`,
      [client.id_utilisateur],
    );

    const { rows: [message] } = await query(
      `WITH m AS (INSERT INTO message (id_conversation, id_auteur, contenu, piece_jointe)
                  VALUES ($1, $2, $3, $4) RETURNING *)
       ${SQL_MESSAGES.replace('FROM message m', 'FROM m')}`,
      [conv.id_conversation, req.user.id_utilisateur, contenu, req.file ? cheminRelatif(req.file) : null],
    );

    // Temps réel : l'élève concerné UNIQUEMENT + tous les admins (pour que
    // les autres admins voient qu'on a déjà répondu)
    emitToUser(client.id_utilisateur, 'message:nouveau', message);
    emitToAdmins('message:nouveau', { ...message, id_client: client.id_utilisateur });

    res.status(201).json(message);
  } catch (err) {
    supprimerFichiers(req.file ? [req.file] : []); // pas de fichier orphelin dans uploads/chat
    throw err;
  }
});

export default router;
