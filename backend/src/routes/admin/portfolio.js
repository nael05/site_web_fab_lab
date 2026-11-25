// =====================================================================
// routes/admin/portfolio.js — Gestion du Portfolio (côté admin)
// Monté dans routes/admin/index.js -> déjà protégé (connecté + admin)
//
//   GET    /api/admin/portfolio                          -> projets terminés + leur publication (ou null)
//   POST   /api/admin/portfolio                          -> créer un brouillon { id_projet, description_publique }
//   PATCH  /api/admin/portfolio/:id                      -> { description_publique?, est_visible? }
//   DELETE /api/admin/portfolio/:id                      -> supprimer la publication (et ses photos)
//   POST   /api/admin/portfolio/:id/photos               -> ajouter des photos (multipart, champ "photos", 10 max)
//   PATCH  /api/admin/portfolio/:id/photos/:idPhoto      -> { legende?, ordre? }
//   DELETE /api/admin/portfolio/:id/photos/:idPhoto      -> supprimer une photo
//
// Cycle de vie : brouillon (est_visible = false, invisible pour les élèves)
//                -> publié (est_visible = true, date_publication remplie)
//                -> masqué (est_visible = false, la date reste)
// =====================================================================
import { Router } from 'express';
import fs from 'node:fs/promises';
import { query } from '../../db.js';
import { uploadPortfolio, cheminRelatif, cheminAbsolu, supprimerFichiers } from '../../middleware/upload.js';
import { emitToAll } from '../../realtime.js';

const router = Router();

const erreur = (status, message) => Object.assign(new Error(message), { status });

function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw erreur(400, 'Identifiant invalide');
  return id;
}

// Le Portfolio est public pour tous les connectés : on prévient tout le monde,
// SANS rien envoyer de privé (le front recharge GET /api/portfolio, qui ne
// renvoie que les publications visibles).
const prevenir = () => emitToAll('portfolio:maj', {});

// Supprime des fichiers du disque (sans planter si l'un d'eux a déjà disparu)
async function effacerDuDisque(chemins) {
  await Promise.all(chemins.map((c) => fs.unlink(cheminAbsolu(c)).catch(() => {})));
}

// Une publication + ses photos (triées), ou erreur 404
async function lirePublication(id) {
  const { rows } = await query(
    `SELECT pu.*, p.titre, p.categorie,
            COALESCE((SELECT json_agg(json_build_object('id_photo', ph.id_photo, 'chemin', ph.chemin,
                       'legende', ph.legende, 'ordre', ph.ordre) ORDER BY ph.ordre, ph.id_photo)
                        FROM photo ph WHERE ph.id_publication = pu.id_publication), '[]') AS photos
       FROM publication pu
       JOIN projet p ON p.id_projet = pu.id_projet
      WHERE pu.id_publication = $1`,
    [id],
  );
  if (!rows[0]) throw erreur(404, 'Publication introuvable');
  return rows[0];
}

