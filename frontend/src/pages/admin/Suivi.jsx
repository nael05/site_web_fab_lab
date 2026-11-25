// Onglet Suivi & Planning > Projets : toutes les demandes, filtrées par étape
//   API : GET /api/admin/projets
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useSocket } from '../../socket.js';
import { CADRES, CATEGORIES, dateFr, nomProduit } from '../../utils/format.js';
import { VUES_SUIVI, joursRestants, nomClient, texteEcheance, STATUTS_FINIS } from '../../utils/admin.js';
import StatutBadge from '../../components/StatutBadge.jsx';
import { SousNavSuivi } from './AdminLayout.jsx';

// Date limite en rouge si dépassée, en orange si dans 2 jours ou moins
function Echeance({ projet }) {
  if (!projet.date_limite || STATUTS_FINIS.includes(projet.statut)) return null;
  const jours = joursRestants(projet.date_limite);
  const classe = jours < 0 ? 'echeance echeance--retard' : jours <= 2 ? 'echeance echeance--proche' : 'echeance';
  return (
    <span className={classe}>
      Pour le {dateFr(projet.date_limite)} ({texteEcheance(jours)})
    </span>
  );
}

function LigneProjet({ p }) {
  return (
    <article className="carte ligne-projet">
      <div className="ligne-projet__texte">
        <p className="surtitre">
          {CATEGORIES[p.categorie]} · {CADRES[p.cadre]} · déposé le {dateFr(p.date_soumission)}
        </p>
        <h2 className="carte__titre">
          {/* Le lien couvre toute la carte (voir .ligne-projet__lien dans admin.css) */}
          <Link to={`/admin/suivi/${p.id_projet}`} className="ligne-projet__lien">{p.titre}</Link>
        </h2>
        <p className="petit texte-doux">
          {nomClient(p.client)} · {nomProduit(p)}
        </p>
        <Echeance projet={p} />
      </div>
      <div className="ligne-projet__statut">
        <StatutBadge statut={p.statut} />
        {p.statut === 'en_impression' && p.progression_pct != null && (
          <span className="petit texte-doux">{p.progression_pct} %</span>
        )}
      </div>
    </article>
  );
}

export default function Suivi() {
  const [projets, setProjets] = useState(null);
  const [erreur, setErreur] = useState('');
  // Le filtre est dans l'URL (?vue=prets) : il survit au bouton « retour »
  const [params, setParams] = useSearchParams();
  const vue = params.get('vue') ?? 'a_traiter';

  const charger = () => api('/admin/projets').then(setProjets).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useSocket('projet:maj', charger); // un admin a changé un projet
  useSocket('projet:nouveau', charger); // un élève vient de déposer une demande

  const statutsDe = (cle) => VUES_SUIVI.find(([c]) => c === cle)?.[2];
  const filtrer = (cle) => {
    const statuts = statutsDe(cle);
    return projets?.filter((p) => !statuts || statuts.includes(p.statut)) ?? [];
  };
  // Dans « Tous », les projets finis passent après ceux en cours
  // (sort est stable : l'ordre du back, par urgence, est gardé à l'intérieur de chaque groupe)
  const liste = filtrer(vue).sort((a, b) => STATUTS_FINIS.includes(a.statut) - STATUTS_FINIS.includes(b.statut));

  return (
    <>
      <SousNavSuivi />
      <div className="titre-page">
        <div>
          <h1>Suivi des projets</h1>
          <p className="texte-doux">Les plus urgents (date limite proche) sont en haut.</p>
        </div>
        <div className="filtres" role="group" aria-label="Filtrer par étape">
          {VUES_SUIVI.map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              className="puce"
              aria-pressed={vue === cle}
              onClick={() => setParams(cle === 'a_traiter' ? {} : { vue: cle })}
            >
              {libelle} <span className="puce__nombre">{projets ? filtrer(cle).length : '…'}</span>
            </button>
          ))}
        </div>
      </div>

      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!projets && !erreur && <p role="status">Chargement…</p>}
      {projets && liste.length === 0 && (
        <p className="vide">{vue === 'a_traiter' ? 'Aucune nouvelle demande, tout est à jour.' : 'Aucun projet ici.'}</p>
      )}
      <div className="liste-projets">
        {liste.map((p) => <LigneProjet key={p.id_projet} p={p} />)}
      </div>
    </>
  );
}
