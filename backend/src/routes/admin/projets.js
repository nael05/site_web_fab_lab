// =====================================================================
// routes/admin/projets.js — Suivi & Planning (côté admin)
// Monté dans routes/admin/index.js -> déjà protégé (connecté + admin)
//
//   GET   /api/admin/projets?statut=soumis    -> liste (filtre optionnel)
//   GET   /api/admin/projets/agenda           -> agenda (étapes), ?du=2026-11-01&au=2026-11-30
//   GET   /api/admin/projets/:id              -> détail (client, fichiers, étapes, bilan)
//   POST  /api/admin/projets/:id/statut       -> { statut, motif_refus?, duree_min?, commentaire? }
//   PATCH /api/admin/projets/:id/avancement   -> { progression_pct?, fin_impression_prevue? }
//   POST  /api/admin/projets/:id/cloture      -> « Projet fini » : bilan + consommations
//
// Les erreurs sont levées avec un status (400, 404, 409) : le gestionnaire
// d'erreurs de server.js les renvoie au front sous la forme { erreur: '...' }.
// =====================================================================
import { Router } from 'express';
import { query, transaction } from '../../db.js';
import { LIBELLES_STATUT, peutPasser, statutsSuivants } from '../../services/statuts.js';
import { prixLigneCentimes } from '../../services/prix.js';
import { chargerBilans } from '../../services/bilan.js';
import { envoyerMailSansAttendre, mailChangementStatut } from '../../services/mail.js';
import { emitToAdmins, emitToUser } from '../../realtime.js';

const router = Router();

// ---------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------

// Crée une erreur avec un code HTTP : throw erreur(404, 'Projet introuvable')
const erreur = (status, message) => Object.assign(new Error(message), { status });

// "12" -> 12 ; "abc", "-3", "" -> erreur 400
function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw erreur(400, 'Identifiant invalide');
  return id;
}

// Durée en minutes, facultative : undefined/null -> null ; 45 -> 45 ; -5 ou "abc" -> erreur 400
function lireMinutes(valeur, nomChamp) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 0) throw erreur(400, `${nomChamp} doit être un nombre entier de minutes`);
  return n;
}

// Statut -> type d'étape enregistré dans l'agenda (table etape).
// en_finition / en_preparation n'ont pas d'étape propre : les temps de
// ponçage, peinture et flocage sont saisis dans le bilan à la clôture.
const ETAPE_DU_STATUT = {
  accepte: 'acceptation',
  refuse: 'refus',
  en_impression: 'lancement_impression',
  pret: 'pret',
  termine: 'cloture',
};

// Début de la dernière impression (sert à la jauge % du composant SuiviProjet)
const SQL_DEBUT_IMPRESSION = `(SELECT max(e.date_debut) FROM etape e
   WHERE e.id_projet = p.id_projet AND e.type_etape = 'lancement_impression') AS debut_impression`;

// Prévenir le client (écran qui se rafraîchit + mail) et les autres admins
function prevenir(projet, message = '') {
  emitToUser(projet.id_auteur, 'projet:maj', { id_projet: projet.id_projet });
  emitToAdmins('projet:maj', { id_projet: projet.id_projet });
  envoyerMailSansAttendre(
    mailChangementStatut(projet.email_client, projet.titre, LIBELLES_STATUT[projet.statut], message),
  );
}

// Lit un projet + l'email de son auteur. FOR UPDATE (dans une transaction) :
// la ligne est verrouillée jusqu'au COMMIT, donc deux admins qui cliquent
// en même temps ne peuvent pas changer le statut chacun de leur côté.
async function lireProjetVerrouille(db, id) {
  const { rows } = await db.query(
    `SELECT p.*, u.email AS email_client
       FROM projet p JOIN utilisateur u ON u.id_utilisateur = p.id_auteur
      WHERE p.id_projet = $1
        FOR UPDATE OF p`,
    [id],
  );
  if (!rows[0]) throw erreur(404, 'Projet introuvable');
  return rows[0];
}

