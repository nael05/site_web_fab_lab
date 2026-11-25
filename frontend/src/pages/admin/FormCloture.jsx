// Formulaire « Projet fini » : consommables utilisés + temps passés -> bilan
//   API : GET  /api/admin/stock                 (liste des consommables pour les menus)
//         POST /api/admin/projets/:id/cloture   (le back retire le stock et calcule le prix)
// La clôture ne se défait pas : on passe par un écran de confirmation.
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { duree, euros, nomProduit, quantite as formatQuantite } from '../../utils/format.js';
import { minutesEntre, prixLigneCentimes } from '../../utils/admin.js';

const CATEGORIES_CONSO = {
  impression_3d: [['filament', 'Filaments'], ['peinture', 'Peintures']],
  tee_shirt: [['tee_shirt', 'Tee-shirts']],
};
const UNITES = { kg: 'g', ml: 'ml', unite: 'unité(s)' };

let compteur = 0;
const nouvelleLigne = (idProduit = '', quantite = '') => ({ cle: ++compteur, id_produit: idProduit, quantite });

// Durée de la dernière impression d'après l'historique (pré-remplit le champ)
function dureeImpression(etapes) {
  const e = [...etapes].reverse().find((x) => x.type_etape === 'lancement_impression' && x.date_fin);
  return e ? minutesEntre(e.date_debut, e.date_fin) : null;
}

