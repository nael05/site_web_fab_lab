-- =====================================================================
-- init.sql — BDD Fab Lab Ydays (PostgreSQL 14+), conforme au MPD v1
-- Docker l'exécute tout seul au 1er démarrage (volume vide).
-- Repartir de zéro : docker compose down -v && docker compose up -d
-- =====================================================================

BEGIN;

-- 1. UTILISATEUR : comptes @ynov.com (client ou admin)
CREATE TABLE utilisateur (
  id_utilisateur  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email           VARCHAR(254) NOT NULL UNIQUE,
  nom             VARCHAR(80),
  prenom          VARCHAR(80),
  role            VARCHAR(10)  NOT NULL DEFAULT 'client',
  est_verifie     BOOLEAN      NOT NULL DEFAULT false,
  date_creation   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_role       CHECK (role IN ('client', 'admin')),
  CONSTRAINT ck_email_ynov CHECK (email LIKE '%@ynov.com')
);

-- 2. CODE_OTP : codes envoyés par mail (on stocke le hash, jamais le code)
CREATE TABLE code_otp (
  id_otp           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_utilisateur   INTEGER      NOT NULL REFERENCES utilisateur ON DELETE CASCADE,
  code_hash        VARCHAR(255) NOT NULL,
  date_expiration  TIMESTAMPTZ  NOT NULL,
  nb_tentatives    SMALLINT     NOT NULL DEFAULT 0,
  est_utilise      BOOLEAN      NOT NULL DEFAULT false,
  CONSTRAINT ck_tentatives CHECK (nb_tentatives BETWEEN 0 AND 5)
);

