// Formulaire « Soumettre un projet » : s'adapte à Impression 3D / Tee-shirt
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { NIVEAUX_DETAIL, nomProduit, tailleFichier } from '../utils/format.js';

const TAILLE_MAX_MM = 260; // même règle que le back
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const INITIAL = {
  categorie: 'impression_3d',
  cadre: 'ydays',
  titre: '',
  description: '',
  id_produit_choisi: '',
  niveau_detail: 3,
  longueur_mm: '',
  largeur_mm: '',
  hauteur_mm: '',
  solidite_pct: 20,
  usage_mecanique: '',
  poncage_demande: false,
  peinture_demandee: false,
  date_limite: '',
  participe_lancement: false,
  participe_poncage: false,
  participe_peinture: false,
  participe_flocage: false,
};

const estStl = (f) => f.name.toLowerCase().endsWith('.stl');

export default function NouveauProjet() {
  const navigate = useNavigate();
  const [f, setF] = useState(INITIAL);
  const [fichiers, setFichiers] = useState([]);
  const [produits, setProduits] = useState([]);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const est3d = f.categorie === 'impression_3d';
  const maj = (champ) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((old) => ({ ...old, [champ]: v }));
  };

  // Couleurs / modèles dispo selon le stock admin
  useEffect(() => {
    setProduits([]);
    setF((old) => ({ ...old, id_produit_choisi: '' }));
    api(`/produits/disponibles?categorie=${est3d ? 'filament' : 'tee_shirt'}`)
      .then(setProduits)
      .catch((e) => setErreur(e.message));
  }, [est3d]);

  const dims = [f.longueur_mm, f.largeur_mm, f.hauteur_mm].map(Number);
  const tropGrand = est3d && dims.some((d) => d > TAILLE_MAX_MM);
  const nbStl = fichiers.filter(estStl).length;

  const ajouterFichiers = (e) => {
    setFichiers((old) => [...old, ...e.target.files].slice(0, 10));
    e.target.value = '';
  };

  // Mêmes contrôles que le back, pour un retour immédiat
  function verifier() {
    if (!f.id_produit_choisi) return est3d ? 'Choisissez une couleur de filament.' : 'Choisissez un tee-shirt.';
    if (est3d) {
      if (dims.some((d) => !(d > 0))) return 'Renseignez les 3 dimensions en mm.';
      if (nbStl < 1) return 'Ajoutez au moins un fichier .stl.';
      if (tropGrand && nbStl < 2) return 'Pièce > 26 cm : ajoutez plusieurs fichiers .stl (pièce découpée).';
    } else {
      if (nbStl > 0) return 'Pas de fichier .stl pour un tee-shirt.';
      if (fichiers.length < 1) return 'Ajoutez au moins un visuel à floquer.';
    }
    return '';
  }

  const soumettre = async (e) => {
    e.preventDefault();
    const probleme = verifier();
    if (probleme) return setErreur(probleme);

    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    fichiers.forEach((fichier) => form.append('fichiers', fichier));

    setEnvoi(true);
    setErreur('');
    try {
      await api('/projets', { method: 'POST', form });
      navigate('/projets', { state: { succes: 'Projet envoyé ! Vous recevrez un mail à chaque étape.' } });
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  };

  useEffect(() => {
    if (erreur) document.getElementById('erreur-formulaire')?.focus();
  }, [erreur]);

  return (
    <>
      <p className="fil"><Link to="/projets">← Mes projets</Link></p>
      <h1>Soumettre un projet</h1>
      <p className="texte-doux">Les champs marqués <span className="obligatoire">*</span> sont obligatoires.</p>

      {erreur && (
        <p id="erreur-formulaire" className="alerte alerte--erreur" role="alert" tabIndex={-1}>{erreur}</p>
      )}

      <form className="formulaire" onSubmit={soumettre} noValidate>
        {/* 1. Catégorie & cadre */}
        <section className="carte bloc-form">
          <h2>1. Type de projet</h2>
          <fieldset className="choix-cartes">
            <legend>Catégorie <span className="obligatoire">*</span></legend>
            {[['impression_3d', 'Impression 3D', '🧊'], ['tee_shirt', 'Flocage tee-shirt', '👕']].map(([v, l, ico]) => (
              <label key={v} className="choix-carte">
                <input type="radio" name="categorie" value={v} checked={f.categorie === v} onChange={maj('categorie')} />
                <span><span aria-hidden="true">{ico}</span> {l}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="radios-ligne">
            <legend>Cadre <span className="obligatoire">*</span></legend>
            {[['ydays', 'Ydays'], ['scolaire', 'Scolaire (hors Ydays)'], ['perso', 'Perso']].map(([v, l]) => (
              <label key={v}>
                <input type="radio" name="cadre" value={v} checked={f.cadre === v} onChange={maj('cadre')} /> {l}
              </label>
            ))}
          </fieldset>
        </section>

        {/* 2. Description */}
        <section className="carte bloc-form">
          <h2>2. Description</h2>
          <div className="champ">
            <label htmlFor="titre">Titre <span className="obligatoire">*</span></label>
            <input id="titre" maxLength={120} value={f.titre} onChange={maj('titre')} required />
          </div>
          <div className="champ">
            <label htmlFor="description">Description du projet <span className="obligatoire">*</span></label>
            <textarea
              id="description"
              rows={5}
              value={f.description}
              onChange={maj('description')}
              aria-describedby="description-aide"
              required
            />
            <p id="description-aide" className="aide">
              Objectif, consignes de réalisation{est3d ? '' : ' ou de flocage (emplacement, taille…)'}.
            </p>
          </div>
        </section>

        {/* 3. Matière & réglages */}
        <section className="carte bloc-form">
          <h2>3. {est3d ? 'Impression' : 'Tee-shirt'}</h2>
          <div className="champ">
            <label htmlFor="produit">
              {est3d ? 'Couleur du filament' : 'Modèle de tee-shirt'} <span className="obligatoire">*</span>
            </label>
            <select id="produit" value={f.id_produit_choisi} onChange={maj('id_produit_choisi')} required>
              <option value="">— Choisir —</option>
              {produits.map((p) => <option key={p.id_produit} value={p.id_produit}>{nomProduit(p)}</option>)}
            </select>
            {produits.length === 0 && <p className="aide">Aucun produit en stock pour le moment.</p>}
          </div>

          {est3d && (
            <>
              <div className="champ">
                <label htmlFor="niveau">Niveau de détail : <strong>{NIVEAUX_DETAIL[f.niveau_detail]}</strong></label>
                <input
                  id="niveau" type="range" min={1} max={5} step={1}
                  value={f.niveau_detail} onChange={maj('niveau_detail')}
                  aria-valuetext={NIVEAUX_DETAIL[f.niveau_detail]}
                />
                <div className="curseur-legende" aria-hidden="true"><span>Rapide</span><span>Ultra-fin</span></div>
              </div>

              <fieldset className="dimensions">
                <legend>Dimensions en mm (26 cm max par pièce) <span className="obligatoire">*</span></legend>
                {[['longueur_mm', 'Longueur'], ['largeur_mm', 'Largeur'], ['hauteur_mm', 'Hauteur']].map(([k, l]) => (
                  <div className="champ" key={k}>
                    <label htmlFor={k}>{l}</label>
                    <input id={k} type="number" min={1} inputMode="numeric" value={f[k]} onChange={maj(k)} required />
                  </div>
                ))}
              </fieldset>
              {tropGrand && (
                <p className="alerte alerte--attention" role="status">
                  ⚠ Une dimension dépasse 26 cm : l’imprimante ne peut pas la produire d’un bloc.
                  Fournissez la pièce découpée en <strong>plusieurs fichiers .stl</strong>.
                </p>
              )}

              <div className="champ">
                <label htmlFor="solidite">Solidité (remplissage) : <strong>{f.solidite_pct} %</strong></label>
                <input
                  id="solidite" type="range" min={0} max={100} step={5}
                  value={f.solidite_pct} onChange={maj('solidite_pct')} aria-valuetext={`${f.solidite_pct} %`}
                />
              </div>
              <div className="champ">
                <label htmlFor="usage">Usage mécanique</label>
                <textarea id="usage" rows={2} value={f.usage_mecanique} onChange={maj('usage_mecanique')}
                  placeholder="Ex : doit supporter un poids, s'emboîter…" />
              </div>

              <fieldset className="cases">
                <legend>Finitions</legend>
                <label><input type="checkbox" checked={f.poncage_demande} onChange={maj('poncage_demande')} /> Ponçage</label>
                <label><input type="checkbox" checked={f.peinture_demandee} onChange={maj('peinture_demandee')} /> Peinture personnalisée</label>
              </fieldset>
            </>
          )}
        </section>

        {/* 4. Fichiers */}
        <section className="carte bloc-form">
          <h2>4. Fichiers</h2>
          <div className="champ">
            <label htmlFor="fichiers" className="depot">
              <span className="depot__titre">{est3d ? 'Ajouter des fichiers .stl' : 'Ajouter un visuel'}</span>
              <span className="aide">
                {est3d ? '1 fichier si ≤ 26 cm, plusieurs si la pièce est découpée. 50 Mo max.' : 'PNG, JPG, WEBP ou PDF. 50 Mo max.'}
              </span>
            </label>
            <input
              id="fichiers" type="file" multiple className="depot__input"
              accept={est3d ? '.stl,.png,.jpg,.jpeg,.webp,.pdf' : '.png,.jpg,.jpeg,.webp,.pdf'}
              onChange={ajouterFichiers}
            />
          </div>
          {fichiers.length > 0 && (
            <ul className="fichiers-choisis" aria-label="Fichiers sélectionnés">
              {fichiers.map((fi, i) => (
                <li key={`${fi.name}-${i}`}>
                  <span>{estStl(fi) ? '🧊' : '🖼️'} {fi.name} <span className="texte-doux">({tailleFichier(fi.size)})</span></span>
                  <button type="button" className="lien lien--danger"
                    onClick={() => setFichiers((old) => old.filter((_, j) => j !== i))}
                    aria-label={`Retirer ${fi.name}`}>Retirer</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 5. Date & participation */}
        <section className="carte bloc-form">
          <h2>5. Date & participation</h2>
          <div className="champ champ--court">
            <label htmlFor="date_limite">Date limite (si existante)</label>
            <input id="date_limite" type="date" min={AUJOURDHUI} value={f.date_limite} onChange={maj('date_limite')} />
          </div>
          <fieldset className="cases">
            <legend>Je souhaite participer à :</legend>
            {est3d ? (
              <>
                <label><input type="checkbox" checked={f.participe_lancement} onChange={maj('participe_lancement')} /> Lancement de l’impression</label>
                <label><input type="checkbox" checked={f.participe_poncage} onChange={maj('participe_poncage')} /> Ponçage</label>
                <label><input type="checkbox" checked={f.participe_peinture} onChange={maj('participe_peinture')} /> Peinture</label>
              </>
            ) : (
              <label><input type="checkbox" checked={f.participe_flocage} onChange={maj('participe_flocage')} /> Flocage</label>
            )}
          </fieldset>
          <p className="aide">Le créneau se fixe ensuite avec l’équipe dans la <Link to="/messagerie">messagerie</Link>.</p>
        </section>

        <div className="actions-form">
          <Link to="/projets" className="bouton bouton--secondaire">Annuler</Link>
          <button className="bouton bouton--primaire" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer ma demande'}</button>
        </div>
      </form>
    </>
  );
}