export default function FormCloture({ projet, onFait }) {
  const est3d = projet.categorie === 'impression_3d';
  const [stock, setStock] = useState(null);
  const [lignes, setLignes] = useState([nouvelleLigne(projet.id_produit_choisi, est3d ? '' : 1)]);
  const [tImpression, setTImpression] = useState(dureeImpression(projet.etapes) ?? '');
  const [poncage, setPoncage] = useState(projet.poncage_demande);
  const [tPoncage, setTPoncage] = useState('');
  const [peinture, setPeinture] = useState(projet.peinture_demandee);
  const [tPeinture, setTPeinture] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api('/admin/stock').then(setStock).catch((e) => setErreur(`Stock indisponible : ${e.message}`));
  }, []);

  const produit = (id) => stock?.find((s) => s.id_produit === Number(id));
  const modifier = (cle, champ, valeur) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));

  const lignesValides = lignes.filter((l) => produit(l.id_produit) && Number(l.quantite) > 0);
  const total = lignesValides.reduce((t, l) => {
    const p = produit(l.id_produit);
    return t + prixLigneCentimes(p.unite_prix, p.prix_centimes, l.quantite);
  }, 0);

  const verifier = (e) => {
    e.preventDefault();
    setErreur('');
    if (lignesValides.length !== lignes.length) {
      setErreur('Chaque ligne doit avoir un consommable et une quantité supérieure à 0.');
      return;
    }
    setConfirmation(true);
  };

  const cloturer = async () => {
    setEnvoi(true);
    setErreur('');
    const body = {
      consommations: lignes.map((l) => ({ id_produit: Number(l.id_produit), quantite: Number(l.quantite) })),
    };
    if (est3d && tImpression !== '') body.temps_impression_min = Number(tImpression);
    if (est3d && poncage) body.temps_poncage_min = Number(tPoncage);
    if (est3d && peinture) body.temps_peinture_min = Number(tPeinture);
    try {
      await api(`/admin/projets/${projet.id_projet}/cloture`, { method: 'POST', body });
      onFait('Projet clôturé : le stock est mis à jour et l’élève a reçu son bilan ✓');
    } catch (err) {
      setErreur(err.message); // ex. « Stock insuffisant : … » -> rien n'a été enregistré
      setConfirmation(false);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className="carte panneau" aria-labelledby="titre-cloture">
      <h2 id="titre-cloture">Clôturer le projet</h2>
      <p className="aide">Indique ce qui a vraiment été utilisé : le stock sera décompté et le prix calculé.</p>
      {erreur && <p className="alerte alerte--erreur" role="alert">{erreur}</p>}
      {!stock && !erreur && <p role="status">Chargement du stock…</p>}

      {stock && (
        <form onSubmit={verifier}>
          <fieldset disabled={confirmation}>
            <legend>Consommables utilisés</legend>
            {lignes.map((l, i) => {
              const p = produit(l.id_produit);
              const dejaPris = lignes.filter((x) => x.cle !== l.cle).map((x) => Number(x.id_produit));
              return (
                <div key={l.cle} className="ligne-conso">
                  <label className="visuellement-cache" htmlFor={`produit-${l.cle}`}>Consommable {i + 1}</label>
                  <select
                    id={`produit-${l.cle}`}
                    value={l.id_produit}
                    required
                    onChange={(e) => modifier(l.cle, 'id_produit', e.target.value)}
                  >
                    <option value="">Choisir…</option>
                    {CATEGORIES_CONSO[projet.categorie].map(([cat, titre]) => (
                      <optgroup key={cat} label={titre}>
                        {stock.filter((s) => s.categorie === cat).map((s) => (
                          <option key={s.id_produit} value={s.id_produit} disabled={dejaPris.includes(s.id_produit)}>
                            {nomProduit(s)} ({formatQuantite(s.quantite_stock, s.unite_prix)} en stock)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <label className="visuellement-cache" htmlFor={`qte-${l.cle}`}>Quantité {i + 1}</label>
                  <div className="ligne-conso__qte">
                    <input
                      id={`qte-${l.cle}`}
                      type="number" min="0" step="any" required
                      value={l.quantite}
                      onChange={(e) => modifier(l.cle, 'quantite', e.target.value)}
                    />
                    <span className="texte-doux">{p ? UNITES[p.unite_prix] : ''}</span>
                  </div>

                  {lignes.length > 1 && (
                    <button
                      type="button"
                      className="lien lien--danger"
                      onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                    >
                      Retirer<span className="visuellement-cache"> le consommable {i + 1}</span>
                    </button>
                  )}
                </div>
              );
            })}
            <button type="button" className="lien" onClick={() => setLignes((ls) => [...ls, nouvelleLigne()])}>
              + Ajouter un consommable
            </button>
          </fieldset>

          {est3d && (
            <fieldset disabled={confirmation}>
              <legend>Temps passés (en minutes)</legend>
              <div className="champ champ--court">
                <label htmlFor="t-impr">Impression</label>
                <input id="t-impr" type="number" min="0" value={tImpression} onChange={(e) => setTImpression(e.target.value)} />
                {tImpression !== '' && <p className="aide">= {duree(Number(tImpression))}</p>}
              </div>
              <div className="cases">
                <label><input type="checkbox" checked={poncage} onChange={(e) => setPoncage(e.target.checked)} /> Ponçage fait</label>
                {poncage && (
                  <div className="champ champ--court">
                    <label htmlFor="t-ponc">Temps de ponçage</label>
                    <input id="t-ponc" type="number" min="0" required value={tPoncage} onChange={(e) => setTPoncage(e.target.value)} />
                  </div>
                )}
                <label><input type="checkbox" checked={peinture} onChange={(e) => setPeinture(e.target.checked)} /> Peinture faite</label>
                {peinture && (
                  <div className="champ champ--court">
                    <label htmlFor="t-peint">Temps de peinture</label>
                    <input id="t-peint" type="number" min="0" required value={tPeinture} onChange={(e) => setTPeinture(e.target.value)} />
                    <p className="aide">Pense à ajouter la peinture utilisée dans les consommables.</p>
                  </div>
                )}
              </div>
            </fieldset>
          )}

          <p className="prix-estime">Prix estimé : <strong>{euros(total)}</strong></p>

          {!confirmation ? (
            <button type="submit" className="bouton bouton--primaire">Clôturer…</button>
          ) : (
            <div className="alerte alerte--attention" role="alert">
              <p>
                <strong>Confirmer la clôture ?</strong> Le stock sera décompté
                ({lignes.map((l) => `${formatQuantite(l.quantite, produit(l.id_produit).unite_prix)} ${nomProduit(produit(l.id_produit))}`).join(', ')})
                et l’élève recevra son bilan à {euros(total)}. Ce n’est pas annulable.
              </p>
              <div className="actions-statut">
                <button type="button" className="bouton bouton--secondaire" onClick={() => setConfirmation(false)} disabled={envoi}>
                  Modifier
                </button>
                <button type="button" className="bouton bouton--primaire" onClick={cloturer} disabled={envoi}>
                  {envoi ? 'Clôture…' : 'Confirmer la clôture'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
