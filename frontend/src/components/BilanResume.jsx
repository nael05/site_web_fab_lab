// Résumé auto généré à la clôture (Mes projets + Portfolio)
import { CADRES, CATEGORIES, duree, euros, quantite } from '../utils/format.js';

export default function BilanResume({ bilan, categorie, cadre }) {
  if (!bilan) return null;
  const est3d = categorie === 'impression_3d';
  const conso = bilan.consommations
    .map((c) => `${quantite(c.quantite, c.unite_prix)} ${c.nom}${c.couleur ? ` ${c.couleur.toLowerCase()}` : ''}`)
    .join(' + ');

  return (
    <section className="bilan" aria-label="Résumé du projet">
      <h4 className="bilan__titre">Résumé automatique</h4>
      <dl className="bilan__grille">
        <div>
          <dt>Catégorie</dt>
          <dd>{CATEGORIES[categorie]}{cadre && ` (${CADRES[cadre]})`}</dd>
        </div>
        <div className="bilan__large">
          <dt>Consommables</dt>
          <dd>{conso || '—'}</dd>
        </div>
        <div>
          <dt>Durées</dt>
          <dd>
            {est3d && <>Impr. {duree(bilan.temps_impression_min)}</>}
            {bilan.poncage_fait && <> · Ponç. {duree(bilan.temps_poncage_min)}</>}
            {bilan.peinture_faite && <> · Peint. {duree(bilan.temps_peinture_min)}</>}
            {!est3d && !bilan.poncage_fait && !bilan.peinture_faite && 'Flocage'}
          </dd>
        </div>
        <div>
          <dt>Délai de livraison</dt>
          <dd>
            {bilan.delai_livraison_jours != null
              ? `${bilan.delai_livraison_jours} jour${bilan.delai_livraison_jours > 1 ? 's' : ''}`
              : '—'}
          </dd>
        </div>
        <div className="bilan__prix">
          <dt>Prix consommables</dt>
          <dd>{euros(bilan.prix_total_centimes)}</dd>
        </div>
      </dl>
    </section>
  );
}
