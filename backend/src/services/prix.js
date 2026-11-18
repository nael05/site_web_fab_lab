// Calcul du prix d'une consommation (en centimes, arrondi).
// quantite est dans l'unité de base du stock : g (pour €/kg), ml (pour €/ml), unités (pour €/u)
//   kg    : 250 g à 2500 c/kg -> 0.25 × 2500 = 625 c
//   ml    : 15 ml à 10 c/ml   -> 150 c
//   unite : 2 tee-shirts à 600 c -> 1200 c
export function prixLigneCentimes(unitePrix, prixCentimes, quantite) {
  const q = Number(quantite);
  if (unitePrix === 'kg') return Math.round((q / 1000) * prixCentimes);
  return Math.round(q * prixCentimes); // 'ml' et 'unite'
}

// lignes = [{ unite_prix, prix_centimes, quantite }] -> total en centimes
export const prixTotalCentimes = (lignes) =>
  lignes.reduce((t, l) => t + prixLigneCentimes(l.unite_prix, l.prix_centimes, l.quantite), 0);