// ---------------------------------------------------------------------
// GET /api/admin/projets?statut=soumis -> liste pour l'onglet Suivi
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { statut } = req.query;
  if (statut !== undefined && !LIBELLES_STATUT[statut]) {
    throw erreur(400, `statut doit être : ${Object.keys(LIBELLES_STATUT).join(', ')}`);
  }

  const { rows } = await query(
    `SELECT p.id_projet, p.titre, p.categorie, p.cadre, p.statut, p.date_soumission, p.date_limite,
            p.progression_pct, p.fin_impression_prevue, ${SQL_DEBUT_IMPRESSION},
            json_build_object('id', u.id_utilisateur, 'email', u.email,
                              'prenom', u.prenom, 'nom', u.nom) AS client,
            pr.nom AS produit_nom, pr.couleur AS produit_couleur
       FROM projet p
       JOIN utilisateur u ON u.id_utilisateur = p.id_auteur
       JOIN produit pr    ON pr.id_produit = p.id_produit_choisi
      WHERE ($1::text IS NULL OR p.statut = $1)
      ORDER BY p.date_limite NULLS LAST, p.date_soumission`,
    [statut ?? null],
  );
  // statuts_suivants : les boutons que le front peut afficher (ex. ["accepte", "refuse"])
  res.json(rows.map((p) => ({ ...p, statuts_suivants: statutsSuivants(p.categorie, p.statut) })));
});

// ---------------------------------------------------------------------
// GET /api/admin/projets/agenda?du=2026-11-01&au=2026-11-30
// Par défaut : les 30 derniers jours jusqu'à aujourd'hui.
// (Déclarée AVANT /:id, sinon Express croirait que "agenda" est un id.)
// ---------------------------------------------------------------------
router.get('/agenda', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const { du, au } = req.query;
  if ((du && !date.test(du)) || (au && !date.test(au))) {
    throw erreur(400, 'Dates au format AAAA-MM-JJ');
  }

  const { rows } = await query(
    `SELECT e.id_etape, e.type_etape, e.date_debut, e.date_fin, e.commentaire,
            p.id_projet, p.titre, p.categorie, p.statut,
            a.prenom AS admin_prenom
       FROM etape e
       JOIN projet p           ON p.id_projet = e.id_projet
       LEFT JOIN utilisateur a ON a.id_utilisateur = e.id_admin
      WHERE e.date_debut >= COALESCE($1::date, current_date - 30)
        AND e.date_debut <  COALESCE($2::date, current_date) + 1
      ORDER BY e.date_debut`,
    [du || null, au || null],
  );
  res.json(rows);
});

// ---------------------------------------------------------------------
// GET /api/admin/projets/:id -> tout ce qu'il faut pour la fiche projet
// ---------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const id = lireId(req.params.id);
  const { rows } = await query(
    `SELECT p.*,
            json_build_object('id', u.id_utilisateur, 'email', u.email,
                              'prenom', u.prenom, 'nom', u.nom) AS client,
            pr.nom AS produit_nom, pr.couleur AS produit_couleur, ${SQL_DEBUT_IMPRESSION},
            (SELECT COALESCE(json_agg(json_build_object('id_fichier', f.id_fichier,
                     'nom_original', f.nom_original, 'type', f.type, 'taille_octets', f.taille_octets)
                     ORDER BY f.id_fichier), '[]')
               FROM fichier f WHERE f.id_projet = p.id_projet) AS fichiers,
            (SELECT COALESCE(json_agg(json_build_object('type_etape', e.type_etape,
                     'date_debut', e.date_debut, 'date_fin', e.date_fin,
                     'commentaire', e.commentaire, 'admin_prenom', a.prenom)
                     ORDER BY e.date_debut, e.id_etape), '[]')
               FROM etape e LEFT JOIN utilisateur a ON a.id_utilisateur = e.id_admin
              WHERE e.id_projet = p.id_projet) AS etapes
       FROM projet p
       JOIN utilisateur u ON u.id_utilisateur = p.id_auteur
       JOIN produit pr    ON pr.id_produit = p.id_produit_choisi
      WHERE p.id_projet = $1`,
    [id],
  );
  const projet = rows[0];
  if (!projet) throw erreur(404, 'Projet introuvable');

  const bilans = await chargerBilans([id]);
  res.json({
    ...projet,
    bilan: bilans[id] || null,
    statuts_suivants: statutsSuivants(projet.categorie, projet.statut),
  });
});

