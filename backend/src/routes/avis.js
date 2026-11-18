// Avis
//   GET  /api/avis              -> mur de tous les avis
//   GET  /api/avis/eligibles    -> mes projets terminés sans avis
//   POST /api/avis              { id_projet, note, commentaire }
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireClient } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT a.id_avis, a.note, a.commentaire, a.date_avis,
            p.titre, p.categorie, u.prenom, left(u.nom, 1) AS initiale_nom
       FROM avis a
       JOIN projet p ON p.id_projet = a.id_projet
       JOIN utilisateur u ON u.id_utilisateur = p.id_auteur
      ORDER BY a.date_avis DESC`,
  );
  res.json(rows);
});

router.get('/eligibles', requireAuth, requireClient, async (req, res) => {
  const { rows } = await query(
    `SELECT p.id_projet, p.titre FROM projet p
      WHERE p.id_auteur = $1 AND p.statut = 'termine'
        AND NOT EXISTS (SELECT 1 FROM avis a WHERE a.id_projet = p.id_projet)
      ORDER BY p.date_soumission DESC`,
    [req.user.id_utilisateur],
  );
  res.json(rows);
});

router.post('/', requireAuth, requireClient, async (req, res) => {
  const idProjet = Number.parseInt(req.body.id_projet, 10);
  const note = Number.parseInt(req.body.note, 10);
  const commentaire = String(req.body.commentaire || '').trim().slice(0, 2000) || null;
  if (!(note >= 1 && note <= 5)) return res.status(400).json({ erreur: 'Note entre 1 et 5' });

  // Règle métier : seulement l'auteur, et seulement si le projet est terminé
  const { rowCount } = await query(
    `SELECT 1 FROM projet WHERE id_projet = $1 AND id_auteur = $2 AND statut = 'termine'`,
    [idProjet, req.user.id_utilisateur],
  );
  if (!rowCount) return res.status(403).json({ erreur: 'Avis possible uniquement sur vos projets terminés' });

  const { rows } = await query(
    'INSERT INTO avis (id_projet, note, commentaire) VALUES ($1, $2, $3) RETURNING *',
    [idProjet, note, commentaire],
  ); // UNIQUE(id_projet) -> 409 si déjà un avis (géré par le handler d'erreurs)
  res.status(201).json(rows[0]);
});

export default router;
