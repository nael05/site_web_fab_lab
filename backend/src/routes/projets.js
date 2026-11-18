// Projets côté client
//   GET  /api/projets/mes                         -> mes projets (+ fichiers, bilan, avis)
//   POST /api/projets                             -> soumettre (multipart, champ "fichiers")
//   GET  /api/projets/:id/fichiers/:idFichier     -> télécharger un fichier (auteur ou admin)
import { Router } from 'express';
import path from 'node:path';
import { query, transaction } from '../db.js';
import { requireAuth, requireClient } from '../middleware/auth.js';
import { uploadProjet, cheminRelatif, cheminAbsolu, supprimerFichiers } from '../middleware/upload.js';
import { chargerBilans } from '../services/bilan.js';
import { envoyerMailSansAttendre, mailDepotProjet } from '../services/mail.js';
import { emitToAdmins } from '../realtime.js';

const router = Router();

export const TAILLE_MAX_MM = 260; // plateau imprimante : au-delà, plusieurs .stl obligatoires

router.get('/mes', requireAuth, requireClient, async (req, res) => {
  const { rows: projets } = await query(
    `SELECT p.*, pr.nom AS produit_nom, pr.couleur AS produit_couleur,
            (SELECT max(date_debut) FROM etape e
              WHERE e.id_projet = p.id_projet AND e.type_etape = 'lancement_impression') AS debut_impression,
            (SELECT COALESCE(json_agg(json_build_object('id_fichier', f.id_fichier, 'nom_original', f.nom_original,
                     'type', f.type, 'taille_octets', f.taille_octets) ORDER BY f.id_fichier), '[]')
               FROM fichier f WHERE f.id_projet = p.id_projet) AS fichiers,
            EXISTS (SELECT 1 FROM avis a WHERE a.id_projet = p.id_projet) AS a_un_avis
       FROM projet p
       JOIN produit pr ON pr.id_produit = p.id_produit_choisi
      WHERE p.id_auteur = $1
      ORDER BY p.date_soumission DESC`,
    [req.user.id_utilisateur],
  );
  const bilans = await chargerBilans(projets.filter((p) => p.statut === 'termine').map((p) => p.id_projet));
  res.json(projets.map((p) => ({ ...p, bilan: bilans[p.id_projet] || null })));
});

// ---------- Soumission ----------

const bool = (v) => v === true || v === 'true' || v === 'on' || v === '1';
const entier = (v) => (v === undefined || v === '' ? null : Number.parseInt(v, 10));

// Vérifie le formulaire. Renvoie { erreur } ou { projet } prêt à insérer
function validerProjet(b, fichiers) {
  const categorie = b.categorie;
  const est3d = categorie === 'impression_3d';
  if (!['impression_3d', 'tee_shirt'].includes(categorie)) return { erreur: 'Catégorie invalide' };
  if (!['ydays', 'scolaire', 'perso'].includes(b.cadre)) return { erreur: 'Cadre invalide' };

  const titre = String(b.titre || '').trim();
  const description = String(b.description || '').trim();
  if (!titre || titre.length > 120) return { erreur: 'Titre obligatoire (120 caractères max)' };
  if (!description) return { erreur: 'Description obligatoire' };

  const nbStl = fichiers.filter((f) => f.type === 'stl').length;
  const nbVisuels = fichiers.length - nbStl;

  const p = {
    titre, description, categorie, cadre: b.cadre,
    id_produit_choisi: entier(b.id_produit_choisi),
    date_limite: b.date_limite || null,
    niveau_detail: null, longueur_mm: null, largeur_mm: null, hauteur_mm: null,
    solidite_pct: null, usage_mecanique: null,
    poncage_demande: false, peinture_demandee: false,
    participe_lancement: false, participe_poncage: false, participe_peinture: false, participe_flocage: false,
  };
  if (!p.id_produit_choisi) return { erreur: est3d ? 'Choisissez une couleur de filament' : 'Choisissez un tee-shirt' };
  if (p.date_limite && (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_limite) || p.date_limite < new Date().toISOString().slice(0, 10))) {
    return { erreur: 'Date limite invalide ou passée' };
  }

  if (est3d) {
    Object.assign(p, {
      niveau_detail: entier(b.niveau_detail),
      longueur_mm: entier(b.longueur_mm),
      largeur_mm: entier(b.largeur_mm),
      hauteur_mm: entier(b.hauteur_mm),
      solidite_pct: entier(b.solidite_pct),
      usage_mecanique: String(b.usage_mecanique || '').trim() || null,
      poncage_demande: bool(b.poncage_demande),
      peinture_demandee: bool(b.peinture_demandee),
      participe_lancement: bool(b.participe_lancement),
      participe_poncage: bool(b.participe_poncage),
      participe_peinture: bool(b.participe_peinture),
    });
    if (!(p.niveau_detail >= 1 && p.niveau_detail <= 5)) return { erreur: 'Niveau de détail entre 1 et 5' };
    if (!(p.solidite_pct >= 0 && p.solidite_pct <= 100)) return { erreur: 'Solidité entre 0 et 100 %' };
    const dims = [p.longueur_mm, p.largeur_mm, p.hauteur_mm];
    if (dims.some((d) => !(d > 0 && d <= 10000))) return { erreur: 'Dimensions invalides (en mm)' };
    if (nbStl < 1) return { erreur: 'Ajoutez au moins un fichier .stl' };
    // Règle métier : > 26 cm sur un côté = pièce découpée en plusieurs .stl
    if (Math.max(...dims) > TAILLE_MAX_MM && nbStl < 2) {
      return { erreur: 'Pièce > 26 cm : fournissez-la découpée en plusieurs fichiers .stl' };
    }
  } else {
    p.participe_flocage = bool(b.participe_flocage);
    if (nbStl > 0) return { erreur: 'Pas de fichier .stl pour un tee-shirt' };
    if (nbVisuels < 1) return { erreur: 'Ajoutez au moins un visuel à floquer' };
  }
  return { projet: p };
}