// ---------------------------------------------------------------------
// POST /api/admin/projets/:id/statut -> faire avancer le projet
//   { "statut": "accepte" }
//   { "statut": "refuse", "motif_refus": "Fichier .stl illisible" }
//   { "statut": "en_impression", "duree_min": 200 }   (lance le compte à rebours ;
//      le % reste vide : SuiviProjet le calcule tout seul avec l'heure de fin)
// Pour "termine", passer par /cloture (il faut le bilan).
// ---------------------------------------------------------------------
router.post('/:id/statut', async (req, res) => {
  const id = lireId(req.params.id);
  const { statut, commentaire } = req.body ?? {};
  const motif = String(req.body?.motif_refus ?? '').trim();
  const dureeMin = lireMinutes(req.body?.duree_min, 'duree_min');

  if (!LIBELLES_STATUT[statut]) throw erreur(400, 'Statut inconnu');
  if (statut === 'termine') throw erreur(400, 'Pour terminer un projet, utilise POST /:id/cloture');
  if (statut === 'refuse' && !motif) throw erreur(400, 'motif_refus obligatoire pour un refus');

  const projet = await transaction(async (db) => {
    const p = await lireProjetVerrouille(db, id);

    // La machine à états de services/statuts.js décide si le passage est permis
    if (!peutPasser(p.categorie, p.statut, statut)) {
      const possibles = statutsSuivants(p.categorie, p.statut);
      throw erreur(409, `Impossible de passer de « ${p.statut} » à « ${statut} »`
        + ` (possible : ${possibles.join(', ') || 'aucun'})`);
    }

    // On quitte l'impression : l'étape "lancement_impression" se termine maintenant
    if (p.statut === 'en_impression') {
      await db.query(
        `UPDATE etape SET date_fin = now()
          WHERE id_projet = $1 AND type_etape = 'lancement_impression' AND date_fin IS NULL`,
        [id],
      );
    }

    // Colonnes du projet à mettre à jour selon le nouveau statut
    const { rows } = await db.query(
      `UPDATE projet SET
          statut = $2::text,
          motif_refus = CASE WHEN $2::text = 'refuse' THEN $3 ELSE motif_refus END,
          progression_pct = CASE
              WHEN $2::text = 'en_impression' THEN NULL  -- NULL = % calculé par le front avec l'heure de fin
              WHEN statut = 'en_impression' THEN 100
              ELSE progression_pct END,
          fin_impression_prevue = CASE
              WHEN $2::text = 'en_impression' AND $4::int IS NOT NULL THEN now() + make_interval(mins => $4::int)
              ELSE fin_impression_prevue END
        WHERE id_projet = $1
        RETURNING *`,
      [id, statut, motif || null, dureeMin],
    );

    // L'impression reste "ouverte" (date_fin vide) ; les autres étapes sont instantanées
    const enCours = statut === 'en_impression';
    await db.query(
      `INSERT INTO etape (id_projet, id_admin, type_etape, date_fin, commentaire)
       VALUES ($1, $2, $3, CASE WHEN $4 THEN NULL ELSE now() END, $5)`,
      [id, req.user.id_utilisateur, ETAPE_DU_STATUT[statut], enCours, commentaire || motif || null],
    );

    return { ...rows[0], email_client: p.email_client };
  });

  prevenir(projet, statut === 'refuse' ? `Motif : ${motif}` : '');
  res.json({ ...projet, statuts_suivants: statutsSuivants(projet.categorie, projet.statut) });
});

