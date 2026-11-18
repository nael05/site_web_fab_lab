// Chat côté client : 1 conversation unique avec tous les admins
//   GET  /api/chat/messages                -> ma conversation
//   POST /api/chat/messages                (multipart : contenu + piece_jointe optionnelle)
//   GET  /api/chat/pieces/:idMessage       -> pièce jointe (client de la conv. ou admin)
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireClient } from '../middleware/auth.js';
import { uploadChat, cheminRelatif, cheminAbsolu, supprimerFichiers } from '../middleware/upload.js';
import { emitToAdmins, emitToUser } from '../realtime.js';

const router = Router();

// Requête réutilisable (aussi utile côté admin) : messages d'une conversation
export const SQL_MESSAGES = `
  SELECT m.id_message, m.id_conversation, m.contenu, m.piece_jointe IS NOT NULL AS a_piece_jointe,
         m.piece_jointe, m.date_envoi,
         json_build_object('id', u.id_utilisateur, 'prenom', u.prenom, 'role', u.role) AS auteur
    FROM message m JOIN utilisateur u ON u.id_utilisateur = m.id_auteur`;

async function maConversation(idClient) {
  const { rows } = await query(
    `INSERT INTO conversation (id_client) VALUES ($1)
     ON CONFLICT (id_client) DO UPDATE SET id_client = EXCLUDED.id_client
     RETURNING id_conversation`,
    [idClient],
  );
  return rows[0].id_conversation;
}

router.get('/messages', requireAuth, requireClient, async (req, res) => {
  const idConversation = await maConversation(req.user.id_utilisateur);
  const { rows } = await query(`${SQL_MESSAGES} WHERE m.id_conversation = $1 ORDER BY m.date_envoi`, [idConversation]);
  res.json({ id_conversation: idConversation, messages: rows });
});

router.post('/messages', requireAuth, requireClient, uploadChat.single('piece_jointe'), async (req, res) => {
  const contenu = String(req.body.contenu || '').trim().slice(0, 5000) || null;
  if (!contenu && !req.file) return res.status(400).json({ erreur: 'Message vide' });

  try {
    const idConversation = await maConversation(req.user.id_utilisateur);
    const { rows } = await query(
      `WITH m AS (INSERT INTO message (id_conversation, id_auteur, contenu, piece_jointe)
                  VALUES ($1, $2, $3, $4) RETURNING *)
       ${SQL_MESSAGES.replace('FROM message m', 'FROM m')}`,
      [idConversation, req.user.id_utilisateur, contenu, req.file ? cheminRelatif(req.file) : null],
    );
    const message = rows[0];
    // Temps réel : le client (ses autres onglets) + tous les admins
    emitToUser(req.user.id_utilisateur, 'message:nouveau', message);
    emitToAdmins('message:nouveau', { ...message, id_client: req.user.id_utilisateur });
    res.status(201).json(message);
  } catch (err) {
    supprimerFichiers(req.file ? [req.file] : []);
    throw err;
  }
});

router.get('/pieces/:idMessage', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT m.piece_jointe, c.id_client FROM message m JOIN conversation c USING (id_conversation)
      WHERE m.id_message = $1 AND m.piece_jointe IS NOT NULL`,
    [Number.parseInt(req.params.idMessage, 10)],
  );
  const m = rows[0];
  if (!m || (m.id_client !== req.user.id_utilisateur && req.user.role !== 'admin')) {
    return res.status(404).json({ erreur: 'Pièce jointe introuvable' });
  }
  res.sendFile(cheminAbsolu(m.piece_jointe));
});

export default router;
