// =====================================================================
// routes/stock.js — Stock des CONSOMMABLES (table "produit", est_consommable = true)
//
// Le matériel (imprimantes...) n'a pas de stock : il est invisible ici.
//
// Routes :
//   GET   /api/stock                 -> liste des consommables (option : ?categorie=filament)
//   GET   /api/stock/:consommable    -> un consommable
//   POST  /api/stock                 -> créer un consommable
//   POST  /api/stock/:consommable    -> ajouter / retirer du stock  { "quantite": 500 } ou { "quantite": -140 }
//   PATCH /api/stock/:consommable    -> modifier nom, prix, couleur, est_actif...
//
// Pas de DELETE : un consommable déjà utilisé dans un projet ou une consommation
// ne peut pas être supprimé (ON DELETE RESTRICT). On le désactive avec
// PATCH { "est_actif": false }.
// =====================================================================

import { Router } from "express";
import pool from "../../db.js"; // ton Pool pg (adapte le chemin si besoin)

const router = Router();

const CATEGORIES = ["filament", "peinture", "tee_shirt"]; // "materiel" exclu

// ---------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------

// Vérifie que :consommable est bien un entier positif ("12" ok, "abc" ou "-3" non)
function lireId(req, res) {
    const id = Number(req.params.consommable);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ erreur: "Identifiant de consommable invalide" });
        return null;
    }
    return id;
}

// Traduit les erreurs PostgreSQL en réponses HTTP compréhensibles
function gererErreur(err, res) {
    if (err.code === "23514") {
        // violation d'un CHECK (stock négatif, unité inconnue, prix négatif...)
        return res.status(400).json({ erreur: "Donnée refusée par la base", contrainte: err.constraint });
    }
    if (err.code === "23502") {
        // NOT NULL : un champ obligatoire est absent
        return res.status(400).json({ erreur: `Champ obligatoire manquant : ${err.column}` });
    }
    if (err.code === "22P02") {
        // mauvais type (ex. "abc" envoyé à la place d'un nombre)
        return res.status(400).json({ erreur: "Format de donnée invalide" });
    }
    console.error(err);
    return res.status(500).json({ erreur: "Erreur serveur" });
}

// ---------------------------------------------------------------------
// Fonctions d'accès à la base (une fonction = une requête SQL)
// Toutes filtrent sur est_consommable = true.
// ---------------------------------------------------------------------

async function listerConsommables(categorie) {
    // ($1::text IS NULL OR categorie = $1) = "si pas de filtre, on prend tout"
    const { rows } = await pool.query(
        `SELECT * FROM produit
      WHERE est_consommable
        AND ($1::text IS NULL OR categorie = $1)
      ORDER BY categorie, nom, couleur`,
        [categorie ?? null]
    );
    return rows;
}

async function trouverConsommable(id) {
    const { rows } = await pool.query(
        `SELECT * FROM produit WHERE id_produit = $1 AND est_consommable`,
        [id]
    );
    return rows[0] ?? null; // null si absent OU si c'est du matériel
}

async function creerConsommable(c) {
    const { rows } = await pool.query(
        `INSERT INTO produit (nom, categorie, couleur, est_consommable, unite_prix, prix_centimes, quantite_stock)
     VALUES ($1, $2, $3, true, $4, $5, COALESCE($6, 0))
     RETURNING *`,
        [c.nom, c.categorie, c.couleur ?? null, c.unite_prix, c.prix_centimes, c.quantite_stock ?? null]
    );
    return rows[0];
}

// Ajoute (quantite > 0) ou retire (quantite < 0) du stock.
// Le calcul est fait PAR POSTGRES ("quantite_stock + $2") : si deux admins
// cliquent en même temps, aucune mise à jour n'est perdue.
// Si le résultat passe sous 0, le CHECK ck_stock refuse -> erreur 400.
async function ajusterStock(id, quantite) {
    const { rows } = await pool.query(
        `UPDATE produit
        SET quantite_stock = quantite_stock + $2
      WHERE id_produit = $1 AND est_consommable
      RETURNING *`,
        [id, quantite]
    );
    return rows[0] ?? null;
}