// ---------------------------------------------------------------------
// PATCH /api/admin/projets/:id/avancement -> jauge % et compte à rebours
//   { "progression_pct": 60 }
//   { "fin_impression_prevue": "2026-11-26T14:30:00+01:00" }
// Seulement pendant l'impression (statut en_impression).
// ---------------------------------------------------------------------
router.patch('/:id/avancement', async (req, res) => {
  const id = lireId(req.params.id);
  const { progression_pct: pct, fin_impression_prevue: fin } = req.body ?? {};

  if (pct === undefined && fin === undefined) {
    throw erreur(400, 'Envoie progression_pct et/ou fin_impression_prevue');
  }
  if (pct !== undefined && !(Number.isInteger(pct) && pct >= 0 && pct <= 100)) {
    throw erreur(400, 'progression_pct : entier entre 0 et 100');
  }
  if (fin !== undefined && fin !== null && Number.isNaN(Date.parse(fin))) {
    throw erreur(400, 'fin_impression_prevue : date invalide (ex. 2026-11-26T14:30:00+01:00)');
  }

  // COALESCE($2, colonne) : si la valeur n'est pas envoyée, on garde l'ancienne
  const { rows } = await query(
    `UPDATE projet SET
        progression_pct       = COALESCE($2, progression_pct),
        fin_impression_prevue = CASE WHEN $3 THEN $4::timestamptz ELSE fin_impression_prevue END
      WHERE id_projet = $1 AND statut = 'en_impression'
      RETURNING *`,
    [id, pct ?? null, fin !== undefined, fin ?? null],
  );
  if (!rows[0]) {
    const existe = await query('SELECT 1 FROM projet WHERE id_projet = $1', [id]);
    throw existe.rowCount
      ? erreur(409, 'Le projet n\'est pas en impression')
      : erreur(404, 'Projet introuvable');
  }

  // Pas de mail pour un simple %, juste le rafraîchissement des écrans
  emitToUser(rows[0].id_auteur, 'projet:maj', { id_projet: id });
  emitToAdmins('projet:maj', { id_projet: id });
  res.json(rows[0]);
});

