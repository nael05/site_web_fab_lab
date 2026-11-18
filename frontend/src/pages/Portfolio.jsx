// Onglet 1 : vitrine des projets finis + résumé auto sous chaque projet
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CATEGORIES, dateFr } from '../utils/format.js';
import BilanResume from '../components/BilanResume.jsx';
import { useSocket } from '../socket.js';

const FILTRES = [['tous', 'Tous'], ['impression_3d', 'Impression 3D'], ['tee_shirt', 'Tee-shirts']];

export default function Portfolio() {
  const [publications, setPublications] = useState(null);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState('tous');

  const charger = () => api('/portfolio').then(setPublications).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useSocket('portfolio:maj', charger); // émis par l'admin quand il publie

  const liste = publications?.filter((p) => filtre === 'tous' || p.categorie === filtre);

  return (
    <>
      <div className="titre-page">
        <div>
          <h1>Portfolio</h1>
          <p className="texte-doux">Les réalisations du Fab Lab, avec leur bilan de fabrication.</p>
        </div>
        <div className="filtres" role="group" aria-label="Filtrer par catégorie">
          {FILTRES.map(([v, l]) => (
            <button key={v} type="button" className="puce" aria-pressed={filtre === v} onClick={() => setFiltre(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!publications && !erreur && <p role="status">Chargement…</p>}
      {liste?.length === 0 && <p className="vide">Aucun projet publié pour le moment.</p>}

      <div className="grille-portfolio">
        {liste?.map((p) => (
          <article key={p.id_publication} className="carte carte--media">
            {p.photos[0] ? (
              <figure className="media">
                <img src={`/uploads/${p.photos[0].chemin}`} alt={p.photos[0].legende || p.titre} loading="lazy" />
                {p.photos.length > 1 && <span className="media__compteur">+{p.photos.length - 1} photo(s)</span>}
              </figure>
            ) : (
              <div className="media media--vide" aria-hidden="true">Pas de photo</div>
            )}
            <div className="carte__corps">
              <p className="surtitre">{CATEGORIES[p.categorie]} · {dateFr(p.date_publication)}</p>
              <h2 className="carte__titre">{p.titre}</h2>
              <p>{p.description_publique}</p>
              <BilanResume bilan={p.bilan} categorie={p.categorie} cadre={p.cadre} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
