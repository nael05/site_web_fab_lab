// Libellés et formats d'affichage partagés (réutilisables côté admin)

export const STATUTS = {
  soumis: 'Soumis',
  accepte: 'Accepté',
  refuse: 'Refusé',
  en_impression: 'En impression',
  en_finition: 'En finition',
  en_preparation: 'En préparation',
  pret: 'Prêt à récupérer',
  termine: 'Terminé',
};

export const CATEGORIES = { impression_3d: 'Impression 3D', tee_shirt: 'Flocage tee-shirt' };
export const CADRES = { ydays: 'Ydays', scolaire: 'Scolaire', perso: 'Perso' };

export const NIVEAUX_DETAIL = {
  1: 'Rapide (couche 0,28 mm)',
  2: 'Standard (0,20 mm)',
  3: 'Fin (0,16 mm)',
  4: 'Très fin (0,12 mm)',
  5: 'Ultra-fin (0,08 mm)',
};

// 465 -> "4,65 €"
export const euros = (centimes) =>
  (Number(centimes || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

// 200 -> "3 h 20"   45 -> "45 min"
export function duree(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// Quantité dans l'unité de base du stock : €/kg -> grammes, €/ml -> ml, €/u -> unités
export function quantite(q, unitePrix) {
  const n = Number(q).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (unitePrix === 'kg') return `${n} g`;
  if (unitePrix === 'ml') return `${n} ml`;
  return `${n} u.`;
}

export const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const heureFr = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const nomProduit = (p) => [p.nom ?? p.produit_nom, p.couleur ?? p.produit_couleur].filter(Boolean).join(' — ');

export const tailleFichier = (octets) =>
  octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