// COALESCE($x, colonne) = "si le champ n'est pas envoyé, on garde l'ancienne valeur".
// La quantité n'est volontairement PAS modifiable ici : elle passe par ajusterStock.
async function modifierConsommable(id, c) {
    const { rows } = await pool.query(
        `UPDATE produit
        SET nom           = COALESCE($2, nom),
            categorie     = COALESCE($3, categorie),
            couleur       = COALESCE($4, couleur),
            unite_prix    = COALESCE($5, unite_prix),
            prix_centimes = COALESCE($6, prix_centimes),
            est_actif     = COALESCE($7, est_actif)
      WHERE id_produit = $1 AND est_consommable
      RETURNING *`,
        [id, c.nom ?? null, c.categorie ?? null, c.couleur ?? null,
            c.unite_prix ?? null, c.prix_centimes ?? null, c.est_actif ?? null]
    );
    return rows[0] ?? null;
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------

// GET /api/stock            GET /api/stock?categorie=filament
router.get("/", async (req, res) => {
    const { categorie } = req.query;
    if (categorie && !CATEGORIES.includes(categorie)) {
        return res.status(400).json({ erreur: `categorie doit être : ${CATEGORIES.join(", ")}` });
    }
    try {
        res.json(await listerConsommables(categorie));
    } catch (err) {
        gererErreur(err, res);
    }
});

// GET /api/stock/:consommable
router.get("/:consommable", async (req, res) => {
    const id = lireId(req, res);
    if (id === null) return;
    try {
        const consommable = await trouverConsommable(id);
        if (!consommable) return res.status(404).json({ erreur: "Consommable introuvable" });
        res.json(consommable);
    } catch (err) {
        gererErreur(err, res);
    }
});

// POST /api/stock
router.post("/", async (req, res) => {
    const { nom, categorie, unite_prix, prix_centimes } = req.body ?? {};
    if (!nom || !unite_prix || prix_centimes === undefined) {
        return res.status(400).json({ erreur: "nom, categorie, unite_prix et prix_centimes sont obligatoires" });
    }
    if (!CATEGORIES.includes(categorie)) {
        return res.status(400).json({ erreur: `categorie doit être : ${CATEGORIES.join(", ")}` });
    }
    try {
        res.status(201).json(await creerConsommable(req.body));
    } catch (err) {
        gererErreur(err, res);
    }
});

// POST /api/stock/:consommable   body : { "quantite": 500 }  ou  { "quantite": -140 }
router.post("/:consommable", async (req, res) => {
    const id = lireId(req, res);
    if (id === null) return;

    const quantite = Number(req.body?.quantite);
    if (!Number.isFinite(quantite) || quantite === 0) {
        return res.status(400).json({ erreur: "quantite doit être un nombre non nul" });
    }
    try {
        const consommable = await ajusterStock(id, quantite);
        if (!consommable) return res.status(404).json({ erreur: "Consommable introuvable" });
        res.json(consommable);
    } catch (err) {
        if (err.constraint === "ck_stock") {
            return res.status(400).json({ erreur: "Stock insuffisant pour ce retrait" });
        }
        gererErreur(err, res);
    }
});

// PATCH /api/stock/:consommable   body : { "prix_centimes": 2800 }  ou  { "est_actif": false }
router.patch("/:consommable", async (req, res) => {
    const id = lireId(req, res);
    if (id === null) return;
    const body = req.body ?? {};
    if ("quantite_stock" in body) {
        return res.status(400).json({ erreur: "Pour changer la quantité, utilise POST /api/stock/:consommable" });
    }
    if (body.categorie !== undefined && !CATEGORIES.includes(body.categorie)) {
        return res.status(400).json({ erreur: `categorie doit être : ${CATEGORIES.join(", ")}` });
    }
    try {
        const consommable = await modifierConsommable(id, body);
        if (!consommable) return res.status(404).json({ erreur: "Consommable introuvable" });
        res.json(consommable);
    } catch (err) {
        gererErreur(err, res);
    }
});

export default router;