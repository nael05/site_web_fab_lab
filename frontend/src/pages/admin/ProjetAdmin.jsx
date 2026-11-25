// Fiche d'un projet côté admin : infos, actions de statut, avancement, clôture, historique
//   API : GET  /api/admin/projets/:id
//         POST /api/admin/projets/:id/statut
//         PATCH /api/admin/projets/:id/avancement
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useSocket } from '../../socket.js';
import {
  CADRES, CATEGORIES, NIVEAUX_DETAIL, dateFr, duree, heureFr, nomProduit, tailleFichier,
} from '../../utils/format.js';
import { ACTIONS_STATUT, TYPES_ETAPE, minutesEntre, nomClient, pourDatetimeLocal } from '../../utils/admin.js';
import StatutBadge from '../../components/StatutBadge.jsx';
import SuiviProjet from '../../components/SuiviProjet.jsx';
import BilanResume from '../../components/BilanResume.jsx';
import FormCloture from './FormCloture.jsx';

// ---------------------------------------------------------------------
// Boutons « étape suivante ». Les boutons affichés viennent du back
// (statuts_suivants) : le front ne recode pas la machine à états.
// Refuser et Lancer l'impression ouvrent d'abord un petit formulaire.
// ---------------------------------------------------------------------
function ActionsStatut({ projet, onFait }) {
  const [ouvert, setOuvert] = useState(null); // 'refuse' | 'en_impression' | null
  const [motif, setMotif] = useState('');
  const [heures, setHeures] = useState('');
  const [minutes, setMinutes] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const suivants = projet.statuts_suivants.filter((s) => s !== 'termine'); // la clôture a son formulaire
  if (!suivants.length) return null;

  const changer = async (statut, extra = {}) => {
    setEnvoi(true);
    setErreur('');
    try {
      await api(`/admin/projets/${projet.id_projet}/statut`, { method: 'POST', body: { statut, ...extra } });
      setOuvert(null);
      onFait(`Statut mis à jour : ${ACTIONS_STATUT[statut].toLowerCase()} ✓`);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const cliquer = (statut) => (['refuse', 'en_impression'].includes(statut) ? setOuvert(statut) : changer(statut));

  const lancer = (e) => {
    e.preventDefault();
    const total = (Number(heures) || 0) * 60 + (Number(minutes) || 0);
    changer('en_impression', total > 0 ? { duree_min: total } : {});
  };

  const refuser = (e) => {
    e.preventDefault();
    changer('refuse', { motif_refus: motif.trim() });
  };

  return (
    <section className="carte panneau" aria-labelledby="titre-actions">
      <h2 id="titre-actions">Étape suivante</h2>
      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}

      <div className="actions-statut">
        {suivants.map((s) => (
          <button
            key={s}
            type="button"
            className={s === 'refuse' ? 'bouton bouton--danger' : 'bouton bouton--primaire'}
            disabled={envoi}
            aria-expanded={['refuse', 'en_impression'].includes(s) ? ouvert === s : undefined}
            onClick={() => cliquer(s)}
          >
            {ACTIONS_STATUT[s]}
          </button>
        ))}
      </div>

      {ouvert === 'refuse' && (
        <form className="sous-form" onSubmit={refuser}>
          <div className="champ">
            <label htmlFor="motif">Motif du refus <span className="obligatoire">*</span></label>
            <textarea id="motif" rows={3} required value={motif} onChange={(e) => setMotif(e.target.value)} />
            <p className="aide">L’élève le recevra par mail et le verra dans « Mes projets ».</p>
          </div>
          <div className="actions-form">
            <button type="button" className="bouton bouton--secondaire" onClick={() => setOuvert(null)}>Annuler</button>
            <button type="submit" className="bouton bouton--danger" disabled={envoi || !motif.trim()}>Confirmer le refus</button>
          </div>
        </form>
      )}

      {ouvert === 'en_impression' && (
        <form className="sous-form" onSubmit={lancer}>
          <fieldset>
            <legend>Durée estimée par le slicer (facultatif)</legend>
            <div className="duree-champs">
              <label>
                <input type="number" min="0" max="200" value={heures} onChange={(e) => setHeures(e.target.value)} /> h
              </label>
              <label>
                <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} /> min
              </label>
            </div>
            <p className="aide">Sert au compte à rebours affiché à l’élève.</p>
          </fieldset>
          <div className="actions-form">
            <button type="button" className="bouton bouton--secondaire" onClick={() => setOuvert(null)}>Annuler</button>
            <button type="submit" className="bouton bouton--primaire" disabled={envoi}>Lancer l’impression</button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Pendant l'impression : jauge % et heure de fin prévue
// ---------------------------------------------------------------------
// Tant que progression_pct est vide, SuiviProjet calcule le % tout seul
// (heure de lancement -> heure de fin prévue). Bouger le curseur force une valeur.
function Avancement({ projet, onFait }) {
  const [pct, setPct] = useState(projet.progression_pct ?? 0);
  const [pctTouche, setPctTouche] = useState(false); // on n'envoie le % que si l'admin l'a bougé
  const [fin, setFin] = useState(projet.fin_impression_prevue ? pourDatetimeLocal(projet.fin_impression_prevue) : '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const auto = projet.progression_pct == null && !pctTouche;

  // Un autre admin a modifié le projet : on reprend les nouvelles valeurs
  useEffect(() => {
    setPct(projet.progression_pct ?? 0);
    setPctTouche(false);
    setFin(projet.fin_impression_prevue ? pourDatetimeLocal(projet.fin_impression_prevue) : '');
  }, [projet.progression_pct, projet.fin_impression_prevue]);

  const enregistrer = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    // datetime-local n'a pas de fuseau : new Date() le lit en heure locale
    const body = { fin_impression_prevue: fin ? new Date(fin).toISOString() : null };
    if (pctTouche) body.progression_pct = Number(pct);
    try {
      await api(`/admin/projets/${projet.id_projet}/avancement`, { method: 'PATCH', body });
      onFait('Avancement enregistré ✓');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className="carte panneau" aria-labelledby="titre-avancement">
      <h2 id="titre-avancement">Avancement de l’impression</h2>
      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      <form onSubmit={enregistrer}>
        <div className="champ">
          <label htmlFor="pct">
            Progression : <strong>{auto ? 'calcul automatique' : `${pct} %`}</strong>
          </label>
          <input
            id="pct" type="range" min="0" max="100" step="5" value={pct}
            onChange={(e) => { setPct(e.target.value); setPctTouche(true); }}
          />
          <p className="aide">
            {auto
              ? 'Le % avance tout seul jusqu’à l’heure de fin prévue. Bouge le curseur pour le forcer.'
              : 'Valeur saisie à la main : elle remplace le calcul automatique.'}
          </p>
        </div>
        <div className="champ champ--court">
          <label htmlFor="fin">Fin prévue</label>
          <input id="fin" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        <button type="submit" className="bouton bouton--primaire" disabled={envoi}>Enregistrer</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------
// Historique = les étapes du projet (même source que le Planning)
// ---------------------------------------------------------------------
function Historique({ etapes }) {
  return (
    <section className="carte panneau" aria-labelledby="titre-historique">
      <h2 id="titre-historique">Historique</h2>
      <ol className="historique">
        {etapes.map((e, i) => {
          const min = minutesEntre(e.date_debut, e.date_fin);
          return (
            <li key={i} className="historique__etape">
              <strong>{TYPES_ETAPE[e.type_etape] ?? e.type_etape}</strong>
              {e.type_etape === 'lancement_impression' && !e.date_fin && <span className="badge badge--en_impression">en cours</span>}
              <span className="petit texte-doux">
                {dateFr(e.date_debut)} à {heureFr(e.date_debut)}
                {min > 0 && ` · ${duree(min)}`}
                {e.admin_prenom && ` · par ${e.admin_prenom}`}
              </span>
              {e.commentaire && <span className="petit">« {e.commentaire} »</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------
export default function ProjetAdmin() {
  const { id } = useParams();
  const [projet, setProjet] = useState(null);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const succesRef = useRef(null);

  const charger = () => api(`/admin/projets/${id}`).then(setProjet).catch((e) => setErreur(e.message));
  useEffect(() => { setProjet(null); setErreur(''); charger(); }, [id]);
  // On ne recharge que si c'est CE projet qui a changé
  useSocket('projet:maj', (d) => String(d?.id_projet) === id && charger());

  // Après une action : message + rechargement. Le focus va sur le message
  // pour qu'un lecteur d'écran l'annonce.
  const fait = (message) => {
    setSucces(message);
    charger();
    setTimeout(() => succesRef.current?.focus(), 0);
  };

  if (erreur) {
    return (
      <>
        <p><Link to="/admin/suivi">← Tous les projets</Link></p>
        <p className="alerte alerte--erreur" role="alert">{erreur}</p>
      </>
    );
  }
  if (!projet) return <p role="status">Chargement…</p>;

  const p = projet;
  const est3d = p.categorie === 'impression_3d';

  return (
    <>
      <p><Link to="/admin/suivi">← Tous les projets</Link></p>
      <div className="titre-page">
        <div>
          <p className="surtitre">{CATEGORIES[p.categorie]} · {CADRES[p.cadre]} · déposé le {dateFr(p.date_soumission)}</p>
          <h1>{p.titre}</h1>
        </div>
        <StatutBadge statut={p.statut} />
      </div>

      {succes && <p ref={succesRef} tabIndex={-1} className="alerte alerte--succes" role="status">{succes}</p>}

      <div className="admin-grille">
        <div className="admin-grille__principal">
          <section className="carte panneau" aria-label="Avancement">
            <SuiviProjet projet={p} />
          </section>

          <ActionsStatut projet={p} onFait={fait} />
          {p.statut === 'en_impression' && <Avancement projet={p} onFait={fait} />}
          {p.statuts_suivants.includes('termine') && <FormCloture projet={p} onFait={fait} />}
          {p.bilan && (
            <section className="carte panneau">
              <BilanResume bilan={p.bilan} categorie={p.categorie} cadre={p.cadre} />
            </section>
          )}
          <Historique etapes={p.etapes} />
        </div>

        <aside className="admin-grille__cote">
          <section className="carte panneau" aria-labelledby="titre-client">
            <h2 id="titre-client">Élève</h2>
            <p className="petit"><strong>{nomClient(p.client)}</strong></p>
            <p className="petit"><a href={`mailto:${p.client.email}`}>{p.client.email}</a></p>
          </section>

          <section className="carte panneau" aria-labelledby="titre-demande">
            <h2 id="titre-demande">La demande</h2>
            <dl className="liste-def liste-def--colonne">
              <dt>Description</dt><dd>{p.description}</dd>
              <dt>{est3d ? 'Filament' : 'Tee-shirt'}</dt><dd>{nomProduit(p)}</dd>
              {est3d && (
                <>
                  <dt>Dimensions</dt><dd>{p.longueur_mm} × {p.largeur_mm} × {p.hauteur_mm} mm</dd>
                  <dt>Niveau de détail</dt><dd>{NIVEAUX_DETAIL[p.niveau_detail]}</dd>
                  <dt>Solidité</dt><dd>{p.solidite_pct} %</dd>
                  {p.usage_mecanique && (<><dt>Usage</dt><dd>{p.usage_mecanique}</dd></>)}
                  <dt>Finitions</dt>
                  <dd>{[p.poncage_demande && 'Ponçage', p.peinture_demandee && 'Peinture'].filter(Boolean).join(', ') || 'Aucune'}</dd>
                </>
              )}
              <dt>L’élève veut participer</dt>
              <dd>
                {[
                  p.participe_lancement && 'au lancement', p.participe_poncage && 'au ponçage',
                  p.participe_peinture && 'à la peinture', p.participe_flocage && 'au flocage',
                ].filter(Boolean).join(', ') || 'Non'}
              </dd>
              {p.date_limite && (<><dt>Date limite</dt><dd>{dateFr(p.date_limite)}</dd></>)}
              {p.motif_refus && (<><dt>Motif du refus</dt><dd>{p.motif_refus}</dd></>)}
            </dl>
          </section>

          {p.fichiers.length > 0 && (
            <section className="carte panneau" aria-labelledby="titre-fichiers">
              <h2 id="titre-fichiers">Fichiers</h2>
              <ul className="fichiers">
                {p.fichiers.map((f) => (
                  <li key={f.id_fichier}>
                    <a href={`/api/projets/${p.id_projet}/fichiers/${f.id_fichier}`}>{f.nom_original}</a>
                    <span className="texte-doux petit"> ({f.type.toUpperCase()}, {tailleFichier(f.taille_octets)})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
