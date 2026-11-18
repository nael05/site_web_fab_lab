// Charge le résumé auto (bilan + consommations) d'une liste de projets.
// Sert à "Mes projets" et au Portfolio. Renvoie { [id_projet]: bilan }
import { query } from '../db.js';

export async function chargerBilans(idsProjets) {
  if (!idsProjets.length) return {};
  const { rows } = await query(
    `SELECT b.*,
            COALESCE(json_agg(json_build_object(
              'nom', pr.nom, 'couleur', pr.couleur, 'categorie', pr.categorie,
              'unite_prix', pr.unite_prix, 'quantite', c.quantite,
              'prix_unitaire_centimes', c.prix_unitaire_centimes
            ) ORDER BY pr.categorie) FILTER (WHERE c.id_produit IS NOT NULL), '[]') AS consommations
       FROM bilan b
       LEFT JOIN consommation c ON c.id_bilan = b.id_bilan
       LEFT JOIN produit pr ON pr.id_produit = c.id_produit
      WHERE b.id_projet = ANY($1)
      GROUP BY b.id_bilan`,
    [idsProjets],
  );
  return Object.fromEntries(rows.map((b) => [b.id_projet, b]));
}
