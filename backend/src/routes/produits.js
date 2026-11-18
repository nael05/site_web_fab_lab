// Stock vu par le client : uniquement ce qui est choisissable
//   GET /api/produits/disponibles?categorie=filament|tee_shirt
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/disponibles', requireAuth, async (req, res) => {
  const categorie = req.query.categorie;
  if (!['filament', 'tee_shirt', 'peinture'].includes(categorie)) {
    return res.status(400).json({ erreur: 'Catégorie invalide' });
  }
  const { rows } = await query(
    `SELECT id_produit, nom, couleur, categorie
       FROM produit
      WHERE categorie = $1 AND est_actif AND est_consommable AND quantite_stock > 0
      ORDER BY nom, couleur`,
    [categorie],
  );
  res.json(rows);
});

export default router;
