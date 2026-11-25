// Onglet Suivi & Planning > Planning
//   1. « À venir » : fins d'impression prévues + dates limites des projets en cours
//      (calculé à partir de GET /api/admin/projets)
//   2. « Journal de la semaine » : ce qui a été fait, jour par jour
//      (GET /api/admin/projets/agenda?du=...&au=...)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useSocket } from '../../socket.js';
import { duree, heureFr } from '../../utils/format.js';
import {
  STATUTS_FINIS, TYPES_ETAPE, isoLocal, joursRestants, minutesEntre, nomClient, texteEcheance,
} from '../../utils/admin.js';
import { SousNavSuivi } from './AdminLayout.jsx';

const JOUR = 86400000;

// Lundi de la semaine qui contient "date" (00 h 00, heure locale)
function lundiDe(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const decalage = (d.getDay() + 6) % 7; // dimanche = 0 en JS -> 6 jours après lundi
  return new Date(d.getTime() - decalage * JOUR);
}

const jourLong = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const jourCourt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Construit la liste « À venir » à partir des projets
function echeances(projets) {
  const liste = [];
  for (const p of projets) {
    if (STATUTS_FINIS.includes(p.statut)) continue;
    if (p.statut === 'en_impression' && p.fin_impression_prevue) {
      liste.push({ cle: `i${p.id_projet}`, date: new Date(p.fin_impression_prevue), type: 'impression', p });
    }
    if (p.date_limite) {
      liste.push({ cle: `d${p.id_projet}`, date: new Date(`${p.date_limite}T23:59`), type: 'limite', p });
    }
  }
  return liste.sort((a, b) => a.date - b.date);
}

function AVenir({ projets }) {
  const liste = echeances(projets);
  return (
    <section className="section" aria-labelledby="titre-avenir">
      <h2 id="titre-avenir">À venir <span className="compteur">{liste.length}</span></h2>
      {liste.length === 0 && <p className="vide">Aucune échéance pour les projets en cours.</p>}
      <ul className="echeances">
        {liste.map(({ cle, date, type, p }) => {
          const jours = type === 'limite' ? joursRestants(p.date_limite) : joursRestants(isoLocal(date));
          const classe = jours < 0 ? 'echeances__item echeances__item--retard'
            : jours <= 2 ? 'echeances__item echeances__item--proche' : 'echeances__item';
          return (
            <li key={cle} className={classe}>
              <span className="echeances__date">
                {jourCourt(date)}
                {type === 'impression' && <> · {heureFr(date)}</>}
              </span>
              <span className="echeances__texte">
                <strong>{type === 'impression' ? 'Fin d’impression' : 'Date limite'}</strong>
                {' — '}
                <Link to={`/admin/suivi/${p.id_projet}`}>{p.titre}</Link>
                <span className="texte-doux"> ({nomClient(p.client)})</span>
              </span>
              <span className="echeances__quand">{texteEcheance(jours)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Journal() {
  const [lundi, setLundi] = useState(() => lundiDe(new Date()));
  const [etapes, setEtapes] = useState(null);
  const [erreur, setErreur] = useState('');
  const dimanche = new Date(lundi.getTime() + 6 * JOUR);
  const cetteSemaine = lundi.getTime() === lundiDe(new Date()).getTime();

  const charger = () => {
    setErreur('');
    api(`/admin/projets/agenda?du=${isoLocal(lundi)}&au=${isoLocal(dimanche)}`)
      .then(setEtapes)
      .catch((e) => setErreur(e.message));
  };
  useEffect(() => { setEtapes(null); charger(); }, [lundi]);
  useSocket('projet:maj', charger);

  // Regroupe les étapes par jour : { "2026-11-24": [...], ... }
  const parJour = {};
  for (const e of etapes ?? []) (parJour[isoLocal(e.date_debut)] ??= []).push(e);
  const jours = Array.from({ length: 7 }, (_, i) => new Date(lundi.getTime() + i * JOUR));
  const decaler = (semaines) => setLundi(new Date(lundi.getTime() + semaines * 7 * JOUR));

  return (
    <section className="section" aria-labelledby="titre-journal">
      <div className="journal__entete">
        <h2 id="titre-journal">
          Journal du {jourCourt(lundi)} au {jourCourt(dimanche)}
        </h2>
        <div className="actions-statut">
          <button type="button" className="bouton bouton--secondaire" onClick={() => decaler(-1)}>
            ← <span className="visuellement-cache">Semaine</span> précédente
          </button>
          {!cetteSemaine && (
            <button type="button" className="bouton bouton--secondaire" onClick={() => setLundi(lundiDe(new Date()))}>
              Cette semaine
            </button>
          )}
          <button type="button" className="bouton bouton--secondaire" onClick={() => decaler(1)}>
            <span className="visuellement-cache">Semaine</span> suivante →
          </button>
        </div>
      </div>

      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!etapes && !erreur && <p role="status">Chargement…</p>}
      {etapes?.length === 0 && <p className="vide">Rien d’enregistré cette semaine.</p>}

      {etapes?.length > 0 && (
        <ol className="journal">
          {jours.map((j) => {
            const liste = parJour[isoLocal(j)];
            if (!liste) return null; // on n'affiche que les jours avec de l'activité
            return (
              <li key={j.getTime()} className="carte journal__jour">
                <h3 className="journal__titre">{jourLong(j)}</h3>
                <ul className="journal__lignes">
                  {liste.map((e) => {
                    const min = minutesEntre(e.date_debut, e.date_fin);
                    return (
                      <li key={e.id_etape} className="journal__ligne">
                        <span className="journal__heure">{heureFr(e.date_debut)}</span>
                        <span>
                          <strong>{TYPES_ETAPE[e.type_etape] ?? e.type_etape}</strong>
                          {' — '}
                          <Link to={`/admin/suivi/${e.id_projet}`}>{e.titre}</Link>
                          <span className="texte-doux petit">
                            {e.type_etape === 'lancement_impression' && !e.date_fin && ' · en cours'}
                            {min > 0 && ` · ${duree(min)}`}
                            {e.admin_prenom && ` · ${e.admin_prenom}`}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function Planning() {
  const [projets, setProjets] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => api('/admin/projets').then(setProjets).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useSocket('projet:maj', charger);
  useSocket('projet:nouveau', charger);

  return (
    <>
      <SousNavSuivi />
      <div className="titre-page">
        <div>
          <h1>Planning</h1>
          <p className="texte-doux">Ce qui arrive bientôt, et ce qui a été fait au Fab Lab.</p>
        </div>
      </div>
      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!projets && !erreur && <p role="status">Chargement…</p>}
      {projets && <AVenir projets={projets} />}
      <Journal />
    </>
  );
}
