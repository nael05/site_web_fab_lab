// Portfolio public (projets terminés publiés par l'admin)
//   GET /api/portfolio
// Les photos sont servies en statique : /uploads/<chemin>
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { chargerBilans } from '../services/bilan.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT pu.id_publication, pu.description_publique, pu.date_publication,
            p.id_projet, p.titre, p.categorie, p.cadre,
            COALESCE((SELECT json_agg(json_build_object('id_photo', ph.id_photo, 'chemin', ph.chemin,
                       'legende', ph.legende) ORDER BY ph.ordre, ph.id_photo)
                        FROM photo ph WHERE ph.id_publication = pu.id_publication), '[]') AS photos
       FROM publication pu
       JOIN projet p ON p.id_projet = pu.id_projet
      WHERE pu.est_visible
      ORDER BY pu.date_publication DESC NULLS LAST`,
  );
  const bilans = await chargerBilans(rows.map((r) => r.id_projet));
  res.json(rows.map((r) => ({ ...r, bilan: bilans[r.id_projet] || null })));
});

export default router;
