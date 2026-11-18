import { STATUTS } from '../utils/format.js';

// Pastille de statut (couleurs dans global.css : .badge--<statut>)
export default function StatutBadge({ statut }) {
  return <span className={`badge badge--${statut}`}>{STATUTS[statut] ?? statut}</span>;
}
