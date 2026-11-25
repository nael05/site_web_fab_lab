// Libellés et petits calculs propres au back-office

// Type d'étape (table etape) -> texte affiché dans l'historique et le planning
export const TYPES_ETAPE = {
  soumission: 'Demande déposée',
  acceptation: 'Projet accepté',
  refus: 'Projet refusé',
  lancement_impression: 'Impression',
  poncage: 'Ponçage',
  peinture: 'Peinture',
  flocage: 'Flocage',
  pret: 'Prêt à récupérer',
  cloture: 'Projet clôturé',
};

// Statut visé -> texte du bouton qui y mène
export const ACTIONS_STATUT = {
  accepte: 'Accepter',
  refuse: 'Refuser',
  en_impression: 'Lancer l’impression',
  en_finition: 'Passer en finition',
  en_preparation: 'Commencer la préparation',
  pret: 'Marquer comme prêt',
  termine: 'Clôturer le projet',
};

// Filtres de la page Suivi : [clé, libellé, statuts concernés]
export const VUES_SUIVI = [
  ['a_traiter', 'À traiter', ['soumis']],
  ['en_cours', 'En cours', ['accepte', 'en_impression', 'en_finition', 'en_preparation']],
  ['prets', 'Prêts', ['pret']],
  ['termines', 'Terminés', ['termine']],
  ['refuses', 'Refusés', ['refuse']],
  ['tous', 'Tous', null],
];

export const STATUTS_FINIS = ['termine', 'refuse'];

// Même calcul que backend/src/services/prix.js (le back reste la référence :
// ici c'est seulement pour afficher une estimation avant de valider)
export function prixLigneCentimes(unitePrix, prixCentimes, quantite) {
  const q = Number(quantite) || 0;
  if (unitePrix === 'kg') return Math.round((q / 1000) * prixCentimes);
  return Math.round(q * prixCentimes);
}

// Date -> "2026-11-25" en heure LOCALE (toISOString donnerait l'heure UTC :
// à 0 h 30 à Paris, ce serait encore la veille)
export function isoLocal(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

// Pour un <input type="datetime-local"> : "2026-11-25T14:30"
export const pourDatetimeLocal = (date) => {
  const d = new Date(date);
  return `${isoLocal(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Nombre de jours entre aujourd'hui et une date "AAAA-MM-JJ" (négatif = dépassée)
export function joursRestants(dateIso) {
  const auj = new Date(isoLocal(new Date()));
  return Math.round((new Date(dateIso) - auj) / 86400000);
}

// -3 -> "en retard de 3 j" ; 0 -> "aujourd'hui" ; 1 -> "demain" ; 5 -> "dans 5 j"
export function texteEcheance(jours) {
  if (jours < 0) return `en retard de ${-jours} j`;
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  return `dans ${jours} j`;
}

// Durée en minutes entre deux dates (null si une manque)
export const minutesEntre = (debut, fin) =>
  debut && fin ? Math.max(0, Math.round((new Date(fin) - new Date(debut)) / 60000)) : null;

export const nomClient = (c) => [c.prenom, c.nom].filter(Boolean).join(' ') || c.email;