// ---------------------------------------------------------------------
// GET /api/admin/portfolio -> tous les projets TERMINÉS, publiés ou pas.
// publication = null : projet pas encore mis au portfolio (bouton « Publier »).
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id_projet, p.titre, p.categorie, p.cadre,
            b.date_cloture,
            CASE WHEN pu.id_publication IS NULL THEN NULL ELSE json_build_object(
              'id_publication', pu.id_publication,
              'description_publique', pu.description_publique,
              'est_visible', pu.est_visible,
              'date_publication', pu.date_publication,
              'nb_photos', (SELECT count(*)::int FROM photo ph WHERE ph.id_publication = pu.id_publication)
            ) END AS publication
       FROM projet p
       LEFT JOIN bilan b        ON b.id_projet = p.id_projet
       LEFT JOIN publication pu ON pu.id_projet = p.id_projet
      WHERE p.statut = 'termine'
      ORDER BY b.date_cloture DESC NULLS LAST`,
  );
  res.json(rows);
});

// ---------------------------------------------------------------------
// POST /api/admin/portfolio -> créer un BROUILLON (pas encore visible)
//   { "id_projet": 1, "description_publique": "Dragon imprimé en PLA puis peint à la main" }
// ---------------------------------------------------------------------
router.post('/', async (req, res) => {
  const idProjet = lireId(req.body?.id_projet);
  const description = String(req.body?.description_publique ?? '').trim();
  if (!description) throw erreur(400, 'description_publique obligatoire');

  const { rows: [projet] } = await query(
    `SELECT p.statut, pu.id_publication
       FROM projet p LEFT JOIN publication pu ON pu.id_projet = p.id_projet
      WHERE p.id_projet = $1`,
    [idProjet],
  );
  if (!projet) throw erreur(404, 'Projet introuvable');
  if (projet.statut !== 'termine') throw erreur(409, 'Seul un projet terminé peut aller au portfolio');
  if (projet.id_publication) {
    throw erreur(409, `Ce projet a déjà une publication (id ${projet.id_publication})`);
  }

  // (Si deux admins cliquent en même temps, la contrainte UNIQUE sur id_projet
  //  fait échouer le 2e -> 409 « Cet élément existe déjà » via server.js.)
  const { rows: [pub] } = await query(
    `INSERT INTO publication (id_projet, description_publique) VALUES ($1, $2) RETURNING id_publication`,
    [idProjet, description],
  );
  res.status(201).json(await lirePublication(pub.id_publication));
});

// ---------------------------------------------------------------------
// PATCH /api/admin/portfolio/:id
//   { "est_visible": true }            -> publier (date_publication = maintenant, la 1re fois)
//   { "est_visible": false }           -> masquer
//   { "description_publique": "..." }  -> corriger le texte
// ---------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const id = lireId(req.params.id);
  const { est_visible: visible, description_publique: desc } = req.body ?? {};

  if (visible === undefined && desc === undefined) {
    throw erreur(400, 'Envoie est_visible et/ou description_publique');
  }
  if (visible !== undefined && typeof visible !== 'boolean') throw erreur(400, 'est_visible : true ou false');
  const description = desc === undefined ? null : String(desc).trim();
  if (description === '') throw erreur(400, 'description_publique ne peut pas être vide');

  // COALESCE($x, colonne) : valeur non envoyée -> on garde l'ancienne.
  // date_publication : remplie à la PREMIÈRE publication, puis on n'y touche plus.
  const { rowCount } = await query(
    `UPDATE publication SET
        description_publique = COALESCE($2, description_publique),
        est_visible          = COALESCE($3, est_visible),
        date_publication     = CASE WHEN $3 THEN COALESCE(date_publication, now())
                                    ELSE date_publication END
      WHERE id_publication = $1`,
    [id, description, visible ?? null],
  );
  if (!rowCount) throw erreur(404, 'Publication introuvable');

  prevenir();
  res.json(await lirePublication(id));
});

// ---------------------------------------------------------------------
// DELETE /api/admin/portfolio/:id -> retire le projet du portfolio
// La BDD supprime les lignes photo (ON DELETE CASCADE), nous on efface les fichiers.
// ---------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const id = lireId(req.params.id);
  const { rows: photos } = await query('SELECT chemin FROM photo WHERE id_publication = $1', [id]);
  const { rowCount } = await query('DELETE FROM publication WHERE id_publication = $1', [id]);
  if (!rowCount) throw erreur(404, 'Publication introuvable');

  await effacerDuDisque(photos.map((p) => p.chemin));
  prevenir();
  res.status(204).end();
});

// ---------------------------------------------------------------------
// POST /api/admin/portfolio/:id/photos -> ajouter des photos
// multipart : "photos" (1 à 10 images .png .jpg .jpeg .webp, 10 Mo max chacune)
//             "legendes" (facultatif, une par photo, dans le même ordre)
// Les nouvelles photos se placent APRÈS celles qui existent déjà.
// ---------------------------------------------------------------------
router.post('/:id/photos', uploadPortfolio.array('photos', 10), async (req, res) => {
  const fichiers = req.files || [];
  try {
    const id = lireId(req.params.id);
    if (!fichiers.length) throw erreur(400, 'Ajoute au moins une photo (champ "photos")');

    const { rows: [pub] } = await query(
      `SELECT COALESCE(max(ph.ordre), -1) AS dernier
         FROM publication pu LEFT JOIN photo ph ON ph.id_publication = pu.id_publication
        WHERE pu.id_publication = $1
        GROUP BY pu.id_publication`,
      [id],
    );
    if (!pub) throw erreur(404, 'Publication introuvable');

    // "legendes" arrive en texte si 1 seule, en tableau si plusieurs
    const legendes = [req.body?.legendes ?? []].flat();
    for (const [i, f] of fichiers.entries()) {
      const legende = String(legendes[i] ?? '').trim().slice(0, 200) || null;
      await query(
        'INSERT INTO photo (id_publication, chemin, legende, ordre) VALUES ($1, $2, $3, $4)',
        [id, cheminRelatif(f), legende, pub.dernier + 1 + i],
      );
    }

    prevenir();
    res.status(201).json(await lirePublication(id));
  } catch (err) {
    supprimerFichiers(fichiers); // pas d'image orpheline sur le disque
    throw err;
  }
});

// ---------------------------------------------------------------------
// PATCH /api/admin/portfolio/:id/photos/:idPhoto
//   { "legende": "Vue de face" }  ou  { "ordre": 0 }  (0 = photo de couverture)
// ---------------------------------------------------------------------
router.patch('/:id/photos/:idPhoto', async (req, res) => {
  const id = lireId(req.params.id);
  const idPhoto = lireId(req.params.idPhoto);
  const { legende, ordre } = req.body ?? {};

  if (legende === undefined && ordre === undefined) throw erreur(400, 'Envoie legende et/ou ordre');
  if (ordre !== undefined && !(Number.isInteger(ordre) && ordre >= 0 && ordre <= 1000)) {
    throw erreur(400, 'ordre : entier >= 0');
  }
  const texte = legende === undefined ? undefined : String(legende ?? '').trim().slice(0, 200);

  // "AND id_publication = $2" : on ne peut pas modifier la photo d'une AUTRE publication
  const { rowCount } = await query(
    `UPDATE photo SET
        legende = CASE WHEN $3 THEN $4 ELSE legende END,
        ordre   = COALESCE($5, ordre)
      WHERE id_photo = $1 AND id_publication = $2`,
    [idPhoto, id, texte !== undefined, texte || null, ordre ?? null],
  );
  if (!rowCount) throw erreur(404, 'Photo introuvable');

  prevenir();
  res.json(await lirePublication(id));
});

// ---------------------------------------------------------------------
// DELETE /api/admin/portfolio/:id/photos/:idPhoto -> ligne en BDD + fichier
// ---------------------------------------------------------------------
router.delete('/:id/photos/:idPhoto', async (req, res) => {
  const id = lireId(req.params.id);
  const idPhoto = lireId(req.params.idPhoto);

  const { rows } = await query(
    'DELETE FROM photo WHERE id_photo = $1 AND id_publication = $2 RETURNING chemin',
    [idPhoto, id],
  );
  if (!rows[0]) throw erreur(404, 'Photo introuvable');

  await effacerDuDisque([rows[0].chemin]);
  prevenir();
  res.json(await lirePublication(id));
});

export default router;