router.post('/', requireAuth, requireClient, uploadProjet.array('fichiers', 10), async (req, res) => {
  const fichiers = (req.files || []).map((f) => ({
    ...f,
    type: path.extname(f.originalname).toLowerCase() === '.stl' ? 'stl' : 'visuel',
  }));

  try {
    const { erreur, projet: p } = validerProjet(req.body, fichiers);
    if (erreur) throw Object.assign(new Error(erreur), { status: 400 });

    // Le produit doit être actif, consommable, en stock et de la bonne catégorie
    const categorieProduit = p.categorie === 'impression_3d' ? 'filament' : 'tee_shirt';
    const { rowCount } = await query(
      `SELECT 1 FROM produit WHERE id_produit = $1 AND categorie = $2
         AND est_actif AND est_consommable AND quantite_stock > 0`,
      [p.id_produit_choisi, categorieProduit],
    );
    if (!rowCount) throw Object.assign(new Error('Produit indisponible, choisissez-en un autre'), { status: 400 });

    const projet = await transaction(async (db) => {
      const colonnes = Object.keys(p);
      const { rows } = await db.query(
        `INSERT INTO projet (id_auteur, ${colonnes.join(', ')})
         VALUES ($1, ${colonnes.map((_, i) => `$${i + 2}`).join(', ')})
         RETURNING *`,
        [req.user.id_utilisateur, ...Object.values(p)],
      );
      const projet = rows[0];
      for (const f of fichiers) {
        await db.query(
          `INSERT INTO fichier (id_projet, nom_original, chemin, type, taille_octets) VALUES ($1, $2, $3, $4, $5)`,
          [projet.id_projet, f.originalname.slice(0, 255), cheminRelatif(f), f.type, f.size],
        );
      }
      await db.query(`INSERT INTO etape (id_projet, type_etape) VALUES ($1, 'soumission')`, [projet.id_projet]);
      return projet;
    });

    envoyerMailSansAttendre(mailDepotProjet(req.user.email, projet.titre));
    emitToAdmins('projet:nouveau', { id_projet: projet.id_projet });
    res.status(201).json(projet);
  } catch (err) {
    supprimerFichiers(fichiers);
    throw err;
  }
});

// ---------- Téléchargement ----------

router.get('/:id/fichiers/:idFichier', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT f.chemin, f.nom_original, p.id_auteur
       FROM fichier f JOIN projet p USING (id_projet)
      WHERE f.id_fichier = $1 AND f.id_projet = $2`,
    [entier(req.params.idFichier), entier(req.params.id)],
  );
  const f = rows[0];
  if (!f || (f.id_auteur !== req.user.id_utilisateur && req.user.role !== 'admin')) {
    return res.status(404).json({ erreur: 'Fichier introuvable' });
  }
  res.download(cheminAbsolu(f.chemin), f.nom_original);
});

export default router;
