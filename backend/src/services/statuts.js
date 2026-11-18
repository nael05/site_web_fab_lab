// Machine à états des projets : seules ces transitions sont autorisées.
// À utiliser côté admin avant chaque UPDATE projet.statut.

export const LIBELLES_STATUT = {
  soumis: 'Soumis',
  accepte: 'Accepté',
  refuse: 'Refusé',
  en_impression: 'En impression',
  en_finition: 'En finition',
  en_preparation: 'En préparation',
  pret: 'Prêt',
  termine: 'Terminé',
};

// statut actuel -> statuts suivants possibles, par catégorie
const TRANSITIONS = {
  impression_3d: {
    soumis: ['accepte', 'refuse'],
    accepte: ['en_impression'],
    en_impression: ['en_finition', 'pret'], // en_finition = ponçage / peinture
    en_finition: ['pret'],
    pret: ['termine'], // "termine" = clôture avec bilan (transaction)
  },
  tee_shirt: {
    soumis: ['accepte', 'refuse'],
    accepte: ['en_preparation'],
    en_preparation: ['pret'],
    pret: ['termine'],
  },
};

export const statutsSuivants = (categorie, statut) => TRANSITIONS[categorie]?.[statut] ?? [];

export const peutPasser = (categorie, de, vers) => statutsSuivants(categorie, de).includes(vers);