-- 3. CONVERSATION : 1 seul fil par client
CREATE TABLE conversation (
  id_conversation  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_client        INTEGER     NOT NULL UNIQUE REFERENCES utilisateur ON DELETE CASCADE,
  date_creation    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. MESSAGE : chat client <-> admins
CREATE TABLE message (
  id_message       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_conversation  INTEGER      NOT NULL REFERENCES conversation ON DELETE CASCADE,
  id_auteur        INTEGER      NOT NULL REFERENCES utilisateur ON DELETE RESTRICT,
  contenu          TEXT,
  piece_jointe     VARCHAR(500),               -- chemin relatif dans uploads/
  date_envoi       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_message_non_vide CHECK (contenu IS NOT NULL OR piece_jointe IS NOT NULL)
);

-- 5. PRODUIT : stock (consommables + matériel)
--    prix en centimes, par kg / ml / unité ; stock en g / ml / unités
CREATE TABLE produit (
  id_produit       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom              VARCHAR(120)  NOT NULL,
  categorie        VARCHAR(20)   NOT NULL,
  couleur          VARCHAR(40),
  est_consommable  BOOLEAN       NOT NULL,
  unite_prix       VARCHAR(5),
  prix_centimes    INTEGER,
  quantite_stock   NUMERIC(10,2) NOT NULL DEFAULT 0,
  est_actif        BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT ck_categorie CHECK (categorie IN ('filament', 'peinture', 'tee_shirt', 'materiel')),
  CONSTRAINT ck_unite     CHECK (unite_prix IN ('kg', 'ml', 'unite')),
  CONSTRAINT ck_prix      CHECK (prix_centimes >= 0),
  CONSTRAINT ck_stock     CHECK (quantite_stock >= 0),
  CONSTRAINT ck_tarif_si_consommable CHECK (
       (est_consommable AND unite_prix IS NOT NULL AND prix_centimes IS NOT NULL)
    OR (NOT est_consommable AND unite_prix IS NULL AND prix_centimes IS NULL)
  )
);

-- 6. PROJET : demandes clients (impression 3D ou flocage)
CREATE TABLE projet (
  id_projet              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_auteur              INTEGER      NOT NULL REFERENCES utilisateur ON DELETE RESTRICT,
  id_produit_choisi      INTEGER      NOT NULL REFERENCES produit ON DELETE RESTRICT,
  titre                  VARCHAR(120) NOT NULL,
  categorie              VARCHAR(20)  NOT NULL,
  cadre                  VARCHAR(20)  NOT NULL,
  description            TEXT         NOT NULL,
  statut                 VARCHAR(20)  NOT NULL DEFAULT 'soumis',
  niveau_detail          SMALLINT,
  longueur_mm            SMALLINT,
  largeur_mm             SMALLINT,
  hauteur_mm             SMALLINT,
  solidite_pct           SMALLINT,
  usage_mecanique        TEXT,
  poncage_demande        BOOLEAN      NOT NULL DEFAULT false,
  peinture_demandee      BOOLEAN      NOT NULL DEFAULT false,
  date_limite            DATE,
  participe_lancement    BOOLEAN      NOT NULL DEFAULT false,
  participe_poncage      BOOLEAN      NOT NULL DEFAULT false,
  participe_peinture     BOOLEAN      NOT NULL DEFAULT false,
  participe_flocage      BOOLEAN      NOT NULL DEFAULT false,
  progression_pct        SMALLINT,
  fin_impression_prevue  TIMESTAMPTZ,                -- sert au compte à rebours
  motif_refus            TEXT,
  date_soumission        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_categorie   CHECK (categorie IN ('impression_3d', 'tee_shirt')),
  CONSTRAINT ck_cadre       CHECK (cadre IN ('ydays', 'scolaire', 'perso')),
  CONSTRAINT ck_statut      CHECK (statut IN ('soumis', 'accepte', 'refuse', 'en_impression',
                                              'en_finition', 'en_preparation', 'pret', 'termine')),
  CONSTRAINT ck_niveau      CHECK (niveau_detail BETWEEN 1 AND 5),
  CONSTRAINT ck_dimensions  CHECK (longueur_mm > 0 AND largeur_mm > 0 AND hauteur_mm > 0),
  CONSTRAINT ck_solidite    CHECK (solidite_pct BETWEEN 0 AND 100),
  CONSTRAINT ck_progression CHECK (progression_pct BETWEEN 0 AND 100),
  CONSTRAINT ck_tee_shirt_sans_3d CHECK (
       categorie = 'impression_3d'
    OR (niveau_detail IS NULL AND longueur_mm IS NULL AND largeur_mm IS NULL
        AND hauteur_mm IS NULL AND solidite_pct IS NULL)
  )
);

-- 7. FICHIER : fichiers déposés (.stl ou visuel)
CREATE TABLE fichier (
  id_fichier     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_projet      INTEGER      NOT NULL REFERENCES projet ON DELETE CASCADE,
  nom_original   VARCHAR(255) NOT NULL,
  chemin         VARCHAR(500) NOT NULL,
  type           VARCHAR(10)  NOT NULL,
  taille_octets  BIGINT       NOT NULL,
  date_depot     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_type   CHECK (type IN ('stl', 'visuel')),
  CONSTRAINT ck_taille CHECK (taille_octets > 0)
);

-- 8. ETAPE : historique des étapes = agenda interne admin
CREATE TABLE etape (
  id_etape     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_projet    INTEGER     NOT NULL REFERENCES projet ON DELETE CASCADE,
  id_admin     INTEGER     REFERENCES utilisateur ON DELETE SET NULL,
  type_etape   VARCHAR(25) NOT NULL,
  date_debut   TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_fin     TIMESTAMPTZ,
  commentaire  TEXT,
  CONSTRAINT ck_type_etape CHECK (type_etape IN ('soumission', 'acceptation', 'refus',
                                  'lancement_impression', 'poncage', 'peinture', 'flocage',
                                  'pret', 'cloture')),
  CONSTRAINT ck_dates CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- 9. BILAN : saisi par l'admin à la clôture « Projet fini »
CREATE TABLE bilan (
  id_bilan               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_projet              INTEGER     NOT NULL UNIQUE REFERENCES projet ON DELETE RESTRICT,
  temps_impression_min   INTEGER,
  poncage_fait           BOOLEAN     NOT NULL DEFAULT false,
  temps_poncage_min      INTEGER,
  peinture_faite         BOOLEAN     NOT NULL DEFAULT false,
  temps_peinture_min     INTEGER,
  delai_livraison_jours  SMALLINT,
  prix_total_centimes    INTEGER     NOT NULL,
  date_cloture           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_temps CHECK (
        (temps_impression_min  IS NULL OR temps_impression_min  >= 0)
    AND (temps_poncage_min     IS NULL OR temps_poncage_min     >= 0)
    AND (temps_peinture_min    IS NULL OR temps_peinture_min    >= 0)
    AND (delai_livraison_jours IS NULL OR delai_livraison_jours >= 0)
  ),
  CONSTRAINT ck_poncage     CHECK (poncage_fait OR temps_poncage_min IS NULL),
  CONSTRAINT ck_peinture    CHECK (peinture_faite OR temps_peinture_min IS NULL),
  CONSTRAINT ck_prix_total  CHECK (prix_total_centimes >= 0)
);

-- 10. CONSOMMATION : produits consommés par un bilan (prix figé au moment de la clôture)
CREATE TABLE consommation (
  id_bilan                INTEGER       NOT NULL REFERENCES bilan ON DELETE CASCADE,
  id_produit              INTEGER       NOT NULL REFERENCES produit ON DELETE RESTRICT,
  quantite                NUMERIC(10,2) NOT NULL,
  prix_unitaire_centimes  INTEGER       NOT NULL,
  PRIMARY KEY (id_bilan, id_produit),
  CONSTRAINT ck_quantite  CHECK (quantite > 0),
  CONSTRAINT ck_prix_fige CHECK (prix_unitaire_centimes >= 0)
);

-- 11. PUBLICATION : fiche publique d'un projet dans le Portfolio
CREATE TABLE publication (
  id_publication        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_projet             INTEGER     NOT NULL UNIQUE REFERENCES projet ON DELETE CASCADE,
  description_publique  TEXT        NOT NULL,
  date_publication      TIMESTAMPTZ,              -- NULL tant que pas publiée
  est_visible           BOOLEAN     NOT NULL DEFAULT false
);

-- 12. PHOTO : photos d'une publication
CREATE TABLE photo (
  id_photo        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_publication  INTEGER      NOT NULL REFERENCES publication ON DELETE CASCADE,
  chemin          VARCHAR(500) NOT NULL,
  legende         VARCHAR(200),
  ordre           SMALLINT     NOT NULL DEFAULT 0
);

-- 13. AVIS : 1 avis max par projet terminé
CREATE TABLE avis (
  id_avis      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_projet    INTEGER     NOT NULL UNIQUE REFERENCES projet ON DELETE CASCADE,
  note         SMALLINT    NOT NULL,
  commentaire  TEXT,
  date_avis    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_note CHECK (note BETWEEN 1 AND 5)
);

-- INDEX sur les clés étrangères (Postgres ne les crée pas tout seul)
CREATE INDEX idx_code_otp_utilisateur ON code_otp (id_utilisateur);
CREATE INDEX idx_message_conversation ON message (id_conversation, date_envoi);
CREATE INDEX idx_message_auteur       ON message (id_auteur);
CREATE INDEX idx_projet_auteur        ON projet (id_auteur);
CREATE INDEX idx_projet_produit       ON projet (id_produit_choisi);
CREATE INDEX idx_projet_statut        ON projet (statut);
CREATE INDEX idx_fichier_projet       ON fichier (id_projet);
CREATE INDEX idx_etape_projet         ON etape (id_projet, date_debut);
CREATE INDEX idx_etape_admin          ON etape (id_admin);
CREATE INDEX idx_consommation_produit ON consommation (id_produit);
CREATE INDEX idx_photo_publication    ON photo (id_publication, ordre);

COMMIT;


-- =====================================================================
-- DONNÉES DE DÉMO (pour tester en local — à supprimer en prod)
-- Comptes : admin.fablab@ynov.com (admin), etudiant.demo@ynov.com et
-- camille.martin@ynov.com (clients). Le code OTP s'affiche dans la
-- console du back tant que BREVO_API_KEY est vide.
-- =====================================================================
BEGIN;

INSERT INTO utilisateur (email, prenom, nom, role, est_verifie) VALUES
  ('admin.fablab@ynov.com',   'Admin',    'Fab Lab', 'admin',  true),
  ('etudiant.demo@ynov.com',  'Etudiant', 'Demo',    'client', true),
  ('camille.martin@ynov.com', 'Camille',  'Martin',  'client', true);

-- Stock : filament en €/kg (stock en g), peinture en €/ml, tee-shirts à l'unité
INSERT INTO produit (nom, categorie, couleur, est_consommable, unite_prix, prix_centimes, quantite_stock) VALUES
  ('Bobine PLA',             'filament',  'Noir',  true,  'kg',    2500, 2000),
  ('Bobine PLA',             'filament',  'Blanc', true,  'kg',    2500, 1860),
  ('Bobine PLA',             'filament',  'Rouge', true,  'kg',    2700, 1000),
  ('Bobine PETG',            'filament',  'Bleu',  true,  'kg',    3000, 750),
  ('Bobine PLA',             'filament',  'Vert',  true,  'kg',    2500, 0),     -- rupture : non proposé
  ('Peinture acrylique',     'peinture',  'Noir',  true,  'ml',    10,   485),
  ('Peinture acrylique',     'peinture',  'Blanc', true,  'ml',    10,   500),
  ('Tee-shirt coton taille M','tee_shirt', 'Blanc', true,  'unite', 600,  19),
  ('Tee-shirt coton taille L','tee_shirt', 'Noir',  true,  'unite', 650,  15);
INSERT INTO produit (nom, categorie, est_consommable) VALUES
  ('Imprimante Bambu Lab P1S', 'materiel', false);

-- Projets de démo (sous-requêtes pour ne pas dépendre des id)
INSERT INTO projet (id_auteur, id_produit_choisi, titre, categorie, cadre, description, statut,
                    niveau_detail, longueur_mm, largeur_mm, hauteur_mm, solidite_pct,
                    poncage_demande, peinture_demandee, date_soumission)
VALUES
  ((SELECT id_utilisateur FROM utilisateur WHERE email = 'etudiant.demo@ynov.com'),
   (SELECT id_produit FROM produit WHERE nom = 'Bobine PLA' AND couleur = 'Blanc'),
   'Figurine dragon', 'impression_3d', 'ydays',
   'Figurine de dragon pour le stand Ydays, finition peinte à la main.', 'termine',
   4, 120, 80, 150, 20, true, true, now() - interval '12 days');

INSERT INTO projet (id_auteur, id_produit_choisi, titre, categorie, cadre, description, statut,
                    niveau_detail, longueur_mm, largeur_mm, hauteur_mm, solidite_pct, usage_mecanique,
                    progression_pct, fin_impression_prevue, date_limite, date_soumission)
VALUES
  ((SELECT id_utilisateur FROM utilisateur WHERE email = 'etudiant.demo@ynov.com'),
   (SELECT id_produit FROM produit WHERE nom = 'Bobine PETG' AND couleur = 'Bleu'),
   'Support de téléphone', 'impression_3d', 'scolaire',
   'Support de téléphone articulé pour un projet de cours.', 'en_impression',
   3, 90, 70, 110, 40, 'Doit supporter un téléphone de 200 g.',
   40, now() + interval '2 hours', current_date + 10, now() - interval '3 days');

INSERT INTO projet (id_auteur, id_produit_choisi, titre, categorie, cadre, description, statut,
                    participe_flocage, date_soumission)
VALUES
  ((SELECT id_utilisateur FROM utilisateur WHERE email = 'etudiant.demo@ynov.com'),
   (SELECT id_produit FROM produit WHERE nom = 'Tee-shirt coton taille L'),
   'Tee-shirt BDE', 'tee_shirt', 'perso',
   'Logo du BDE en blanc au centre, 25 cm de large.', 'en_preparation',
   true, now() - interval '2 days'),
  ((SELECT id_utilisateur FROM utilisateur WHERE email = 'camille.martin@ynov.com'),
   (SELECT id_produit FROM produit WHERE nom = 'Tee-shirt coton taille M'),
   'Tee-shirt équipe Ydays', 'tee_shirt', 'ydays',
   'Flocage du logo de l''équipe dans le dos.', 'termine',
   false, now() - interval '20 days');

-- Étapes (agenda admin)
INSERT INTO etape (id_projet, id_admin, type_etape, date_debut, date_fin)
SELECT p.id_projet, a.id_utilisateur, e.type_etape, p.date_soumission + e.decalage, p.date_soumission + e.decalage + e.duree
FROM projet p
CROSS JOIN (SELECT id_utilisateur FROM utilisateur WHERE email = 'admin.fablab@ynov.com') a
JOIN (VALUES
  ('Figurine dragon',        'acceptation',          interval '1 day',  interval '0'),
  ('Figurine dragon',        'lancement_impression', interval '2 days', interval '200 minutes'),
  ('Figurine dragon',        'poncage',              interval '3 days', interval '45 minutes'),
  ('Figurine dragon',        'peinture',             interval '3 days 2 hours', interval '60 minutes'),
  ('Figurine dragon',        'cloture',              interval '5 days', interval '0'),
  ('Support de téléphone',   'acceptation',          interval '1 day',  interval '0'),
  ('Tee-shirt BDE',          'acceptation',          interval '1 day',  interval '0'),
  ('Tee-shirt équipe Ydays', 'acceptation',          interval '1 day',  interval '0'),
  ('Tee-shirt équipe Ydays', 'flocage',              interval '2 days', interval '30 minutes'),
  ('Tee-shirt équipe Ydays', 'cloture',              interval '3 days', interval '0')
) AS e(titre, type_etape, decalage, duree) ON e.titre = p.titre;

INSERT INTO etape (id_projet, type_etape, date_debut)
SELECT id_projet, 'soumission', date_soumission FROM projet;

-- Impression en cours : lancée il y a 80 min (sert au calcul du %)
INSERT INTO etape (id_projet, id_admin, type_etape, date_debut)
SELECT p.id_projet, (SELECT id_utilisateur FROM utilisateur WHERE email = 'admin.fablab@ynov.com'),
       'lancement_impression', now() - interval '80 minutes'
FROM projet p WHERE p.titre = 'Support de téléphone';

-- Bilans des projets terminés (140 g PLA à 25 €/kg + 15 ml peinture à 0,10 €/ml = 5,00 €)
INSERT INTO bilan (id_projet, temps_impression_min, poncage_fait, temps_poncage_min,
                   peinture_faite, temps_peinture_min, delai_livraison_jours, prix_total_centimes, date_cloture)
SELECT id_projet, 200, true, 45, true, 60, 3, 500, date_soumission + interval '5 days'
FROM projet WHERE titre = 'Figurine dragon';

INSERT INTO bilan (id_projet, delai_livraison_jours, prix_total_centimes, date_cloture)
SELECT id_projet, 2, 600, date_soumission + interval '3 days'
FROM projet WHERE titre = 'Tee-shirt équipe Ydays';

INSERT INTO consommation (id_bilan, id_produit, quantite, prix_unitaire_centimes)
SELECT b.id_bilan, pr.id_produit, c.quantite, pr.prix_centimes
FROM (VALUES
  ('Figurine dragon',        'Bobine PLA',              'Blanc', 140),
  ('Figurine dragon',        'Peinture acrylique',      'Noir',  15),
  ('Tee-shirt équipe Ydays', 'Tee-shirt coton taille M', 'Blanc', 1)
) AS c(titre, produit, couleur, quantite)
JOIN projet p   ON p.titre = c.titre
JOIN bilan b    ON b.id_projet = p.id_projet
JOIN produit pr ON pr.nom = c.produit AND pr.couleur = c.couleur;

-- Portfolio
INSERT INTO publication (id_projet, description_publique, date_publication, est_visible)
SELECT id_projet, 'Un dragon imprimé en PLA blanc, poncé puis peint à la main pour le stand Ydays.',
       now() - interval '6 days', true
FROM projet WHERE titre = 'Figurine dragon';
INSERT INTO publication (id_projet, description_publique, date_publication, est_visible)
SELECT id_projet, 'Tee-shirts floqués aux couleurs de l''équipe Ydays.', now() - interval '15 days', true
FROM projet WHERE titre = 'Tee-shirt équipe Ydays';

INSERT INTO photo (id_publication, chemin, legende, ordre)
SELECT pu.id_publication, ph.chemin, ph.legende, 0
FROM publication pu
JOIN projet p ON p.id_projet = pu.id_projet
JOIN (VALUES
  ('Figurine dragon',        'portfolio/demo-dragon.svg',   'Le dragon après peinture'),
  ('Tee-shirt équipe Ydays', 'portfolio/demo-teeshirt.svg', 'Le flocage dans le dos')
) AS ph(titre, chemin, legende) ON ph.titre = p.titre;

-- Avis
INSERT INTO avis (id_projet, note, commentaire)
SELECT id_projet, 5, 'Rendu impeccable et équipe super disponible sur le chat !'
FROM projet WHERE titre = 'Tee-shirt équipe Ydays';

-- Conversation de démo
INSERT INTO conversation (id_client)
SELECT id_utilisateur FROM utilisateur WHERE role = 'client';

INSERT INTO message (id_conversation, id_auteur, contenu, date_envoi)
SELECT c.id_conversation, u.id_utilisateur, m.contenu, now() - m.il_y_a
FROM (VALUES
  ('etudiant.demo@ynov.com', 'etudiant.demo@ynov.com', 'Bonjour, je voudrais participer au ponçage de ma figurine.', interval '5 days'),
  ('etudiant.demo@ynov.com', 'admin.fablab@ynov.com',  'Avec plaisir ! Jeudi 14h au Fab Lab, ça te va ?',         interval '5 days' - interval '1 hour')
) AS m(client, auteur, contenu, il_y_a)
JOIN utilisateur cl ON cl.email = m.client
JOIN conversation c ON c.id_client = cl.id_utilisateur
JOIN utilisateur u  ON u.email = m.auteur;

COMMIT;
