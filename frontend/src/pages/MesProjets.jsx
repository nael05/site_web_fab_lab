// Onglet 2 : mes projets (en cours / terminés) + suivi live + bilan + avis
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { CADRES, CATEGORIES, NIVEAUX_DETAIL, dateFr, nomProduit, tailleFichier } from '../utils/format.js';
import { useSocket } from '../socket.js';
import StatutBadge from '../components/StatutBadge.jsx';
import SuiviProjet from '../components/SuiviProjet.jsx';
import BilanResume from '../components/BilanResume.jsx';

const FINIS = ['termine', 'refuse'];

function CarteProjet({ p }) {
  const est3d = p.categorie === 'impression_3d';
  return (
    <article className="carte projet">
      <header className="projet__entete">
        <div>
          <p className="surtitre">{CATEGORIES[p.categorie]} · {CADRES[p.cadre]} · déposé le {dateFr(p.date_soumission)}</p>
          <h3 className="carte__titre">{p.titre}</h3>
        </div>
        <StatutBadge statut={p.statut} />
      </header>

      <SuiviProjet projet={p} />

      {p.statut === 'termine' && (
        <>
          <BilanResume bilan={p.bilan} categorie={p.categorie} cadre={p.cadre} />
          {p.a_un_avis ? (
            <p className="texte-doux">✓ Merci pour votre avis !</p>
          ) : (
            <Link to={`/avis?projet=${p.id_projet}`} className="bouton bouton--primaire">Laisser un avis</Link>
          )}
        </>
      )}

      <details className="details">
        <summary>Détails de la demande</summary>
        <dl className="liste-def">
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
          {p.date_limite && (<><dt>Date limite</dt><dd>{dateFr(p.date_limite)}</dd></>)}
          {p.fichiers.length > 0 && (
            <>
              <dt>Fichiers</dt>
              <dd>
                <ul className="fichiers">
                  {p.fichiers.map((f) => (
                    <li key={f.id_fichier}>
                      <a href={`/api/projets/${p.id_projet}/fichiers/${f.id_fichier}`}>{f.nom_original}</a>
                      <span className="texte-doux"> ({f.type.toUpperCase()}, {tailleFichier(f.taille_octets)})</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      </details>
    </article>
  );
}

export default function MesProjets() {
  const { state } = useLocation();
  const [projets, setProjets] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/projets/mes').then(setProjets).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useSocket('projet:maj', charger); // l'admin a changé un statut / % / bilan

  const enCours = projets?.filter((p) => !FINIS.includes(p.statut)) ?? [];
  const finis = projets?.filter((p) => FINIS.includes(p.statut)) ?? [];

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Mes projets</h1>
          <p className="texte-doux">Suivez l’avancement de vos demandes en direct.</p>
        </div>
        <Link to="/projets/nouveau" className="bouton bouton--primaire">+ Soumettre un projet</Link>
      </div>

      {state?.succes && <p className="alerte alerte--succes" role="status">{state.succes}</p>}
      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!projets && !erreur && <p role="status">Chargement…</p>}

      {projets && (
        <>
          <section aria-labelledby="titre-en-cours" className="section">
            <h2 id="titre-en-cours">En cours <span className="compteur">{enCours.length}</span></h2>
            {enCours.length === 0 && <p className="vide">Aucun projet en cours. Lancez-vous !</p>}
            <div className="liste-projets">{enCours.map((p) => <CarteProjet key={p.id_projet} p={p} />)}</div>
          </section>

          <section aria-labelledby="titre-finis" className="section">
            <h2 id="titre-finis">Terminés <span className="compteur">{finis.length}</span></h2>
            {finis.length === 0 && <p className="vide">Pas encore de projet terminé.</p>}
            <div className="liste-projets">{finis.map((p) => <CarteProjet key={p.id_projet} p={p} />)}</div>
          </section>
        </>
      )}
    </>
  );
}