// ---------------------------------------------------------------------
// POST /api/admin/projets/:id/cloture -> « Projet fini »
// {
//   "consommations": [ { "id_produit": 2, "quantite": 140 },     // 140 g de PLA
//                      { "id_produit": 6, "quantite": 15 } ],    // 15 ml de peinture
//   "temps_impression_min": 200,
//   "temps_poncage_min": 45,        (absent = pas de ponçage)
//   "temps_peinture_min": 60        (absent = pas de peinture)
// }
// UNE transaction : si une seule étape échoue (stock insuffisant...), rien n'est enregistré.
// ---------------------------------------------------------------------
router.post('/:id/cloture', async (req, res) => {
  const id = lireId(req.params.id);
  const body = req.body ?? {};
  const tempsImpression = lireMinutes(body.temps_impression_min, 'temps_impression_min');
  const tempsPoncage = lireMinutes(body.temps_poncage_min, 'temps_poncage_min');
  const tempsPeinture = lireMinutes(body.temps_peinture_min, 'temps_peinture_min');

  // Vérifier la liste des consommations avant de toucher à la base
  const consommations = body.consommations;
  if (!Array.isArray(consommations) || consommations.length === 0) {
    throw erreur(400, 'consommations : liste obligatoire, ex. [{ "id_produit": 2, "quantite": 140 }]');
  }
  const dejaVus = new Set();
  for (const c of consommations) {
    const idProduit = lireId(c?.id_produit);
    if (!(typeof c.quantite === 'number' && c.quantite > 0)) {
      throw erreur(400, `Quantité invalide pour le produit ${idProduit}`);
    }
    if (dejaVus.has(idProduit)) throw erreur(400, `Produit ${idProduit} en double : additionne les quantités`);
    dejaVus.add(idProduit);
  }

  const projet = await transaction(async (db) => {
    const p = await lireProjetVerrouille(db, id);
    if (!peutPasser(p.categorie, p.statut, 'termine')) {
      throw erreur(409, `Seul un projet « pret » peut être clôturé (statut actuel : ${p.statut})`);
    }
    if (p.categorie === 'tee_shirt' && tempsImpression !== null) {
      throw erreur(400, 'Pas de temps d\'impression pour un tee-shirt');
    }

    // 1. Retirer du stock, produit par produit. "quantite_stock >= $2" : si le
    //    stock ne suffit pas, aucune ligne n'est modifiée -> on annule tout.
    //    RETURNING donne le prix actuel, qu'on va figer dans la consommation.
    const lignes = [];
    for (const c of consommations) {
      const { rows } = await db.query(
        `UPDATE produit SET quantite_stock = quantite_stock - $2
          WHERE id_produit = $1 AND est_consommable AND quantite_stock >= $2
          RETURNING id_produit, nom, couleur, unite_prix, prix_centimes`,
        [c.id_produit, c.quantite],
      );
      if (!rows[0]) {
        const { rows: existe } = await db.query(
          'SELECT nom, couleur, quantite_stock FROM produit WHERE id_produit = $1 AND est_consommable',
          [c.id_produit],
        );
        if (!existe[0]) throw erreur(400, `Consommable ${c.id_produit} introuvable`);
        const { nom, couleur, quantite_stock: reste } = existe[0];
        throw erreur(409, `Stock insuffisant : ${nom} ${couleur ?? ''} (reste ${reste}, demandé ${c.quantite})`);
      }
      lignes.push({ ...rows[0], quantite: c.quantite });
    }

    // 2. Le bilan. Prix total = somme des lignes (services/prix.js).
    //    Délai de livraison = jours entre la soumission et aujourd'hui.
    const prixTotal = lignes.reduce(
      (total, l) => total + prixLigneCentimes(l.unite_prix, l.prix_centimes, l.quantite), 0,
    );
    const { rows: [bilan] } = await db.query(
      `INSERT INTO bilan (id_projet, temps_impression_min, poncage_fait, temps_poncage_min,
                          peinture_faite, temps_peinture_min, delai_livraison_jours, prix_total_centimes)
       VALUES ($1, $2, $3, $4, $5, $6, current_date - $7::date, $8)
       RETURNING id_bilan`,
      [id, tempsImpression, tempsPoncage !== null, tempsPoncage,
        tempsPeinture !== null, tempsPeinture, p.date_soumission, prixTotal],
    );

    // 3. Les consommations, avec le prix FIGÉ : si le prix du PLA change
    //    demain, ce bilan restera juste.
    for (const l of lignes) {
      await db.query(
        `INSERT INTO consommation (id_bilan, id_produit, quantite, prix_unitaire_centimes)
         VALUES ($1, $2, $3, $4)`,
        [bilan.id_bilan, l.id_produit, l.quantite, l.prix_centimes],
      );
    }

    // 4. Statut + 5. étape "cloture" dans l'agenda
    const { rows } = await db.query(
      `UPDATE projet SET statut = 'termine' WHERE id_projet = $1 RETURNING *`,
      [id],
    );
    await db.query(
      `INSERT INTO etape (id_projet, id_admin, type_etape, date_fin) VALUES ($1, $2, 'cloture', now())`,
      [id, req.user.id_utilisateur],
    );

    return { ...rows[0], email_client: p.email_client };
  });

  prevenir(projet, 'Votre projet est terminé, vous pouvez laisser un avis !');
  const bilans = await chargerBilans([id]);
  res.status(201).json({ ...projet, bilan: bilans[id] });
});

export default router;
